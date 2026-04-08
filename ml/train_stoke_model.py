"""
Train Stoke Score Model

Trains a per-user or generic LightGBM model that predicts user-reported
session quality (1-10) from forecast conditions. Uses session_training_labels
view from Supabase as ground truth.

Usage:
    uv run python train_stoke_model.py
    uv run python train_stoke_model.py --spot-id <uuid>  # per-spot model
    uv run python train_stoke_model.py --min-samples 50  # only if enough data
"""
from __future__ import annotations

import argparse
import os
import pickle
from datetime import date
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import TimeSeriesSplit
from supabase import create_client

MODELS_DIR = Path(__file__).parent.parent / "apps" / "api" / "models" / "ml"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

FEATURE_COLS = [
    "forecast_height_m",
    "forecast_period_s",
    "forecast_wind_ms",
    "forecast_wind_dir",
    "forecast_tide_m",
    "forecast_quality",
    "height_error_m",
]
TARGET_COL = "stoke_label"


def fetch_labels(spot_id: str | None = None) -> pd.DataFrame:
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    query = client.table("session_training_labels").select("*")
    if spot_id:
        query = query.eq("spot_id", spot_id)
    result = query.execute()
    df = pd.DataFrame(result.data)
    if df.empty:
        raise ValueError(f"No training data found (spot_id={spot_id})")
    return df


def prepare_features(df: pd.DataFrame) -> tuple[pd.DataFrame, pd.Series]:
    df = df.copy()
    # Fill missing forecast fields with median
    for col in FEATURE_COLS:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")
            df[col] = df[col].fillna(df[col].median())
        else:
            df[col] = 0.0
    # Cyclical wind direction encoding
    df["wind_dir_sin"] = np.sin(np.radians(df["forecast_wind_dir"].fillna(0)))
    df["wind_dir_cos"] = np.cos(np.radians(df["forecast_wind_dir"].fillna(0)))
    df = df.drop(columns=["forecast_wind_dir"])
    features = FEATURE_COLS[:-1] + ["wind_dir_sin", "wind_dir_cos", "forecast_quality"]
    features = [c for c in features if c in df.columns]
    return df[features], df[TARGET_COL].astype(float)


def train(df: pd.DataFrame, spot_id: str | None = None) -> dict:
    X, y = prepare_features(df)
    print(f"Training on {len(X)} samples, {X.shape[1]} features")

    tscv = TimeSeriesSplit(n_splits=5)
    fold_metrics: list[dict] = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        X_train, X_val = X.iloc[train_idx], X.iloc[val_idx]
        y_train, y_val = y.iloc[train_idx], y.iloc[val_idx]

        model = lgb.LGBMRegressor(
            n_estimators=200,
            learning_rate=0.05,
            max_depth=6,
            num_leaves=31,
            min_child_samples=10,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=-1,
        )
        model.fit(
            X_train, y_train,
            eval_set=[(X_val, y_val)],
            callbacks=[lgb.early_stopping(20, verbose=False)],
        )
        preds = model.predict(X_val)
        preds = np.clip(preds, 0, 1)
        mae = mean_absolute_error(y_val, preds)
        rmse = mean_squared_error(y_val, preds) ** 0.5
        fold_metrics.append({"mae": mae, "rmse": rmse, "n_val": len(y_val)})
        print(f"  Fold {fold+1}: MAE={mae:.4f} RMSE={rmse:.4f}")

    # Final model on all data
    final_model = lgb.LGBMRegressor(
        n_estimators=300,
        learning_rate=0.05,
        max_depth=6,
        num_leaves=31,
        min_child_samples=10,
        subsample=0.8,
        colsample_bytree=0.8,
        random_state=42,
        verbose=-1,
    )
    final_model.fit(X, y)

    avg_mae = np.mean([m["mae"] for m in fold_metrics])
    avg_rmse = np.mean([m["rmse"] for m in fold_metrics])
    r2 = r2_score(y, np.clip(final_model.predict(X), 0, 1))

    fi = dict(zip(X.columns, final_model.feature_importances_))
    print(f"\nFinal model: MAE={avg_mae:.4f} RMSE={avg_rmse:.4f} R²={r2:.4f}")
    print("Feature importance:", {k: round(v, 1) for k, v in sorted(fi.items(), key=lambda x: -x[1])[:5]})

    suffix = f"_{spot_id}" if spot_id else "_global"
    model_path = MODELS_DIR / f"stoke{suffix}.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({"model": final_model, "feature_cols": list(X.columns)}, f)
    print(f"Saved → {model_path}")

    return {
        "mae": avg_mae,
        "rmse": avg_rmse,
        "r2": r2,
        "samples": len(X),
        "model_path": str(model_path),
        "feature_importance": fi,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Train SwellStack stoke prediction model")
    parser.add_argument("--spot-id", help="Train for a specific spot UUID (default: global model)")
    parser.add_argument("--min-samples", type=int, default=30, help="Skip if fewer samples")
    args = parser.parse_args()

    print(f"Fetching session labels (spot_id={args.spot_id or 'all'})...")
    df = fetch_labels(spot_id=args.spot_id)
    print(f"Fetched {len(df)} labeled sessions")

    if len(df) < args.min_samples:
        print(f"Only {len(df)} samples — need at least {args.min_samples}. Skipping.")
        return

    metrics = train(df, spot_id=args.spot_id)
    print(f"\nDone. MAE: {metrics['mae']:.4f} (predicts stoke 0-1, ×100 = percentage)")


if __name__ == "__main__":
    main()
