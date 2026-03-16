"""
Gear Recommender

Given forecast conditions + a user's quiver, recommends:
  1. The best board for today's conditions
  2. The appropriate wetsuit thickness

Logic is based on well-established surf knowledge:
  - Board selection: wave height + period + user's volume/type
  - Wetsuit: water temperature (from buoy wtmp or Open-Meteo)

The recommendation is rule-based (no ML needed at this stage) —
the rules encode the same knowledge any experienced surfer uses
when standing in front of their quiver.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


BoardType = Literal["shortboard", "longboard", "fish", "funboard", "egg", "gun", "SUP", "bodyboard", "foil", "other"]


@dataclass
class BoardProfile:
    id: str
    name: str
    board_type: BoardType | str
    length_ft: float | None = None
    volume_L: float | None = None
    best_wave_min_ft: float | None = None
    best_wave_max_ft: float | None = None
    best_period_min_s: float | None = None


@dataclass
class WetsuitProfile:
    id: str
    name: str
    thickness: str        # e.g. "4/3", "3/2"
    temp_min_f: float | None = None
    temp_max_f: float | None = None
    booties: bool = False
    gloves: bool = False
    hood: bool = False


@dataclass
class GearRecommendation:
    board: BoardProfile | None
    board_reason: str
    wetsuit: WetsuitProfile | None
    wetsuit_reason: str
    water_temp_f: float | None
    conditions_summary: str  # "4ft @ 12s — good fish/shortboard day"


# ─── Wetsuit temperature chart ────────────────────────────────────────────────
# Standard thickness recommendations by water temperature (°F)
# Source: multiple wetsuit manufacturer guides

WETSUIT_THICKNESSES = [
    # (min_F, max_F, thickness, description)
    (0,   50,  "6/5/4",  "drysuit territory — maximum insulation + hood, gloves, booties"),
    (50,  55,  "5/4/3",  "thick winter suit + hood, gloves, 5mm booties essential"),
    (55,  60,  "4/3",    "winter suit + 3mm booties, gloves recommended"),
    (60,  65,  "3/2",    "full suit, booties optional depending on tolerance"),
    (65,  70,  "2/2",    "springsuit or thin full suit"),
    (70,  75,  "1mm",    "shorty or boardshorts + rashguard"),
    (75,  999, "boardshorts", "no wetsuit needed"),
]


def recommend_wetsuit_by_temp(water_temp_f: float) -> tuple[str, str]:
    """Returns (thickness, description) for given water temperature."""
    for min_t, max_t, thickness, desc in WETSUIT_THICKNESSES:
        if min_t <= water_temp_f < max_t:
            return thickness, desc
    return "boardshorts", "warm water — no wetsuit needed"


def _board_type_for_conditions(
    face_height_ft: float,
    period_s: float,
    skill_level: str = "intermediate",
) -> list[str]:
    """
    Return ordered list of preferred board types for given conditions.
    Most suitable first.
    """
    if face_height_ft < 1.5:
        return ["longboard", "funboard", "egg", "fish"]

    if face_height_ft < 3:
        if period_s < 8:
            return ["fish", "longboard", "funboard", "shortboard"]
        return ["fish", "shortboard", "egg", "funboard"]

    if face_height_ft < 5:
        if period_s >= 14:
            return ["shortboard", "fish", "gun"]
        if period_s >= 10:
            return ["shortboard", "fish"]
        return ["fish", "shortboard", "funboard"]

    if face_height_ft < 8:
        if skill_level in ("advanced", "pro"):
            return ["gun", "shortboard"]
        return ["gun"]

    # 8ft+
    return ["gun"]


def recommend_board(
    boards: list[BoardProfile],
    face_height_ft: float,
    period_s: float,
    skill_level: str = "intermediate",
) -> tuple[BoardProfile | None, str]:
    """
    Select the best board from a user's quiver for the given conditions.
    Returns (board, reason).
    """
    if not boards:
        return None, "Add boards to your quiver to get personalized recommendations"

    preferred_types = _board_type_for_conditions(face_height_ft, period_s, skill_level)

    # First: check if any board has explicit wave height range set and matches
    for board in boards:
        if board.best_wave_min_ft and board.best_wave_max_ft:
            if board.best_wave_min_ft <= face_height_ft <= board.best_wave_max_ft:
                return board, (
                    f"Your {board.name} is dialed in for this size — "
                    f"{board.best_wave_min_ft:.0f}–{board.best_wave_max_ft:.0f}ft range"
                )

    # Second: match by board type preference order
    for preferred_type in preferred_types:
        for board in boards:
            if board.board_type == preferred_type:
                type_reason = _type_reason(preferred_type, face_height_ft, period_s)
                return board, f"Your {board.name} ({board.board_type}) — {type_reason}"

    # Fallback: return the first active board
    board = boards[0]
    return board, f"Your {board.name} is your best available option today"


def _type_reason(board_type: str, height_ft: float, period_s: float) -> str:
    if board_type == "gun":
        return f"guns are built for this size ({height_ft:.0f}ft)"
    if board_type == "longboard":
        return "small surf — longboard maximizes wave count"
    if board_type == "fish":
        if period_s < 9:
            return "fish excels in short-period, weaker surf"
        return "fish generates speed in average conditions"
    if board_type == "shortboard":
        return f"conditions match shortboard sweet spot ({height_ft:.0f}ft @ {period_s:.0f}s)"
    if board_type in ("funboard", "egg"):
        return "all-round option for today's conditions"
    return "best available match for today"


def match_wetsuit_from_quiver(
    wetsuits: list[WetsuitProfile],
    water_temp_f: float,
) -> tuple[WetsuitProfile | None, str]:
    """
    Select the best wetsuit from user's quiver for given water temperature.
    Returns (wetsuit, reason).
    """
    if not wetsuits:
        ideal_thickness, ideal_desc = recommend_wetsuit_by_temp(water_temp_f)
        return None, f"Water is {water_temp_f:.0f}°F — you need a {ideal_thickness}. Add your wetsuits to your quiver."

    # Find best match by temperature range
    matches = []
    for ws in wetsuits:
        if ws.temp_min_f and ws.temp_max_f:
            if ws.temp_min_f <= water_temp_f <= ws.temp_max_f:
                matches.append(ws)

    if matches:
        # Prefer most specific match (tightest range)
        best = min(matches, key=lambda w: (w.temp_max_f or 100) - (w.temp_min_f or 0))
        return best, (
            f"{best.name} — rated for {best.temp_min_f:.0f}–{best.temp_max_f:.0f}°F, "
            f"water is {water_temp_f:.0f}°F"
        )

    # Fall back to generic thickness recommendation + warn
    ideal_thickness, _ = recommend_wetsuit_by_temp(water_temp_f)
    return None, (
        f"Water is {water_temp_f:.0f}°F — you need a {ideal_thickness}. "
        f"None of your saved wetsuits match — check your quiver."
    )


def build_gear_recommendation(
    boards: list[BoardProfile],
    wetsuits: list[WetsuitProfile],
    face_height_m: float | None,
    wave_period_s: float | None,
    water_temp_c: float | None,
    skill_level: str = "intermediate",
) -> GearRecommendation:
    """
    Build a complete gear recommendation from forecast conditions and user's quiver.
    """
    face_ft = (face_height_m or 0.9) * 3.28
    period = wave_period_s or 10.0
    water_temp_f = (water_temp_c * 9 / 5 + 32) if water_temp_c else None

    # Board recommendation
    board, board_reason = recommend_board(boards, face_ft, period, skill_level)

    # Wetsuit recommendation
    if water_temp_f is not None:
        wetsuit, wetsuit_reason = match_wetsuit_from_quiver(wetsuits, water_temp_f)
    else:
        # No water temp available — use generic thickness guidance
        wetsuit = None
        wetsuit_reason = "Water temperature data unavailable — check local buoy for current temps"

    # Conditions summary
    h_str = f"{face_ft:.0f}ft" if face_ft > 0 else "flat"
    conditions_summary = f"{h_str} @ {period:.0f}s"

    return GearRecommendation(
        board=board,
        board_reason=board_reason,
        wetsuit=wetsuit,
        wetsuit_reason=wetsuit_reason,
        water_temp_f=water_temp_f,
        conditions_summary=conditions_summary,
    )
