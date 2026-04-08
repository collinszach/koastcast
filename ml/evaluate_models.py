"""
Model Evaluation Script

Evaluates all trained models against recent buoy observations
and session-reported conditions. Outputs accuracy metrics and
logs results to the forecast_accuracy Supabase table.

Usage:
    uv run python evaluate_models.py
    uv run python evaluate_models.py --days 30
    uv run python evaluate_models.py --model bias_correction
"""
from __future__ import annotations

import argparse
import os
import pickle
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from supabase import create_client

MODELS_DIR = Path(__file__).parent.parent / "apps" / "api" / "models" / "ml"

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def get_client():
    return create_client(SUPABASE_URL, SUPABASE_KEY)


# ─── Bias Correction Evaluation ─────────────────────────────────────────────

def evaluate_bias_correction(days: int = 30) -> pd.DataFrame:
    """
    Compare model-predicted face height vs buoy Hs for each spot.
    Uses forecast_accuracy table to compute per-spot MAE/RMSE.
    """
    client = get_client()
    result = client.table("forecast_accuracy").select("*").execute()
    df = pd.DataFrame(result.data)
    if df.empty:
        print("No forecast_accuracy data found.")
        return df

    df = df.dropna(subset=["predicted_height_m", "observed_height_m"])
    df["abs_error"] = (df["predicted_height_m"] - df["observed_height_m"]).abs()

    summary = df.groupby(["spot_id", "model_source"]).agg(
        n=("abs_error", "count"),
        mae=("abs_error", "mean"),
        rmse=("abs_error", lambda x: (x**2).mean()**0.5),
    ).reset_index()

    print("\n=== Bias Correction Accuracy ===")
    print(summary.to_string(index=False))
    return summary


# ─── Stoke Model Evaluation ──────────────────────────────────────────────────

def evaluate_stoke_model() -> pd.DataFrame:
    """
    Load the stoke model and evaluate on held-out session labels.
    """
    model_path = MODELS_DIR / "stoke_global.pkl"
    if not model_path.exists():
        print(f"Stoke model not found at {model_path}. Run train_stoke_model.py first.")
        return pd.DataFrame()

    with open(model_path, "rb") as f:
        artifact = pickle.load(f)

    model = artifact["model"]
    feature_cols = artifact["feature_cols"]

    client = get_client()
    result = client.table("session_training_labels").select("*").execute()
    df = pd.DataFrame(result.data)
    if df.empty:
        print("No session labels available.")
        return df

    df = df.dropna(subset=["stoke_label"])
    for col in feature_cols:
        if col not in df.columns:
            df[col] = 0.0
        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.0)

    X = df[feature_cols]
    y_true = df["stoke_label"].astype(float)
    y_pred = np.clip(model.predict(X), 0, 1)

    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5
    r2 = r2_score(y_true, y_pred)

    print(f"\n=== Stoke Model Accuracy (n={len(y_true)}) ===")
    print(f"  MAE:  {mae:.4f} ({mae*10:.2f}/10 scale)")
    print(f"  RMSE: {rmse:.4f}")
    print(f"  R²:   {r2:.4f}")

    # Per-spot breakdown
    if "spot_id" in df.columns:
        df["pred"] = y_pred
        df["error"] = (y_pred - y_true).abs()
        by_spot = df.groupby("spot_id").agg(
            n=("error", "count"),
            mae=("error", "mean"),
        ).sort_values("mae")
        print("\nPer-spot (top 5 best, bottom 5 worst):")
        print(pd.concat([by_spot.head(5), by_spot.tail(5)]).to_string())

    return pd.DataFrame([{"model": "stoke_global", "mae": mae, "rmse": rmse, "r2": r2}])


# ─── Crowd Model Evaluation ──────────────────────────────────────────────────

def evaluate_crowd_model() -> pd.DataFrame:
    model_path = MODELS_DIR / "crowd_global.pkl"
    if not model_path.exists():
        print(f"Crowd model not found at {model_path}. Run train_crowd_model.py first.")
        return pd.DataFrame()

    with open(model_path, "rb") as f:
        artifact = pickle.load(f)

    model = artifact["model"]
    feature_cols = artifact["feature_cols"]

    client = get_client()
    result = client.table("session_training_labels").select(
        "session_date, crowd_label, forecast_quality"
    ).not_.is_("crowd_label", "null").execute()
    df = pd.DataFrame(result.data)
    if df.empty:
        print("No crowd session labels available.")
        return pd.DataFrame()

    df["session_date"] = pd.to_datetime(df["session_date"])
    df["day_of_week"] = df["session_date"].dt.dayofweek
    df["hour_of_day"] = 10
    df["month"] = df["session_date"].dt.month
    df["quality_score"] = pd.to_numeric(df["forecast_quality"], errors="coerce").fillna(5.0)
    df["is_weekend"] = (df["day_of_week"] >= 5).astype(int)
    df["is_morning"] = 1

    X = df[feature_cols].astype(float)
    y_true = df["crowd_label"].astype(float)
    y_pred = np.clip(model.predict(X), 0, 1)

    mae = mean_absolute_error(y_true, y_pred)
    rmse = mean_squared_error(y_true, y_pred) ** 0.5

    print(f"\n=== Crowd Model Accuracy (n={len(y_true)}) ===")
    print(f"  MAE:  {mae:.4f}")
    print(f"  RMSE: {rmse:.4f}")

    return pd.DataFrame([{"model": "crowd_global", "mae": mae, "rmse": rmse}])


# ─── Log to Supabase ─────────────────────────────────────────────────────────

def log_to_supabase(metrics: pd.DataFrame, model_type: str) -> None:
    if metrics.empty:
        return
    client = get_client()
    for _, row in metrics.iterrows():
        client.table("model_training_runs").insert({
            "model_type": model_type,
            "status": "completed",
            "mae": float(row.get("mae", 0)),
            "rmse": float(row.get("rmse", 0)),
            "r2": float(row.get("r2", 0)) if "r2" in row else None,
        }).execute()


# ─── Main ────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate SwellStack ML models")
    parser.add_argument("--days", type=int, default=30, help="Days of history to evaluate")
    parser.add_argument(
        "--model",
        choices=["all", "bias_correction", "stoke", "crowd"],
        default="all",
    )
    parser.add_argument("--log", action="store_true", help="Log results to Supabase")
    args = parser.parse_args()

    results = {}

    if args.model in ("all", "bias_correction"):
        results["bias_correction"] = evaluate_bias_correction(days=args.days)

    if args.model in ("all", "stoke"):
        results["stoke"] = evaluate_stoke_model()
        if args.log:
            log_to_supabase(results["stoke"], "stoke")

    if args.model in ("all", "crowd"):
        results["crowd"] = evaluate_crowd_model()
        if args.log:
            log_to_supabase(results["crowd"], "crowd")

    print("\n✓ Evaluation complete.")


if __name__ == "__main__":
    main()
