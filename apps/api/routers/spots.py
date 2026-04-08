"""
Spots router
GET /api/v1/spots        → all spots with current conditions
GET /api/v1/spots/{slug} → spot detail with metadata
"""
from __future__ import annotations

import asyncio
from fastapi import APIRouter, HTTPException

import structlog

from db.supabase_client import get_spot_by_slug, get_spots
from models.schemas import CurrentConditions, Spot, SpotWithConditions
from services.open_meteo import fetch_marine_forecast, fetch_wind_forecast, align_wind_to_marine
from services.tides import fetch_tide_predictions, build_tide_lookup
from services.stoke_score import compute_stoke_score, DEFAULT_PREFERENCES, StokeInput
from services.bias_correction import SpotBiasCorrector, compute_angle_diff
from services.crowd_model import get_crowd_predictor
from datetime import datetime, timezone

logger = structlog.get_logger(__name__)

router = APIRouter()


async def _fetch_current_conditions(spot: Spot) -> CurrentConditions | None:
    """Fetch the current hour's conditions for a spot using the forecast pipeline."""
    try:
        marine_task = asyncio.create_task(fetch_marine_forecast(spot.lat, spot.lng, days=1))
        wind_task = asyncio.create_task(fetch_wind_forecast(spot.lat, spot.lng, days=1))
        marine_raw, wind_raw = await asyncio.gather(marine_task, wind_task, return_exceptions=True)

        if isinstance(marine_raw, Exception) or not marine_raw:
            return None

        marine = marine_raw if not isinstance(marine_raw, Exception) else []
        wind = wind_raw if not isinstance(wind_raw, Exception) else []

        if wind and not isinstance(wind, Exception):
            marine = align_wind_to_marine(marine, wind)

        # Tide lookup
        tide_lookup: dict = {}
        try:
            from routers.forecast import TIDE_STATION_FALLBACK
            station_id = TIDE_STATION_FALLBACK.get(spot.timezone, "9414290")
            tide_data = await fetch_tide_predictions(station_id, days=1)
            tide_lookup = build_tide_lookup(tide_data)
        except Exception:
            pass

        corrector = SpotBiasCorrector(spot.slug)
        get_crowd_predictor()  # preload

        now = datetime.now(timezone.utc)
        # marine is a dict-of-arrays: {"timestamps": [...], "wave_height": [...], ...}
        timestamps = marine.get("timestamps", [])
        current_idx = 0
        for i, ts_str in enumerate(timestamps):
            try:
                if isinstance(ts_str, str):
                    ft = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                else:
                    ft = ts_str
                if ft.tzinfo is None:
                    ft = ft.replace(tzinfo=timezone.utc)
                if abs((ft - now).total_seconds()) < 3600:
                    current_idx = i
                    break
            except Exception:
                continue

        def _get(key: str) -> float | None:
            arr = marine.get(key, [])
            try:
                v = arr[current_idx]
                return float(v) if v is not None else None
            except (IndexError, TypeError):
                return None

        wvht = _get("wave_height")
        period = _get("wave_period")
        direction = _get("wave_direction")
        wind_speed = _get("wind_speed_ms")
        wind_dir = _get("wind_direction")

        # Bias correction
        face_height = wvht
        if wvht and period and direction:
            angle_diff = compute_angle_diff(direction, spot.optimal_swell_direction or 270)
            face_height, _ = corrector.predict(
                buoy_hs=wvht,
                buoy_tp=period,
                buoy_dir=direction,
                swell_angle_diff=angle_diff,
                wind_speed=wind_speed or 5.0,
                wind_dir=wind_dir or 270.0,
                tide_height=0.0,
                spectral_bands=[],
                doy=now.timetuple().tm_yday,
            )

        # Tide
        ts_key = now.strftime("%Y-%m-%dT%H")
        tide_entry = tide_lookup.get(ts_key, {})
        tide_height = tide_entry.get("height_m")
        tide_state = tide_entry.get("state", "unknown")

        # Stoke score
        quality_score = None
        try:
            stoke_input = StokeInput(
                wave_height_face_m=face_height or 0,
                wave_period_s=period or 0,
                wave_direction=direction or 270,
                wind_speed_ms=wind_speed or 0,
                wind_direction=wind_dir or 270,
                wind_offshore_direction=spot.optimal_wind_direction or 270,
                crowd_score=0.5,
                tide_height_m=tide_height or 0,
                tide_state=tide_state,
            )
            result = compute_stoke_score(
                stoke_input,
                DEFAULT_PREFERENCES,
                spot.optimal_swell_direction or 270,
                spot.optimal_swell_direction_range,
            )
            quality_score = result.stoke_score / 10.0
        except Exception as e:
            logger.debug("Stoke score failed", error=str(e))

        return CurrentConditions(
            wave_height_face_m=round(face_height, 2) if face_height else None,
            wave_period_s=round(period, 1) if period else None,
            wave_direction=round(direction, 0) if direction else None,
            wind_speed_ms=round(wind_speed, 1) if wind_speed else None,
            wind_direction=round(wind_dir, 0) if wind_dir else None,
            tide_height_m=round(tide_height, 2) if tide_height else None,
            tide_state=tide_state,
            quality_score=round(quality_score, 2) if quality_score else None,
            forecast_time=now,
            model_source="open_meteo",
        )
    except Exception as exc:
        logger.warning("Failed to fetch current conditions", spot=spot.slug, error=str(exc))
        return None


@router.get("/spots", response_model=list[SpotWithConditions])
async def list_spots() -> list[SpotWithConditions]:
    """
    Return all surf spots with current conditions where available.
    Fetches live conditions for up to 20 spots concurrently.
    """
    spots = await get_spots()
    if not spots:
        raise HTTPException(status_code=503, detail="Spot data unavailable")

    # Fetch conditions for all spots concurrently (cap concurrency to avoid hammering Open-Meteo)
    sem = asyncio.Semaphore(8)

    async def fetch_with_sem(spot: Spot) -> CurrentConditions | None:
        async with sem:
            return await _fetch_current_conditions(spot)

    conditions = await asyncio.gather(*[fetch_with_sem(s) for s in spots], return_exceptions=True)

    result = []
    for spot, cc in zip(spots, conditions):
        if isinstance(cc, Exception):
            cc = None
        result.append(SpotWithConditions(**spot.model_dump(), current_conditions=cc))

    return result


@router.get("/spots/{slug}", response_model=SpotWithConditions)
async def get_spot(slug: str) -> SpotWithConditions:
    """Return detailed metadata for a single spot with current conditions."""
    spot = await get_spot_by_slug(slug)
    if not spot:
        raise HTTPException(status_code=404, detail=f"Spot '{slug}' not found")

    cc = await _fetch_current_conditions(spot)
    return SpotWithConditions(**spot.model_dump(), current_conditions=cc)
