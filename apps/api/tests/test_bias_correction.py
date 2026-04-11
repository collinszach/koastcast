"""
Unit tests for SpotBiasCorrector.

Uses a nonexistent spot ID so the physics fallback is always used.
No ML model file needed — fully offline and deterministic.
"""
from __future__ import annotations

import pytest
from services.bias_correction import SpotBiasCorrector, compute_angle_diff


NONEXISTENT_SPOT = "test-spot-no-model-xxxxxxxx"


class TestPhysicsFallback:
    def setup_method(self):
        self.corrector = SpotBiasCorrector(NONEXISTENT_SPOT)
        assert self.corrector.model is None, "Expected physics fallback — no model file should exist"

    def test_returns_tuple_of_two_floats(self):
        face_h, confidence = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        assert isinstance(face_h, float)
        assert isinstance(confidence, float)

    def test_face_height_positive_for_real_swell(self):
        face_h, _ = self.corrector.predict(
            buoy_hs=2.0, buoy_tp=15.0, buoy_dir=285.0, swell_angle_diff=10.0
        )
        assert face_h > 0.0

    def test_zero_hs_returns_zero_face(self):
        face_h, _ = self.corrector.predict(
            buoy_hs=0.0, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        assert face_h == 0.0

    def test_confidence_max_045_for_physics(self):
        _, confidence = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        assert confidence <= 0.45

    def test_oblique_angle_reduces_confidence(self):
        _, conf_direct = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        _, conf_oblique = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=75.0
        )
        assert conf_direct > conf_oblique

    def test_spectral_bands_accepted_without_crash(self):
        face_h, _ = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0,
            spectral_bands=[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.5, 0.4, 0.3, 0.2, 0.1, 0.05],
        )
        assert face_h >= 0.0

    def test_tide_height_accepted_without_crash(self):
        face_h, _ = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0,
            tide_height=0.8,
        )
        assert face_h >= 0.0

    def test_larger_hs_gives_larger_face_height(self):
        face_small, _ = self.corrector.predict(
            buoy_hs=0.5, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        face_large, _ = self.corrector.predict(
            buoy_hs=3.0, buoy_tp=12.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        assert face_large > face_small

    def test_longer_period_increases_face_height(self):
        face_short, _ = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=8.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        face_long, _ = self.corrector.predict(
            buoy_hs=1.5, buoy_tp=16.0, buoy_dir=285.0, swell_angle_diff=0.0
        )
        assert face_long > face_short


class TestComputeAngleDiff:
    def test_same_direction_is_zero(self):
        assert compute_angle_diff(270.0, 270.0) == 0.0

    def test_opposite_directions_is_180(self):
        diff = compute_angle_diff(90.0, 270.0)
        assert abs(diff - 180.0) < 0.001

    def test_wraps_correctly_near_zero(self):
        diff = compute_angle_diff(350.0, 10.0)
        assert abs(diff - 20.0) < 0.001

    def test_wraps_correctly_near_360(self):
        diff = compute_angle_diff(10.0, 350.0)
        assert abs(diff - 20.0) < 0.001

    def test_result_always_0_to_180(self):
        for a in range(0, 360, 30):
            for b in range(0, 360, 30):
                diff = compute_angle_diff(float(a), float(b))
                assert 0.0 <= diff <= 180.0, f"angle_diff({a},{b}) = {diff}"
