'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useLocation } from '@/lib/location'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpotBrief {
  name: string
  slug: string
  lat: number
  lng: number
  region: string
  optimal_wind_direction?: number
}

interface WindData {
  hourly: {
    time: string[]
    wind_speed_10m: number[]
    wind_direction_10m: number[]
    wind_gusts_10m: number[]
  }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MS_TO_KT = 1.944

const WIND_BANDS = [
  { label: 'Calm',           min: 0,  max: 5,  color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  { label: 'Light Breeze',   min: 5,  max: 10, color: '#06B6D4', bg: 'rgba(6,182,212,0.1)'  },
  { label: 'Moderate',       min: 10, max: 15, color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
  { label: 'Fresh Breeze',   min: 15, max: 20, color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { label: 'Strong',         min: 20, max: 999,color: '#EF4444', bg: 'rgba(239,68,68,0.1)'  },
] as const

// ── Helpers ───────────────────────────────────────────────────────────────────

function msToKnots(ms: number) { return ms * MS_TO_KT }

function degToCompass(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
  return dirs[Math.round(((deg % 360) + 360) / 22.5) % 16]
}

function angleDiff(a: number, b: number): number {
  return Math.abs(((a - b + 180 + 360) % 360) - 180)
}

function windQuality(windDir: number, offshoreDir: number): {
  label: string; color: string; score: number
} {
  const diff = angleDiff(windDir, offshoreDir)
  if (diff <= 30)  return { label: 'Offshore',    color: '#10B981', score: 100 - diff }
  if (diff <= 60)  return { label: 'Cross-Off',   color: '#06B6D4', score: 80 - diff }
  if (diff <= 90)  return { label: 'Cross-Shore', color: '#F59E0B', score: 60 - diff }
  if (diff <= 135) return { label: 'Cross-On',    color: '#F97316', score: 30 }
  return { label: 'Onshore', color: '#EF4444', score: 10 }
}

function currentWindBand(knots: number) {
  return WIND_BANDS.find(b => knots >= b.min && knots < b.max) ?? WIND_BANDS[WIND_BANDS.length - 1]
}

function distMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function makePlaceholder(): WindData {
  const now = new Date()
  return {
    hourly: {
      time:               Array.from({ length: 72 }, (_, i) => { const d = new Date(now); d.setHours(d.getHours() + i); return d.toISOString() }),
      wind_speed_10m:     Array.from({ length: 72 }, (_, i) => 5 + Math.sin(i / 8) * 3),
      wind_direction_10m: Array.from({ length: 72 }, (_, i) => 270 + Math.sin(i / 6) * 25),
      wind_gusts_10m:     Array.from({ length: 72 }, (_, i) => 7 + Math.sin(i / 8) * 4),
    }
  }
}

// ── Compass Rose SVG ─────────────────────────────────────────────────────────

function CompassRose({ windDir }: { windDir: number }) {
  const cx = 90, cy = 90, r = 72

  const cardinals = [
    { label: 'N',   deg: 0   },
    { label: 'NE',  deg: 45  },
    { label: 'E',   deg: 90  },
    { label: 'SE',  deg: 135 },
    { label: 'S',   deg: 180 },
    { label: 'SW',  deg: 225 },
    { label: 'W',   deg: 270 },
    { label: 'NW',  deg: 315 },
  ]

  function polarToXY(deg: number, radius: number) {
    const rad = ((deg - 90) * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }

  const needleTip   = polarToXY(windDir, r - 10)
  const needleTail  = polarToXY(windDir + 180, r - 10)
  const needleLeft  = polarToXY(windDir + 90, 8)
  const needleRight = polarToXY(windDir - 90, 8)

  return (
    <svg viewBox="0 0 180 180" style={{ width: 180, height: 180, display: 'block' }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(6,182,212,0.15)" strokeWidth={1.5} />
      <circle cx={cx} cy={cy} r={r * 0.6} fill="none" stroke="rgba(6,182,212,0.08)" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={4} fill="rgba(6,182,212,0.3)" />

      {Array.from({ length: 36 }, (_, i) => {
        const deg = i * 10
        const inner = polarToXY(deg, r - 6)
        const outer = polarToXY(deg, r)
        const isCard = deg % 45 === 0
        return (
          <line
            key={deg}
            x1={inner.x} y1={inner.y}
            x2={outer.x} y2={outer.y}
            stroke={isCard ? 'rgba(6,182,212,0.5)' : 'rgba(6,182,212,0.2)'}
            strokeWidth={isCard ? 1.5 : 0.8}
          />
        )
      })}

      {cardinals.map(({ label, deg }) => {
        const pos = polarToXY(deg, r + 14)
        const isN = label === 'N'
        return (
          <text
            key={label}
            x={pos.x} y={pos.y + 3.5}
            textAnchor="middle"
            fill={isN ? '#22D3EE' : 'rgba(6,182,212,0.5)'}
            style={{ font: `${isN ? 700 : 500} ${isN ? 10 : 8}px JetBrains Mono, monospace` }}
          >
            {label}
          </text>
        )
      })}

      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleLeft.x},${needleLeft.y} ${needleTail.x},${needleTail.y}`}
        fill="rgba(239,68,68,0.15)"
        stroke="rgba(239,68,68,0.5)"
        strokeWidth={1}
      />
      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleLeft.x},${needleLeft.y} ${cx},${cy}`}
        fill="#06B6D4"
        opacity={0.9}
      />
      <polygon
        points={`${needleTip.x},${needleTip.y} ${needleRight.x},${needleRight.y} ${cx},${cy}`}
        fill="#22D3EE"
        opacity={0.7}
      />

      <text
        x={cx} y={cy + 22}
        textAnchor="middle"
        fill="#06B6D4"
        style={{ font: '700 10px JetBrains Mono, monospace' }}
      >
        {degToCompass(windDir)}
      </text>
    </svg>
  )
}

// ── Wind Timeline SVG ─────────────────────────────────────────────────────────

function WindTimeline({ data, startIdx }: { data: WindData; startIdx: number }) {
  const hours = data.hourly
  const count = 48
  const slice = {
    time:  hours.time.slice(startIdx, startIdx + count),
    speed: hours.wind_speed_10m.slice(startIdx, startIdx + count).map(msToKnots),
    gusts: hours.wind_gusts_10m.slice(startIdx, startIdx + count).map(msToKnots),
    dir:   hours.wind_direction_10m.slice(startIdx, startIdx + count),
  }

  const W = 900, H = 140
  const maxVal = Math.max(...slice.gusts, 20)
  const minVal = 0

  function toY(v: number) {
    return H - 20 - ((v - minVal) / (maxVal - minVal)) * (H - 40)
  }
  function toX(i: number) {
    return (i / (count - 1)) * (W - 40) + 20
  }

  const speedPath = slice.speed.map((s, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(s)}`
  ).join(' ')
  const speedFill = speedPath + ` L ${toX(count - 1)} ${H - 20} L ${toX(0)} ${H - 20} Z`

  const gustPath = slice.gusts.map((g, i) =>
    `${i === 0 ? 'M' : 'L'} ${toX(i)} ${toY(g)}`
  ).join(' ')

  const arrowIdxs = slice.time.map((t, i) => ({ i, h: new Date(t).getHours() }))
    .filter(({ h }) => h % 6 === 0)
    .map(({ i }) => i)

  const gridVals = [5, 10, 15, 20, 25].filter(v => v <= maxVal + 5)

  return (
    <div style={{
      background: 'rgba(6,13,26,0.72)',
      border: '1px solid rgba(6,182,212,0.13)',
      borderRadius: 14,
      padding: '20px 24px',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#2E5568', textTransform: 'uppercase', marginBottom: 12 }}>
        48-Hour Wind Timeline
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg
          viewBox={`0 0 ${W} ${H + 70}`}
          style={{ width: '100%', minWidth: 480, height: 'auto', display: 'block' }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="speedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%"   stopColor="#06B6D4" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06B6D4" stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {gridVals.map(v => (
            <g key={v}>
              <line x1={20} y1={toY(v)} x2={W - 20} y2={toY(v)} stroke="rgba(6,182,212,0.07)" strokeWidth={1} />
              <text x={16} y={toY(v) + 3} textAnchor="end" fill="#2E5568" style={{ font: '8px JetBrains Mono, monospace' }}>{v}</text>
            </g>
          ))}

          <path d={speedFill} fill="url(#speedGrad)" />
          <path d={speedPath} fill="none" stroke="#06B6D4" strokeWidth={2} strokeLinejoin="round" />
          <path d={gustPath} fill="none" stroke="rgba(245,158,11,0.7)" strokeWidth={1.5} strokeDasharray="4,3" strokeLinejoin="round" />

          {arrowIdxs.map(i => {
            const x = toX(i)
            const dir = slice.dir[i]
            const rad = ((dir - 90) * Math.PI) / 180
            const len = 8
            const dx = Math.cos(rad) * len
            const dy = Math.sin(rad) * len
            return (
              <g key={i}>
                <line
                  x1={x - dx / 2} y1={H - 8 - dy / 2}
                  x2={x + dx / 2} y2={H - 8 + dy / 2}
                  stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round"
                />
                <polygon
                  points={`${x + dx / 2},${H - 8 + dy / 2} ${x + dx / 2 - dy * 0.3},${H - 8 + dy / 2 - dx * 0.3} ${x + dx / 2 + dy * 0.3},${H - 8 + dy / 2 + dx * 0.3}`}
                  fill="#F59E0B"
                />
                <text x={x} y={H + 4} textAnchor="middle" fill="#6B9BAD" style={{ font: '8px JetBrains Mono, monospace' }}>
                  {degToCompass(dir)}
                </text>
              </g>
            )
          })}

          {slice.time.map((t, i) => {
            const h = new Date(t).getHours()
            if (h !== 0 && h !== 6 && h !== 12 && h !== 18) return null
            const x = toX(i)
            const label = h === 0
              ? new Date(t).toLocaleDateString('en-US', { weekday: 'short' })
              : h === 12 ? '12pm' : h < 12 ? `${h}am` : `${h - 12}pm`
            return (
              <text key={i} x={x} y={H + 22} textAnchor="middle" fill={h === 0 ? '#B0D4DC' : '#2E5568'} style={{ font: `${h === 0 ? 600 : 500} 8px JetBrains Mono, monospace` }}>
                {label}
              </text>
            )
          })}

          <g transform={`translate(${W - 170}, 4)`}>
            <line x1={0} y1={5} x2={16} y2={5} stroke="#06B6D4" strokeWidth={2} />
            <text x={20} y={8} fill="#6B9BAD" style={{ font: '9px JetBrains Mono, monospace' }}>Speed (kt)</text>
            <line x1={0} y1={19} x2={16} y2={19} stroke="rgba(245,158,11,0.7)" strokeWidth={1.5} strokeDasharray="4,3" />
            <text x={20} y={22} fill="#6B9BAD" style={{ font: '9px JetBrains Mono, monospace' }}>Gusts (kt)</text>
          </g>
        </svg>
      </div>
    </div>
  )
}

// ── Offshore Analyzer ─────────────────────────────────────────────────────────

interface AnalyzerSpot { name: string; offshoreDir: number }

function OffshoreAnalyzer({
  windDir,
  windKt,
  spots,
}: {
  windDir: number
  windKt: number
  spots: AnalyzerSpot[]
}) {
  const ranked = spots.map(s => ({
    ...s,
    quality: windQuality(windDir, s.offshoreDir),
  })).sort((a, b) => b.quality.score - a.quality.score)

  if (ranked.length === 0) {
    return (
      <div style={{
        background: 'rgba(6,13,26,0.72)',
        border: '1px solid rgba(6,182,212,0.13)',
        borderRadius: 14,
        padding: '20px 24px',
      }}>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#2E5568', textTransform: 'uppercase', marginBottom: 14 }}>
          Offshore Wind Analyzer · {degToCompass(windDir)} {Math.round(windDir)}° · {windKt.toFixed(0)}kt
        </div>
        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#2E5568' }}>
          No nearby spots with wind data available
        </div>
      </div>
    )
  }

  return (
    <div style={{
      background: 'rgba(6,13,26,0.72)',
      border: '1px solid rgba(6,182,212,0.13)',
      borderRadius: 14,
      padding: '20px 24px',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#2E5568', textTransform: 'uppercase', marginBottom: 14 }}>
        Offshore Wind Analyzer · {degToCompass(windDir)} {Math.round(windDir)}° · {windKt.toFixed(0)}kt
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {ranked.map((spot, rank) => (
          <div key={spot.name} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${spot.quality.color}22`,
            borderRadius: 10,
          }}>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
              color: rank === 0 ? spot.quality.color : '#2E5568',
              width: 18, textAlign: 'center', flexShrink: 0,
            }}>
              {rank + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Syne, system-ui, sans-serif', fontSize: 13, fontWeight: 600, color: '#E0F7FA' }}>
                {spot.name}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#6B9BAD', marginTop: 2 }}>
                Optimal offshore: {degToCompass(spot.offshoreDir)} ({spot.offshoreDir}°)
              </div>
            </div>
            <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden', flexShrink: 0 }}>
              <div style={{
                height: '100%',
                width: `${Math.max(5, spot.quality.score)}%`,
                background: spot.quality.color,
                borderRadius: 2,
              }} />
            </div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
              color: spot.quality.color,
              width: 80, textAlign: 'right', flexShrink: 0,
            }}>
              {spot.quality.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Wind Speed Bands ──────────────────────────────────────────────────────────

function WindBands({ currentKt }: { currentKt: number }) {
  const active = currentWindBand(currentKt)
  return (
    <div style={{
      background: 'rgba(6,13,26,0.72)',
      border: '1px solid rgba(6,182,212,0.13)',
      borderRadius: 14,
      padding: '20px 24px',
    }}>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#2E5568', textTransform: 'uppercase', marginBottom: 14 }}>
        Wind Speed Reference · Current: {currentKt.toFixed(1)}kt
      </div>
      <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 14 }}>
        {WIND_BANDS.map(b => (
          <div
            key={b.label}
            style={{
              flex: b.max === 999 ? 1 : (b.max - b.min),
              background: b.color,
              opacity: active.label === b.label ? 1 : 0.25,
              transition: 'opacity 0.3s',
            }}
          />
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {WIND_BANDS.map(b => {
          const isCurrent = active.label === b.label
          return (
            <div key={b.label} style={{
              padding: '8px 12px',
              borderRadius: 8,
              background: isCurrent ? b.bg : 'rgba(255,255,255,0.02)',
              border: `1px solid ${isCurrent ? b.color + '55' : 'rgba(255,255,255,0.05)'}`,
              flex: '1 1 100px',
            }}>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fontWeight: 700,
                color: isCurrent ? b.color : '#6B9BAD',
                marginBottom: 3,
              }}>
                {b.label}
              </div>
              <div style={{
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                color: isCurrent ? b.color : '#2E5568',
              }}>
                {b.max === 999 ? `${b.min}kt+` : `${b.min}–${b.max}kt`}
              </div>
              {isCurrent && (
                <div style={{
                  fontFamily: 'JetBrains Mono, monospace', fontSize: 8, color: b.color,
                  marginTop: 4, letterSpacing: '0.08em',
                }}>
                  ← YOU ARE HERE
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function WindPage() {
  const { location } = useLocation()

  const [spots, setSpots] = useState<SpotBrief[]>([])
  const [selectedSpot, setSelectedSpot] = useState<SpotBrief | null>(null)
  const [search, setSearch] = useState('')

  const [windData, setWindData] = useState<WindData | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(false)

  // Load spots.json on mount
  useEffect(() => {
    fetch('/spots.json')
      .then(r => r.json())
      .then((data: SpotBrief[]) => setSpots(data))
      .catch(() => {})
  }, [])

  // Auto-select nearest spot once spots + optional location are available
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

  // Re-sort to nearest when location changes (only if user hasn't manually picked)
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null)
  useEffect(() => {
    if (!location || !spots.length) return
    const prev = prevLocationRef.current
    if (prev && prev.lat === location.lat && prev.lng === location.lng) return
    prevLocationRef.current = { lat: location.lat, lng: location.lng }
    const nearest = [...spots].sort((a, b) =>
      distMi(location.lat, location.lng, a.lat, a.lng) -
      distMi(location.lat, location.lng, b.lat, b.lng)
    )[0]
    setSelectedSpot(nearest)
  }, [location, spots])

  // Fetch wind data whenever selected spot changes
  useEffect(() => {
    if (!selectedSpot) return
    setLoading(true)
    setFetchError(false)

    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude',  String(selectedSpot.lat))
    url.searchParams.set('longitude', String(selectedSpot.lng))
    url.searchParams.set('hourly', 'wind_speed_10m,wind_direction_10m,wind_gusts_10m')
    url.searchParams.set('forecast_days', '3')
    url.searchParams.set('wind_speed_unit', 'ms')
    url.searchParams.set('timezone', 'auto')

    fetch(url.toString())
      .then(r => {
        if (!r.ok) throw new Error('bad status')
        return r.json() as Promise<WindData>
      })
      .then(d => setWindData(d))
      .catch(() => {
        setFetchError(true)
        setWindData(makePlaceholder())
      })
      .finally(() => setLoading(false))
  }, [selectedSpot])

  // Search-filtered + nearest-8 tab list
  const nearestEight = useMemo(() => {
    if (!spots.length) return []
    const filtered = search.trim()
      ? spots.filter(s =>
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.region.toLowerCase().includes(search.toLowerCase())
        )
      : spots

    if (location) {
      return [...filtered].sort((a, b) =>
        distMi(location.lat, location.lng, a.lat, a.lng) -
        distMi(location.lat, location.lng, b.lat, b.lng)
      ).slice(0, 8)
    }
    return filtered.slice(0, 8)
  }, [spots, location, search])

  // Nearby spots for OffshoreAnalyzer (5 nearest besides selected, with wind data)
  const nearbyForAnalyzer = useMemo((): AnalyzerSpot[] => {
    if (!selectedSpot || !spots.length) return []
    return [...spots]
      .filter(s => s.slug !== selectedSpot.slug && s.optimal_wind_direction != null)
      .sort((a, b) =>
        distMi(selectedSpot.lat, selectedSpot.lng, a.lat, a.lng) -
        distMi(selectedSpot.lat, selectedSpot.lng, b.lat, b.lng)
      )
      .slice(0, 5)
      .map(s => ({ name: s.name, offshoreDir: s.optimal_wind_direction! }))
  }, [selectedSpot, spots])

  const nowIdx = useMemo(() => {
    if (!windData) return 0
    const now = Date.now()
    let best = 0
    windData.hourly.time.forEach((t, i) => {
      if (new Date(t).getTime() <= now) best = i
    })
    return Math.min(best, windData.hourly.time.length - 1)
  }, [windData])

  const d = windData ?? makePlaceholder()

  const curSpeedMs = d.hourly.wind_speed_10m[nowIdx]    ?? 5
  const curGustMs  = d.hourly.wind_gusts_10m[nowIdx]    ?? 7
  const curDir     = d.hourly.wind_direction_10m[nowIdx] ?? 270
  const curKnots   = msToKnots(curSpeedMs)
  const curGustKt  = msToKnots(curGustMs)
  const band       = currentWindBand(curKnots)

  // Current quality against selected spot's offshore direction (if known)
  const offshoreRef = selectedSpot?.optimal_wind_direction ?? 90
  const curQuality  = windQuality(curDir, offshoreRef)

  // Peak gust in next 24h
  const next24Gusts = d.hourly.wind_gusts_10m.slice(nowIdx, nowIdx + 24).map(msToKnots)
  const peakGust24  = next24Gusts.length ? Math.max(...next24Gusts) : curGustKt

  // Live stat cards (replaces hardcoded historical context)
  const liveStats = [
    {
      label:  'Current Direction',
      value:  `${degToCompass(curDir)} (${Math.round(curDir)}°)`,
      detail: 'Live from Open-Meteo',
      color:  '#06B6D4',
    },
    {
      label:  'Current Speed',
      value:  `${curKnots.toFixed(0)} kt`,
      detail: `${curSpeedMs.toFixed(1)} m/s`,
      color:  '#F59E0B',
    },
    {
      label:  'Peak Gusts (24h)',
      value:  `${peakGust24.toFixed(0)} kt`,
      detail: 'Max gust next 24 hours',
      color:  '#EF4444',
    },
    {
      label:  'Offshore Quality',
      value:  curQuality.label,
      detail: selectedSpot?.optimal_wind_direction != null
        ? `vs. ${degToCompass(offshoreRef)} offshore ideal`
        : 'Select a spot for accuracy',
      color:  curQuality.color,
    },
  ]

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#060D1A' }}>
      {/* Nav-removal notice */}
      <div style={{ fontSize: 12, color: 'var(--deep-text)', background: 'rgba(6,182,212,0.05)', padding: '8px 16px', borderBottom: '1px solid rgba(6,182,212,0.08)' }}>
        Wind data is available as a layer on the{' '}
        <a href="/map" style={{ color: '#06B6D4', textDecoration: 'underline' }}>Spots map →</a>
      </div>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 64px' }}>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(6,182,212,0.12)',
              border: '1px solid rgba(6,182,212,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>🌬️</div>
            <div style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: 9, fontWeight: 700,
              color: '#06B6D4', letterSpacing: '0.2em', textTransform: 'uppercase',
            }}>
              KOASTCAST · WIND ANALYSIS
            </div>
            {loading && (
              <div style={{
                marginLeft: 'auto',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#06B6D4',
                letterSpacing: '0.12em',
              }}>
                FETCHING WIND DATA...
              </div>
            )}
            {fetchError && !loading && (
              <div style={{
                marginLeft: 'auto',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                color: '#F59E0B', letterSpacing: '0.1em',
              }}>
                DEMO DATA · CONNECT FOR LIVE
              </div>
            )}
          </div>
          <h1 style={{
            fontFamily: 'Syne, system-ui, sans-serif',
            fontSize: 32, fontWeight: 800,
            color: '#E0F7FA', letterSpacing: '-0.03em',
            margin: 0,
          }}>
            Wind Analysis
          </h1>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#6B9BAD', marginTop: 6 }}>
            {selectedSpot
              ? `${selectedSpot.name} · ${selectedSpot.region}`
              : 'Select a location'}
          </div>
        </div>

        {/* ── Spot Selector ────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(6,13,26,0.72)',
          border: '1px solid rgba(6,182,212,0.13)',
          borderRadius: 14,
          padding: '16px 20px',
          marginBottom: 20,
        }}>
          {location && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700,
              color: '#10B981', letterSpacing: '0.14em',
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.2)',
              borderRadius: 6, padding: '3px 10px',
              marginBottom: 10,
            }}>
              📍 USING YOUR LOCATION
            </div>
          )}
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Search spots..."
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '8px 14px',
              color: 'white', fontSize: 13, width: '100%',
              marginBottom: 8, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 4 }}>
            {nearestEight.map(spot => (
              <button
                key={spot.slug}
                onClick={() => setSelectedSpot(spot)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: 20,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
                  background: selectedSpot?.slug === spot.slug
                    ? 'rgba(6,182,212,0.15)'
                    : 'rgba(255,255,255,0.05)',
                  color: selectedSpot?.slug === spot.slug
                    ? '#06B6D4'
                    : 'rgba(255,255,255,0.5)',
                  borderBottom: selectedSpot?.slug === spot.slug
                    ? '2px solid #06B6D4'
                    : '2px solid transparent',
                  transition: 'all 0.15s', whiteSpace: 'nowrap',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
              >
                {spot.name.length > 14 ? spot.name.slice(0, 13) + '…' : spot.name}
              </button>
            ))}
          </div>
        </div>

        {/* ── Wind Hero ────────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(6,13,26,0.72)',
          border: '1px solid rgba(6,182,212,0.15)',
          borderRadius: 16,
          padding: '28px 32px',
          marginBottom: 20,
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: -80, left: -80,
            width: 260, height: 260,
            background: 'radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 40, flexWrap: 'wrap' }}>
            <div style={{ flexShrink: 0 }}>
              <CompassRose windDir={curDir} />
            </div>

            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 4 }}>
                <span style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 72, fontWeight: 700,
                  color: band.color, lineHeight: 1,
                  letterSpacing: '-0.04em',
                }}>
                  {curKnots.toFixed(0)}
                </span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, color: '#6B9BAD', paddingBottom: 8 }}>kt</span>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 14, color: '#2E5568', paddingBottom: 10 }}>
                  {curSpeedMs.toFixed(1)}m/s
                </span>
              </div>

              <div style={{
                display: 'inline-block',
                fontFamily: 'JetBrains Mono, monospace', fontSize: 11, fontWeight: 700,
                color: band.color,
                background: band.bg,
                border: `1px solid ${band.color}33`,
                borderRadius: 6, padding: '3px 10px',
                marginBottom: 16,
              }}>
                {band.label.toUpperCase()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2E5568', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Direction</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#E0F7FA' }}>{degToCompass(curDir)}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B9BAD' }}>{Math.round(curDir)}°</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2E5568', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Gusts</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: '#F59E0B' }}>{curGustKt.toFixed(0)}kt</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B9BAD' }}>max gust</div>
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2E5568', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>Quality</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 20, fontWeight: 700, color: curQuality.color }}>{curQuality.label}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B9BAD' }}>for surf</div>
                </div>
              </div>
            </div>

            <div style={{
              flexShrink: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
              padding: '16px 20px',
              background: `${curQuality.color}11`,
              border: `1px solid ${curQuality.color}33`,
              borderRadius: 12,
              minWidth: 120,
            }}>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2E5568', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                Surf Rating
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 36, fontWeight: 800, color: curQuality.color, lineHeight: 1 }}>
                {Math.max(0, Math.min(100, Math.round(curQuality.score))).toString().padStart(2, ' ')}
              </div>
              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: curQuality.color }}>/ 100</div>
              <div style={{
                fontFamily: 'Syne, system-ui, sans-serif', fontSize: 13, fontWeight: 700,
                color: curQuality.color, textAlign: 'center',
              }}>
                {curQuality.label}
              </div>
            </div>
          </div>
        </div>

        {/* ── Offshore Analyzer ────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <OffshoreAnalyzer windDir={curDir} windKt={curKnots} spots={nearbyForAnalyzer} />
        </div>

        {/* ── Wind Timeline ─────────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <WindTimeline data={d} startIdx={nowIdx} />
        </div>

        {/* ── Wind Speed Bands ──────────────────────────────────────────── */}
        <div style={{ marginBottom: 20 }}>
          <WindBands currentKt={curKnots} />
        </div>

        {/* ── Live Wind Stats ────────────────────────────────────────────── */}
        <div style={{
          background: 'rgba(6,13,26,0.72)',
          border: '1px solid rgba(6,182,212,0.13)',
          borderRadius: 14,
          padding: '20px 24px',
          marginBottom: 20,
        }}>
          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.18em', color: '#2E5568', textTransform: 'uppercase', marginBottom: 14 }}>
            Live Conditions · {selectedSpot?.name ?? '—'}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            {liveStats.map(({ label, value, detail, color }) => (
              <div key={label} style={{
                padding: '14px 16px',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.04)',
                borderRadius: 10,
              }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, color: '#2E5568', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color, marginBottom: 4 }}>
                  {value}
                </div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: '#6B9BAD', lineHeight: 1.5 }}>
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 9, color: '#2E5568', letterSpacing: '0.1em',
          textAlign: 'center',
        }}>
          DATA: OPEN-METEO · ECMWF SEAMLESS MODEL · 3-DAY FORECAST
          {selectedSpot ? ` · ${selectedSpot.name.toUpperCase()}` : ''}
        </div>
      </div>
    </div>
  )
}
