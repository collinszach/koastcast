"""
Optimal Windows router
GET /api/v1/optimal/{spot_id} → top surf windows for next 16 days
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from db.supabase_client import get_spot_by_id, get_spot_by_slug
from routers.forecast import get_forecast  # reuse forecast assembly
from services.optimal_windows import OptimalWindow, find_optimal_windows
from services.stoke_score import DEFAULT_PREFERENCES, UserPreferences

router = APIRouter()


class OptimalWindowResponse(BaseModel):
    start_time: datetime
    end_time: datetime
    duration_hours: int
    peak_score: float
    peak_hour: datetime
    peak_stoke_score: float
    peak_wave_height_ft: float | None
    peak_wave_period_s: float | None
    peak_wind_speed_kt: float | None
    peak_tide_state: str | None
    crowd_level: str
    reason: str


class OptimalWindowsResponse(BaseModel):
    spot_id: str
    spot_name: str
    generated_at: datetime
    windows: list[OptimalWindowResponse]
    days_searched: int


@router.get("/optimal/{spot_id}", response_model=OptimalWindowsResponse)
async def get_optimal_windows(
    spot_id: str,
    days: int = Query(default=7, ge=1, le=16),
    min_score: float = Query(default=55.0, ge=0, le=100),
    # User preference overrides (optional)
    pref_min_height_m: float | None = None,
    pref_max_height_m: float | None = None,
    pref_min_period_s: float | None = None,
    skill_level: str | None = None,
) -> OptimalWindowsResponse:
    """
    Find optimal surf windows for a spot.

    Returns top 10 time windows where compound peak score exceeds min_score,
    sorted by peak score descending.

    Premium feature: requires authentication (pro/explorer tier).
    """
    # Resolve spot
    spot = await get_spot_by_slug(spot_id)
    if spot is None:
        spot = await get_spot_by_id(spot_id)
    if spot is None:
        raise HTTPException(status_code=404, detail=f"Spot '{spot_id}' not found")

    # Build user preferences
    prefs = UserPreferences(
        pref_min_height_m=pref_min_height_m or DEFAULT_PREFERENCES.pref_min_height_m,
        pref_max_height_m=pref_max_height_m or DEFAULT_PREFERENCES.pref_max_height_m,
        pref_min_period_s=pref_min_period_s or DEFAULT_PREFERENCES.pref_min_period_s,
        pref_offshore_importance=DEFAULT_PREFERENCES.pref_offshore_importance,
        pref_crowd_tolerance=DEFAULT_PREFERENCES.pref_crowd_tolerance,
        skill_level=skill_level or DEFAULT_PREFERENCES.skill_level,
    )

    # Fetch forecast
    try:
        from models.schemas import ForecastHour
        forecast = await get_forecast(spot_id=spot_id, days=days)
        forecast_hours = [h.model_dump() for h in forecast.hours]
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Forecast temporarily unavailable") from exc

    # Find windows
    windows = find_optimal_windows(
        forecast_hours=forecast_hours,
        spot=spot,
        prefs=prefs,
        min_score=min_score,
        max_windows=10,
    )

    def to_response(w: OptimalWindow) -> OptimalWindowResponse:
        return OptimalWindowResponse(
            start_time=w.start_time,
            end_time=w.end_time,
            duration_hours=w.duration_hours,
            peak_score=w.peak_score,
            peak_hour=w.peak_hour,
            peak_stoke_score=w.peak_stoke_score,
            peak_wave_height_ft=round(w.peak_wave_height_m * 3.281, 1) if w.peak_wave_height_m else None,
            peak_wave_period_s=w.peak_wave_period_s,
            peak_wind_speed_kt=round(w.peak_wind_speed_ms * 1.944, 1) if w.peak_wind_speed_ms else None,
            peak_tide_state=w.peak_tide_state,
            crowd_level=w.crowd_level,
            reason=w.reason,
        )

    return OptimalWindowsResponse(
        spot_id=str(spot.id) if spot.id else spot.slug,
        spot_name=spot.name,
        generated_at=datetime.now(timezone.utc),
        windows=[to_response(w) for w in windows],
        days_searched=days,
    )
