"""
Peak Score unit tests.

Tests cover:
- All major condition scenarios (firing, flat, cross-wind, etc.)
- Edge cases (zero height, 0 period, edge directions)
- Personalization: different user preferences produce different scores
- Generic quality_score scaling (0-10)
"""
from __future__ import annotations

import pytest
from services.stoke_score import (
    StokeInput,
    UserPreferences,
    compute_quality_score,
    compute_stoke_score,
)

# ─── Fixtures ─────────────────────────────────────────────────────────────────

SPOT_OPTIMAL_DIR = 285.0  # Ocean Beach SF
SPOT_RANGE = 60.0
SPOT_OFFSHORE_WIND = 100.0  # Easterly offshore wind

def good_conditions() -> StokeInput:
    return StokeInput(
        wave_height_face_m=1.5,
        wave_period_s=14.0,
        wave_direction=285.0,       # dead on optimal
        wind_speed_ms=3.0,
        wind_direction=100.0,       # perfect offshore
        wind_offshore_direction=100.0,
        crowd_score=0.8,
    )

def average_prefs() -> UserPreferences:
    return UserPreferences(
        pref_min_height_m=0.6,
        pref_max_height_m=2.5,
        pref_min_period_s=8.0,
        pref_offshore_importance=0.7,
        pref_crowd_tolerance=0.5,
    )


# ─── Basic scoring ────────────────────────────────────────────────────────────

class TestComputeStokeScore:
    def test_perfect_conditions_score_high(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert result.stoke_score >= 70.0, f"Expected ≥70, got {result.stoke_score}"

    def test_score_is_0_to_100(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert 0.0 <= result.stoke_score <= 100.0

    def test_components_all_present(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert set(result.components.keys()) == {
            "height", "period", "direction", "wind", "steepness", "tide", "crowd"
        }

    def test_components_are_0_to_100(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        for k, v in result.components.items():
            assert 0 <= v <= 100, f"Component {k}={v} out of range"

    def test_firing_label_on_high_score(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        # Good conditions → should be at least PUMPING
        assert result.label in ("FIRING", "PUMPING", "FUN")

    def test_flat_conditions_score_low(self):
        flat = StokeInput(
            wave_height_face_m=0.2,
            wave_period_s=5.0,
            wave_direction=180.0,  # 105° off optimal
            wind_speed_ms=15.0,
            wind_direction=280.0,  # onshore
            wind_offshore_direction=100.0,
            crowd_score=0.5,
        )
        result = compute_stoke_score(flat, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert result.stoke_score < 30.0, f"Expected <30 for flat/onshore, got {result.stoke_score}"

    def test_onshore_wind_reduces_score(self):
        offshore = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=8.0, wind_direction=100.0,  # offshore
            wind_offshore_direction=100.0, crowd_score=0.7,
        )
        onshore = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=8.0, wind_direction=280.0,  # onshore
            wind_offshore_direction=100.0, crowd_score=0.7,
        )
        offshore_result = compute_stoke_score(offshore, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        onshore_result = compute_stoke_score(onshore, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert offshore_result.stoke_score > onshore_result.stoke_score

    def test_wrong_swell_direction_reduces_score(self):
        optimal = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0, crowd_score=0.7,
        )
        wrong_dir = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=180.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0, crowd_score=0.7,
        )
        optimal_result = compute_stoke_score(optimal, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        wrong_result = compute_stoke_score(wrong_dir, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert optimal_result.stoke_score > wrong_result.stoke_score

    def test_longer_period_scores_higher(self):
        short_period = StokeInput(
            wave_height_face_m=1.5, wave_period_s=7.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0, crowd_score=0.7,
        )
        long_period = StokeInput(
            wave_height_face_m=1.5, wave_period_s=16.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0, crowd_score=0.7,
        )
        short_result = compute_stoke_score(short_period, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        long_result = compute_stoke_score(long_period, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert long_result.stoke_score > short_result.stoke_score

    def test_crowded_reduces_crowd_averse_user(self):
        prefs_hates_crowds = UserPreferences(pref_crowd_tolerance=0.0)
        prefs_tolerant = UserPreferences(pref_crowd_tolerance=1.0)
        crowded = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0,
            crowd_score=0.1,  # very crowded
        )
        hates_result = compute_stoke_score(crowded, prefs_hates_crowds, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        tolerant_result = compute_stoke_score(crowded, prefs_tolerant, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert tolerant_result.stoke_score > hates_result.stoke_score


# ─── Personalization ──────────────────────────────────────────────────────────

class TestPersonalization:
    def test_big_wave_surfer_scores_mavericks_higher(self):
        big_wave_prefs = UserPreferences(
            pref_min_height_m=3.0, pref_max_height_m=8.0,
            pref_min_period_s=14.0, skill_level="pro",
        )
        average_surfer = average_prefs()
        mavericks_conditions = StokeInput(
            wave_height_face_m=5.0, wave_period_s=18.0, wave_direction=300.0,
            wind_speed_ms=4.0, wind_direction=120.0, wind_offshore_direction=120.0,
            crowd_score=0.9,
        )
        big_result = compute_stoke_score(mavericks_conditions, big_wave_prefs, 300.0, 40.0)
        avg_result = compute_stoke_score(mavericks_conditions, average_surfer, 300.0, 40.0)
        assert big_result.stoke_score > avg_result.stoke_score

    def test_beginner_prefers_small_waves(self):
        beginner = UserPreferences(
            pref_min_height_m=0.3, pref_max_height_m=0.8,
            pref_min_period_s=6.0, skill_level="beginner",
        )
        advanced = UserPreferences(
            pref_min_height_m=1.5, pref_max_height_m=4.0,
            pref_min_period_s=10.0, skill_level="advanced",
        )
        small_waves = StokeInput(
            wave_height_face_m=0.6, wave_period_s=8.0, wave_direction=285.0,
            wind_speed_ms=2.0, wind_direction=100.0, wind_offshore_direction=100.0,
            crowd_score=0.8,
        )
        beg_result = compute_stoke_score(small_waves, beginner, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        adv_result = compute_stoke_score(small_waves, advanced, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert beg_result.stoke_score > adv_result.stoke_score

    def test_wind_importance_affects_score(self):
        wind_obsessed = UserPreferences(pref_offshore_importance=1.0)
        wind_doesnt_care = UserPreferences(pref_offshore_importance=0.0)
        onshore = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=12.0, wind_direction=280.0,  # strong onshore
            wind_offshore_direction=100.0, crowd_score=0.7,
        )
        obsessed_result = compute_stoke_score(onshore, wind_obsessed, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        doesnt_care_result = compute_stoke_score(onshore, wind_doesnt_care, SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert doesnt_care_result.stoke_score > obsessed_result.stoke_score


# ─── Edge cases ───────────────────────────────────────────────────────────────

class TestEdgeCases:
    def test_zero_height_returns_low_score(self):
        zero_waves = StokeInput(
            wave_height_face_m=0.0, wave_period_s=0.0, wave_direction=0.0,
            wind_speed_ms=0.0, wind_direction=0.0, wind_offshore_direction=0.0,
            crowd_score=1.0,
        )
        result = compute_stoke_score(zero_waves, average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert result.stoke_score < 50.0

    def test_returns_stoke_result_always(self):
        result = compute_stoke_score(good_conditions(), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE)
        assert result.label
        assert result.emoji
        d = result.to_dict()
        assert "stoke_score" in d
        assert "components" in d

    def test_direction_wraps_around_360(self):
        """Test that 350° and 10° are considered close."""
        cond_350 = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=350.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0,
            crowd_score=0.7,
        )
        cond_10 = StokeInput(
            wave_height_face_m=1.5, wave_period_s=12.0, wave_direction=10.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0,
            crowd_score=0.7,
        )
        result_350 = compute_stoke_score(cond_350, average_prefs(), 0.0, 30.0)
        result_10 = compute_stoke_score(cond_10, average_prefs(), 0.0, 30.0)
        # Both should score similarly for a spot with optimal_dir=0
        assert abs(result_350.stoke_score - result_10.stoke_score) < 15.0


# ─── Quality score ────────────────────────────────────────────────────────────

class TestComputeQualityScore:
    def test_returns_0_to_10(self):
        score = compute_quality_score(
            wave_height_m=1.5, wave_period_s=12.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0,
            spot_optimal_swell_dir=285.0, spot_optimal_wind_dir=100.0,
        )
        assert 0.0 <= score <= 10.0

    def test_good_conditions_above_5(self):
        score = compute_quality_score(
            wave_height_m=1.5, wave_period_s=14.0, wave_direction=285.0,
            wind_speed_ms=2.0, wind_direction=100.0,
            spot_optimal_swell_dir=285.0, spot_optimal_wind_dir=100.0,
            spot_min_size=0.8, spot_max_size=3.0,
        )
        assert score >= 5.0, f"Good conditions should score ≥5, got {score}"


# ─── Break-type tide scoring ──────────────────────────────────────────────────

class TestBreakTypeTideScoring:
    def _cond(self, tide_state: str, tide_height_m: float = 1.0) -> StokeInput:
        return StokeInput(
            wave_height_face_m=1.5, wave_period_s=14.0, wave_direction=285.0,
            wind_speed_ms=3.0, wind_direction=100.0, wind_offshore_direction=100.0,
            crowd_score=0.7, tide_state=tide_state, tide_height_m=tide_height_m,
        )

    def test_reef_high_tide_penalized_vs_rising(self):
        rising = compute_stoke_score(
            self._cond("rising"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="reef"
        )
        high = compute_stoke_score(
            self._cond("high"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="reef"
        )
        assert rising.stoke_score > high.stoke_score

    def test_beach_high_vs_rising_gap_smaller_than_reef(self):
        reef_rising = compute_stoke_score(
            self._cond("rising"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="reef"
        ).stoke_score
        reef_high = compute_stoke_score(
            self._cond("high"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="reef"
        ).stoke_score
        beach_rising = compute_stoke_score(
            self._cond("rising"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="beach"
        ).stoke_score
        beach_high = compute_stoke_score(
            self._cond("high"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="beach"
        ).stoke_score
        reef_gap = reef_rising - reef_high
        beach_gap = beach_rising - beach_high
        assert reef_gap > beach_gap

    def test_point_low_tide_decent(self):
        result = compute_stoke_score(
            self._cond("low"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="point"
        )
        assert result.components["tide"] >= 60

    def test_rivermouth_low_tide_better_than_high(self):
        low = compute_stoke_score(
            self._cond("low"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="rivermouth"
        )
        high = compute_stoke_score(
            self._cond("high"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="rivermouth"
        )
        assert low.stoke_score > high.stoke_score

    def test_break_type_none_does_not_crash(self):
        result = compute_stoke_score(
            self._cond("rising"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type=None
        )
        assert 0.0 <= result.stoke_score <= 100.0

    def test_unknown_break_type_uses_defaults(self):
        result = compute_stoke_score(
            self._cond("rising"), average_prefs(), SPOT_OPTIMAL_DIR, SPOT_RANGE, break_type="unknown_type"
        )
        assert 0.0 <= result.stoke_score <= 100.0
