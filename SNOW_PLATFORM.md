# SnowStack — AI-Native Snow Forecasting Platform
## Technical Architecture & Build Plan

*Companion document to V2.md — Surf + Snow unified under one platform.*

---

## VISION

One platform. Two sports. Same philosophy: **free government data + ML bias correction + personalized scoring = better forecasts than the incumbents.**

SwellStack beats Surfline by replacing their proprietary black-box with transparent ML on free NOAA data. SnowStack beats OpenSnow and OnTheSnow by the same playbook — HRRR model data, SNOTEL ground truth, per-resort LightGBM density correction, and a personalized Powder Quality Score™ that understands whether you're a powder hound chasing 40cm days or a park rat who doesn't care about snow depth.

The entire stack runs on the same Intel NUC, same Supabase DB, same Next.js frontend, same FastAPI backend. Surf and snow share auth, session history, billing, and the NLQ layer. A user can log a barrel at Mavericks on Tuesday and a powder run at Jackson Hole on Saturday in the same app.

---

## SNOW vs SURF: PARALLEL ARCHITECTURE

| SwellStack (Surf) | SnowStack (Snow) | Notes |
|---|---|---|
| NDBC Buoy network | SNOTEL station network | Ground-truth observations |
| CDIP directional spectra | SNODAS gridded reanalysis | Distributed spatial data |
| ECMWF / GFS / ICON ensemble | HRRR / NAM / GFS ensemble | NWP model trio |
| SWAN nearshore physics | GIS terrain analysis (aspect/slope) | Local modification layer |
| Per-spot LightGBM bias corrector | Per-resort density predictor | ML correction pipeline |
| Wave height (face, m) | Powder depth (cm) + density (kg/m³) | Primary quality driver |
| Swell period → wave quality | Storm duration → snowpack depth | Secondary quality driver |
| Wind direction (offshore/onshore) | Wind speed (calm = powder, high = slab) | Wind role reversal |
| Stoke Score™ (0–100) | Powder Quality Score™ (0–100) | Personalized composite |
| Tide (rises/falls) | Temperature (warms/cools) | Temporal quality modifier |
| Crowd prediction (session history) | Crowd prediction (resort + weekday) | Same model structure |
| NLQ via llama.cpp | Same llama.cpp instance | Shared LLM |
| NOAA Tides API | CAIC / NWAC / UAC avalanche APIs | Safety data layer |

---

## DATA SOURCES

### Primary: SNOTEL Network (NRCS) — The NDBC of Snow

**~2,200 automated stations** across North America. High-elevation (6,000–12,000 ft), permanent, government-operated. Free, no API key required. This is the ground truth that every ML model gets trained against.

**Coverage by Region:**

| Region | Station Count | Key Stations | Flagship Resorts |
|--------|--------------|--------------|-----------------|
| Colorado Rockies | ~350 | Independence Pass, Vail Pass, Wolf Creek | Telluride, Vail, Arapahoe Basin |
| Utah | ~100 | Alta, Snowbird, Brighton | Snowbird, Alta, Park City |
| Wyoming | ~80 | Teton Pass, Togwotee, Jackson | Jackson Hole |
| Pacific Northwest | ~150 | Snoqualmie Pass, White Pass, Timberline | Baker, Stevens, Mt. Hood |
| California Sierra | ~200 | Donner Summit, Mammoth, June Lake | Mammoth, Kirkwood, Tahoe resorts |
| Montana | ~80 | Bridger Bowl, Big Sky SNOTEL | Big Sky, Whitefish |
| Northeast | ~50 | Stowe VT, Sugarloaf ME | Stowe, Sugarloaf, Killington |

**Variables Available:**
```
SNWD  — Snow depth (cm)                    [PRIMARY]
PREC  — Precipitation (mm liquid equiv)    [PRIMARY]
TAVG  — Average temperature (°C)           [PRIMARY]
TMAX  — Maximum temperature (°C)
TMIN  — Minimum temperature (°C)
WSPD  — Wind speed (m/s)
WDIR  — Wind direction (degrees)
RHMAX — Max relative humidity (%)
RHMIN — Min relative humidity (%)
SRAD  — Solar radiation (W/m²)
SMS   — Soil moisture (selected sites)
```

**API Access:**
```
Station list:  https://wcc.nrcs.usda.gov/api/core/stationlist?state=CO&network=SNTL
Time series:   https://wcc.nrcs.usda.gov/api/core/getTSdata
               ?stationTriplet=941:CO:SNTL&element=SNWD&beginDate=2024-01-01&endDate=2024-12-31
Hourly data:   https://wcc.nrcs.usda.gov/api/core/getdata/f/state/CO/sntl/
```

**Latency:** 1–3 hours. Most stations report by 11am Mountain Time.

---

### Secondary: SNODAS — Spatially Distributed Snow Analysis

**Coverage:** US-wide 1km-resolution daily grids, 30+ year archive.

SNODAS is a data assimilation product — it ingests SNOTEL station observations, satellite imagery, and NWP model output to produce spatially continuous snow fields. Think of it as the "hindcast" used to train the ML density predictor.

**Key Fields:**
```
SNWD  — Snow water equivalent (mm)          [PRIMARY — train ML density model]
RHOSN — Snow density (kg/m³)               [PRIMARY — ML training target]
PRATE — Precipitation rate (mm/hr)
SUBLIM — Sublimation rate (mm/hr)
BLSH  — Blowing snow sublimation (mm/hr)
```

**Access:** FTP server, daily files, ~6-day latency (post-processed, not for real-time forecasting)
```
FTP:  ftp://ftp.cdc.noaa.gov/Datasets/NOAA/NOAA-NSIDC-SOTC/SNODAS/
```

**Primary Use:** ML training data — pair HRRR-forecasted temperature/precipitation with SNODAS-observed density to learn per-resort bias correction.

---

### Forecast Models: The Equivalent of ECMWF/GFS/ICON

| Model | Resolution | Forecast Range | Update Cadence | Strength | Access |
|-------|-----------|----------------|----------------|----------|--------|
| **HRRR** | 3 km | 18h (0Z/12Z: 48h) | Every hour | Convection, precip timing, mesoscale features | NOMADS free |
| **NAM 3km** | 3 km | 84h | 4× daily | Extends HRRR range, good orographic lift | NOMADS free |
| **GFS** | 25 km | 16 days | 4× daily | Long-range pattern recognition | NOMADS free |
| **ECMWF IFS** | 9 km | 10 days | 2× daily | Best global skill, ensemble mean | Open-Meteo free tier |
| **ICON** | 13 km | 10 days | 3× daily | European skill, good for Cascades/NW | Open-Meteo free tier |
| **AROME** | 1.3 km | 42h | 4× daily | Ultra-high-res (European Alps only) | Météo France API |

**Recommended ensemble:** HRRR (primary, short-range) + NAM 3km (medium-range) + GFS (long-range pattern). Same conceptual structure as surf's ECMWF/GFS/ICON.

**NOMADS Access:**
```
HRRR: https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod/hrrr.{YYYYMMDD}/
      Files: hrrr.t{HH}z.wrfsfcf{FF}.grib2  (HH=cycle, FF=forecast hour)

NAM:  https://nomads.ncep.noaa.gov/pub/data/nccf/com/nam/prod/nam.{YYYYMMDD}/
```

**Libraries for GRIB2 parsing:** `cfgrib`, `pygrib`, `xarray`, `eccodes`

---

### Real-Time Observation Supplement: MesoWest

40,000+ stations aggregated from commercial, RAWS (USFS), RWIS (state DOT), mesonet, and citizen networks. Higher temporal resolution than SNOTEL for many mountain sites.

```python
# MesoWest API — free tier, requires registration
GET https://api.synopticdata.com/v2/stations/timeseries
  ?token={API_KEY}
  &stid=JHMH        # Jackson Hole Mountain Resort weather station
  &start=202401010000
  &end=202401022359
  &vars=air_temp,wind_speed,precip_accum,snow_depth
```

**Use Case:** Fill SNOTEL gaps, provide hourly data for resorts without nearby SNOTEL stations.

---

### Avalanche Safety Layer

| Source | Coverage | Data | API |
|--------|----------|------|-----|
| **CAIC** | Colorado | Zone danger, slab problems, aspect/elevation | `https://api.avalanche.state.co.us/v2/forecasts?zone_id=2` |
| **NWAC** | Northwest (WA, OR) | Zone danger + detailed snow analysis | `https://www.nwac.us/data-portal/` (GeoJSON) |
| **UAC** | Utah | Zone danger, specific terrain traps | `https://utahavalanchecenter.org/` |
| **CNFAIC** | Chugach AK | Zone danger | `https://www.cnfaic.org/` |
| **FAC** | Flathead AK | Zone danger | RSS feed |

**Avalanche Danger Scale:**
```
1 = Low          → green   → score modifier: 1.00
2 = Moderate     → yellow  → score modifier: 0.85
3 = Considerable → orange  → score modifier: 0.50 (cap quality score at 50)
4 = High         → red     → score modifier: 0.20 (strong warning in UI)
5 = Extreme      → black   → score modifier: 0.00 (closed, do not display score)
```

---

## SNOW PHYSICS: THE SCIENCE LAYER

### Snow Density — The Critical Variable

Snow density (ρ, kg/m³) is the single most important variable for snowboard quality. It determines whether you're floating on champagne powder (50–80 kg/m³) or fighting through wet cement (300+ kg/m³).

**Density Classifications:**
```
30–70 kg/m³   → "Champagne Powder"  🥂  (Sierra Nevada, Colorado)
70–120 kg/m³  → "Powder"           ❄️   (Rockies standard)
120–180 kg/m³ → "Heavy Powder"     😤  (Cascades, maritime climates)
180–280 kg/m³ → "Packed Powder"    🏂  (groomed runs)
280–400 kg/m³ → "Wind Slab"        ⚠️  (avy risk, hard to ride)
400–550 kg/m³ → "Wet/Slushy"       💧  (spring conditions)
550+ kg/m³    → "Ice / Crust"      🧊  (avoid)
```

**Hanson Formula (1999) — Primary Density Predictor:**
```
ρ_new = 50 + 3.1×T + 7.5×√P   [kg/m³]

Where:
  T = air temperature (°C, clamped to -15..+5)
  P = hourly precipitation rate (mm/h, clamped to 0..100)

Physical basis:
  50     = minimum packing (settling under gravity)
  3.1×T  = thermal sintering (warmer → bonds form faster → denser)
  7.5×√P = dynamic compaction from falling velocity (harder to displace)

Examples:
  Cold dry powder:  T=-12°C, P=3mm/h  → ρ ≈ 50 - 37 + 13 ≈ 26 → clamped to 30 kg/m³
  CO Rocky powder:  T=-8°C,  P=8mm/h  → ρ ≈ 50 - 25 + 21 ≈ 46 kg/m³
  UT "Greatest":    T=-5°C,  P=12mm/h → ρ ≈ 50 - 15 + 26 ≈ 61 kg/m³
  Cascade cement:   T=-1°C,  P=20mm/h → ρ ≈ 50 - 3  + 34 ≈ 81 kg/m³
  Wet spring snow:  T=+2°C,  P=15mm/h → ρ ≈ 50 + 6  + 29 ≈ 85 kg/m³ (then wets further)
```

**Settling Over Time:**
```python
def apply_settling(initial_density: float, hours_since_snowfall: float) -> float:
    """Jordan (1991) compaction model."""
    # Density increases exponentially toward ~400 kg/m³ max over 72h
    max_density = 400.0
    settling_rate = 0.008  # per hour
    return max_density - (max_density - initial_density) * np.exp(-settling_rate * hours_since_snowfall)
```

---

### Surface Type Classification Engine

```python
def classify_surface(
    temp_c: float,
    rh_pct: float,
    precip_24h_mm: float,
    wind_speed_ms: float,
    hours_since_snowfall: float,
    solar_radiation_w_m2: float,
    slope_aspect: str,
    density_kg_m3: float,
) -> str:
    """
    Returns one of: powder, heavy_powder, windpack, windcrust, sun_crust,
                    melt_freeze_crust, corn, wet, ice, facets
    """
    # Active snowfall conditions
    if precip_24h_mm > 5 and temp_c < 0:
        if density_kg_m3 < 80:
            return "powder"
        elif density_kg_m3 < 150:
            return "heavy_powder"
        else:
            return "wet"

    # Wind effect
    if wind_speed_ms > 10 and hours_since_snowfall < 24:
        if density_kg_m3 > 280:
            return "windpack"
        return "windcrust"

    # Solar crusting (south-facing, post-storm)
    if solar_radiation_w_m2 > 400 and slope_aspect in ("S", "SE", "SW"):
        if temp_c > -3:
            return "sun_crust"
        return "corn"  # afternoon corn = good spring skiing

    # Cold clear conditions = facet development (no recent snow, cold + low RH)
    if precip_24h_mm < 2 and temp_c < -10 and rh_pct < 45:
        return "facets"

    # Melt-freeze cycle (overnight refreeze)
    if temp_c < -2 and hours_since_snowfall > 24 and solar_radiation_w_m2 < 50:
        return "melt_freeze_crust"

    # Wet/slush
    if temp_c > 2:
        return "wet"

    # Default: settled powder
    return "powder" if density_kg_m3 < 150 else "packed_powder"
```

---

### Orographic Lift — The SWAN Equivalent

Terrain channels airflow. A storm hitting the Wasatch front at 270° generates dramatically different snowfall at Alta vs Snowbird based on elevation, ridgeline orientation, and slope aspect. This is conceptually identical to how SWAN models wave refraction and shoaling around headlands.

```python
# Orographic precipitation enhancement factor
def orographic_enhancement(
    terrain_elevation_m: float,
    storm_direction_deg: float,
    slope_aspect_deg: float,
    terrain_slope_deg: float,
    base_precip_mm: float,
) -> float:
    """
    Estimate local precipitation enhancement due to terrain.

    Windward slopes receive more precipitation (upslope lift).
    Leeward slopes are drier (rain shadow).

    Enhancement ratio: 1.0 (flat) to 3.5x (steep windward face, high elevation)
    """
    # Aspect angle relative to storm direction
    aspect_angle = abs((slope_aspect_deg - storm_direction_deg + 360) % 360)
    if aspect_angle > 180:
        aspect_angle = 360 - aspect_angle

    # Windward face (0° diff = directly facing storm)
    windward_factor = np.cos(np.radians(aspect_angle))
    windward_factor = max(0.3, windward_factor)  # lee sides still get some

    # Elevation enhancement (more orographic lift at altitude)
    elev_factor = 1.0 + (terrain_elevation_m - 2000) * 0.0003  # ~30% per 1000m above 2000m
    elev_factor = np.clip(elev_factor, 0.7, 3.0)

    # Slope steepness (steeper = more forced lift)
    slope_factor = 1.0 + (terrain_slope_deg / 90) * 0.5

    enhancement = windward_factor * elev_factor * slope_factor
    return base_precip_mm * enhancement
```

**Pre-Computed Terrain Tables (equivalent to SWAN LUT):**
Run orographic analysis over a grid of storm directions × elevations for each resort at startup. At forecast time, interpolate from the table instead of computing from scratch. Same <1ms lookup strategy as the SWAN LUT.

---

### Freezing Level — The Tide of Snow

Freezing level (altitude where T=0°C) is to snow what tide is to surf — it sets the baseline quality envelope. When freezing level drops below summit: fresh cold snow everywhere. When it rises above base: rain at the bottom, slushy snow at the top.

```python
def compute_freezing_level_m(
    sounding_temps: list[float],  # temperature profile from HRRR levels
    sounding_heights_m: list[float],
) -> float:
    """
    Interpolate altitude where T=0°C from HRRR vertical sounding.
    Returns height in meters above MSL.
    """
    for i in range(len(sounding_temps) - 1):
        if sounding_temps[i] >= 0 >= sounding_temps[i + 1]:
            # Linear interpolation between levels
            frac = sounding_temps[i] / (sounding_temps[i] - sounding_temps[i + 1])
            return sounding_heights_m[i] + frac * (sounding_heights_m[i + 1] - sounding_heights_m[i])
    return 0.0 if sounding_temps[0] < 0 else 5000.0  # all cold or all warm
```

---

## POWDER QUALITY SCORE™

The snow equivalent of Stoke Score™. Fully personalized, 0–100.

```python
from dataclasses import dataclass
import numpy as np

@dataclass
class SnowConditions:
    powder_depth_cm: float          # Fresh snow in last 24h
    total_base_cm: float            # Total snowpack depth
    density_kg_m3: float            # New snow density
    surface_type: str               # classified surface
    temp_2m_c: float                # Air temperature
    wind_speed_ms: float            # Summit wind speed
    wind_direction_deg: float       # Wind direction
    freezing_level_m: float         # 0°C isotherm altitude
    solar_radiation_w_m2: float     # Incoming solar (affects corn quality)
    avalanche_danger: int           # 1-5 (CAIC/NWAC/UAC scale)
    visibility_m: float             # Horizontal visibility

@dataclass
class RiderPreferences:
    skill_level: str                # beginner, intermediate, advanced, expert
    style: str                      # powder_hound, park_rat, groomer, backcountry, all_mountain
    pref_min_depth_cm: float        # Minimum fresh snow to care
    pref_max_depth_cm: float        # Above this = too deep (beginners)
    pref_density_min: float         # Lower = prefers fluffier snow
    pref_density_max: float         # Upper = OK with heavier snow
    avy_risk_tolerance: int         # Max danger level willing to ride (1-5)
    wind_tolerance_ms: float        # Max tolerable wind speed
    crowd_tolerance: float          # 0-1 (1 = doesn't care)
    preferred_aspects: list[str]    # e.g. ["N", "NE", "NW"]

def compute_powder_quality_score(
    conditions: SnowConditions,
    prefs: RiderPreferences,
    resort_max_elevation_m: float,
) -> dict:
    """
    Returns 0–100 score with component breakdown.
    """

    # ── DEPTH COMPONENT ───────────────────────────────────────────────────────
    # Bell curve centered on user's preferred range
    depth_mid = (prefs.pref_min_depth_cm + prefs.pref_max_depth_cm) / 2
    depth_range = max(prefs.pref_max_depth_cm - prefs.pref_min_depth_cm, 5)
    depth_score = np.exp(-0.5 * ((conditions.powder_depth_cm - depth_mid) / (depth_range / 2)) ** 2)

    # Boost for 3-day storm totals (sustained snowfall > single dump)
    if conditions.powder_depth_cm >= prefs.pref_max_depth_cm:
        depth_score = min(1.0, depth_score * 1.2)  # extra credit for epic dumps

    # ── DENSITY COMPONENT ────────────────────────────────────────────────────
    density_mid = (prefs.pref_density_min + prefs.pref_density_max) / 2
    density_range = max(prefs.pref_density_max - prefs.pref_density_min, 20)
    density_score = np.exp(-0.5 * ((conditions.density_kg_m3 - density_mid) / (density_range / 2)) ** 2)

    # ── AVALANCHE SAFETY GATE ────────────────────────────────────────────────
    danger_multipliers = {1: 1.00, 2: 0.90, 3: 0.55, 4: 0.20, 5: 0.0}
    avy_multiplier = danger_multipliers.get(conditions.avalanche_danger, 0.5)
    # Hard cap if user tolerance exceeded
    if conditions.avalanche_danger > prefs.avy_risk_tolerance:
        avy_multiplier = min(avy_multiplier, 0.30)

    # ── WIND COMPONENT ───────────────────────────────────────────────────────
    # High wind = wind slab + poor visibility + cold + avy risk
    wind_score = max(0.0, 1.0 - (conditions.wind_speed_ms / prefs.wind_tolerance_ms) ** 1.5)

    # ── TEMPERATURE COMPONENT ────────────────────────────────────────────────
    # Optimal: -5 to -15°C (good bond strength, stays fluffy)
    # Too cold: -20°C+ → facets, weak layers
    # Too warm: +2°C+ → wet, heavy, sticky
    if conditions.temp_2m_c < 0:
        temp_score = np.exp(-0.5 * ((conditions.temp_2m_c + 8) / 6) ** 2)  # peak at -8°C
    else:
        temp_score = max(0.0, 1.0 - conditions.temp_2m_c / 5)  # degrades rapidly above 0°C

    # ── FREEZING LEVEL COMPONENT ────────────────────────────────────────────
    # Good when freezing level is well below summit (cold everywhere)
    freeze_margin_m = resort_max_elevation_m - conditions.freezing_level_m
    freeze_score = min(1.0, max(0.0, freeze_margin_m / 500))  # 500m margin = full score

    # ── VISIBILITY COMPONENT ─────────────────────────────────────────────────
    vis_score = min(1.0, conditions.visibility_m / 5000)  # 5km+ = full score

    # ── WEIGHTED COMPOSITE ──────────────────────────────────────────────────
    weights = {
        "depth": 0.30,
        "density": 0.25,
        "wind": 0.15,
        "temperature": 0.12,
        "freezing_level": 0.10,
        "visibility": 0.08,
    }

    raw_score = (
        weights["depth"] * depth_score +
        weights["density"] * density_score +
        weights["wind"] * wind_score +
        weights["temperature"] * temp_score +
        weights["freezing_level"] * freeze_score +
        weights["visibility"] * vis_score
    ) * 100

    # Apply avalanche multiplier as a gate (not a weighted component)
    final_score = raw_score * avy_multiplier

    return {
        "powder_quality_score": round(final_score, 1),
        "components": {
            "depth": round(depth_score * 100),
            "density": round(density_score * 100),
            "wind": round(wind_score * 100),
            "temperature": round(temp_score * 100),
            "freezing_level": round(freeze_score * 100),
            "visibility": round(vis_score * 100),
        },
        "avalanche_modifier": avy_multiplier,
        "surface_type": conditions.surface_type,
        "summary": _score_to_label(final_score),
        "danger_level": conditions.avalanche_danger,
    }

def _score_to_label(score: float) -> str:
    if score >= 88: return "🤤 EPIC POWDER"
    if score >= 75: return "🎿 SHREDDING"
    if score >= 60: return "😋 GOOD SNOW"
    if score >= 45: return "🏂 DECENT"
    if score >= 30: return "😐 MEH"
    if score >= 15: return "🌧️ AVOID"
    return "❌ CLOSED / UNSAFE"
```

---

## ML PIPELINE

### 1. Density Bias Corrector (Per-Resort LightGBM)

Mirrors `services/bias_correction.py`. The Hanson formula gives a good first approximation, but local effects — maritime vs continental air masses, elevation inversion layers, aspect-driven wind redistribution — cause systematic errors. The ML model learns residuals from years of SNODAS truth data.

```python
# ml/train_density_corrector.py

FEATURE_COLUMNS = [
    "hrrr_temp_c",                  # surface temp
    "hrrr_temp_850mb_c",            # 850mb temperature (continental vs maritime signal)
    "hrrr_precip_rate_mm_h",        # precip intensity
    "hrrr_precip_6h_mm",            # 6h accumulation
    "hrrr_wind_speed_ms",           # summit wind
    "hrrr_wind_direction",          # storm track
    "hrrr_rh_pct",                  # relative humidity
    "hanson_density",               # Hanson formula output (use as feature)
    "elevation_m",                  # resort elevation
    "terrain_slope",                # slope angle
    "terrain_aspect_sin",           # sin(aspect) — circular encoding
    "terrain_aspect_cos",           # cos(aspect) — circular encoding
    "doy_sin",                      # sin(day_of_year) — circular seasonal encoding
    "doy_cos",                      # cos(day_of_year)
    "snotel_7d_avg_density",        # rolling climatology from nearest SNOTEL
    "hours_since_last_storm",       # aging effect on current snowpack
]

TARGET = "snodas_density_kg_m3"     # observed density from SNODAS reanalysis

# Training: 10 years HRRR/SNODAS pairs per resort (~87,600 samples/resort)
# Quantile regression → get prediction intervals (P10/P50/P90)
# MAPE target: < 12% (vs Hanson formula: ~22% MAPE)
```

### 2. Slab Risk Predictor (NACRR-Inspired)

Predict avalanche slab probability from NWP output, to supplement daily CAIC/NWAC forecasts with hourly granularity.

```python
# ml/train_slab_risk.py

SLAB_FEATURES = [
    "temp_change_24h_c",            # rapid warming → crust formation
    "wind_loading_score",           # wind speed × duration (measures slab loading)
    "new_snow_depth_cm",            # fresh snow load
    "new_snow_density_ratio",       # heavy new snow on weak base = problem
    "solar_radiation_index",        # solar heating of weak layers
    "aspect_elevation_combo",       # N+high = persistent weak layer risk
    "days_since_last_storm",        # weak layer age
    "base_temp_c",                  # cold base = weak layer persistence
]

SLAB_TARGET = "avalanche_danger_level"  # from historical CAIC data (labels 1-5)

# Interpolate between daily CAIC forecasts using HRRR hourly driving variables
# Output: per-aspect, per-elevation-band danger probability per hour
```

### 3. Storm Event Tracker (Snow Equivalent of Swell Tracker)

Identify named storm events, track arrival/departure, estimate total accumulation:

```python
# ml/storm_tracker.py

@dataclass
class StormEvent:
    name: str                       # e.g., "Pacific System #4"
    category: str                   # "Minor" / "Moderate" / "Major" / "Historic"
    arrival_utc: datetime           # When snowfall begins at resort
    peak_intensity_utc: datetime    # Max hourly precip rate
    departure_utc: datetime         # When snowfall ends
    total_accumulation_cm: float    # Forecast total
    confidence: float               # 0-1
    source_region: str              # "Pacific", "Gulf of Mexico", "Arctic", "Alberta Clipper"
    snow_quality: str               # "Champagne", "Fluffy", "Heavy", "Mixed"

def identify_storm_events(
    hrrr_precip_timeseries: list[float],
    gfs_16day_precip: list[float],
    threshold_mm_per_6h: float = 5.0,
) -> list[StormEvent]:
    """
    Group precipitation events into named storms.
    Gap > 12h between events → separate storms.
    Classify by total accumulation, intensity, source.
    """
    ...
```

### 4. Corn Snow Window Predictor (Bonus Feature)

Predict the afternoon corn snow window for spring skiing — when surface refreezes overnight then softens to optimal firmness in the morning sun. The snow equivalent of predicting optimal tide windows.

```python
def predict_corn_window(
    overnight_low_c: float,
    solar_radiation_forecast: list[float],  # hourly W/m²
    aspect_deg: float,
    elevation_m: float,
) -> tuple[datetime, datetime] | None:
    """
    Returns (optimal_start, optimal_end) window, or None if no corn possible.

    Corn requires:
    1. Overnight refreeze (T < -2°C)
    2. Solar softening in morning (aspect-dependent)
    3. Not too warm (T < +5°C at peak)
    """
    if overnight_low_c > -2:
        return None  # Didn't refreeze hard enough

    # Aspect-dependent solar angle offset
    aspect_offset_hours = {
        "E": -1.5, "SE": -1.0, "S": 0.0, "SW": +1.0,
        "W": +1.5, "NW": +3.0, "N": None, "NE": -2.0
    }
    offset = aspect_offset_hours.get(degrees_to_aspect(aspect_deg))
    if offset is None:
        return None  # North-facing never gets corn

    solar_noon_hour = 13.0  # local solar noon
    start_hour = solar_noon_hour - 3 + offset
    end_hour = start_hour + 2.5

    return (hour_to_datetime(start_hour), hour_to_datetime(end_hour))
```

---

## DATABASE SCHEMA

```sql
-- ─── Resorts ─────────────────────────────────────────────────────────────────
CREATE TABLE resorts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    region TEXT NOT NULL,
    country TEXT DEFAULT 'US',
    base_elevation_m INTEGER NOT NULL,
    summit_elevation_m INTEGER NOT NULL,
    vertical_m INTEGER GENERATED ALWAYS AS (summit_elevation_m - base_elevation_m) STORED,
    nearest_snotel_id TEXT,           -- NRCS station triplet e.g. "941:CO:SNTL"
    snotel_distance_km NUMERIC,
    avalanche_zone_id TEXT,           -- CAIC/NWAC zone ID
    avalanche_center TEXT,            -- "CAIC", "NWAC", "UAC", "CNFAIC"
    timezone TEXT DEFAULT 'America/Denver',
    annual_snowfall_cm INTEGER,       -- historical average (from SNOTEL history)
    snow_type TEXT,                   -- "continental" | "maritime" | "transitional"
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Terrain Zones (per-resort, per-aspect) ──────────────────────────────────
CREATE TABLE terrain_zones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id UUID REFERENCES resorts(id),
    zone_name TEXT NOT NULL,          -- e.g., "Upper North Face", "South Bowl"
    aspect TEXT NOT NULL,
    slope_degrees NUMERIC,
    elevation_band TEXT,              -- "summit", "upper", "mid", "lower", "base"
    exposure TEXT,                    -- "exposed", "moderate", "protected", "trees"
    avalanche_prone BOOLEAN DEFAULT FALSE,
    tree_density NUMERIC DEFAULT 0.5, -- 0-1
    geom GEOMETRY(Polygon, 4326),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── SNOTEL Observations ─────────────────────────────────────────────────────
CREATE TABLE snotel_observations (
    id BIGSERIAL,
    station_id TEXT NOT NULL,         -- NRCS triplet
    observed_at TIMESTAMPTZ NOT NULL,
    snwd_cm NUMERIC,                  -- snow depth (cm)
    prec_mm NUMERIC,                  -- precipitation (mm liquid equiv)
    swe_mm NUMERIC,                   -- snow water equivalent
    tavg_c NUMERIC,                   -- average temperature
    tmax_c NUMERIC,
    tmin_c NUMERIC,
    wspd_ms NUMERIC,                  -- wind speed (m/s)
    wdir NUMERIC,                     -- wind direction (degrees)
    rh_pct NUMERIC,                   -- relative humidity (%)
    srad_w_m2 NUMERIC,                -- solar radiation (W/m²)
    -- derived on ingest
    new_snow_cm NUMERIC,              -- depth_today - depth_yesterday
    estimated_density_kg_m3 NUMERIC, -- from Hanson formula
    PRIMARY KEY (station_id, observed_at)
);
SELECT create_hypertable('snotel_observations', 'observed_at');

-- ─── HRRR/NAM Forecast Data ──────────────────────────────────────────────────
CREATE TABLE resort_forecasts (
    id BIGSERIAL,
    resort_id UUID REFERENCES resorts(id),
    forecast_time TIMESTAMPTZ NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    model_source TEXT NOT NULL,       -- 'hrrr', 'nam', 'gfs', 'ecmwf', 'ensemble'
    -- precipitation
    precip_mm NUMERIC,
    precip_rate_mm_h NUMERIC,
    snowfall_cm NUMERIC,              -- model-predicted snowfall
    -- temperature / humidity
    temp_2m_c NUMERIC,
    temp_850mb_c NUMERIC,             -- upper-level temp (maritime/continental signal)
    rh_pct NUMERIC,
    freezing_level_m NUMERIC,
    -- wind
    wind_speed_ms NUMERIC,
    wind_direction NUMERIC,
    wind_gust_ms NUMERIC,
    -- derived fields
    estimated_density_kg_m3 NUMERIC, -- Hanson formula → ML correction
    surface_type TEXT,                -- classified surface condition
    powder_quality_score NUMERIC,     -- 0-100 (default preferences)
    confidence NUMERIC,
    -- storm metadata
    storm_event_id UUID,              -- FK to storm_events if part of named storm
    PRIMARY KEY (resort_id, forecast_time, model_source)
);
SELECT create_hypertable('resort_forecasts', 'forecast_time');

-- ─── Storm Events ────────────────────────────────────────────────────────────
CREATE TABLE storm_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resort_id UUID REFERENCES resorts(id),
    name TEXT,                        -- e.g., "Pacific System #4"
    category TEXT,                    -- "Minor", "Moderate", "Major", "Historic"
    source_region TEXT,               -- "Pacific", "Arctic", "Alberta Clipper", "Gulf"
    snow_quality TEXT,                -- "Champagne", "Fluffy", "Heavy", "Mixed"
    arrival_at TIMESTAMPTZ,
    peak_at TIMESTAMPTZ,
    departure_at TIMESTAMPTZ,
    forecast_accumulation_cm NUMERIC,
    actual_accumulation_cm NUMERIC,   -- filled after storm (from SNOTEL)
    confidence NUMERIC,               -- 0-1
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Avalanche Forecasts ─────────────────────────────────────────────────────
CREATE TABLE avalanche_forecasts (
    id BIGSERIAL,
    zone_id TEXT NOT NULL,            -- CAIC/NWAC zone ID
    center TEXT NOT NULL,             -- "CAIC", "NWAC", "UAC"
    valid_from TIMESTAMPTZ NOT NULL,
    valid_to TIMESTAMPTZ NOT NULL,
    danger_level INTEGER CHECK (danger_level BETWEEN 1 AND 5),
    danger_tomorrow INTEGER,
    slab_problems JSONB,              -- array of {type, aspects, elevations}
    raw_forecast TEXT,                -- full text from center
    PRIMARY KEY (zone_id, valid_from)
);

-- ─── User Sessions (Snow) ────────────────────────────────────────────────────
CREATE TABLE snow_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id),
    resort_id UUID REFERENCES resorts(id),
    session_date DATE NOT NULL,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    -- actual conditions at session
    powder_depth_cm NUMERIC,
    surface_type TEXT,
    temp_2m_c NUMERIC,
    wind_speed_ms NUMERIC,
    -- ratings
    quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 10),
    crowd_rating INTEGER CHECK (crowd_rating BETWEEN 1 AND 5),
    notes TEXT,
    notes_embedding VECTOR(384),      -- semantic search via pgvector
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── User Profiles (Snow) ────────────────────────────────────────────────────
-- Extend existing user_profiles with snow preferences
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS snow_skill TEXT
    CHECK (snow_skill IN ('beginner', 'intermediate', 'advanced', 'expert'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS rider_style TEXT
    CHECK (rider_style IN ('powder_hound', 'park_rat', 'groomer', 'backcountry', 'all_mountain'));
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS preferred_aspects TEXT[] DEFAULT ARRAY['N','NE','NW'];
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pref_min_depth_cm NUMERIC DEFAULT 10;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pref_max_depth_cm NUMERIC DEFAULT 50;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pref_density_min NUMERIC DEFAULT 50;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS pref_density_max NUMERIC DEFAULT 120;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS avy_risk_tolerance INTEGER DEFAULT 3
    CHECK (avy_risk_tolerance BETWEEN 1 AND 5);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS home_resorts UUID[];
```

---

## API ENDPOINTS

```
GET  /api/v1/resorts                          → list all resorts with current conditions
GET  /api/v1/resorts/{slug}                   → resort detail + metadata
GET  /api/v1/snow/forecast/{resort_id}        → 16-day hourly forecast (free: 7d)
GET  /api/v1/snow/forecast/{resort_id}/ensemble → model comparison (HRRR/NAM/GFS)
GET  /api/v1/snotel/{station_id}/live         → current SNOTEL reading
GET  /api/v1/snotel/{station_id}/history      → 90-day history for ML context
GET  /api/v1/avalanche/{zone_id}              → current danger forecast
GET  /api/v1/snow/optimal/{resort_id}         → ranked best windows next 16 days
POST /api/v1/snow/powder-score                → compute personalized Powder Quality Score
     body: { resort_id, user_preferences, forecast_time }
POST /api/v1/nlq                              → natural language (shared with surf)
     "Will there be powder at Jackson this weekend?"
     "Compare Telluride and Vail for next week"
     "Best day to hit Mammoth in the next 10 days?"
GET  /api/v1/snow/crowd/{resort_id}           → crowd prediction next 7 days
GET  /api/v1/snow/terrain/{resort_id}         → aspect/elevation analysis per zone
GET  /api/v1/snow/corn/{resort_id}            → corn snow window forecast
```

---

## SERVICES IMPLEMENTATION

### `services/snotel.py` — SNOTEL Fetcher

```python
"""
SNOTEL Data Fetcher — mirrors services/ndbc.py for surf.
Fetches snow depth, precipitation, temperature from NRCS SNOTEL network.
"""
import httpx
import asyncio
import structlog
from datetime import datetime, timedelta

SNOTEL_API = "https://wcc.nrcs.usda.gov/api/core"
logger = structlog.get_logger(__name__)

ELEMENTS_OF_INTEREST = ["SNWD", "PREC", "TAVG", "TMAX", "TMIN", "WSPD", "WDIR", "RHMIN", "RHMAX", "SRAD"]

async def fetch_station_list(state: str) -> list[dict]:
    """Get all SNOTEL stations for a state."""
    url = f"{SNOTEL_API}/stationlist"
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get(url, params={"state": state, "network": "SNTL"})
        resp.raise_for_status()
    return resp.json()

async def fetch_snotel_daily(
    station_triplet: str,
    days: int = 30,
) -> list[dict]:
    """
    Fetch daily SNOTEL data for a station.
    Returns list of {date, snwd_cm, new_snow_cm, prec_mm, tavg_c, wspd_ms, wdir, rh_pct}
    """
    end_date = datetime.utcnow().date()
    begin_date = end_date - timedelta(days=days)

    results = {}
    async with httpx.AsyncClient(timeout=60) as client:
        tasks = [
            _fetch_element(client, station_triplet, element, begin_date, end_date)
            for element in ELEMENTS_OF_INTEREST
        ]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

    for element, data in zip(ELEMENTS_OF_INTEREST, responses):
        if isinstance(data, Exception):
            logger.warning("SNOTEL element fetch failed", element=element, error=str(data))
            continue
        for date_str, value in data.items():
            if date_str not in results:
                results[date_str] = {"date": date_str}
            results[date_str][element.lower()] = value

    # Compute new snow depth (delta)
    sorted_days = sorted(results.values(), key=lambda x: x["date"])
    for i in range(1, len(sorted_days)):
        prev_depth = sorted_days[i - 1].get("snwd", 0) or 0
        curr_depth = sorted_days[i].get("snwd", 0) or 0
        sorted_days[i]["new_snow_cm"] = max(0, curr_depth - prev_depth)

    return sorted_days
```

### `services/hrrr.py` — HRRR Forecast Fetcher

```python
"""
HRRR Forecast Fetcher — primary NWP model for snow.
Downloads GRIB2 files from NOAA NOMADS, extracts snow-relevant variables.
"""
import httpx
import asyncio
import numpy as np
from datetime import datetime, timezone
from pathlib import Path
import structlog

try:
    import cfgrib
    import xarray as xr
    HAS_GRIB = True
except ImportError:
    HAS_GRIB = False

NOMADS_BASE = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod"
logger = structlog.get_logger(__name__)

HRRR_VARIABLES = {
    # Surface variables
    "TMP": "2m temperature",
    "UGRD": "U-wind at 10m",
    "VGRD": "V-wind at 10m",
    "GUST": "wind gust",
    "APCP": "accumulated precip",
    "PRATE": "precip rate",
    "DSWRF": "downward solar radiation",
    "RH": "relative humidity",
    # Levels for freezing level computation
    "TMP_850mb": "850mb temperature",
    "TMP_700mb": "700mb temperature",
    "TMP_500mb": "500mb temperature",
}

async def fetch_hrrr_forecast(
    lat: float,
    lon: float,
    forecast_hours: int = 18,
) -> list[dict]:
    """
    Download and parse HRRR GRIB2 for a single location.
    Returns list of hourly dicts with precip, temp, wind, solar.

    Falls back to Open-Meteo free tier if NOMADS unavailable.
    """
    if not HAS_GRIB:
        logger.warning("cfgrib not installed, falling back to Open-Meteo")
        return await _fetch_openmeteo_snow_fallback(lat, lon, forecast_hours)

    now_utc = datetime.now(timezone.utc)
    # HRRR cycles: 00Z, 01Z, ... 23Z — use most recent available (1h lag)
    cycle_hour = (now_utc.hour - 1) % 24
    date_str = now_utc.strftime("%Y%m%d")

    results = []
    for fh in range(forecast_hours):
        url = f"{NOMADS_BASE}/hrrr.{date_str}/hrrr.t{cycle_hour:02d}z.wrfsfcf{fh:02d}.grib2"
        try:
            data = await _download_and_extract_point(url, lat, lon)
            if data:
                results.append(data)
        except Exception as exc:
            logger.warning("HRRR fetch failed", forecast_hour=fh, error=str(exc))

    if not results:
        return await _fetch_openmeteo_snow_fallback(lat, lon, forecast_hours)

    return results

async def _fetch_openmeteo_snow_fallback(lat: float, lon: float, hours: int) -> list[dict]:
    """Open-Meteo free tier — returns hourly snow/temp/wind data."""
    params = {
        "latitude": lat,
        "longitude": lon,
        "hourly": ",".join([
            "temperature_2m", "precipitation", "snowfall",
            "wind_speed_10m", "wind_direction_10m",
            "shortwave_radiation", "relative_humidity_2m",
            "snow_depth", "freezing_level_height",
        ]),
        "forecast_days": max(1, hours // 24 + 1),
        "timezone": "UTC",
        "wind_speed_unit": "ms",
    }
    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.get("https://api.open-meteo.com/v1/forecast", params=params)
        resp.raise_for_status()
    return _parse_openmeteo_snow_response(resp.json())
```

### `services/snow_density.py` — Density Predictor

```python
"""
Snow density prediction — Hanson formula with LightGBM ML correction.
Mirrors services/bias_correction.py for surf.
"""
import numpy as np
import pickle
from pathlib import Path

MODELS_DIR = Path("models/ml")

class ResortDensityPredictor:
    """Per-resort LightGBM model: HRRR temp/precip/wind → observed density."""

    def __init__(self, resort_id: str):
        model_path = MODELS_DIR / f"snow_density_{resort_id}.pkl"
        self.model = None
        if model_path.exists():
            with open(model_path, "rb") as f:
                self.model = pickle.load(f)

    def predict(
        self,
        temp_c: float,
        precip_rate_mm_h: float,
        wind_speed_ms: float,
        elevation_m: float,
        doy: int,
    ) -> tuple[float, float]:
        """Returns (density_kg_m3, confidence)."""
        hanson = self._hanson_formula(temp_c, precip_rate_mm_h)

        if self.model is None:
            return hanson, 0.50

        features = np.array([
            temp_c, precip_rate_mm_h, wind_speed_ms,
            elevation_m / 1000,
            hanson,
            np.sin(2 * np.pi * doy / 365),  # seasonal encoding
            np.cos(2 * np.pi * doy / 365),
        ]).reshape(1, -1)

        pred = self.model.predict(features)[0]
        confidence = min(0.95, 0.60 + 0.35 * (1 - abs(pred - hanson) / max(hanson, 1)))
        return float(np.clip(pred, 20, 600)), float(confidence)

    @staticmethod
    def _hanson_formula(temp_c: float, precip_rate_mm_h: float) -> float:
        t = np.clip(temp_c, -15, 5)
        p = np.clip(precip_rate_mm_h, 0, 100)
        return float(np.clip(50 + 3.1 * t + 7.5 * np.sqrt(p), 20, 600))
```

### `services/avalanche.py` — Avalanche Risk Aggregator

```python
"""
Avalanche forecast aggregator — pulls from CAIC, NWAC, UAC, FAC.
Safety gate for Powder Quality Score.
"""
import httpx
import structlog
from datetime import datetime, timezone

logger = structlog.get_logger(__name__)

AVALANCHE_CENTERS = {
    "CAIC": {
        "base_url": "https://api.avalanche.state.co.us/v2",
        "regions": ["CO"],
    },
    "NWAC": {
        "base_url": "https://www.nwac.us/api",
        "regions": ["WA", "OR"],
    },
    "UAC": {
        "base_url": "https://utahavalanchecenter.org/api",
        "regions": ["UT"],
    },
}

DANGER_LEVELS = {
    "Low": 1, "Moderate": 2, "Considerable": 3, "High": 4, "Extreme": 5,
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
}

async def fetch_avalanche_forecast(zone_id: str, center: str) -> dict | None:
    """Fetch current danger level for a zone from its avalanche center."""
    center_config = AVALANCHE_CENTERS.get(center)
    if not center_config:
        return None

    try:
        if center == "CAIC":
            url = f"{center_config['base_url']}/forecasts?zone_id={zone_id}"
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url)
                resp.raise_for_status()
            data = resp.json()
            return {
                "zone_id": zone_id,
                "center": center,
                "danger_level": DANGER_LEVELS.get(data.get("danger_level_today", "Moderate"), 2),
                "danger_tomorrow": DANGER_LEVELS.get(data.get("danger_level_tomorrow", "Moderate"), 2),
                "slab_problems": data.get("slab_problems", []),
                "valid_from": data.get("valid_from"),
                "valid_to": data.get("valid_to"),
            }
    except Exception as exc:
        logger.warning("Avalanche forecast fetch failed", center=center, zone_id=zone_id, error=str(exc))
        return {"zone_id": zone_id, "center": center, "danger_level": 2}  # fallback: Moderate
```

### `scheduler/snow_jobs.py` — Scheduled Data Pipeline

```python
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

snow_scheduler = AsyncIOScheduler()

# Every hour: fetch SNOTEL observations (mirrors NDBC scheduler)
@snow_scheduler.scheduled_job(CronTrigger(minute=45))  # 45min after hour
async def update_snotel_data():
    """Fetch latest SNOTEL readings for all resort stations."""
    resorts = await get_all_resorts()
    for resort in resorts:
        if resort.nearest_snotel_id:
            data = await fetch_snotel_daily(resort.nearest_snotel_id, days=2)
            await upsert_snotel_observations(resort.nearest_snotel_id, data)

# Every hour: fetch latest HRRR (new cycle available every hour)
@snow_scheduler.scheduled_job(CronTrigger(minute=15))
async def update_hrrr_forecasts():
    """Download and process HRRR for all active resorts."""
    resorts = await get_all_resorts()
    sem = asyncio.Semaphore(4)  # don't hammer NOMADS
    async def fetch_resort(resort):
        async with sem:
            forecast = await fetch_hrrr_forecast(resort.lat, resort.lng, forecast_hours=18)
            processed = await process_snow_forecast(resort, forecast)
            await upsert_resort_forecasts(resort.id, processed, source="hrrr")
    await asyncio.gather(*[fetch_resort(r) for r in resorts])

# Every 6 hours: NAM 3km (longer-range)
@snow_scheduler.scheduled_job(CronTrigger(hour='1,7,13,19', minute=30))
async def update_nam_forecasts():
    resorts = await get_all_resorts()
    for resort in resorts:
        forecast = await fetch_nam_forecast(resort.lat, resort.lng)
        await upsert_resort_forecasts(resort.id, forecast, source="nam")

# Daily at 8am local: fetch avalanche forecasts
@snow_scheduler.scheduled_job(CronTrigger(hour=13, minute=0))  # 8am MT = 13Z
async def update_avalanche_forecasts():
    resorts = await get_all_resorts()
    for resort in resorts:
        if resort.avalanche_zone_id and resort.avalanche_center:
            avy = await fetch_avalanche_forecast(resort.avalanche_zone_id, resort.avalanche_center)
            if avy:
                await upsert_avalanche_forecast(avy)

# Daily at 3am: identify storm events, update named storms
@snow_scheduler.scheduled_job(CronTrigger(hour=3, minute=0))
async def update_storm_events():
    resorts = await get_all_resorts()
    for resort in resorts:
        forecast = await get_resort_forecast(resort.id, days=16)
        events = identify_storm_events(
            hrrr_precip=[f["precip_mm"] for f in forecast],
            gfs_16day_precip=[f["precip_mm"] for f in forecast],
        )
        await upsert_storm_events(resort.id, events)

# Daily at 3am: retrain ML density models (if enough new SNOTEL data)
@snow_scheduler.scheduled_job(CronTrigger(hour=3, minute=30))
async def nightly_density_model_refresh():
    await maybe_retrain_density_models()
```

---

## INITIAL RESORT DATASET

Start with 15 iconic US resorts for launch. Each needs: lat/lng, elevation data, nearest SNOTEL station, avalanche zone, snow type classification.

| # | Resort | State | Base/Summit (m) | Snow Type | Nearest SNOTEL | Avy Center |
|---|--------|-------|----------------|-----------|----------------|-----------|
| 1 | Jackson Hole | WY | 1923 / 3183 | Continental | Teton Pass (470:WY:SNTL) | JHAAC |
| 2 | Alta | UT | 2600 / 3216 | Transitional | Alta (341:UT:SNTL) | UAC |
| 3 | Snowbird | UT | 2365 / 3352 | Transitional | Snowbird (841:UT:SNTL) | UAC |
| 4 | Telluride | CO | 2666 / 4114 | Continental | Lizard Head Pass (622:CO:SNTL) | CAIC |
| 5 | Mammoth Mountain | CA | 2425 / 3369 | Maritime | Mammoth Lakes (614:CA:SNTL) | ESAC |
| 6 | Vail | CO | 2476 / 3527 | Continental | Vail Mountain (838:CO:SNTL) | CAIC |
| 7 | Big Sky | MT | 1950 / 3401 | Continental | Lone Mountain (778:MT:SNTL) | GAC |
| 8 | Stevens Pass | WA | 1241 / 1799 | Maritime | Stevens Pass (791:WA:SNTL) | NWAC |
| 9 | Mt. Baker | WA | 1066 / 1542 | Maritime | Mt. Baker (773:WA:SNTL) | NWAC |
| 10 | Park City | UT | 2103 / 3048 | Transitional | Park City (697:UT:SNTL) | UAC |
| 11 | Aspen Snowmass | CO | 2420 / 3812 | Continental | Independence Pass (941:CO:SNTL) | CAIC |
| 12 | Breckenridge | CO | 2926 / 3962 | Continental | Breckenridge (440:CO:SNTL) | CAIC |
| 13 | Stowe | VT | 388 / 1339 | Maritime-NE | Stowe (1049:VT:SNTL) | NWAC |
| 14 | Whistler Blackcomb | BC | 652 / 2182 | Maritime | Whistler (1C22S:BC:SNTL) | NWAC |
| 15 | Kirkwood | CA | 2377 / 2955 | Maritime | Kirkwood (538:CA:SNTL) | ESAC |

**Phase 2 expansion:** 50+ resorts (Colorado majors, full Tahoe basin, full Utah, full PNW)
**Phase 3 expansion:** 200+ resorts (Europe: Alps, Pyrenees; Japan: Hokkaido; NZ/Australia)

---

## FRONTEND COMPONENTS

### Resort Map (`app/(dashboard)/snow/page.tsx`)
- World map with resort markers (snowflake icons colored by Powder Quality Score)
- Slide-in card on click — same pattern as surf SpotDetailCard
- Live conditions: fresh snow depth, surface type, danger level badge, temp
- "Chase Storm" button → shows resorts with active storm events

### ResortForecast Page (`app/(dashboard)/snow/[resort]/page.tsx`)
1. **Hero**: Resort name, snow depth badge, Powder Quality ring, danger level
2. **7-Day Snow Timeline**: Hourly snowfall rate bar chart + powder depth running total
3. **Storm Events**: Named storm cards with arrival time, expected total, confidence
4. **Snow Density Chart**: 72h density forecast — color-coded powder/heavy/slab zones
5. **Aspect/Elevation Heatmap**: Grid showing quality score by aspect × elevation band
6. **Avalanche Safety Layer**: Zone danger map + slab problem icons
7. **Optimal Windows**: Best times to ride (depth × density × avy × wind × crowd)
8. **Corn Snow Window**: Spring-specific — predicted softening window by aspect
9. **"Ask the Mountain" NLQ**: `llama.cpp` on NUC — "Will there be untracked powder tomorrow morning on the north face?"

### PowderQualityScore Component (`components/snow/PowderScore.tsx`)
- Same animated ring as StokeScore.tsx
- Color gradient: gray → blue → cyan → green → yellow → orange → 🔥
- Component bars: Depth, Density, Wind, Temperature, Safety
- Danger level badge with color (green/yellow/orange/red/black)
- Avalanche warning overlay if danger ≥ 3

---

## SUBSCRIPTION GATING (Snow)

Extend existing `FEATURE_GATES` in `lib/gates.ts`:

```typescript
// Add to FEATURE_GATES
snow_forecast_days:     { free: 7,     pro: 16,   explorer: 16   },
resorts_saved:          { free: 3,     pro: 20,   explorer: 50   },
powder_score:           { free: false, pro: true,  explorer: true  },
avalanche_detail:       { free: false, pro: true,  explorer: true  },
snow_optimal_windows:   { free: false, pro: true,  explorer: true  },
corn_snow_window:       { free: false, pro: true,  explorer: true  },
hrrr_hourly_breakdown:  { free: false, pro: true,  explorer: true  },
storm_event_tracking:   { free: false, pro: true,  explorer: true  },
density_chart:          { free: false, pro: true,  explorer: true  },
nlq_snow_queries:       { free: 0,     pro: 10,   explorer: 50   },
terrain_analysis:       { free: false, pro: false, explorer: true  },
```

---

## NLQ PROMPTING (Snow-Specific)

Extend the llama.cpp prompt system with snow context:

```python
SNOW_SYSTEM_PROMPT = """
You are the SnowStack AI, an expert mountain snowboarding and skiing forecaster.
You have access to:
- HRRR/NAM/GFS forecast data (temperature, precipitation, wind, freezing level)
- SNOTEL station observations (snow depth, density, new snow)
- Avalanche forecasts from CAIC, NWAC, UAC, and other regional centers
- Personalized Powder Quality Scores based on user riding style and preferences

Key physics knowledge:
- Continental snow (CO, WY, UT) = 4-8% SWE ratio = light powder
- Maritime snow (WA, CA) = 10-18% SWE ratio = heavy, wet powder
- Density < 80 kg/m³ = champagne powder; 80-150 = good powder; > 200 = avoid
- Freezing level below resort base = cold dry conditions everywhere
- Dangerous days: avalanche danger ≥ 3 (Considerable) = recommend caution
- Corn snow: spring, freeze-refreeze, best on south/southeast aspects 10am-1pm

Always mention avalanche safety when relevant. Never recommend riding in Extreme (5) danger.
Units: snow depth in inches or cm based on user location, temperature in °F or °C.
"""
```

---

## ENVIRONMENT VARIABLES (New)

```bash
# .env additions (NUC / API server)
SNOTEL_API_BASE=https://wcc.nrcs.usda.gov/api/core
MESOWEST_API_KEY=                   # free, register at mesowest.utah.edu
NOMADS_BASE_URL=https://nomads.ncep.noaa.gov/pub/data/nccf/com
AVALANCHE_POLL_INTERVAL_SECONDS=3600  # 1h (centers update 1x/day but poll more often)
```

---

## BUILD PHASES

### Phase 1 — Foundation (Weeks 1–3)
- [ ] `services/snotel.py` — SNOTEL fetcher (mirrors `ndbc.py`)
- [ ] `services/hrrr.py` — HRRR downloader via NOMADS + Open-Meteo fallback
- [ ] `services/snow_density.py` — Hanson formula implementation
- [ ] `services/avalanche.py` — CAIC + NWAC + UAC aggregator
- [ ] `routers/resorts.py` — REST endpoints for resort data
- [ ] `routers/snow_forecast.py` — forecast endpoint with density + surface type
- [ ] Supabase migrations for new tables (resorts, snotel_observations, resort_forecasts)
- [ ] Seed data for 15 launch resorts
- [ ] Basic Powder Quality Score (Hanson only, no ML yet)

### Phase 2 — ML + Ensemble (Weeks 4–6)
- [ ] `ml/download_snotel_history.py` — pull 10yr SNOTEL for all launch resorts
- [ ] `ml/download_snodas_history.py` — pull SNODAS density grids
- [ ] `ml/train_density_corrector.py` — per-resort LightGBM density model
- [ ] `services/nam.py` — NAM 3km integration
- [ ] `services/ensemble_snow.py` — HRRR/NAM/GFS ensemble weighted by region/season
- [ ] `ml/storm_tracker.py` — named storm event identification
- [ ] Frontend: resort map + card view + 7-day timeline
- [ ] Avalanche safety layer in frontend

### Phase 3 — Advanced Features (Weeks 7–10)
- [ ] `services/snow_density.py` — ML density corrector (replaces Hanson)
- [ ] `ml/train_slab_risk.py` — hourly slab risk interpolator
- [ ] Terrain analysis GIS layer (aspect/elevation heatmap)
- [ ] Corn snow window predictor
- [ ] Optimal windows engine (snow edition)
- [ ] NLQ snow context + prompt engineering
- [ ] MesoWest integration for higher-density observation coverage

### Phase 4 — Scale + International (Weeks 11+)
- [ ] Expand to 50+ US resorts
- [ ] European Alps: AROME model + MeteoSwiss data
- [ ] Japan: Japan Meteorological Agency (JMA) snowfall data + Niseko/Hakuba
- [ ] New Zealand/Australia: MetService + NZ mountain data
- [ ] Mobile push notifications for powder alerts ("18cm dropped at Jackson last night")
- [ ] Webcam CV for visual snowpack validation (same architecture as surf webcam in V2.md)
- [ ] Historical analytics: "Best week to visit Jackson historically" (SNOTEL 30yr climatology)

---

## KEY DIFFERENCES FROM SWELLSTACK

1. **No Spectral Data Network.** Snow lacks a CDIP/NDBC equivalent with spectral resolution. SNODAS is gridded but has 6-day lag. The ML training dataset is richer spatially but poorer temporally.

2. **Shorter Reliable Forecast Window.** HRRR only 18–48h. NAM to 3.5 days. Precipitation forecast skill collapses rapidly beyond 5 days — be transparent about uncertainty in the UI.

3. **Static Terrain vs Dynamic Bathymetry.** Aspect/slope never changes (vs seabed evolution). One-time GIS preprocessing replaces SWAN per-run execution.

4. **Avalanche = Hard Safety Gate.** No equivalent in surf (shark risk is statistical, not forecast). Avalanche danger ≥ 4 must visually block the score in the UI with a warning.

5. **Continental vs Maritime Snow Physics.** A -10°C storm produces fundamentally different snow in Colorado vs Washington. Snow type is encoded as a resort attribute and drives the ML model feature set.

6. **Crowd Density Harder to Observe.** No direct equivalent of surf session logs → crowd proxy from resort lift ticket sales patterns (seasonal), day-of-week models, and school holiday calendars.

7. **Data Update Cadence is Different.** HRRR updates every hour vs NDBC every 10 minutes. SNOTEL daily vs buoy near-realtime. Design UI to clearly communicate data freshness.

---

## INFRASTRUCTURE COST ESTIMATE

| Component | Service | Cost |
|-----------|---------|------|
| SNOTEL + HRRR + SNODAS download | NOMADS/NRCS (free) | $0/yr |
| Supabase DB additions (new tables) | Free tier | $0/yr |
| NUC compute (HRRR parsing, ML inference) | Already running | $0 incremental |
| ML model storage (LightGBM, ~5MB/resort) | Local NUC SSD | $0/yr |
| Vercel frontend | Free tier | $0/yr |
| **Total incremental cost for snow** | — | **$0/yr** |

Same $12/year infrastructure budget covers both surf and snow.

---

*This platform is built with the same mission: make expert-grade forecasts accessible by standing on the shoulders of the free data giants — NOAA, NRCS, and the open-source ML community.*
