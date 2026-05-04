/**
 * nSwell shared TypeScript types
 */

export interface SpotCam {
  label: string
  type: 'youtube' | 'image' | 'iframe'
  embed_id: string
  angle?: string
}

export interface Spot {
  id?: string
  name: string
  slug: string
  lat: number
  lng: number
  region: string
  country: string
  break_type: string
  optimal_swell_direction?: number
  optimal_swell_direction_range: number
  optimal_wind_direction?: number
  optimal_period_min: number
  optimal_period_max: number
  optimal_size_min: number
  optimal_size_max: number
  nearest_buoy_id?: string
  secondary_buoy_id?: string
  swan_enabled: boolean
  timezone: string
  description?: string
  skill_minimum?: string
  cams?: SpotCam[]
  current_conditions?: CurrentConditions | null
}

export interface CurrentConditions {
  wave_height_face_m?: number | null
  wave_period_s?: number | null
  wave_direction?: number | null
  wind_speed_ms?: number | null
  wind_direction?: number | null
  tide_height_m?: number | null
  tide_state?: string | null
  quality_score?: number | null
  forecast_time?: string | null
  model_source?: string | null
  water_temp_c?: number | null
}

export interface ForecastHour {
  forecast_time: string
  model_source: string
  wave_height_m?: number | null
  wave_height_face_m?: number | null
  wave_period_s?: number | null
  wave_direction?: number | null
  swell_height_m?: number | null
  swell_period_s?: number | null
  swell_direction?: number | null
  wind_swell_height_m?: number | null
  wind_swell_period_s?: number | null
  wind_swell_direction?: number | null
  wind_speed_ms?: number | null
  wind_direction?: number | null
  wind_gust_ms?: number | null
  tide_height_m?: number | null
  tide_state?: string | null
  quality_score?: number | null
  confidence?: number | null
  wave_spectrum?: Record<string, number> | null
  water_temp_c?: number | null
  crowd_score?: number | null
  crowd_label?: string | null
  model_agreement?: number | null
  model_agreement_label?: 'agree' | 'mild_disagreement' | 'disagree' | null
}

export interface ForecastResponse {
  spot_id: string
  spot_slug: string
  generated_at: string
  hours: ForecastHour[]
  days_available: number
  model_sources: string[]
  ensemble_mode?: boolean
  model_forecasts?: Record<string, ForecastHour[]> | null
}

export interface BuoyObservation {
  station_id: string
  observed_at: string
  wvht?: number | null
  dpd?: number | null
  apd?: number | null
  mwd?: number | null
  wspd?: number | null
  wdir?: number | null
  atmp?: number | null
  wtmp?: number | null
}

export type ConditionLabel = 'firing' | 'pumping' | 'fun' | 'worth_it' | 'flat' | 'no_data'

export function getConditionLabel(qualityScore?: number | null): ConditionLabel {
  if (qualityScore == null) return 'no_data'
  if (qualityScore >= 8) return 'firing'
  if (qualityScore >= 6) return 'pumping'
  if (qualityScore >= 4) return 'fun'
  if (qualityScore >= 2) return 'worth_it'
  return 'flat'
}

export function getConditionColor(label: ConditionLabel): string {
  const colors: Record<ConditionLabel, string> = {
    firing: '#ef4444',     // red-500
    pumping: '#f97316',    // orange-500
    fun: '#22c55e',        // green-500
    worth_it: '#3b82f6',   // blue-500
    flat: '#6b7280',       // gray-500
    no_data: '#374151',    // gray-700
  }
  return colors[label]
}

export function getConditionEmoji(label: ConditionLabel): string {
  const emojis: Record<ConditionLabel, string> = {
    firing: 'FIRING',
    pumping: 'PUMPING',
    fun: 'FUN',
    worth_it: 'WORTH IT',
    flat: 'FLAT',
    no_data: 'NO DATA',
  }
  return emojis[label]
}

/**
 * Format wave height for display.
 * Converts meters to feet (Hawaiian) or keeps in meters.
 */
export function formatWaveHeight(
  heightM?: number | null,
  unit: 'ft' | 'm' = 'ft',
): string {
  if (heightM == null) return '--'
  if (unit === 'ft') {
    // Face height in feet (Hawaiian scale ≈ 0.85x, but we display as face feet)
    return `${(heightM * 3.281).toFixed(0)}ft`
  }
  return `${heightM.toFixed(1)}m`
}

export function formatPeriod(periodS?: number | null): string {
  if (periodS == null) return '--'
  return `${periodS.toFixed(0)}s`
}

export function formatWindSpeed(speedMs?: number | null): string {
  if (speedMs == null) return '--'
  return `${(speedMs * 1.944).toFixed(0)}kt`
}

export function directionArrow(degrees?: number | null): string {
  if (degrees == null) return '--'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(degrees / 45) % 8]
}
