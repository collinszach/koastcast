"""
SWAN Nearshore Wave Model Runner

Wraps the SWAN (Simulating WAves Nearshore) spectral wave model.
SWAN must be installed on the NUC: `apt install swan` or built from source.
Delft University of Technology — open source, free for commercial use.

Workflow (runs every 6h via scheduler):
  1. Read boundary conditions from latest Open-Meteo ensemble forecast
  2. Write SWAN .swn input deck for the spot
  3. Execute SWAN subprocess
  4. Parse output SPEC files → structured spectral data
  5. Store results as spot_forecasts with model_source='swan'
"""
from __future__ import annotations

import asyncio
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import structlog

logger = structlog.get_logger(__name__)

SWAN_BIN = Path("/usr/bin/swanrun")           # path after `apt install swan`
SWAN_CONFIGS_DIR = Path("/app/data/swan_configs")
BATHY_DIR = Path("/app/data/bathymetry")
OUTPUT_DIR = Path("/tmp/swan_output")


# ─── Input deck builder ───────────────────────────────────────────────────────

def build_swan_input(
    spot_slug: str,
    lat: float,
    lon: float,
    boundary_hs: list[float],
    boundary_tp: list[float],
    boundary_dir: list[float],
    timestamps: list[datetime],
    bathymetry_file: str | None = None,
) -> str:
    """
    Generate a SWAN input deck (.swn file) for a single spot run.
    Uses a simplified rectangular grid centred on the spot.
    """
    bathy_path = BATHY_DIR / (bathymetry_file or f"{spot_slug}.bot")

    # Grid: 10km × 10km at 100m resolution
    dx = 0.001   # ~100m in degrees
    nx, ny = 100, 100
    xpc = lon - (nx * dx / 2)
    ypc = lat - (ny * dx / 2)

    # SWAN time format: YYYYMMDD.HHMMSS
    def swan_time(dt: datetime) -> str:
        return dt.strftime("%Y%m%d.%H%M%S")

    start_t = swan_time(timestamps[0]) if timestamps else "20240101.000000"
    end_t = swan_time(timestamps[-1]) if timestamps else "20240101.060000"

    lines = [
        f"PROJ '{spot_slug}' 'nswell'",
        f"SET NAUTICAL",
        "",
        f"CGRID REGULAR {xpc:.6f} {ypc:.6f} 0. {nx*dx:.4f} {ny*dx:.4f} {nx} {ny} CIRCLE 36 0.03 0.5 24",
        "",
        f"INPGRID BOTTOM REGULAR {xpc:.6f} {ypc:.6f} 0. {nx} {ny} {dx:.5f} {dx:.5f}",
        f"READINP BOTTOM 1. '{bathy_path}' 3 0 FREE",
        "",
        f"BOUND SHAPESPEC JONSWAP PEAK DSPR DEGREES",
        f"BOUNDSPEC SIDE W CCW CONSTANT PAR "
        f"{np.mean(boundary_hs):.2f} {np.mean(boundary_tp):.1f} {np.mean(boundary_dir):.1f} 30",
        "",
        f"GEN3 WESTIN",
        f"FRIC JON 0.067",
        f"TRIAD",
        f"BREAKING",
        "",
        f"COMPUTE NONSTAT {start_t} 30 MIN {end_t}",
        "",
        # Output: wave parameters at the spot centre
        f"SPEC '{spot_slug}_output.spc' SPEC2D ABS",
        f"POIN '{spot_slug}_output.tab' {lon:.5f} {lat:.5f}",
        f"TABLE '{spot_slug}_output.tab' HEAD '{spot_slug}_output.tab' TIME Hsig TpSm MnDir DSPR",
        "",
        f"STOP",
    ]
    return "\n".join(lines)


# ─── Output parser ────────────────────────────────────────────────────────────

def parse_swan_table(table_path: Path) -> list[dict[str, Any]]:
    """
    Parse SWAN TABLE output file → list of dicts with time + wave parameters.
    Format: header line, then whitespace-separated rows.
    """
    results = []
    if not table_path.exists():
        logger.warning("SWAN table output not found", path=str(table_path))
        return results

    with open(table_path) as f:
        lines = f.readlines()

    # Find header
    header_idx = next((i for i, l in enumerate(lines) if "Hsig" in l), None)
    if header_idx is None:
        return results

    headers = lines[header_idx].split()
    for line in lines[header_idx + 1:]:
        parts = line.strip().split()
        if len(parts) < len(headers):
            continue
        row: dict[str, Any] = {}
        for h, v in zip(headers, parts):
            try:
                row[h] = float(v) if v not in ("****", "nan") else None
            except ValueError:
                row[h] = None
        results.append(row)

    return results


def parse_swan_spectrum(spec_path: Path) -> dict[str, list[float]] | None:
    """
    Parse SWAN 2D spectral output (.spc file).
    Returns dict mapping frequency_hz → list of directional energy values.
    """
    if not spec_path.exists():
        return None
    # Minimal implementation — full spectral parsing is complex
    # Returns None if not parseable; caller falls back to table output
    try:
        with open(spec_path) as f:
            content = f.read()
        if "SWAN" not in content:
            return None
        # Parse spectral energies — simplified: return total energy per freq band
        return {}   # TODO: full 2D spectral parse
    except Exception:
        return None


# ─── Main runner ─────────────────────────────────────────────────────────────

async def run_swan(spot, forecast_hours: list[dict]) -> list[dict]:
    """
    Run SWAN for a single spot and return forecast records.

    Args:
        spot: Spot object with lat, lng, slug, bathymetry_file, etc.
        forecast_hours: List of forecast dicts (from Open-Meteo ensemble)

    Returns:
        List of forecast record dicts ready to upsert as model_source='swan'
    """
    log = logger.bind(spot=spot.slug)

    if not SWAN_BIN.exists():
        log.warning("SWAN binary not found — skipping", path=str(SWAN_BIN))
        return []

    if not forecast_hours:
        log.warning("No boundary conditions — skipping SWAN run")
        return []

    # Extract boundary conditions
    timestamps = []
    boundary_hs, boundary_tp, boundary_dir = [], [], []
    for h in forecast_hours[:25]:  # 24h run
        try:
            ts = datetime.fromisoformat(h["forecast_time"].replace("Z", "+00:00"))
            timestamps.append(ts)
            boundary_hs.append(float(h.get("wave_height_m") or 1.0))
            boundary_tp.append(float(h.get("wave_period_s") or 10.0))
            boundary_dir.append(float(h.get("wave_direction") or 270.0))
        except (KeyError, ValueError, TypeError):
            continue

    if not timestamps:
        log.warning("Could not parse boundary conditions")
        return []

    # Write input deck
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="swan_") as tmpdir:
        tmppath = Path(tmpdir)
        swn_path = tmppath / f"{spot.slug}.swn"

        input_deck = build_swan_input(
            spot_slug=spot.slug,
            lat=spot.lat,
            lon=spot.lng,
            boundary_hs=boundary_hs,
            boundary_tp=boundary_tp,
            boundary_dir=boundary_dir,
            timestamps=timestamps,
            bathymetry_file=spot.bathymetry_file,
        )
        swn_path.write_text(input_deck)

        log.info("Running SWAN", input=str(swn_path), n_boundary_hours=len(timestamps))

        try:
            proc = await asyncio.create_subprocess_exec(
                str(SWAN_BIN), spot.slug,
                cwd=tmpdir,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=600)

            if proc.returncode != 0:
                log.error(
                    "SWAN failed",
                    returncode=proc.returncode,
                    stderr=stderr.decode()[:500],
                )
                return []

            log.info("SWAN completed", returncode=proc.returncode)

        except asyncio.TimeoutError:
            log.error("SWAN timed out after 600s")
            return []
        except Exception as exc:
            log.error("SWAN subprocess error", error=str(exc))
            return []

        # Parse output
        table_path = tmppath / f"{spot.slug}_output.tab"
        table_data = parse_swan_table(table_path)

    if not table_data:
        log.warning("SWAN produced no output")
        return []

    # Convert table rows → forecast records
    records = []
    for row, ts in zip(table_data, timestamps):
        records.append({
            "forecast_time": ts.isoformat(),
            "model_source": "swan",
            "wave_height_m": row.get("Hsig"),
            "wave_height_face_m": row.get("Hsig"),  # SWAN outputs at break point
            "wave_period_s": row.get("TpSm"),
            "wave_direction": row.get("MnDir"),
            "confidence": 0.85,  # SWAN physics model — higher confidence than statistical
        })

    log.info("SWAN output parsed", records=len(records))
    return records


def is_swan_available() -> bool:
    """Check if SWAN is installed and runnable."""
    return SWAN_BIN.exists() and subprocess.run(
        [str(SWAN_BIN), "--version"],
        capture_output=True,
        timeout=5,
    ).returncode == 0
