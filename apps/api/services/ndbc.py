"""
NDBC Data Fetcher
Pulls real-time buoy data from NOAA's National Data Buoy Center.

Data formats:
  - stdmet (.txt)    : standard meteorological observations (hourly)
  - data_spec (.data_spec): full spectral wave energy density
  - swdir (.swdir)   : spectral wave direction (mean direction per band)
"""
from __future__ import annotations

import io
import logging
from typing import Any

import httpx
import numpy as np
import pandas as pd
import structlog
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = structlog.get_logger(__name__)

NDBC_BASE = "https://www.ndbc.noaa.gov/data/realtime2"

# Missing value sentinels used in NDBC files
NDBC_MISSING = {"MM", "999", "9999", "99.0", "999.0", "9999.0", "99.00", "9999.00"}

# Key buoy stations
# Verified active NDBC stations — 404s here mean the station ID is wrong or retired.
BUOYS_OF_INTEREST = [
    "46026",  # San Francisco
    "46012",  # Half Moon Bay  (Mavericks proxy)
    "46028",  # Point Conception (Steamer Lane / Monterey proxy; 46042 is retired)
    "46053",  # East Santa Barbara (Rincon proxy)
    "46047",  # Tanner Banks (SoCal offshore)
    "46258",  # Harvest (Blacks Beach proxy)
    "51001",  # Hawaii NW (Pipeline proxy)
    "41009",  # Canaveral 20NM ENE (Sebastian Inlet proxy; 41047 does not exist)
    "41025",  # Diamond Shoals (Cape Hatteras)
    "44025",  # New York Bight (Montauk proxy)
]


# ─── Retry decorator for network calls ────────────────────────────────────────

def _ndbc_retry(fn):  # type: ignore[no-untyped-def]
    return retry(
        retry=retry_if_exception_type((httpx.HTTPError, httpx.TimeoutException)),
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        reraise=True,
    )(fn)


# ─── Standard Met Data ────────────────────────────────────────────────────────

@_ndbc_retry
async def fetch_buoy_stdmet(station_id: str) -> pd.DataFrame:
    """
    Fetch the standard meteorological data file for a buoy.
    Returns a DataFrame with columns matching NDBC stdmet format.
    Missing values are NaN. Timestamps are UTC.
    """
    url = f"{NDBC_BASE}/{station_id}.txt"
    log = logger.bind(station_id=station_id, url=url)

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url)
        resp.raise_for_status()

    log.debug("Fetched stdmet", bytes=len(resp.content))
    return parse_stdmet(resp.text, station_id=station_id)


def parse_stdmet(raw_text: str, station_id: str = "") -> pd.DataFrame:
    """
    Parse NDBC stdmet fixed-width whitespace format.

    Header row 1: column names
    Header row 2: units (skipped)
    Data rows: hourly observations, newest last
    """
    lines = raw_text.splitlines()
    if len(lines) < 3:
        raise ValueError(f"NDBC stdmet response too short: {len(lines)} lines")

    # Strip leading '#' from header lines
    header_line = lines[0].lstrip("#").strip()
    columns = header_line.split()

    # Build data text (skip first 2 header rows)
    data_text = "\n".join(lines[2:])

    df = pd.read_csv(
        io.StringIO(data_text),
        sep=r"\s+",
        names=columns,
        na_values=list(NDBC_MISSING),
        dtype=str,  # read as str first to preserve sentinel detection
    )

    # Convert to numerics where possible
    time_cols = {"YY", "MM", "DD", "hh", "mm", "#YY", "YYYY"}
    for col in df.columns:
        if col not in time_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    # Build datetime index
    df = _build_datetime_index(df)

    # Standardize column names to lowercase
    df.columns = [c.lower() for c in df.columns]

    # Add station_id
    df["station_id"] = station_id

    logger.debug("Parsed stdmet", station_id=station_id, rows=len(df), columns=list(df.columns))
    return df


def _build_datetime_index(df: pd.DataFrame) -> pd.DataFrame:
    """Convert NDBC year/month/day/hour/minute columns to a DatetimeIndex."""
    # Handle both old (#YY → 2-digit year) and new (YYYY) formats
    if "YYYY" in df.columns:
        year_col = "YYYY"
    elif "#YY" in df.columns:
        year_col = "#YY"
        df["YYYY"] = df["#YY"].apply(lambda y: 2000 + int(y) if int(y) < 50 else 1900 + int(y))
        year_col = "YYYY"
    else:
        # Fallback: look for a column that looks like a 4-digit year
        year_col = df.columns[0]

    try:
        df["observed_at"] = pd.to_datetime(
            {
                "year": df[year_col].astype(int),
                "month": df["MM"].astype(int),
                "day": df["DD"].astype(int),
                "hour": df["hh"].astype(int),
                "minute": df.get("mm", pd.Series([0] * len(df))).fillna(0).astype(int),
            },
            utc=True,
        )
    except Exception as exc:
        raise ValueError(f"Failed to build datetime index: {exc}") from exc

    # Drop the raw time columns to keep things clean
    drop_cols = [c for c in ["#YY", "YYYY", "MM", "DD", "hh", "mm"] if c in df.columns]
    df = df.drop(columns=drop_cols)
    return df


# ─── Spectral Data ────────────────────────────────────────────────────────────

@_ndbc_retry
async def fetch_buoy_spectral(station_id: str) -> dict[str, Any]:
    """
    Fetch spectral wave energy density and mean direction data.

    Returns:
        {
          "frequencies": [0.033, 0.038, ...],   # Hz
          "timestamps": [...],                   # list of ISO strings
          "energy": [[e1, e2, ...], ...],        # m²/Hz per timestamp
          "direction": [[d1, d2, ...], ...],     # degrees per timestamp (optional)
        }
    """
    log = logger.bind(station_id=station_id)
    results: dict[str, Any] = {}

    async with httpx.AsyncClient(timeout=30) as client:
        # Energy density (.data_spec)
        spec_url = f"{NDBC_BASE}/{station_id}.data_spec"
        try:
            spec_resp = await client.get(spec_url)
            spec_resp.raise_for_status()
            results = parse_spec_file(spec_resp.text)
            log.debug("Fetched spectral energy", frequencies=len(results.get("frequencies", [])))
        except httpx.HTTPStatusError as exc:
            log.warning("Spectral energy file unavailable", status=exc.response.status_code)
            return {}

        # Mean direction (.swdir) — optional, not all buoys have it
        swdir_url = f"{NDBC_BASE}/{station_id}.swdir"
        try:
            swdir_resp = await client.get(swdir_url)
            swdir_resp.raise_for_status()
            dir_data = parse_swdir_file(swdir_resp.text)
            results["direction"] = dir_data.get("direction", [])
        except httpx.HTTPStatusError:
            log.debug("swdir file unavailable, skipping direction data")

    return results


def parse_spec_file(raw_text: str) -> dict[str, Any]:
    """
    Parse NDBC .data_spec spectral wave energy density file.

    Actual NDBC format (each data line):
      YYYY MM DD hh mm sep_freq  energy1 (freq1) energy2 (freq2) ...

    Frequencies are in parentheses interleaved with energy values on each data line.
    Energy values are in m²/Hz. Missing = 999.0.
    """
    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return {}

    timestamps: list[str] = []
    energy_rows: list[list[float | None]] = []
    frequencies: list[float] = []

    # Parse data lines (skip header lines starting with #)
    for line in lines:
        if line.startswith("#"):
            continue
        line = line.strip()
        if not line:
            continue

        # Extract all tokens (keep track of parenthesized values = frequencies)
        # Format: YYYY MM DD hh mm sep_freq e1 (f1) e2 (f2) ...
        raw_parts = line.split()
        if len(raw_parts) < 6:
            continue

        # Parse timestamp
        try:
            ts = pd.Timestamp(
                year=int(raw_parts[0]), month=int(raw_parts[1]), day=int(raw_parts[2]),
                hour=int(raw_parts[3]), minute=int(raw_parts[4]), tz="UTC"
            )
        except (ValueError, IndexError):
            continue

        # Parse interleaved energy (freq) pairs starting at index 6
        # Reassemble the tail as a string so we can find parenthesized values
        tail = " ".join(raw_parts[6:])
        import re
        # Pattern: energy (frequency) pairs
        pairs = re.findall(r'([\d.]+)\s*\(([\d.]+)\)', tail)
        if not pairs:
            continue

        row_freqs: list[float] = []
        row_energy: list[float | None] = []
        for e_str, f_str in pairs:
            try:
                freq = round(float(f_str), 4)
                energy = float(e_str)
                row_freqs.append(freq)
                row_energy.append(None if energy >= 999.0 else energy)
            except ValueError:
                row_freqs.append(0.0)
                row_energy.append(None)

        if not row_freqs:
            continue

        # First data row sets the canonical frequency list
        if not frequencies:
            frequencies = row_freqs

        timestamps.append(ts.isoformat())
        energy_rows.append(row_energy)

    if not frequencies:
        logger.warning("Could not parse spectral frequencies from data_spec file")
        return {}

    return {
        "frequencies": frequencies,
        "timestamps": timestamps,
        "energy": energy_rows,
    }


def parse_swdir_file(raw_text: str) -> dict[str, Any]:
    """
    Parse NDBC .swdir mean wave direction file.
    Same interleaved format as .data_spec: direction (freq) direction (freq) ...
    Values are degrees (0-360). Missing = 999.0.
    """
    import re
    lines = [ln for ln in raw_text.splitlines() if ln.strip()]
    if len(lines) < 2:
        return {}

    direction_rows: list[list[float | None]] = []

    for line in lines:
        if line.startswith("#"):
            continue
        raw_parts = line.split()
        if len(raw_parts) < 6:
            continue

        tail = " ".join(raw_parts[6:])
        pairs = re.findall(r'([\d.]+)\s*\(([\d.]+)\)', tail)
        if not pairs:
            continue

        dir_vals: list[float | None] = []
        for d_str, _ in pairs:
            try:
                val = float(d_str)
                dir_vals.append(None if val >= 999.0 else val)
            except ValueError:
                dir_vals.append(None)

        direction_rows.append(dir_vals)

    return {"direction": direction_rows}


def _is_frequency(tok: str) -> bool:
    try:
        val = float(tok)
        return 0.01 < val < 1.0
    except ValueError:
        return False


# ─── Convenience: latest observation as dict ───────────────────────────────────

def latest_observation(df: pd.DataFrame) -> dict[str, Any] | None:
    """Return the most recent row of a stdmet DataFrame as a dict."""
    if df.empty:
        return None
    row = df.sort_values("observed_at").iloc[-1]
    return row.where(row.notna(), other=None).to_dict()


def spectral_to_energy_dict(
    spectral: dict[str, Any],
    timestamp_idx: int = -1,
) -> dict[str, float]:
    """
    Convert raw spectral data to a {frequency_str: energy} dict for storage.
    Uses the most recent timestamp by default.
    """
    if not spectral or "frequencies" not in spectral:
        return {}
    freqs = spectral["frequencies"]
    energy_rows = spectral.get("energy", [])
    if not energy_rows:
        return {}
    row = energy_rows[timestamp_idx]
    return {
        f"{freq:.4f}": val
        for freq, val in zip(freqs, row)
        if val is not None
    }
