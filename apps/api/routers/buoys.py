"""
Buoys router
GET /api/v1/buoys/{station_id}/live     → current buoy reading
GET /api/v1/buoys/{station_id}/spectrum → full spectral data
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

import structlog

from db.timeseries import get_buoy_history
from models.schemas import BuoyLiveResponse, BuoyObservation
from services.ndbc import (
    BUOYS_OF_INTEREST,
    fetch_buoy_spectral,
    fetch_buoy_stdmet,
    latest_observation,
    spectral_to_energy_dict,
)

logger = structlog.get_logger(__name__)

router = APIRouter()


@router.get("/buoys/{station_id}/live", response_model=BuoyLiveResponse)
async def get_buoy_live(station_id: str) -> BuoyLiveResponse:
    """
    Return the latest buoy observation plus 24h history.
    Fetches live from NDBC if DB has no recent data.
    """
    # Try DB first
    history = await get_buoy_history(station_id, hours=24)

    if not history:
        # Fetch live from NDBC
        try:
            df = await fetch_buoy_stdmet(station_id)
            if df.empty:
                raise HTTPException(status_code=404, detail=f"No data for buoy {station_id}")
            latest = latest_observation(df)
        except Exception as exc:
            logger.error("Buoy fetch failed", station_id=station_id, error=str(exc))
            raise HTTPException(status_code=503, detail="Buoy data unavailable") from exc
        return BuoyLiveResponse(
            station_id=station_id,
            latest=BuoyObservation(station_id=station_id, **_to_obs_fields(latest)) if latest else None,
            history_24h=[],
        )

    latest_row = history[0]
    obs_list = [
        BuoyObservation(station_id=station_id, **_to_obs_fields(r))
        for r in history
    ]
    return BuoyLiveResponse(
        station_id=station_id,
        latest=obs_list[0] if obs_list else None,
        history_24h=obs_list,
    )


@router.get("/buoys/{station_id}/spectrum")
async def get_buoy_spectrum(station_id: str) -> dict:
    """
    Return full spectral energy density data for the latest observation.
    This is the high-value data Surfline doesn't show for free.
    """
    try:
        spectral = await fetch_buoy_spectral(station_id)
        if not spectral:
            raise HTTPException(status_code=404, detail=f"No spectral data for buoy {station_id}")
        return {
            "station_id": station_id,
            "frequencies": spectral.get("frequencies", []),
            "timestamps": spectral.get("timestamps", []),
            "energy": spectral.get("energy", []),
            "direction": spectral.get("direction", []),
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Spectral fetch failed", station_id=station_id, error=str(exc))
        raise HTTPException(status_code=503, detail="Spectral data unavailable") from exc


def _to_obs_fields(row: dict) -> dict:
    """Strip non-BuoyObservation fields from a DB row."""
    obs_fields = {
        "observed_at", "wvht", "dpd", "apd", "mwd", "wspd", "wdir", "gst",
        "pres", "atmp", "wtmp", "dewp", "vis", "ptdy", "tide",
        "swh", "swp", "swd", "wwh", "wwp", "wwd",
        "spectral_energy", "spectral_direction",
    }
    return {k: v for k, v in row.items() if k in obs_fields}
