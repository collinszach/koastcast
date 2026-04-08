"""
NDBC Parser Tests

Tests run against:
1. Local fixture files (fast, deterministic)
2. Optionally: live NDBC data (run with --live flag)
"""
from __future__ import annotations

import math
from pathlib import Path

import pandas as pd
import pytest

from services.ndbc import (
    latest_observation,
    parse_spec_file,
    parse_stdmet,
    parse_swdir_file,
    spectral_to_energy_dict,
)

FIXTURES_DIR = Path(__file__).parent / "fixtures"


# ─── Stdmet parsing ───────────────────────────────────────────────────────────

class TestParseStdmet:
    def test_parses_fixture_file(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        assert not df.empty
        assert "observed_at" in df.columns
        assert "wvht" in df.columns
        assert "dpd" in df.columns
        assert "wspd" in df.columns

    def test_datetime_is_utc(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        assert df["observed_at"].dtype == "datetime64[ns, UTC]" or hasattr(df["observed_at"].iloc[0], "tzinfo")

    def test_missing_values_are_nan(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        # VIS and PTDY are MM in fixture → should be NaN
        vis_col = df.get("vis")
        if vis_col is not None:
            assert vis_col.isna().all() or vis_col.dropna().empty

    def test_wave_height_values_plausible(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        wvht = df["wvht"].dropna()
        assert len(wvht) > 0
        assert (wvht > 0).all()
        assert (wvht < 30).all()  # no plausible wave is 30m

    def test_station_id_populated(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        assert (df["station_id"] == "46026").all()

    def test_short_input_raises(self):
        with pytest.raises(ValueError, match="too short"):
            parse_stdmet("line1\nline2", station_id="test")

    def test_column_names_lowercase(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        assert all(c == c.lower() for c in df.columns)

    def test_rows_ordered_by_time(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        times = pd.to_datetime(df["observed_at"])
        assert times.is_monotonic_increasing or times.is_monotonic_decreasing


# ─── Spectral parsing ─────────────────────────────────────────────────────────

class TestParseSpecFile:
    def test_parses_fixture(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        result = parse_spec_file(raw)
        assert "frequencies" in result
        assert "energy" in result
        assert "timestamps" in result

    def test_frequencies_in_valid_range(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        result = parse_spec_file(raw)
        freqs = result["frequencies"]
        assert len(freqs) > 0
        assert all(0.01 < f < 1.0 for f in freqs)

    def test_energy_values_non_negative(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        result = parse_spec_file(raw)
        for row in result["energy"]:
            for val in row:
                if val is not None:
                    assert val >= 0.0, f"Negative energy: {val}"

    def test_energy_row_length_matches_frequencies(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        result = parse_spec_file(raw)
        n_freqs = len(result["frequencies"])
        for row in result["energy"]:
            assert len(row) == n_freqs

    def test_timestamps_are_iso_strings(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        result = parse_spec_file(raw)
        for ts in result["timestamps"]:
            # Should parse as ISO 8601
            pd.Timestamp(ts)

    def test_empty_input_returns_empty(self):
        result = parse_spec_file("")
        assert result == {}


# ─── spectral_to_energy_dict ──────────────────────────────────────────────────

class TestSpectralToEnergyDict:
    def test_returns_dict(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        spectral = parse_spec_file(raw)
        result = spectral_to_energy_dict(spectral, timestamp_idx=-1)
        assert isinstance(result, dict)
        assert len(result) > 0

    def test_keys_are_frequency_strings(self):
        raw = (FIXTURES_DIR / "46026.data_spec").read_text()
        spectral = parse_spec_file(raw)
        result = spectral_to_energy_dict(spectral)
        for key in result:
            freq = float(key)
            assert 0.01 < freq < 1.0

    def test_empty_spectral_returns_empty(self):
        result = spectral_to_energy_dict({})
        assert result == {}


# ─── latest_observation ───────────────────────────────────────────────────────

class TestLatestObservation:
    def test_returns_dict(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        obs = latest_observation(df)
        assert isinstance(obs, dict)

    def test_none_on_empty_dataframe(self):
        import pandas as pd
        obs = latest_observation(pd.DataFrame())
        assert obs is None

    def test_wvht_is_float_or_none(self):
        raw = (FIXTURES_DIR / "46026.txt").read_text()
        df = parse_stdmet(raw, station_id="46026")
        obs = latest_observation(df)
        wvht = obs.get("wvht")
        assert wvht is None or isinstance(wvht, float)


# ─── Live integration tests (optional) ────────────────────────────────────────

@pytest.mark.asyncio
@pytest.mark.live  # skip unless --live flag passed
async def test_live_buoy_fetch():
    """
    Fetch real data from NDBC buoy 46026 (San Francisco).
    Run with: pytest tests/test_ndbc.py -m live
    """
    from services.ndbc import fetch_buoy_stdmet
    df = await fetch_buoy_stdmet("46026")
    assert not df.empty
    assert "wvht" in df.columns
    assert len(df) > 10  # expect multiple hours of data


@pytest.mark.asyncio
@pytest.mark.live
async def test_live_spectral_fetch():
    """Fetch real spectral data from NDBC."""
    from services.ndbc import fetch_buoy_spectral
    result = await fetch_buoy_spectral("46026")
    # Some buoys have spectral data, 46026 may or may not — just check structure
    if result:
        assert "frequencies" in result
        assert len(result["frequencies"]) > 10


def pytest_configure(config):
    config.addinivalue_line("markers", "live: mark test as requiring live network access to NDBC")
