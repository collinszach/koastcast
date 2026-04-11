"""Tests for nowcast blending and spectral extraction utilities."""
from __future__ import annotations

import pytest
from datetime import datetime, timezone
from services.nowcast import nowcast_blend, extract_spectral_bands
from models.schemas import BuoyObservation


class TestNowcastBlend:
    def test_t0_is_pure_buoy(self):
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=1.5, lead_hours=0.0)
        assert val == pytest.approx(1.5, abs=0.001)
        assert is_nowcast is True

    def test_t6_is_pure_model(self):
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=1.5, lead_hours=6.0)
        assert val == pytest.approx(2.0, abs=0.001)
        assert is_nowcast is False

    def test_t3_is_midpoint(self):
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=1.0, lead_hours=3.0)
        assert val == pytest.approx(1.5, abs=0.01)
        assert is_nowcast is True

    def test_t1_weights_buoy_heavily(self):
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=1.0, lead_hours=1.0)
        expected = (5 / 6) * 1.0 + (1 / 6) * 2.0
        assert val == pytest.approx(expected, abs=0.01)
        assert is_nowcast is True

    def test_none_buoy_returns_model_unchanged(self):
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=None, lead_hours=0.0)
        assert val == pytest.approx(2.0)
        assert is_nowcast is False

    def test_none_model_returns_none(self):
        val, is_nowcast = nowcast_blend(model_val=None, buoy_val=1.5, lead_hours=1.0)
        assert val is None
        assert is_nowcast is False

    def test_lead_beyond_6_returns_model_unchanged(self):
        val, is_nowcast = nowcast_blend(model_val=2.5, buoy_val=0.5, lead_hours=8.0)
        assert val == pytest.approx(2.5)
        assert is_nowcast is False

    def test_negative_lead_treated_as_zero(self):
        # negative lead hours (clock skew) → treat as t=0 → pure buoy
        val, is_nowcast = nowcast_blend(model_val=2.0, buoy_val=1.0, lead_hours=-1.0)
        assert val == pytest.approx(1.0, abs=0.001)
        assert is_nowcast is True


class TestExtractSpectralBands:
    def _obs(self, spectral: dict | None) -> BuoyObservation:
        return BuoyObservation(
            station_id="46026",
            observed_at=datetime.now(timezone.utc),
            spectral_energy=spectral,
        )

    def test_returns_empty_list_for_none_obs(self):
        assert extract_spectral_bands(None) == []

    def test_returns_empty_list_when_no_spectral(self):
        assert extract_spectral_bands(self._obs(None)) == []

    def test_returns_empty_list_for_empty_dict(self):
        assert extract_spectral_bands(self._obs({})) == []

    def test_extracts_12_bands_in_freq_order(self):
        spectral = {
            "0.0330": 0.5, "0.0380": 0.8, "0.0430": 1.2, "0.0480": 0.9,
            "0.0530": 0.7, "0.0580": 0.5, "0.0630": 0.3, "0.0680": 0.2,
            "0.0730": 0.1, "0.0780": 0.08, "0.0830": 0.05, "0.0880": 0.03,
        }
        result = extract_spectral_bands(self._obs(spectral))
        assert len(result) == 12
        assert result[0] == pytest.approx(0.5)
        assert result[1] == pytest.approx(0.8)
        assert result[-1] == pytest.approx(0.03)

    def test_missing_bands_default_to_zero(self):
        spectral = {"0.0330": 1.0, "0.0880": 0.5}
        result = extract_spectral_bands(self._obs(spectral))
        assert len(result) == 12
        assert result[0] == pytest.approx(1.0)
        assert result[1] == pytest.approx(0.0)
        assert result[-1] == pytest.approx(0.5)
