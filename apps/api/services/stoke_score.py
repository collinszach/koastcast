"""
Stoke Score Engine

Computes a personalized 0-100 surf quality score based on:
  - Forecast conditions vs. spot optimal parameters
  - User preferences (height, period, wind tolerance, crowd tolerance)

This is SwellStack's key differentiator from Surfline's generic star ratings.
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Literal


TideState = Literal["rising", "falling", "high", "low", "unknown"]


@dataclass
class StokeInput:
    wave_height_face_m: float
    wave_period_s: float
    wave_direction: float
    wind_speed_ms: float
    wind_direction: float
    wind_offshore_direction: float   # spot's offshore wind direction (degrees)
    crowd_score: float               # 0-1 (1=empty, 0=packed)
    tide_height_m: float = 0.0
    tide_state: TideState = "unknown"


@dataclass
class UserPreferences:
    pref_min_height_m: float = 0.6
    pref_max_height_m: float = 2.5
    pref_min_period_s: float = 8.0
    pref_offshore_importance: float = 0.8   # 0-1: how much wind matters
    pref_crowd_tolerance: float = 0.5       # 0-1: 1=doesn't mind crowds
    skill_level: str = "intermediate"
    board_type: str = "shortboard"


@dataclass
class StokeResult:
    stoke_score: float
    components: dict[str, float]
    label: str
    emoji: str

    def to_dict(self) -> dict:
        return {
            "stoke_score": self.stoke_score,
            "components": self.components,
            "label": self.label,
            "emoji": self.emoji,
        }


# Default preferences used for generic (non-personalized) scoring
DEFAULT_PREFERENCES = UserPreferences(
    pref_min_height_m=0.8,
    pref_max_height_m=2.5,
    pref_min_period_s=9.0,
    pref_offshore_importance=0.7,
    pref_crowd_tolerance=0.5,
    skill_level="intermediate",
)


def _score_height(h: float, pref_min: float, pref_max: float) -> float:
    """Asymmetric Gaussian — below optimal penalized less than above (danger zone)."""
    optimal = (pref_min + pref_max) / 2.0
    if h < optimal:
        # Below optimal — gentler penalty (sigma = distance from optimal to min)
        sigma = optimal - pref_min
        return math.exp(-0.5 * ((h - optimal) / max(sigma, 0.1)) ** 2)
    else:
        # Above optimal — steeper penalty (sigma = 40% of range, danger zone)
        sigma = (pref_max - pref_min) * 0.4
        return math.exp(-0.5 * ((h - optimal) / max(sigma, 0.1)) ** 2)


def _score_period(period_s: float, pref_min: float = 8.0) -> float:
    """Logarithmic period score with step-change bonus at groundswell threshold (~14s)."""
    if period_s < 6:
        return 0.1  # choppy wind chop
    if period_s >= 14:
        base = min(1.0, math.log(period_s / 14.0) * 2 + 0.85)
    elif period_s >= 10:
        base = 0.5 + 0.35 * (period_s - 10.0) / 4.0
    else:
        base = 0.1 + 0.4 * (period_s - 6.0) / 4.0
    return min(1.0, base)


def _score_direction(swell_dir: float, optimal_dir: float, tolerance_deg: float = 45.0) -> float:
    """Raised cosine (Hanning-like) rolloff within tolerance; linear dropout beyond."""
    diff = abs(swell_dir - optimal_dir) % 360.0
    diff = min(diff, 360.0 - diff)
    if diff > tolerance_deg * 1.5:
        return 0.0
    if diff <= tolerance_deg:
        # Smooth raised cosine rolloff
        return 0.5 * (1.0 + math.cos(math.pi * diff / tolerance_deg))
    else:
        # Linear dropout between tolerance and 1.5× tolerance
        excess = diff - tolerance_deg
        return max(0.0, 0.5 * (1.0 - excess / (tolerance_deg * 0.5)))


def _score_wind(wind_speed_ms: float, wind_dir: float, optimal_offshore_dir: float) -> float:
    """Speed-aware wind score: ideal offshore is 5-12 kt; howling offshore is penalized."""
    diff = abs(wind_dir - optimal_offshore_dir) % 360.0
    diff = min(diff, 360.0 - diff)
    is_offshore = diff < 90.0
    speed_kt = wind_speed_ms * 1.944
    if is_offshore:
        if speed_kt < 5:
            return 0.9   # light offshore — nearly perfect
        elif speed_kt < 12:
            return 1.0   # ideal offshore grooming
        elif speed_kt < 20:
            return 0.8   # strong offshore — slightly choppy
        else:
            return 0.5   # howling offshore — white caps even offshore
    else:
        # Onshore/cross — penalize proportionally to speed and angle
        onshore_factor = (diff - 90.0) / 90.0  # 0 at cross, 1 at dead-onshore
        penalty = onshore_factor * min(speed_kt / 8.0, 1.0)
        return max(0.0, 1.0 - penalty)


def _score_steepness(wave_height_m: float, period_s: float) -> float:
    """Optimal steepness 0.02-0.04 (powerful but not blown out). >0.05 = close-out risk."""
    if period_s <= 0:
        return 0.4
    g = 9.81
    L_deep = g * period_s ** 2 / (2.0 * math.pi)
    steepness = wave_height_m / L_deep
    if steepness < 0.01:
        return 0.4   # very flat/slow
    elif steepness < 0.02:
        return 0.6 + 4.0 * (steepness - 0.01) / 0.01
    elif steepness <= 0.04:
        return 1.0   # sweet spot
    elif steepness <= 0.06:
        return 1.0 - 5.0 * (steepness - 0.04) / 0.02
    else:
        return 0.1   # too steep, likely close-outs


def _score_tide(tide_state: str | None, tide_height_m: float | None, break_type: str | None = None) -> float:
    """Tide quality score — break-type-aware.

    Different break types respond differently to tide:
    - Reef: dangerous at low, closes out at high; best mid-rising
    - Point: good at low-mid; high = mushy
    - Beach: most forgiving
    - Jetty: similar to beach
    - Rivermouth: best at low-mid; high = murky/flat
    """
    _PROFILES: dict[str | None, dict[str, float]] = {
        "reef":       {"rising": 0.90, "falling": 0.70, "high": 0.50, "low": 0.55, "unknown": 0.65},
        "point":      {"rising": 0.90, "falling": 0.80, "high": 0.60, "low": 0.75, "unknown": 0.70},
        "beach":      {"rising": 0.85, "falling": 0.75, "high": 0.65, "low": 0.75, "unknown": 0.70},
        "jetty":      {"rising": 0.80, "falling": 0.75, "high": 0.70, "low": 0.70, "unknown": 0.70},
        "rivermouth": {"rising": 0.85, "falling": 0.80, "high": 0.55, "low": 0.80, "unknown": 0.70},
    }
    _DEFAULT = {"rising": 0.85, "falling": 0.75, "high": 0.65, "low": 0.70, "unknown": 0.70}
    profile = _PROFILES.get(break_type, _DEFAULT)  # type: ignore[call-overload]
    if not tide_state:
        return profile["unknown"]
    state = tide_state.lower()
    for key in ("rising", "falling", "high", "low"):
        if key in state:
            return profile[key]
    return profile["unknown"]


def compute_stoke_score(
    conditions: StokeInput,
    prefs: UserPreferences,
    spot_optimal_swell_dir: float,
    spot_optimal_swell_range: float = 45.0,
    break_type: str | None = None,
) -> StokeResult:
    """
    Compute a personalized 0-100 stoke score with component breakdown.

    Each component scores 0-1 before weighting:
      - height_score:     asymmetric Gaussian (below-optimal penalized less)
      - period_score:     logarithmic with groundswell step-change at ~14s
      - direction_score:  raised cosine (Hanning-like) rolloff to optimal swell dir
      - wind_score:       speed-aware; ideal offshore 5-12 kt scores 1.0
      - steepness_score:  wave steepness quality metric (H/L_deep)
      - tide_score:       tide state proxy
      - crowd_score:      user tolerance applied to crowd level
    """
    # ── Height score ─────────────────────────────────────────────────────────
    height_score = _score_height(
        conditions.wave_height_face_m,
        prefs.pref_min_height_m,
        prefs.pref_max_height_m,
    )
    # Skill-level adjustment: advanced/pro users tolerate bigger surf
    skill_multiplier = {
        "beginner": 0.8,
        "intermediate": 1.0,
        "advanced": 1.1,
        "pro": 1.2,
    }.get(prefs.skill_level, 1.0)
    height_score = min(1.0, height_score * skill_multiplier)

    # ── Period score ──────────────────────────────────────────────────────────
    period_score = _score_period(conditions.wave_period_s, prefs.pref_min_period_s)
    # Longboarders score higher on shorter periods
    if prefs.board_type in ("longboard", "SUP"):
        period_score = min(1.0, period_score * 1.15)

    # ── Swell direction score ─────────────────────────────────────────────────
    direction_score = _score_direction(
        conditions.wave_direction,
        spot_optimal_swell_dir,
        spot_optimal_swell_range,
    )

    # ── Wind score ────────────────────────────────────────────────────────────
    raw_wind_score = _score_wind(
        conditions.wind_speed_ms,
        conditions.wind_direction,
        conditions.wind_offshore_direction,
    )
    # Apply user's weight on offshore importance
    wind_component = (1.0 - prefs.pref_offshore_importance) + (prefs.pref_offshore_importance * raw_wind_score)
    wind_component = min(1.0, max(0.0, wind_component))

    # ── Steepness score ───────────────────────────────────────────────────────
    steepness_score = _score_steepness(
        conditions.wave_height_face_m,
        conditions.wave_period_s,
    )

    # ── Tide score ────────────────────────────────────────────────────────────
    tide_score = _score_tide(conditions.tide_state, conditions.tide_height_m, break_type)

    # ── Crowd score ───────────────────────────────────────────────────────────
    # crowd_score input: 1.0 = empty, 0.0 = packed
    # User tolerance: 1.0 = doesn't care, 0.0 = hates crowds
    crowd_component = 1.0 - (1.0 - conditions.crowd_score) * (1.0 - prefs.pref_crowd_tolerance)
    crowd_component = min(1.0, max(0.0, crowd_component))

    # ── Composite (weights sum to 1.0) ────────────────────────────────────────
    weights = {
        "height":     0.28,
        "period":     0.18,
        "direction":  0.22,
        "wind":       0.14,
        "steepness":  0.05,
        "tide":       0.08,
        "crowd":      0.05,
    }
    raw_score = (
        weights["height"]    * height_score
        + weights["period"]    * period_score
        + weights["direction"] * direction_score
        + weights["wind"]      * wind_component
        + weights["steepness"] * steepness_score
        + weights["tide"]      * tide_score
        + weights["crowd"]     * crowd_component
    )
    stoke_score = round(raw_score * 100.0, 1)

    components = {
        "height":    round(height_score * 100.0),
        "period":    round(period_score * 100.0),
        "direction": round(direction_score * 100.0),
        "wind":      round(wind_component * 100.0),
        "steepness": round(steepness_score * 100.0),
        "tide":      round(tide_score * 100.0),
        "crowd":     round(crowd_component * 100.0),
    }

    label, emoji = _score_label(stoke_score)

    return StokeResult(
        stoke_score=stoke_score,
        components=components,
        label=label,
        emoji=emoji,
    )


def compute_quality_score(
    wave_height_m: float,
    wave_period_s: float,
    wave_direction: float,
    wind_speed_ms: float,
    wind_direction: float,
    spot_optimal_swell_dir: float,
    spot_optimal_wind_dir: float,
    spot_optimal_swell_range: float = 45.0,
    spot_min_size: float = 1.0,
    spot_max_size: float = 3.0,
    crowd_score: float = 0.5,
) -> float:
    """
    Compute a generic (non-personalized) quality score 0-10.
    Used for map pin coloring and default displays.
    """
    prefs = UserPreferences(
        pref_min_height_m=spot_min_size,
        pref_max_height_m=spot_max_size,
        pref_min_period_s=9.0,
        pref_offshore_importance=0.7,
        pref_crowd_tolerance=0.5,
    )
    conditions = StokeInput(
        wave_height_face_m=wave_height_m,
        wave_period_s=wave_period_s,
        wave_direction=wave_direction,
        wind_speed_ms=wind_speed_ms,
        wind_direction=wind_direction,
        wind_offshore_direction=spot_optimal_wind_dir,
        crowd_score=crowd_score,
    )
    result = compute_stoke_score(
        conditions, prefs,
        spot_optimal_swell_dir=spot_optimal_swell_dir,
        spot_optimal_swell_range=spot_optimal_swell_range,
    )
    return round(result.stoke_score / 10.0, 1)  # Scale to 0-10


def _score_label(score: float) -> tuple[str, str]:
    if score >= 80:
        return "FIRING", "🔥"
    if score >= 65:
        return "PUMPING", "🤙"
    if score >= 50:
        return "FUN", "😎"
    if score >= 35:
        return "WORTH IT", "🏄"
    return "FLAT SPELL", "😴"
