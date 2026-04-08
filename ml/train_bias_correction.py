"""
Bias Correction Model Trainer

Trains a per-spot LightGBM model that predicts local face height
from offshore buoy readings.

Bootstrap label strategy (Phase 2):
  face_height = Hs * 0.85 * cos(swell_angle_to_spot)

In Phase 3+: Replace with real labels from session logs
(user-reported quality × wave height correlations).

Usage:
    uv run python ml/train_bias_correction.py --spots all
    uv run python ml/train_bias_correction.py --spots mavericks-ca steamer-lane-ca
    uv run python ml/train_bias_correction.py --spots all --years 5
"""
from __future__ import annotations

import argparse
import json
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.model_selection import TimeSeriesSplit

sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

DATA_DIR = Path(__file__).parent.parent / "data" / "ndbc_historical"
SPOTS_FILE = Path(__file__).parent.parent / "data" / "spots.json"
MODELS_DIR = Path(__file__).parent.parent / "apps" / "api" / "models" / "ml"

# Frequency bands to use as spectral features (first 12 low-frequency bands)
SPECTRAL_FEATURE_FREQS = [
    "0.0330", "0.0380", "0.0430", "0.0480", "0.0530", "0.0580",
    "0.0630", "0.0680", "0.0730", "0.0780", "0.0830", "0.0880",
]


def load_spots() -> list[dict]:
    with open(SPOTS_FILE) as f:
        return json.load(f)


def load_buoy_data(station_id: str, years_back: int = 10) -> pd.DataFrame | None:
    """Load all available historical stdmet data for a station."""
    import os
    CURRENT_YEAR = 2026
    dfs = []
    for year in range(CURRENT_YEAR - years_back, CURRENT_YEAR):
        path = DATA_DIR / f"{station_id}_{year}_stdmet.parquet"
        if path.exists():
            try:
                df = pd.read_parquet(path)
                dfs.append(df)
            except Exception as exc:
                print(f"  Warning: Failed to load {path}: {exc}")

    if not dfs:
        return None

    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.sort_values("observed_at").drop_duplicates("observed_at")
    return combined


def load_spectral_data(station_id: str, years_back: int = 10) -> pd.DataFrame | None:
    """Load spectral data for a station."""
    CURRENT_YEAR = 2026
    dfs = []
    for year in range(CURRENT_YEAR - years_back, CURRENT_YEAR):
        path = DATA_DIR / f"{station_id}_{year}_spectral.parquet"
        if path.exists():
            try:
                df = pd.read_parquet(path)
                dfs.append(df)
            except Exception as exc:
                print(f"  Warning: Failed to load {path}: {exc}")

    if not dfs:
        return None

    combined = pd.concat(dfs, ignore_index=True)
    combined = combined.sort_values("observed_at").drop_duplicates("observed_at")
    return combined


def engineer_features(
    df: pd.DataFrame,
    spot: dict,
    spectral_df: pd.DataFrame | None,
) -> tuple[pd.DataFrame, pd.Series]:
    """
    Build feature matrix and target labels for a spot.

    Features:
        - buoy_hs, buoy_tp, buoy_dir, buoy_apd
        - swell_angle_diff: |mwd - spot.optimal_swell_direction|
        - wind_speed, wind_dir
        - tide_height (if available)
        - day_of_year (seasonality)
        - hour_of_day (diurnal patterns)
        - spectral energy bands (first 12 low-freq bands)

    Labels (bootstrap):
        - face_height = Hs * 0.85 * cos(swell_angle_diff_rad)
    """
    df = df.copy()

    # Only rows with wave data
    df = df.dropna(subset=["wvht"])
    if df.empty:
        return pd.DataFrame(), pd.Series(dtype=float)

    # Temporal features
    obs_times = pd.to_datetime(df["observed_at"], utc=True)
    df["doy"] = obs_times.dt.dayofyear
    df["hour"] = obs_times.dt.hour

    # Swell angle difference
    optimal_dir = spot.get("optimal_swell_direction") or 270.0
    if "mwd" in df.columns:
        raw_diff = (df["mwd"].fillna(optimal_dir) - optimal_dir).abs() % 360
        df["swell_angle_diff"] = raw_diff.clip(upper=180)
    else:
        df["swell_angle_diff"] = 0.0

    # Core features
    features = pd.DataFrame({
        "wvht": df["wvht"].fillna(0),
        "dpd": df.get("dpd", pd.Series(10.0, index=df.index)).fillna(10.0),
        "apd": df.get("apd", pd.Series(8.0, index=df.index)).fillna(8.0),
        "mwd": df.get("mwd", pd.Series(optimal_dir, index=df.index)).fillna(optimal_dir),
        "swell_angle_diff": df["swell_angle_diff"],
        "wspd": df.get("wspd", pd.Series(0.0, index=df.index)).fillna(0.0),
        "wdir": df.get("wdir", pd.Series(0.0, index=df.index)).fillna(0.0),
        "doy": df["doy"],
        "hour": df["hour"],
    })

    # Merge spectral features
    if spectral_df is not None and not spectral_df.empty:
        spec_times = pd.to_datetime(spectral_df["observed_at"], utc=True)
        spectral_df = spectral_df.copy()
        spectral_df["observed_at"] = spec_times
        df_times = pd.to_datetime(df["observed_at"], utc=True)

        # Merge on nearest hour
        spec_rounded = spectral_df.set_index("observed_at")
        df_rounded = df.copy()
        df_rounded["observed_at_rounded"] = df_times.dt.floor("h")

        merged_spec = df_rounded.join(
            spec_rounded.add_prefix("spec_").reindex(df_times.dt.floor("h").values),
            on=None,
        )

        # Add available spectral band columns
        for freq_key in SPECTRAL_FEATURE_FREQS:
            col = f"spec_spec_{freq_key}"
            if col in merged_spec.columns:
                features[f"spec_{freq_key}"] = merged_spec[col].fillna(0).values
            else:
                features[f"spec_{freq_key}"] = 0.0
    else:
        for freq_key in SPECTRAL_FEATURE_FREQS:
            features[f"spec_{freq_key}"] = 0.0

    # Bootstrap labels: face_height = Hs × 0.85 × cos(angle_diff)
    angle_rad = np.radians(df["swell_angle_diff"].clip(0, 90))
    period_factor = 1.0 + np.maximum(0.0, (features["dpd"] - 10.0)) * 0.01
    labels = df["wvht"] * 0.85 * np.cos(angle_rad) * period_factor
    labels = labels.clip(lower=0.0)

    # Drop rows where labels are zero (no useful signal)
    valid = labels > 0.01
    return features[valid].reset_index(drop=True), labels[valid].reset_index(drop=True)


def train_spot_model(
    spot: dict,
    years_back: int,
    n_splits: int = 5,
) -> dict | None:
    """
    Train a LightGBM bias correction model for one spot.
    Returns evaluation metrics dict.
    """
    import lightgbm as lgb

    station_id = spot.get("nearest_buoy_id")
    if not station_id:
        print(f"  Skipping {spot['slug']}: no buoy assigned")
        return None

    print(f"\n{'='*60}")
    print(f"Training: {spot['name']} (buoy {station_id})")

    # Load data
    stdmet = load_buoy_data(station_id, years_back=years_back)
    if stdmet is None or stdmet.empty:
        print(f"  No historical data for buoy {station_id} — try running download_ndbc_history.py first")
        print(f"  Training will use synthetic data based on physics formula")
        # Generate minimal synthetic data so we can still save a "model"
        stdmet = _generate_synthetic_data(spot, n=5000)

    spectral = load_spectral_data(station_id, years_back=years_back)
    print(f"  Loaded {len(stdmet)} stdmet rows, {len(spectral) if spectral is not None else 0} spectral rows")

    # Feature engineering
    X, y = engineer_features(stdmet, spot, spectral)
    if X.empty or len(X) < 100:
        print(f"  Insufficient training data ({len(X)} rows)")
        return None

    print(f"  Features: {X.shape[1]}, Samples: {len(X)}")

    # Time-series cross-validation
    tscv = TimeSeriesSplit(n_splits=n_splits)
    fold_rmse = []
    fold_mae = []

    lgb_params = {
        "objective": "regression",
        "metric": "rmse",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "min_child_samples": 20,
        "feature_fraction": 0.8,
        "bagging_fraction": 0.8,
        "bagging_freq": 5,
        "verbosity": -1,
        "n_estimators": 300,
    }

    best_model = None
    best_fold_score = float("inf")

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        model = lgb.LGBMRegressor(**lgb_params)
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(50, verbose=False), lgb.log_evaluation(-1)],
        )

        preds = model.predict(X_val)
        rmse = np.sqrt(mean_squared_error(y_val, preds))
        mae = mean_absolute_error(y_val, preds)
        fold_rmse.append(rmse)
        fold_mae.append(mae)

        if rmse < best_fold_score:
            best_fold_score = rmse
            best_model = model

    avg_rmse = np.mean(fold_rmse)
    avg_mae = np.mean(fold_mae)
    print(f"  CV RMSE: {avg_rmse:.3f}m | MAE: {avg_mae:.3f}m")

    # Feature importance
    feature_names = X.columns.tolist()
    importances = dict(zip(feature_names, best_model.feature_importances_))
    top_features = sorted(importances.items(), key=lambda x: x[1], reverse=True)[:5]
    print(f"  Top features: {', '.join(f'{k}({v:.0f})' for k, v in top_features)}")

    # Retrain on all data for final model
    final_model = lgb.LGBMRegressor(**lgb_params)
    final_model.fit(X, y, callbacks=[lgb.log_evaluation(-1)])

    # Save model
    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    model_path = MODELS_DIR / f"bias_{spot['slug']}.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": final_model,
            "feature_names": feature_names,
            "spot_slug": spot["slug"],
            "station_id": station_id,
            "training_rows": len(X),
        }, f)
    print(f"  Saved: {model_path}")

    return {
        "spot": spot["slug"],
        "station_id": station_id,
        "rmse": avg_rmse,
        "mae": avg_mae,
        "n_samples": len(X),
    }


def _generate_synthetic_data(spot: dict, n: int = 5000) -> pd.DataFrame:
    """
    Generate synthetic training data when no historical data is available.
    Uses physical priors to create plausible wave conditions.
    """
    rng = np.random.default_rng(42)
    dates = pd.date_range("2016-01-01", periods=n, freq="h", tz="UTC")

    optimal_dir = spot.get("optimal_swell_direction") or 270.0
    size_min = spot.get("optimal_size_min") or 0.8
    size_max = spot.get("optimal_size_max") or 3.0

    wvht = rng.uniform(0.3, size_max * 1.5, n)
    dpd = rng.uniform(6, 20, n)
    mwd = rng.normal(optimal_dir, 30, n) % 360
    wspd = rng.exponential(5, n)
    wdir = rng.uniform(0, 360, n)

    return pd.DataFrame({
        "observed_at": dates,
        "station_id": spot.get("nearest_buoy_id", ""),
        "wvht": wvht,
        "dpd": dpd,
        "apd": dpd * 0.85,
        "mwd": mwd,
        "wspd": wspd,
        "wdir": wdir,
    })


def main(spot_slugs: list[str] | None, years_back: int) -> None:
    spots = load_spots()

    if spot_slugs and "all" not in spot_slugs:
        spots = [s for s in spots if s["slug"] in spot_slugs]

    if not spots:
        print("No matching spots found")
        return

    print(f"Training bias correction models for {len(spots)} spots")
    print(f"Using up to {years_back} years of historical data\n")

    results = []
    for spot in spots:
        try:
            result = train_spot_model(spot, years_back=years_back)
            if result:
                results.append(result)
        except Exception as exc:
            print(f"  ERROR training {spot['slug']}: {exc}")
            import traceback
            traceback.print_exc()

    # Summary table
    if results:
        print(f"\n{'='*60}")
        print("TRAINING SUMMARY")
        print(f"{'='*60}")
        print(f"{'Spot':<25} {'Buoy':<8} {'RMSE(m)':<10} {'MAE(m)':<10} {'Samples'}")
        print("-" * 60)
        for r in results:
            print(f"{r['spot']:<25} {r['station_id']:<8} {r['rmse']:.3f}     {r['mae']:.3f}     {r['n_samples']}")

        models_saved = list(MODELS_DIR.glob("bias_*.pkl"))
        print(f"\n{len(models_saved)} models saved to {MODELS_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train per-spot bias correction models")
    parser.add_argument("--spots", nargs="+", default=["all"])
    parser.add_argument("--years", type=int, default=10, dest="years_back")
    args = parser.parse_args()

    main(args.spots, args.years_back)
