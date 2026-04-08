"""
Insights router
GET /api/v1/insights → personalized pattern analysis from session history
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from typing import Annotated

import structlog

from db.supabase_client import get_client as get_supabase
from services.surf_insights import generate_insights

logger = structlog.get_logger(__name__)
router = APIRouter()


@router.get("/insights")
async def get_surf_insights(
    authorization: Annotated[str | None, Header()] = None,
) -> dict:
    """
    Generate personalized surf insights from the authenticated user's session history.

    Analyzes:
    - Condition patterns in top-rated sessions
    - Best spots by average rating
    - Timing patterns (best day of week)
    - Crowd impact on session quality
    - Wave height/period sweet spots
    """
    # Extract user JWT from Authorization header
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]

    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")

    try:
        supabase = get_supabase()

        # Get user from token
        user_resp = supabase.auth.get_user(token)
        if not user_resp or not user_resp.user:
            raise HTTPException(status_code=401, detail="Invalid token")

        user_id = str(user_resp.user.id)

        # Fetch sessions with spot names (join)
        result = (
            supabase.table("user_sessions")
            .select(
                "id, session_date, spot_id, wave_height_face_m, wave_period_s, "
                "wave_direction, wind_speed_ms, wind_direction, tide_height_m, "
                "quality_rating, crowd_rating, notes, "
                "spots(name)"
            )
            .eq("user_id", user_id)
            .order("session_date", desc=True)
            .limit(200)
            .execute()
        )

        sessions = []
        for row in (result.data or []):
            spot_data = row.get("spots") or {}
            spot_name = spot_data.get("name") if isinstance(spot_data, dict) else None
            sessions.append({
                **row,
                "spot_name": spot_name,
            })

        insights = generate_insights(sessions)

        return {
            "session_count": len(sessions),
            "insights": [card.to_dict() for card in insights],
        }

    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Insights generation failed", error=str(exc))
        raise HTTPException(status_code=500, detail="Failed to generate insights") from exc
