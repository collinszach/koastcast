/**
 * Koastcast Snow — shared TypeScript types
 */

export interface Resort {
  id: string
  name: string
  slug: string
  lat: number
  lng: number
  state: string
  country: string
  region: string
  pass: 'epic' | 'ikon' | 'independent'
  // JSON uses metric; converted to imperial in UI
  summit_elevation_m?: number
  base_elevation_m?: number
  vertical_m?: number
  terrain_acres?: number
  trails?: number
  lifts?: number
  annual_snowfall_cm?: number
  nearest_snotel_id?: string
  nearest_snotel_name?: string
  avalanche_center?: string
  avalanche_region?: string
  timezone: string
  website?: string
  break_type: string
  description?: string
  // Current conditions (populated by API)
  current_conditions?: ResortConditions
}

export interface ResortConditions {
  new_snow_24h_in?: number | null
  new_snow_48h_in?: number | null
  new_snow_72h_in?: number | null
  base_depth_in?: number | null
  swe_in?: number | null
  temperature_f?: number | null
  wind_speed_mph?: number | null
  wind_direction?: number | null
  visibility?: string | null
  powder_score?: number | null
  snow_condition?: 'epic_powder' | 'fresh_tracks' | 'good_snow' | 'packed' | 'icy' | 'no_data'
  updated_at?: string | null
}

export interface SnowForecastHour {
  forecast_time: string
  new_snow_in?: number | null
  snow_depth_in?: number | null
  temperature_f?: number | null
  wind_speed_mph?: number | null
  wind_direction?: number | null
  precipitation_probability?: number | null
}

export function getSnowConditionLabel(powder_score?: number | null): NonNullable<ResortConditions['snow_condition']> {
  if (powder_score == null) return 'no_data'
  if (powder_score >= 80) return 'epic_powder'
  if (powder_score >= 65) return 'fresh_tracks'
  if (powder_score >= 50) return 'good_snow'
  if (powder_score >= 35) return 'packed'
  return 'icy'
}

// ─── Unit helpers ─────────────────────────────────────────────────────────────

/** metres → feet, rounded */
export function metersToFeet(m?: number | null): number | null {
  if (m == null) return null
  return Math.round(m * 3.281)
}

/** centimetres → inches, rounded to 1 decimal */
export function cmToInches(cm?: number | null): number | null {
  if (cm == null) return null
  return Math.round(cm / 2.54)
}

// ─── Open-Meteo forecast types ─────────────────────────────────────────────

export interface SnowForecastDay {
  date: string              // "2025-01-15"
  snowfall_in: number       // converted from cm (÷ 2.54)
  high_f: number
  low_f: number
  wind_mph: number
  weather_code: number
  precipitation_in: number
}

export function cmToInchesF(cm: number): number {
  return Math.round((cm / 2.54) * 10) / 10
}

export function weatherCodeToLabel(code: number): string {
  if (code === 0) return 'Clear'
  if (code <= 3) return 'Partly Cloudy'
  if (code <= 49) return 'Fog'
  if (code <= 59) return 'Drizzle'
  if (code <= 69) return 'Rain'
  if (code <= 79) return 'Snow'
  if (code <= 82) return 'Rain Showers'
  if (code <= 86) return 'Snow Showers'
  if (code <= 99) return 'Thunderstorm'
  return 'Unknown'
}

export function weatherCodeToIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 49) return '🌫️'
  if (code <= 59) return '🌦️'
  if (code <= 69) return '🌧️'
  if (code <= 79) return '🌨️'
  if (code <= 82) return '🌦️'
  if (code <= 86) return '❄️'
  if (code <= 99) return '⛈️'
  return '🌡️'
}
