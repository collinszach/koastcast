"""
Open-Meteo Marine + Wind Forecast Client

Self-hosted in Docker on the NUC (port 8080).
Falls back to open-meteo.com for local dev when self-hosted is unavailable.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx
import structlog

from config import settings

logger = structlog.get_logger(__name__)

# Marine API variables we want
MARINE_HOURLY_VARS = [
    "wave_height",
    "wave_direction",
    "wave_period",
    "swell_wave_height",
    "swell_wave_direction",
    "swell_wave_period",
    "wind_wave_height",
    "wind_wave_direction",
    "wind_wave_period",
    "ocean_current_velocity",
    "ocean_current_direction",
    # swell_wave_height_2/direction_2/period_2 are not supported by Open-Meteo public API
    # The parser defaults these to [None] when absent
]

# Atmospheric variables (from the regular forecast API endpoint)
WIND_HOURLY_VARS = [
    "wind_speed_10m",
    "wind_direction_10m",
    "wind_gusts_10m",
    "temperature_2m",
    "precipitation",
]


async def fetch_marine_forecast(
    lat: float,
    lon: float,
    days: int = 7,
) -> dict[str, Any]:
    """
    Fetch marine wave forecast from Open-Meteo.

    Returns structured dict:
    {
      "timestamps": ["2024-01-01T00:00", ...],
      "wave_height": [...],        # m
      "wave_direction": [...],     # degrees
      "wave_period": [...],        # s
      "swell_wave_height": [...],
      "swell_wave_direction": [...],
      "swell_wave_period": [...],
      "wind_wave_height": [...],
      "wind_wave_direction": [...],
      "wind_wave_period": [...],
    }
    """
    base_url = _get_marine_base_url()
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(MARINE_HOURLY_VARS),
        "forecast_days": days,
        "timezone": "UTC",
    }

    log = logger.bind(lat=lat, lon=lon, days=days, base_url=base_url)

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{base_url}/v1/marine", params=params)
            resp.raise_for_status()
        data = resp.json()
        parsed = _parse_marine_response(data)
        # Self-hosted container returns HTTP 200 but with all-null wave data when
        # marine model data hasn't been downloaded. Detect and fall back.
        wave_vals = parsed.get("wave_height", [])
        has_real_data = any(v is not None for v in wave_vals)
        if not has_real_data and ("open-meteo-api" in base_url or "localhost" in base_url):
            log.warning("Self-hosted Open-Meteo returned null marine data, falling back to marine-api.open-meteo.com")
            return await _fetch_marine_fallback(lat, lon, days)
        log.debug("Marine forecast fetched", hours=len(data.get("hourly", {}).get("time", [])))
        return parsed
    except httpx.HTTPError as exc:
        # If self-hosted is down, try open-meteo.com directly
        if "localhost" in base_url or "open-meteo-api" in base_url:
            log.warning("Self-hosted Open-Meteo unavailable, falling back to open-meteo.com", error=str(exc))
            return await _fetch_marine_fallback(lat, lon, days)
        raise


async def fetch_wind_forecast(
    lat: float,
    lon: float,
    days: int = 7,
) -> dict[str, Any]:
    """
    Fetch wind + atmosphere forecast aligned to marine forecast hours.

    Returns:
    {
      "timestamps": [...],
      "wind_speed_ms": [...],      # m/s (converted from km/h)
      "wind_direction": [...],     # degrees
      "wind_gust_ms": [...],       # m/s
    }
    """
    base_url = _get_forecast_base_url()
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(WIND_HOURLY_VARS),
        "forecast_days": days,
        "timezone": "UTC",
        "wind_speed_unit": "ms",  # request m/s directly
    }

    log = logger.bind(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{base_url}/v1/forecast", params=params)
            resp.raise_for_status()
        data = resp.json()
        log.debug("Wind forecast fetched")
        return _parse_wind_response(data)
    except httpx.HTTPError as exc:
        log.error("Wind forecast fetch failed", error=str(exc))
        return {}


async def _fetch_marine_fallback(lat: float, lon: float, days: int) -> dict[str, Any]:
    """Fallback to open-meteo.com marine API."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join(MARINE_HOURLY_VARS),
        "forecast_days": days,
        "timezone": "UTC",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://marine-api.open-meteo.com/v1/marine", params=params)
        resp.raise_for_status()
    return _parse_marine_response(resp.json())


def _parse_marine_response(data: dict[str, Any]) -> dict[str, Any]:
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    result: dict[str, Any] = {"timestamps": times}
    field_map = {
        "wave_height": "wave_height",
        "wave_direction": "wave_direction",
        "wave_period": "wave_period",
        "swell_wave_height": "swell_wave_height",
        "swell_wave_direction": "swell_wave_direction",
        "swell_wave_period": "swell_wave_period",
        "wind_wave_height": "wind_wave_height",
        "wind_wave_direction": "wind_wave_direction",
        "wind_wave_period": "wind_wave_period",
        # Second swell train (not all models provide this)
        "swell_wave_height_2": "swell_wave_height_2",
        "swell_wave_direction_2": "swell_wave_direction_2",
        "swell_wave_period_2": "swell_wave_period_2",
        # Ocean current (was fetched but not parsed before)
        "ocean_current_velocity": "ocean_current_velocity",
        "ocean_current_direction": "ocean_current_direction",
    }
    for src, dst in field_map.items():
        result[dst] = hourly.get(src, [None] * len(times))

    return result


def _parse_wind_response(data: dict[str, Any]) -> dict[str, Any]:
    hourly = data.get("hourly", {})
    times = hourly.get("time", [])

    speeds = hourly.get("wind_speed_10m", [None] * len(times))
    gusts = hourly.get("wind_gusts_10m", [None] * len(times))

    return {
        "timestamps": times,
        "wind_speed_ms": speeds,
        "wind_direction": hourly.get("wind_direction_10m", [None] * len(times)),
        "wind_gust_ms": gusts,
    }


def _get_marine_base_url() -> str:
    base = settings.open_meteo_base_url.rstrip("/")
    # Self-hosted open-meteo serves both marine and forecast on same port
    return base


def _get_forecast_base_url() -> str:
    base = settings.open_meteo_forecast_base_url.rstrip("/")
    return base


def align_wind_to_marine(
    marine: dict[str, Any],
    wind: dict[str, Any],
) -> dict[str, Any]:
    """
    Merge wind data into marine forecast, aligning on timestamps.
    Marine timestamps are authoritative; wind data is interpolated to match.
    """
    if not marine.get("timestamps") or not wind.get("timestamps"):
        return marine

    marine_times = set(marine["timestamps"])
    wind_by_time: dict[str, dict[str, Any]] = {}
    for i, ts in enumerate(wind["timestamps"]):
        wind_by_time[ts] = {
            "wind_speed_ms": _safe_idx(wind.get("wind_speed_ms", []), i),
            "wind_direction": _safe_idx(wind.get("wind_direction", []), i),
            "wind_gust_ms": _safe_idx(wind.get("wind_gust_ms", []), i),
        }

    aligned_speed: list[float | None] = []
    aligned_dir: list[float | None] = []
    aligned_gust: list[float | None] = []

    for ts in marine["timestamps"]:
        w = wind_by_time.get(ts, {})
        aligned_speed.append(w.get("wind_speed_ms"))
        aligned_dir.append(w.get("wind_direction"))
        aligned_gust.append(w.get("wind_gust_ms"))

    marine["wind_speed_ms"] = aligned_speed
    marine["wind_direction"] = aligned_dir
    marine["wind_gust_ms"] = aligned_gust
    return marine


def _safe_idx(lst: list[Any], i: int) -> Any:
    try:
        return lst[i]
    except IndexError:
        return None
