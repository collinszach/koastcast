/**
 * NUC Backend API Client
 *
 * All requests go through Next.js server (to attach NUC_API_SECRET),
 * or directly to the NUC from server components.
 */
import { z } from 'zod'
import type { ForecastHour, ForecastResponse, Spot } from '@/types'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function fetchNUC<T>(
  path: string,
  options: RequestInit = {},
  schema?: z.ZodType<T>,
): Promise<T> {
  const url = `${NUC_BASE}${path}`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (NUC_SECRET) {
    headers['X-API-Secret'] = NUC_SECRET
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000) // 20s timeout (forecast calls can take ~10s)

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
      next: { revalidate: 300 },
    })
    clearTimeout(timeout)

    if (!res.ok) {
      throw new ApiError(res.status, `API error ${res.status}: ${await res.text()}`)
    }

    const data = await res.json()
    if (schema) {
      return schema.parse(data)
    }
    return data as T
  } catch (err) {
    clearTimeout(timeout)
    throw err
  }
}

// ─── Local static fallback (public/spots.json) ────────────────────────────────

async function loadLocalSpots(): Promise<Spot[]> {
  // In server context, read the file directly
  if (typeof window === 'undefined') {
    try {
      const { readFileSync } = await import('fs')
      const { join } = await import('path')
      // Try monorepo data dir first, then Next.js public dir
      const candidates = [
        join(process.cwd(), '..', '..', 'data', 'spots.json'),
        join(process.cwd(), 'public', 'spots.json'),
      ]
      for (const p of candidates) {
        try {
          const raw = readFileSync(p, 'utf-8')
          return JSON.parse(raw) as Spot[]
        } catch {
          continue
        }
      }
    } catch {
      // fall through
    }
  }
  return []
}

// ─── Spots ────────────────────────────────────────────────────────────────────

export async function getSpots(): Promise<{ spots: Spot[]; offline: boolean }> {
  try {
    const spots = await fetchNUC<Spot[]>('/api/v1/spots')
    return { spots, offline: false }
  } catch {
    const spots = await loadLocalSpots()
    return { spots, offline: true }
  }
}

export async function getSpot(slug: string): Promise<Spot> {
  try {
    return await fetchNUC<Spot>(`/api/v1/spots/${slug}`)
  } catch {
    const spots = await loadLocalSpots()
    const spot = spots.find(s => s.slug === slug)
    if (!spot) throw new Error(`Spot '${slug}' not found`)
    return spot
  }
}

// ─── Forecast ─────────────────────────────────────────────────────────────────

export async function getForecast(
  spotId: string,
  days: number = 7,
  ensemble: boolean = false,
): Promise<ForecastResponse> {
  const params = new URLSearchParams({ days: String(days) })
  if (ensemble) params.set('ensemble', 'true')
  return fetchNUC<ForecastResponse>(`/api/v1/forecast/${spotId}?${params}`)
}

/**
 * Open-Meteo fallback forecast — used when the NUC backend is offline.
 * Returns a ForecastResponse-compatible object using publicly accessible
 * Open-Meteo marine + wind APIs (no API key, no NUC required).
 */
export async function getForecastFallback(
  spot: Spot,
  days: number = 7,
): Promise<ForecastResponse> {
  const { lat, lng, slug } = spot

  const marineUrl =
    `https://marine-api.open-meteo.com/v1/marine` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=wave_height,wave_period,wave_direction,swell_wave_height,swell_wave_period,swell_wave_direction` +
    `&forecast_days=${Math.min(days, 7)}&timezone=UTC`

  const windUrl =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${lat}&longitude=${lng}` +
    `&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m` +
    `&forecast_days=${Math.min(days, 7)}&timezone=UTC&wind_speed_unit=ms`

  const [marineRes, windRes] = await Promise.all([
    fetch(marineUrl, { next: { revalidate: 1800 } }),
    fetch(windUrl,   { next: { revalidate: 1800 } }),
  ])

  if (!marineRes.ok) throw new Error('Open-Meteo marine unavailable')
  const marineData = await marineRes.json()
  const windData = windRes.ok ? await windRes.json() : null

  const times: string[] = marineData.hourly?.time ?? []
  const wvht: (number | null)[] = marineData.hourly?.wave_height ?? []
  const wper: (number | null)[] = marineData.hourly?.wave_period ?? []
  const wdir: (number | null)[] = marineData.hourly?.wave_direction ?? []
  const swh:  (number | null)[] = marineData.hourly?.swell_wave_height ?? []
  const swp:  (number | null)[] = marineData.hourly?.swell_wave_period ?? []
  const swd:  (number | null)[] = marineData.hourly?.swell_wave_direction ?? []
  const wspd: (number | null)[] = windData?.hourly?.wind_speed_10m ?? []
  const wdirw:(number | null)[] = windData?.hourly?.wind_direction_10m ?? []
  const wgust:(number | null)[] = windData?.hourly?.wind_gusts_10m ?? []

  const hours: ForecastHour[] = times.map((t, i) => ({
    forecast_time: t,
    model_source: 'open_meteo_fallback',
    wave_height_m: wvht[i] ?? null,
    wave_height_face_m: wvht[i] != null ? wvht[i]! * 1.5 : null, // rough face estimate
    wave_period_s: wper[i] ?? null,
    wave_direction: wdir[i] ?? null,
    swell_height_m: swh[i] ?? null,
    swell_period_s: swp[i] ?? null,
    swell_direction: swd[i] ?? null,
    wind_speed_ms: wspd[i] ?? null,
    wind_direction: wdirw[i] ?? null,
    wind_gust_ms: wgust[i] ?? null,
    quality_score: null, // no peak score without NUC
  }))

  return {
    spot_id: spot.id ?? slug,
    spot_slug: slug,
    generated_at: new Date().toISOString(),
    hours,
    days_available: Math.min(days, 7),
    model_sources: ['open_meteo_fallback'],
    ensemble_mode: false,
    model_forecasts: null,
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string }> {
  return fetchNUC<{ status: string }>('/health', {}, undefined)
}
