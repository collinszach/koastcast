'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import type { Spot } from '@/types'
import { getConditionLabel, formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow } from '@/types'
import { useSavedSpots } from '@/lib/useSavedSpots'
import { useLocation } from '@/lib/location'

const SpotMap = dynamic(() => import('@/components/spots/SpotMap'), {
  ssr: false,
  loading: () => (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020508' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(6,182,212,0.15)', borderTopColor: '#06b6d4', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
        <p style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(6,182,212,0.3)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>loading map</p>
      </div>
    </div>
  ),
})

export type MapStyle = 'dark' | 'ocean' | 'satellite'
type CondFilter = 'all' | 'firing' | 'pumping' | 'fun' | 'worth_it' | 'flat'
type QualityFilter = 'all' | 'fair' | 'good' | 'pumping_score' | 'epic'

// ─── Quality threshold filter config ──────────────────────────────────────────

const QUALITY_FILTERS: { key: QualityFilter; label: string; threshold: number | null }[] = [
  { key: 'all',           label: 'ALL',     threshold: null },
  { key: 'fair',          label: 'FAIR',    threshold: 3   },
  { key: 'good',          label: 'GOOD',    threshold: 5   },
  { key: 'pumping_score', label: 'PUMPING', threshold: 7   },
  { key: 'epic',          label: 'EPIC',    threshold: 8.5 },
]

function meetsQualityThreshold(spot: Spot, filter: QualityFilter): boolean {
  const qf = QUALITY_FILTERS.find(f => f.key === filter)
  if (!qf || qf.threshold === null) return true
  const qs = spot.current_conditions?.quality_score
  return qs != null && qs >= qf.threshold
}

// ─── Condition palette ─────────────────────────────────────────────────────────

const COND = {
  firing:   { accent: '#ef4444', bg: 'rgba(239,68,68,0.1)',  label: 'FIRING',   icon: '🔥' },
  pumping:  { accent: '#f97316', bg: 'rgba(249,115,22,0.1)', label: 'PUMPING',  icon: '🤙' },
  fun:      { accent: '#22c55e', bg: 'rgba(34,197,94,0.1)',  label: 'FUN',      icon: '😎' },
  worth_it: { accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)', label: 'WORTH IT', icon: '🏄' },
  flat:     { accent: '#4b5563', bg: 'rgba(75,85,99,0.1)',   label: 'FLAT',     icon: '😴' },
  no_data:  { accent: '#374151', bg: 'rgba(30,40,55,0.3)',   label: 'NO DATA',  icon: '—'  },
} as const

function cond(qs?: number | null) { return COND[getConditionLabel(qs)] }

// ─── Forecast strip ────────────────────────────────────────────────────────────

interface FH {
  forecast_time: string
  wave_height_face_m?: number | null
  wave_height_m?: number | null
  quality_score?: number | null
  wave_period_s?: number | null
  wind_speed_ms?: number | null
  wind_direction?: number | null
  tide_height_m?: number | null
  tide_state?: string | null
}

function ForecastBars({ hours }: { hours: FH[] }) {
  const slice = hours.slice(0, 24)
  const max = Math.max(...slice.map(h => (h.wave_height_face_m ?? h.wave_height_m) ?? 0), 0.5)
  return (
    <div>
      <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>24-HOUR TREND</p>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1.5, height: 28 }}>
        {slice.map((h, i) => {
          const ht = (h.wave_height_face_m ?? h.wave_height_m) ?? 0
          const pct = max > 0 ? ht / max : 0
          const c = cond(h.quality_score)
          return (
            <div key={i} style={{
              flex: 1, minWidth: 2,
              height: `${Math.max(10, pct * 100)}%`,
              background: i === 0 ? c.accent : `${c.accent}60`,
              borderRadius: '2px 2px 0 0',
            }} />
          )
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {[0, 8, 16, 23].map(i => {
          const h = slice[i]; if (!h) return null
          const hr = new Date(h.forecast_time).getHours()
          return <span key={i} style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em' }}>
            {hr === 0 ? '12a' : hr < 12 ? `${hr}a` : hr === 12 ? '12p' : `${hr-12}p`}
          </span>
        })}
      </div>
    </div>
  )
}

// ─── Detail panel ──────────────────────────────────────────────────────────────

function DetailPanel({ spot, onClose }: { spot: Spot; onClose: () => void }) {
  const { isSaved, toggle } = useSavedSpots()
  const saved = isSaved('spots', spot.slug)
  const bookmarkBtnRef = useRef<HTMLButtonElement>(null)

  function handleBookmark() {
    toggle('spots', spot.slug)
    const el = bookmarkBtnRef.current
    if (!el) return
    el.style.transform = 'scale(0.8)'
    el.style.transition = 'transform 0.15s ease'
    setTimeout(() => { el.style.transform = 'scale(1.1)' }, 0)
    setTimeout(() => { el.style.transform = 'scale(1.0)' }, 150)
  }

  const [hours, setHours] = useState<FH[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setHours([]); setLoading(true)
    let cancelled = false
    fetch(`/api/forecast?spot_id=${spot.slug}&days=2`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && d?.hours?.length) setHours(d.hours) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [spot.slug])

  const cc   = spot.current_conditions
  const live = hours[0] ?? null
  const qs   = cc?.quality_score  ?? live?.quality_score  ?? null
  const hM   = cc?.wave_height_face_m ?? live?.wave_height_face_m ?? (live?.wave_height_m as number | null | undefined)
  const hFt  = hM != null ? Math.round(hM * 3.281) : null
  const per  = cc?.wave_period_s  ?? live?.wave_period_s
  const wSpd = cc?.wind_speed_ms  ?? live?.wind_speed_ms
  const wDir = cc?.wind_direction ?? live?.wind_direction
  const tide = cc?.tide_height_m  ?? live?.tide_height_m
  const tSt  = cc?.tide_state     ?? live?.tide_state
  const m    = cond(qs)
  const isOffline = !cc && !live

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: `1px solid ${m.accent}20`,
        background: `linear-gradient(to bottom, ${m.accent}08, transparent)`,
        flexShrink: 0,
      }}>
        <button onClick={onClose} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6.5 1.5L2.5 5l4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to spots
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
              {spot.region} · {spot.break_type}
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
              color: '#f0f6ff', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>{spot.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: m.accent, background: m.bg, border: `1px solid ${m.accent}30`,
              padding: '4px 9px', borderRadius: 20,
            }}>
              {isOffline ? 'OFFLINE' : `${m.icon} ${m.label}`}
            </span>
            <button
              ref={bookmarkBtnRef}
              onClick={handleBookmark}
              style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${saved ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: saved ? '#06B6D4' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              aria-label={saved ? 'Remove from saved' : 'Save spot'}
            >
              <Bookmark size={13} style={{ fill: saved ? '#06B6D4' : 'none', stroke: 'currentColor', transition: 'fill 0.15s' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero height */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 64, fontWeight: 900, lineHeight: 1,
            letterSpacing: '-0.04em',
            color: isOffline ? 'rgba(255,255,255,0.06)' : loading ? 'rgba(255,255,255,0.08)' : m.accent,
            filter: (!isOffline && !loading && hFt != null) ? `drop-shadow(0 0 20px ${m.accent}60)` : 'none',
            transition: 'color 0.4s, filter 0.4s',
          }}>
            {isOffline ? '—' : loading ? '—' : (hFt ?? '—')}
          </span>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginBottom: 2 }}>
              {isOffline ? 'OFFLINE' : 'FEET FACE'}
            </p>
            {!isOffline && per != null && !loading && (
              <p style={{ fontFamily: 'monospace', fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.02em' }}>
                {formatPeriod(per)} period
              </p>
            )}
          </div>
        </div>

        {isOffline ? (
          <div style={{
            background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.15)',
            borderRadius: 10, padding: '12px 14px', textAlign: 'center',
          }}>
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(249,115,22,0.6)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>NUC backend offline</p>
            <p style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.04em' }}>Live conditions unavailable</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              {[
                { label: 'Wind',  val: wSpd != null ? `${directionArrow(wDir)} ${formatWindSpeed(wSpd)}` : null },
                { label: 'Tide',  val: tide != null ? `${tide.toFixed(1)}m ${tSt ?? ''}`.trim() : null },
                { label: 'Score', val: qs   != null ? `${qs.toFixed(1)}` : null, unit: '/10' },
              ].map(({ label, val, unit }) => (
                <div key={label} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 10, padding: '10px 10px 8px',
                }}>
                  <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
                  {loading ? (
                    <div style={{ height: 12, borderRadius: 3, background: 'rgba(255,255,255,0.06)', animation: 'det-shimmer 1.4s ease-in-out infinite' }} />
                  ) : (
                    <p style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: val ? '#e2e8f0' : 'rgba(255,255,255,0.12)', letterSpacing: val ? '-0.01em' : 0 }}>
                      {val ?? '—'}{unit && val ? <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>{unit}</span> : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* 24h bars */}
            {hours.length > 1 && (
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '12px 12px 10px' }}>
                <ForecastBars hours={hours} />
              </div>
            )}
          </>
        )}

        {/* Optimal conditions */}
        <div style={{ background: 'rgba(6,182,212,0.04)', border: '1px solid rgba(6,182,212,0.1)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(6,182,212,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Optimal conditions</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Size',   val: `${formatWaveHeight(spot.optimal_size_min)}–${formatWaveHeight(spot.optimal_size_max)}` },
              { label: 'Period', val: `${spot.optimal_period_min}–${spot.optimal_period_max}s` },
              { label: 'Swell',  val: spot.optimal_swell_direction != null ? `${spot.optimal_swell_direction}°` : '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
                <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'rgba(6,182,212,0.8)' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {spot.description && (
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(255,255,255,0.3)',
            lineHeight: 1.7, borderLeft: `2px solid ${m.accent}30`, paddingLeft: 10,
          }}>{spot.description}</p>
        )}

        {spot.nearest_buoy_id && (
          <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' }}>
            NDBC #{spot.nearest_buoy_id}{spot.swan_enabled ? ' · ⚡ SWAN physics' : ''}
          </p>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '14px 16px 16px', flexShrink: 0, borderTop: `1px solid ${m.accent}15` }}>
        <Link href={`/spot/${spot.slug}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '14px 0', borderRadius: 12, textDecoration: 'none',
          background: isOffline
            ? 'rgba(255,255,255,0.04)'
            : `linear-gradient(135deg, ${m.accent}ee 0%, ${m.accent}99 100%)`,
          color: isOffline ? 'rgba(255,255,255,0.25)' : '#fff',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '0.01em',
          boxShadow: isOffline ? 'none' : `0 4px 24px ${m.accent}50`,
          animation: isOffline ? 'none' : 'cta-glow 2.5s ease-in-out infinite',
          '--cta-glow': `${m.accent}50`,
          border: isOffline ? '1px solid rgba(255,255,255,0.06)' : `1px solid ${m.accent}40`,
        } as unknown as Record<string, string>}>
          Full 16-Day Forecast
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M8 3L12 7l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Spot row ──────────────────────────────────────────────────────────────────

function SpotRow({ spot, selected, onClick, distMiles }: { spot: Spot; selected: boolean; onClick: () => void; distMiles?: number }) {
  const cc    = spot.current_conditions
  const qs    = cc?.quality_score
  const m     = cond(qs)
  const hM    = cc?.wave_height_face_m
  const hFt   = hM != null ? Math.round(hM * 3.281) : null
  const per   = cc?.wave_period_s
  const wSpd  = cc?.wind_speed_ms
  const wDir  = cc?.wind_direction
  const hasData = cc != null

  return (
    <button onClick={onClick} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
        borderRadius: 10, position: 'relative', overflow: 'hidden',
        background: selected ? `${m.accent}10` : 'rgba(255,255,255,0.02)',
        border: `1px solid ${selected ? `${m.accent}30` : 'rgba(255,255,255,0.05)'}`,
        transition: 'all 0.15s',
      }}
        onMouseEnter={e => {
          if (!selected) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
          }
        }}
        onMouseLeave={e => {
          if (!selected) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
          }
        }}
      >
        {/* Left color bar */}
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 4, width: 2,
          borderRadius: 2, background: hasData ? m.accent : 'rgba(249,115,22,0.3)',
        }} />

        {/* Wave height badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: hasData ? m.bg : 'rgba(249,115,22,0.06)',
          border: `1px solid ${hasData ? `${m.accent}20` : 'rgba(249,115,22,0.12)'}`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 0,
        }}>
          {hFt != null ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: m.accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{hFt}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>ft</span>
            </>
          ) : (
            <span style={{ fontFamily: 'monospace', fontSize: hasData ? 14 : 8, color: hasData ? m.accent : 'rgba(249,115,22,0.4)', fontWeight: hasData ? 700 : 600, letterSpacing: hasData ? '-0.02em' : '0.04em' }}>
              {hasData ? m.icon : 'OFF\nLINE'}
            </span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            color: selected ? m.accent : '#dde4ee', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s', marginBottom: 3,
          }}>{spot.name}</p>
          <p style={{ fontFamily: 'monospace', fontSize: 8.5, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>
            {spot.region} · {spot.break_type}
            {distMiles != null && (
              <span style={{ color: 'rgba(59,130,246,0.7)', marginLeft: 5 }}>
                · {distMiles < 10 ? distMiles.toFixed(1) : Math.round(distMiles)}mi
              </span>
            )}
          </p>
          {hasData && (per != null || wSpd != null) && (
            <p style={{ fontFamily: 'monospace', fontSize: 8.5, color: 'rgba(255,255,255,0.35)', marginTop: 3, letterSpacing: '0.02em' }}>
              {per != null ? formatPeriod(per) : ''}
              {per != null && wSpd != null ? ' · ' : ''}
              {wSpd != null ? `${directionArrow(wDir)} ${formatWindSpeed(wSpd)}` : ''}
            </p>
          )}
          {!hasData && (
            <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(249,115,22,0.4)', marginTop: 2, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              no live data
            </p>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          {hasData && (
            <span style={{
              fontFamily: 'monospace', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em',
              color: m.accent, background: m.bg, border: `1px solid ${m.accent}25`,
              padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap',
            }}>
              {m.label}
            </span>
          )}
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: selected ? 0.6 : 0.2, color: selected ? m.accent : 'white' }}>
            <path d="M3.5 2L7 5 3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  )
}

// ─── Spot list ─────────────────────────────────────────────────────────────────

function SpotList({
  spots,
  filtered,
  totalFiltered,
  selected,
  condFilter,
  condCounts,
  qualityFilter,
  search,
  sortBy,
  userLocation,
  locPermission,
  locating,
  offline,
  onSelect,
  onCondFilterChange,
  onQualityFilterChange,
  onSearchChange,
  onSortChange,
  onNearMe,
}: {
  spots: Spot[]
  filtered: Spot[]
  totalFiltered: number
  selected: Spot | null
  condFilter: CondFilter
  condCounts: Record<string, number>
  qualityFilter: QualityFilter
  search: string
  sortBy: 'quality' | 'name'
  userLocation: { lat: number; lng: number } | null
  locPermission: string
  locating: boolean
  offline: boolean
  onSelect: (slug: string) => void
  onCondFilterChange: (f: CondFilter) => void
  onQualityFilterChange: (f: QualityFilter) => void
  onSearchChange: (s: string) => void
  onSortChange: (s: 'quality' | 'name') => void
  onNearMe: () => void
}) {
  const condOptions = ([
    { key: 'all'      as CondFilter, label: 'All',  accent: '#06b6d4' },
    { key: 'firing'   as CondFilter, label: '🔥',   accent: '#ef4444' },
    { key: 'pumping'  as CondFilter, label: '🤙',   accent: '#f97316' },
    { key: 'fun'      as CondFilter, label: '😎',   accent: '#22c55e' },
    { key: 'worth_it' as CondFilter, label: '🏄',   accent: '#3b82f6' },
    { key: 'flat'     as CondFilter, label: 'Flat', accent: '#4b5563' },
  ]).filter(o => o.key === 'all' || (condCounts[o.key] ?? 0) > 0 || condFilter === o.key)

  return (
    <>
      {/* Panel header */}
      <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>
        {/* Live status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
          background: offline ? 'rgba(249,115,22,0.06)' : 'rgba(6,182,212,0.05)',
          border: `1px solid ${offline ? 'rgba(249,115,22,0.15)' : 'rgba(6,182,212,0.15)'}`,
          borderRadius: 8, padding: '7px 10px',
        }}>
          <div style={{
            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
            background: offline ? '#f97316' : '#06b6d4',
            boxShadow: offline ? 'none' : '0 0 5px #06b6d4',
            animation: offline ? 'none' : 'offline-blink 2s ease-in-out infinite',
          }} />
          {offline ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#f97316', letterSpacing: '0.08em' }}>Local data</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.03em' }}>· NUC offline</span>
            </>
          ) : (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#06b6d4', letterSpacing: '0.06em' }}>Live</span>
              <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.03em' }}>· {spots.length} spots</span>
            </>
          )}
        </div>

        {/* Stats bar */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
          {([
            { key: 'firing',   icon: '🔥', color: '#ef4444' },
            { key: 'pumping',  icon: '🤙', color: '#f97316' },
            { key: 'fun',      icon: '😎', color: '#22c55e' },
            { key: 'flat',     icon: '😴', color: '#4b5563' },
          ] as const).filter(s => (condCounts[s.key] ?? 0) > 0).map(s => (
            <button
              key={s.key}
              onClick={() => onCondFilterChange(condFilter === s.key ? 'all' : s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontFamily: 'monospace', fontSize: 9, padding: '3px 8px',
                borderRadius: 20, cursor: 'pointer', letterSpacing: '0.03em',
                border: `1px solid ${condFilter === s.key ? `${s.color}50` : `${s.color}25`}`,
                background: condFilter === s.key ? `${s.color}18` : `${s.color}08`,
                color: condFilter === s.key ? s.color : `${s.color}cc`,
                transition: 'all 0.12s',
              }}
            >
              <span>{s.icon}</span>
              <span style={{ fontWeight: 700 }}>{condCounts[s.key]}</span>
            </button>
          ))}
        </div>

        {/* Search + Near Me row */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.25 }}>
              <circle cx="5" cy="5" r="3.5" stroke="white" strokeWidth="1.4"/>
              <path d="M8 8l2.5 2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              value={search} onChange={e => onSearchChange(e.target.value)}
              placeholder="Search spots..."
              style={{
                width: '100%', padding: '8px 10px 8px 30px', boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8, color: '#dde4ee', outline: 'none',
                fontFamily: 'monospace', fontSize: 11, letterSpacing: '0.02em',
              }}
            />
          </div>
          {/* Near Me button */}
          <button
            onClick={locPermission !== 'denied' ? onNearMe : undefined}
            disabled={locPermission === 'denied'}
            title={locPermission === 'denied' ? 'Location blocked — enable in browser settings' : userLocation ? 'Sorting by distance' : 'Sort by nearest spot'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              flexShrink: 0, padding: '7px 9px', borderRadius: 8, cursor: locPermission === 'denied' ? 'not-allowed' : 'pointer',
              background: userLocation
                ? 'rgba(59,130,246,0.15)'
                : locPermission === 'denied'
                  ? 'rgba(239,68,68,0.07)'
                  : 'rgba(255,255,255,0.04)',
              border: `1px solid ${userLocation ? 'rgba(59,130,246,0.4)' : locPermission === 'denied' ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)'}`,
              color: userLocation ? '#93C5FD' : locPermission === 'denied' ? '#F87171' : 'rgba(255,255,255,0.3)',
              opacity: locPermission === 'denied' ? 0.6 : 1,
              transition: 'all 0.12s',
            }}
            aria-label="Near Me"
          >
            {locating ? (
              <div style={{ width: 11, height: 11, borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.3)', borderTopColor: '#93C5FD', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="3" fill="currentColor"/>
                <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 2"/>
              </svg>
            )}
          </button>
        </div>

        {/* Quality threshold filter bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          {QUALITY_FILTERS.map(qf => {
            const active = qualityFilter === qf.key
            return (
              <button
                key={qf.key}
                onClick={() => onQualityFilterChange(qf.key)}
                style={{
                  padding: '4px 10px', borderRadius: 20, fontSize: 10,
                  fontFamily: 'var(--font-data)', fontWeight: 700, letterSpacing: '0.08em',
                  cursor: 'pointer', border: '1px solid',
                  background: active ? 'rgba(6,182,212,0.15)' : 'rgba(6,13,26,0.4)',
                  borderColor: active ? 'rgba(6,182,212,0.4)' : 'rgba(6,182,212,0.08)',
                  color: active ? 'var(--cyan-bright, #06b6d4)' : 'rgba(148,163,184,0.6)',
                  transition: 'all 0.12s',
                }}
              >
                {qf.key === 'all' ? `${qf.label} (${spots.length})` : qf.label}
              </button>
            )
          })}
        </div>

        {/* Condition filter + sort toggle row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 4 }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
            {condOptions.map(o => {
              const active = condFilter === o.key
              return (
                <button key={o.key} onClick={() => onCondFilterChange(o.key)} style={{
                  fontFamily: 'monospace', fontSize: 9, fontWeight: 600, padding: '3px 9px',
                  borderRadius: 20, cursor: 'pointer', letterSpacing: '0.04em',
                  border: `1px solid ${active ? `${o.accent}50` : 'rgba(255,255,255,0.07)'}`,
                  background: active ? `${o.accent}14` : 'rgba(255,255,255,0.02)',
                  color: active ? o.accent : 'rgba(255,255,255,0.35)',
                  transition: 'all 0.12s',
                }}>
                  {o.label}
                  {o.key !== 'all' && condCounts[o.key] != null && (
                    <span style={{ marginLeft: 4, opacity: 0.5, fontSize: 7 }}>({condCounts[o.key]})</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Sort toggle */}
          <div style={{ display: 'flex', flexShrink: 0, border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, overflow: 'hidden' }}>
            {(['quality', 'name'] as const).map(s => (
              <button
                key={s}
                onClick={() => onSortChange(s)}
                style={{
                  fontFamily: 'monospace', fontSize: 8, padding: '3px 7px',
                  cursor: 'pointer', letterSpacing: '0.04em', textTransform: 'uppercase',
                  background: sortBy === s ? 'rgba(6,182,212,0.15)' : 'transparent',
                  color: sortBy === s ? '#06b6d4' : 'rgba(255,255,255,0.3)',
                  border: 'none', transition: 'all 0.12s',
                  borderRight: s === 'quality' ? '1px solid rgba(255,255,255,0.08)' : 'none',
                }}
              >
                {s === 'quality' ? '★' : 'A–Z'}
              </button>
            ))}
          </div>
        </div>

        {/* Spot count */}
        <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', marginTop: 6 }}>
          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11 }}>
            {filtered.length} spots in view
            {filtered.length < totalFiltered && ` · ${totalFiltered - filtered.length} outside`}
          </span>
        </p>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

      {/* Spot list */}
      <div className="sm-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '8px 10px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6,182,212,0.2) transparent' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <p style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>🌊</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>No spots match</p>
            <button onClick={() => { onCondFilterChange('all'); onQualityFilterChange('all'); onSearchChange('') }} style={{
              fontFamily: 'monospace', fontSize: 9, color: '#06b6d4', background: 'none', border: 'none',
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Clear filters</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(filtered as Spot[]).map(s => {
              const isSelected = (selected as Spot | null)?.slug === s.slug
              const distMiles = userLocation ? distMi(userLocation.lat, userLocation.lng, s.lat, s.lng) : undefined
              return (
                <SpotRow
                  key={s.slug} spot={s}
                  selected={isSelected}
                  onClick={() => onSelect(s.slug)}
                  distMiles={distMiles}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes det-shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }
  @keyframes offline-blink { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes cta-glow { 0%,100% { box-shadow: 0 4px 20px var(--cta-glow,rgba(6,182,212,0.4)); } 50% { box-shadow: 0 6px 30px var(--cta-glow,rgba(6,182,212,0.7)), 0 0 60px var(--cta-glow,rgba(6,182,212,0.2)); } }
  /* Custom scrollbar for panel lists */
  .sm-scroll::-webkit-scrollbar { width: 3px; }
  .sm-scroll::-webkit-scrollbar-track { background: transparent; }
  .sm-scroll::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.2); border-radius: 2px; }
  .sm-scroll::-webkit-scrollbar-thumb:hover { background: rgba(6,182,212,0.4); }
`

// ─── Haversine distance ────────────────────────────────────────────────────────

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function distMi(lat1: number, lng1: number, lat2: number, lng2: number): number {
  return distanceKm(lat1, lng1, lat2, lng2) * 0.621371
}

// Sidebar width constant — single source of truth
const SIDEBAR_W = 360

// ─── Viewport helpers ──────────────────────────────────────────────────────────

function inBounds(spot: Spot, bounds: { north: number; south: number; east: number; west: number } | null): boolean {
  if (!bounds || spot.lat == null || spot.lng == null) return true
  return (
    spot.lat <= bounds.north &&
    spot.lat >= bounds.south &&
    spot.lng <= bounds.east &&
    spot.lng >= bounds.west
  )
}

function distFromCenter(spot: Spot, center: { lat: number; lng: number }): number {
  const dLat = spot.lat - center.lat
  const dLng = spot.lng - center.lng
  return Math.sqrt(dLat * dLat + dLng * dLng)
}

export default function MapPageClient({ spots, offline = false }: { spots: Spot[]; offline?: boolean }) {
  const [condFilter,      setCondFilter]      = useState<CondFilter>('all')
  const [qualityFilter,   setQualityFilter]   = useState<QualityFilter>('all')
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [mapStyle,        setMapStyle]        = useState<MapStyle>('dark')
  const [selected,    setSelected]    = useState<Spot | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [search,      setSearch]      = useState('')
  const [sortBy,      setSortBy]      = useState<'quality' | 'name'>('quality')
  const [mapBounds,   setMapBounds]   = useState<{ north: number; south: number; east: number; west: number } | null>(null)
  const [mapCenter,   setMapCenter]   = useState<{ lat: number; lng: number } | null>(null)
  const { location: userLocation, permission: locPermission, locating, error: locError, requestLocation } = useLocation()
  const mapRef = useRef<import('leaflet').Map | null>(null)
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null)
  const userAccuracyCircleRef = useRef<import('leaflet').Circle | null>(null)
  const hasAutoSelectedRef = useRef(false)
  // Stable ref so the auto-select logic can call handleSelect without stale closure
  const handleSelectRef = useRef<(slug: string | null) => void>(() => {})

  // Add/update user location marker + accuracy circle when userLocation changes
  useEffect(() => {
    if (!mapRef.current || !userLocation) return
    import('leaflet').then((leafletMod) => {
      const L = (leafletMod.default ?? leafletMod) as typeof import('leaflet')
      if (!mapRef.current) return

      // Remove old marker + accuracy circle
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null }
      if (userAccuracyCircleRef.current) { userAccuracyCircleRef.current.remove(); userAccuracyCircleRef.current = null }

      // Accuracy circle (rendered first so it sits below the dot)
      if (userLocation.accuracy != null && userLocation.accuracy > 0) {
        userAccuracyCircleRef.current = L.circle(
          [userLocation.lat, userLocation.lng],
          {
            radius: userLocation.accuracy,       // metres
            color: '#3B82F6',
            fillColor: '#3B82F6',
            fillOpacity: 0.08,
            weight: 1,
            opacity: 0.35,
            interactive: false,
          }
        ).addTo(mapRef.current)
      }

      // Blue dot marker
      const el = document.createElement('div')
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: #3B82F6; border: 3px solid white;
        box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.5);
        cursor: default;
      `
      const icon = L.divIcon({ html: el, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon, zIndexOffset: 1000 })
        .bindPopup('You are here')
        .addTo(mapRef.current)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  // Auto-select nearest spot on the very first GPS fix only
  useEffect(() => {
    if (!userLocation || hasAutoSelectedRef.current) return
    hasAutoSelectedRef.current = true
    mapRef.current?.flyTo([userLocation.lat, userLocation.lng], 8, { duration: 1.5 })
    if (spots.length > 0) {
      const nearest = spots.reduce((best, s) =>
        distanceKm(userLocation.lat, userLocation.lng, s.lat, s.lng) < distanceKm(userLocation.lat, userLocation.lng, best.lat, best.lng) ? s : best
      )
      // Small delay lets the map fly + gives handleSelectRef time to be assigned
      setTimeout(() => { handleSelectRef.current(nearest.slug) }, 700)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  useEffect(() => {
    if (document.getElementById('mpc-kf')) return
    const el = document.createElement('style'); el.id = 'mpc-kf'; el.textContent = KEYFRAMES
    document.head.appendChild(el)
  }, [])

  const condCounts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const s of spots) { const l = getConditionLabel(s.current_conditions?.quality_score); c[l] = (c[l] ?? 0) + 1 }
    return c
  }, [spots])

  const filtered = useMemo<Spot[]>(() => {
    const base = spots.filter(s => {
      if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.region.toLowerCase().includes(search.toLowerCase())) return false
      if (condFilter !== 'all' && getConditionLabel(s.current_conditions?.quality_score) !== condFilter) return false
      if (!meetsQualityThreshold(s, qualityFilter)) return false
      return true
    })
    if (userLocation) {
      return [...base].sort((a, b) => {
        const da = distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng)
        const db = distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
        return da - db
      })
    }
    if (sortBy === 'name') return [...base].sort((a, b) => a.name.localeCompare(b.name))
    // quality sort: highest score first, no-data last
    return [...base].sort((a, b) => {
      const qa = a.current_conditions?.quality_score ?? -1
      const qb = b.current_conditions?.quality_score ?? -1
      return qb - qa
    })
  }, [spots, condFilter, qualityFilter, search, sortBy, userLocation])

  const filteredSlugs = useMemo(() => new Set(filtered.map(s => s.slug)), [filtered])

  const viewportSpots = useMemo<Spot[]>(() => {
    let result = filtered
    if (mapBounds) {
      result = result.filter(s => inBounds(s, mapBounds))
    }
    if (mapCenter) {
      result = [...result].sort((a, b) => distFromCenter(a, mapCenter) - distFromCenter(b, mapCenter))
    }
    return result
  }, [filtered, mapBounds, mapCenter])

  const handleSelect = useCallback((slug: string | null) => {
    const s = slug ? (spots.find(x => x.slug === slug) ?? null) : null
    setSelected(s)
  }, [spots])

  // When a spot is deselected via the DetailPanel back button, keep sidebar open on the list
  const handleDetailClose = useCallback(() => {
    setSelected(null)
  }, [])

  // Keep ref in sync so watchPosition callback (and auto-select) can call it
  handleSelectRef.current = handleSelect

  const hotCount = spots.filter(s => {
    const l = getConditionLabel(s.current_conditions?.quality_score)
    return l === 'firing' || l === 'pumping'
  }).length

  const mapStyles: { key: MapStyle; icon: string }[] = [
    { key: 'dark',      icon: '🌑' },
    { key: 'ocean',     icon: '🌊' },
    { key: 'satellite', icon: '🛰️' },
  ]

  function handleLocate() {
    requestLocation()
  }

  // Sidebar effective width (0 when collapsed)
  const effectiveSidebarW = sidebarOpen ? SIDEBAR_W : 0

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex' }}>

      {/* Map — fills space left of sidebar */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>

        {/* Offline banner — shown when NUC API is unreachable and spots come from fallback JSON */}
        {offline && !bannerDismissed && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(245,158,11,0.1)',
            border: '1px solid rgba(245,158,11,0.2)',
            borderTop: 'none',
            padding: '7px 14px',
            backdropFilter: 'blur(12px)',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }} aria-hidden="true">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" stroke="#FCD34D" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>
            </svg>
            <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#FCD34D', letterSpacing: '0.04em', flex: 1 }}>
              Live data unavailable — showing cached forecast data. NUC API offline.
            </span>
            <button
              onClick={() => setBannerDismissed(true)}
              aria-label="Dismiss banner"
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                color: 'rgba(252,211,77,0.5)', flexShrink: 0, lineHeight: 1,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'color 0.12s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#FCD34D' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(252,211,77,0.5)' }}
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>
        )}

        <SpotMap
          spots={spots}
          filteredSlugs={filteredSlugs}
          selectedSlug={selected?.slug ?? null}
          onSpotSelect={handleSelect}
          mapStyle={mapStyle}
          onStyleChange={setMapStyle}
          onMapReady={map => { mapRef.current = map as import('leaflet').Map }}
          onBoundsChange={(bounds, center) => {
            setMapBounds(bounds)
            setMapCenter(center)
          }}
        />

        {/* Map style + legend — bottom left */}
        <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Style pills */}
          <div style={{ display: 'flex', gap: 3 }}>
            {mapStyles.map(s => (
              <button key={s.key} onClick={() => setMapStyle(s.key)} style={{
                fontFamily: 'monospace', fontSize: 12, padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${mapStyle === s.key ? 'rgba(6,182,212,0.4)' : 'rgba(255,255,255,0.07)'}`,
                background: mapStyle === s.key ? 'rgba(6,182,212,0.12)' : 'rgba(6,10,22,0.85)',
                color: mapStyle === s.key ? '#06b6d4' : 'rgba(255,255,255,0.35)',
                backdropFilter: 'blur(12px)', transition: 'all 0.12s',
              }}>{s.icon}</button>
            ))}
          </div>
          {/* Condition legend */}
          <div style={{ background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(['firing','pumping','fun','worth_it','flat'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: COND[k].accent, flexShrink: 0, boxShadow: `0 0 4px ${COND[k].accent}80` }} />
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em', textTransform: 'capitalize' }}>{COND[k].label}</span>
              </div>
            ))}
            {offline && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 2, paddingTop: 4 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#374151', flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(249,115,22,0.5)', letterSpacing: '0.04em' }}>OFFLINE</span>
              </div>
            )}
          </div>
        </div>

        {/* Top-left controls: Near Me */}
        <div style={{
          position: 'absolute', top: 14, left: 14, zIndex: 20,
          display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap' }}>
            {/* Near Me button */}
            {locPermission !== 'granted' && (
              <div style={{ position: 'relative' }} title={locPermission === 'denied' ? 'Location blocked — enable in browser settings' : undefined}>
                <button
                  onClick={locPermission !== 'denied' ? handleLocate : undefined}
                  disabled={locPermission === 'denied'}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: locPermission === 'denied'
                      ? 'rgba(239,68,68,0.08)'
                      : userLocation ? 'rgba(59,130,246,0.15)' : 'rgba(6,13,26,0.92)',
                    border: `1px solid ${locPermission === 'denied' ? 'rgba(239,68,68,0.35)' : userLocation ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.4)'}`,
                    borderRadius: 6, padding: '6px 12px',
                    cursor: locPermission === 'denied' ? 'not-allowed' : 'pointer',
                    color: locPermission === 'denied' ? '#F87171' : '#93C5FD',
                    fontFamily: 'var(--font-data)', fontSize: 11,
                    backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
                    whiteSpace: 'nowrap', opacity: locPermission === 'denied' ? 0.75 : 1,
                  }}
                >
                  {locating ? (
                    <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.3)', borderTopColor: '#93C5FD', animation: 'spin 0.7s linear infinite' }} />
                  ) : (
                    <span style={{ fontSize: 12 }}>{locPermission === 'denied' ? '🚫' : '📍'}</span>
                  )}
                  {locating ? 'Locating...' : locPermission === 'denied' ? 'Blocked' : 'Near Me'}
                </button>
              </div>
            )}
          </div>

          {/* Location error tooltip */}
          {locError && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '5px 10px',
              fontFamily: 'monospace', fontSize: 9, color: '#ef4444',
              letterSpacing: '0.04em', whiteSpace: 'nowrap',
            }}>
              {locError}
            </div>
          )}
        </div>

        {/* Sidebar collapse toggle — anchored to right edge of map area */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          style={{
            position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
            zIndex: 20, width: 20, height: 48,
            background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRight: 'none',
            borderRadius: '8px 0 0 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)', transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#06b6d4'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(6,182,212,0.1)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(4,8,18,0.92)'
          }}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open spots list'}
          title={sidebarOpen ? 'Collapse sidebar' : 'Open spots list'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.25s', transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            <path d="M3.5 2L7 5 3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Right sidebar — always in DOM, slides in/out */}
      <div style={{
        width: sidebarOpen ? SIDEBAR_W : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.34,1.05,0.64,1)',
      }}>
        <div style={{
          width: SIDEBAR_W,
          height: '100%',
          background: 'rgba(4,8,18,0.97)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {selected ? (
            <DetailPanel spot={selected} onClose={handleDetailClose} />
          ) : (
            <SpotList
              spots={spots}
              filtered={viewportSpots}
              totalFiltered={filtered.length}
              selected={selected}
              condFilter={condFilter}
              condCounts={condCounts}
              qualityFilter={qualityFilter}
              search={search}
              sortBy={sortBy}
              userLocation={userLocation}
              locPermission={locPermission}
              locating={locating}
              offline={offline}
              onSelect={slug => handleSelect(slug)}
              onCondFilterChange={setCondFilter}
              onQualityFilterChange={setQualityFilter}
              onSearchChange={setSearch}
              onSortChange={setSortBy}
              onNearMe={handleLocate}
            />
          )}
        </div>
      </div>

      {/* Floating spot count badge — visible when sidebar is collapsed */}
      {!sidebarOpen && (
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
          padding: '8px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          {offline ? (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
          ) : (
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', boxShadow: '0 0 6px #06b6d4', flexShrink: 0, animation: 'offline-blink 2s ease-in-out infinite' }} />
          )}
          <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#c8d8e8', letterSpacing: '0.02em' }}>
            {filtered.length}<span style={{ color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>{filtered.length !== spots.length ? `/${spots.length}` : ''} spots</span>
          </span>
          {hotCount > 0 && (
            <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', padding: '2px 6px', borderRadius: 8 }}>
              🔥{hotCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export type { CondFilter as ConditionFilter }
