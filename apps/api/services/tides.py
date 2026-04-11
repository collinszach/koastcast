"""
NOAA CO-OPS Tides & Currents API Client

Fetches tidal predictions. Tides are deterministic, so we cache aggressively (24h TTL).
API docs: https://api.tidesandcurrents.noaa.gov/api/prod/
"""
from __future__ import annotations

import time
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

COOPS_BASE = "https://api.tidesandcurrents.noaa.gov/api/prod/datagetter"

# In-memory cache: {cache_key: (expires_unix, data)}
_cache: dict[str, tuple[float, list[dict[str, Any]]]] = {}
CACHE_TTL_SECONDS = 86400  # 24 hours


async def fetch_tide_predictions(
    station_id: str,
    days: int = 7,
    reference_date: datetime | None = None,
) -> list[dict[str, Any]]:
    """
    Fetch hourly tide predictions from NOAA CO-OPS.

    Returns list of dicts:
    [
      {"time": "2024-01-01T00:00:00Z", "height_m": 1.23, "type": "H"|"L"|None},
      ...
    ]
    Tide heights are in meters (converted from feet).
    """
    if reference_date is None:
        reference_date = datetime.now(timezone.utc)

    begin_dt = reference_date.replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = begin_dt + timedelta(days=days)

    cache_key = f"{station_id}_{begin_dt.date()}_{days}"
    cached = _cache.get(cache_key)
    if cached and cached[0] > time.time():
        logger.debug("Tide cache hit", station_id=station_id)
        return cached[1]

    log = logger.bind(station_id=station_id, days=days)

    # Fetch hourly predictions
    try:
        hourly = await _fetch_coops(
            station_id=station_id,
            product="predictions",
            begin_date=begin_dt.strftime("%Y%m%d"),
            end_date=end_dt.strftime("%Y%m%d"),
            interval="h",
            datum="MLLW",
            units="metric",
            time_zone="gmt",
        )
        log.debug("Fetched hourly tides", count=len(hourly))
    except Exception as exc:
        log.error("Failed to fetch tides", error=str(exc))
        return []

    # Fetch high/low predictions for overlay
    hilo: list[dict[str, Any]] = []
    try:
        hilo = await _fetch_coops(
            station_id=station_id,
            product="predictions",
            begin_date=begin_dt.strftime("%Y%m%d"),
            end_date=end_dt.strftime("%Y%m%d"),
            interval="hilo",
            datum="MLLW",
            units="metric",
            time_zone="gmt",
        )
    except Exception:
        pass  # High/low is optional overlay

    # Merge high/low markers into hourly data
    hilo_by_time: dict[str, str] = {}
    for entry in hilo:
        hilo_by_time[entry.get("t", "")] = entry.get("type", "")

    result: list[dict[str, Any]] = []
    for entry in hourly:
        ts_str = entry.get("t", "")
        height_str = entry.get("v", "")
        try:
            # Parse time, convert to ISO 8601 UTC
            ts = datetime.strptime(ts_str, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
            height_m = float(height_str)
        except (ValueError, TypeError):
            continue

        result.append({
            "time": ts.isoformat(),
            "height_m": round(height_m, 3),
            "type": hilo_by_time.get(ts_str),  # "H", "L", or None
        })

    # Cache result
    _cache[cache_key] = (time.time() + CACHE_TTL_SECONDS, result)
    return result


async def _fetch_coops(
    station_id: str,
    product: str,
    begin_date: str,
    end_date: str,
    interval: str,
    datum: str,
    units: str,
    time_zone: str,
) -> list[dict[str, Any]]:
    params: dict[str, str] = {
        "station": station_id,
        "product": product,
        "begin_date": begin_date,
        "end_date": end_date,
        "datum": datum,
        "units": units,
        "time_zone": time_zone,
        "format": "json",
        "application": "peakcast",
    }
    if interval:
        params["interval"] = interval
    # NOAA CO-OPS public API requires no token for forecast/prediction data.

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(COOPS_BASE, params=params)
        resp.raise_for_status()

    data = resp.json()
    if "error" in data:
        raise ValueError(f"NOAA CO-OPS error: {data['error'].get('message', 'unknown')}")

    return data.get("predictions", [])


def get_tide_state(
    height_m: float,
    prev_height_m: float | None,
    next_height_m: float | None,
) -> str:
    """Determine tide state: rising, falling, high, or low."""
    if prev_height_m is None or next_height_m is None:
        return "unknown"

    rising = next_height_m > height_m
    is_extreme = abs(next_height_m - height_m) < 0.05 and abs(prev_height_m - height_m) < 0.05

    if is_extreme:
        return "high" if height_m > (prev_height_m + next_height_m) / 2 else "low"
    return "rising" if rising else "falling"


def build_tide_lookup(predictions: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Build a fast O(1) lookup dict from tide predictions keyed by hour string."""
    lookup: dict[str, dict[str, Any]] = {}
    for i, pred in enumerate(predictions):
        ts = pred.get("time", "")
        # Truncate to hour for easy lookup
        hour_key = ts[:13]  # "2024-01-01T00"
        prev_h = predictions[i - 1]["height_m"] if i > 0 else None
        next_h = predictions[i + 1]["height_m"] if i < len(predictions) - 1 else None
        lookup[hour_key] = {
            **pred,
            "tide_state": get_tide_state(pred["height_m"], prev_h, next_h),
        }
    return lookup
