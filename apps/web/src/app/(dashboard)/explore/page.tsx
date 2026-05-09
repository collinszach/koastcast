'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import Link from 'next/link'
import { MapPin, Plus, X, TrendingUp, Wind, Waves, Calendar, ChevronDown, Zap } from 'lucide-react'
import type { Spot } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Sport = 'SURF' | 'SNOW' | 'TRAIL'
type RadiusMi = 50 | 100 | 200 | null

interface MockConditions {
  waveHeightFt: number
  periodS: number
  windKt: number
  windDir: string
  qualityScore: number
  condLabel: string
  condColor: string
  condGlow: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Deterministic pseudo-random seeded by spot name + offset */
function seeded(spotName: string, offset: number): number {
  let h = offset * 2654435761
  for (let i = 0; i < spotName.length; i++) {
    h = Math.imul(h ^ spotName.charCodeAt(i), 2654435761)
  }
  return ((h >>> 0) % 1000) / 1000
}

function mockConditions(spot: Spot): MockConditions {
  const r = (min: number, max: number, seed: number) =>
    min + seeded(spot.name, seed) * (max - min)

  const qualityScore = Math.round(r(1, 10, 1))
  const waveHeightFt = parseFloat(r(2, 8, 2).toFixed(1))
  const periodS = Math.round(r(10, 18, 3))
  const windKt = Math.round(r(5, 20, 4))
  const windDirs = ['Offshore', 'Side-off', 'Side-shore', 'Onshore']
  const windDir = windDirs[Math.floor(seeded(spot.name, 5) * windDirs.length)]

  let condLabel: string
  let condColor: string
  let condGlow: string

  if (qualityScore >= 8) {
    condLabel = 'FIRING'
    condColor = '#EF4444'
    condGlow = 'rgba(239,68,68,0.35)'
  } else if (qualityScore >= 6) {
    condLabel = 'PUMPING'
    condColor = '#F59E0B'
    condGlow = 'rgba(245,158,11,0.35)'
  } else if (qualityScore >= 4) {
    condLabel = 'FUN'
    condColor = '#10B981'
    condGlow = 'rgba(16,185,129,0.35)'
  } else {
    condLabel = 'WORTH IT'
    condColor = '#3B82F6'
    condGlow = 'rgba(59,130,246,0.35)'
  }

  return { waveHeightFt, periodS, windKt, windDir, qualityScore, condLabel, condColor, condGlow }
}

function dayQuality(spotName: string, dayIndex: number): number {
  return ((spotName.charCodeAt(0) * 7 + dayIndex * 13) % 10) + 1
}

function dayColor(score: number): string {
  if (score >= 8) return '#EF4444'
  if (score >= 6) return '#F59E0B'
  if (score >= 4) return '#10B981'
  return '#3B82F6'
}

function dayGlow(score: number): string {
  if (score >= 8) return 'rgba(239,68,68,0.4)'
  if (score >= 6) return 'rgba(245,158,11,0.4)'
  if (score >= 4) return 'rgba(16,185,129,0.4)'
  return 'rgba(59,130,246,0.4)'
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Quality Ring SVG ─────────────────────────────────────────────────────────

function QualityRing({ score, color }: { score: number; color: string }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const pct = score / 10
  return (
    <svg width={52} height={52} viewBox="0 0 52 52">
      <circle cx={26} cy={26} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={4} />
      <circle
        cx={26}
        cy={26}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={4}
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round"
        transform="rotate(-90 26 26)"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text
        x={26}
        y={26}
        dominantBaseline="middle"
        textAnchor="middle"
        fontSize={13}
        fontWeight={700}
        fontFamily="var(--font-data, monospace)"
        fill={color}
      >
        {score}
      </text>
    </svg>
  )
}

// ─── Sport Tabs ───────────────────────────────────────────────────────────────

function SportTabs({ active, onChange }: { active: Sport; onChange: (s: Sport) => void }) {
  const sports: Sport[] = ['SURF', 'SNOW', 'TRAIL']
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        background: 'rgba(6,12,24,0.7)',
        border: '1px solid rgba(6,182,212,0.15)',
        borderRadius: 12,
        padding: 4,
      }}
    >
      {sports.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          style={{
            padding: '8px 28px',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'var(--font-display, sans-serif)',
            fontWeight: 700,
            fontSize: 13,
            letterSpacing: '0.12em',
            transition: 'all 0.2s',
            background: active === s ? 'rgba(6,182,212,0.18)' : 'transparent',
            color: active === s ? '#06B6D4' : 'rgba(148,163,184,0.7)',
            boxShadow: active === s ? '0 0 16px rgba(6,182,212,0.2)' : 'none',
            borderBottom: active === s ? '2px solid #06B6D4' : '2px solid transparent',
          }}
        >
          {s}
        </button>
      ))}
    </div>
  )
}

// ─── Radius Selector ──────────────────────────────────────────────────────────

function RadiusSelector({ value, onChange }: { value: RadiusMi; onChange: (v: RadiusMi) => void }) {
  const opts: { label: string; val: RadiusMi }[] = [
    { label: '50 mi', val: 50 },
    { label: '100 mi', val: 100 },
    { label: '200 mi', val: 200 },
    { label: 'Any', val: null },
  ]
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 11, fontFamily: 'var(--font-data, monospace)', letterSpacing: '0.08em' }}>
        RADIUS
      </span>
      {opts.map(({ label, val }) => (
        <button
          key={label}
          onClick={() => onChange(val)}
          style={{
            padding: '4px 12px',
            borderRadius: 6,
            border: `1px solid ${value === val ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.08)'}`,
            background: value === val ? 'rgba(6,182,212,0.12)' : 'rgba(6,12,24,0.5)',
            color: value === val ? '#06B6D4' : 'rgba(148,163,184,0.6)',
            fontSize: 11,
            fontFamily: 'var(--font-data, monospace)',
            cursor: 'pointer',
            transition: 'all 0.15s',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

// ─── Spot Picker ──────────────────────────────────────────────────────────────

function SpotPicker({
  allSpots,
  selected,
  onAdd,
  onRemove,
  radius,
  userLat,
  userLng,
}: {
  allSpots: Spot[]
  selected: Spot[]
  onAdd: (s: Spot) => void
  onRemove: (slug: string) => void
  radius: RadiusMi
  userLat: number | null
  userLng: number | null
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    let pool = allSpots.filter((s) => !selected.some((sel) => sel.slug === s.slug))
    if (radius !== null && userLat !== null && userLng !== null) {
      pool = pool.filter((s) => distanceMiles(userLat, userLng, s.lat, s.lng) <= radius)
    }
    if (query.trim()) {
      const q = query.toLowerCase()
      pool = pool.filter(
        (s) =>
          s.name.toLowerCase().includes(q) || s.region.toLowerCase().includes(q)
      )
    }
    return pool.slice(0, 8)
  }, [allSpots, selected, query, radius, userLat, userLng])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const canAdd = selected.length < 4

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Selected chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 36 }}>
        {selected.map((s) => (
          <div
            key={s.slug}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              borderRadius: 8,
              background: 'rgba(6,182,212,0.1)',
              border: '1px solid rgba(6,182,212,0.3)',
              color: '#67E8F9',
              fontSize: 12,
              fontFamily: 'var(--font-display, sans-serif)',
              fontWeight: 600,
              letterSpacing: '0.04em',
            }}
          >
            <MapPin size={11} style={{ opacity: 0.7 }} />
            <span>{s.name}</span>
            <button
              onClick={() => onRemove(s.slug)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(103,232,249,0.6)',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                marginLeft: 2,
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
        {selected.length === 0 && (
          <span style={{ color: 'rgba(148,163,184,0.4)', fontSize: 12, fontStyle: 'italic', alignSelf: 'center' }}>
            No spots selected — search to add up to 4
          </span>
        )}
      </div>

      {/* Search input */}
      {canAdd && (
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <div style={{ position: 'relative' }}>
            <Plus
              size={14}
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'rgba(6,182,212,0.6)',
                pointerEvents: 'none',
              }}
            />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              placeholder="Add spot (search by name or region)..."
              style={{
                width: '100%',
                padding: '10px 12px 10px 34px',
                background: 'rgba(6,12,24,0.8)',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 8,
                color: '#E2E8F0',
                fontSize: 13,
                fontFamily: 'var(--font-data, monospace)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <ChevronDown
              size={14}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)`,
                color: 'rgba(148,163,184,0.4)',
                pointerEvents: 'none',
                transition: 'transform 0.2s',
              }}
            />
          </div>

          {open && filtered.length > 0 && (
            <div
              ref={dropRef}
              style={{
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: 0,
                right: 0,
                background: 'rgba(6,12,24,0.97)',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 8,
                zIndex: 50,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              {filtered.map((s) => (
                <button
                  key={s.slug}
                  onClick={() => { onAdd(s); setQuery(''); setOpen(false) }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    color: '#CBD5E1',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(6,182,212,0.07)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <MapPin size={12} style={{ color: 'rgba(6,182,212,0.6)', flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{s.name}</span>
                  <span style={{ fontSize: 11, color: 'rgba(148,163,184,0.5)', marginLeft: 'auto' }}>
                    {s.region}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Comparison Card ──────────────────────────────────────────────────────────

function ComparisonCard({
  spot,
  isBest,
  onRemove,
}: {
  spot: Spot
  isBest: boolean
  onRemove: () => void
}) {
  const cond = useMemo(() => mockConditions(spot), [spot])

  return (
    <div
      style={{
        flex: '1 1 220px',
        minWidth: 200,
        maxWidth: 320,
        background: isBest
          ? 'linear-gradient(145deg, rgba(6,12,24,0.95) 0%, rgba(6,30,40,0.95) 100%)'
          : 'rgba(6,12,24,0.85)',
        border: isBest
          ? '1px solid rgba(6,182,212,0.45)'
          : '1px solid rgba(6,182,212,0.1)',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isBest
          ? '0 0 40px rgba(6,182,212,0.15), 0 4px 24px rgba(0,0,0,0.5)'
          : '0 4px 24px rgba(0,0,0,0.4)',
        transition: 'all 0.25s',
      }}
    >
      {/* Best day crown */}
      {isBest && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: 'linear-gradient(90deg, transparent, #06B6D4, transparent)',
          }}
        />
      )}

      {/* Header */}
      <div
        style={{
          padding: '16px 16px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <div>
          {isBest && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                marginBottom: 4,
                color: '#06B6D4',
                fontSize: 10,
                fontFamily: 'var(--font-data, monospace)',
                letterSpacing: '0.1em',
                fontWeight: 700,
              }}
            >
              <Zap size={10} style={{ fill: '#06B6D4' }} />
              BEST PICK
            </div>
          )}
          <Link
            href={`/spot/${spot.slug}`}
            style={{ textDecoration: 'none' }}
          >
            <div
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: 15,
                fontWeight: 700,
                color: isBest ? '#67E8F9' : '#E2E8F0',
                lineHeight: 1.2,
                cursor: 'pointer',
              }}
            >
              {spot.name}
            </div>
          </Link>
          <div
            style={{
              fontSize: 11,
              color: 'rgba(148,163,184,0.5)',
              fontFamily: 'var(--font-data, monospace)',
              marginTop: 2,
              letterSpacing: '0.04em',
            }}
          >
            {spot.region} · {spot.break_type}
          </div>
        </div>
        <button
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'rgba(148,163,184,0.3)',
            padding: 2,
            display: 'flex',
          }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Quality Ring + Condition Badge */}
      <div
        style={{
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <QualityRing score={cond.qualityScore} color={cond.condColor} />
        <div>
          <div
            style={{
              display: 'inline-block',
              padding: '3px 10px',
              borderRadius: 5,
              background: `${cond.condColor}18`,
              border: `1px solid ${cond.condColor}45`,
              color: cond.condColor,
              fontSize: 11,
              fontWeight: 800,
              fontFamily: 'var(--font-data, monospace)',
              letterSpacing: '0.1em',
              boxShadow: `0 0 10px ${cond.condGlow}`,
            }}
          >
            {cond.condLabel}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'rgba(148,163,184,0.4)',
              marginTop: 5,
              fontFamily: 'var(--font-data, monospace)',
              letterSpacing: '0.06em',
            }}
          >
            QUALITY SCORE
          </div>
        </div>
      </div>

      {/* Stats */}
      <div
        style={{
          padding: '0 16px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {/* Wave */}
        <StatRow
          icon={<Waves size={12} />}
          label="WAVE"
          value={`${cond.waveHeightFt}ft`}
          sub={`${cond.periodS}s period`}
          color="#06B6D4"
        />
        {/* Wind */}
        <StatRow
          icon={<Wind size={12} />}
          label="WIND"
          value={`${cond.windKt}kt`}
          sub={cond.windDir}
          color={cond.windDir === 'Offshore' ? '#10B981' : cond.windDir === 'Side-off' ? '#F59E0B' : '#94A3B8'}
        />
      </div>
    </div>
  )
}

function StatRow({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub: string
  color: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '7px 10px',
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 8,
        border: '1px solid rgba(255,255,255,0.04)',
      }}
    >
      <div style={{ color, opacity: 0.7, display: 'flex', flexShrink: 0 }}>{icon}</div>
      <span
        style={{
          fontSize: 10,
          color: 'rgba(148,163,184,0.5)',
          fontFamily: 'var(--font-data, monospace)',
          letterSpacing: '0.08em',
          width: 36,
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: 15,
          fontWeight: 700,
          fontFamily: 'var(--font-data, monospace)',
          color,
          flexShrink: 0,
        }}
      >
        {value}
      </span>
      <span
        style={{
          fontSize: 11,
          color: 'rgba(148,163,184,0.45)',
          fontFamily: 'var(--font-data, monospace)',
          marginLeft: 2,
        }}
      >
        {sub}
      </span>
    </div>
  )
}

// ─── Best Day Week Strip ───────────────────────────────────────────────────────

function WeekStrip({ spots }: { spots: Spot[] }) {
  const bestDayIndex = useMemo(() => {
    if (spots.length === 0) return -1
    let best = -1
    let bestScore = 0
    for (let d = 0; d < 7; d++) {
      const avg = spots.reduce((acc, s) => acc + dayQuality(s.name, d), 0) / spots.length
      if (avg > bestScore) { bestScore = avg; best = d }
    }
    return best
  }, [spots])

  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
      {DAY_LABELS.map((day, di) => {
        const isBest = di === bestDayIndex
        const scores = spots.map((s) => dayQuality(s.name, di))
        const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0
        const score = Math.round(avg)
        const color = score > 0 ? dayColor(score) : '#334155'
        const glow = score > 0 ? dayGlow(score) : 'transparent'

        return (
          <div
            key={day}
            style={{
              flex: '0 0 auto',
              width: 72,
              padding: '12px 8px',
              borderRadius: 10,
              background: isBest
                ? 'rgba(6,182,212,0.08)'
                : 'rgba(6,12,24,0.7)',
              border: isBest
                ? '1px solid rgba(6,182,212,0.4)'
                : '1px solid rgba(255,255,255,0.06)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              position: 'relative',
              boxShadow: isBest ? `0 0 20px rgba(6,182,212,0.15)` : 'none',
              transition: 'all 0.2s',
            }}
          >
            {isBest && (
              <div
                style={{
                  position: 'absolute',
                  top: -1,
                  left: '20%',
                  right: '20%',
                  height: 2,
                  background: '#06B6D4',
                  borderRadius: 2,
                  boxShadow: '0 0 8px rgba(6,182,212,0.8)',
                }}
              />
            )}
            <span
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-data, monospace)',
                fontWeight: 700,
                color: isBest ? '#06B6D4' : 'rgba(148,163,184,0.5)',
                letterSpacing: '0.08em',
              }}
            >
              {day.toUpperCase()}
            </span>
            {/* Color bar */}
            {score > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: `${color}20`,
                    border: `2px solid ${color}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: isBest ? `0 0 14px ${glow}` : 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 800,
                      fontFamily: 'var(--font-data, monospace)',
                      color,
                    }}
                  >
                    {score}
                  </span>
                </div>
                <div
                  style={{
                    width: 40,
                    height: 4,
                    borderRadius: 2,
                    background: `rgba(255,255,255,0.05)`,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${(score / 10) * 100}%`,
                      height: '100%',
                      background: color,
                      boxShadow: `0 0 6px ${glow}`,
                      borderRadius: 2,
                    }}
                  />
                </div>
              </div>
            ) : (
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontSize: 10, color: 'rgba(100,116,139,0.5)' }}>—</span>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyComparison() {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '64px 32px',
        border: '1px dashed rgba(6,182,212,0.15)',
        borderRadius: 16,
        background: 'rgba(6,12,24,0.4)',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(6,182,212,0.08)',
          border: '1px solid rgba(6,182,212,0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 16px',
        }}
      >
        <TrendingUp size={28} style={{ color: 'rgba(6,182,212,0.5)' }} />
      </div>
      <div
        style={{
          fontFamily: 'var(--font-display, sans-serif)',
          fontSize: 18,
          fontWeight: 700,
          color: 'rgba(226,232,240,0.5)',
          marginBottom: 8,
        }}
      >
        Add 2+ spots to compare
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(148,163,184,0.35)',
          fontFamily: 'var(--font-data, monospace)',
          maxWidth: 280,
          margin: '0 auto',
          lineHeight: 1.6,
        }}
      >
        Search for spots above and select up to 4 to see a side-by-side forecast comparison
      </div>
    </div>
  )
}

// ─── SNOW / TRAIL placeholder ─────────────────────────────────────────────────

function ComingSoonSport({ sport }: { sport: Sport }) {
  const icons: Record<Sport, string> = { SURF: '🏄', SNOW: '⛷️', TRAIL: '🥾' }
  const links: Partial<Record<Sport, string>> = { SNOW: '/snow', TRAIL: '/trails' }
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '80px 32px',
        border: '1px dashed rgba(6,182,212,0.1)',
        borderRadius: 16,
        background: 'rgba(6,12,24,0.4)',
      }}
    >
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icons[sport]}</div>
      <div
        style={{
          fontFamily: 'var(--font-display, sans-serif)',
          fontSize: 22,
          fontWeight: 700,
          color: 'rgba(226,232,240,0.6)',
          marginBottom: 8,
        }}
      >
        {sport} TRIP PLANNER
      </div>
      <div
        style={{
          fontSize: 13,
          color: 'rgba(148,163,184,0.4)',
          fontFamily: 'var(--font-data, monospace)',
          marginBottom: 24,
        }}
      >
        Multi-resort comparison coming soon
      </div>
      {links[sport] && (
        <Link
          href={links[sport]!}
          style={{
            display: 'inline-block',
            padding: '10px 24px',
            borderRadius: 8,
            background: 'rgba(6,182,212,0.12)',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#06B6D4',
            fontSize: 13,
            fontWeight: 700,
            fontFamily: 'var(--font-display, sans-serif)',
            textDecoration: 'none',
            letterSpacing: '0.06em',
          }}
        >
          Browse {sport === 'SNOW' ? 'Resorts' : 'Trails'} →
        </Link>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TripPlannerPage() {
  const [sport, setSport] = useState<Sport>('SURF')
  const [allSpots, setAllSpots] = useState<Spot[]>([])
  const [selected, setSelected] = useState<Spot[]>([])
  const [radius, setRadius] = useState<RadiusMi>(null)
  const [userLat, setUserLat] = useState<number | null>(null)
  const [userLng, setUserLng] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  // Fetch spots
  useEffect(() => {
    fetch('/spots.json')
      .then((r) => r.json())
      .then((data: Spot[]) => setAllSpots(data))
      .catch(() => setAllSpots([]))
      .finally(() => setLoading(false))
  }, [])

  // User location
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLat(pos.coords.latitude)
          setUserLng(pos.coords.longitude)
        },
        () => {},
        { timeout: 5000 }
      )
    }
  }, [])

  const handleAdd = (spot: Spot) => {
    if (selected.length >= 4) return
    setSelected((prev) => [...prev, spot])
  }

  const handleRemove = (slug: string) => {
    setSelected((prev) => prev.filter((s) => s.slug !== slug))
  }

  // Best spot by quality score
  const bestSpotSlug = useMemo(() => {
    if (selected.length < 2) return null
    let best: Spot | null = null
    let bestScore = -1
    for (const s of selected) {
      const cond = mockConditions(s)
      if (cond.qualityScore > bestScore) {
        bestScore = cond.qualityScore
        best = s
      }
    }
    return best?.slug ?? null
  }, [selected])

  return (
    <div
      style={{
        minHeight: '100%',
        background: 'transparent',
        padding: '32px 24px 48px',
        maxWidth: 1100,
        margin: '0 auto',
        boxSizing: 'border-box',
      }}
    >
      {/* ── Header ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div
              style={{
                fontSize: 11,
                fontFamily: 'var(--font-data, monospace)',
                color: '#06B6D4',
                letterSpacing: '0.2em',
                fontWeight: 700,
                marginBottom: 6,
              }}
            >
              KOASTCAST / PLAN
            </div>
            <h1
              style={{
                fontFamily: 'var(--font-display, sans-serif)',
                fontSize: 'clamp(28px, 4vw, 42px)',
                fontWeight: 900,
                color: '#F8FAFC',
                margin: 0,
                lineHeight: 1,
                letterSpacing: '-0.02em',
              }}
            >
              TRIP PLANNER
            </h1>
          </div>
          <div style={{ marginBottom: 4 }}>
            <div
              style={{
                fontSize: 13,
                color: 'rgba(148,163,184,0.55)',
                fontFamily: 'var(--font-data, monospace)',
                lineHeight: 1.5,
              }}
            >
              Compare up to 4 spots side-by-side.
              <br />
              Find your best session this week.
            </div>
          </div>
        </div>

        {/* Decorative line */}
        <div
          style={{
            height: 1,
            background: 'linear-gradient(90deg, rgba(6,182,212,0.4), transparent)',
            marginTop: 20,
          }}
        />
      </div>

      {/* ── Sport Tabs + Radius ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        <SportTabs active={sport} onChange={(s) => { setSport(s); setSelected([]) }} />
        {sport === 'SURF' && (
          <RadiusSelector value={radius} onChange={setRadius} />
        )}
      </div>

      {sport !== 'SURF' ? (
        <ComingSoonSport sport={sport} />
      ) : (
        <>
          {/* ── Spot Picker ── */}
          <div
            style={{
              padding: '20px 24px',
              background: 'rgba(6,12,24,0.7)',
              border: '1px solid rgba(6,182,212,0.1)',
              borderRadius: 14,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-data, monospace)',
                color: 'rgba(6,182,212,0.7)',
                letterSpacing: '0.15em',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              SELECT SPOTS TO COMPARE
            </div>
            {loading ? (
              <div style={{ color: 'rgba(148,163,184,0.4)', fontSize: 13, fontFamily: 'var(--font-data, monospace)' }}>
                Loading spots…
              </div>
            ) : (
              <SpotPicker
                allSpots={allSpots}
                selected={selected}
                onAdd={handleAdd}
                onRemove={handleRemove}
                radius={radius}
                userLat={userLat}
                userLng={userLng}
              />
            )}
          </div>

          {/* ── Comparison Grid ── */}
          <div style={{ marginBottom: 32 }}>
            <div
              style={{
                fontSize: 10,
                fontFamily: 'var(--font-data, monospace)',
                color: 'rgba(6,182,212,0.7)',
                letterSpacing: '0.15em',
                fontWeight: 700,
                marginBottom: 14,
              }}
            >
              NOW CONDITIONS
            </div>

            {selected.length < 2 ? (
              <EmptyComparison />
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                {selected.map((spot) => (
                  <ComparisonCard
                    key={spot.slug}
                    spot={spot}
                    isBest={spot.slug === bestSpotSlug}
                    onRemove={() => handleRemove(spot.slug)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Best Day This Week ── */}
          {selected.length >= 1 && (
            <div
              style={{
                padding: '20px 24px',
                background: 'rgba(6,12,24,0.7)',
                border: '1px solid rgba(6,182,212,0.1)',
                borderRadius: 14,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 16,
                }}
              >
                <Calendar size={13} style={{ color: 'rgba(6,182,212,0.7)' }} />
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-data, monospace)',
                    color: 'rgba(6,182,212,0.7)',
                    letterSpacing: '0.15em',
                    fontWeight: 700,
                  }}
                >
                  BEST DAY THIS WEEK
                </span>
                {selected.length >= 2 && (
                  <span
                    style={{
                      marginLeft: 4,
                      fontSize: 10,
                      color: 'rgba(148,163,184,0.35)',
                      fontFamily: 'var(--font-data, monospace)',
                    }}
                  >
                    — avg quality across {selected.length} spots
                  </span>
                )}
              </div>
              <WeekStrip spots={selected} />
            </div>
          )}

          {/* ── Quick links when no spots ── */}
          {selected.length === 0 && !loading && (
            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                marginTop: 8,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: 'rgba(148,163,184,0.4)',
                  fontFamily: 'var(--font-data, monospace)',
                  alignSelf: 'center',
                }}
              >
                Or explore:
              </div>
              <Link
                href="/map"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(6,182,212,0.2)',
                  background: 'rgba(6,182,212,0.06)',
                  color: '#67E8F9',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display, sans-serif)',
                  textDecoration: 'none',
                  letterSpacing: '0.06em',
                }}
              >
                <MapPin size={12} />
                SURF MAP
              </Link>
              <Link
                href="/sessions"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.08)',
                  background: 'rgba(255,255,255,0.03)',
                  color: 'rgba(148,163,184,0.6)',
                  fontSize: 12,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display, sans-serif)',
                  textDecoration: 'none',
                  letterSpacing: '0.06em',
                }}
              >
                <TrendingUp size={12} />
                MY SESSIONS
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  )
}
