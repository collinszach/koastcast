/**
 * Conditions Intelligence Engine
 *
 * Generates plain-English, spot-specific condition summaries from forecast data.
 * No LLM required — rule-based template system trained on surf domain knowledge.
 *
 * This is the "Just tell me what it means" feature. Surfers know the numbers;
 * they want the app to explain the compound effect at their specific break.
 */

import type { Spot, ForecastHour } from '@/types'

export interface BestWindow {
  start: string   // ISO timestamp
  end: string     // ISO timestamp
  reason: string
  quality: number
}

export interface ConditionsIntelligence {
  headline: string
  summary: string
  keyFactors: string[]
  bestWindow: BestWindow | null
  overallAssessment: 'firing' | 'pumping' | 'fun' | 'worth_it' | 'flat'
  confidenceNote: string | null
  warningSigns: string[]
}

// ─── Direction helpers ────────────────────────────────────────────────────────

function compassPoint(deg: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
                'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function windType(
  windDir: number,
  offshoreDir: number
): 'offshore' | 'cross-offshore' | 'cross-onshore' | 'onshore' {
  const diff = angleDiff(windDir, offshoreDir)
  if (diff <= 30) return 'offshore'
  if (diff <= 60) return 'cross-offshore'
  if (diff <= 90) return 'cross-onshore'
  return 'onshore'
}

// ─── Swell descriptions ───────────────────────────────────────────────────────

function describeHeight(faceM: number): string {
  const ft = faceM * 3.28
  if (ft < 1.5) return 'ankle- to knee-high'
  if (ft < 2.5) return 'knee- to waist-high'
  if (ft < 3.5) return 'waist- to chest-high'
  if (ft < 5) return 'chest- to head-high'
  if (ft < 7) return 'overhead'
  if (ft < 10) return 'well overhead'
  if (ft < 15) return 'double overhead'
  return 'XXL big-wave territory'
}

function describePeriod(periodS: number): string {
  if (periodS < 8) return 'short-period windswell (choppy, disorganized)'
  if (periodS < 11) return 'moderate-period swell (some push)'
  if (periodS < 14) return 'solid groundswell (good power and shape)'
  if (periodS < 17) return 'long-period groundswell (powerful, well-organized)'
  return 'extreme long-period groundswell (maximum power and size)'
}

function describeDirectionFit(
  swellDir: number,
  optimalDir: number,
  optimalRange: number,
  breakType: string
): { description: string; isGood: boolean } {
  const diff = angleDiff(swellDir, optimalDir)
  if (diff <= optimalRange * 0.5) {
    return {
      description: `ideal ${compassPoint(swellDir)} angle for this ${breakType}`,
      isGood: true,
    }
  }
  if (diff <= optimalRange) {
    return {
      description: `${compassPoint(swellDir)} swell — slightly off-angle but still working`,
      isGood: true,
    }
  }
  if (diff <= optimalRange * 1.5) {
    return {
      description: `${compassPoint(swellDir)} swell — suboptimal angle, expect reduced power`,
      isGood: false,
    }
  }
  return {
    description: `${compassPoint(swellDir)} swell — wrong direction for this spot`,
    isGood: false,
  }
}

function describeWind(
  windSpeedMs: number,
  windDir: number,
  offshoreDir: number
): { description: string; isGood: boolean } {
  const type = windType(windDir, offshoreDir)
  const kts = Math.round(windSpeedMs * 1.944)
  const dir = compassPoint(windDir)

  if (windSpeedMs < 2) {
    return { description: 'glassy calm conditions', isGood: true }
  }

  switch (type) {
    case 'offshore':
      if (windSpeedMs < 5) return { description: `light ${dir} offshore (${kts}kts) — perfect grooming`, isGood: true }
      if (windSpeedMs < 10) return { description: `${dir} offshore at ${kts}kts — clean faces`, isGood: true }
      return { description: `strong ${dir} offshore at ${kts}kts — may be blown out at the peaks`, isGood: false }
    case 'cross-offshore':
      return { description: `${dir} cross-offshore at ${kts}kts — mostly clean`, isGood: true }
    case 'cross-onshore':
      return { description: `${dir} cross-shore at ${kts}kts — slightly textured faces`, isGood: false }
    case 'onshore':
      if (windSpeedMs < 5) return { description: `light ${dir} onshore (${kts}kts) — textured but manageable`, isGood: false }
      return { description: `${dir} onshore at ${kts}kts — messy, choppy conditions`, isGood: false }
  }
}

function describeTide(tideM: number | null, tideState: string | null): string | null {
  if (tideM == null) return null
  const stateStr = tideState === 'rising' ? 'and rising' :
                   tideState === 'falling' ? 'and dropping' :
                   tideState === 'high' ? 'at high' :
                   tideState === 'low' ? 'at low' : ''
  const ft = (tideM * 3.28).toFixed(1)
  return `Tide at ${ft}ft ${stateStr}`
}

// ─── Best window finder ───────────────────────────────────────────────────────

function findBestWindow(hours: ForecastHour[]): BestWindow | null {
  // Look at next 72h, find the highest-scoring 3-hour block
  const window72 = hours.slice(0, 72)
  if (window72.length < 3) return null

  let bestScore = 0
  let bestIdx = -1

  for (let i = 0; i < window72.length - 2; i++) {
    const h = window72[i]
    if (h.quality_score == null) continue
    // Prefer morning hours (dawn patrol = 5-10am)
    const hour = new Date(h.forecast_time).getUTCHours()
    const morningBonus = (hour >= 5 && hour <= 10) ? 0.5 : 0
    const score = h.quality_score + morningBonus
    if (score > bestScore) {
      bestScore = score
      bestIdx = i
    }
  }

  if (bestIdx < 0 || bestScore < 3) return null

  const startHour = window72[bestIdx]
  const endHour = window72[Math.min(bestIdx + 3, window72.length - 1)]

  const reasons: string[] = []
  if ((startHour.wave_period_s ?? 0) >= 12) reasons.push(`${startHour.wave_period_s}s groundswell`)
  if (startHour.wind_speed_ms != null && startHour.wind_direction != null) {
    const wt = windType(startHour.wind_direction, 100) // approximate
    if (wt === 'offshore' || wt === 'cross-offshore') reasons.push('offshore winds')
  }
  if (startHour.tide_state === 'rising') reasons.push('rising tide')
  if (startHour.wave_height_face_m != null) {
    reasons.push(`${describeHeight(startHour.wave_height_face_m)}`)
  }

  return {
    start: startHour.forecast_time,
    end: endHour.forecast_time,
    reason: reasons.length > 0
      ? reasons.join(', ')
      : `quality score ${(startHour.quality_score ?? 0).toFixed(1)}/10`,
    quality: startHour.quality_score ?? 0,
  }
}

// ─── Warning detector ─────────────────────────────────────────────────────────

function detectWarnings(
  hours: ForecastHour[],
  spot: Spot
): string[] {
  const warnings: string[] = []
  const current = hours[0]
  if (!current) return warnings

  // Rip current risk: large + short period = chaotic water movement
  const h = current.wave_height_m ?? 0
  const p = current.wave_period_s ?? 10
  if (h > 2.5 && p < 10) {
    warnings.push('Short-period swell may generate strong rip currents — know your exits')
  }

  // High surf
  if ((current.wave_height_face_m ?? 0) > 3) {
    if (spot.skill_minimum === 'beginner' || !spot.skill_minimum) {
      warnings.push('Larger surf than typical for this break — assess conditions before paddling out')
    }
  }

  // Strong onshore wind
  const wt = current.wind_direction != null && spot.optimal_wind_direction != null
    ? windType(current.wind_direction, spot.optimal_wind_direction)
    : null
  if (wt === 'onshore' && (current.wind_speed_ms ?? 0) > 10) {
    warnings.push('Strong onshore wind — difficult paddling conditions')
  }

  // Dropping tide at shallow reef
  if (spot.break_type === 'reef' && current.tide_state === 'falling') {
    const tideFt = (current.tide_height_m ?? 1.5) * 3.28
    if (tideFt < 2.0) {
      warnings.push('Dropping tide approaching low — shallow reef hazard, watch your timing')
    }
  }

  return warnings
}

// ─── Main generator ───────────────────────────────────────────────────────────

export function generateConditionsIntelligence(
  spot: Spot,
  hours: ForecastHour[]
): ConditionsIntelligence {
  const current = hours[0]

  if (!current || !hours.length) {
    return {
      headline: 'No forecast data available',
      summary: 'Forecast data is currently unavailable for this spot. Check back shortly.',
      keyFactors: [],
      bestWindow: null,
      overallAssessment: 'flat',
      confidenceNote: null,
      warningSigns: [],
    }
  }

  const faceH = current.wave_height_face_m ?? current.wave_height_m ?? 0
  const period = current.wave_period_s ?? 0
  const swellDir = current.swell_direction ?? current.wave_direction ?? 270
  const windSpd = current.wind_speed_ms ?? 0
  const windDir = current.wind_direction ?? (spot.optimal_wind_direction ?? 90)
  const optimalDir = spot.optimal_swell_direction ?? 270
  const optimalRange = spot.optimal_swell_direction_range ?? 45
  const offshoreDir = spot.optimal_wind_direction ?? 90
  const quality = current.quality_score ?? 0

  // Assess each factor
  const dirFit = describeDirectionFit(swellDir, optimalDir, optimalRange, spot.break_type)
  const windDesc = describeWind(windSpd, windDir, offshoreDir)
  const tideNote = describeTide(current.tide_height_m ?? null, current.tide_state ?? null)
  const heightDesc = describeHeight(faceH)
  const periodDesc = describePeriod(period)

  // Headline
  const headline = buildHeadline(faceH, period, swellDir, windSpd, windDir, offshoreDir, quality)

  // Key factors
  const keyFactors: string[] = []
  if (faceH > 0.3) keyFactors.push(`${heightDesc} waves`)
  if (period > 0) keyFactors.push(`${period}s ${period >= 12 ? 'groundswell' : 'swell'}`)
  keyFactors.push(windDesc.description)
  if (tideNote) keyFactors.push(tideNote)
  if (dirFit.isGood) {
    keyFactors.push(`${compassPoint(swellDir)} swell angle working for this break`)
  }

  // Model agreement note
  let confidenceNote: string | null = null
  if (current.model_agreement != null) {
    if (current.model_agreement > 0.8) {
      confidenceNote = 'High confidence — 3 forecast models agree'
    } else if (current.model_agreement < 0.5) {
      confidenceNote = 'Uncertain forecast — models disagree, conditions may differ'
    }
  }

  // Summary paragraph
  const summary = buildSummary(
    spot, faceH, period, swellDir, optimalDir, optimalRange,
    windSpd, windDir, offshoreDir, current.tide_height_m ?? null, current.tide_state ?? null,
    dirFit, windDesc, quality
  )

  // Best window
  const bestWindow = findBestWindow(hours)

  // Warnings
  const warningSigns = detectWarnings(hours, spot)

  // Overall assessment
  const overallAssessment = quality >= 8 ? 'firing' :
    quality >= 6.5 ? 'pumping' :
    quality >= 5 ? 'fun' :
    quality >= 3.5 ? 'worth_it' : 'flat'

  return {
    headline,
    summary,
    keyFactors,
    bestWindow,
    overallAssessment,
    confidenceNote,
    warningSigns,
  }
}

function buildHeadline(
  faceM: number,
  period: number,
  swellDir: number,
  windSpd: number,
  windDir: number,
  offshoreDir: number,
  quality: number
): string {
  const dir = compassPoint(swellDir)
  const ft = (faceM * 3.28).toFixed(0)
  const wType = windType(windDir, offshoreDir)

  if (faceM < 0.3) return 'Flat — no rideable surf'
  if (quality >= 8) return `${ft}ft ${dir} ${period >= 14 ? 'groundswell' : 'swell'} — firing`
  if (wType === 'offshore' && period >= 12) {
    return `Clean ${ft}ft ${dir} groundswell, offshore winds`
  }
  if (wType === 'onshore' && windSpd > 8) {
    return `${ft}ft ${dir} swell but messy — onshore winds`
  }
  return `${ft}ft ${dir} ${period >= 12 ? 'groundswell' : 'swell'} @ ${period}s`
}

function buildSummary(
  spot: Spot,
  faceM: number,
  period: number,
  swellDir: number,
  optimalDir: number,
  optimalRange: number,
  windSpd: number,
  windDir: number,
  offshoreDir: number,
  tideM: number | null,
  tideState: string | null,
  dirFit: { description: string; isGood: boolean },
  windDesc: { description: string; isGood: boolean },
  quality: number
): string {
  const sentences: string[] = []
  const ft = (faceM * 3.28).toFixed(0)
  const dir = compassPoint(swellDir)

  if (faceM < 0.3) {
    return `${spot.name} is flat right now — nothing worth paddling out for. Check back when a new swell arrives.`
  }

  // Swell sentence
  const swellChar = period >= 14 ? 'long-period groundswell' :
    period >= 11 ? 'solid groundswell' :
    period >= 8 ? 'moderate swell' : 'short-period windswell'
  sentences.push(
    `A ${ft}ft ${dir} ${swellChar} is hitting ${spot.name} — ${dirFit.description}.`
  )

  // Period implication
  if (period >= 14) {
    sentences.push(`The ${period}s period means well-organized sets with significant power — give yourself time between waves.`)
  } else if (period < 8) {
    sentences.push(`At ${period}s, this is choppy windswell — expect irregular sets and less power than the height suggests.`)
  }

  // Wind sentence
  const wType = windType(windDir, offshoreDir)
  if (wType === 'offshore') {
    const kts = Math.round(windSpd * 1.944)
    sentences.push(`${compassPoint(windDir)} offshore winds at ${kts}kts are grooming the faces — ideal conditions.`)
  } else if (wType === 'onshore') {
    sentences.push(`The ${compassPoint(windDir)} onshore wind is ${windSpd > 8 ? 'significantly degrading' : 'slightly affecting'} conditions — expect textured faces.`)
  } else {
    sentences.push(`Wind is ${windDesc.description}.`)
  }

  // Tide sentence
  if (tideM != null && tideState) {
    const tideFt = (tideM * 3.28).toFixed(1)
    if (spot.break_type === 'reef') {
      if (tideState === 'low' || (tideState === 'falling' && tideM < 0.5)) {
        sentences.push(`Tide is low at ${tideFt}ft — the reef is shallow, use caution and be precise with your entry/exit.`)
      } else if (tideState === 'rising') {
        sentences.push(`Tide is rising at ${tideFt}ft — conditions typically improve as the water pushes through on this reef.`)
      }
    } else if (spot.break_type === 'beach') {
      sentences.push(`Tide at ${tideFt}ft and ${tideState} — sandbars are most exposed on the lower tide.`)
    }
  }

  // Closing assessment
  if (quality >= 8) {
    sentences.push(`This is as good as it gets here — if you can go, go now.`)
  } else if (quality >= 6) {
    sentences.push(`Overall a solid session is on offer for the right skill level.`)
  } else if (quality < 3.5) {
    sentences.push(`Conditions aren't ideal today — worth checking in person before committing to the drive.`)
  }

  return sentences.join(' ')
}
