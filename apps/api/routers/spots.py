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


# Hard cap on how many spots we'll ever fetch live conditions for in one request.
# The catalog is global (1000+ spots); fetching conditions for all would mean
# thousands of Open-Meteo calls. Conditions are opt-in and bounded.
MAX_CONDITIONS_FETCH = 30


@router.get("/spots", response_model=list[SpotWithConditions])
async def list_spots(
    conditions: bool = False,
    near: str | None = None,
    limit: int = 0,
) -> list[SpotWithConditions]:
    """
    Return surf spots.

    By default returns **metadata only** — fast and scales to the full global
    catalog (1000+ spots). Live conditions are opt-in and bounded:

    - `?conditions=true` — attach current conditions for a bounded set.
    - `?near=lat,lng`     — restrict the conditions set to the nearest spots.
    - `?limit=N`          — cap results (and the conditions set).

    Pin coloring at "all spots" zoom should rely on metadata; full quality +
    Trust Score come from `/forecast/{spot}` when a spot is opened.
    """
    spots = await get_spots()
    if not spots:
        raise HTTPException(status_code=503, detail="Spot data unavailable")

    # Optional: rank by proximity to a point.
    origin = _parse_near(near)
    if origin is not None:
        spots = sorted(spots, key=lambda s: _dist2(origin, (s.lat, s.lng)))

    if limit and limit > 0:
        spots = spots[:limit]

    # Metadata-only fast path (default).
    if not conditions:
        return [SpotWithConditions(**s.model_dump(), current_conditions=None) for s in spots]

    # Bounded live-conditions path.
    targets = spots[:MAX_CONDITIONS_FETCH]
    sem = asyncio.Semaphore(8)

    async def fetch_with_sem(spot: Spot) -> CurrentConditions | None:
        async with sem:
            return await _fetch_current_conditions(spot)

    cond = await asyncio.gather(*[fetch_with_sem(s) for s in targets], return_exceptions=True)
    cond_by_slug: dict[str, CurrentConditions | None] = {}
    for spot, cc in zip(targets, cond):
        cond_by_slug[spot.slug] = None if isinstance(cc, Exception) else cc

    return [
        SpotWithConditions(**s.model_dump(), current_conditions=cond_by_slug.get(s.slug))
        for s in spots
    ]


def _parse_near(near: str | None) -> tuple[float, float] | None:
    if not near:
        return None
    try:
        lat_s, lng_s = near.split(",")
        return (float(lat_s), float(lng_s))
    except (ValueError, AttributeError):
        return None


def _dist2(a: tuple[float, float], b: tuple[float, float]) -> float:
    # Cheap squared planar distance — fine for ranking.
    return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2


@router.get("/spots/{slug}", response_model=SpotWithConditions)
async def get_spot(slug: str) -> SpotWithConditions:
    """Return detailed metadata for a single spot with current conditions."""
    spot = await get_spot_by_slug(slug)
    if not spot:
        raise HTTPException(status_code=404, detail=f"Spot '{slug}' not found")

    cc = await _fetch_current_conditions(spot)
    return SpotWithConditions(**spot.model_dump(), current_conditions=cc)
