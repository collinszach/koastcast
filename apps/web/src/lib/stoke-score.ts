/**
 * Client-side Stoke Score computation.
 *
 * Computes a 0-10 quality score for a spot based on current/forecast conditions
 * compared to the spot's optimal parameters. No backend needed.
 */

export interface StokeInput {
  waveHeight: number | null    // meters
  wavePeriod: number | null    // seconds
  waveDirection: number | null // degrees (0-360)
  windSpeed: number | null     // m/s
  windDirection: number | null // degrees
}

export interface SpotOptimal {
  optimal_swell_direction: number
  optimal_swell_direction_range: number
  optimal_wind_direction: number
  optimal_size_min: number  // meters
  optimal_size_max: number  // meters
  optimal_period_min: number
  optimal_period_max: number
}

export interface StokeResult {
  score: number         // 0-10
  label: string         // "Epic", "Good", "Fair", "Poor", "Flat"
  color: string         // hex color
  components: {
    swell_direction: number  // 0-1
    wind: number             // 0-1
    size: number             // 0-1
    period: number           // 0-1
  }
}

/** Smallest angular difference between two compass bearings */
function angleDiff(a: number, b: number): number {
  let d = ((a - b) % 360 + 360) % 360
  if (d > 180) d = 360 - d
  return d
}

/** Classify wind relative to optimal (offshore) direction */
function windScore(windDir: number | null, windSpeed: number | null, optimalWindDir: number): number {
  if (windDir == null || windSpeed == null) return 0.5 // unknown = neutral
  if (windSpeed < 2) return 0.95 // glassy conditions

  const diff = angleDiff(windDir, optimalWindDir)
  // 0 = perfect offshore, 180 = dead onshore
  if (diff <= 30) return 1.0
  if (diff <= 60) return 0.8
  if (diff <= 90) return 0.55
  if (diff <= 120) return 0.3
  if (diff <= 150) return 0.15
  return 0.05 // dead onshore
}

export function computeStokeScore(input: StokeInput, spot: SpotOptimal): StokeResult {
  const { waveHeight, wavePeriod, waveDirection, windSpeed, windDirection } = input

  // If no wave data at all, return flat
  if (waveHeight == null || waveHeight < 0.1) {
    return { score: 0, label: 'Flat', color: '#6B7280', components: { swell_direction: 0, wind: 0, size: 0, period: 0 } }
  }

  // Swell direction score (0-1)
  let swellDirScore = 0.5
  if (waveDirection != null) {
    const diff = angleDiff(waveDirection, spot.optimal_swell_direction)
    const range = spot.optimal_swell_direction_range || 45
    swellDirScore = Math.max(0, 1 - diff / range)
  }

  // Wind score (0-1)
  const wind = windScore(windDirection, windSpeed, spot.optimal_wind_direction)

  // Size score (0-1) — 1.0 within range, linear decay outside
  let sizeScore = 1.0
  if (waveHeight < spot.optimal_size_min) {
    sizeScore = Math.max(0, waveHeight / spot.optimal_size_min)
  } else if (waveHeight > spot.optimal_size_max) {
    const excess = waveHeight - spot.optimal_size_max
    const range = spot.optimal_size_max - spot.optimal_size_min
    sizeScore = Math.max(0, 1 - excess / (range || 1))
  }

  // Period score (0-1)
  let periodScore = 0.5
  if (wavePeriod != null) {
    if (wavePeriod >= spot.optimal_period_min) {
      periodScore = Math.min(1, (wavePeriod - 6) / (spot.optimal_period_min - 6 || 4))
    } else {
      periodScore = Math.max(0, (wavePeriod - 6) / (spot.optimal_period_min - 6 || 4))
    }
  }

  // Weighted total
  const total = (swellDirScore * 0.25 + wind * 0.30 + sizeScore * 0.25 + periodScore * 0.20) * 10
  const score = Math.round(total * 10) / 10 // one decimal

  // Label and color
  let label: string
  let color: string
  if (score >= 8) { label = 'Epic'; color = '#10B981' }
  else if (score >= 6) { label = 'Good'; color = '#06B6D4' }
  else if (score >= 4) { label = 'Fair'; color = '#F59E0B' }
  else if (score >= 2) { label = 'Poor'; color = '#F97316' }
  else { label = 'Flat'; color = '#6B7280' }

  // Contextual summary override
  if (waveHeight < 0.3) { label = 'Flat'; color = '#6B7280' }
  if (wind < 0.2 && sizeScore > 0.5) { label = 'Blown Out'; color = '#EF4444' }

  return {
    score: Math.max(0, Math.min(10, score)),
    label,
    color,
    components: {
      swell_direction: Math.round(swellDirScore * 100) / 100,
      wind: Math.round(wind * 100) / 100,
      size: Math.round(sizeScore * 100) / 100,
      period: Math.round(periodScore * 100) / 100,
    },
  }
}

/** Generate a short text description from score components */
export function scoreSummary(result: StokeResult, waveHeight: number | null): string {
  if (!waveHeight || waveHeight < 0.2) return 'Flat — check back tomorrow'
  if (result.score >= 8) return 'Pumping and clean'
  if (result.score >= 6.5 && result.components.wind >= 0.8) return 'Clean and fun'
  if (result.score >= 6) return 'Good conditions'
  if (result.score >= 4 && result.components.wind < 0.4) return 'Rideable but textured'
  if (result.score >= 4) return 'Fair — catchable waves'
  if (result.components.wind < 0.2) return 'Blown out'
  return 'Not worth the drive'
}
