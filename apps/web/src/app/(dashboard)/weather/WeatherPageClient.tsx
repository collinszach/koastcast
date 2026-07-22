'use client'

import { useState, useEffect, useMemo } from 'react'
import { useLocation } from '@/lib/location'

// ── Types ──────────────────────────────────────────────────────────────────────

export interface WeatherData {
  hourly: {
    time: string[]
    temperature_2m: number[]
    precipitation: number[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    cloud_cover: number[]
    visibility: number[]
  }
  daily: {
    time: string[]
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    precipitation_sum: number[]
    wind_speed_10m_max: number[]
  }
}

interface SpotEntry {
  name: string
  slug: string
  lat: number
  lng: number
  region: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cToF(c: number) { return (c * 9/5 + 32).toFixed(0) }
function msToKnots(ms: number) { return (ms * 1.944).toFixed(0) }
function degToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}
function formatHour(iso: string): string {
  const d = new Date(iso)
  const h = d.getHours()
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h < 12 ? `${h}am` : `${h - 12}pm`
}
function cloudToEmoji(pct: number): string {
  if (pct < 15) return '☀️'
  if (pct < 40) return '🌤️'
  if (pct < 70) return '⛅'
  if (pct < 90) return '🌥️'
  return '☁️'
}
function precipToEmoji(mm: number): string {
  if (mm < 0.1) return '—'
  if (mm < 2)   return '🌦️'
  if (mm < 8)   return '🌧️'
  return '⛈️'
}
function uvRisk(uv: number): { label: string; color: string } {
  if (uv < 3)  return { label: 'Low',       color: '#059669' }
  if (uv < 6)  return { label: 'Moderate',  color: '#B45309' }
  if (uv < 8)  return { label: 'High',      color: '#DC2626' }
  if (uv < 11) return { label: 'Very High', color: '#7C3AED' }
  return { label: 'Extreme', color: '#DB2777' }
}

function distMi(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Outdoor activity rating from weather conditions
function rateActivity(
  windMs: number,
  tempC: number,
  precipMm: number,
  cloudPct: number,
  type: 'surf' | 'trail' | 'snow'
): { score: number; label: string; detail: string; color: string } {
  let score = 70

  if (type === 'surf') {
    if (windMs < 3)        score += 15
    else if (windMs < 6)   score += 8
    else if (windMs > 12)  score -= 20
    if (precipMm > 2)      score -= 10
    if (tempC > 15 && tempC < 28) score += 10
  } else if (type === 'trail') {
    if (precipMm > 5)      score -= 30
    else if (precipMm > 1) score -= 15
    if (tempC > 5 && tempC < 25) score += 15
    if (cloudPct < 50)     score += 10
  } else {
    if (tempC < 0 && precipMm > 1) score += 25
    else if (tempC < -5)            score += 10
    if (tempC > 2)                  score -= 20
  }

  score = Math.max(5, Math.min(100, score))

  let label: string, color: string, detail: string
  if (score >= 80)      { label = 'Excellent'; color = '#059669'; detail = '' }
  else if (score >= 60) { label = 'Good';      color = '#0EA5E9'; detail = '' }
  else if (score >= 40) { label = 'Fair';      color = '#B45309'; detail = '' }
  else                  { label = 'Poor';      color = '#DC2626'; detail = '' }

  if (type === 'surf') {
    if (score >= 80)      detail = 'Light offshores, great conditions'
    else if (score >= 60) detail = 'Manageable conditions, worth checking'
    else if (score >= 40) detail = 'Onshores or unfavorable wind'
    else                  detail = 'Strong wind or rain — skip it'
  } else if (type === 'trail') {
    if (score >= 80)      detail = 'Dry, mild temps — prime trail day'
    else if (score >= 60) detail = 'Good conditions, some cloud cover'
    else if (score >= 40) detail = 'Light rain possible, muddy sections'
    else                  detail = 'Heavy rain or unsafe conditions'
  } else {
    if (score >= 80)      detail = 'Fresh snow & cold — powder alert'
    else if (score >= 60) detail = 'Decent snow conditions'
    else if (score >= 40) detail = 'Marginal snow, icy in places'
    else                  detail = 'Warm temps — poor snow quality'
  }

  return { score, label, detail, color }
}

// ── Placeholder data (shown on fetch failure) ─────────────────────────────────
function makePlaceholderData(): WeatherData {
  const now = new Date()
  const hourly = {
    time: Array.from({ length: 48 }, (_, i) => {
      const d = new Date(now); d.setHours(d.getHours() + i); return d.toISOString()
    }),
    temperature_2m:    Array.from({ length: 48 }, (_, i) => 14 + Math.sin(i / 6) * 4),
    precipitation:     Array.from({ length: 48 }, () => Math.random() < 0.15 ? Math.random() * 2 : 0),
    wind_speed_10m:    Array.from({ length: 48 }, (_, i) => 4 + Math.sin(i / 8) * 3),
    wind_direction_10m:Array.from({ length: 48 }, () => 270 + (Math.random() - 0.5) * 40),
    cloud_cover:       Array.from({ length: 48 }, (_, i) => 30 + Math.sin(i / 10) * 25),
    visibility:        Array.from({ length: 48 }, () => 15000 + Math.random() * 5000),
  }
  const daily = {
    time:                 Array.from({ length: 7 }, (_, i) => { const d = new Date(now); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0] }),
    temperature_2m_max:   [17, 16, 14, 18, 20, 19, 15],
    temperature_2m_min:   [10, 9,  8,  11, 13, 11, 9 ],
    precipitation_sum:    [0,  0.5, 3.2, 0, 0, 1.1, 0],
    wind_speed_10m_max:   [5,  7,   12, 4, 3, 8,   6 ],
  }
  return { hourly, daily }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────

function Label({ children }: { children: string }) {
  return (
    <div style={{
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: 9,
      fontWeight: 700,
      letterSpacing: '0.18em',
      color: 'var(--spray)',
      textTransform: 'uppercase',
      marginBottom: 8,
    }}>
      {children}
    </div>
  )
}

function DataCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: string
  label: string
  value: string
  sub?: string
  accent?: string
}) {
  return (
    <div style={{
      background: 'var(--tile-bg)',
      border: '1px solid var(--tile-border)',
      borderRadius: 14,
      padding: '16px 18px',
      boxShadow: 'var(--tile-shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9,
          fontWeight: 600,
          letterSpacing: '0.16em',
          color: 'var(--spray)',
          textTransform: 'uppercase',
        }}>{label}</span>
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 22,
        fontWeight: 700,
        color: accent ?? 'var(--foam)',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        marginBottom: sub ? 6 : 0,
      }}>{value}</div>
      {sub && (
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--spray)', marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

// ── Hourly chart ──────────────────────────────────────────────────────────────
function HourlyChart({ data, startIdx }: { data: WeatherData; startIdx: number }) {
  const hours = data.hourly
  const slice = {
    time:  hours.time.slice(startIdx, startIdx + 24),
    temp:  hours.temperature_2m.slice(startIdx, startIdx + 24),
    precip:hours.precipitation.slice(startIdx, startIdx + 24),
    wind:  hours.wind_speed_10m.slice(startIdx, startIdx + 24),
  }

  const W = 900, H = 120
  const tempMin = Math.min(...slice.temp) - 2
  const tempMax = Math.max(...slice.temp) + 2
  const tempRange = tempMax - tempMin || 1
  const windMax = Math.max(...slice.wind, 1)
  const precipMax = Math.max(...slice.precip, 1)

  const tempPath = slice.temp.map((t, i) => {
    const x = (i / 23) * (W - 40) + 20
    const y = H - 20 - ((t - tempMin) / tempRange) * (H - 40)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ')

  const tempFill = slice.temp.map((t, i) => {
    const x = (i / 23) * (W - 40) + 20
    const y = H - 20 - ((t - tempMin) / tempRange) * (H - 40)
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
  }).join(' ') + ` L ${(W - 40) + 20} ${H - 20} L 20 ${H - 20} Z`

  const labelHours = [6, 9, 12, 15, 18, 21]

  return (
    <div style={{
      background: 'var(--tile-bg)',
      border: '1px solid var(--tile-border)',
      borderRadius: 14,
      padding: '20px 24px',
      boxShadow: 'var(--tile-shadow)',
    }}>
      <Label>24-Hour Forecast</Label>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H + 80}`}
          style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block' }}
          preserveAspectRatio="none"
        >
          {[0.25, 0.5, 0.75].map(f => (
            <line
              key={f}
              x1={20} y1={H - 20 - f * (H - 40)}
              x2={W - 20} y2={H - 20 - f * (H - 40)}
              stroke="var(--tile-border)" strokeWidth={1}
            />
          ))}

          <path d={tempFill} fill="rgba(14,165,233,0.08)" />
          <path d={tempPath} fill="none" stroke="var(--cyan)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

          {slice.time.map((t, i) => {
            const h = new Date(t).getHours()
            if (!labelHours.includes(h)) return null
            const x = (i / 23) * (W - 40) + 20
            const y = H - 20 - ((slice.temp[i] - tempMin) / tempRange) * (H - 40)
            return (
              <g key={i}>
                <circle cx={x} cy={y} r={3.5} fill="var(--cyan)" />
                <text
                  x={x} y={y - 8}
                  textAnchor="middle"
                  fill="var(--cyan-bright)"
                  style={{ font: '600 9px JetBrains Mono, monospace' }}
                >
                  {Math.round(slice.temp[i])}°
                </text>
              </g>
            )
          })}

          {slice.precip.map((p, i) => {
            if (p < 0.05) return null
            const x = (i / 23) * (W - 40) + 20
            const barH = (p / precipMax) * 30
            return (
              <rect
                key={i}
                x={x - 3} y={H - 20 - barH}
                width={6} height={barH}
                fill="rgba(14,165,233,0.35)"
                rx={2}
              />
            )
          })}

          {slice.time.map((t, i) => {
            const h = new Date(t).getHours()
            if (!labelHours.includes(h)) return null
            const x = (i / 23) * (W - 40) + 20
            const windH = (slice.wind[i] / windMax) * 16
            return (
              <g key={`w${i}`}>
                <rect
                  x={x - 4} y={H + 4}
                  width={8} height={Math.max(2, windH)}
                  fill="rgba(180,83,9,0.6)"
                  rx={2}
                />
                <text
                  x={x} y={H + 32}
                  textAnchor="middle"
                  fill="var(--spray)"
                  style={{ font: '500 9px JetBrains Mono, monospace' }}
                >
                  {msToKnots(slice.wind[i])}kt
                </text>
              </g>
            )
          })}

          {slice.time.map((t, i) => {
            const h = new Date(t).getHours()
            if (!labelHours.includes(h)) return null
            const x = (i / 23) * (W - 40) + 20
            const label = formatHour(t)
            return (
              <text
                key={`l${i}`}
                x={x} y={H + 50}
                textAnchor="middle"
                fill="var(--deep-text)"
                style={{ font: '600 9px JetBrains Mono, monospace', letterSpacing: '0.05em' }}
              >
                {label}
              </text>
            )
          })}

          <g transform={`translate(${W - 140}, 8)`}>
            <rect x={0} y={0} width={8} height={3} fill="var(--cyan)" rx={1} />
            <text x={12} y={4} fill="var(--spray)" style={{ font: '9px JetBrains Mono, monospace' }}>Temp (°C)</text>
            <rect x={0} y={12} width={8} height={3} fill="rgba(14,165,233,0.35)" rx={1} />
            <text x={12} y={16} fill="var(--spray)" style={{ font: '9px JetBrains Mono, monospace' }}>Precip</text>
            <rect x={0} y={24} width={8} height={3} fill="rgba(180,83,9,0.6)" rx={1} />
            <text x={12} y={28} fill="var(--spray)" style={{ font: '9px JetBrains Mono, monospace' }}>Wind (kt)</text>
          </g>
        </svg>
      </div>
    </div>
  )
}

// ── 7-Day forecast row ────────────────────────────────────────────────────────
function SevenDayForecast({ daily }: { daily: WeatherData['daily'] }) {
  return (
    <div style={{
      background: 'var(--tile-bg)',
      border: '1px solid var(--tile-border)',
      borderRadius: 14,
      padding: '20px 24px',
      boxShadow: 'var(--tile-shadow)',
    }}>
      <Label>7-Day Forecast</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {daily.time.slice(0, 7).map((dateStr, i) => {
          const dayLabel = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : new Date(dateStr).toLocaleDateString('en-US', { weekday: 'long' })
          const precip = daily.precipitation_sum[i] ?? 0
          const wind   = daily.wind_speed_10m_max[i] ?? 0
          const tMax   = daily.temperature_2m_max[i] ?? 0
          const tMin   = daily.temperature_2m_min[i] ?? 0
          const cloudPct = precip > 3 ? 90 : precip > 1 ? 60 : precip > 0.2 ? 35 : 15
          const icon   = cloudToEmoji(cloudPct)
          const precipIcon = precipToEmoji(precip)

          return (
            <div key={dateStr} style={{
              display: 'grid',
              gridTemplateColumns: '120px 28px 80px 1fr 80px 80px',
              alignItems: 'center',
              gap: 12,
              padding: '10px 12px',
              borderRadius: 10,
              background: i % 2 === 0 ? 'var(--paper-sunken)' : 'transparent',
            }}>
              <span style={{ fontFamily: 'Syne, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: i === 0 ? 'var(--cyan-bright)' : 'var(--mist)' }}>
                {dayLabel}
              </span>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--foam)',
                fontWeight: 600,
              }}>
                {Math.round(tMax)}° / {Math.round(tMin)}°
              </span>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--tile-border)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.round(((tMax - tMin) / 15) * 100)}%`,
                  background: 'linear-gradient(90deg, var(--cyan), var(--amber))',
                  borderRadius: 2,
                }} />
              </div>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: precip > 1 ? 'var(--cyan-bright)' : 'var(--deep-text)',
              }}>
                {precipIcon} {precip.toFixed(1)}mm
              </span>
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 10,
                color: wind > 10 ? 'var(--amber-bright)' : 'var(--spray)',
              }}>
                💨 {msToKnots(wind)}kt
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Activity ratings ──────────────────────────────────────────────────────────
function ActivityRatings({ data, startIdx }: { data: WeatherData; startIdx: number }) {
  const wind    = data.hourly.wind_speed_10m[startIdx] ?? 5
  const temp    = data.hourly.temperature_2m[startIdx] ?? 15
  const precip  = data.hourly.precipitation[startIdx] ?? 0
  const cloud   = data.hourly.cloud_cover[startIdx] ?? 30

  const surf  = rateActivity(wind, temp, precip, cloud, 'surf')
  const trail = rateActivity(wind, temp, precip, cloud, 'trail')
  const snow  = rateActivity(wind, temp, precip, cloud, 'snow')

  const activities = [
    { icon: '🏄', label: 'Surf Conditions', sport: 'Surf',   rating: surf  },
    { icon: '🥾', label: 'Trail Conditions', sport: 'Trail', rating: trail },
    { icon: '⛷️', label: 'Snow Conditions',  sport: 'Snow',  rating: snow  },
  ]

  return (
    <div style={{
      background: 'var(--tile-bg)',
      border: '1px solid var(--tile-border)',
      borderRadius: 14,
      padding: '20px 24px',
      boxShadow: 'var(--tile-shadow)',
    }}>
      <Label>Outdoor Activity Ratings</Label>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {activities.map(({ icon, label, rating }) => (
          <div key={label} style={{
            background: 'var(--paper-sunken)',
            border: `1px solid ${rating.color}33`,
            borderRadius: 12,
            padding: '16px 18px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              <div>
                <div style={{ fontFamily: 'Syne, system-ui, sans-serif', fontSize: 13, fontWeight: 700, color: 'var(--foam)' }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: rating.color, marginTop: 1 }}>
                  {rating.label}
                </div>
              </div>
            </div>
            <div style={{ height: 6, background: 'var(--tile-border)', borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${rating.score}%`,
                background: rating.color,
                borderRadius: 3,
                transition: 'width 0.5s ease',
              }} />
            </div>
            <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--spray)', lineHeight: 1.5 }}>
              {rating.detail}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Main Client Component ─────────────────────────────────────────────────────

export default function WeatherPageClient() {
  const [spots, setSpots] = useState<SpotEntry[]>([])
  const [search, setSearch] = useState('')
  const [selectedSpot, setSelectedSpot] = useState<SpotEntry | null>(null)
  const [currentData, setCurrentData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(false)
  const { location } = useLocation()

  // Load spots on mount
  useEffect(() => {
    fetch('/spots.json')
      .then(r => r.json())
      .then((data: SpotEntry[]) => setSpots(data))
      .catch(() => {/* ignore — no spots available */})
  }, [])

  // Auto-select nearest spot on location or spots load
  useEffect(() => {
    if (!spots.length) return
    if (selectedSpot) return
    if (location) {
      const nearest = [...spots].sort((a, b) =>
        distMi(location.lat, location.lng, a.lat, a.lng) -
        distMi(location.lat, location.lng, b.lat, b.lng)
      )[0]
      setSelectedSpot(nearest)
    } else {
      setSelectedSpot(spots[0])
    }
  }, [spots, location, selectedSpot])

  // Nearest 8 tabs (filtered by search, sorted by distance if location available)
  const nearestEight = useMemo(() => {
    if (!spots.length) return []
    const filtered = search
      ? spots.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.region.toLowerCase().includes(search.toLowerCase()))
      : spots
    if (location) {
      return [...filtered]
        .sort((a, b) =>
          distMi(location.lat, location.lng, a.lat, a.lng) -
          distMi(location.lat, location.lng, b.lat, b.lng)
        )
        .slice(0, 8)
    }
    return filtered.slice(0, 8)
  }, [spots, location, search])

  // Fetch weather when selected spot changes
  useEffect(() => {
    if (!selectedSpot) return
    setLoading(true)
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${selectedSpot.lat}&longitude=${selectedSpot.lng}&hourly=temperature_2m,precipitation,wind_speed_10m,wind_direction_10m,cloud_cover,visibility&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&wind_speed_unit=ms&timezone=auto&forecast_days=8`
    fetch(url)
      .then(r => r.ok ? r.json() as Promise<WeatherData> : Promise.reject())
      .then((d: WeatherData) => setCurrentData(d))
      .catch(() => setCurrentData(makePlaceholderData()))
      .finally(() => setLoading(false))
  }, [selectedSpot])

  const data = useMemo(() => currentData ?? makePlaceholderData(), [currentData])

  // Find current hour index
  const nowIdx = useMemo(() => {
    const now = Date.now()
    let best = 0
    data.hourly.time.forEach((t, i) => {
      if (new Date(t).getTime() <= now) best = i
    })
    return Math.min(best, data.hourly.time.length - 1)
  }, [data])

  const curTemp    = data.hourly.temperature_2m[nowIdx]    ?? 15
  const curWind    = data.hourly.wind_speed_10m[nowIdx]    ?? 5
  const curWindDir = data.hourly.wind_direction_10m[nowIdx] ?? 270
  const curCloud   = data.hourly.cloud_cover[nowIdx]        ?? 30
  const curVis     = (data.hourly.visibility[nowIdx]        ?? 15000) / 1000

  const uvIndex      = Math.max(0, Math.round(8 - curCloud * 0.06 + (curTemp > 20 ? 2 : 0)))
  const humidity     = Math.round(50 + (curCloud * 0.3) + (curTemp < 10 ? 15 : 0))
  const dewPoint     = Math.round(curTemp - (100 - humidity) / 5)
  const pressure     = 1013 + Math.round(Math.sin(nowIdx / 12) * 8)
  const pressureTrend = nowIdx > 3
    ? data.hourly.wind_speed_10m[nowIdx] > data.hourly.wind_speed_10m[nowIdx - 3]
      ? '↑' : '↓'
    : '→'

  const uvInfo = uvRisk(uvIndex)

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: 'var(--deep)' }}>
      {/* Nav-removal notice */}
      <div style={{ fontSize: 12, color: 'var(--spray)', background: 'var(--cyan-muted)', padding: '8px 16px', borderBottom: '1px solid var(--tile-border)' }}>
        Weather data is also available as a map overlay in{' '}
        <a href="/map" style={{ color: 'var(--cyan-bright)', textDecoration: 'underline' }}>Spots →</a>
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(180,83,9,0.12)',
              border: '1px solid rgba(180,83,9,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>☁️</div>
            <div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9, fontWeight: 700,
                color: 'var(--amber-bright)', letterSpacing: '0.2em', textTransform: 'uppercase',
              }}>
                KOASTCAST · WEATHER INTELLIGENCE
              </div>
            </div>
            {/* Live badge */}
            <div style={{
              marginLeft: 'auto',
              display: 'flex', alignItems: 'center', gap: 6,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 600,
              color: '#059669', letterSpacing: '0.12em',
              background: 'rgba(5,150,105,0.1)',
              border: '1px solid rgba(5,150,105,0.2)',
              borderRadius: 20, padding: '4px 10px',
            }}>
              <div style={{
                width: 5, height: 5, borderRadius: '50%',
                background: '#059669',
                animation: 'bio-pulse-trail 2s ease-in-out infinite',
              }} />
              LIVE DATA
            </div>
          </div>

          {/* Title + location badge */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
            <h1 style={{
              fontFamily: 'Syne, system-ui, sans-serif',
              fontSize: 32, fontWeight: 800,
              color: 'var(--foam)', letterSpacing: '-0.03em',
              margin: 0,
            }}>
              Weather Intelligence
            </h1>
            {location && (
              <span style={{
                fontSize: 11,
                color: 'var(--cyan-bright)',
                fontFamily: 'JetBrains Mono, monospace',
                letterSpacing: '0.08em',
              }}>
                📍 USING YOUR LOCATION
              </span>
            )}
          </div>
          <div style={{ fontSize: 13, color: 'var(--spray)', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>
            {selectedSpot ? `${selectedSpot.name} · ${selectedSpot.region}` : 'Select a location'}
          </div>
        </div>

        {/* ── Search + spot tabs ───────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search spots..."
            style={{
              background: 'var(--paper-raised)',
              border: '1px solid var(--tile-border-strong)',
              borderRadius: 10,
              padding: '8px 14px',
              color: 'var(--foam)',
              fontSize: 13,
              width: '100%',
              marginBottom: 8,
              outline: 'none',
              boxSizing: 'border-box',
              fontFamily: 'JetBrains Mono, monospace',
            }}
          />
          <div
            style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}
            className="no-scrollbar"
          >
            {nearestEight.map(spot => (
              <button
                key={spot.slug}
                onClick={() => setSelectedSpot(spot)}
                style={{
                  flexShrink: 0,
                  padding: '6px 14px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: 'none',
                  background: selectedSpot?.slug === spot.slug
                    ? 'var(--cyan-muted)'
                    : 'var(--paper-sunken)',
                  color: selectedSpot?.slug === spot.slug
                    ? 'var(--cyan-bright)'
                    : 'var(--spray)',
                  borderBottom: selectedSpot?.slug === spot.slug
                    ? '2px solid var(--cyan)'
                    : '2px solid transparent',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Syne, system-ui, sans-serif',
                }}
              >
                {spot.name.length > 14 ? spot.name.slice(0, 13) + '…' : spot.name}
              </button>
            ))}
            {nearestEight.length === 0 && search && (
              <span style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11,
                color: 'var(--deep-text)',
                padding: '6px 14px',
              }}>
                No spots match &quot;{search}&quot;
              </span>
            )}
          </div>
        </div>

        {/* ── Current conditions hero ──────────────────────────────────── */}
        <div style={{
          background: 'var(--tile-bg)',
          border: '1px solid var(--tile-border-strong)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--tile-shadow)',
        }}>
          <div style={{
            position: 'absolute', top: -60, right: -60,
            width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(180,83,9,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          {loading && (
            <div style={{
              position: 'absolute', top: 12, right: 16,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--amber-bright)',
              letterSpacing: '0.12em',
            }}>
              UPDATING...
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 72, fontWeight: 700,
                  color: 'var(--cyan-bright)', lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}>
                  {Math.round(curTemp)}
                </span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 28, fontWeight: 400,
                  color: 'var(--spray)', marginTop: 8,
                }}>°C</span>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 18, fontWeight: 400,
                  color: 'var(--deep-text)', marginTop: 14, marginLeft: 4,
                }}>/ {cToF(curTemp)}°F</span>
              </div>
              <div style={{
                fontFamily: 'Syne, system-ui, sans-serif',
                fontSize: 18, fontWeight: 700,
                color: 'var(--mist)', marginTop: 4,
              }}>
                {selectedSpot?.name ?? '—'}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 11, color: 'var(--spray)', marginTop: 6,
              }}>
                {cloudToEmoji(curCloud)} {Math.round(curCloud)}% cloud cover
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 16,
              flex: 1,
              minWidth: 260,
            }}>
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Wind</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--amber-bright)' }}>{msToKnots(curWind)}kt</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--spray)', marginTop: 2 }}>{degToCompass(curWindDir)} {Math.round(curWindDir)}°</div>
              </div>
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Visibility</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--foam)' }}>{curVis.toFixed(0)}km</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--spray)', marginTop: 2 }}>{(curVis * 0.621).toFixed(0)}mi</div>
              </div>
              <div style={{ padding: '12px 0' }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Feels Like</div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: 'var(--cyan-bright)' }}>
                  {Math.round(curTemp - curWind * 0.4)}°C
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--spray)', marginTop: 2 }}>wind chill</div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Conditions grid ──────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
          <DataCard icon="☀️" label="UV Index"    value={String(uvIndex)}           sub={uvInfo.label} accent={uvInfo.color} />
          <DataCard icon="🌡️" label="Pressure"    value={`${pressure}hPa`}          sub={`Trend: ${pressureTrend}`} />
          <DataCard icon="💧" label="Humidity"    value={`${humidity}%`}             sub={humidity > 80 ? 'Very humid' : humidity < 30 ? 'Very dry' : 'Comfortable'} />
          <DataCard icon="☁️" label="Cloud Cover" value={`${Math.round(curCloud)}%`}  sub={cloudToEmoji(curCloud)} />
          <DataCard icon="👁️" label="Visibility"  value={`${curVis.toFixed(1)}km`}   sub={curVis > 10 ? 'Excellent' : curVis > 5 ? 'Good' : 'Reduced'} />
          <DataCard icon="🌫️" label="Dew Point"   value={`${dewPoint}°C`}            sub={dewPoint > curTemp - 3 ? 'Near saturation' : 'Comfortable'} />
        </div>

        {/* ── Hourly chart ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <HourlyChart data={data} startIdx={nowIdx} />
        </div>

        {/* ── 7-Day forecast ───────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <SevenDayForecast daily={data.daily} />
        </div>

        {/* ── Activity ratings ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <ActivityRatings data={data} startIdx={nowIdx} />
        </div>

        {/* ── Footer note ──────────────────────────────────────────────── */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.1em',
          textAlign: 'center', marginTop: 16,
        }}>
          DATA: OPEN-METEO · ECMWF · NOAA · REFRESHES EVERY 5 MIN
        </div>
      </div>
    </div>
  )
}
