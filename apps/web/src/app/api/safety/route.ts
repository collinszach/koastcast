/**
 * Next.js API route: /api/safety?spotId={slug}
 *
 * Returns real safety data derived from:
 * - Open-Meteo precipitation (last 72h) → water quality / post-rain bacterial risk
 * - Open-Meteo Marine API (wave height + period) → rip current heuristic
 * - Open-Meteo UV index → sun/UV advisory
 * - spots.json metadata → static hazards per break type / skill level
 *
 * Caches for 1 hour (safety data doesn't need sub-hour freshness).
 * Never returns 500 — degrades gracefully to 'unknown' if upstream fails.
 */

import { NextRequest, NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type RipLevel = 'low' | 'moderate' | 'high' | 'extreme' | 'unknown'
type OverallRisk = 'low' | 'moderate' | 'high' | 'extreme' | 'unknown'

interface WaterQuality {
  safe: boolean
  reason: string
  advisory?: string
  post_rain_hours?: number
}

interface RipCurrent {
  risk_level: RipLevel
  description: string
  source: string
}

interface SurfAdvisory {
  active: boolean
  type: string
  headline?: string
  description?: string
}

interface SafetyResponse {
  water_quality: WaterQuality
  rip_current: RipCurrent
  surf_advisory: SurfAdvisory | null
  static_hazards: string[]
  overall_risk: OverallRisk
}

interface Spot {
  name: string
  slug: string
  lat: number
  lng: number
  break_type: string
  description?: string
  skill_minimum?: string
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadSpots(): Spot[] {
  const spotsPath = path.join(process.cwd(), 'data', 'spots.json')
  const raw = fs.readFileSync(spotsPath, 'utf-8')
  return JSON.parse(raw) as Spot[]
}

/** Return a safe fallback response when all upstream data is unavailable. */
function fallbackResponse(reason: string): SafetyResponse {
  return {
    water_quality: {
      safe: true,
      reason: `Water quality data temporarily unavailable (${reason}). Check local beach advisories.`,
    },
    rip_current: {
      risk_level: 'unknown',
      description: 'Rip current data temporarily unavailable. Assess conditions on arrival and consult lifeguards.',
      source: 'Open-Meteo (unavailable)',
    },
    surf_advisory: null,
    static_hazards: [
      'Always surf with a buddy — never surf alone in large surf',
      'Check current conditions with a lifeguard or local before paddling out',
    ],
    overall_risk: 'unknown',
  }
}

// ---------------------------------------------------------------------------
// Step 2: Fetch Open-Meteo data (three parallel calls)
// ---------------------------------------------------------------------------

interface PrecipData {
  hourly: { time: string[]; precipitation: (number | null)[] }
}

interface MarineData {
  hourly: {
    time: string[]
    wave_height: (number | null)[]
    wave_period: (number | null)[]
    wave_direction: (number | null)[]
  }
}

interface UVData {
  hourly: { time: string[]; uv_index: (number | null)[] }
}

async function fetchPrecip(lat: number, lng: number): Promise<PrecipData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=precipitation&past_days=3&forecast_days=1&timezone=auto`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as PrecipData
  } catch {
    return null
  }
}

async function fetchMarine(lat: number, lng: number): Promise<MarineData | null> {
  try {
    const url =
      `https://marine-api.open-meteo.com/v1/marine` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=wave_height,wave_period,wave_direction&forecast_days=1&timezone=auto`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as MarineData
  } catch {
    return null
  }
}

async function fetchUV(lat: number, lng: number): Promise<UVData | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast` +
      `?latitude=${lat}&longitude=${lng}` +
      `&hourly=uv_index&forecast_days=1&timezone=auto`
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    return (await res.json()) as UVData
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Step 3: Water quality from precipitation
// ---------------------------------------------------------------------------

function assessWaterQuality(precip: PrecipData | null): WaterQuality {
  if (!precip) {
    return {
      safe: true,
      reason: 'Precipitation data unavailable — check local beach water quality advisories.',
    }
  }

  // Take the last 72 values (3 past days × 24 hours)
  const values = precip.hourly.precipitation
  const last72 = values.slice(-72)
  const total = last72.reduce((sum: number, v) => sum + (v ?? 0), 0)

  // Find how many hours ago it last rained meaningfully (>0.5mm in an hour)
  let hoursAgoLastRain: number | null = null
  for (let i = last72.length - 1; i >= 0; i--) {
    if ((last72[i] ?? 0) > 0.5) {
      hoursAgoLastRain = last72.length - 1 - i
      break
    }
  }

  if (total > 25) {
    const remainingHours =
      hoursAgoLastRain !== null ? Math.max(0, Math.round(72 - hoursAgoLastRain)) : 72
    return {
      safe: false,
      reason: `Heavy rainfall in the last 72 hours (${total.toFixed(0)}mm total) — high bacterial contamination risk from stormwater runoff.`,
      advisory:
        'Avoid surfing within 72 hours of significant rain, especially near creek and river outlets.',
      post_rain_hours: remainingHours > 0 ? remainingHours : undefined,
    }
  }

  if (total > 10) {
    return {
      safe: false,
      reason: `Recent rainfall detected (${total.toFixed(0)}mm over 72 hours) — elevated contamination risk from urban runoff.`,
      advisory: 'Consider waiting 24–48 hours before surfing, particularly near storm drains.',
    }
  }

  if (total > 2) {
    return {
      safe: true,
      reason: `Minor recent rainfall (${total.toFixed(0)}mm over 72 hours) — slightly elevated risk near storm drains and creek outlets.`,
    }
  }

  return {
    safe: true,
    reason: 'No significant rainfall in the last 72 hours — water quality nominal.',
  }
}

// ---------------------------------------------------------------------------
// Step 4: Rip current heuristic from marine data
// ---------------------------------------------------------------------------

function assessRipCurrent(marine: MarineData | null, spot: Spot): RipCurrent {
  if (!marine) {
    return {
      risk_level: 'unknown',
      description:
        'Marine data unavailable. Assess rip current risk on arrival — look for discolored, choppy water moving seaward.',
      source: 'Open-Meteo Marine API (unavailable)',
    }
  }

  // Find current hour index
  const now = new Date()
  let currentHourIdx = marine.hourly.time.findIndex(t => new Date(t) >= now) - 1
  if (currentHourIdx < 0) currentHourIdx = 0

  const waveHeight = marine.hourly.wave_height[currentHourIdx] ?? 0
  const wavePeriod = marine.hourly.wave_period[currentHourIdx] ?? 0

  let ripScore = 0

  // Wave height contribution
  if (waveHeight > 2.5) ripScore += 3
  else if (waveHeight > 1.5) ripScore += 2
  else if (waveHeight > 0.8) ripScore += 1

  // Period contribution (longer = more powerful = stronger rips)
  if (wavePeriod > 15) ripScore += 2
  else if (wavePeriod > 12) ripScore += 1

  // Break-type contribution
  if (spot.break_type === 'beach') ripScore += 1
  if (spot.break_type === 'rivermouth') ripScore += 2

  const heightFt = (waveHeight * 3.28).toFixed(0)
  const periodStr = wavePeriod.toFixed(0)

  let risk_level: RipLevel
  let description: string

  if (ripScore >= 5) {
    risk_level = 'extreme'
    description =
      `Powerful rip currents likely. Significant wave energy (${heightFt}ft @ ${periodStr}s) combined with ` +
      `${spot.break_type} break configuration creates dangerous rip channels. Experienced surfers only.`
  } else if (ripScore >= 3) {
    risk_level = 'high'
    description =
      `Strong rip currents possible. ${heightFt}ft surf is pulling water back through channels. ` +
      `Know how to identify and escape rips before paddling out.`
  } else if (ripScore >= 2) {
    risk_level = 'moderate'
    description =
      `Moderate rip current risk in current conditions (${heightFt}ft @ ${periodStr}s). ` +
      `Standard beach safety awareness recommended — always surf near a lifeguard when possible.`
  } else {
    risk_level = 'low'
    description = `Low rip current risk in current conditions (${heightFt}ft @ ${periodStr}s). Standard ocean awareness applies.`
  }

  return {
    risk_level,
    description,
    source: 'Open-Meteo Marine API + wave energy heuristic',
  }
}

// ---------------------------------------------------------------------------
// Step 5: UV advisory
// ---------------------------------------------------------------------------

function assessUVAdvisory(uv: UVData | null, marine: MarineData | null): SurfAdvisory | null {
  if (!uv) return null

  // Use same hour index logic as marine
  const now = new Date()
  let idx = uv.hourly.time.findIndex(t => new Date(t) >= now) - 1
  if (idx < 0) idx = 0

  const currentUV = uv.hourly.uv_index[idx] ?? 0

  if (currentUV >= 8) {
    return {
      active: true,
      type: 'UV_ADVISORY',
      headline: `Extreme UV index (${currentUV.toFixed(0)}) — sun protection required`,
      description:
        'Apply SPF 50+ sunscreen and reapply every 80 minutes in the water. Consider a full rashguard. UV radiation is significantly elevated today.',
    }
  }

  if (currentUV >= 6) {
    return {
      active: true,
      type: 'UV_ADVISORY',
      headline: `High UV index (${currentUV.toFixed(0)}) — apply sunscreen`,
      description: 'Apply SPF 30+ before paddling out and reapply every 2 hours. Face and neck are most exposed.',
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Step 6: Static hazards from spot metadata
// ---------------------------------------------------------------------------

function buildStaticHazards(spot: Spot): string[] {
  const hazards: string[] = []

  // Skill-level gate — prepend as a prominent warning
  if (spot.skill_minimum === 'advanced' || spot.skill_minimum === 'pro') {
    hazards.push(`${spot.name} is recommended for ${spot.skill_minimum} surfers only — assess your ability honestly`)
  }

  // Break-type specific hazards
  switch (spot.break_type) {
    case 'reef':
      hazards.push('Shallow reef — wear booties and a helmet in larger surf; avoid wipeouts at low tide')
      break
    case 'point':
      hazards.push('Rocky point entry/exit — scout the channel before paddling out; use booties on sharp rock')
      break
    case 'rivermouth':
      hazards.push('River current intensifies on outgoing tide — be aware of flow direction and drift')
      break
    case 'beach':
      // No additional static hazard beyond universal ones
      break
  }

  // Universal ocean safety
  hazards.push('Always surf with a buddy — never surf alone in large or unfamiliar surf')
  hazards.push('Check current conditions with a lifeguard or local before paddling out')

  return hazards
}

// ---------------------------------------------------------------------------
// Step 7: Overall risk
// ---------------------------------------------------------------------------

const RISK_LEVELS: Record<string, number> = {
  unknown: 0,
  low: 1,
  moderate: 2,
  high: 3,
  extreme: 4,
}

function computeOverallRisk(
  waterQuality: WaterQuality,
  ripCurrent: RipCurrent,
  surfAdvisory: SurfAdvisory | null,
): OverallRisk {
  const scores: number[] = [
    RISK_LEVELS[ripCurrent.risk_level] ?? 0,
    waterQuality.safe ? 1 : 3,
    surfAdvisory?.active ? 2 : 1,
  ]

  const maxScore = Math.max(...scores)
  const match = Object.entries(RISK_LEVELS).find(([, v]) => v === maxScore)
  return (match?.[0] ?? 'low') as OverallRisk
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spotId')

  if (!spotId) {
    return NextResponse.json({ error: 'spotId required' }, { status: 400 })
  }

  // Load spots
  let spots: Spot[]
  try {
    spots = loadSpots()
  } catch (err) {
    console.error('[safety] Failed to load spots.json:', err)
    return NextResponse.json(fallbackResponse('spots data unavailable'))
  }

  const spot = spots.find(s => s.slug === spotId)
  if (!spot) {
    return NextResponse.json({ error: 'Spot not found' }, { status: 404 })
  }

  // Fetch all three data sources in parallel; failures are caught inside each helper
  let precip: PrecipData | null = null
  let marine: MarineData | null = null
  let uv: UVData | null = null

  try {
    ;[precip, marine, uv] = await Promise.all([
      fetchPrecip(spot.lat, spot.lng),
      fetchMarine(spot.lat, spot.lng),
      fetchUV(spot.lat, spot.lng),
    ])
  } catch (err) {
    // Should never reach here since each fetch catches internally, but belt + suspenders
    console.error('[safety] Unexpected error in parallel fetch:', err)
  }

  const water_quality = assessWaterQuality(precip)
  const rip_current = assessRipCurrent(marine, spot)
  const surf_advisory = assessUVAdvisory(uv, marine)
  const static_hazards = buildStaticHazards(spot)
  const overall_risk = computeOverallRisk(water_quality, rip_current, surf_advisory)

  const response: SafetyResponse = {
    water_quality,
    rip_current,
    surf_advisory,
    static_hazards,
    overall_risk,
  }

  return NextResponse.json(response)
}
