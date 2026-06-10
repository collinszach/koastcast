"""
Tide-station selection.

Replaces the old behaviour where any spot without a hardcoded entry fell back to
one of three regional stations by timezone (so a Maine break got San Francisco
tides). Instead we pick the nearest NOAA CO-OPS reference station by great-circle
distance.

This is a curated list of CO-OPS *reference* (harmonic) stations spanning the US
coastlines — not exhaustive, but enough that every spot resolves to a station
within a sensible distance. To go fully comprehensive, replace CURATED_STATIONS
with the full CO-OPS station metadata
(https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions).
"""
from __future__ import annotations

import math

# (station_id, name, lat, lon) — curated CO-OPS tide-prediction reference stations.
CURATED_STATIONS: list[tuple[str, str, float, float]] = [
    # ── US West Coast ──────────────────────────────────────────────
    ("9447130", "Seattle, WA",            47.6026, -122.3393),
    ("9444900", "Port Townsend, WA",      48.1129, -122.7595),
    ("9435380", "South Beach, OR",        44.6253, -124.0448),
    ("9432780", "Charleston, OR",         43.3450, -124.3220),
    ("9418767", "Humboldt Bay, CA",       40.7669, -124.2169),
    ("9416841", "Arena Cove, CA",         38.9146, -123.7110),
    ("9415020", "Point Reyes, CA",        37.9942, -122.9736),
    ("9414290", "San Francisco, CA",      37.8063, -122.4659),
    ("9413450", "Monterey, CA",           36.6050, -121.8881),
    ("9412110", "Port San Luis, CA",      35.1769, -120.7603),
    ("9411340", "Santa Barbara, CA",      34.4083, -119.6853),
    ("9410840", "Santa Monica, CA",       34.0083, -118.5000),
    ("9410660", "Los Angeles, CA",        33.7197, -118.2722),
    ("9410230", "La Jolla, CA",           32.8669, -117.2571),
    ("9410170", "San Diego, CA",          32.7142, -117.1736),
    # ── Hawaii ─────────────────────────────────────────────────────
    ("1611400", "Nawiliwili, Kauai HI",   21.9544, -159.3561),
    ("1612340", "Honolulu, Oahu HI",      21.3033, -157.8670),
    ("1612480", "Mokuoloe, Oahu HI",      21.4331, -157.7900),
    ("1615680", "Kahului, Maui HI",       20.8950, -156.4692),
    ("1617433", "Kawaihae, Hawaii HI",    20.0366, -155.8294),
    ("1617760", "Hilo, Hawaii HI",        19.7303, -155.0556),
    # ── Gulf of Mexico ─────────────────────────────────────────────
    ("8779770", "Port Isabel, TX",        26.0611, -97.2156),
    ("8771450", "Galveston, TX",          29.3100, -94.7933),
    ("8761724", "Grand Isle, LA",         29.2633, -89.9567),
    ("8729840", "Pensacola, FL",          30.4044, -87.2112),
    ("8726520", "St. Petersburg, FL",     27.7606, -82.6269),
    ("8725110", "Naples, FL",             26.1317, -81.8075),
    # ── US East Coast (South → North) ──────────────────────────────
    ("8723214", "Virginia Key, FL",       25.7314, -80.1617),
    ("8721604", "Trident Pier, FL",       28.4158, -80.5931),
    ("8720218", "Mayport, FL",            30.3967, -81.4297),
    ("8670870", "Fort Pulaski, GA",       32.0367, -80.9017),
    ("8665530", "Charleston, SC",         32.7806, -79.9233),
    ("8658120", "Wilmington, NC",         34.2275, -77.9536),
    ("8656483", "Beaufort, NC",           34.7200, -76.6700),
    ("8654400", "Cape Hatteras, NC",      35.2089, -75.7042),
    ("8638610", "Sewells Point, VA",      36.9467, -76.3300),
    ("8594900", "Washington, DC",         38.8733, -77.0217),
    ("8534720", "Atlantic City, NJ",      39.3550, -74.4183),
    ("8531680", "Sandy Hook, NJ",         40.4669, -74.0094),
    ("8518750", "The Battery, NY",        40.7006, -74.0142),
    ("8510560", "Montauk, NY",            41.0483, -71.9600),
    ("8447930", "Woods Hole, MA",         41.5236, -70.6711),
    ("8443970", "Boston, MA",             42.3539, -71.0503),
    ("8418150", "Portland, ME",           43.6581, -70.2442),
    ("8410140", "Eastport, ME",           44.9047, -66.9828),
]


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlmb = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dlmb / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def nearest_tide_station(lat: float, lon: float) -> tuple[str, float] | None:
    """Return (station_id, distance_km) of the nearest curated CO-OPS station.

    Returns None only if the curated list is empty.
    """
    best: tuple[str, float] | None = None
    for station_id, _name, slat, slon in CURATED_STATIONS:
        d = _haversine_km(lat, lon, slat, slon)
        if best is None or d < best[1]:
            best = (station_id, d)
    return best
