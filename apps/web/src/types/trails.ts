export interface Trail {
  id: string
  name: string
  slug: string
  lat: number
  lng: number
  region: string
  state: string
  country: string
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  trail_type: 'day_hike' | 'backpacking' | 'thru_hike' | 'scramble' | 'via_ferrata'
  length_miles: number
  elevation_gain_ft: number
  summit_elevation_ft?: number
  best_months: string[]
  permit_required: boolean
  dog_friendly: boolean
  nearest_weather_station?: string
  description: string
  tags: string[]
  current_conditions?: TrailConditions | null
}

export interface TrailConditions {
  temperature_f: number
  wind_speed_mph: number
  wind_direction: string
  conditions: 'clear' | 'cloudy' | 'rain' | 'snow' | 'fog' | 'thunderstorm'
  snow_coverage: 'none' | 'patchy' | 'partial' | 'full'
  trail_status: 'open' | 'closed' | 'caution' | 'unknown'
  hazards: string[]
  conditions_score: number
  updated_at: string
}

export type TrailConditionLabel = 'prime' | 'good' | 'fair' | 'caution' | 'closed' | 'no_data'

export function getTrailConditionLabel(score?: number | null, status?: string): TrailConditionLabel {
  if (status === 'closed') return 'closed'
  if (score == null) return 'no_data'
  if (score >= 80) return 'prime'
  if (score >= 60) return 'good'
  if (score >= 40) return 'fair'
  if (score >= 20) return 'caution'
  return 'closed'
}

export const DIFFICULTY_COLORS = {
  beginner:     '#10B981',
  intermediate: '#3B82F6',
  advanced:     '#F97316',
  expert:       '#EF4444',
} as const

export const DIFFICULTY_LABELS = {
  beginner:     'BEGINNER',
  intermediate: 'INTERMEDIATE',
  advanced:     'ADVANCED',
  expert:       'EXPERT',
} as const

export const TRAIL_TYPE_LABELS: Record<Trail['trail_type'], string> = {
  day_hike:    'Day Hike',
  backpacking: 'Backpacking',
  thru_hike:   'Thru Hike',
  scramble:    'Scramble',
  via_ferrata: 'Via Ferrata',
}
