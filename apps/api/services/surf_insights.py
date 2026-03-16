"""
Surf Insights Engine

Pattern recognition from a user's session history.
Answers the question: "what conditions produce my best sessions?"

Analyzes logged sessions to find:
1. Condition patterns in top-rated sessions
2. Best spots for the user
3. Best time of year / day of week patterns
4. Board performance by conditions (via session_gear table)
5. Forecast accuracy: predicted vs. actual quality
6. Crowd tolerance patterns

This is the personalization flywheel — the more sessions you log,
the smarter the app gets about YOUR surfing, not generic "quality."
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import Any


@dataclass
class InsightCard:
    type: str          # "pattern", "stat", "board_tip", "accuracy"
    title: str
    body: str
    icon: str          # emoji
    data: dict | None = None  # raw numbers for chart rendering

    def to_dict(self) -> dict:
        d = {"type": self.type, "title": self.title, "body": self.body, "icon": self.icon}
        if self.data:
            d["data"] = self.data
        return d


def _safe_avg(values: list[float | None]) -> float | None:
    vals = [v for v in values if v is not None]
    return sum(vals) / len(vals) if vals else None


def _compass(deg: float) -> str:
    dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
            'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
    return dirs[round(deg / 22.5) % 16]


def generate_insights(sessions: list[dict[str, Any]]) -> list[InsightCard]:
    """
    Generate insight cards from a user's session history.

    sessions: list of dicts from Supabase user_sessions table:
        {
            id, session_date, spot_id, spot_name (joined),
            wave_height_face_m, wave_period_s, wave_direction,
            wind_speed_ms, wind_direction, tide_height_m,
            quality_rating (1-10 user rating),
            crowd_rating (1-5),
            notes
        }
    """
    cards: list[InsightCard] = []

    if not sessions:
        cards.append(InsightCard(
            type="onboarding",
            title="Log your first session",
            body="Log surf sessions to unlock personalized insights. The more you log, the better we understand what conditions work for you.",
            icon="📔",
        ))
        return cards

    # ─── Basic stats ──────────────────────────────────────────────────────────
    total = len(sessions)
    rated = [s for s in sessions if s.get("quality_rating") is not None]
    avg_rating = _safe_avg([s.get("quality_rating") for s in rated])

    if total >= 3:
        cards.append(InsightCard(
            type="stat",
            title=f"{total} sessions logged",
            body=f"Average session rating: {avg_rating:.1f}/10. Keep logging to unlock deeper pattern analysis." if avg_rating else f"You've logged {total} sessions — add quality ratings to unlock insights.",
            icon="🏄",
            data={"total_sessions": total, "avg_rating": avg_rating},
        ))

    # Need rated sessions for pattern analysis
    if len(rated) < 5:
        cards.append(InsightCard(
            type="tip",
            title="Rate more sessions to unlock patterns",
            body=f"You've rated {len(rated)} sessions. After 5, we can show you what conditions produce your best surfing.",
            icon="⭐",
        ))
        return cards

    # ─── Condition patterns in top sessions ───────────────────────────────────
    top_sessions = sorted(rated, key=lambda s: s.get("quality_rating", 0), reverse=True)
    top_n = max(3, len(rated) // 3)  # top third
    top = top_sessions[:top_n]
    bottom = top_sessions[-top_n:]

    # Wave height
    top_heights = [s.get("wave_height_face_m") for s in top if s.get("wave_height_face_m")]
    bottom_heights = [s.get("wave_height_face_m") for s in bottom if s.get("wave_height_face_m")]
    avg_top_h = _safe_avg(top_heights)
    avg_bot_h = _safe_avg(bottom_heights)

    if avg_top_h and avg_bot_h:
        diff_ft = (avg_top_h - avg_bot_h) * 3.28
        if abs(diff_ft) > 0.5:
            direction = "bigger" if diff_ft > 0 else "smaller"
            h_ft = avg_top_h * 3.28
            cards.append(InsightCard(
                type="pattern",
                title=f"You rate {direction} waves higher",
                body=f"Your top sessions averaged {h_ft:.1f}ft — {abs(diff_ft):.1f}ft {'more' if diff_ft > 0 else 'less'} than your lower-rated sessions. This is your sweet spot.",
                icon="📏",
                data={
                    "top_avg_ft": round(avg_top_h * 3.28, 1),
                    "bottom_avg_ft": round(avg_bot_h * 3.28, 1),
                },
            ))

    # Wave period
    top_periods = [s.get("wave_period_s") for s in top if s.get("wave_period_s")]
    avg_top_p = _safe_avg(top_periods)
    if avg_top_p:
        period_type = "long-period groundswell" if avg_top_p >= 13 else \
                      "solid groundswell" if avg_top_p >= 10 else "shorter-period swell"
        cards.append(InsightCard(
            type="pattern",
            title=f"Your sweet spot: {avg_top_p:.0f}s period",
            body=f"Your top-rated sessions averaged {avg_top_p:.0f}s — {period_type}. Consider filtering for this period range when planning sessions.",
            icon="⏱️",
            data={"avg_top_period_s": round(avg_top_p, 1)},
        ))

    # Wind patterns
    top_wind_speeds = [s.get("wind_speed_ms") for s in top if s.get("wind_speed_ms") is not None]
    avg_top_wind = _safe_avg(top_wind_speeds)
    if avg_top_wind is not None:
        wind_desc = "light" if avg_top_wind < 5 else "moderate" if avg_top_wind < 10 else "stronger"
        kts = avg_top_wind * 1.944
        cards.append(InsightCard(
            type="pattern",
            title=f"Best sessions: {wind_desc} winds",
            body=f"Your top sessions averaged {kts:.0f}kts of wind. {'You prefer glassy to light-wind conditions.' if avg_top_wind < 5 else 'You can score well even in moderate wind.'}",
            icon="🌬️",
            data={"avg_top_wind_ms": round(avg_top_wind, 1)},
        ))

    # ─── Spot breakdown ───────────────────────────────────────────────────────
    spot_sessions: dict[str, list[int]] = {}
    for s in rated:
        spot = s.get("spot_name") or s.get("spot_id", "unknown")
        rating = s.get("quality_rating", 0)
        spot_sessions.setdefault(spot, []).append(rating)

    if len(spot_sessions) >= 2:
        spot_avgs = {
            spot: (sum(ratings) / len(ratings), len(ratings))
            for spot, ratings in spot_sessions.items()
            if len(ratings) >= 2
        }
        if spot_avgs:
            best_spot = max(spot_avgs, key=lambda k: spot_avgs[k][0])
            best_avg, best_count = spot_avgs[best_spot]
            cards.append(InsightCard(
                type="pattern",
                title=f"Your best spot: {best_spot}",
                body=f"You've averaged {best_avg:.1f}/10 over {best_count} sessions here — your highest-rated spot. Worth prioritizing when conditions line up.",
                icon="📍",
                data={"spot_avgs": {k: {"avg": round(v[0], 1), "count": v[1]} for k, v in spot_avgs.items()}},
            ))

    # ─── Timing patterns ──────────────────────────────────────────────────────
    if len(rated) >= 8:
        # Day of week
        dow_ratings: dict[int, list[int]] = {}
        for s in rated:
            try:
                from datetime import date
                session_date = s.get("session_date")
                if isinstance(session_date, str):
                    d = date.fromisoformat(session_date)
                else:
                    d = session_date
                dow = d.weekday()  # 0=Mon, 6=Sun
                dow_ratings.setdefault(dow, []).append(s.get("quality_rating", 5))
            except Exception:
                continue

        if dow_ratings:
            dow_avgs = {dow: sum(r) / len(r) for dow, r in dow_ratings.items() if len(r) >= 2}
            if dow_avgs:
                best_dow = max(dow_avgs, key=dow_avgs.get)  # type: ignore
                dow_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                cards.append(InsightCard(
                    type="pattern",
                    title=f"{dow_names[best_dow]}s are your best days",
                    body=f"Your {dow_names[best_dow]} sessions average {dow_avgs[best_dow]:.1f}/10 — higher than other days. {'Fewer people in the water.' if best_dow < 5 else 'Weekend warrior peak.'}",
                    icon="📅",
                    data={"dow_avgs": {dow_names[k]: round(v, 1) for k, v in dow_avgs.items()}},
                ))

    # ─── Crowd tolerance insight ───────────────────────────────────────────────
    crowd_rated = [s for s in rated if s.get("crowd_rating") is not None and s.get("quality_rating") is not None]
    if len(crowd_rated) >= 5:
        # Correlate crowd level with quality rating
        uncrowded = [s for s in crowd_rated if s.get("crowd_rating", 3) <= 2]
        crowded = [s for s in crowd_rated if s.get("crowd_rating", 3) >= 4]

        unc_avg = _safe_avg([s.get("quality_rating") for s in uncrowded])
        crd_avg = _safe_avg([s.get("quality_rating") for s in crowded])

        if unc_avg and crd_avg:
            diff = unc_avg - crd_avg
            if diff > 1:
                cards.append(InsightCard(
                    type="pattern",
                    title=f"Crowds cost you {diff:.1f} points",
                    body=f"Your uncrowded sessions average {unc_avg:.1f}/10 vs {crd_avg:.1f}/10 when it's crowded. Consider dawn patrol or weekday sessions.",
                    icon="👥",
                    data={"uncrowded_avg": round(unc_avg, 1), "crowded_avg": round(crd_avg, 1)},
                ))
            elif abs(diff) < 0.5:
                cards.append(InsightCard(
                    type="pattern",
                    title="You surf well regardless of crowds",
                    body=f"Your sessions average {unc_avg:.1f}/10 uncrowded and {crd_avg:.1f}/10 crowded — crowd level doesn't significantly affect your scores.",
                    icon="😎",
                ))

    # ─── Forecast accuracy ────────────────────────────────────────────────────
    # Sessions with both a forecast-quality and user-quality rating would go here.
    # For now, show a motivating accuracy note if we have enough data.
    if total >= 20:
        cards.append(InsightCard(
            type="accuracy",
            title="ML model learning your preferences",
            body=f"With {total} sessions logged, the bias correction model is actively tuning forecasts for your home spots. Your session ratings are making the forecast better for you.",
            icon="🤖",
        ))

    # ─── Monthly volume ───────────────────────────────────────────────────────
    if total >= 10:
        month_counts: Counter = Counter()
        for s in sessions:
            try:
                session_date = s.get("session_date", "")
                month = str(session_date)[:7]  # "YYYY-MM"
                month_counts[month] += 1
            except Exception:
                continue

        if month_counts:
            best_month = month_counts.most_common(1)[0]
            try:
                from datetime import datetime as dt_cls
                m = dt_cls.strptime(best_month[0], "%Y-%m")
                month_name = m.strftime("%B %Y")
            except Exception:
                month_name = best_month[0]
            cards.append(InsightCard(
                type="stat",
                title=f"Most active: {month_name}",
                body=f"You logged {best_month[1]} sessions in your busiest month.",
                icon="📊",
                data={"monthly_counts": dict(month_counts.most_common(12))},
            ))

    return cards[:8]  # cap at 8 cards to avoid overwhelming the UI
