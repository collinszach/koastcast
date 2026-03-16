"""
Gear router
GET  /api/v1/gear/recommend/{spot_id}  → board + wetsuit recommendation for conditions
"""
from __future__ import annotations

from fastapi import APIRouter, Query

import structlog

from db.supabase_client import get_spot_by_slug, get_spots
from services.gear_recommender import (
    BoardProfile,
    WetsuitProfile,
    build_gear_recommendation,
)
from services.open_meteo import fetch_marine_forecast
from services.ndbc import fetch_buoy_stdmet

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/gear/recommend/{spot_id}")
async def recommend_gear(
    spot_id: str,
    face_height_m: float | None = Query(default=None),
    wave_period_s: float | None = Query(default=None),
    water_temp_c: float | None = Query(default=None),
    skill_level: str = Query(default="intermediate"),
    # Board quiver (passed as JSON-encoded list in query string — simplified for now)
    # In production these would come from the user's Supabase quiver
) -> dict:
    """
    Return gear recommendation for conditions at a spot.

    In the MVP, this returns generic recommendations based on conditions.
    When the user has a quiver saved in Supabase, the frontend can POST
    their boards/wetsuits and get personalized picks.
    """
    # Resolve spot
    spot = await get_spot_by_slug(spot_id)
    if spot is None:
        all_spots = await get_spots()
        spot = next((s for s in all_spots if s.slug == spot_id), None)

    # If no conditions provided, try to fetch current conditions
    if face_height_m is None and spot is not None:
        try:
            marine = await fetch_marine_forecast(spot.lat, spot.lng, days=1)
            heights = marine.get("wave_height", [])
            periods = marine.get("wave_period", [])
            face_height_m = float(heights[0]) if heights else None
            wave_period_s = float(periods[0]) if periods else None
        except Exception:
            pass

    # Try to get water temperature from buoy
    if water_temp_c is None and spot is not None and spot.nearest_buoy_id:
        try:
            df = await fetch_buoy_stdmet(spot.nearest_buoy_id)
            if not df.empty and "WTMP" in df.columns:
                wtmp = df["WTMP"].dropna().iloc[0] if not df["WTMP"].dropna().empty else None
                water_temp_c = float(wtmp) if wtmp else None
        except Exception:
            pass

    # Build recommendation with empty quiver (generic)
    rec = build_gear_recommendation(
        boards=[],
        wetsuits=[],
        face_height_m=face_height_m,
        wave_period_s=wave_period_s,
        water_temp_c=water_temp_c,
        skill_level=skill_level,
    )

    from services.gear_recommender import recommend_wetsuit_by_temp, _board_type_for_conditions
    face_ft = (face_height_m or 0.9) * 3.28
    period = wave_period_s or 10.0
    water_f = water_temp_c * 9 / 5 + 32 if water_temp_c else None

    ideal_board_types = _board_type_for_conditions(face_ft, period, skill_level)
    ideal_wetsuit, wetsuit_desc = recommend_wetsuit_by_temp(water_f) if water_f else ("unknown", "temperature data unavailable")

    return {
        "spot_id": spot_id,
        "conditions": {
            "face_height_m": face_height_m,
            "wave_period_s": wave_period_s,
            "water_temp_c": water_temp_c,
            "water_temp_f": water_f,
        },
        "generic_recommendation": {
            "board_types": ideal_board_types[:3],
            "board_reasoning": _board_reasoning(face_ft, period, ideal_board_types),
            "wetsuit_thickness": ideal_wetsuit,
            "wetsuit_reasoning": wetsuit_desc,
        },
    }


def _board_reasoning(face_ft: float, period_s: float, types: list[str]) -> str:
    if not types:
        return "No recommendation available"
    primary = types[0]
    if primary == "gun":
        return f"At {face_ft:.0f}ft, you need a gun — a shortboard won't have enough paddle power"
    if primary == "longboard":
        return f"Small {face_ft:.0f}ft surf — maximize wave count with more volume"
    if primary == "fish":
        if period_s < 9:
            return f"Short-period {period_s:.0f}s swell needs a board that generates its own speed — fish is ideal"
        return f"{face_ft:.0f}ft @ {period_s:.0f}s is classic fish conditions"
    if primary == "shortboard":
        return f"Solid {face_ft:.0f}ft @ {period_s:.0f}s — shortboard conditions"
    return f"Best board type for {face_ft:.0f}ft conditions"
