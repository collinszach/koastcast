"""
Placeholder weights — copy this to weights.py and replace with real values.
The actual tuned values are proprietary and not included in this repository.

To run with meaningful results you will need to:
  1. Collect historical surf session data paired with forecast conditions
  2. Run the calibration pipeline (not included) to derive your own weights
  3. Fill in the values below and save as weights.py (gitignored)

See docs/WEIGHTS.md for the expected shape of each constant.
"""
from __future__ import annotations

# ── These are PLACEHOLDER values — not the real tuned constants ───────────────

STOKE_WEIGHTS: dict[str, float] = {
    "height":    0.143,
    "period":    0.143,
    "direction": 0.143,
    "wind":      0.143,
    "steepness": 0.143,
    "tide":      0.143,
    "crowd":     0.142,
}

SKILL_MULTIPLIERS: dict[str, float] = {
    "beginner":     1.0,
    "intermediate": 1.0,
    "advanced":     1.0,
    "pro":          1.0,
}

TIDE_PROFILES: dict[str, dict[str, float]] = {
    "reef":       {"rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70},
    "point":      {"rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70},
    "beach":      {"rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70},
    "jetty":      {"rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70},
    "rivermouth": {"rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70},
}
DEFAULT_TIDE_PROFILE: dict[str, float] = {
    "rising": 0.70, "falling": 0.70, "high": 0.70, "low": 0.70, "unknown": 0.70,
}

GROUNDSWELL_THRESHOLD_S: float = 12.0
PERIOD_SHORT_MIN_S: float = 6.0

DOW_MULTIPLIERS: dict[int, float] = {i: 1.0 for i in range(7)}
HOUR_MULTIPLIERS: dict[int, float] = {h: 1.0 for h in range(5, 19)}
MONTH_MULTIPLIERS: dict[int, float] = {m: 1.0 for m in range(1, 13)}

QUALITY_CROWD_TIERS: list[tuple[float, float]] = [
    (8.0, 1.0),
    (6.0, 1.0),
    (4.0, 1.0),
    (2.0, 1.0),
    (0.0, 1.0),
]

HOLIDAY_MULTIPLIER: float = 1.0

TIDE_BONUS_RISING: float = 1.0
TIDE_BONUS_EXTREME: float = 1.0
TOD_MORNING_BONUS: float = 1.0
TOD_AFTERNOON_MULT: float = 1.0
TOD_EVENING_MULT: float = 1.0

OPTIMAL_WINDOW_GAP_HOURS: float = 2.0
OPTIMAL_WINDOW_MIN_SCORE: float = 55.0
