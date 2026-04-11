"""
Peak Score router
POST /api/v1/stoke → compute personalized peak score for given conditions + user
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from db.supabase_client import get_spot_by_id, get_spot_by_slug
from services.stoke_score import (
    DEFAULT_PREFERENCES,
    StokeInput,
    UserPreferences,
    compute_stoke_score,
)

router = APIRouter()


class StokeRequest(BaseModel):
    spot_id: str
    forecast_time: datetime | None = None
    # User preferences (optional — uses defaults if not provided)
    user_id: str | None = None
    pref_min_height_m: float | None = None
    pref_max_height_m: float | None = None
    pref_min_period_s: float | None = None
    pref_offshore_importance: float | None = None
    pref_crowd_tolerance: float | None = None
    skill_level: str | None = None
    board_type: str | None = None
    # Conditions override (if not provided, fetches from forecast)
    wave_height_face_m: float | None = None
    wave_period_s: float | None = None
    wave_direction: float | None = None
    wind_speed_ms: float | None = None
    wind_direction: float | None = None
    crowd_score: float = Field(default=0.5, ge=0.0, le=1.0)


class StokeResponse(BaseModel):
    spot_id: str
    spot_name: str
    forecast_time: datetime
    stoke_score: float
    label: str
    emoji: str
    components: dict[str, float]
    is_personalized: bool


@router.post("/stoke", response_model=StokeResponse)
async def compute_spot_stoke(request: StokeRequest) -> StokeResponse:
    """
    Compute personalized peak score for a spot at a given time.

    - If user preferences are provided: personalizes the score
    - Otherwise: returns generic quality score
    - If conditions aren't provided: fetches from current forecast
    """
    # Resolve spot
    spot = await get_spot_by_slug(request.spot_id)
    if spot is None:
        spot = await get_spot_by_id(request.spot_id)
    if spot is None:
        raise HTTPException(status_code=404, detail=f"Spot '{request.spot_id}' not found")

    # Build preferences
    is_personalized = any([
        request.pref_min_height_m,
        request.pref_max_height_m,
        request.pref_min_period_s,
        request.pref_offshore_importance,
        request.skill_level,
    ])

    prefs = UserPreferences(
        pref_min_height_m=request.pref_min_height_m or DEFAULT_PREFERENCES.pref_min_height_m,
        pref_max_height_m=request.pref_max_height_m or DEFAULT_PREFERENCES.pref_max_height_m,
        pref_min_period_s=request.pref_min_period_s or DEFAULT_PREFERENCES.pref_min_period_s,
        pref_offshore_importance=request.pref_offshore_importance or DEFAULT_PREFERENCES.pref_offshore_importance,
        pref_crowd_tolerance=request.pref_crowd_tolerance or DEFAULT_PREFERENCES.pref_crowd_tolerance,
        skill_level=request.skill_level or DEFAULT_PREFERENCES.skill_level,
        board_type=request.board_type or DEFAULT_PREFERENCES.board_type,
    )

    # Get conditions (from request or fetch from forecast)
    wave_h = request.wave_height_face_m
    wave_p = request.wave_period_s
    wave_d = request.wave_direction
    wind_spd = request.wind_speed_ms
    wind_dir = request.wind_direction

    if any(v is None for v in [wave_h, wave_p, wave_d, wind_spd, wind_dir]):
        # Fetch current forecast to get conditions
        try:
            from services.open_meteo import align_wind_to_marine, fetch_marine_forecast, fetch_wind_forecast
            import asyncio
            marine_task = asyncio.create_task(fetch_marine_forecast(spot.lat, spot.lng, days=1))
            wind_task = asyncio.create_task(fetch_wind_forecast(spot.lat, spot.lng, days=1))
            marine, wind = await asyncio.gather(marine_task, wind_task)
            merged = align_wind_to_marine(marine, wind)
            # Use first (current) hour
            wave_h = wave_h or (merged.get("wave_height", [None])[0])
            wave_p = wave_p or (merged.get("wave_period", [None])[0])
            wave_d = wave_d or (merged.get("wave_direction", [None])[0])
            wind_spd = wind_spd or (merged.get("wind_speed_ms", [None])[0])
            wind_dir = wind_dir or (merged.get("wind_direction", [None])[0])
        except Exception:
            pass

    # Fallback defaults if still None
    wave_h = wave_h or 1.0
    wave_p = wave_p or 10.0
    wave_d = wave_d or (spot.optimal_swell_direction or 270.0)
    wind_spd = wind_spd or 5.0
    wind_dir = wind_dir or (spot.optimal_wind_direction or 90.0)

    conditions = StokeInput(
        wave_height_face_m=wave_h,
        wave_period_s=wave_p,
        wave_direction=wave_d,
        wind_speed_ms=wind_spd,
        wind_direction=wind_dir,
        wind_offshore_direction=spot.optimal_wind_direction or 90.0,
        crowd_score=request.crowd_score,
    )

    result = compute_stoke_score(
        conditions=conditions,
        prefs=prefs,
        spot_optimal_swell_dir=spot.optimal_swell_direction or 270.0,
        spot_optimal_swell_range=spot.optimal_swell_direction_range or 45.0,
    )

    return StokeResponse(
        spot_id=str(spot.id) if spot.id else spot.slug,
        spot_name=spot.name,
        forecast_time=request.forecast_time or datetime.now(timezone.utc),
        stoke_score=result.stoke_score,
        label=result.label,
        emoji=result.emoji,
        components=result.components,
        is_personalized=is_personalized,
    )
