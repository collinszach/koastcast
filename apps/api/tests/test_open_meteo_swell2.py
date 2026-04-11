"""Tests for second swell train and ocean current parsing in Open-Meteo response."""
from __future__ import annotations

import pytest
from services.open_meteo import _parse_marine_response


class TestSwell2Parsing:
    def _base_hourly(self, times: list[str]) -> dict:
        n = len(times)
        return {
            "time": times,
            "wave_height": [1.5] * n,
            "wave_direction": [285.0] * n,
            "wave_period": [12.0] * n,
            "swell_wave_height": [1.2] * n,
            "swell_wave_direction": [280.0] * n,
            "swell_wave_period": [14.0] * n,
            "wind_wave_height": [0.3] * n,
            "wind_wave_direction": [270.0] * n,
            "wind_wave_period": [5.0] * n,
        }

    def test_swell2_parsed_when_present(self):
        hourly = self._base_hourly(["2024-01-01T00:00", "2024-01-01T01:00"])
        hourly["swell_wave_height_2"] = [0.5, 0.6]
        hourly["swell_wave_direction_2"] = [200.0, 202.0]
        hourly["swell_wave_period_2"] = [8.0, 8.5]
        result = _parse_marine_response({"hourly": hourly})
        assert "swell_wave_height_2" in result
        assert result["swell_wave_height_2"] == [0.5, 0.6]
        assert result["swell_wave_direction_2"] == [200.0, 202.0]
        assert result["swell_wave_period_2"] == [8.0, 8.5]

    def test_swell2_absent_returns_none_list(self):
        hourly = self._base_hourly(["2024-01-01T00:00"])
        result = _parse_marine_response({"hourly": hourly})
        assert "swell_wave_height_2" in result
        assert result["swell_wave_height_2"] == [None]
        assert result["swell_wave_direction_2"] == [None]
        assert result["swell_wave_period_2"] == [None]

    def test_ocean_current_parsed_when_present(self):
        hourly = self._base_hourly(["2024-01-01T00:00"])
        hourly["ocean_current_velocity"] = [0.3]
        hourly["ocean_current_direction"] = [45.0]
        result = _parse_marine_response({"hourly": hourly})
        assert "ocean_current_velocity" in result
        assert result["ocean_current_velocity"] == [0.3]
        assert result["ocean_current_direction"] == [45.0]

    def test_ocean_current_absent_returns_none_list(self):
        hourly = self._base_hourly(["2024-01-01T00:00"])
        result = _parse_marine_response({"hourly": hourly})
        assert "ocean_current_velocity" in result
        assert result["ocean_current_velocity"] == [None]
        assert result["ocean_current_direction"] == [None]
