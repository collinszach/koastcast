"""
Safety router
GET /api/v1/safety/{spot_id} → safety report for a surf spot
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

import structlog

from db.supabase_client import get_spot_by_slug, get_spots
from services.safety import get_safety_report

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/safety/{spot_id}")
async def get_spot_safety(spot_id: str) -> dict:
    """
    Return a safety report for a surf spot including:
    - Post-rain water quality warning
    - NWS rip current risk level
    - Active surf advisories / high surf warnings
    - Static hazard notes for the spot
    """
    # Resolve spot
    spot = await get_spot_by_slug(spot_id)
    if spot is None:
        all_spots = await get_spots()
        spot = next((s for s in all_spots if s.slug == spot_id), None)
    if spot is None:
        raise HTTPException(status_code=404, detail=f"Spot '{spot_id}' not found")

    report = await get_safety_report(spot)
    return report.to_dict()
