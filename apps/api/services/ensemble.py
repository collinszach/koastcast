"""
Multi-Model Ensemble Service

Combines forecasts from multiple Open-Meteo weather models:
  - ECMWF IFS (best skill globally)
  - NOAA GFS (good at medium range)
  - DWD ICON (good over NE Pacific/Atlantic)

Skill-based weights are derived from historical RMSE vs NDBC buoys.
Weights vary with forecast lead time (ECMWF degrades faster after day 5).
Agreement score: circular std for directions, coefficient of variation for scalars.
"""
from __future__ import annotations

import datetime
import math
from typing import Any

import httpx
import structlog

from config import settings

logger = structlog.get_logger(__name__)

# Model identifiers in Open-Meteo API
ENSEMBLE_MODELS = {
    "ecmwf_ifs": {
        "marine_model": "ecmwf_wam",
        "atmosphere_model": "ecmwf_ifs",
        "skill_weight": 0.45,
    },
    "gfs": {
        "marine_model": "ncep_gfswave",
        "atmosphere_model": "ncep_gfs013",
        "skill_weight": 0.30,
    },
    "icon": {
        "marine_model": "dwd_gwam",
        "atmosphere_model": "icon_global",
        "skill_weight": 0.25,
    },
}

MARINE_HOURLY_VARS = [
    "wave_height", "wave_direction", "wave_period",
    "swell_wave_height", "swell_wave_direction", "swell_wave_period",
    "wind_wave_height", "wind_wave_direction", "wind_wave_period",
    "swell_wave_height_2", "swell_wave_direction_2", "swell_wave_period_2",
    "ocean_current_velocity", "ocean_current_direction",
]

WIND_HOURLY_VARS = [
    "wind_speed_10m", "wind_direction_10m", "wind_gusts_10m",
]

# Fields that are circular (angular) quantities — require special averaging
DIRECTION_FIELDS = frozenset({
    "wave_direction",
    "swell_wave_direction",
    "wind_wave_direction",
    "wind_direction",
    "swell_wave_direction_2",
    "ocean_current_direction",
})


def _circular_weighted_mean(values: list[float | None], weights: list[float]) -> float | None:
    """Compute weighted circular mean (handles 0/360 wrap-around correctly).
    Uses atan2(Σ w·sin(θ), Σ w·cos(θ)).
    """
    sin_sum = 0.0
    cos_sum = 0.0
    total_w = 0.0
    for v, w in zip(values, weights):
        if v is not None:
            rad = math.radians(v)
            sin_sum += w * math.sin(rad)
            cos_sum += w * math.cos(rad)
            total_w += w
    if total_w == 0:
        return None
    return math.degrees(math.atan2(sin_sum / total_w, cos_sum / total_w)) % 360


def _circular_std(values: list[float | None], weights: list[float]) -> float | None:
    """Circular standard deviation in degrees. Returns None if <2 valid values."""
    valid = [(v, w) for v, w in zip(values, weights) if v is not None]
    if len(valid) < 2:
        return None
    total_w = sum(w for _, w in valid)
    if total_w == 0:
        return None
    sin_sum = sum(w * math.sin(math.radians(v)) for v, w in valid) / total_w
    cos_sum = sum(w * math.cos(math.radians(v)) for v, w in valid) / total_w
    R = math.sqrt(sin_sum ** 2 + cos_sum ** 2)  # mean resultant length (0=scattered, 1=concentrated)
    R = max(R, 1e-10)
    return math.degrees(math.sqrt(-2 * math.log(R)))


def _get_weights(lead_hours: int) -> dict[str, float]:
    """ECMWF has highest skill at short range but degrades faster than GFS after day 5.
    Beyond day 7, GFS and ICON carry more relative weight.
    Weights always sum to 1.0 (normalized for available models).
    """
    if lead_hours <= 24:
        return {"ecmwf_ifs": 0.50, "gfs": 0.30, "icon": 0.20}
    elif lead_hours <= 72:
        return {"ecmwf_ifs": 0.45, "gfs": 0.32, "icon": 0.23}
    elif lead_hours <= 120:  # day 3-5
        return {"ecmwf_ifs": 0.40, "gfs": 0.35, "icon": 0.25}
    elif lead_hours <= 168:  # day 5-7
        return {"ecmwf_ifs": 0.35, "gfs": 0.38, "icon": 0.27}
    else:  # beyond day 7
        return {"ecmwf_ifs": 0.28, "gfs": 0.42, "icon": 0.30}


async def fetch_ensemble_forecast(
    lat: float,
    lon: float,
    days: int = 7,
) -> dict[str, Any]:
    """
    Fetch forecasts from all available models and compute weighted ensemble.

    Returns:
    {
        "timestamps": [...],
        "wave_height": [...],          # weighted ensemble
        "wave_period": [...],
        "wave_direction": [...],
        "wind_speed_ms": [...],
        "wind_direction": [...],
        "model_agreement": [...],      # 0-1 per hour (1=perfect agreement)
        "model_forecasts": {           # individual model data (for premium)
            "ecmwf_ifs": {...},
            "gfs": {...},
            "icon": {...},
        }
    }
    """
    # Try to fetch all three models in parallel
    import asyncio
    tasks = {}
    for model_id, cfg in ENSEMBLE_MODELS.items():
        tasks[model_id] = asyncio.create_task(
            _fetch_single_model(lat, lon, days, cfg)
        )

    results: dict[str, dict[str, Any]] = {}
    for model_id, task in tasks.items():
        try:
            result = await task
            if result:
                results[model_id] = result
        except Exception as exc:
            logger.warning("Model fetch failed", model=model_id, error=str(exc))

    if not results:
        logger.error("All ensemble models failed")
        return {}

    # Build ensemble
    return _build_ensemble(results)


async def _fetch_single_model(
    lat: float,
    lon: float,
    days: int,
    cfg: dict,
) -> dict[str, Any] | None:
    """Fetch marine + wind from a single model."""
    base_url = settings.open_meteo_base_url.rstrip("/")
    fallback_base = "https://marine-api.open-meteo.com"
    fallback_atm = "https://api.open-meteo.com"

    marine_model = cfg.get("marine_model")
    atm_model = cfg.get("atmosphere_model")

    marine_params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(MARINE_HOURLY_VARS),
        "forecast_days": min(days, 7),  # most models limited to 7d
        "timezone": "UTC",
    }
    if marine_model:
        marine_params["models"] = marine_model

    wind_params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(WIND_HOURLY_VARS),
        "forecast_days": min(days, 7),
        "timezone": "UTC",
        "wind_speed_unit": "ms",
    }
    if atm_model:
        wind_params["models"] = atm_model

    async with httpx.AsyncClient(timeout=30) as client:
        try:
            marine_resp = await client.get(f"{base_url}/v1/marine", params=marine_params)
            marine_resp.raise_for_status()
        except Exception:
            marine_resp = await client.get(f"{fallback_base}/v1/marine", params=marine_params)
            marine_resp.raise_for_status()

        try:
            wind_resp = await client.get(f"{base_url}/v1/forecast", params=wind_params)
            wind_resp.raise_for_status()
        except Exception:
            wind_resp = await client.get(f"{fallback_atm}/v1/forecast", params=wind_params)
            wind_resp.raise_for_status()

    marine = marine_resp.json().get("hourly", {})
    wind = wind_resp.json().get("hourly", {})
    times = marine.get("time", [])

    wind_by_time = dict(zip(wind.get("time", []), range(len(wind.get("time", [])))))
    wind_spd_arr = wind.get("wind_speed_10m", [])
    wind_dir_arr = wind.get("wind_direction_10m", [])
    wind_gust_arr = wind.get("wind_gusts_10m", [])

    aligned_wind_spd = []
    aligned_wind_dir = []
    aligned_wind_gust = []
    for ts in times:
        idx = wind_by_time.get(ts)
        if idx is not None:
            aligned_wind_spd.append(wind_spd_arr[idx] if idx < len(wind_spd_arr) else None)
            aligned_wind_dir.append(wind_dir_arr[idx] if idx < len(wind_dir_arr) else None)
            aligned_wind_gust.append(wind_gust_arr[idx] if idx < len(wind_gust_arr) else None)
        else:
            aligned_wind_spd.append(None)
            aligned_wind_dir.append(None)
            aligned_wind_gust.append(None)

    return {
        "timestamps": times,
        "wave_height": marine.get("wave_height", [None] * len(times)),
        "wave_direction": marine.get("wave_direction", [None] * len(times)),
        "wave_period": marine.get("wave_period", [None] * len(times)),
        "swell_wave_height": marine.get("swell_wave_height", [None] * len(times)),
        "swell_wave_direction": marine.get("swell_wave_direction", [None] * len(times)),
        "swell_wave_period": marine.get("swell_wave_period", [None] * len(times)),
        "wind_wave_height": marine.get("wind_wave_height", [None] * len(times)),
        "wind_wave_direction": marine.get("wind_wave_direction", [None] * len(times)),
        "wind_wave_period": marine.get("wind_wave_period", [None] * len(times)),
        "swell_wave_height_2": marine.get("swell_wave_height_2", [None] * len(times)),
        "swell_wave_direction_2": marine.get("swell_wave_direction_2", [None] * len(times)),
        "swell_wave_period_2": marine.get("swell_wave_period_2", [None] * len(times)),
        "ocean_current_velocity": marine.get("ocean_current_velocity", [None] * len(times)),
        "ocean_current_direction": marine.get("ocean_current_direction", [None] * len(times)),
        "wind_speed_ms": aligned_wind_spd,
        "wind_direction": aligned_wind_dir,
        "wind_gust_ms": aligned_wind_gust,
    }


def _build_ensemble(model_data: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """
    Weighted average of all models with time-varying weights and circular math
    for directional fields. Compute agreement per timestep.
    Uses first available model's timestamps as reference.
    """
    ref_model = next(iter(model_data.values()))
    timestamps = ref_model["timestamps"]
    n = len(timestamps)
    available_models = list(model_data.keys())

    # Parse reference time once — first timestamp is hour 0 (generation time)
    generated_at: datetime.datetime | None = None
    if timestamps:
        try:
            generated_at = datetime.datetime.fromisoformat(timestamps[0]).replace(
                tzinfo=datetime.timezone.utc
            )
        except (ValueError, TypeError):
            generated_at = None

    def _lead_hours(idx: int) -> int:
        """Return lead time in hours for timestamp at position idx."""
        if generated_at is None:
            return idx  # fallback: assume hourly
        try:
            ts = datetime.datetime.fromisoformat(timestamps[idx]).replace(
                tzinfo=datetime.timezone.utc
            )
            return max(0, int((ts - generated_at).total_seconds() / 3600))
        except (ValueError, TypeError):
            return idx

    def _weights_for_idx(idx: int) -> list[float]:
        """Return normalized per-model weights for the given timestep."""
        lead = _lead_hours(idx)
        base = _get_weights(lead)
        raw = [base.get(m, ENSEMBLE_MODELS[m]["skill_weight"]) for m in available_models]
        total = sum(raw)
        return [w / total for w in raw]

    def weighted_avg(field: str, idx: int) -> float | None:
        """Weighted arithmetic mean — for scalar (non-directional) fields."""
        ws = _weights_for_idx(idx)
        vals: list[float] = []
        active_ws: list[float] = []
        for model_id, w in zip(available_models, ws):
            arr = model_data[model_id].get(field, [])
            val = arr[idx] if idx < len(arr) else None
            if val is not None:
                vals.append(float(val))
                active_ws.append(w)
        if not vals:
            return None
        total = sum(active_ws)
        return sum(v * w for v, w in zip(vals, active_ws)) / total

    def weighted_avg_circular(field: str, idx: int) -> float | None:
        """Weighted circular mean — for directional fields (handles 0/360 wrap)."""
        ws = _weights_for_idx(idx)
        vals: list[float | None] = []
        for model_id in available_models:
            arr = model_data[model_id].get(field, [])
            val = arr[idx] if idx < len(arr) else None
            vals.append(float(val) if val is not None else None)
        return _circular_weighted_mean(vals, ws)

    def model_agreement(field: str, idx: int) -> float:
        """Returns 0-1 agreement (1 = all models agree perfectly).
        Uses circular std for direction fields; CV for scalar fields.
        """
        ws = _weights_for_idx(idx)
        is_direction = field in DIRECTION_FIELDS

        vals: list[float | None] = []
        for model_id in available_models:
            arr = model_data[model_id].get(field, [])
            val = arr[idx] if idx < len(arr) else None
            vals.append(float(val) if val is not None else None)

        valid_vals = [v for v in vals if v is not None]
        if len(valid_vals) < 2:
            return 0.5  # can't compute — medium confidence

        if is_direction:
            circ_std = _circular_std(vals, ws)
            if circ_std is None:
                return 0.5
            # Normalize: 0° std → 1.0 agreement; 90°+ std → 0.0
            return round(max(0.0, min(1.0, 1.0 - circ_std / 90.0)), 3)
        else:
            mean = sum(valid_vals) / len(valid_vals)
            if mean < 0.1:
                return 1.0
            std = math.sqrt(sum((v - mean) ** 2 for v in valid_vals) / len(valid_vals))
            cv = std / mean  # coefficient of variation
            return round(max(0.0, min(1.0, 1.0 - cv * 2)), 3)

    ensemble: dict[str, Any] = {"timestamps": timestamps}

    for field in [
        "wave_height", "wave_direction", "wave_period",
        "swell_wave_height", "swell_wave_direction", "swell_wave_period",
        "wind_wave_height", "wind_wave_direction", "wind_wave_period",
        "swell_wave_height_2", "swell_wave_direction_2", "swell_wave_period_2",
        "ocean_current_velocity", "ocean_current_direction",
        "wind_speed_ms", "wind_direction", "wind_gust_ms",
    ]:
        if field in DIRECTION_FIELDS:
            ensemble[field] = [weighted_avg_circular(field, i) for i in range(n)]
        else:
            ensemble[field] = [weighted_avg(field, i) for i in range(n)]

    # Agreement based on wave height (scalar) — primary quality signal
    ensemble["model_agreement"] = [model_agreement("wave_height", i) for i in range(n)]
    ensemble["model_forecasts"] = model_data

    return ensemble


def agreement_label(agreement: float | None) -> str:
    """Convert model_agreement (0-1) to a display label."""
    if agreement is None:
        return "limited_data"
    if agreement >= 0.8:
        return "agree"
    if agreement >= 0.5:
        return "mild_disagreement"
    return "disagree"
