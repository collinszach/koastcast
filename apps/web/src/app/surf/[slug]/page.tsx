/**
 * Public SEO landing page for each surf spot.
 * No auth required — shows 3-day free preview + signup CTA.
 * Statically generated at build time for all 10 spots.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { getSpot, getForecast } from '@/lib/api'
import { formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow, getConditionLabel } from '@/types'
import type { ForecastHour } from '@/types'

// Pre-generate all 10 spots at build time
export async function generateStaticParams() {
  return [
    { slug: 'mavericks-ca' },
    { slug: 'steamer-lane-ca' },
    { slug: 'ocean-beach-sf-ca' },
    { slug: 'rincon-ca' },
    { slug: 'lower-trestles-ca' },
    { slug: 'blacks-beach-ca' },
    { slug: 'pipeline-oahu-hi' },
    { slug: 'sebastian-inlet-fl' },
    { slug: 'cape-hatteras-nc' },
    { slug: 'montauk-ny' },
  ]
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params

  try {
    const spot = await getSpot(slug)
    const forecast = await getForecast(slug, 1)
    const current = forecast?.hours[0]
    const wh = current?.wave_height_face_m ?? current?.wave_height_m
    const wp = current?.wave_period_s
    const ws = current?.wind_speed_ms

    const conditionStr = wh && wp
      ? `${formatWaveHeight(wh)} @ ${formatPeriod(wp)}, ${ws ? formatWindSpeed(ws) + ' wind' : 'calm'}`
      : 'See current conditions'

    const title = `${spot.name} Surf Forecast — ${conditionStr}`
    const description = `Live surf forecast for ${spot.name}, ${spot.region}. ${conditionStr}. 16-day hourly forecast, personalized Peak Score™, optimal window finder.`

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'website',
        siteName: 'Peakcast',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    }
  } catch {
    return {
      title: 'Peakcast — AI Surf Forecasting',
      description: 'Personalized surf forecasts powered by AI and real-time NOAA buoy data.',
    }
  }
}

export const revalidate = 1800 // Revalidate every 30 min

export default async function PublicSpotPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let spot, forecast, error
  try {
    ;[spot, forecast] = await Promise.all([getSpot(slug), getForecast(slug, 3)])
  } catch (err) {
    error = String(err)
  }

  if (!spot) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">🌊</div>
          <h1 className="text-white text-xl font-bold mb-2">Spot not found</h1>
          <Link href="/" className="text-blue-400 text-sm">← Back to Peakcast</Link>
        </div>
      </div>
    )
  }

  const current: ForecastHour | undefined = forecast?.hours[0]
  const label = getConditionLabel(current?.quality_score)
  const CONDITION_LABELS: Record<string, string> = {
    firing: '🔥 FIRING', pumping: '🤙 PUMPING', fun: '😎 FUN',
    worth_it: '🏄 WORTH IT', flat: '😴 FLAT', no_data: 'No Data',
  }

  // Group 3-day forecast by day
  const days: Record<string, ForecastHour[]> = {}
  for (const hour of forecast?.hours ?? []) {
    const day = new Date(hour.forecast_time).toLocaleDateString('en', {
      weekday: 'long', month: 'short', day: 'numeric',
    })
    if (!days[day]) days[day] = []
    days[day].push(hour)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Nav */}
      <nav className="border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-bold text-white text-lg">
          🌊 Peakcast
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/login" className="text-gray-400 hover:text-white text-sm transition-colors">
            Log in
          </Link>
          <Link
            href="/login"
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-3 py-1.5 rounded-lg transition-colors"
          >
            Sign up free
          </Link>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Hero */}
        <div>
          <div className="text-sm text-gray-500 mb-1">{spot.region} · {spot.break_type} break</div>
          <h1 className="text-4xl font-black text-white mb-2">{spot.name}</h1>
          <div className="text-2xl font-bold">{CONDITION_LABELS[label]}</div>
          {current?.quality_score != null && (
            <div className="text-gray-400 text-sm mt-1">
              Quality score: {current.quality_score.toFixed(1)}/10 · Updated just now
            </div>
          )}
        </div>

        {/* Current conditions */}
        {current && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Wave Height', value: formatWaveHeight(current.wave_height_face_m ?? current.wave_height_m) },
              { label: 'Period', value: formatPeriod(current.wave_period_s) },
              { label: 'Swell', value: directionArrow(current.swell_direction ?? current.wave_direction) },
              { label: 'Wind', value: `${directionArrow(current.wind_direction)} ${formatWindSpeed(current.wind_speed_ms)}` },
            ].map(stat => (
              <div key={stat.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
                <div className="text-gray-500 text-xs mb-1">{stat.label}</div>
                <div className="text-white font-bold text-xl">{stat.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* 3-day free preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">3-Day Forecast Preview</h2>
          {Object.entries(days).slice(0, 3).map(([day, hours]) => {
            const peak = hours.reduce(
              (best, h) => (h.quality_score ?? 0) > (best.quality_score ?? 0) ? h : best,
              hours[0],
            )
            return (
              <div key={day} className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold text-white">{day}</div>
                  {peak.quality_score != null && (
                    <div className="text-sm text-gray-400">
                      Peak: {peak.quality_score.toFixed(1)}/10 {CONDITION_LABELS[getConditionLabel(peak.quality_score)]}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {hours.filter((_, i) => i % 3 === 0).slice(0, 8).map((h, i) => (
                    <div key={i} className="flex-shrink-0 w-16 text-center">
                      <div className="text-gray-500 text-xs mb-1">
                        {new Date(h.forecast_time).getHours()}h
                      </div>
                      <div
                        className="text-xs font-bold rounded-lg py-1.5"
                        style={{
                          background: getConditionBg(h.quality_score),
                          color: getConditionFg(h.quality_score),
                        }}
                      >
                        {formatWaveHeight(h.wave_height_face_m ?? h.wave_height_m)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 border border-blue-700/40 rounded-2xl p-6 text-center">
          <h2 className="text-xl font-bold text-white mb-2">
            Get the Full 16-Day Forecast
          </h2>
          <p className="text-blue-200/70 text-sm mb-4 max-w-sm mx-auto">
            Personalized Peak Score™, optimal window finder, spectral analysis,
            AI-powered Q&A, and real-time push alerts. Free to start.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl transition-colors text-sm"
          >
            Sign up free →
          </Link>
          <div className="text-blue-300/50 text-xs mt-3">
            No credit card required · Free 7-day forecast
          </div>
        </div>

        {/* Spot info */}
        <div className="text-xs text-gray-600 border-t border-gray-800 pt-4 grid grid-cols-2 gap-2">
          <div>Optimal swell: {spot.optimal_swell_direction}° ± {spot.optimal_swell_direction_range}°</div>
          <div>Optimal period: {spot.optimal_period_min}–{spot.optimal_period_max}s</div>
          <div>Break type: {spot.break_type}</div>
          {spot.nearest_buoy_id && <div>NDBC buoy: {spot.nearest_buoy_id}</div>}
        </div>
      </div>
    </div>
  )
}

function getConditionBg(q: number | null | undefined): string {
  if (q == null) return '#1f2937'
  if (q >= 8) return 'rgba(239,68,68,0.15)'
  if (q >= 6) return 'rgba(249,115,22,0.15)'
  if (q >= 4) return 'rgba(34,197,94,0.15)'
  if (q >= 2) return 'rgba(59,130,246,0.15)'
  return '#1f2937'
}

function getConditionFg(q: number | null | undefined): string {
  if (q == null) return '#6b7280'
  if (q >= 8) return '#ef4444'
  if (q >= 6) return '#f97316'
  if (q >= 4) return '#22c55e'
  if (q >= 2) return '#3b82f6'
  return '#6b7280'
}
