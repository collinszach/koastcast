"""
Optimal Window Finder

Scores every forecast hour for a spot + user and groups high-scoring
adjacent hours into "surf windows". Returns the top N windows with
human-readable descriptions.

Compound score:
  base_stoke × tide_bonus × time_of_day_bonus × crowd_penalty
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

try:
    from config.weights import (
        TIDE_BONUS_RISING,
        TIDE_BONUS_EXTREME,
        TOD_MORNING_BONUS,
        TOD_AFTERNOON_MULT,
        TOD_EVENING_MULT,
        OPTIMAL_WINDOW_GAP_HOURS,
        OPTIMAL_WINDOW_MIN_SCORE,
    )
except ImportError:
    TIDE_BONUS_RISING = 1.0
    TIDE_BONUS_EXTREME = 1.0
    TOD_MORNING_BONUS = 1.0
    TOD_AFTERNOON_MULT = 1.0
    TOD_EVENING_MULT = 1.0
    OPTIMAL_WINDOW_GAP_HOURS = 2.0
    OPTIMAL_WINDOW_MIN_SCORE = 55.0

from services.stoke_score import (
    DEFAULT_PREFERENCES,
    StokeInput,
    UserPreferences,
    compute_stoke_score,
)
from services.crowd_model import get_crowd_predictor


@dataclass
class OptimalWindow:
    start_time: datetime
    end_time: datetime
    duration_hours: int
    peak_score: float
    peak_hour: datetime
    peak_stoke_score: float
    peak_wave_height_m: float | None
    peak_wave_period_s: float | None
    peak_wave_direction: float | None
    peak_wind_speed_ms: float | None
    peak_wind_direction: float | None
    peak_tide_state: str | None
    crowd_level: str
    reason: str
    hours: list[dict] = field(default_factory=list)


def _tide_bonus(tide_state: str | None, tide_height_m: float | None) -> float:
    if tide_state == "rising":
        return TIDE_BONUS_RISING
    if tide_state in ("high", "low"):
        return TIDE_BONUS_EXTREME
    return 1.0


def _time_of_day_bonus(hour: int) -> float:
    if 5 <= hour <= 10:
        return TOD_MORNING_BONUS
    if 11 <= hour <= 16:
        return TOD_AFTERNOON_MULT
    return TOD_EVENING_MULT


def _build_reason(
    wave_height_m: float | None,
    wave_period_s: float | None,
    wind_speed_ms: float | None,
    wind_direction: float | None,
    offshore_dir: float | None,
    tide_state: str | None,
    hour: int,
    crowd_label: str,
) -> str:
    """Build a human-readable reason string for a surf window."""
    parts: list[str] = []

    # Time of day
    if 5 <= hour <= 9:
        parts.append("Early morning glass")
    elif 6 <= hour <= 10:
        parts.append("Morning session")

    # Wind description
    if wind_speed_ms is not None and offshore_dir is not None and wind_direction is not None:
        diff = abs(wind_direction - offshore_dir) % 360
        diff = min(diff, 360 - diff)
        if wind_speed_ms < 3:
            parts.append(f"{wind_speed_ms:.0f}m/s glassy")
        elif diff < 45:
            dir_name = _degrees_to_cardinal(wind_direction)
            parts.append(f"Offshore {dir_name}")
        elif diff < 90:
            parts.append("Cross-shore wind")
        else:
            spd = wind_speed_ms
            parts.append(f"{spd:.0f}m/s onshore" if spd > 5 else "Light onshore")

    # Wave description
    if wave_height_m is not None and wave_period_s is not None:
        ht_ft = wave_height_m * 3.281
        period_type = "groundswell" if wave_period_s >= 14 else ("swell" if wave_period_s >= 10 else "windswell")
        parts.append(f"{ht_ft:.0f}ft @ {wave_period_s:.0f}s {period_type}")

    # Tide
    if tide_state:
        parts.append(f"{tide_state} tide")

    # Crowd
    if crowd_label in ("empty", "uncrowded"):
        parts.append(f"{crowd_label} lineup")

    return ", ".join(parts) if parts else "Decent conditions"


def _degrees_to_cardinal(deg: float) -> str:
    dirs = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"]
    ix = round(deg / 22.5) % 16
    return dirs[ix]


def find_optimal_windows(
    forecast_hours: list[dict[str, Any]],
    spot: Any,
    prefs: UserPreferences | None = None,
    min_score: float = OPTIMAL_WINDOW_MIN_SCORE,
    max_windows: int = 10,
    min_window_hours: int = 1,
) -> list[OptimalWindow]:
    """
    Find optimal surf windows in a forecast.

    Args:
        forecast_hours: list of forecast hour dicts (from ForecastHour model)
        spot: spot object with optimal_swell_direction, optimal_wind_direction, etc.
        prefs: user preferences (defaults to DEFAULT_PREFERENCES)
        min_score: minimum compound score to include in a window (0-100)
        max_windows: maximum number of windows to return
        min_window_hours: minimum window duration in hours

    Returns:
        List of OptimalWindow objects, sorted by peak_score descending.
    """
    if prefs is None:
        prefs = DEFAULT_PREFERENCES

    crowd_predictor = get_crowd_predictor()
    scored_hours: list[tuple[datetime, float, dict]] = []

    for h in forecast_hours:
        ft = h.get("forecast_time")
        if ft is None:
            continue

        if isinstance(ft, str):
            try:
                ft = datetime.fromisoformat(ft.replace("Z", "+00:00"))
            except ValueError:
                continue

        wave_h = h.get("wave_height_face_m") or h.get("wave_height_m")
        wave_p = h.get("wave_period_s")
        wave_d = h.get("wave_direction")
        swell_d = h.get("swell_direction") or wave_d
        wind_spd = h.get("wind_speed_ms")
        wind_dir = h.get("wind_direction")
        tide_h = h.get("tide_height_m", 0.0) or 0.0
        tide_state = h.get("tide_state")
        quality_score = h.get("quality_score")

        # Skip if we can't compute a meaningful score
        if wave_h is None or wave_p is None:
            scored_hours.append((ft, 0.0, h))
            continue

        # Crowd prediction
        crowd_prob = crowd_predictor.predict(
            forecast_time=ft,
            quality_score=quality_score,
            spot_baseline=0.4,
        )
        crowd_surf_score = crowd_predictor.crowd_score_to_surf_score(crowd_prob)

        # Base stoke score
        optimal_swell = spot.optimal_swell_direction or 270.0
        optimal_swell_range = getattr(spot, "optimal_swell_direction_range", None) or 45.0
        offshore_dir = spot.optimal_wind_direction or 90.0

        conditions = StokeInput(
            wave_height_face_m=wave_h,
            wave_period_s=wave_p,
            wave_direction=swell_d or wave_d or optimal_swell,
            wind_speed_ms=wind_spd or 0.0,
            wind_direction=wind_dir or offshore_dir,
            wind_offshore_direction=offshore_dir,
            crowd_score=crowd_surf_score,
            tide_height_m=tide_h,
            tide_state=tide_state or "unknown",
        )

        result = compute_stoke_score(
            conditions=conditions,
            prefs=prefs,
            spot_optimal_swell_dir=optimal_swell,
            spot_optimal_swell_range=optimal_swell_range,
        )
        base = result.stoke_score

        # Compound modifiers
        tide_mult = _tide_bonus(tide_state, tide_h)
        tod_mult = _time_of_day_bonus(ft.hour)
        compound = base * tide_mult * tod_mult

        scored_hours.append((ft, round(compound, 1), {
            **h,
            "forecast_time": ft,
            "compound_score": round(compound, 1),
            "stoke_score": base,
            "crowd_prob": crowd_prob,
            "crowd_label": crowd_predictor.crowd_score_to_label(crowd_prob),
        }))

    # Group consecutive hours above threshold into windows
    windows: list[OptimalWindow] = []
    i = 0
    while i < len(scored_hours):
        ft, score, data = scored_hours[i]
        if score < min_score:
            i += 1
            continue

        # Start a window
        window_hours = [data]
        j = i + 1
        while j < len(scored_hours):
            next_ft, next_score, next_data = scored_hours[j]
            # Continue window if within 2h gap and score is reasonable
            gap = (next_ft - scored_hours[j - 1][0]).total_seconds() / 3600
            if gap <= OPTIMAL_WINDOW_GAP_HOURS and next_score >= min_score * 0.8:
                window_hours.append(next_data)
                j += 1
            else:
                break

        if len(window_hours) >= min_window_hours:
            # Find peak hour
            peak = max(window_hours, key=lambda h: h["compound_score"])
            peak_ft: datetime = peak["forecast_time"]

            offshore_dir_val = getattr(spot, "optimal_wind_direction", None)
            window = OptimalWindow(
                start_time=window_hours[0]["forecast_time"],
                end_time=window_hours[-1]["forecast_time"],
                duration_hours=len(window_hours),
                peak_score=peak["compound_score"],
                peak_hour=peak_ft,
                peak_stoke_score=peak["stoke_score"],
                peak_wave_height_m=peak.get("wave_height_face_m") or peak.get("wave_height_m"),
                peak_wave_period_s=peak.get("wave_period_s"),
                peak_wave_direction=peak.get("swell_direction") or peak.get("wave_direction"),
                peak_wind_speed_ms=peak.get("wind_speed_ms"),
                peak_wind_direction=peak.get("wind_direction"),
                peak_tide_state=peak.get("tide_state"),
                crowd_level=peak.get("crowd_label", "moderate"),
                reason=_build_reason(
                    wave_height_m=peak.get("wave_height_face_m") or peak.get("wave_height_m"),
                    wave_period_s=peak.get("wave_period_s"),
                    wind_speed_ms=peak.get("wind_speed_ms"),
                    wind_direction=peak.get("wind_direction"),
                    offshore_dir=offshore_dir_val,
                    tide_state=peak.get("tide_state"),
                    hour=peak_ft.hour,
                    crowd_label=peak.get("crowd_label", "moderate"),
                ),
                hours=window_hours,
            )
            windows.append(window)

        i = j if j > i else i + 1

    # Sort by peak score, return top N
    windows.sort(key=lambda w: w.peak_score, reverse=True)
    return windows[:max_windows]
