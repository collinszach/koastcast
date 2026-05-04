/**
 * Forecast API route — proxies to NUC backend, falls back to Open-Meteo.
 */
import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || ''

// Open-Meteo marine + weather parameters
const MARINE_PARAMS = [
  'wave_height', 'wave_period', 'wave_direction',
  'swell_wave_height', 'swell_wave_period', 'swell_wave_direction',
].join(',')

const WEATHER_PARAMS = [
  'wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m',
  'temperature_2m', 'weather_code',
].join(',')

interface SpotMeta {
  id: string
  slug: string
  name: string
  lat: number
  lng: number
  region: string
  break_type: string
  optimal_swell_direction: number
  optimal_swell_direction_range: number
  optimal_wind_direction: number
  optimal_size_min: number
  optimal_size_max: number
  optimal_period_min: number
  optimal_period_max: number
  nearest_buoy_id: string
  timezone: string
}

async function fetchOpenMeteoForecast(spot: SpotMeta, days: number) {
  const forecastDays = Math.min(days, 7)

  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${MARINE_PARAMS}&forecast_days=${forecastDays}&timezone=${spot.timezone || 'auto'}`,
      { next: { revalidate: 1800 } },
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${spot.lat}&longitude=${spot.lng}&hourly=${WEATHER_PARAMS}&forecast_days=${forecastDays}&timezone=${spot.timezone || 'auto'}`,
      { next: { revalidate: 1800 } },
    ),
  ])

  if (!marineRes.ok || !weatherRes.ok) {
    throw new Error('Open-Meteo API error')
  }

  const marine = await marineRes.json()
  const weather = await weatherRes.json()

  const marineHourly = marine.hourly || {}
  const weatherHourly = weather.hourly || {}
  const times: string[] = marineHourly.time || []

  const hours = times.map((t: string, i: number) => ({
    forecast_time: t,
    model_source: 'open_meteo_fallback',
    wave_height_m: marineHourly.wave_height?.[i] ?? null,
    wave_period_s: marineHourly.wave_period?.[i] ?? null,
    wave_direction: marineHourly.wave_direction?.[i] ?? null,
    swell_height_m: marineHourly.swell_wave_height?.[i] ?? null,
    swell_period_s: marineHourly.swell_wave_period?.[i] ?? null,
    swell_direction: marineHourly.swell_wave_direction?.[i] ?? null,
    wind_speed_ms: weatherHourly.wind_speed_10m?.[i] != null
      ? weatherHourly.wind_speed_10m[i] / 3.6 // km/h → m/s
      : null,
    wind_direction: weatherHourly.wind_direction_10m?.[i] ?? null,
    wind_gust_ms: weatherHourly.wind_gusts_10m?.[i] != null
      ? weatherHourly.wind_gusts_10m[i] / 3.6
      : null,
    temperature_c: weatherHourly.temperature_2m?.[i] ?? null,
    weather_code: weatherHourly.weather_code?.[i] ?? null,
    quality_score: null, // computed client-side in V1
  }))

  return {
    spot_id: spot.id,
    spot_slug: spot.slug,
    spot_name: spot.name,
    model_sources: ['open_meteo_fallback'],
    days_available: forecastDays,
    hours,
  }
}

// Load spots from static data
let spotsCache: SpotMeta[] | null = null
async function getSpotBySlug(slug: string): Promise<SpotMeta | null> {
  if (!spotsCache) {
    try {
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const candidates = [
        join(process.cwd(), '..', '..', 'data', 'spots.json'),
        join(process.cwd(), 'public', 'spots.json'),
      ]
      for (const p of candidates) {
        try {
          const raw = await readFile(p, 'utf-8')
          spotsCache = JSON.parse(raw)
          break
        } catch { /* try next */ }
      }
    } catch {
      spotsCache = []
    }
  }
  return spotsCache?.find((s: SpotMeta) => s.slug === slug || s.id === slug) || null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spot_id')
  const days = Math.max(1, Math.min(16, parseInt(searchParams.get('days') ?? '7', 10)))

  if (!spotId || !/^[a-z0-9-]+$/.test(spotId)) {
    return NextResponse.json({ error: 'Invalid spot_id' }, { status: 400 })
  }

  // Try NUC backend first if configured
  if (NUC_BASE) {
    try {
      const upstreamRes = await fetch(
        `${NUC_BASE}/api/v1/forecast/${spotId}?days=${days}`,
        { cache: 'no-store', signal: AbortSignal.timeout(5000) },
      )
      if (upstreamRes.ok) {
        return NextResponse.json(await upstreamRes.json())
      }
    } catch {
      // Fall through to Open-Meteo
    }
  }

  // Fallback: Open-Meteo direct
  try {
    const spot = await getSpotBySlug(spotId)
    if (!spot) {
      return NextResponse.json({ error: `Spot '${spotId}' not found` }, { status: 404 })
    }

    const data = await fetchOpenMeteoForecast(spot, days)
    return NextResponse.json(data)
  } catch (err) {
    console.error('Forecast fallback error:', err)
    return NextResponse.json({ error: 'Forecast unavailable' }, { status: 503 })
  }
}
