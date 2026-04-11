"""
Safety & Hazards Layer

Aggregates safety-relevant data for a surf spot:
  - Post-rain water quality warning (72h rule after rainfall)
  - NWS rip current risk (from NOAA Weather API)
  - High surf advisory (NWS)
  - Spot-specific static hazard notes (reef depth, rocks, rip channels, etc.)

Zero other surf apps integrate this data. It's publicly available, free, and
surfers actively want it — especially post-rain bacterial contamination warnings.
"""
from __future__ import annotations

import asyncio
import hashlib
import time
from dataclasses import dataclass, field
from typing import Literal

import httpx
import structlog

from models.schemas import Spot

logger = structlog.get_logger(__name__)

RiskLevel = Literal["low", "moderate", "high", "extreme", "unknown"]

# ─── NWS Grid helpers ─────────────────────────────────────────────────────────

# Cache NWS grid lookups (lat/lng → grid endpoint) to avoid repeated requests
_grid_cache: dict[str, tuple[str, float]] = {}  # key → (url, expires_at)
_GRID_TTL = 86400  # 24h

# ─── Static spot hazard notes ─────────────────────────────────────────────────
# Community-sourced static hazards per spot. In a full system these would come
# from the database and be editable by trusted contributors.

SPOT_HAZARDS: dict[str, list[str]] = {
    "mavericks-ca": [
        "Deep-water big-wave reef — not accessible to recreational surfers",
        "Strong rip current channels flank the main peak",
        "Cold water: 50–58°F year-round, hypothermia risk without proper wetsuit",
        "Rocks and boulders at the channel entry (Mushroom Rock)",
    ],
    "steamer-lane-ca": [
        "Rocky cliff entry/exit at The Hook — slippery in swell",
        "Submerged rocks at lower tides on inside section",
        "Strong rip current on the north side of the main point",
        "Sea otters and sea lions in lineup — give them space",
    ],
    "ocean-beach-sf-ca": [
        "One of the most dangerous beaches in California — strong rip currents",
        "No lifeguards on duty — beach often closes in large surf",
        "Fast-moving riptides especially near the Kelly's Cove section",
        "Cold water (52–58°F) requires a minimum 4/3mm wetsuit + booties",
        "Frequently closed after heavy rain due to storm drain runoff",
    ],
    "rincon-ca": [
        "Shallow cobblestone reef on lower tides — booties recommended",
        "Point break entry via channel — watch for sets on the paddle-out",
        "Very popular break — high crowd levels degrade safety in larger surf",
    ],
    "lower-trestles-ca": [
        "Multi-peak reef/sandbar — know which peak you're paddling to",
        "Heavy shore pound at low tide",
        "Long paddle from parking to beach — allow for conditions changing",
    ],
    "blacks-beach-ca": [
        "Steep hike down the cliff face required — assess your fitness",
        "No lifeguards on duty at this beach",
        "Shark sightings are not uncommon in this area (La Jolla submarine canyon)",
        "Nudist beach — clothing optional at this location",
    ],
    "pipeline-oahu-hi": [
        "Extremely shallow reef — 2-4ft of water over the shelf",
        "One of the most dangerous waves in the world — expert surfers only",
        "Backdoor section breaks directly over reef — heavy hold-downs",
        "Strong currents during large NW swells",
    ],
    "sebastian-inlet-fl": [
        "Strong current through the inlet — can pull surfers onto the jetty rocks",
        "Third Peak is closest to the rocks — stay aware of your positioning",
        "Shark activity is common (inlet draws baitfish)",
        "Boat traffic in the inlet channel — stay in designated surf zones",
    ],
    "cape-hatteras-nc": [
        "Diamond Shoals and shifting sandbars create unpredictable currents",
        "Rip currents are extremely strong and common",
        "Remote location — emergency response times are long",
        "Water quality sometimes impacted after storms",
    ],
    "montauk-ny": [
        "Rocky bottom at The Point — watch for exposed rocks at low tide",
        "Shark activity in late summer/fall — white sharks migrate through this area",
        "Cold water in spring (46–52°F) — full suit, hood, and gloves required",
    ],
}

# ─── Hazard data models ───────────────────────────────────────────────────────

@dataclass
class WaterQualityStatus:
    safe: bool
    reason: str
    advisory: str | None = None
    post_rain_hours: float | None = None  # hours since last significant rainfall


@dataclass
class RipCurrentStatus:
    risk_level: RiskLevel
    description: str
    source: str = "NWS"


@dataclass
class SurfAdvisory:
    active: bool
    type: str  # "high_surf", "beach_hazard", "coastal_flood"
    headline: str | None = None
    description: str | None = None


@dataclass
class SafetyReport:
    spot_slug: str
    water_quality: WaterQualityStatus
    rip_current: RipCurrentStatus
    surf_advisory: SurfAdvisory | None
    static_hazards: list[str]
    overall_risk: RiskLevel
    generated_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict:
        return {
            "spot_slug": self.spot_slug,
            "water_quality": {
                "safe": self.water_quality.safe,
                "reason": self.water_quality.reason,
                "advisory": self.water_quality.advisory,
                "post_rain_hours": self.water_quality.post_rain_hours,
            },
            "rip_current": {
                "risk_level": self.rip_current.risk_level,
                "description": self.rip_current.description,
                "source": self.rip_current.source,
            },
            "surf_advisory": {
                "active": self.surf_advisory.active,
                "type": self.surf_advisory.type,
                "headline": self.surf_advisory.headline,
                "description": self.surf_advisory.description,
            } if self.surf_advisory else None,
            "static_hazards": self.static_hazards,
            "overall_risk": self.overall_risk,
            "generated_at": self.generated_at,
        }


# ─── Report cache ─────────────────────────────────────────────────────────────
_report_cache: dict[str, tuple[SafetyReport, float]] = {}
_CACHE_TTL = 3600  # 1 hour


# ─── Water quality: post-rain rule ───────────────────────────────────────────

async def _check_water_quality(lat: float, lng: float) -> WaterQualityStatus:
    """
    Checks for recent significant rainfall using Open-Meteo precipitation data.
    Uses the 72-hour rule: avoid surfing for 72h after >10mm rainfall,
    especially near river mouths and storm drains.

    This is a practical approximation of the bacterial contamination risk
    documented in the Surfrider Foundation's annual Clean Water Reports.
    """
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lng,
            "hourly": "precipitation",
            "past_days": 3,
            "forecast_days": 1,
            "timezone": "UTC",
        }
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()

        hourly = data.get("hourly", {})
        times = hourly.get("time", [])
        precip = hourly.get("precipitation", [])

        # Find hours with significant rainfall in past 72h
        from datetime import datetime, timezone, timedelta
        now = datetime.now(timezone.utc)
        cutoff = now - timedelta(hours=72)

        significant_rain_hours = []
        for t_str, p in zip(times, precip):
            if p is None or p < 1.0:  # < 1mm/h not significant
                continue
            t = datetime.fromisoformat(t_str).replace(tzinfo=timezone.utc)
            if t >= cutoff:
                significant_rain_hours.append((t, p))

        if not significant_rain_hours:
            return WaterQualityStatus(
                safe=True,
                reason="No significant rainfall in the past 72 hours"
            )

        # Find most recent significant rain
        most_recent = max(significant_rain_hours, key=lambda x: x[0])
        hours_ago = (now - most_recent[0]).total_seconds() / 3600

        if hours_ago < 72:
            total_mm = sum(p for _, p in significant_rain_hours)
            return WaterQualityStatus(
                safe=False,
                reason=f"Significant rainfall {hours_ago:.0f}h ago ({total_mm:.0f}mm total in 72h window)",
                advisory="Avoid surfing for 72 hours after heavy rain — elevated bacterial contamination risk near storm drains and river mouths",
                post_rain_hours=hours_ago,
            )

        return WaterQualityStatus(safe=True, reason="Rainfall over 72 hours ago — risk subsiding")

    except Exception as exc:
        logger.warning("Water quality check failed", error=str(exc))
        return WaterQualityStatus(safe=True, reason="Water quality data unavailable")


# ─── NWS rip current & surf advisory ─────────────────────────────────────────

async def _get_nws_grid_url(lat: float, lng: float) -> str | None:
    """Get the NWS forecast grid URL for a lat/lng point."""
    cache_key = f"{lat:.3f},{lng:.3f}"
    if cache_key in _grid_cache:
        url, expires = _grid_cache[cache_key]
        if time.time() < expires:
            return url

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.weather.gov/points/{lat},{lng}",
                headers={"User-Agent": "Peakcast/1.0 (peakcast.app)"},
            )
            if resp.status_code != 200:
                return None
            data = resp.json()
            url = data.get("properties", {}).get("forecastZone")
            if url:
                _grid_cache[cache_key] = (url, time.time() + _GRID_TTL)
                return url
    except Exception as exc:
        logger.warning("NWS grid lookup failed", error=str(exc))
    return None


async def _get_nws_alerts(lat: float, lng: float) -> tuple[RipCurrentStatus, SurfAdvisory | None]:
    """
    Fetch NWS active alerts for the area.
    Returns rip current risk level and any active surf advisories.
    """
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"https://api.weather.gov/alerts/active?point={lat},{lng}&status=actual",
                headers={"User-Agent": "Peakcast/1.0 (peakcast.app)"},
            )
            if resp.status_code != 200:
                return _default_rip(), None

            data = resp.json()
            features = data.get("features", [])

        rip_risk: RipCurrentStatus = _default_rip()
        surf_advisory: SurfAdvisory | None = None

        for feature in features:
            props = feature.get("properties", {})
            event = props.get("event", "").lower()
            headline = props.get("headline", "")
            desc = props.get("description", "")

            # Rip current statements
            if "rip current" in event:
                if "high" in event or "dangerous" in desc.lower():
                    rip_risk = RipCurrentStatus(
                        risk_level="high",
                        description=headline or "Dangerous rip currents — high risk",
                    )
                elif "moderate" in event or "moderate" in desc.lower():
                    rip_risk = RipCurrentStatus(
                        risk_level="moderate",
                        description=headline or "Moderate rip current risk",
                    )
                else:
                    rip_risk = RipCurrentStatus(
                        risk_level="moderate",
                        description=headline or "Rip current advisory in effect",
                    )

            # High surf advisories / warnings
            elif any(k in event for k in ("high surf", "beach hazard", "coastal flood")):
                alert_type = "high_surf" if "surf" in event else \
                             "beach_hazard" if "beach" in event else "coastal_flood"
                surf_advisory = SurfAdvisory(
                    active=True,
                    type=alert_type,
                    headline=headline,
                    description=desc[:400] if desc else None,
                )

        return rip_risk, surf_advisory

    except Exception as exc:
        logger.warning("NWS alerts fetch failed", error=str(exc))
        return _default_rip(), None


def _default_rip() -> RipCurrentStatus:
    return RipCurrentStatus(
        risk_level="unknown",
        description="Rip current data unavailable — always assess conditions before entering water",
        source="Peakcast",
    )


# ─── Overall risk aggregation ─────────────────────────────────────────────────

def _compute_overall_risk(
    water_quality: WaterQualityStatus,
    rip: RipCurrentStatus,
    surf_adv: SurfAdvisory | None,
    has_static_hazards: bool,
) -> RiskLevel:
    score = 0

    if not water_quality.safe:
        score += 2

    if rip.risk_level == "extreme":
        score += 3
    elif rip.risk_level == "high":
        score += 2
    elif rip.risk_level == "moderate":
        score += 1

    if surf_adv and surf_adv.active:
        score += 2

    if has_static_hazards:
        score += 1

    if score >= 5:
        return "extreme"
    if score >= 3:
        return "high"
    if score >= 2:
        return "moderate"
    if score >= 1:
        return "low"
    return "low"


# ─── Public API ───────────────────────────────────────────────────────────────

async def get_safety_report(spot: Spot) -> SafetyReport:
    """
    Build a complete safety report for a surf spot.
    Results are cached for 1 hour.
    """
    cache_key = spot.slug
    if cache_key in _report_cache:
        report, expires = _report_cache[cache_key]
        if time.time() < expires:
            return report

    # Run water quality + NWS alerts in parallel
    water_quality, (rip_risk, surf_advisory) = await asyncio.gather(
        _check_water_quality(spot.lat, spot.lng),
        _get_nws_alerts(spot.lat, spot.lng),
    )

    static_hazards = SPOT_HAZARDS.get(spot.slug, [])
    overall_risk = _compute_overall_risk(
        water_quality, rip_risk, surf_advisory, bool(static_hazards)
    )

    report = SafetyReport(
        spot_slug=spot.slug,
        water_quality=water_quality,
        rip_current=rip_risk,
        surf_advisory=surf_advisory,
        static_hazards=static_hazards,
        overall_risk=overall_risk,
    )

    _report_cache[cache_key] = (report, time.time() + _CACHE_TTL)
    return report
