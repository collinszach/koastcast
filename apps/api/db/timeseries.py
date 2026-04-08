"""
TimescaleDB helper utilities.

Provides time-bucketed queries for aggregating wave/buoy time series data.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import structlog

from db.supabase_client import get_client

logger = structlog.get_logger(__name__)


async def get_buoy_history(
    station_id: str,
    hours: int = 48,
) -> list[dict[str, Any]]:
    """
    Fetch recent buoy observations ordered by time.
    """
    from datetime import timezone, timedelta
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()

    try:
        client = get_client()
        result = (
            client.table("buoy_observations")
            .select("*")
            .eq("station_id", station_id)
            .gte("observed_at", cutoff)
            .order("observed_at", desc=True)
            .limit(hours * 2)  # allow for sub-hourly data
            .execute()
        )
        return result.data or []
    except Exception as exc:
        logger.error("Failed to fetch buoy history", station_id=station_id, error=str(exc))
        return []


async def get_hourly_buoy_summary(
    station_id: str,
    bucket_hours: int = 1,
    limit: int = 168,
) -> list[dict[str, Any]]:
    """
    Aggregate buoy data into time buckets (requires TimescaleDB time_bucket).
    Falls back to plain hourly data if TimescaleDB is unavailable.
    """
    try:
        client = get_client()
        # Use Supabase RPC to run a raw TimescaleDB query
        result = client.rpc(
            "get_buoy_hourly_summary",
            {
                "p_station_id": station_id,
                "p_bucket_hours": bucket_hours,
                "p_limit": limit,
            },
        ).execute()
        return result.data or []
    except Exception:
        # Fallback to simple fetch
        return await get_buoy_history(station_id, hours=limit * bucket_hours)
