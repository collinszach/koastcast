"""
NDBC Historical Data Downloader

Downloads 10 years of stdmet + spectral data for key buoy stations.
Saves as compressed Parquet files for fast ML training.

Usage:
    uv run python ml/download_ndbc_history.py
    uv run python ml/download_ndbc_history.py --stations 46026 46012 --years 5
    uv run python ml/download_ndbc_history.py --skip-existing
"""
from __future__ import annotations

import argparse
import asyncio
import io
import sys
from pathlib import Path

import httpx
import pandas as pd
from tqdm import tqdm

# Add parent to path so we can import from apps/api
sys.path.insert(0, str(Path(__file__).parent.parent / "apps" / "api"))

from services.ndbc import NDBC_MISSING, _build_datetime_index, parse_spec_file

DATA_DIR = Path(__file__).parent.parent / "data" / "ndbc_historical"
NDBC_HIST_BASE = "https://www.ndbc.noaa.gov/data/historical"

STATIONS = [
    "46026",  # San Francisco
    "46012",  # Half Moon Bay (Mavericks)
    "46042",  # Monterey (Steamer Lane)
    "46053",  # East Santa Barbara (Rincon)
    "46047",  # Tanner Banks (SoCal offshore)
    "41047",  # East Coast offshore (Sebastian)
    "41025",  # Diamond Shoals (Cape Hatteras)
    "44025",  # New York Bight (Montauk)
    "51001",  # Hawaii NW (Pipeline)
]

CURRENT_YEAR = 2026


async def download_stdmet_year(
    client: httpx.AsyncClient,
    station_id: str,
    year: int,
) -> pd.DataFrame | None:
    """Download annual stdmet data for a buoy station."""
    # NDBC historical stdmet format: {station_id}h{year}.txt.gz
    url = f"{NDBC_HIST_BASE}/stdmet/{station_id}h{year}.txt.gz"
    try:
        resp = await client.get(url, timeout=60, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return None  # Station didn't exist that year
        raise

    # Decompress
    import gzip
    try:
        content = gzip.decompress(resp.content).decode("latin-1")
    except Exception:
        content = resp.text

    # Parse using our stdmet parser
    try:
        return _parse_historical_stdmet(content, station_id=station_id)
    except Exception as exc:
        tqdm.write(f"  Parse error {station_id}/{year}: {exc}")
        return None


def _parse_historical_stdmet(raw_text: str, station_id: str = "") -> pd.DataFrame:
    """Parse NDBC historical stdmet (same format as realtime but possibly 2-digit year)."""
    lines = raw_text.splitlines()
    if len(lines) < 3:
        return pd.DataFrame()

    # Strip leading '#' from header line
    header_line = lines[0].lstrip("#").strip()
    columns = header_line.split()

    data_text = "\n".join(lines[2:])  # Skip units row
    df = pd.read_csv(
        io.StringIO(data_text),
        sep=r"\s+",
        names=columns,
        na_values=list(NDBC_MISSING),
        dtype=str,
    )

    time_cols = {"YY", "MM", "DD", "hh", "mm", "#YY", "YYYY"}
    for col in df.columns:
        if col not in time_cols:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = _build_datetime_index(df)
    df.columns = [c.lower() for c in df.columns]
    df["station_id"] = station_id
    return df


async def download_spectral_year(
    client: httpx.AsyncClient,
    station_id: str,
    year: int,
) -> pd.DataFrame | None:
    """Download annual spectral data for a buoy station."""
    url = f"{NDBC_HIST_BASE}/swden/{station_id}w{year}.txt.gz"
    try:
        resp = await client.get(url, timeout=60, follow_redirects=True)
        resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            return None
        raise

    import gzip
    try:
        content = gzip.decompress(resp.content).decode("latin-1")
    except Exception:
        content = resp.text

    try:
        spectral = parse_spec_file(content)
        if not spectral or not spectral.get("frequencies"):
            return None
        # Convert to DataFrame: one row per timestamp, columns = frequency strings
        freqs = spectral["frequencies"]
        rows = []
        for ts, energy_row in zip(spectral["timestamps"], spectral["energy"]):
            row: dict = {"observed_at": pd.Timestamp(ts)}
            for freq, val in zip(freqs, energy_row):
                row[f"spec_{freq:.4f}"] = val
            rows.append(row)
        if not rows:
            return None
        df = pd.DataFrame(rows)
        df["station_id"] = station_id
        return df
    except Exception as exc:
        tqdm.write(f"  Spectral parse error {station_id}/{year}: {exc}")
        return None


async def process_station_year(
    client: httpx.AsyncClient,
    station_id: str,
    year: int,
    skip_existing: bool,
) -> bool:
    """Download and save one station-year of data."""
    stdmet_path = DATA_DIR / f"{station_id}_{year}_stdmet.parquet"
    spec_path = DATA_DIR / f"{station_id}_{year}_spectral.parquet"

    stdmet_needed = not stdmet_path.exists() or not skip_existing
    spec_needed = not spec_path.exists() or not skip_existing

    if not stdmet_needed and not spec_needed:
        return True  # Already have it

    # Modern way to do nothing asynchronously
    async def do_nothing():
        return None

    tasks = []
    if stdmet_needed:
        tasks.append(download_stdmet_year(client, station_id, year))
    else:
        tasks.append(do_nothing())

    if spec_needed:
        tasks.append(download_spectral_year(client, station_id, year))
    else:
        tasks.append(do_nothing())

    stdmet_df, spec_df = await asyncio.gather(*tasks, return_exceptions=True)

    if isinstance(stdmet_df, Exception):
        tqdm.write(f"  stdmet error {station_id}/{year}: {stdmet_df}")
        stdmet_df = None
    if isinstance(spec_df, Exception):
        tqdm.write(f"  spectral error {station_id}/{year}: {spec_df}")
        spec_df = None

    if stdmet_df is not None and not stdmet_df.empty:
        stdmet_df.to_parquet(stdmet_path, compression="snappy", index=False)
        tqdm.write(f"  Saved stdmet {station_id}/{year}: {len(stdmet_df)} rows")

    if spec_df is not None and not spec_df.empty:
        spec_df.to_parquet(spec_path, compression="snappy", index=False)
        tqdm.write(f"  Saved spectral {station_id}/{year}: {len(spec_df)} rows")

    return True


async def main(
    stations: list[str],
    years_back: int,
    skip_existing: bool,
) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    year_range = list(range(CURRENT_YEAR - years_back, CURRENT_YEAR))
    total = len(stations) * len(year_range)

    print(f"Downloading {years_back} years of NDBC data")
    print(f"Stations: {stations}")
    print(f"Years: {year_range[0]}–{year_range[-1]}")
    print(f"Output: {DATA_DIR}")
    print()

    # Semaphore to limit concurrent connections (NDBC is rate-sensitive)
    sem = asyncio.Semaphore(4)

    async with httpx.AsyncClient(
        headers={"User-Agent": "SwellStack/1.0 surf-forecasting-research"},
        timeout=90,
    ) as client:
        with tqdm(total=total, unit="station-year") as pbar:
            for station_id in stations:
                pbar.set_description(f"Station {station_id}")
                for year in year_range:
                    async with sem:
                        try:
                            await process_station_year(client, station_id, year, skip_existing)
                        except Exception as exc:
                            tqdm.write(f"  FAILED {station_id}/{year}: {exc}")
                        pbar.update(1)

    # Print summary
    parquet_files = list(DATA_DIR.glob("*.parquet"))
    total_size_mb = sum(f.stat().st_size for f in parquet_files) / 1e6
    print(f"\nDone! {len(parquet_files)} files, {total_size_mb:.1f} MB total")
    print(f"Saved to: {DATA_DIR}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Download NDBC historical buoy data")
    parser.add_argument("--stations", nargs="+", default=STATIONS)
    parser.add_argument("--years", type=int, default=10, dest="years_back")
    parser.add_argument("--skip-existing", action="store_true", default=True)
    parser.add_argument("--no-skip-existing", dest="skip_existing", action="store_false")
    args = parser.parse_args()

    asyncio.run(main(
        stations=args.stations,
        years_back=args.years_back,
        skip_existing=args.skip_existing,
    ))
