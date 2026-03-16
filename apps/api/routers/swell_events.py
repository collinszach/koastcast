"""
Swell Events router
GET /api/v1/swell-events/{spot_id} → upcoming named swell events (16-day)
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

import structlog

from db.supabase_client import get_spot_by_slug, get_spots
from services.open_meteo import fetch_marine_forecast
from services.swell_tracker import detect_swell_events

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/swell-events/{spot_id}")
async def get_swell_events(
    spot_id: str,
    days: int = Query(default=16, ge=3, le=16),
) -> dict:
    """
    Detect and return named swell events in the upcoming 16-day forecast.

    Each event has: name, origin, peak time, height, period, direction,
    confidence level, days away, and direction fit for this specific spot.

    This powers the Swell Event Tracker — surfers watch forming events
    from 10+ days out, checking 10-20 times/day as models refine.
    """
    # Resolve spot
    spot = await get_spot_by_slug(spot_id)
    if spot is None:
        all_spots = await get_spots()
        spot = next((s for s in all_spots if s.slug == spot_id), None)
    if spot is None:
        raise HTTPException(status_code=404, detail=f"Spot '{spot_id}' not found")

    # Fetch extended forecast
    try:
        marine = await fetch_marine_forecast(spot.lat, spot.lng, days=days)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Forecast data unavailable") from exc

    # Build hour dicts for the event detector
    timestamps = marine.get("timestamps", [])
    wave_heights = marine.get("wave_height", [])
    wave_periods = marine.get("wave_period", [])
    swell_heights = marine.get("swell_wave_height", [])
    swell_directions = marine.get("swell_wave_direction", [])
    wave_directions = marine.get("wave_direction", [])

    def safe(lst: list, i: int):
        try:
            v = lst[i]
            return float(v) if v is not None else None
        except (IndexError, TypeError, ValueError):
            return None

    forecast_hours = []
    for i, ts in enumerate(timestamps):
        face_h = safe(swell_heights, i) or safe(wave_heights, i)
        forecast_hours.append({
            "forecast_time": ts,
            "wave_height_m": safe(wave_heights, i),
            "wave_height_face_m": face_h,
            "wave_period_s": safe(wave_periods, i),
            "swell_direction": safe(swell_directions, i),
            "wave_direction": safe(wave_directions, i),
            "model_agreement": None,  # would come from ensemble in premium mode
        })

    now = datetime.now(timezone.utc)
    events = detect_swell_events(
        forecast_hours=forecast_hours,
        now=now,
        optimal_swell_direction=spot.optimal_swell_direction,
        optimal_swell_direction_range=getattr(spot, "optimal_swell_direction_range", None) or 45.0,
        max_events=5,
    )

    return {
        "spot_id": spot_id,
        "spot_name": spot.name,
        "generated_at": now.isoformat(),
        "events": [e.to_dict() for e in events],
        "has_significant_events": any(e.score >= 40 for e in events),
    }
