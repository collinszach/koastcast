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
        siteName: 'Koastcast',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    }
  } catch {
    return {
      title: 'Koastcast — AI Surf Forecasting',
      description: 'Personalized surf forecasts powered by AI and real-time NOAA buoy data.',
    }
  }
}

export const revalidate = 1800 // Revalidate every 30 min

const CONDITION_CONFIG: Record<string, { label: string; textColor: string; heroClass: string }> = {
  firing:   { label: '🔥 FIRING',   textColor: 'var(--q-firing)',  heroClass: 'hero-firing' },
  pumping:  { label: '🤙 PUMPING',  textColor: 'var(--q-pumping)', heroClass: 'hero-pumping' },
  fun:      { label: '😎 FUN',      textColor: 'var(--q-good)',    heroClass: 'hero-fun' },
  worth_it: { label: '🏄 WORTH IT', textColor: 'var(--q-ok)',      heroClass: 'hero-worth_it' },
  flat:     { label: '😴 FLAT',     textColor: 'var(--q-flat)',    heroClass: 'hero-flat' },
  no_data:  { label: 'No Data',     textColor: 'var(--spray)',     heroClass: 'hero-no_data' },
}

export default async function PublicSpotPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  let spot, forecast
  try {
    ;[spot, forecast] = await Promise.all([getSpot(slug), getForecast(slug, 3)])
  } catch {
    // fall through — spot stays undefined, handled below
  }

  if (!spot) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--paper)' }}>
        <div className="text-center">
          <div className="text-4xl mb-4">🌊</div>
          <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)' }}>Spot not found</h1>
          <Link href="/" className="text-sm" style={{ color: 'var(--cyan-bright)' }}>← Back to Koastcast</Link>
        </div>
      </div>
    )
  }

  const current: ForecastHour | undefined = forecast?.hours[0]
  const label = getConditionLabel(current?.quality_score)
  const config = CONDITION_CONFIG[label] ?? CONDITION_CONFIG.no_data

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
    <div className="min-h-screen" style={{ background: 'var(--paper)' }}>
      {/* Nav */}
      <nav className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--tile-border)', background: 'var(--paper-raised)' }}>
        <Link href="/" className="font-bold text-lg" style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)' }}>
          🌊 Koastcast
        </Link>
        <div className="flex items-center gap-3">
          <Link href="/auth/login" className="text-sm transition-colors" style={{ color: 'var(--spray)' }}>
            Log in
          </Link>
          <Link
            href="/auth/login"
            className="btn-ocean text-sm"
            style={{ padding: '6px 14px', fontSize: 13 }}
          >
            Sign up free
          </Link>
        </div>
      </nav>

      {/* Hero — flat horizon sky/sea split, sibling of the spot detail hero */}
      <div className={`relative overflow-hidden horizon ${config.heroClass}`}>
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
             style={{ backgroundImage: `radial-gradient(circle, rgba(18,24,31,0.8) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />
        <div className="relative max-w-3xl mx-auto px-4 pt-8 pb-8">
          <div className="text-sm mb-1" style={{ color: 'var(--spray)', fontFamily: 'var(--font-data)' }}>{spot.region} · {spot.break_type} break</div>
          <h1 className="text-4xl font-black mb-2" style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>{spot.name}</h1>
          <div className="text-2xl font-bold" style={{ color: config.textColor, fontFamily: 'var(--font-display)' }}>{config.label}</div>
          {current?.quality_score != null && (
            <div className="text-sm mt-1" style={{ color: 'var(--spray)' }}>
              Quality score: {current.quality_score.toFixed(1)}/10 · Updated just now
            </div>
          )}

          {/* Current conditions */}
          {current && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
              {[
                { label: 'Wave Height', value: formatWaveHeight(current.wave_height_face_m ?? current.wave_height_m) },
                { label: 'Period', value: formatPeriod(current.wave_period_s) },
                { label: 'Swell', value: directionArrow(current.swell_direction ?? current.wave_direction) },
                { label: 'Wind', value: `${directionArrow(current.wind_direction)} ${formatWindSpeed(current.wind_speed_ms)}` },
              ].map(stat => (
                <div key={stat.label} className="tile p-4">
                  <div className="text-xs mb-1" style={{ color: 'var(--spray)' }}>{stat.label}</div>
                  <div className="font-bold text-xl" style={{ color: 'var(--foam)', fontFamily: 'var(--font-data)' }}>{stat.value}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* 3-day free preview */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)' }}>3-Day Forecast Preview</h2>
          {Object.entries(days).slice(0, 3).map(([day, hours]) => {
            const peak = hours.reduce(
              (best, h) => (h.quality_score ?? 0) > (best.quality_score ?? 0) ? h : best,
              hours[0],
            )
            const peakConfig = CONDITION_CONFIG[getConditionLabel(peak.quality_score)] ?? CONDITION_CONFIG.no_data
            return (
              <div key={day} className="tile p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-semibold" style={{ color: 'var(--foam)' }}>{day}</div>
                  {peak.quality_score != null && (
                    <div className="text-sm" style={{ color: 'var(--spray)' }}>
                      Peak: {peak.quality_score.toFixed(1)}/10 {peakConfig.label}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {hours.filter((_, i) => i % 3 === 0).slice(0, 8).map((h, i) => (
                    <div key={i} className="flex-shrink-0 w-16 text-center">
                      <div className="text-xs mb-1" style={{ color: 'var(--spray)' }}>
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
        <div className="tile-elevated p-6 text-center" style={{ borderTop: '2px solid var(--cyan)' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--foam)', fontFamily: 'var(--font-display)' }}>
            Get the Full 16-Day Forecast
          </h2>
          <p className="text-sm mb-4 max-w-sm mx-auto" style={{ color: 'var(--mist)' }}>
            Personalized Peak Score™, optimal window finder, spectral analysis,
            AI-powered Q&A, and real-time push alerts. Free to start.
          </p>
          <Link
            href="/auth/login"
            className="btn-ocean inline-block text-sm"
            style={{ padding: '12px 24px' }}
          >
            Sign up free →
          </Link>
          <div className="text-xs mt-3" style={{ color: 'var(--deep-text)' }}>
            No credit card required · Free 7-day forecast
          </div>
        </div>

        {/* Spot info */}
        <div className="text-xs pt-4 grid grid-cols-2 gap-2" style={{ color: 'var(--deep-text)', borderTop: '1px solid var(--tile-border)' }}>
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
  if (q == null) return 'var(--paper-sunken)'
  if (q >= 8) return 'rgba(234,88,12,0.12)'
  if (q >= 6) return 'rgba(8,145,178,0.12)'
  if (q >= 4) return 'rgba(37,99,235,0.12)'
  if (q >= 2) return 'rgba(79,70,229,0.12)'
  return 'var(--paper-sunken)'
}

function getConditionFg(q: number | null | undefined): string {
  if (q == null) return 'var(--spray)'
  if (q >= 8) return 'var(--q-firing)'
  if (q >= 6) return 'var(--q-pumping)'
  if (q >= 4) return 'var(--q-good)'
  if (q >= 2) return 'var(--q-ok)'
  return 'var(--spray)'
}
