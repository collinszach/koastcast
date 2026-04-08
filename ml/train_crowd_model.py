"""
Train Crowd Prediction Model

Trains a LightGBM classifier that predicts crowd probability (0-1)
from time, quality, and historical crowd observations.

Initially uses rule-based labels from crowd_model.py as pseudo-labels
plus any real crowd ratings from user_sessions.

Usage:
    uv run python train_crowd_model.py
    uv run python train_crowd_model.py --spot-id <uuid>
"""
from __future__ import annotations

import argparse
import os
import pickle
from pathlib import Path

import lightgbm as lgb
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error
from sklearn.model_selection import TimeSeriesSplit
from supabase import create_client

MODELS_DIR = Path(__file__).parent.parent / "apps" / "api" / "models" / "ml"
MODELS_DIR.mkdir(parents=True, exist_ok=True)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

FEATURE_COLS = [
    "day_of_week",    # 0=Mon, 6=Sun
    "hour_of_day",    # 0-23
    "month",          # 1-12
    "quality_score",  # 0-10
    "is_weekend",     # 0/1
    "is_morning",     # 0/1 (6-10am)
]
TARGET_COL = "crowd_label"


def fetch_crowd_observations(spot_id: str | None = None) -> pd.DataFrame:
    """Fetch real crowd observations from user sessions."""
    client = create_client(SUPABASE_URL, SUPABASE_KEY)
    query = client.table("session_training_labels").select(
        "spot_id, session_date, crowd_label, forecast_quality"
    ).not_.is_("crowd_label", "null")
    if spot_id:
        query = query.eq("spot_id", spot_id)
    result = query.execute()
    df = pd.DataFrame(result.data)
    if df.empty:
        return df
    df["session_date"] = pd.to_datetime(df["session_date"])
    df["day_of_week"] = df["session_date"].dt.dayofweek
    df["month"] = df["session_date"].dt.month
    df["hour_of_day"] = 10  # default to mid-morning (sessions don't always have time)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_morning"] = 1
    df = df.rename(columns={"forecast_quality": "quality_score"})
    return df


def generate_pseudo_labels(n: int = 5000) -> pd.DataFrame:
    """
    Generate synthetic training data using the rule-based crowd model.
    This bootstraps the model before real session data accumulates.
    """
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))
    from services.crowd_model import CrowdPredictor

    predictor = CrowdPredictor()
    rng = np.random.default_rng(42)

    rows = []
    for _ in range(n):
        dow = rng.integers(0, 7)
        hour = rng.integers(5, 22)
        month = rng.integers(1, 13)
        quality = rng.uniform(0, 10)
        dt_str = f"2024-{month:02d}-{7+dow:02d}T{hour:02d}:00:00"
        from datetime import datetime
        dt = datetime(2024, int(month), min(28, 7 + int(dow)), int(hour))
        crowd_prob = predictor.predict(dt, float(quality))
        rows.append({
            "day_of_week": dow,
            "hour_of_day": hour,
            "month": month,
            "quality_score": quality,
            "is_weekend": int(dow >= 5),
            "is_morning": int(6 <= hour <= 10),
            TARGET_COL: crowd_prob,
        })
    return pd.DataFrame(rows)


def train(df: pd.DataFrame, spot_id: str | None = None) -> dict:
    X = df[FEATURE_COLS].astype(float)
    y = df[TARGET_COL].astype(float)

    print(f"Training on {len(X)} samples")
    tscv = TimeSeriesSplit(n_splits=5)
    fold_maes = []

    for fold, (train_idx, val_idx) in enumerate(tscv.split(X)):
        model = lgb.LGBMRegressor(
            n_estimators=150,
            learning_rate=0.05,
            max_depth=5,
            num_leaves=20,
            min_child_samples=5,
            random_state=42,
            verbose=-1,
        )
        model.fit(X.iloc[train_idx], y.iloc[train_idx])
        preds = np.clip(model.predict(X.iloc[val_idx]), 0, 1)
        mae = mean_absolute_error(y.iloc[val_idx], preds)
        fold_maes.append(mae)
        print(f"  Fold {fold+1}: MAE={mae:.4f}")

    final_model = lgb.LGBMRegressor(
        n_estimators=200, learning_rate=0.05, max_depth=5,
        num_leaves=20, min_child_samples=5, random_state=42, verbose=-1,
    )
    final_model.fit(X, y)

    avg_mae = float(np.mean(fold_maes))
    fi = dict(zip(X.columns, final_model.feature_importances_))
    print(f"\nAvg MAE: {avg_mae:.4f}")

    suffix = f"_{spot_id}" if spot_id else "_global"
    model_path = MODELS_DIR / f"crowd{suffix}.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({"model": final_model, "feature_cols": FEATURE_COLS}, f)
    print(f"Saved → {model_path}")

    return {"mae": avg_mae, "samples": len(X), "model_path": str(model_path), "feature_importance": fi}


def main() -> None:
    parser = argparse.ArgumentParser(description="Train SwellStack crowd prediction model")
    parser.add_argument("--spot-id", help="Train per-spot model")
    parser.add_argument("--no-pseudo", action="store_true", help="Skip synthetic pseudo-labels")
    args = parser.parse_args()

    dfs = []

    if not args.no_pseudo:
        print("Generating pseudo-labels from rule-based model...")
        pseudo = generate_pseudo_labels(n=5000)
        print(f"  Generated {len(pseudo)} pseudo-label rows")
        dfs.append(pseudo)

    print("Fetching real crowd observations from sessions...")
    real = fetch_crowd_observations(spot_id=args.spot_id)
    if not real.empty:
        print(f"  Found {len(real)} real observations")
        # Real data weighted 5× over pseudo-labels
        dfs.extend([real] * 5)
    else:
        print("  No real crowd data yet — using pseudo-labels only")

    if not dfs:
        print("No data available.")
        return

    df = pd.concat(dfs, ignore_index=True)
    metrics = train(df, spot_id=args.spot_id)
    print(f"\nDone. Crowd model MAE: {metrics['mae']:.4f}")


if __name__ == "__main__":
    main()
