#!/usr/bin/env python3
"""
Build the global KoastCast spot dataset.

Sources:
  1. data/spots.json            — the 140 hand-curated US spots (rich metadata:
                                   optimal swell/wind direction, buoy IDs, break type).
                                   These are AUTHORITATIVE and always win.
  2. OpenStreetMap (sport=surfing, named) via Overpass — thousands of global
                                   surf breaks with name + coordinates.

OSM spots get country + region from offline reverse geocoding (reverse_geocoder),
a derived break_type, and a slug. They carry no tuned optimal-condition metadata,
so they score via the physics fallback + Open-Meteo forecast at their coordinates
(works anywhere on Earth) — honest, lower-confidence forecasts everywhere, full
Peak Score™ for the curated spots.

Usage:
  python scripts/build_spots_dataset.py            # uses cached /tmp/osm_surf.json if present
  python scripts/build_spots_dataset.py --fetch    # re-fetch from Overpass
  python scripts/build_spots_dataset.py --out data/spots.json  # overwrite (default: data/spots.global.json)

Re-run anytime to refresh. Curated spots are merged from the existing data/spots.json,
so overwriting it is safe (idempotent).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CURATED = ROOT / "data" / "spots.json"
OSM_CACHE = Path("/tmp/osm_surf.json")

OVERPASS = "https://overpass-api.de/api/interpreter"
OVERPASS_QUERY = """[out:json][timeout:180];
(
  node["sport"="surfing"]["name"];
  way["sport"="surfing"]["name"];
  relation["sport"="surfing"]["name"];
  node["surfing"="yes"]["name"];
  way["surfing"="yes"]["name"];
);
out center tags;"""

VALID_BREAK_TYPES = {"beach", "reef", "point", "rivermouth", "jetty"}

# Rough timezone by continent/longitude — only used as a tide-station fallback hint;
# the forecast itself is coordinate-driven so this is non-critical.
def _tz_for(lat: float, lng: float, cc: str) -> str:
    if cc == "US":
        if lng < -115: return "America/Los_Angeles"
        if lng < -100: return "America/Denver"
        if lng < -87: return "America/Chicago"
        return "America/New_York"
    if -170 < lng < -30: return "America/Los_Angeles" if lng < -100 else "America/New_York"
    if -30 <= lng < 45: return "Europe/Lisbon" if lng < 5 else "Europe/Paris"
    if 45 <= lng < 90: return "Asia/Karachi"
    if 90 <= lng < 140: return "Asia/Jakarta"
    return "Pacific/Auckland"


def fetch_osm() -> dict:
    req = urllib.request.Request(OVERPASS, data=OVERPASS_QUERY.encode(),
                                 headers={"User-Agent": "koastcast-ingest"})
    with urllib.request.urlopen(req, timeout=180) as r:
        return json.load(r)


def slugify(name: str, cc: str, idx: int) -> str:
    base = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    base = base[:48] or "spot"
    return f"{base}-{cc.lower()}-{idx}"


def break_type_from_tags(tags: dict) -> str:
    natural = (tags.get("natural") or "").lower()
    if natural == "reef":
        return "reef"
    if "point" in (tags.get("name", "").lower()):
        return "point"
    if natural == "beach":
        return "beach"
    return "beach"


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    r = 6371.0
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dphi = math.radians(b[0] - a[0]); dl = math.radians(b[1] - a[1])
    h = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fetch", action="store_true", help="Re-fetch from Overpass")
    ap.add_argument("--out", default=str(ROOT / "data" / "spots.global.json"))
    args = ap.parse_args()

    # 1. OSM elements
    if args.fetch or not OSM_CACHE.exists():
        print("Fetching from Overpass…")
        data = fetch_osm()
        OSM_CACHE.write_text(json.dumps(data))
    else:
        data = json.loads(OSM_CACHE.read_text())
    elements = data.get("elements", [])
    print(f"OSM elements: {len(elements)}")

    # 2. Curated spots (authoritative)
    curated = json.loads(CURATED.read_text())
    curated_coords = [(s["lat"], s["lng"]) for s in curated]
    print(f"Curated spots: {len(curated)}")

    # 3. Geocode OSM points offline (batch)
    import reverse_geocoder as rg  # noqa: E402
    points = []
    parsed = []
    for el in elements:
        if el["type"] == "node":
            lat, lng = el.get("lat"), el.get("lon")
        else:
            c = el.get("center") or {}
            lat, lng = c.get("lat"), c.get("lon")
        name = (el.get("tags") or {}).get("name")
        if lat is None or lng is None or not name:
            continue
        parsed.append((lat, lng, name, el.get("tags") or {}))
        points.append((lat, lng))
    geo = rg.search(points) if points else []

    # 4. Build, dedupe vs curated (skip OSM spot within 1.5 km of a curated one)
    seen_slugs = {s["slug"] for s in curated}
    added = []
    for i, (lat, lng, name, tags) in enumerate(parsed):
        if any(haversine_km((lat, lng), cc) < 1.5 for cc in curated_coords):
            continue
        g = geo[i] if i < len(geo) else {}
        cc = g.get("cc", "") or "INT"
        region = g.get("admin1") or g.get("admin2") or _continent(lat, lng)
        slug = slugify(name, cc, i)
        if slug in seen_slugs:
            continue
        seen_slugs.add(slug)
        added.append({
            "name": name,
            "slug": slug,
            "lat": round(lat, 5),
            "lng": round(lng, 5),
            "region": region,
            "country": cc,
            "break_type": break_type_from_tags(tags),
            "swan_enabled": False,
            "timezone": _tz_for(lat, lng, cc),
            "source": "osm",
        })

    merged = curated + added
    Path(args.out).write_text(json.dumps(merged, indent=1))
    print(f"Wrote {len(merged)} spots ({len(curated)} curated + {len(added)} OSM) → {args.out}")
    return 0


def _continent(lat: float, lng: float) -> str:
    if lng < -30:
        return "North America" if lat > 12 else "South America"
    if lng < 40:
        return "Europe" if lat > 35 else "Africa"
    if lng < 100:
        return "Asia" if lat > 5 else "Indian Ocean"
    return "Oceania" if lat < 25 else "Asia Pacific"


if __name__ == "__main__":
    sys.exit(main())
