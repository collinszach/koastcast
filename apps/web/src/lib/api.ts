/**
 * NUC Backend API Client
 *
 * All requests go through Next.js server (to attach NUC_API_SECRET),
 * or directly to the NUC from server components.
 */
import { z } from 'zod'
import type { ForecastResponse, Spot } from '@/types'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8001'
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
  const timeout = setTimeout(() => controller.abort(), 4000) // 4s timeout

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

export async function getSpots(): Promise<Spot[]> {
  try {
    return await fetchNUC<Spot[]>('/api/v1/spots')
  } catch {
    return loadLocalSpots()
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

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth(): Promise<{ status: string }> {
  return fetchNUC<{ status: string }>('/health', {}, undefined)
}
