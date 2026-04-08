"""
Supabase async client wrapper.

Uses the supabase-py client in a thread executor for async compatibility.
All operations return typed Pydantic models.
"""
from __future__ import annotations

import json
from typing import Any
from uuid import UUID

import pandas as pd
import structlog
from supabase import Client, create_client

from config import settings
from models.schemas import BuoyObservation, Spot

logger = structlog.get_logger(__name__)

# Module-level client (initialized lazily)
_client: Client | None = None


_PLACEHOLDER_VALUES = {"your-service-role-key-here", "", "your-anon-key-here"}

def is_supabase_configured() -> bool:
    return (
        bool(settings.supabase_url)
        and bool(settings.supabase_service_role_key)
        and settings.supabase_service_role_key not in _PLACEHOLDER_VALUES
    )

def get_client() -> Client:
    global _client
    if _client is None:
        if not is_supabase_configured():
            raise RuntimeError(
                "Supabase not configured — using file fallback. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env."
            )
        _client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    return _client


# ─── Spots ────────────────────────────────────────────────────────────────────

async def get_spots() -> list[Spot]:
    """Return all surf spots from the database."""
    try:
        client = get_client()
        result = client.table("spots").select("*").execute()
        spots = []
        for row in result.data:
            spot = _row_to_spot(row)
            if spot:
                spots.append(spot)
        logger.debug("Fetched spots", count=len(spots))
        return spots
    except Exception as exc:
        logger.error("Failed to fetch spots", error=str(exc))
        return _load_spots_from_file()


async def get_spot_by_slug(slug: str) -> Spot | None:
    """Return a single spot by slug."""
    try:
        client = get_client()
        result = client.table("spots").select("*").eq("slug", slug).single().execute()
        if result.data:
            return _row_to_spot(result.data)
    except Exception as exc:
        logger.error("Failed to fetch spot", slug=slug, error=str(exc))
        # Fall back to file
        all_spots = _load_spots_from_file()
        return next((s for s in all_spots if s.slug == slug), None)
    return None


async def get_spot_by_id(spot_id: str) -> Spot | None:
    """Return a single spot by UUID."""
    try:
        client = get_client()
        result = client.table("spots").select("*").eq("id", spot_id).single().execute()
        if result.data:
            return _row_to_spot(result.data)
    except Exception as exc:
        logger.error("Failed to fetch spot by id", spot_id=spot_id, error=str(exc))
    return None


def _parse_location(location: object) -> tuple[float | None, float | None]:
    """Parse a PostGIS location value into (lat, lng).

    Supabase returns geography columns as Extended WKB (EWKB) hex strings,
    GeoJSON dicts, or WKT strings depending on the client version.
    """
    if isinstance(location, dict):
        # GeoJSON: {"type": "Point", "coordinates": [lng, lat]}
        coords = location.get("coordinates", [None, None])
        return coords[1], coords[0]

    if isinstance(location, str):
        loc = location.strip()
        if loc.upper().startswith("POINT"):
            # WKT: "POINT(-122.5 37.5)"
            inner = loc.upper().replace("POINT(", "").replace("SRID=4326;", "").replace(")", "").strip()
            parts = inner.split()
            if len(parts) == 2:
                return float(parts[1]), float(parts[0])
        else:
            # Extended WKB hex (EWKB) — format used by PostGIS via supabase-py
            # Structure: 1B byte-order | 4B geom-type (may have 0x20000000 SRID flag) |
            #            [4B SRID if flag set] | 8B X (lng, LE double) | 8B Y (lat, LE double)
            try:
                import binascii, struct
                data = binascii.unhexlify(loc)
                geom_type = struct.unpack_from("<I", data, 1)[0]
                has_srid = bool(geom_type & 0x20000000)
                offset = 5 + (4 if has_srid else 0)
                lng = struct.unpack_from("<d", data, offset)[0]
                lat = struct.unpack_from("<d", data, offset + 8)[0]
                return lat, lng
            except Exception:
                pass

    return None, None


def _row_to_spot(row: dict[str, Any]) -> Spot | None:
    """Convert a Supabase row to a Spot model, extracting lat/lng from PostGIS."""
    try:
        # PostGIS GEOGRAPHY returns as GeoJSON, WKT, or EWKB hex depending on client
        location = row.get("location")
        lat, lng = _parse_location(location)

        return Spot(
            id=row.get("id"),
            name=row["name"],
            slug=row["slug"],
            lat=lat or 0.0,
            lng=lng or 0.0,
            region=row["region"],
            country=row.get("country", "US"),
            break_type=row.get("break_type", "beach"),
            optimal_swell_direction=row.get("optimal_swell_direction"),
            optimal_swell_direction_range=row.get("optimal_swell_direction_range", 45.0),
            optimal_wind_direction=row.get("optimal_wind_direction"),
            optimal_period_min=row.get("optimal_period_min", 10.0),
            optimal_period_max=row.get("optimal_period_max", 20.0),
            optimal_size_min=row.get("optimal_size_min", 1.5),
            optimal_size_max=row.get("optimal_size_max", 3.0),
            nearest_buoy_id=row.get("nearest_buoy_id"),
            secondary_buoy_id=row.get("secondary_buoy_id"),
            swan_enabled=row.get("swan_enabled", False),
            timezone=row.get("timezone", "America/Los_Angeles"),
            description=row.get("description"),
            skill_minimum=row.get("skill_minimum"),
        )
    except Exception as exc:
        logger.warning("Failed to parse spot row", error=str(exc), row=row)
        return None


def _load_spots_from_file() -> list[Spot]:
    """Fallback: load spots from data/spots.json when DB is unavailable."""
    import os
    spots_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data", "spots.json")
    # Try relative to /app/data (Docker) or ../../data (local dev)
    candidates = [
        spots_path,
        "/app/data/spots.json",
        "data/spots.json",
    ]
    for path in candidates:
        try:
            with open(path) as f:
                raw = json.load(f)
            spots = []
            for item in raw:
                spots.append(Spot(
                    name=item["name"],
                    slug=item["slug"],
                    lat=item["lat"],
                    lng=item["lng"],
                    region=item["region"],
                    country=item.get("country", "US"),
                    break_type=item["break_type"],
                    optimal_swell_direction=item.get("optimal_swell_direction"),
                    optimal_swell_direction_range=item.get("optimal_swell_direction_range", 45),
                    optimal_wind_direction=item.get("optimal_wind_direction"),
                    optimal_period_min=item.get("optimal_period_min", 10),
                    optimal_period_max=item.get("optimal_period_max", 20),
                    optimal_size_min=item.get("optimal_size_min", 1.5),
                    optimal_size_max=item.get("optimal_size_max", 3.0),
                    nearest_buoy_id=item.get("nearest_buoy_id"),
                    secondary_buoy_id=item.get("secondary_buoy_id"),
                    swan_enabled=item.get("swan_enabled", False),
                    timezone=item.get("timezone", "America/Los_Angeles"),
                    description=item.get("description"),
                    skill_minimum=item.get("skill_minimum"),
                ))
            logger.info("Loaded spots from file", path=path, count=len(spots))
            return spots
        except FileNotFoundError:
            continue
        except Exception as exc:
            logger.error("Failed to load spots.json", path=path, error=str(exc))
    return []


# ─── Buoy Observations ────────────────────────────────────────────────────────

async def upsert_buoy_observations(
    station_id: str,
    df: pd.DataFrame,
    spectral: dict[str, Any] | None = None,
) -> int:
    """
    Upsert buoy observations from a stdmet DataFrame.
    Returns count of rows upserted.
    """
    if df.empty:
        return 0

    client = get_client()
    records = []

    # Build spectral lookup by timestamp if provided
    spec_by_ts: dict[str, dict[str, float]] = {}
    if spectral and spectral.get("frequencies") and spectral.get("energy"):
        for i, ts in enumerate(spectral.get("timestamps", [])):
            if i < len(spectral["energy"]):
                energy_row = spectral["energy"][i]
                spec_by_ts[ts[:16]] = {  # truncate to minute
                    f"{freq:.4f}": val
                    for freq, val in zip(spectral["frequencies"], energy_row)
                    if val is not None
                }

    for _, row in df.iterrows():
        observed_at = row.get("observed_at")
        if pd.isna(observed_at):
            continue

        ts_str = pd.Timestamp(observed_at).isoformat()
        ts_key = ts_str[:16]

        record: dict[str, Any] = {
            "station_id": station_id,
            "observed_at": ts_str,
        }

        # Map stdmet columns to DB columns
        field_map = {
            "wvht": "wvht", "dpd": "dpd", "apd": "apd", "mwd": "mwd",
            "wspd": "wspd", "wdir": "wdir", "gst": "gst",
            "pres": "pres", "atmp": "atmp", "wtmp": "wtmp",
            "dewp": "dewp", "vis": "vis", "ptdy": "ptdy", "tide": "tide",
            # Swell component aliases
            "shgt": "swh", "swell": "swh", "swp": "swp", "swd": "swd",
            "wwh": "wwh", "wwp": "wwp", "wwd": "wwd",
        }
        for src, dst in field_map.items():
            val = row.get(src)
            if val is not None and not (isinstance(val, float) and pd.isna(val)):
                record[dst] = float(val)

        # Add spectral energy if available
        spec_energy = spec_by_ts.get(ts_key)
        if spec_energy:
            record["spectral_energy"] = json.dumps(spec_energy)

        records.append(record)

    if not records:
        return 0

    try:
        result = client.table("buoy_observations").upsert(
            records,
            on_conflict="station_id,observed_at",
        ).execute()
        count = len(result.data) if result.data else len(records)
        logger.info("Upserted buoy observations", station_id=station_id, count=count)
        return count
    except Exception as exc:
        logger.error("Failed to upsert buoy observations", station_id=station_id, error=str(exc))
        return 0


# ─── Spot Forecasts ───────────────────────────────────────────────────────────

async def upsert_spot_forecasts(
    spot_id: str,
    forecasts: list[dict[str, Any]],
) -> int:
    """
    Upsert forecast records for a spot.
    Returns count of rows upserted.
    """
    if not forecasts:
        return 0

    client = get_client()
    records = []
    for f in forecasts:
        record = {"spot_id": spot_id, **f}
        # Serialize JSONB fields
        if "wave_spectrum" in record and isinstance(record["wave_spectrum"], dict):
            record["wave_spectrum"] = json.dumps(record["wave_spectrum"])
        records.append(record)

    try:
        result = client.table("spot_forecasts").upsert(
            records,
            on_conflict="spot_id,forecast_time,model_source",
        ).execute()
        count = len(result.data) if result.data else len(records)
        logger.info("Upserted spot forecasts", spot_id=spot_id, count=count)
        return count
    except Exception as exc:
        logger.error("Failed to upsert spot forecasts", spot_id=spot_id, error=str(exc))
        return 0


async def get_spot_forecasts(
    spot_id: str,
    days: int = 7,
    model_source: str | None = None,
) -> list[dict[str, Any]]:
    """Fetch forecast rows for a spot, ordered by forecast_time."""
    from datetime import datetime, timezone, timedelta
    now = datetime.now(timezone.utc).isoformat()
    end = (datetime.now(timezone.utc) + timedelta(days=days)).isoformat()

    try:
        client = get_client()
        query = (
            client.table("spot_forecasts")
            .select("*")
            .eq("spot_id", spot_id)
            .gte("forecast_time", now)
            .lte("forecast_time", end)
            .order("forecast_time")
        )
        if model_source:
            query = query.eq("model_source", model_source)
        result = query.execute()
        return result.data or []
    except Exception as exc:
        logger.error("Failed to fetch spot forecasts", spot_id=spot_id, error=str(exc))
        return []
