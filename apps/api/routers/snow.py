"""
Snow conditions router
GET /api/v1/snow/conditions/{resort_id}  → current powder conditions
GET /api/v1/snow/history/{resort_id}     → 30-day snow depth history
GET /api/v1/snow/resorts                 → list all resorts
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import structlog
from fastapi import APIRouter, HTTPException

from services.snow.snotel import fetch_snotel_current, fetch_snotel_history

logger = structlog.get_logger(__name__)
router = APIRouter()


# ─── Data loader ──────────────────────────────────────────────────────────────

def load_resorts() -> list[dict]:
    """Load resorts from data/resorts.json."""
    candidates = [
        Path(__file__).parent.parent.parent.parent / "data" / "resorts.json",
        Path("/app/data/resorts.json"),
        Path("data/resorts.json"),
    ]
    for data_path in candidates:
        if data_path.exists():
            try:
                return json.loads(data_path.read_text())
            except Exception as exc:
                logger.error("Failed to parse resorts.json", path=str(data_path), error=str(exc))
    logger.warning("resorts.json not found in any candidate path")
    return []


def find_resort(resort_id: str) -> dict | None:
    """Lookup a resort by id or slug."""
    for resort in load_resorts():
        if resort.get("id") == resort_id or resort.get("slug") == resort_id:
            return resort
    return None


# ─── Powder score ─────────────────────────────────────────────────────────────

def compute_powder_score(
    new_snow_24h: float | None,
    new_snow_48h: float | None,
    new_snow_72h: float | None,
    base_depth: float | None,
    temp_f: float | None,
    wind_speed_mph: float | None = None,
) -> int:
    """
    Returns 0-100 powder score.
    Heavy weight on recent snow (24h/48h), base depth, cold temps.
    """
    score: float = 0.0

    # New snow in last 24h — max 40 points (10 inches → 40 pts)
    if new_snow_24h is not None:
        score += min(40.0, new_snow_24h * 4.0)

    # New snow in the 25-72h window — max 25 points
    snow_25_48 = max(0.0, (new_snow_48h or 0.0) - (new_snow_24h or 0.0))
    snow_49_72 = max(0.0, (new_snow_72h or 0.0) - (new_snow_48h or 0.0))
    window_snow = snow_25_48 + snow_49_72
    score += min(25.0, window_snow * 2.5)

    # Base depth — max 20 points (130-inch base → ~19.5 pts)
    if base_depth is not None:
        score += min(20.0, base_depth * 0.15)

    # Temperature — max 15 points (colder = better powder)
    if temp_f is not None:
        if temp_f <= 10:
            score += 15.0
        elif temp_f <= 20:
            score += 12.0
        elif temp_f <= 28:
            score += 8.0
        elif temp_f <= 32:
            score += 4.0
        # above freezing → 0 points (heavy/wet snow)

    return min(100, round(score))


def _powder_label(score: int) -> str:
    if score >= 85:
        return "EPIC POWDER"
    if score >= 70:
        return "GREAT CONDITIONS"
    if score >= 50:
        return "GOOD SNOW"
    if score >= 30:
        return "FAIR"
    return "THIN COVER"


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/snow/resorts")
async def list_resorts() -> dict:
    """Return all known resorts (metadata only, no live snow data)."""
    resorts = load_resorts()
    # Strip internal fields not needed by the client
    slim = [
        {k: v for k, v in r.items() if k != "nearest_snotel_id"}
        for r in resorts
    ]
    return {"resorts": slim, "total": len(slim)}


@router.get("/snow/conditions/{resort_id}")
async def get_snow_conditions(resort_id: str) -> dict:
    """
    Return current snow conditions for a resort.

    Loads resort from data/resorts.json, finds nearest_snotel_id,
    fetches SNOTEL data, computes powder score, returns full conditions dict.
    """
    resort = find_resort(resort_id)
    if not resort:
        raise HTTPException(
            status_code=404,
            detail={"error": "Resort not found", "detail": f"No resort with id '{resort_id}'"},
        )

    snotel_id: str | None = resort.get("nearest_snotel_id")
    if not snotel_id:
        raise HTTPException(
            status_code=422,
            detail={
                "error": "No SNOTEL station",
                "detail": f"Resort '{resort_id}' has no nearest_snotel_id configured",
            },
        )

    snow = await fetch_snotel_current(snotel_id)

    powder_score = compute_powder_score(
        new_snow_24h=snow.get("new_snow_24h_in"),
        new_snow_48h=snow.get("new_snow_48h_in"),
        new_snow_72h=snow.get("new_snow_72h_in"),
        base_depth=snow.get("base_depth_in"),
        temp_f=snow.get("temperature_f"),
    )

    return {
        "resort": {
            "id": resort.get("id"),
            "name": resort.get("name"),
            "region": resort.get("region"),
            "state": resort.get("state"),
            "base_elevation_m": resort.get("base_elevation_m"),
            "summit_elevation_m": resort.get("summit_elevation_m"),
            "pass": resort.get("pass"),
        },
        "snow": {
            "new_snow_24h_in": snow.get("new_snow_24h_in"),
            "new_snow_48h_in": snow.get("new_snow_48h_in"),
            "new_snow_72h_in": snow.get("new_snow_72h_in"),
            "base_depth_in": snow.get("base_depth_in"),
            "swe_in": snow.get("swe_in"),
            "temperature_f": snow.get("temperature_f"),
        },
        "powder_score": powder_score,
        "powder_label": _powder_label(powder_score),
        "snotel": {
            "station_id": snotel_id,
            "station_name": snow.get("station_name"),
            "elevation_ft": snow.get("elevation_ft"),
            "updated_at": snow.get("updated_at"),
        },
    }


@router.get("/snow/history/{resort_id}")
async def get_snow_history(resort_id: str, days: int = 30) -> dict:
    """Return daily snow depth + SWE history (for sparkline charts)."""
    if days < 1 or days > 90:
        raise HTTPException(status_code=422, detail={"error": "days must be between 1 and 90"})

    resort = find_resort(resort_id)
    if not resort:
        raise HTTPException(
            status_code=404,
            detail={"error": "Resort not found", "detail": f"No resort with id '{resort_id}'"},
        )

    snotel_id: str | None = resort.get("nearest_snotel_id")
    if not snotel_id:
        raise HTTPException(
            status_code=422,
            detail={"error": "No SNOTEL station", "detail": f"Resort '{resort_id}' has no nearest_snotel_id"},
        )

    history = await fetch_snotel_history(snotel_id, days=days)
    return {
        "resort_id": resort_id,
        "resort_name": resort.get("name"),
        "snotel_id": snotel_id,
        "days": days,
        "history": history,
    }
