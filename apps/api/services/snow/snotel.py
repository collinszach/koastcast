"""
SNOTEL (Snow Telemetry) Data Service
NRCS AWDB REST API — free, no auth required.
API reference: https://wcc.sc.egov.usda.gov/awdbRestApi/swagger-ui/index.html

Element codes used:
  SNWD  — snow depth (inches, daily observed)
  WTEQ  — snow water equivalent (inches)
  TOBS  — observed air temperature (°F)
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any

import httpx
import structlog

logger = structlog.get_logger(__name__)

AWDB_BASE = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1"
_TIMEOUT = 10.0  # seconds


def _safe_float(value: Any) -> float | None:
    """Convert a value to float, returning None on failure or sentinel values."""
    if value is None:
        return None
    try:
        f = float(value)
        # NRCS uses -99.9 and similar as missing-data sentinels
        if f <= -99.0:
            return None
        return f
    except (TypeError, ValueError):
        return None


async def _fetch_station_meta(station_id: str) -> dict:
    """Fetch station name and elevation from the AWDB stations endpoint."""
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(
                f"{AWDB_BASE}/stations",
                params={"stationTriplets": station_id},
            )
            resp.raise_for_status()
            data = resp.json()
        if data:
            station = data[0] if isinstance(data, list) else data
            return {
                "station_name": station.get("name", station_id),
                "elevation_ft": station.get("elevation"),
            }
    except Exception as exc:
        logger.warning("SNOTEL station metadata fetch failed", station_id=station_id, error=str(exc))
    return {"station_name": station_id, "elevation_ft": None}


async def fetch_snotel_current(station_id: str) -> dict:
    """
    Fetch current SNOTEL station data.

    station_id format: "838:CO:SNTL" (stationTriplet)

    Returns:
    {
        "new_snow_24h_in": float | None,
        "new_snow_48h_in": float | None,
        "new_snow_72h_in": float | None,
        "base_depth_in": float | None,    # SNWD element
        "swe_in": float | None,           # WTEQ element
        "temperature_f": float | None,    # TOBS element
        "station_name": str,
        "elevation_ft": int | float | None,
        "updated_at": str  # ISO timestamp
    }
    """
    result: dict[str, Any] = {
        "new_snow_24h_in": None,
        "new_snow_48h_in": None,
        "new_snow_72h_in": None,
        "base_depth_in": None,
        "swe_in": None,
        "temperature_f": None,
        "station_name": station_id,
        "elevation_ft": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Fetch metadata and data in parallel
    today = datetime.now(timezone.utc).date()
    begin_date = (today - timedelta(days=4)).strftime("%Y-%m-%d")
    end_date = today.strftime("%Y-%m-%d")

    params = {
        "stationTriplets": station_id,
        "duration": "DAILY",
        "beginDate": begin_date,
        "endDate": end_date,
        "elements": "SNWD,WTEQ,TOBS",
        "returnFlags": "false",
        "returnOriginalValues": "false",
        "returnSuspectData": "false",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{AWDB_BASE}/data", params=params)
            resp.raise_for_status()
            data = resp.json()

        if not data:
            logger.warning("SNOTEL returned empty response", station_id=station_id)
            return result

        # Response is a list with one entry per stationTriplet
        station_data = data[0] if isinstance(data, list) else data

        # Build element lookup: {"SNWD": [{"date": ..., "value": ...}, ...], ...}
        elements: dict[str, list[dict]] = {}
        for elem in station_data.get("data", []):
            code = elem.get("stationElement", {}).get("elementCode", "")
            elements[code] = elem.get("values", [])

        def _extract_values(code: str) -> list[float | None]:
            """Return ordered list of daily values (oldest → newest)."""
            return [_safe_float(v.get("value")) for v in elements.get(code, [])]

        depth_vals = _extract_values("SNWD")
        swe_vals = _extract_values("WTEQ")
        temp_vals = _extract_values("TOBS")

        def _latest(vals: list[float | None]) -> float | None:
            for v in reversed(vals):
                if v is not None:
                    return v
            return None

        result["base_depth_in"] = _latest(depth_vals)
        result["swe_in"] = _latest(swe_vals)
        result["temperature_f"] = _latest(temp_vals)

        # New snow = positive depth delta over N days (settled/melted snow → 0, not negative)
        def _snow_delta(vals: list[float | None], back_days: int) -> float | None:
            if len(vals) < back_days + 1:
                return None
            recent = vals[-1]
            prior = vals[-(back_days + 1)]
            if recent is None or prior is None:
                return None
            return max(0.0, round(recent - prior, 1))

        result["new_snow_24h_in"] = _snow_delta(depth_vals, 1)
        result["new_snow_48h_in"] = _snow_delta(depth_vals, 2)
        result["new_snow_72h_in"] = _snow_delta(depth_vals, 3)
        result["updated_at"] = datetime.now(timezone.utc).isoformat()

        logger.info(
            "SNOTEL data fetched",
            station_id=station_id,
            base_depth_in=result["base_depth_in"],
            new_snow_24h_in=result["new_snow_24h_in"],
            temperature_f=result["temperature_f"],
        )

    except httpx.TimeoutException:
        logger.error("SNOTEL fetch timed out", station_id=station_id)
        return result
    except httpx.HTTPStatusError as exc:
        logger.error(
            "SNOTEL HTTP error",
            station_id=station_id,
            status=exc.response.status_code,
            error=str(exc),
        )
        return result
    except Exception as exc:
        logger.error("SNOTEL fetch failed", station_id=station_id, error=str(exc))
        return result

    # Fetch station metadata (name, elevation) separately
    meta = await _fetch_station_meta(station_id)
    result["station_name"] = meta["station_name"]
    result["elevation_ft"] = meta["elevation_ft"]

    return result


async def fetch_snotel_history(station_id: str, days: int = 30) -> list[dict]:
    """
    Fetch daily snow depth + SWE history for sparkline charts.

    Returns list[dict] with keys: date, snow_depth_in, swe_in.
    Ordered oldest → newest. Empty list on failure.
    """
    today = datetime.now(timezone.utc).date()
    begin_date = (today - timedelta(days=days)).strftime("%Y-%m-%d")
    end_date = today.strftime("%Y-%m-%d")

    params = {
        "stationTriplets": station_id,
        "duration": "DAILY",
        "beginDate": begin_date,
        "endDate": end_date,
        "elements": "SNWD,WTEQ",
        "returnFlags": "false",
        "returnOriginalValues": "false",
        "returnSuspectData": "false",
    }

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.get(f"{AWDB_BASE}/data", params=params)
            resp.raise_for_status()
            data = resp.json()

        if not data:
            return []

        station_data = data[0] if isinstance(data, list) else data

        depth_values: list[dict] = []
        swe_values: list[dict] = []

        for elem in station_data.get("data", []):
            code = elem.get("stationElement", {}).get("elementCode", "")
            if code == "SNWD":
                depth_values = elem.get("values", [])
            elif code == "WTEQ":
                swe_values = elem.get("values", [])

        # Build SWE lookup by date
        swe_by_date: dict[str, float | None] = {
            v["date"]: _safe_float(v.get("value"))
            for v in swe_values
            if isinstance(v, dict) and "date" in v
        }

        history: list[dict] = []
        for v in depth_values:
            if not isinstance(v, dict):
                continue
            date_str = v.get("date", "")
            history.append({
                "date": date_str,
                "snow_depth_in": _safe_float(v.get("value")),
                "swe_in": swe_by_date.get(date_str),
            })

        logger.info("SNOTEL history fetched", station_id=station_id, records=len(history))
        return history

    except httpx.TimeoutException:
        logger.error("SNOTEL history fetch timed out", station_id=station_id)
        return []
    except Exception as exc:
        logger.error("SNOTEL history fetch failed", station_id=station_id, error=str(exc))
        return []
