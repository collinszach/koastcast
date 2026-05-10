"""
Koastcast Pydantic v2 schemas.
All API responses and internal data structures are typed here.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ─── Spot ─────────────────────────────────────────────────────────────────────

class SpotBase(BaseModel):
    name: str
    slug: str
    lat: float
    lng: float
    region: str
    country: str = "US"
    break_type: str
    optimal_swell_direction: float | None = None
    optimal_swell_direction_range: float = 45.0
    optimal_wind_direction: float | None = None
    optimal_period_min: float = 10.0
    optimal_period_max: float = 20.0
    optimal_size_min: float = 1.5
    optimal_size_max: float = 3.0
    nearest_buoy_id: str | None = None
    secondary_buoy_id: str | None = None
    swan_enabled: bool = False
    timezone: str = "America/Los_Angeles"
    description: str | None = None
    skill_minimum: str | None = None


class Spot(SpotBase):
    model_config = ConfigDict(from_attributes=True)
    id: UUID | None = None


class SpotWithConditions(Spot):
    current_conditions: CurrentConditions | None = None


# ─── Current Conditions ───────────────────────────────────────────────────────

class CurrentConditions(BaseModel):
    wave_height_face_m: float | None = None
    wave_period_s: float | None = None
    wave_direction: float | None = None
    wind_speed_ms: float | None = None
    wind_direction: float | None = None
    tide_height_m: float | None = None
    tide_state: str | None = None
    quality_score: float | None = None
    forecast_time: datetime | None = None
    model_source: str | None = None


# ─── Forecast ─────────────────────────────────────────────────────────────────

class ForecastHour(BaseModel):
    forecast_time: datetime
    model_source: str = "open_meteo"
    # Wave
    wave_height_m: float | None = None
    wave_height_face_m: float | None = None
    wave_period_s: float | None = None
    wave_direction: float | None = None
    # Swell separation
    swell_height_m: float | None = None
    swell_period_s: float | None = None
    swell_direction: float | None = None
    wind_swell_height_m: float | None = None
    wind_swell_period_s: float | None = None
    wind_swell_direction: float | None = None
    # Wind
    wind_speed_ms: float | None = None
    wind_direction: float | None = None
    wind_gust_ms: float | None = None
    # Tide
    tide_height_m: float | None = None
    tide_state: str | None = None
    # Quality
    quality_score: float | None = None
    confidence: float | None = None
    # Crowd
    crowd_score: float | None = None       # 0-1 (1=very crowded)
    crowd_label: str | None = None         # e.g. "crowded", "uncrowded"
    # Ensemble
    model_agreement: float | None = None   # 0-1 agreement between models
    model_agreement_label: str | None = None  # "agree", "mild_disagreement", "disagree"
    # Second swell train
    swell_height_2_m: float | None = None
    swell_period_2_s: float | None = None
    swell_direction_2: float | None = None
    # Ocean current
    ocean_current_velocity_ms: float | None = None
    ocean_current_direction: float | None = None
    # Nowcast flag
    is_nowcast: bool = False
    # Spectral (optional, premium)
    wave_spectrum: dict[str, Any] | None = None


class ForecastResponse(BaseModel):
    spot_id: str
    spot_slug: str
    generated_at: datetime
    hours: list[ForecastHour]
    days_available: int
    model_sources: list[str]
    # Ensemble metadata
    ensemble_mode: bool = False
    model_forecasts: dict[str, Any] | None = None  # individual model data (premium)


# ─── Buoy Observation ─────────────────────────────────────────────────────────

class BuoyObservation(BaseModel):
    station_id: str
    observed_at: datetime
    wvht: float | None = None   # significant wave height (m)
    dpd: float | None = None    # dominant period (s)
    apd: float | None = None    # average period (s)
    mwd: float | None = None    # mean wave direction (deg)
    wspd: float | None = None   # wind speed (m/s)
    wdir: float | None = None   # wind direction (deg)
    gst: float | None = None    # gust (m/s)
    pres: float | None = None   # pressure (hPa)
    atmp: float | None = None   # air temp (C)
    wtmp: float | None = None   # water temp (C)
    # Swell components
    swh: float | None = None    # swell height (m)
    swp: float | None = None    # swell period (s)
    swd: float | None = None    # swell direction (deg)
    wwh: float | None = None    # wind wave height (m)
    wwp: float | None = None    # wind wave period (s)
    wwd: float | None = None    # wind wave direction (deg)
    # Spectral
    spectral_energy: dict[str, float] | None = None
    spectral_direction: dict[str, float] | None = None


class BuoyLiveResponse(BaseModel):
    station_id: str
    latest: BuoyObservation | None = None
    history_24h: list[BuoyObservation] = Field(default_factory=list)


# ─── User Session ─────────────────────────────────────────────────────────────

class SessionCreate(BaseModel):
    spot_id: str
    session_date: date
    start_time: datetime | None = None
    end_time: datetime | None = None
    wave_height_face_m: float | None = None
    wave_period_s: float | None = None
    wave_direction: float | None = None
    wind_speed_ms: float | None = None
    wind_direction: float | None = None
    tide_height_m: float | None = None
    quality_rating: int | None = Field(None, ge=1, le=10)
    crowd_rating: int | None = Field(None, ge=1, le=5)
    notes: str | None = None


class Session(SessionCreate):
    id: UUID
    user_id: UUID
    created_at: datetime


# ─── NLQ ─────────────────────────────────────────────────────────────────────

class NLQRequest(BaseModel):
    query: str = Field(..., max_length=500)
    spot_id: str | None = None


class NLQResponse(BaseModel):
    query: str
    answer: str
    spot: str | None = None
    confidence: float | None = None


# ─── Health ───────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    version: str
    environment: str
