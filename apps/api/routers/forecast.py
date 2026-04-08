"""
Forecast router
GET /api/v1/forecast/{spot_id}?days=7 → assembled hourly forecast
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

import structlog

from db.supabase_client import get_spot_by_id, get_spot_by_slug, get_spots
from models.schemas import ForecastHour, ForecastResponse
from services.bias_correction import SpotBiasCorrector, compute_angle_diff
from services.crowd_model import get_crowd_predictor
from services.ensemble import agreement_label, fetch_ensemble_forecast
from services.open_meteo import align_wind_to_marine, fetch_marine_forecast, fetch_wind_forecast
from services.stoke_score import (
    DEFAULT_PREFERENCES,
    StokeInput,
    compute_stoke_score,
)
from services.tides import build_tide_lookup, fetch_tide_predictions

logger = structlog.get_logger(__name__)

router = APIRouter()

# Nearest NOAA tide station to each spot's timezone region (fallback list)
# Format: timezone_prefix → NOAA station ID
TIDE_STATION_FALLBACK: dict[str, str] = {
    "America/Los_Angeles": "9414290",  # San Francisco
    "America/New_York": "8454000",     # Providence, RI
    "Pacific/Honolulu": "1612340",     # Honolulu
}


@router.get("/forecast/{spot_id}", response_model=ForecastResponse)
async def get_forecast(
    spot_id: str,
    days: int = Query(default=7, ge=1, le=16),
    ensemble: bool = Query(default=False, description="Use multi-model ensemble (slower)"),
) -> ForecastResponse:
    """
    Assemble an hourly surf forecast for a spot.

    - Wave/swell data: Open-Meteo Marine API
    - Wind data: Open-Meteo Forecast API
    - Face height: SpotBiasCorrector (physics fallback in Phase 1)
    - Tides: NOAA CO-OPS Tides API
    """
    # Resolve spot (accept UUID or slug)
    spot = None
    if "-" in spot_id and len(spot_id) > 30:
        spot = await get_spot_by_id(spot_id)
    if spot is None:
        spot = await get_spot_by_slug(spot_id)
    if spot is None:
        # Try loading from file
        all_spots = await get_spots()
        spot = next((s for s in all_spots if s.slug == spot_id or str(s.id) == spot_id), None)
    if spot is None:
        raise HTTPException(status_code=404, detail=f"Spot '{spot_id}' not found")

    log = logger.bind(spot=spot.slug, days=days)
    log.info("Building forecast")

    # Fetch forecast data
    model_forecasts = None
    model_agreement_arr: list[float | None] = []

    try:
        import asyncio
        if ensemble:
            merged = await fetch_ensemble_forecast(spot.lat, spot.lng, days=days)
            model_forecasts = merged.pop("model_forecasts", None)
            model_agreement_arr = merged.pop("model_agreement", [])
        else:
            marine_task = asyncio.create_task(fetch_marine_forecast(spot.lat, spot.lng, days=days))
            wind_task = asyncio.create_task(fetch_wind_forecast(spot.lat, spot.lng, days=days))
            marine, wind = await asyncio.gather(marine_task, wind_task)
            merged = align_wind_to_marine(marine, wind)
    except Exception as exc:
        log.error("Failed to fetch forecast data", error=str(exc))
        raise HTTPException(status_code=503, detail="Forecast data unavailable") from exc

    # Fetch tide predictions
    tide_station = _get_tide_station(spot)
    tides: dict[str, dict] = {}
    if tide_station:
        try:
            predictions = await fetch_tide_predictions(tide_station, days=days)
            tides = build_tide_lookup(predictions)
        except Exception as exc:
            log.warning("Tide fetch failed", error=str(exc))

    # Build bias corrector + crowd predictor for this spot
    corrector = SpotBiasCorrector(str(spot.id) if spot.id else spot.slug)
    crowd_predictor = get_crowd_predictor()

    # Assemble hourly forecast records
    hours: list[ForecastHour] = []
    timestamps = merged.get("timestamps", [])

    for i, ts_str in enumerate(timestamps):
        # Parse timestamp
        try:
            if ts_str.endswith("Z"):
                ts = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
            else:
                ts = datetime.fromisoformat(ts_str).replace(tzinfo=timezone.utc)
        except ValueError:
            continue

        wave_h = _safe_float(merged.get("wave_height", []), i)
        wave_p = _safe_float(merged.get("wave_period", []), i)
        wave_d = _safe_float(merged.get("wave_direction", []), i)
        swell_h = _safe_float(merged.get("swell_wave_height", []), i)
        swell_p = _safe_float(merged.get("swell_wave_period", []), i)
        swell_d = _safe_float(merged.get("swell_wave_direction", []), i)
        ww_h = _safe_float(merged.get("wind_wave_height", []), i)
        ww_p = _safe_float(merged.get("wind_wave_period", []), i)
        ww_d = _safe_float(merged.get("wind_wave_direction", []), i)
        wind_spd = _safe_float(merged.get("wind_speed_ms", []), i)
        wind_dir = _safe_float(merged.get("wind_direction", []), i)
        wind_gust = _safe_float(merged.get("wind_gust_ms", []), i)

        # Compute face height using bias corrector
        face_h: float | None = None
        confidence: float | None = None
        if wave_h is not None and wave_p is not None:
            swell_dir = swell_d or wave_d or 270.0
            optimal_dir = spot.optimal_swell_direction or 270.0
            angle_diff = compute_angle_diff(swell_dir, optimal_dir)
            face_h, confidence = corrector.predict(
                buoy_hs=wave_h,
                buoy_tp=wave_p,
                buoy_dir=swell_dir,
                swell_angle_diff=angle_diff,
                wind_speed=wind_spd or 0.0,
                wind_dir=wind_dir or 0.0,
                doy=ts.timetuple().tm_yday,
            )

        # Look up tide
        hour_key = ts.strftime("%Y-%m-%dT%H")
        tide_entry = tides.get(hour_key, {})
        tide_h = tide_entry.get("height_m")
        tide_state = tide_entry.get("tide_state")

        # Compute quality score using stoke engine with default prefs
        quality_score: float | None = None
        if face_h is not None and wave_p is not None:
            try:
                stoke_conditions = StokeInput(
                    wave_height_face_m=face_h,
                    wave_period_s=wave_p,
                    wave_direction=swell_d or wave_d or (spot.optimal_swell_direction or 270.0),
                    wind_speed_ms=wind_spd or 0.0,
                    wind_direction=wind_dir or (spot.optimal_wind_direction or 90.0),
                    wind_offshore_direction=spot.optimal_wind_direction or 90.0,
                    crowd_score=0.5,
                    tide_height_m=tide_h or 0.0,
                    tide_state=tide_state or "unknown",
                )
                stoke_result = compute_stoke_score(
                    conditions=stoke_conditions,
                    prefs=DEFAULT_PREFERENCES,
                    spot_optimal_swell_dir=spot.optimal_swell_direction or 270.0,
                    spot_optimal_swell_range=getattr(spot, "optimal_swell_direction_range", None) or 45.0,
                )
                quality_score = round(stoke_result.stoke_score / 10.0, 2)
            except Exception:
                pass

        # Crowd prediction
        crowd_prob = crowd_predictor.predict(
            forecast_time=ts,
            quality_score=quality_score,
            spot_baseline=0.4,
        )
        crowd_lbl = crowd_predictor.crowd_score_to_label(crowd_prob)

        # Model agreement (from ensemble mode)
        model_agree: float | None = _safe_float(model_agreement_arr, i) if model_agreement_arr else None

        hours.append(ForecastHour(
            forecast_time=ts,
            model_source="ensemble" if ensemble else "open_meteo",
            wave_height_m=wave_h,
            wave_height_face_m=face_h,
            wave_period_s=wave_p,
            wave_direction=wave_d,
            swell_height_m=swell_h,
            swell_period_s=swell_p,
            swell_direction=swell_d,
            wind_swell_height_m=ww_h,
            wind_swell_period_s=ww_p,
            wind_swell_direction=ww_d,
            wind_speed_ms=wind_spd,
            wind_direction=wind_dir,
            wind_gust_ms=wind_gust,
            tide_height_m=tide_h,
            tide_state=tide_state,
            quality_score=quality_score,
            confidence=confidence,
            crowd_score=crowd_prob,
            crowd_label=crowd_lbl,
            model_agreement=model_agree,
            model_agreement_label=agreement_label(model_agree),
        ))

    log.info("Forecast assembled", hours=len(hours))

    return ForecastResponse(
        spot_id=str(spot.id) if spot.id else spot.slug,
        spot_slug=spot.slug,
        generated_at=datetime.now(timezone.utc),
        hours=hours,
        days_available=days,
        model_sources=list(model_forecasts.keys()) if model_forecasts else ["open_meteo"],
        ensemble_mode=ensemble,
        model_forecasts=model_forecasts,
    )


def _safe_float(lst: list, i: int) -> float | None:
    try:
        val = lst[i]
        return float(val) if val is not None else None
    except (IndexError, TypeError, ValueError):
        return None


def _get_tide_station(spot) -> str | None:  # type: ignore[no-untyped-def]
    """
    Return the best NOAA tide station for a spot.
    Uses the spot's nearest_buoy_id region as a proxy.
    """
    # Hardcoded best tide stations per spot
    SPOT_TIDE_STATIONS: dict[str, str] = {
        "mavericks-ca": "9414290",       # SF
        "steamer-lane-ca": "9413450",    # Monterey
        "ocean-beach-sf-ca": "9414290",  # SF
        "rincon-ca": "9411340",          # Santa Barbara
        "lower-trestles-ca": "9410230",  # La Jolla
        "blacks-beach-ca": "9410230",    # La Jolla
        "sebastian-inlet-fl": "8721604", # Trident Pier, FL
        "cape-hatteras-nc": "8654400",   # Cape Hatteras
        "montauk-ny": "8510560",         # Montauk
        "pipeline-oahu-hi": "1612340",   # Honolulu (proxy)
    }
    return SPOT_TIDE_STATIONS.get(spot.slug) or TIDE_STATION_FALLBACK.get(spot.timezone)
