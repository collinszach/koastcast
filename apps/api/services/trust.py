"""
Trust Score Service — Koastcast's claim to fame.

Every forecast value ships with a 0-100 **Trust Score** answering the one
question every other surf/weather app dodges: *how sure are we?*

The score blends the signals we already compute elsewhere:
  - model_agreement   — do ECMWF / GFS / ICON agree? (services/ensemble.py)
  - confidence        — bias-corrector face-height confidence (bias_correction.py)
  - freshness         — is a live buoy reading influencing this hour? how old? (nowcast)
  - lead_decay        — forecasts degrade with lead time (exponential)
  - historical_skill  — per-spot verified accuracy (scheduler verification log)
                        Optional; omitted until the verification loop feeds it in.

This is intentionally pure (no I/O) so it is trivially testable and can run
inline during forecast assembly.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

# Lead-time decay constant (hours). trust_lead = exp(-lead / TAU).
# TAU=240 → ~0.50 at 7 days, ~0.37 at 10 days, ~0.61 at 5 days.
LEAD_DECAY_TAU_HOURS = 240.0
LEAD_DECAY_FLOOR = 0.10

# Buoy reading is considered "fresh" below this age, fully stale above the cap.
BUOY_FRESH_HOURS = 2.0
BUOY_STALE_HOURS = 12.0

# Default agreement when running single-model (non-ensemble) — we genuinely
# can't measure cross-model spread, so we neither reward nor punish.
SINGLE_MODEL_AGREEMENT = 0.60


@dataclass
class TrustResult:
    score: float                  # 0-100
    label: str                    # "High" | "Good" | "Moderate" | "Low" | "Speculative"
    factors: dict[str, float]     # normalized 0-1 inputs, for the "Why" sheet
    limiting_factor: str          # the factor dragging trust down the most

    def to_dict(self) -> dict:
        return {
            "score": self.score,
            "label": self.label,
            "factors": self.factors,
            "limiting_factor": self.limiting_factor,
        }


def _freshness(buoy_age_hours: float | None, is_nowcast: bool) -> float | None:
    """Data-freshness factor (0-1). None when no buoy is associated at all."""
    if buoy_age_hours is None:
        return None
    if buoy_age_hours <= BUOY_FRESH_HOURS:
        base = 1.0
    elif buoy_age_hours >= BUOY_STALE_HOURS:
        base = 0.3
    else:
        # Linear decay between fresh and stale
        span = BUOY_STALE_HOURS - BUOY_FRESH_HOURS
        base = 1.0 - 0.7 * (buoy_age_hours - BUOY_FRESH_HOURS) / span
    # A hour actually influenced by the live reading earns full credit.
    return 1.0 if is_nowcast else base


def _lead_decay(lead_hours: float) -> float:
    return max(LEAD_DECAY_FLOOR, math.exp(-max(0.0, lead_hours) / LEAD_DECAY_TAU_HOURS))


def _label(score: float) -> str:
    if score >= 80:
        return "High"
    if score >= 60:
        return "Good"
    if score >= 40:
        return "Moderate"
    if score >= 20:
        return "Low"
    return "Speculative"


def compute_trust(
    *,
    lead_hours: float,
    model_agreement: float | None = None,
    confidence: float | None = None,
    buoy_age_hours: float | None = None,
    is_nowcast: bool = False,
    historical_skill: float | None = None,
    ensemble: bool = False,
) -> TrustResult:
    """
    Compute a 0-100 Trust Score from the per-hour forecast signals.

    Factors are weighted only when available, then renormalized — so a single
    missing signal (e.g. no buoy) shifts weight to the others rather than
    silently scoring 0.
    """
    # Resolve agreement: measured in ensemble mode, neutral otherwise.
    agreement = model_agreement
    if agreement is None:
        agreement = None if ensemble else SINGLE_MODEL_AGREEMENT

    lead = _lead_decay(lead_hours)
    fresh = _freshness(buoy_age_hours, is_nowcast)

    # (name, value, weight) — only include factors we actually have.
    candidates: list[tuple[str, float, float]] = [("lead", lead, 0.25)]
    if agreement is not None:
        candidates.append(("agreement", max(0.0, min(1.0, agreement)), 0.30))
    if confidence is not None:
        candidates.append(("confidence", max(0.0, min(1.0, confidence)), 0.30))
    if fresh is not None:
        candidates.append(("freshness", fresh, 0.15))
    if historical_skill is not None:
        candidates.append(("historical_skill", max(0.0, min(1.0, historical_skill)), 0.35))

    total_w = sum(w for _, _, w in candidates)
    blended = sum(v * w for _, v, w in candidates) / total_w if total_w else 0.0

    factors = {name: round(v, 3) for name, v, _ in candidates}
    # The factor furthest below 1.0 is what's holding trust back.
    limiting = min(candidates, key=lambda c: c[1])[0] if candidates else "unknown"

    score = round(blended * 100.0, 1)
    return TrustResult(
        score=score,
        label=_label(score),
        factors=factors,
        limiting_factor=limiting,
    )


def summarize_trust(scores: list[float | None], limiting_factors: list[str]) -> dict:
    """Roll per-hour trust over an actionable window into a headline summary.

    Returns the mean trust and the most common limiting factor across the window.
    """
    vals = [s for s in scores if s is not None]
    if not vals:
        return {"score": None, "label": "unknown", "limiting_factor": "no_data"}
    mean = round(sum(vals) / len(vals), 1)
    # Most frequent limiting factor over the window
    counts: dict[str, int] = {}
    for f in limiting_factors:
        counts[f] = counts.get(f, 0) + 1
    limiting = max(counts, key=counts.get) if counts else "unknown"
    return {"score": mean, "label": _label(mean), "limiting_factor": limiting}
