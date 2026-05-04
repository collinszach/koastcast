'use client'

import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import type { Spot } from '@/types'
import { getConditionLabel, formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow } from '@/types'
import { useLocation } from '@/lib/location'
import { useSavedSpots } from '@/lib/useSavedSpots'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StoredSession {
  id: string
  spot_name?: string
  spot_slug?: string
  date?: string
  quality_rating?: number
  notes?: string
}

interface OptimalWindow {
  start_time: string
  end_time: string
  duration_hours: number
  peak_score: number
  peak_hour: string
  peak_stoke_score: number
  peak_wave_height_ft: number | null
  peak_wave_period_s: number | null
  peak_wind_speed_kt: number | null
  peak_tide_state: string | null
  crowd_level: string
  reason: string
}

interface OptimalWindowsResponse {
  spot_id: string
  spot_name: string
  generated_at: string
  windows: OptimalWindow[]
  days_searched: number
}

interface SpotWithDist extends Spot {
  distMi?: number
}

// ─── Condition colour palette ─────────────────────────────────────────────────

const COND = {
  firing:   { label: 'FIRING',   bar: '#EF4444', glow: '#EF444460', badge: 'rgba(239,68,68,0.12)',   badgeBorder: 'rgba(239,68,68,0.35)',   text: '#FCA5A5', num: '#FF6B6B' },
  pumping:  { label: 'PUMPING',  bar: '#F59E0B', glow: '#F59E0B60', badge: 'rgba(245,158,11,0.12)',  badgeBorder: 'rgba(245,158,11,0.35)',  text: '#FDE68A', num: '#FBBF24' },
  fun:      { label: 'FUN',      bar: '#10B981', glow: '#10B98160', badge: 'rgba(16,185,129,0.12)',  badgeBorder: 'rgba(16,185,129,0.35)',  text: '#6EE7B7', num: '#34D399' },
  worth_it: { label: 'WORTH IT', bar: '#3B82F6', glow: '#3B82F660', badge: 'rgba(59,130,246,0.12)',  badgeBorder: 'rgba(59,130,246,0.35)',  text: '#93C5FD', num: '#60A5FA' },
  flat:     { label: 'FLAT',     bar: '#475569', glow: '#47556940', badge: 'rgba(71,85,105,0.1)',    badgeBorder: 'rgba(71,85,105,0.2)',    text: '#94A3B8', num: '#64748B' },
  no_data:  { label: 'NO DATA',  bar: '#1E293B', glow: '#1E293B30', badge: 'rgba(30,41,59,0.1)',     badgeBorder: 'rgba(30,41,59,0.2)',     text: '#475569', num: '#334155' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function loadSessions(): StoredSession[] {
  try {
    const raw = localStorage.getItem('terrain_sessions')
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function condColor(score: number | null | undefined): string {
  if (score == null) return '#2E5568'
  if (score >= 8) return '#F97316'
  if (score >= 6) return '#06B6D4'
  if (score >= 4) return '#3B82F6'
  if (score >= 2) return '#6366F1'
  return '#334155'
}

function condLabel(score: number | null | undefined): string {
  if (score == null) return 'No data'
  if (score >= 8) return 'FIRING'
  if (score >= 6) return 'PUMPING'
  if (score >= 4) return 'FUN'
  if (score >= 2) return 'WORTH IT'
  return 'FLAT'
}

function distanceMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtWindowTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function fmtWindowDay(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'long' })
}

// ─── Quality dot strip (10 dots, no fake data) ───────────────────────────────

function QualityDots({ score }: { score?: number | null }) {
  const filled = Math.round(score ?? 0)
  const color = condColor(score)
  return (
    <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
      {Array.from({ length: 10 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: i < filled ? color : 'rgba(255,255,255,0.08)',
            boxShadow: i < filled ? `0 0 4px ${color}80` : 'none',
          }}
        />
      ))}
    </div>
  )
}

// ─── Today's Brief ────────────────────────────────────────────────────────────

function TodaysBrief({ spot, hasLocation }: { spot: SpotWithDist | null; hasLocation: boolean }) {
  const today = new Date()
  const dateLabel = today.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }).toUpperCase()

  // Derive a "best time" label from the nearest spot's current conditions (static, no extra API call)
  const cc = spot?.current_conditions
  const hasConditions = cc?.quality_score != null

  // Pick a motivational time-of-day message
  const hour = today.getHours()
  const motives = hour < 6
    ? 'Pre-dawn glass — best barrels of the day await.'
    : hour < 10
    ? 'Dawn patrol conditions. Early bird gets the wave.'
    : hour < 13
    ? 'Morning sessions running. Check the lineup before it fills.'
    : hour < 17
    ? 'Afternoon onshore likely. Tide windows matter most now.'
    : 'Evening glass-off potential. One more session before dark.'

  return (
    <div style={{ padding: '16px 20px 0' }}>
      <div style={{
        background: 'rgba(6,13,26,0.72)',
        border: '1px solid rgba(6,182,212,0.18)',
        borderRadius: 14,
        padding: '18px 20px',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(6,182,212,0.06)',
        position: 'relative' as const,
        overflow: 'hidden',
      }}>
        {/* Top cyan accent bar */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, #06B6D4, #22D3EE, rgba(6,182,212,0))',
        }} />

        {/* Section label */}
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: 9,
          fontWeight: 700,
          color: '#22D3EE',
          letterSpacing: '0.14em',
          marginBottom: 10,
          borderLeft: '3px solid #06B6D4',
          paddingLeft: 10,
          boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
        }}>
          TODAY&apos;S BRIEF
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' as const }}>
          {/* Date block */}
          <div style={{ flexShrink: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 900,
              color: 'var(--foam)',
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
            }}>
              {dateLabel}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: 1, alignSelf: 'stretch', background: 'rgba(6,182,212,0.12)', flexShrink: 0 }} />

          {/* Conditions brief */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {hasLocation && spot && hasConditions ? (
              <>
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  color: '#7DB3C8',
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}>
                  Nearest break
                </div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--foam)',
                  marginBottom: 4,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {spot.name}
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' as const }}>
                  {cc?.wave_height_face_m != null && (
                    <div>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 8,
                        color: '#2E5568',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        display: 'block',
                      }}>Surf</span>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 18,
                        fontWeight: 900,
                        color: '#22D3EE',
                        lineHeight: 1,
                      }}>
                        {formatWaveHeight(cc.wave_height_face_m)}
                      </span>
                    </div>
                  )}
                  {cc?.wave_period_s != null && (
                    <div>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 8,
                        color: '#2E5568',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        display: 'block',
                      }}>Period</span>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 18,
                        fontWeight: 900,
                        color: '#7DB3C8',
                        lineHeight: 1,
                      }}>
                        {formatPeriod(cc.wave_period_s)}
                      </span>
                    </div>
                  )}
                  {cc?.quality_score != null && (
                    <div>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 8,
                        color: '#2E5568',
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase' as const,
                        display: 'block',
                      }}>Quality</span>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 18,
                        fontWeight: 900,
                        color: condColor(cc.quality_score),
                        lineHeight: 1,
                      }}>
                        {cc.quality_score.toFixed(1)}
                      </span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--spray)',
                lineHeight: 1.5,
                fontStyle: 'italic',
              }}>
                {motives}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── My Spots Strip ───────────────────────────────────────────────────────────
// Shows the user's saved spots (up to 3, in save order).
// Falls back to top 3 by proximity/quality when no spots have been saved yet.

function MySpotsStrip({ spots }: { spots: SpotWithDist[] }) {
  const { saved } = useSavedSpots()
  const savedSlugs = saved.spots  // string[]

  // Build the display list:
  // — saved mode: filter full list to saved slugs, preserve save order, cap at 3
  // — fallback mode: first 3 of the already-sorted spots array
  const isSavedMode = savedSlugs.length > 0
  const display: SpotWithDist[] = useMemo(() => {
    if (isSavedMode) {
      return savedSlugs
        .slice(0, 3)
        .map(slug => spots.find(s => s.slug === slug))
        .filter((s): s is SpotWithDist => s !== undefined)
    }
    return spots.slice(0, 3)
  }, [isSavedMode, savedSlugs, spots])

  const sectionLabel = isSavedMode ? 'YOUR SPOTS' : 'NEARBY SPOTS'

  return (
    <div style={{ padding: '20px 20px 0' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
      }}>
        <span style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          fontWeight: 700,
          color: '#22D3EE',
          letterSpacing: '0.12em',
          borderLeft: '3px solid #06B6D4',
          paddingLeft: 10,
          boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
        }}>
          {sectionLabel}
        </span>
        {!isSavedMode && (
          <Link href="/map" style={{
            fontFamily: 'var(--font-data)',
            fontSize: 11,
            color: 'var(--cyan-bright, #22D3EE)',
            textDecoration: 'none',
            letterSpacing: '0.04em',
          }}
          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Save spots you surf →
          </Link>
        )}
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 10,
      }}>
        {display.map(spot => {
          const cc = spot.current_conditions
          const label = getConditionLabel(cc?.quality_score)
          const meta = COND[label]
          return (
            <Link key={spot.slug} href={`/spot/${spot.slug}`} style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'rgba(6,13,26,0.7)',
                border: '1px solid rgba(6,182,212,0.12)',
                borderRadius: 12,
                padding: '14px 16px',
                cursor: 'pointer',
                transition: 'border-color 0.15s',
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Top accent bar */}
                <div style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0,
                  height: 3,
                  background: meta.bar,
                  boxShadow: `0 0 10px ${meta.glow}`,
                }} />

                {/* Spot name */}
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 14,
                  fontWeight: 800,
                  color: 'var(--foam)',
                  marginTop: 6,
                  marginBottom: 2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap' as const,
                }}>
                  {spot.name}
                </div>

                {/* Region + distance */}
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  color: '#4A7A8A',
                  letterSpacing: '0.05em',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <span>{spot.region}</span>
                  {spot.distMi != null && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                      <span>{spot.distMi < 10 ? `${spot.distMi.toFixed(1)} mi` : `${Math.round(spot.distMi)} mi`}</span>
                    </>
                  )}
                </div>

                {/* Wave height */}
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 32,
                  fontWeight: 900,
                  color: meta.num,
                  lineHeight: 1,
                  filter: `drop-shadow(0 0 8px ${meta.glow})`,
                  marginBottom: 4,
                }}>
                  {cc?.wave_height_face_m != null ? formatWaveHeight(cc.wave_height_face_m) : '--'}
                </div>

                {/* Period + wind row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#22D3EE', fontWeight: 600 }}>
                    {formatPeriod(cc?.wave_period_s)}
                  </span>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)' }}>
                    {directionArrow(cc?.wind_direction)} {formatWindSpeed(cc?.wind_speed_ms)}
                  </span>
                </div>

                {/* Quality dots */}
                <QualityDots score={cc?.quality_score} />
              </div>
            </Link>
          )
        })}

        {/* If fewer than 3 spots loaded yet, show skeletons */}
        {display.length === 0 && [0, 1, 2].map(i => (
          <div key={i} style={{
            background: 'rgba(6,13,26,0.7)',
            border: '1px solid rgba(6,182,212,0.08)',
            borderRadius: 12,
            height: 148,
            animation: 'terrain-pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.12}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Go / No-Go Hero ─────────────────────────────────────────────────────────
// Calls /api/optimal for the first displayed spot. Degrades gracefully.

function GoNoGoHero({ spot }: { spot: SpotWithDist | null }) {
  const [data, setData] = useState<OptimalWindowsResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!spot?.slug) return
    setLoading(true)
    fetch(`/api/optimal?spot_id=${spot.slug}&days=3`)
      .then(r => r.ok ? r.json() : null)
      .then((d: OptimalWindowsResponse | null) => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [spot?.slug])

  // Find the best window in the next 2 days
  const bestWindow = useMemo(() => {
    if (!data?.windows?.length) return null
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() + 2)
    const upcoming = data.windows
      .filter(w => new Date(w.start_time) < cutoff)
      .sort((a, b) => b.peak_score - a.peak_score)
    return upcoming[0] ?? data.windows[0]
  }, [data])

  const verdict = bestWindow == null ? null
    : bestWindow.peak_score >= 70 ? 'GO'
    : bestWindow.peak_score >= 45 ? 'MAYBE'
    : 'PASS'

  const verdictColor = verdict === 'GO' ? '#10B981'
    : verdict === 'MAYBE' ? '#F59E0B'
    : verdict === 'PASS' ? '#EF4444'
    : '#2E5568'

  // Skeleton while loading
  if (loading || (spot && !data && loading)) {
    return (
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          background: 'rgba(6,13,26,0.7)',
          border: '1px solid rgba(6,182,212,0.1)',
          borderRadius: 14,
          height: 110,
          animation: 'terrain-pulse 1.4s ease-in-out infinite',
        }} />
      </div>
    )
  }

  // No spot yet
  if (!spot) return null

  // NUC offline or no windows returned — show graceful placeholder
  if (!bestWindow) {
    return (
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          background: 'rgba(6,13,26,0.7)',
          border: '1px solid rgba(6,182,212,0.1)',
          borderRadius: 14,
          padding: '18px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 900,
            color: '#2E5568',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            minWidth: 64,
          }}>--</div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--foam)', marginBottom: 3 }}>
              {spot.name}
            </div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#4A7A8A', letterSpacing: '0.04em' }}>
              Optimal windows unavailable — forecast engine offline
            </div>
          </div>
          <Link href={`/spot/${spot.slug}`} style={{
            marginLeft: 'auto',
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 700,
            color: '#06B6D4',
            textDecoration: 'none',
            padding: '6px 14px',
            background: 'rgba(6,182,212,0.08)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 8,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap' as const,
          }}>
            View forecast →
          </Link>
        </div>
      </div>
    )
  }

  const dayLabel = fmtWindowDay(bestWindow.start_time)
  const startFmt = fmtWindowTime(bestWindow.start_time)
  const endFmt   = fmtWindowTime(bestWindow.end_time)

  return (
    <div style={{ padding: '16px 20px 0' }}>
      {/* Label */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
      }}>
        <span style={{
          fontFamily: 'var(--font-data)',
          fontSize: 9,
          fontWeight: 700,
          color: '#22D3EE',
          letterSpacing: '0.14em',
          borderLeft: '3px solid #06B6D4',
          paddingLeft: 10,
          boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
        }}>
          BEST WINDOW
        </span>
        <Link href={`/spot/${spot.slug}`} style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          color: 'rgba(6,182,212,0.5)',
          textDecoration: 'none',
          letterSpacing: '0.04em',
        }}>
          Full forecast →
        </Link>
      </div>

      <div style={{
        background: `linear-gradient(135deg, ${verdictColor}0A, rgba(6,13,26,0.9))`,
        border: `1px solid ${verdictColor}22`,
        borderLeft: `3px solid ${verdictColor}`,
        borderRadius: 14,
        padding: '18px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap' as const,
      }}>
        {/* Verdict */}
        <div style={{
          fontFamily: 'var(--font-display)',
          fontSize: 44,
          fontWeight: 900,
          color: verdictColor,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          filter: `drop-shadow(0 0 16px ${verdictColor}60)`,
          minWidth: 100,
        }}>
          {verdict}
        </div>

        {/* Spot + window */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 800,
            color: 'var(--foam)',
            marginBottom: 2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap' as const,
          }}>
            {spot.name}
          </div>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 12,
            color: '#7DB3C8',
            letterSpacing: '0.03em',
            marginBottom: 8,
          }}>
            {dayLabel} · {startFmt}–{endFmt} · {bestWindow.duration_hours}h window
          </div>
          {/* Wave stats */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
            {bestWindow.peak_wave_height_ft != null && (
              <div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: '#2E5568', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Height</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 900, color: verdictColor, lineHeight: 1 }}>
                  {bestWindow.peak_wave_height_ft.toFixed(0)}ft
                </div>
              </div>
            )}
            {bestWindow.peak_wave_period_s != null && (
              <div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: '#2E5568', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Period</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 900, color: '#22D3EE', lineHeight: 1 }}>
                  {bestWindow.peak_wave_period_s.toFixed(0)}s
                </div>
              </div>
            )}
            {bestWindow.peak_wind_speed_kt != null && (
              <div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: '#2E5568', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Wind</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 900, color: '#7DB3C8', lineHeight: 1 }}>
                  {bestWindow.peak_wind_speed_kt.toFixed(0)}kt
                </div>
              </div>
            )}
            <div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: '#2E5568', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Score</div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 16, fontWeight: 900, color: verdictColor, lineHeight: 1 }}>
                {Math.round(bestWindow.peak_score)}
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link href={`/spot/${spot.slug}`} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 44,
          height: 44,
          borderRadius: '50%',
          background: `${verdictColor}20`,
          border: `1px solid ${verdictColor}40`,
          color: verdictColor,
          fontSize: 18,
          textDecoration: 'none',
          flexShrink: 0,
        }}>
          →
        </Link>
      </div>
    </div>
  )
}

// ─── Spot row (compact ranked list) ──────────────────────────────────────────

function SpotRow({ spot, rank }: { spot: SpotWithDist; rank: number }) {
  const cc = spot.current_conditions
  const score = cc?.quality_score
  const color = condColor(score)
  const barColor = score == null ? '#1E3A4A' : score >= 7 ? '#10B981' : score >= 4 ? '#F59E0B' : '#EF4444'

  return (
    <Link href={`/spot/${spot.slug}`} style={{ textDecoration: 'none' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        marginBottom: 2,
        borderRadius: 8,
        overflow: 'hidden',
        background: 'rgba(6,13,26,0.4)',
        border: '1px solid rgba(6,182,212,0.07)',
        cursor: 'pointer',
      }}>
        {/* Left quality bar */}
        <div style={{
          width: 4,
          alignSelf: 'stretch',
          background: barColor,
          boxShadow: `0 0 8px ${barColor}66`,
          flexShrink: 0,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '8px 10px' }}>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 700, color: '#2E5568', width: 14, flexShrink: 0 }}>
            {rank}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 800,
              color: 'var(--foam)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap' as const,
              letterSpacing: '0.01em',
            }}>
              {spot.name}
            </div>
            <div style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: '#4A7A8A',
              letterSpacing: '0.05em',
              marginTop: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <span>{spot.region}</span>
              {spot.distMi != null && (
                <>
                  <span style={{ color: 'rgba(255,255,255,0.2)' }}>·</span>
                  <span>{spot.distMi < 10 ? `${spot.distMi.toFixed(1)} mi` : `${Math.round(spot.distMi)} mi`}</span>
                </>
              )}
            </div>
          </div>
          {cc?.wave_height_face_m != null && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 15, fontWeight: 900, color, letterSpacing: '-0.02em' }}>
              {formatWaveHeight(cc.wave_height_face_m)}
            </span>
          )}
          {cc?.wave_period_s != null && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#7DB3C8', fontWeight: 600 }}>
              {cc.wave_period_s.toFixed(0)}s
            </span>
          )}
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            fontWeight: 700,
            color: barColor,
            background: `${barColor}18`,
            border: `1px solid ${barColor}35`,
            padding: '2px 7px',
            borderRadius: 6,
            letterSpacing: '0.06em',
            whiteSpace: 'nowrap' as const,
            flexShrink: 0,
          }}>
            {condLabel(score)}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Location status pill ─────────────────────────────────────────────────────

function LocationPill({ permission, requestLocation }: { permission: string; requestLocation: () => void }) {
  if (permission === 'granted') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
        background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
        borderRadius: 20, flexShrink: 0,
      }}>
        <span style={{ fontSize: 10 }}>📍</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 600, color: '#06B6D4', letterSpacing: '0.06em' }}>
          Location active
        </span>
      </div>
    )
  }
  if (permission === 'prompt' || permission === 'unknown') {
    return (
      <button onClick={requestLocation} style={{
        display: 'flex', alignItems: 'center', gap: 5, padding: '3px 10px',
        background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.15)',
        borderRadius: 20, cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{ fontSize: 10 }}>📍</span>
        <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, fontWeight: 600, color: '#7DB3C8', letterSpacing: '0.06em' }}>
          Add location
        </span>
      </button>
    )
  }
  return null
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntelHubPage() {
  const [spots, setSpots] = useState<Spot[]>([])
  const [sessions, setSessions] = useState<StoredSession[]>([])
  const [now, setNow] = useState(new Date())

  const { location, permission, requestLocation } = useLocation()

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Load spots + sessions
  useEffect(() => {
    setSessions(loadSessions())
    fetch('/spots.json', { cache: 'force-cache' })
      .then(r => r.ok ? r.json() : [])
      .then((data: Spot[]) => setSpots(data))
      .catch(() => {})
  }, [])

  // Fetch live conditions from Open-Meteo for displayed spots
  const [liveData, setLiveData] = useState<Record<string, {
    wave_height_m: number | null
    wave_height_face_m: number | null
    wave_period_s: number | null
    wave_direction: number | null
    wind_speed_ms: number | null
    wind_direction: number | null
  }>>({})

  useEffect(() => {
    if (spots.length === 0) return
    let cancelled = false

    // Fetch for first 5 spots (by index, before sorting — avoids circular dep)
    const toFetch = spots.slice(0, 8)

    async function fetchLive() {
      const results = await Promise.allSettled(
        toFetch.map(spot =>
          fetch(`/api/forecast?spot_id=${spot.slug}&days=1`)
            .then(r => r.ok ? r.json() : null)
        )
      )
      if (cancelled) return

      const live: typeof liveData = {}
      const now = Date.now()

      results.forEach((result, idx) => {
        if (result.status !== 'fulfilled' || !result.value?.hours?.length) return
        const slug = toFetch[idx].slug
        const hours = result.value.hours as Array<{
          forecast_time: string
          wave_height_m: number | null
          wave_period_s: number | null
          swell_period_s: number | null
          wave_direction: number | null
          wind_speed_ms: number | null
          wind_direction: number | null
        }>

        // Find closest hour to now
        let best = hours[0]
        let bestDiff = Math.abs(new Date(best.forecast_time).getTime() - now)
        for (const h of hours) {
          const diff = Math.abs(new Date(h.forecast_time).getTime() - now)
          if (diff < bestDiff) { best = h; bestDiff = diff }
        }

        live[slug] = {
          wave_height_m: best.wave_height_m,
          wave_height_face_m: best.wave_height_m != null ? best.wave_height_m * 1.5 : null,
          wave_period_s: best.wave_period_s ?? best.swell_period_s ?? null,
          wave_direction: best.wave_direction,
          wind_speed_ms: best.wind_speed_ms,
          wind_direction: best.wind_direction,
        }
      })

      setLiveData(live)
    }

    fetchLive()
    return () => { cancelled = true }
  }, [spots])

  // Merge live data into spots
  const spotsWithLive = useMemo<Spot[]>(() => {
    if (Object.keys(liveData).length === 0) return spots
    return spots.map(s => {
      const live = liveData[s.slug]
      if (!live) return s
      return { ...s, current_conditions: { ...s.current_conditions, ...live } }
    })
  }, [spots, liveData])

  // Sort by distance (if location known) or by quality score
  const sortedSpots = useMemo<SpotWithDist[]>(() => {
    if (location && spotsWithLive.length) {
      return [...spotsWithLive]
        .map(s => ({ ...s, distMi: distanceMiles(location.lat, location.lng, s.lat, s.lng) }))
        .sort((a, b) => (a.distMi ?? Infinity) - (b.distMi ?? Infinity))
    }
    return [...spotsWithLive].sort((a, b) => {
      const qa = a.current_conditions?.quality_score ?? -1
      const qb = b.current_conditions?.quality_score ?? -1
      return qb - qa
    })
  }, [spotsWithLive, location])

  const top5 = sortedSpots.slice(0, 5)
  const heroSpot = sortedSpots[0] ?? null

  // Summary counts — only use real data
  const spotsWithData = spots.filter(s => s.current_conditions?.quality_score != null)
  const goodSurf = spotsWithData.filter(s => (s.current_conditions!.quality_score ?? 0) >= 6).length

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening'

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      overflowY: 'auto',
      background: 'var(--deep)',
      fontFamily: 'system-ui, sans-serif',
    }}>

      <style>{`
        @keyframes terrain-pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.8; }
        }
      `}</style>

      {/* ── HEADER BAR ──────────────────────────────────────────────────── */}
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '0 20px',
        height: 52,
        background: 'rgba(6,13,26,0.95)',
        backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(6,182,212,0.12)',
        flexShrink: 0,
      }}>
        {/* Logo + greeting */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            fontWeight: 900,
            color: 'var(--foam)',
            letterSpacing: '0.04em',
          }}>
            nSwell
          </span>
          <div style={{ width: 1, height: 18, background: 'rgba(6,182,212,0.15)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 600,
            color: 'var(--spray)',
            letterSpacing: '0.02em',
          }}>
            {greeting}
          </span>
          <LocationPill permission={permission} requestLocation={requestLocation} />
        </div>

        {/* Surf summary pill — real data only */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
          {spots.length > 0 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: 'rgba(6,182,212,0.07)',
              border: '1px solid rgba(6,182,212,0.18)',
              borderRadius: 40,
              padding: '5px 14px',
            }}>
              <div style={{
                width: 7, height: 7,
                borderRadius: '50%',
                background: '#06B6D4',
                boxShadow: '0 0 6px #06B6D4',
              }} />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#06B6D4', letterSpacing: '0.1em', fontWeight: 700 }}>SURF</span>
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--foam)', fontWeight: 600 }}>
                {goodSurf > 0
                  ? `${goodSurf} spot${goodSurf !== 1 ? 's' : ''} pumping`
                  : heroSpot ? `${heroSpot.name} · ${formatWaveHeight(heroSpot.current_conditions?.wave_height_face_m)}` : 'Loading...'}
              </span>
            </div>
          )}
        </div>

        {/* Clock */}
        <div style={{ flexShrink: 0, textAlign: 'right' as const }}>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--foam)',
            letterSpacing: '0.06em',
            lineHeight: 1,
          }}>
            {fmtTime(now)}
          </div>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            color: '#2E5568',
            letterSpacing: '0.06em',
            marginTop: 2,
          }}>
            {fmtDate(now)}
          </div>
        </div>
      </div>

      {/* ── TODAY'S BRIEF ───────────────────────────────────────────────── */}
      <TodaysBrief spot={heroSpot} hasLocation={!!location} />

      {/* ── MY SPOTS STRIP ──────────────────────────────────────────────── */}
      <MySpotsStrip spots={sortedSpots} />

      {/* ── GO / NO-GO HERO ─────────────────────────────────────────────── */}
      <GoNoGoHero spot={heroSpot} />

      {/* ── SURF COMMAND — ranked spot list ─────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            fontWeight: 700,
            color: '#22D3EE',
            letterSpacing: '0.14em',
            borderLeft: '3px solid #06B6D4',
            paddingLeft: 10,
            boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
          }}>
            {location ? 'NEAREST BREAKS' : 'SURF COMMAND'}
          </span>
          <Link href="/map" style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            color: '#06B6D4',
            textDecoration: 'none',
            letterSpacing: '0.06em',
          }}>
            Full map →
          </Link>
        </div>

        {top5.length === 0 ? (
          <div style={{
            background: 'rgba(6,13,26,0.6)',
            border: '1px solid rgba(6,182,212,0.08)',
            borderRadius: 12,
            padding: '32px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--spray)', fontWeight: 700, marginBottom: 6 }}>
              Forecast engine offline
            </div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)' }}>
              Start the NUC backend to see live conditions
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
            {top5.map((s, i) => <SpotRow key={s.slug} spot={s} rank={i + 1} />)}
          </div>
        )}
      </div>

      {/* ── QUICK LAUNCH ────────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: 9,
          fontWeight: 700,
          color: '#22D3EE',
          letterSpacing: '0.14em',
          marginBottom: 12,
          borderLeft: '3px solid #06B6D4',
          paddingLeft: 10,
          boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
        }}>
          QUICK LAUNCH
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
        }}>
          {[
            { href: '/map',      icon: '◉',  title: 'Live Map',    sub: 'All spots live',        accent: '#06B6D4' },
            { href: '/snow',     icon: '❄',  title: 'Snow',        sub: 'Resort forecasts',      accent: '#8B5CF6' },
            { href: '/sessions', icon: '◷',  title: 'Sessions',    sub: 'Log your surf',         accent: '#10B981' },
          ].map(({ href, icon, title, sub, accent }) => (
            <Link key={href} href={href} style={{ textDecoration: 'none' }}>
              <div style={{
                borderRadius: 14,
                border: `1px solid ${accent}18`,
                background: `${accent}07`,
                padding: '16px 12px',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 20, color: accent, marginBottom: 6, filter: `drop-shadow(0 0 6px ${accent}60)` }}>{icon}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: 'var(--foam)', marginBottom: 3 }}>{title}</div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.03em' }}>{sub}</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── RECENT SESSIONS ─────────────────────────────────────────────── */}
      <div style={{ padding: '20px 20px 28px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            fontWeight: 700,
            color: '#22D3EE',
            letterSpacing: '0.14em',
            borderLeft: '3px solid #06B6D4',
            paddingLeft: 10,
            boxShadow: '-4px 0 12px rgba(6,182,212,0.15)',
          }}>
            RECENT SESSIONS
          </span>
          {sessions.length > 0 && (
            <Link href="/sessions" style={{
              fontFamily: 'var(--font-data)',
              fontSize: 10,
              color: '#06B6D4',
              letterSpacing: '0.06em',
              textDecoration: 'none',
            }}>
              All sessions →
            </Link>
          )}
        </div>

        {sessions.length === 0 ? (
          <div style={{
            background: 'rgba(6,13,26,0.6)',
            border: '1px solid rgba(6,182,212,0.08)',
            borderRadius: 12,
            padding: '24px',
            textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#7DB3C8', marginBottom: 12 }}>
              No sessions logged yet
            </div>
            <Link href="/sessions">
              <button style={{
                background: 'linear-gradient(135deg, #06B6D4, #0284C7)',
                border: 'none',
                borderRadius: 8,
                padding: '8px 20px',
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                fontWeight: 700,
                color: 'white',
                letterSpacing: '0.06em',
                cursor: 'pointer',
              }}>
                Log New Session
              </button>
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {sessions.slice(0, 3).map(sess => (
              <div
                key={sess.id}
                style={{
                  background: 'rgba(6,13,26,0.7)',
                  border: '1px solid rgba(6,182,212,0.1)',
                  borderRadius: 12,
                  padding: '14px 16px',
                }}
              >
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: 'var(--foam)', marginBottom: 3 }}>
                  {sess.spot_name ?? 'Unknown spot'}
                </div>
                <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#2E5568', letterSpacing: '0.06em', marginBottom: 8 }}>
                  {sess.date ?? '—'}
                </div>
                {sess.quality_rating != null && (
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 18, fontWeight: 900, color: condColor(sess.quality_rating) }}>
                    {sess.quality_rating}/10
                  </div>
                )}
                {sess.notes && (
                  <div style={{
                    fontFamily: 'system-ui, sans-serif',
                    fontSize: 10,
                    color: '#7DB3C8',
                    marginTop: 6,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap' as const,
                  }}>
                    {sess.notes}
                  </div>
                )}
              </div>
            ))}
            <Link href="/sessions" style={{ textDecoration: 'none' }}>
              <div style={{
                background: 'rgba(6,182,212,0.04)',
                border: '1px dashed rgba(6,182,212,0.2)',
                borderRadius: 12,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column' as const,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                cursor: 'pointer',
                minHeight: 80,
              }}>
                <span style={{ fontSize: 20 }}>+</span>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#06B6D4', letterSpacing: '0.08em' }}>
                  LOG SESSION
                </span>
              </div>
            </Link>
          </div>
        )}
      </div>

    </div>
  )
}
