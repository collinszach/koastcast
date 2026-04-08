"""
Crowd Prediction Model

Rule-based crowd prediction for surf spots.
Returns 0-1 crowd probability (1 = very crowded).

Phase 3: Rule-based using day-of-week, quality, month seasonality.
Phase 4+: Train on user check-in session data to refine per-spot patterns.
"""
from __future__ import annotations

from datetime import datetime, date


# US public holidays (month, day) — approximate
US_HOLIDAYS = {
    (1, 1),   # New Year's Day
    (7, 4),   # Independence Day
    (11, 11), # Veterans Day
    (12, 25), # Christmas
    (12, 26), # Day after Christmas
    (1, 20),  # MLK Day (approx)
    (5, 26),  # Memorial Day (approx)
    (9, 1),   # Labor Day (approx)
    (11, 27), # Thanksgiving (approx)
}


class CrowdPredictor:
    """
    Predicts crowd density (0-1) for a surf spot at a given time.

    Factors:
      1. Day of week: weekends significantly busier
      2. Time of day: early morning less crowded than midday
      3. Forecast quality: good surf = more people
      4. Month: summer months busier in most US spots
      5. Holidays: national holidays boost crowd ~2x
    """

    # Base multiplier by day of week (0=Monday ... 6=Sunday)
    DOW_MULTIPLIERS = {
        0: 0.50,   # Monday
        1: 0.50,   # Tuesday
        2: 0.60,   # Wednesday
        3: 0.65,   # Thursday
        4: 0.80,   # Friday (pre-weekend)
        5: 1.50,   # Saturday
        6: 1.40,   # Sunday
    }

    # Hour of day multiplier (0-23)
    # Early morning glass sessions = lower crowd
    HOUR_MULTIPLIERS = {
        5: 0.50, 6: 0.55, 7: 0.65, 8: 0.80, 9: 0.90,
        10: 1.0, 11: 1.1, 12: 1.2, 13: 1.2, 14: 1.1,
        15: 1.0, 16: 0.90, 17: 0.85, 18: 0.70,
    }

    # Monthly seasonality (1-12): summer months busier for CA spots
    MONTH_MULTIPLIERS = {
        1: 0.7, 2: 0.7, 3: 0.8, 4: 0.9, 5: 1.0,
        6: 1.3, 7: 1.5, 8: 1.5, 9: 1.2, 10: 1.0,
        11: 0.8, 12: 0.7,
    }

    # Quality score → crowd boost (better surf = more people)
    # quality_score is 0-10
    @staticmethod
    def _quality_multiplier(quality_score: float | None) -> float:
        if quality_score is None:
            return 1.0
        if quality_score >= 8:
            return 1.8
        if quality_score >= 6:
            return 1.4
        if quality_score >= 4:
            return 1.1
        if quality_score >= 2:
            return 0.9
        return 0.7  # bad surf → empty

    @staticmethod
    def _is_holiday(dt: datetime | date) -> bool:
        if isinstance(dt, datetime):
            d = dt.date()
        else:
            d = dt
        return (d.month, d.day) in US_HOLIDAYS

    def predict(
        self,
        forecast_time: datetime,
        quality_score: float | None = None,
        spot_baseline: float = 0.5,
    ) -> float:
        """
        Predict crowd level (0-1) for a spot at a specific time.

        Args:
            forecast_time: UTC datetime to predict for
            quality_score: 0-10 surf quality score for that window
            spot_baseline: spot-specific baseline crowd level (0-1)
                          defaults to 0.5 (moderate popularity)

        Returns:
            float: crowd probability 0-1 (1 = very crowded)
        """
        dow = forecast_time.weekday()
        hour = forecast_time.hour
        month = forecast_time.month

        # Base: spot baseline (some spots are always packed)
        raw = spot_baseline

        # Apply multiplicative factors
        raw *= self.DOW_MULTIPLIERS.get(dow, 1.0)
        raw *= self.HOUR_MULTIPLIERS.get(hour, 1.0)
        raw *= self.MONTH_MULTIPLIERS.get(month, 1.0)
        raw *= self._quality_multiplier(quality_score)

        if self._is_holiday(forecast_time):
            raw *= 2.0

        # Clamp to [0.05, 0.98]
        return round(max(0.05, min(0.98, raw)), 3)

    def crowd_score_to_label(self, crowd_prob: float) -> str:
        """Convert crowd probability (0-1) to a human-readable label."""
        if crowd_prob < 0.2:
            return "empty"
        if crowd_prob < 0.4:
            return "uncrowded"
        if crowd_prob < 0.6:
            return "moderate"
        if crowd_prob < 0.8:
            return "crowded"
        return "very crowded"

    def crowd_score_to_surf_score(self, crowd_prob: float) -> float:
        """
        Convert crowd probability to a 0-1 score for the stoke engine.
        1.0 = empty (best), 0.0 = packed (worst).
        Inverse of crowd probability.
        """
        return round(1.0 - crowd_prob, 3)


# Module-level singleton
_predictor: CrowdPredictor | None = None


def get_crowd_predictor() -> CrowdPredictor:
    global _predictor
    if _predictor is None:
        _predictor = CrowdPredictor()
    return _predictor
