import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Mountain, Wind, Thermometer, Layers, ArrowLeft, ExternalLink, AlertTriangle } from 'lucide-react'
import type { Resort } from '@/types/snow'
import {
  SnowForecastDay,
  getSnowConditionLabel,
  metersToFeet,
  cmToInches,
  cmToInchesF,
  weatherCodeToIcon,
  weatherCodeToLabel,
} from '@/types/snow'
import resortsData from '@/data/resorts.json'
import SnowForecastChart from './SnowForecastChart'

export const revalidate = 3600

// ─── Condition config ─────────────────────────────────────────────────────────

const SC = {
  epic_powder:  { label: 'EPIC POWDER',  accent: 'var(--snow)',      bg: 'var(--snow-muted)' },
  fresh_tracks: { label: 'FRESH TRACKS', accent: 'var(--q-pumping)', bg: 'rgba(8,145,178,0.10)' },
  good_snow:    { label: 'GOOD SNOW',    accent: 'var(--q-good)',    bg: 'rgba(37,99,235,0.08)' },
  packed:       { label: 'PACKED',       accent: 'var(--spray)',     bg: 'rgba(107,118,134,0.08)' },
  icy:          { label: 'ICY',          accent: 'var(--deep-text)', bg: 'rgba(168,176,188,0.08)' },
  no_data:      { label: 'NO DATA',      accent: 'var(--deep-text)', bg: 'rgba(168,176,188,0.05)' },
} as const

// ─── Avalanche danger levels ───────────────────────────────────────────────────
// Light-mode-safe: tinted background + darker saturated text per level.

type AvalancheDanger = 'Low' | 'Moderate' | 'Considerable' | 'High' | 'Extreme'

const AVAL_DANGER: Record<AvalancheDanger, { color: string; bg: string; border: string; icon: string }> = {
  Low:          { color: '#15803D', bg: '#F0FDF4', border: '#BBF7D0', icon: '●' },
  Moderate:     { color: '#A16207', bg: '#FEFCE8', border: '#FEF08A', icon: '●' },
  Considerable: { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', icon: '▲' },
  High:         { color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA', icon: '▲' },
  Extreme:      { color: '#7F1D1D', bg: '#FEE2E2', border: '#FCA5A5', icon: '◆' },
}

// ─── Avalanche center URL map ─────────────────────────────────────────────────

const AVAL_URLS: Record<string, string> = {
  'CAIC':          'https://avalanche.state.co.us',
  'UAC':           'https://utahavalanchecenter.org',
  'SNAC':          'https://www.sierraavalanchecenter.org',
  'Sierra Nevada': 'https://www.sierraavalanchecenter.org',
  'NWAC':          'https://nwac.us',
  'VNAC':          'https://www.vmountainsafety.org',
  'MWAC':          'https://www.mountwashingtonavalanchecenter.org',
}

// ─── Mock snow (deterministic, for when current_conditions is absent) ─────────

function mockSnow(name: string) {
  const h = name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)
  const abs = Math.abs(h)
  return {
    newSnow24h: abs % 18,
    newSnow48h: (abs % 18) + (abs % 8),
    newSnow72h: (abs % 18) + (abs % 8) + (abs % 5),
    base:       60 + (abs % 80),
    powderScore: 30 + (abs % 60),
    tempF:      14 + (abs % 30),
    windMph:    5  + (abs % 25),
  }
}

// ─── Powder Ring ──────────────────────────────────────────────────────────────

function PowderRing({ score, size = 100, accent }: { score: number | null; size?: number; accent: string }) {
  const r    = (size / 2) - 10
  const circ = 2 * Math.PI * r
  const fill = score != null ? Math.max(0, Math.min(1, score / 100)) * circ : 0
  const cx   = size / 2, cy = size / 2
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id="powder-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#7C3AED" />
            <stop offset="100%" stopColor="#0EA5E9" />
          </linearGradient>
        </defs>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--tile-border)" strokeWidth="8" />
        {score != null && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke="url(#powder-grad)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${fill} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {score != null ? (
          <>
            <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: size * 0.2, fontWeight: 900, color: accent, lineHeight: 1 }}>
              {Math.round(score)}
            </span>
            <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: size * 0.08, color: 'var(--spray)', letterSpacing: '0.06em', marginTop: 2 }}>
              POWDER
            </span>
          </>
        ) : (
          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 12, color: 'var(--deep-text)' }}>—</span>
        )}
      </div>
    </div>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="tile" style={{ padding: '14px 16px' }}>
      <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 22, fontWeight: 900, color: accent ?? 'var(--foam)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ─── Avalanche badge ──────────────────────────────────────────────────────────

function AvalancheBadge({
  center,
  region,
  avalUrl,
  dangerLevel,
}: {
  center: string
  region?: string | null
  avalUrl: string | null
  dangerLevel?: AvalancheDanger | null
}) {
  const d = dangerLevel ? AVAL_DANGER[dangerLevel] : null

  return (
    <div className="glass-card" style={{
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} style={{ color: d?.color ?? '#B91C1C', flexShrink: 0 }} />
          <div>
            <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Avalanche Center</div>
            <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 12, fontWeight: 700, color: 'var(--foam)', marginTop: 2 }}>{center}</div>
            {region && <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', marginTop: 1 }}>{region}</div>}
          </div>
        </div>

        {/* Danger level pill */}
        {dangerLevel && d ? (
          <span style={{
            fontFamily: 'var(--font-data, monospace)', fontSize: 10, fontWeight: 800,
            letterSpacing: '0.06em', color: d.color,
            background: d.bg, border: `1px solid ${d.border}`,
            padding: '5px 12px', borderRadius: 20,
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span style={{ fontSize: 8 }}>{d.icon}</span>
            {dangerLevel.toUpperCase()}
          </span>
        ) : (
          <span style={{
            fontFamily: 'var(--font-data, monospace)', fontSize: 9, fontWeight: 600,
            letterSpacing: '0.05em', color: '#B91C1C',
            background: '#FEF2F2', border: '1px solid #FECACA',
            padding: '5px 12px', borderRadius: 20,
          }}>
            CHECK LOCAL
          </span>
        )}
      </div>

      {/* CTA */}
      {avalUrl && (
        <a
          href={avalUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-data, monospace)', fontSize: 9, fontWeight: 700,
            color: '#B91C1C', textDecoration: 'none',
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            padding: '7px 13px', borderRadius: 9,
            alignSelf: 'flex-start',
            letterSpacing: '0.04em',
          }}
        >
          <ExternalLink size={9} />
          Check Avalanche Forecast →
        </a>
      )}
      {!avalUrl && (
        <p style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--deep-text)', margin: 0, lineHeight: 1.6 }}>
          Always check your local avalanche center before heading into the backcountry.
        </p>
      )}
    </div>
  )
}

// ─── 7-Day Best Days Badge Row ────────────────────────────────────────────────

function BestDaysBadges({ days }: { days: SnowForecastDay[] }) {
  const first7 = days.slice(0, 7)

  return (
    <div className="glass-card" style={{ padding: '16px' }}>
      <div style={{
        fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)',
        letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: 'var(--snow)' }}>❄</span>
        Best Days This Week
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {first7.map((day, i) => {
          const isBest   = day.snowfall_in >= 4
          const isGood   = day.snowfall_in >= 1 && day.snowfall_in < 4
          const dateObj  = new Date(day.date + 'T12:00:00')
          const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'short' })
          const dateLabel = dateObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })

          const bg     = isBest ? 'var(--snow-muted)' : isGood ? 'rgba(37,99,235,0.08)' : 'var(--paper-sunken)'
          const border = isBest ? 'rgba(124,58,237,0.45)' : isGood ? 'rgba(37,99,235,0.25)' : 'var(--tile-border)'
          const snowColor = isBest ? 'var(--snow-bright)' : isGood ? 'var(--q-good)' : day.snowfall_in > 0 ? 'var(--spray)' : 'var(--deep-text)'

          return (
            <div key={i} style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              padding: '10px 10px 8px', borderRadius: 12, minWidth: 56, flex: '0 0 auto',
              background: bg, border: `1px solid ${border}`,
              position: 'relative',
            }}>
              {isBest && (
                <div style={{
                  position: 'absolute', top: -8, left: '50%', transform: 'translateX(-50%)',
                  fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--snow-bright)',
                  background: 'var(--snow-muted)', border: '1px solid rgba(124,58,237,0.4)',
                  padding: '1px 6px', borderRadius: 10, whiteSpace: 'nowrap', fontWeight: 700,
                  letterSpacing: '0.08em',
                }}>GO</div>
              )}
              <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, fontWeight: 700, color: isBest ? 'var(--snow-bright)' : 'var(--spray)', letterSpacing: '0.04em' }}>
                {dayLabel}
              </div>
              <div style={{ fontSize: 16 }} title={weatherCodeToLabel(day.weather_code)}>
                {weatherCodeToIcon(day.weather_code)}
              </div>
              <div style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: isBest ? 14 : 12,
                fontWeight: 900, color: snowColor, lineHeight: 1,
              }}>
                {day.snowfall_in > 0 ? `${day.snowfall_in}"` : '—'}
              </div>
              <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7.5, color: 'var(--deep-text)', letterSpacing: '0.02em' }}>
                {dateLabel}
              </div>
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 10, fontFamily: 'var(--font-data, monospace)', fontSize: 7.5, color: 'var(--deep-text)', letterSpacing: '0.06em' }}>
        <span style={{ color: 'var(--snow)' }}>■</span> GO = 4+ inches of new snow expected
      </div>
    </div>
  )
}

// ─── Conditions Grid (always shown, falls back to mock data) ──────────────────

function ConditionsGrid({
  cc,
  accent,
  mock,
}: {
  cc: Resort['current_conditions']
  accent: string
  mock: ReturnType<typeof mockSnow>
}) {
  const base24 = cc?.new_snow_24h_in ?? mock.newSnow24h
  const base48 = cc?.new_snow_48h_in ?? mock.newSnow48h
  const baseD  = cc?.base_depth_in   ?? mock.base
  const powder = cc?.powder_score    ?? mock.powderScore
  const tempF  = cc?.temperature_f   ?? mock.tempF
  const wind   = cc?.wind_speed_mph  ?? mock.windMph

  const isMock = cc == null

  const cells: { label: string; value: string; accent?: string; sub?: string }[] = [
    { label: 'Base Depth',   value: `${Math.round(baseD)}in`,  accent,                      sub: isMock ? 'est.' : undefined },
    { label: 'New 24h',      value: base24 > 0 ? `${Math.round(base24)}in` : '0in', accent: base24 >= 6 ? 'var(--snow)' : base24 >= 2 ? accent : 'var(--deep-text)' },
    { label: 'New 48h',      value: base48 > 0 ? `${Math.round(base48)}in` : '0in' },
    { label: 'Powder Score', value: `${Math.round(powder)}`,   accent: powder >= 70 ? 'var(--snow)' : powder >= 50 ? accent : 'var(--spray)', sub: '/ 100' },
    { label: 'Temperature',  value: `${Math.round(tempF)}°F`,  accent: tempF < 28 ? 'var(--q-pumping)' : tempF < 34 ? 'var(--q-good)' : 'var(--amber)' },
    { label: 'Wind',         value: `${Math.round(wind)}mph`,  accent: wind > 35 ? '#B91C1C' : wind > 20 ? 'var(--amber)' : 'var(--spray)' },
  ]

  return (
    <div>
      {isMock && (
        <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--deep-text)', letterSpacing: '0.08em', marginBottom: 8 }}>
          * ESTIMATED — live conditions not yet available
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
        {cells.map(({ label, value, accent: a, sub }) => (
          <StatCard key={label} label={label} value={value} accent={a} sub={sub} />
        ))}
      </div>
    </div>
  )
}

// ─── Fetch Open-Meteo directly server-side ────────────────────────────────────

async function fetchSnowForecast(lat: number, lng: number, tz: string): Promise<SnowForecastDay[] | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lng))
    url.searchParams.set('timezone', tz)
    url.searchParams.set('forecast_days', '10')
    url.searchParams.set('daily', [
      'snowfall_sum',
      'temperature_2m_max',
      'temperature_2m_min',
      'wind_speed_10m_max',
      'precipitation_sum',
      'weather_code',
    ].join(','))
    url.searchParams.set('wind_speed_unit', 'mph')
    url.searchParams.set('temperature_unit', 'fahrenheit')

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } })
    if (!res.ok) return null

    const data = await res.json()
    const daily = data.daily

    if (!daily?.time) return null

    return (daily.time as string[]).map((date: string, i: number) => ({
      date,
      snowfall_in:      cmToInchesF(daily.snowfall_sum?.[i] ?? 0),
      high_f:           Math.round(daily.temperature_2m_max?.[i] ?? 32),
      low_f:            Math.round(daily.temperature_2m_min?.[i] ?? 20),
      wind_mph:         Math.round(daily.wind_speed_10m_max?.[i] ?? 0),
      weather_code:     daily.weather_code?.[i] ?? 0,
      precipitation_in: Math.round(((daily.precipitation_sum?.[i] ?? 0) / 25.4) * 10) / 10,
    }))
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ResortPage({ params }: PageProps) {
  const { id } = await params
  const resort = (resortsData as Resort[]).find(r => r.slug === id)
  if (!resort) notFound()

  const cc        = resort.current_conditions
  const condKey   = getSnowConditionLabel(cc?.powder_score)
  const m         = SC[condKey]
  const summitFt  = metersToFeet(resort.summit_elevation_m)
  const baseFt    = metersToFeet(resort.base_elevation_m)
  const vertFt    = metersToFeet(resort.vertical_m)
  const avgSnowIn = cmToInches(resort.annual_snowfall_cm)
  const passColor = resort.pass === 'epic' ? 'var(--q-good)' : resort.pass === 'ikon' ? 'var(--amber)' : 'var(--spray)'
  const passLabel = resort.pass === 'epic' ? 'EPIC PASS' : resort.pass === 'ikon' ? 'IKON PASS' : 'INDEPENDENT'
  const mockData  = mockSnow(resort.name)

  // Fetch live forecast server-side
  const forecastDays = await fetchSnowForecast(resort.lat, resort.lng, resort.timezone)

  // Avalanche center URL
  const avalUrl = resort.avalanche_center ? (AVAL_URLS[resort.avalanche_center] ?? null) : null

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--deep)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div className="horizon" style={{ '--horizon-color': m.accent, padding: '20px 20px 0' } as React.CSSProperties}>
        <div style={{ position: 'relative' }}>
          {/* Back */}
          <Link href="/snow" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
            fontFamily: 'var(--font-data, monospace)', fontSize: 10, color: 'var(--spray)',
            letterSpacing: '0.06em', textDecoration: 'none',
            background: 'var(--paper-sunken)', border: '1px solid var(--tile-border)',
            padding: '5px 10px 5px 8px', borderRadius: 8,
          }}>
            <ArrowLeft size={12} />
            All Resorts
          </Link>

          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 10, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                {resort.region} · {resort.state}
              </div>
              <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(1.75rem, 5vw, 2.5rem)', fontWeight: 900, color: 'var(--foam)', letterSpacing: '-0.03em', lineHeight: 1, margin: 0 }}>
                {resort.name}
              </h1>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: 10, fontWeight: 700,
                color: passColor, background: 'var(--paper-sunken)',
                border: `1px solid ${passColor}`, padding: '4px 12px',
                borderRadius: 20, letterSpacing: '0.06em',
              }}>{passLabel}</span>
              <span style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: 10, fontWeight: 700,
                color: m.accent, background: m.bg,
                border: `1px solid ${m.accent}`, padding: '4px 12px',
                borderRadius: 20, letterSpacing: '0.06em',
              }}>❄ {m.label}</span>
            </div>
          </div>

          {/* Elevation stats */}
          <div style={{ display: 'flex', gap: 24, paddingBottom: 16, flexWrap: 'wrap' }}>
            {[
              { lbl: 'Summit',   val: summitFt != null ? `${summitFt.toLocaleString()}ft` : '—' },
              { lbl: 'Base',     val: baseFt   != null ? `${baseFt.toLocaleString()}ft`   : '—' },
              { lbl: 'Vertical', val: vertFt   != null ? `${vertFt.toLocaleString()}ft`   : '—' },
            ].map(({ lbl, val }) => (
              <div key={lbl}>
                <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--spray)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 15, fontWeight: 700, color: 'var(--foam)' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Conditions Grid (always visible) ─────────────────────────── */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>
            Current Conditions
          </div>
          <ConditionsGrid cc={cc} accent={m.accent} mock={mockData} />
        </div>

        {/* Current Conditions detail row: powder ring + snow bars */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'stretch', flexWrap: 'wrap' }}>

          {/* Powder Ring card */}
          <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minWidth: 140 }}>
            <PowderRing score={cc?.powder_score ?? mockData.powderScore} size={110} accent={m.accent} />
            <div style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 11, fontWeight: 700, color: m.accent, letterSpacing: '0.04em', textAlign: 'center' }}>
              {m.label}
            </div>
          </div>

          {/* Right: new snow bars + key stats */}
          <div className="glass-card" style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 180 }}>
            <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase' }}>New Snowfall</div>
            {[
              { label: '24h', val: cc?.new_snow_24h_in ?? mockData.newSnow24h },
              { label: '48h', val: cc?.new_snow_48h_in ?? mockData.newSnow48h },
              { label: '72h', val: cc?.new_snow_72h_in ?? mockData.newSnow72h },
            ].map(({ label, val }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', width: 24, letterSpacing: '0.06em' }}>{label}</span>
                <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--paper-sunken)', overflow: 'hidden' }}>
                  {val != null && val > 0 && (
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (val / 20) * 100)}%`,
                      background: `linear-gradient(90deg, ${m.accent}, ${m.accent})`,
                      borderRadius: 3,
                    }} />
                  )}
                </div>
                <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 13, fontWeight: 900, color: val != null && val > 0 ? m.accent : 'var(--deep-text)', width: 36, textAlign: 'right' }}>
                  {val != null ? `${val}in` : '—'}
                </span>
              </div>
            ))}

            {/* Divider + base/temp/wind */}
            <div style={{ borderTop: '1px solid var(--tile-border)', paddingTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {(cc?.base_depth_in ?? mockData.base) != null && (
                <div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--spray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Base</div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 16, fontWeight: 800, color: m.accent }}>{Math.round(cc?.base_depth_in ?? mockData.base)}in</div>
                </div>
              )}
              {(cc?.temperature_f ?? mockData.tempF) != null && (
                <div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--spray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Temp</div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 16, fontWeight: 800, color: 'var(--foam)' }}>{Math.round(cc?.temperature_f ?? mockData.tempF)}°F</div>
                </div>
              )}
              {(cc?.wind_speed_mph ?? mockData.windMph) != null && (
                <div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--spray)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>Wind</div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 16, fontWeight: 800, color: 'var(--foam)' }}>{Math.round(cc?.wind_speed_mph ?? mockData.windMph)}mph</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 7-Day Best Days Badge Row ──────────────────────────────────── */}
        {forecastDays && forecastDays.length >= 7 && (
          <BestDaysBadges days={forecastDays} />
        )}

        {/* ── 10-Day Snow Forecast ───────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '16px 16px 12px' }}>
          <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 14 }}>
            10-Day Outlook
          </div>

          {forecastDays ? (
            <>
              {/* Recharts bar chart (client component) */}
              <SnowForecastChart days={forecastDays} accentColor="var(--snow)" />

              {/* Scrollable day cards */}
              <div style={{ overflowX: 'auto', paddingBottom: 4, marginTop: 12 }}>
                <div style={{ display: 'flex', gap: 8, minWidth: 'max-content' }}>
                  {forecastDays.map((day, i) => {
                    const hasBigSnow = day.snowfall_in >= 3
                    return (
                      <div key={i} style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                        padding: '10px 12px', borderRadius: 12, minWidth: 68,
                        background: hasBigSnow ? 'var(--snow-muted)' : 'var(--paper-sunken)',
                        border: hasBigSnow
                          ? '1px solid rgba(124,58,237,0.35)'
                          : '1px solid var(--tile-border)',
                      }}>
                        <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                          {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
                        </div>
                        <div style={{ fontSize: 18 }} title={weatherCodeToLabel(day.weather_code)}>
                          {weatherCodeToIcon(day.weather_code)}
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-data, monospace)', fontSize: day.snowfall_in >= 3 ? 15 : 13,
                          fontWeight: 900, lineHeight: 1,
                          color: day.snowfall_in >= 6 ? 'var(--snow)' : day.snowfall_in >= 3 ? 'var(--snow-bright)' : day.snowfall_in > 0 ? 'var(--q-good)' : 'var(--deep-text)',
                        }}>
                          {day.snowfall_in > 0 ? `${day.snowfall_in}"` : '—'}
                        </div>
                        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                          <Thermometer size={8} style={{ color: 'var(--spray)' }} />
                          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--foam)' }}>{day.high_f}°</span>
                          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)' }}>{day.low_f}°</span>
                        </div>
                        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
                          <Wind size={8} style={{ color: 'var(--deep-text)' }} />
                          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)' }}>{day.wind_mph}mph</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </>
          ) : (
            <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 11, color: 'var(--deep-text)', padding: '20px 0', textAlign: 'center' }}>
              No live forecast available
            </div>
          )}
        </div>

        {/* ── Mountain Stats ────────────────────────────────────────────── */}
        <div className="glass-card" style={{ padding: '16px' }}>
          <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 12 }}>Resort Stats</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 12 }}>
            {[
              { icon: <Layers size={12} />,   label: 'Acres',        val: resort.terrain_acres != null ? resort.terrain_acres.toLocaleString() : '—' },
              { icon: <Mountain size={12} />, label: 'Trails',       val: resort.trails != null ? String(resort.trails) : '—' },
              { icon: null,                   label: 'Lifts',        val: resort.lifts  != null ? String(resort.lifts)  : '—' },
              { icon: null,                   label: 'Avg Snowfall', val: avgSnowIn != null ? `${avgSnowIn}in/yr` : '—' },
            ].map(({ icon, label, val }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.1em', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {icon && <span style={{ color: 'var(--spray)' }}>{icon}</span>}
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 16, fontWeight: 800, color: 'var(--foam)', letterSpacing: '-0.01em' }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Safety: Avalanche + SNOTEL ──────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>

          {/* Avalanche danger badge */}
          {resort.avalanche_center && (
            <div style={{ flex: 1, minWidth: 220 }}>
              {/* dangerLevel: live danger would come from avy center API; null shows "CHECK LOCAL" */}
              <AvalancheBadge
                center={resort.avalanche_center}
                region={resort.avalanche_region}
                avalUrl={avalUrl}
                dangerLevel={null}
              />
            </div>
          )}

          {/* SNOTEL */}
          {resort.nearest_snotel_id && (
            <div className="glass-card" style={{ flex: 1, minWidth: 180, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--spray)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>SNOTEL Station</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--snow)', flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 11, fontWeight: 700, color: 'var(--foam)' }}>{resort.nearest_snotel_name ?? resort.nearest_snotel_id}</div>
                  <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', marginTop: 1 }}>{resort.nearest_snotel_id}</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Description ─────────────────────────────────────────────────── */}
        {resort.description && (
          <div className="glass-card" style={{ padding: '14px 16px' }}>
            <p style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 12, color: 'var(--mist)', lineHeight: 1.7, margin: 0 }}>
              {resort.description}
            </p>
          </div>
        )}

        {/* ── Website ─────────────────────────────────────────────────────── */}
        {resort.website && (
          <a
            href={`https://${resort.website}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              padding: '12px', borderRadius: 12,
              background: 'var(--paper-sunken)',
              border: '1px solid var(--tile-border-strong)',
              fontFamily: 'var(--font-display, sans-serif)', fontSize: 12, fontWeight: 700,
              color: 'var(--spray)', textDecoration: 'none',
            }}
          >
            <ExternalLink size={12} />
            {resort.website}
          </a>
        )}
      </div>
    </div>
  )
}
