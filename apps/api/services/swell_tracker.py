"""
Swell Event Tracker

Scans the 16-day forecast for named significant swell events.
Each event gets a name, confidence indicator, and tracking metadata.

This drives the "swell watching" daily habit — surfers checking 10-20 times/day
as they watch a North Pacific storm build from 10 days out.

Algorithm:
1. Scan forecast hours for clusters of elevated wave height + long period
2. Group consecutive hours above threshold into discrete swell events
3. Score each event (size × period × direction fit × confidence)
4. Assign a name based on origin (North Pacific, Southern Ocean, Hurricane, etc.)
5. Return top events sorted by score
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal


Origin = Literal["north_pacific", "south_pacific", "northwest", "southwest",
                 "northwest_atlantic", "southeast", "hurricane", "local_wind", "unknown"]

Confidence = Literal["high", "medium", "low", "speculative"]


@dataclass
class SwellEvent:
    id: str                       # slug for this event (e.g. "np-swell-1")
    name: str                     # human-readable name (e.g. "NW Pacific Groundswell")
    origin: Origin
    start_time: datetime
    peak_time: datetime
    end_time: datetime
    peak_height_m: float          # face height at peak
    peak_height_ft: float
    peak_period_s: float
    peak_direction: float         # degrees
    peak_direction_str: str       # "NW", "SW", etc.
    confidence: Confidence
    confidence_note: str
    score: float                  # 0-100 composite score
    days_away: float              # days until peak from now
    duration_h: int               # event duration in hours
    # Optional: direction fit vs. a specific spot (set by caller)
    direction_fit: str | None = None  # "ideal", "off-angle", "wrong direction"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "origin": self.origin,
            "start_time": self.start_time.isoformat(),
            "peak_time": self.peak_time.isoformat(),
            "end_time": self.end_time.isoformat(),
            "peak_height_m": round(self.peak_height_m, 2),
            "peak_height_ft": round(self.peak_height_ft, 1),
            "peak_period_s": round(self.peak_period_s, 1),
            "peak_direction": round(self.peak_direction, 0),
            "peak_direction_str": self.peak_direction_str,
            "confidence": self.confidence,
            "confidence_note": self.confidence_note,
            "score": round(self.score, 1),
            "days_away": round(self.days_away, 1),
            "duration_h": self.duration_h,
            "direction_fit": self.direction_fit,
        }


# ─── Direction helpers ────────────────────────────────────────────────────────

def _compass(deg: float) -> str:
    dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return dirs[round(deg / 22.5) % 16]


def _angle_diff(a: float, b: float) -> float:
    diff = abs(a - b) % 360
    return diff if diff <= 180 else 360 - diff


def _origin_from_direction(direction: float, period_s: float) -> Origin:
    """Infer swell origin from direction and period."""
    if period_s < 10:
        return "local_wind"

    # North Pacific: NW swells (270°-330°)
    if 270 <= direction <= 330:
        return "north_pacific"

    # Northwest (general): 240°-270°
    if 240 <= direction < 270:
        return "northwest"

    # South Pacific / Southern Ocean: S/SW swells (160°-240°)
    if 160 <= direction < 240:
        if period_s >= 16:
            return "south_pacific"  # Long-period = deep Southern Ocean
        return "southwest"

    # SE swells — tropical, hurricane-generated
    if 90 <= direction < 160:
        return "hurricane" if period_s >= 14 else "southeast"

    # NE / Atlantic swells
    if 0 <= direction < 90 or direction >= 330:
        return "northwest_atlantic"

    return "unknown"


def _name_event(origin: Origin, height_ft: float, period_s: float) -> str:
    """Generate a human-readable swell event name."""
    size_adj = (
        "XXL " if height_ft >= 15 else
        "XL " if height_ft >= 10 else
        "Solid " if height_ft >= 6 else
        "Overhead " if height_ft >= 5 else
        ""
    )

    period_adj = "Long-Period " if period_s >= 16 else ""

    origin_names: dict[Origin, str] = {
        "north_pacific":      "North Pacific Groundswell",
        "south_pacific":      "Southern Ocean Swell",
        "northwest":          "NW Groundswell",
        "southwest":          "SW Swell",
        "northwest_atlantic": "NW Atlantic Swell",
        "southeast":          "SE Swell",
        "hurricane":          "Tropical Swell",
        "local_wind":         "Wind Swell",
        "unknown":            "Approaching Swell",
    }

    return f"{size_adj}{period_adj}{origin_names[origin]}"


def _confidence_from_days(days_away: float, model_agreement: float | None) -> tuple[Confidence, str]:
    """Confidence degrades with forecast distance."""
    if days_away <= 2:
        if model_agreement and model_agreement > 0.8:
            return "high", "Short-range, high model agreement"
        return "high", "Short-range forecast — high reliability"

    if days_away <= 5:
        if model_agreement and model_agreement > 0.7:
            return "medium", "Mid-range with good model agreement"
        return "medium", "Mid-range forecast — moderate uncertainty"

    if days_away <= 10:
        return "low", "Extended range — check back as swell approaches"

    return "speculative", "Speculative: 10+ days out — models are still resolving this event"


def _direction_fit(swell_dir: float, optimal_dir: float | None, optimal_range: float) -> str:
    if optimal_dir is None:
        return "unknown"
    diff = _angle_diff(swell_dir, optimal_dir)
    if diff <= optimal_range * 0.5:
        return "ideal angle for this break"
    if diff <= optimal_range:
        return "slightly off-angle but still working"
    if diff <= optimal_range * 1.5:
        return "suboptimal angle — reduced power"
    return "wrong direction for this break"


# ─── Event detection ──────────────────────────────────────────────────────────

SWELL_THRESHOLD_M = 0.8      # minimum face height to be a "swell event" (m)
PERIOD_THRESHOLD_S = 9.0     # minimum period for a swell event
MIN_EVENT_HOURS = 4          # minimum event duration
GAP_TOLERANCE_H = 6          # hours of below-threshold before ending an event


def detect_swell_events(
    forecast_hours: list[dict],
    now: datetime,
    optimal_swell_direction: float | None = None,
    optimal_swell_direction_range: float = 45.0,
    max_events: int = 5,
) -> list[SwellEvent]:
    """
    Detect and return named swell events from a 16-day hourly forecast.

    forecast_hours: list of dicts with keys:
        - forecast_time (ISO str or datetime)
        - wave_height_m, wave_height_face_m, wave_period_s,
          swell_direction, wave_direction, model_agreement
    """
    if not forecast_hours:
        return []

    # Parse and normalize hours
    hours = []
    for h in forecast_hours:
        try:
            ft = h.get("forecast_time")
            if isinstance(ft, str):
                ts = datetime.fromisoformat(ft.replace("Z", "+00:00"))
            else:
                ts = ft
            height = h.get("wave_height_face_m") or h.get("wave_height_m") or 0
            period = h.get("wave_period_s") or 0
            direction = h.get("swell_direction") or h.get("wave_direction") or 270
            agreement = h.get("model_agreement")
            hours.append({
                "ts": ts,
                "height": float(height),
                "period": float(period),
                "direction": float(direction),
                "agreement": agreement,
            })
        except Exception:
            continue

    if not hours:
        return []

    # Group consecutive above-threshold hours into clusters
    events: list[SwellEvent] = []
    in_event = False
    event_hours: list[dict] = []
    below_count = 0
    event_idx = 0

    for h in hours:
        above = h["height"] >= SWELL_THRESHOLD_M and h["period"] >= PERIOD_THRESHOLD_S

        if above:
            below_count = 0
            if not in_event:
                in_event = True
                event_hours = []
            event_hours.append(h)
        else:
            if in_event:
                below_count += 1
                if below_count <= GAP_TOLERANCE_H:
                    event_hours.append(h)  # bridge small gaps
                else:
                    # End of event
                    if len(event_hours) >= MIN_EVENT_HOURS:
                        ev = _build_event(
                            event_hours, now, event_idx,
                            optimal_swell_direction, optimal_swell_direction_range
                        )
                        if ev:
                            events.append(ev)
                            event_idx += 1
                    in_event = False
                    event_hours = []
                    below_count = 0

    # Handle event at end of forecast window
    if in_event and len(event_hours) >= MIN_EVENT_HOURS:
        ev = _build_event(
            event_hours, now, event_idx,
            optimal_swell_direction, optimal_swell_direction_range
        )
        if ev:
            events.append(ev)

    # Sort by score (best first) and return top N
    events.sort(key=lambda e: e.score, reverse=True)
    return events[:max_events]


def _build_event(
    hours: list[dict],
    now: datetime,
    idx: int,
    optimal_dir: float | None,
    optimal_range: float,
) -> SwellEvent | None:
    if not hours:
        return None

    # Filter to above-threshold hours for peak finding
    valid = [h for h in hours if h["height"] >= SWELL_THRESHOLD_M]
    if not valid:
        return None

    # Peak = hour with highest combined height × period score
    peak = max(valid, key=lambda h: h["height"] * math.log(max(h["period"], 1) + 1))

    start_ts = hours[0]["ts"]
    end_ts = hours[-1]["ts"]
    peak_ts = peak["ts"]

    # Ensure timezone-aware comparison
    if now.tzinfo is None:
        from datetime import timezone
        now = now.replace(tzinfo=timezone.utc)
    if peak_ts.tzinfo is None:
        from datetime import timezone
        peak_ts = peak_ts.replace(tzinfo=timezone.utc)

    days_away = max(0, (peak_ts - now).total_seconds() / 86400)

    # Average model agreement around peak
    peak_window = [h for h in valid if abs((h["ts"] - peak_ts).total_seconds()) <= 3 * 3600]
    agreements = [h["agreement"] for h in peak_window if h["agreement"] is not None]
    avg_agreement = sum(agreements) / len(agreements) if agreements else None

    origin = _origin_from_direction(peak["direction"], peak["period"])
    confidence, confidence_note = _confidence_from_days(days_away, avg_agreement)
    name = _name_event(origin, peak["height"] * 3.28, peak["period"])

    # Score: size × period × confidence × proximity (recent events score higher)
    size_score = min(100, peak["height"] * 3.28 * 8)  # scale 0-100
    period_bonus = min(1.5, peak["period"] / 12)
    confidence_multiplier = {"high": 1.0, "medium": 0.8, "low": 0.6, "speculative": 0.4}[confidence]
    proximity_boost = max(0.5, 1.0 - days_away / 20)
    score = size_score * period_bonus * confidence_multiplier * proximity_boost

    dir_fit = _direction_fit(peak["direction"], optimal_dir, optimal_range)

    duration_h = max(1, int((end_ts - start_ts).total_seconds() / 3600))

    return SwellEvent(
        id=f"swell-event-{idx + 1}",
        name=name,
        origin=origin,
        start_time=start_ts,
        peak_time=peak_ts,
        end_time=end_ts,
        peak_height_m=peak["height"],
        peak_height_ft=round(peak["height"] * 3.28, 1),
        peak_period_s=peak["period"],
        peak_direction=peak["direction"],
        peak_direction_str=_compass(peak["direction"]),
        confidence=confidence,
        confidence_note=confidence_note,
        score=round(score, 1),
        days_away=round(days_away, 1),
        duration_h=duration_h,
        direction_fit=dir_fit,
    )
