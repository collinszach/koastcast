'use client'

import { useState, useMemo, useEffect } from 'react'
import type { ForecastHour } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────
const M_TO_FT = 3.281
const MS_TO_KT = 1.944

// ─── Helpers ─────────────────────────────────────────────────────────────────

function qualityColor(score?: number | null): string {
  if (score == null) return '#1E3A4F'
  if (score >= 7)   return '#F97316'  // fire
  if (score >= 5)   return '#06B6D4'  // cyan/pumping
  if (score >= 3)   return '#3B82F6'  // blue/ok
  return '#475569'                    // slate/flat
}

function qualityLabel(score?: number | null): string {
  if (score == null) return 'No Data'
  if (score >= 7)   return 'FIRING'
  if (score >= 5)   return 'PUMPING'
  if (score >= 3)   return 'OK'
  return 'FLAT'
}

function crowdColor(label?: string | null, score?: number | null): string {
  if (label === 'empty' || (score != null && score > 0.8))   return '#22C55E'
  if (label === 'light' || (score != null && score > 0.6))   return '#86EFAC'
  if (label === 'moderate' || (score != null && score > 0.4)) return '#FCD34D'
  if (label === 'busy' || (score != null && score > 0.2))    return '#F97316'
  if (label === 'packed' || score != null)                    return '#EF4444'
  return '#475569'
}

function toFt(m?: number | null): string {
  if (m == null) return '--'
  return `${(m * M_TO_FT).toFixed(0)}ft`
}

function toKt(ms?: number | null): string {
  if (ms == null) return '--'
  return `${(ms * MS_TO_KT).toFixed(0)}kt`
}

function toPeriod(s?: number | null): string {
  if (s == null) return '--'
  return `${s.toFixed(0)}s`
}

function toCompass(deg?: number | null): string {
  if (deg == null) return '--'
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  const idx = Math.round(((deg % 360) + 360) % 360 / 22.5) % 16
  return dirs[idx]
}

function toShortCompass(deg?: number | null): string {
  if (deg == null) return '--'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return dirs[idx]
}

function formatHour12(isoString: string): string {
  const d = new Date(isoString)
  const h = d.getHours()
  if (h === 0)  return '12am'
  if (h === 12) return '12pm'
  return h > 12 ? `${h - 12}pm` : `${h}am`
}

function formatTime12(isoString: string): string {
  const d = new Date(isoString)
  const h = d.getHours()
  const m = d.getMinutes().toString().padStart(2, '0')
  if (h === 0)  return `12:${m}am`
  if (h === 12) return `12:${m}pm`
  return h > 12 ? `${h - 12}:${m}pm` : `${h}:${m}am`
}

function getDayKey(isoString: string): string {
  const d = new Date(isoString)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function getDayLabel(isoString: string): { weekday: string; date: string } {
  const d = new Date(isoString)
  const weekday = d.toLocaleDateString('en-US', { weekday: 'short' })
  const date    = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return { weekday, date }
}

// now defaults to 0 (epoch) so nothing is "current" during SSR — set client-side in useEffect
function isCurrentHour(isoString: string, now: number): boolean {
  if (now === 0) return false
  const hTime = new Date(isoString).getTime()
  return Math.abs(now - hTime) < 1.5 * 60 * 60 * 1000 // within 1.5h
}

// ─── Wind arrow SVG ──────────────────────────────────────────────────────────
function WindArrow({ deg, size = 14, color = '#6B9BAD' }: { deg?: number | null; size?: number; color?: string }) {
  if (deg == null) return <span style={{ color: '#2E5568', fontSize: size * 0.7 }}>—</span>
  return (
    <svg
      width={size} height={size}
      viewBox="0 0 24 24"
      style={{ transform: `rotate(${deg}deg)`, display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}
      aria-hidden
    >
      <path d="M12 2 L16 18 L12 15 L8 18 Z" fill={color} />
    </svg>
  )
}

// ─── Tide state icon ─────────────────────────────────────────────────────────
function TideIcon({ state }: { state?: string | null }) {
  if (!state) return null
  if (state === 'rising')  return <span style={{ color: '#06B6D4', fontSize: 9 }}>↑</span>
  if (state === 'falling') return <span style={{ color: '#6366F1', fontSize: 9 }}>↓</span>
  if (state === 'high')    return <span style={{ color: '#F97316', fontSize: 9 }}>▲</span>
  if (state === 'low')     return <span style={{ color: '#3B82F6', fontSize: 9 }}>▽</span>
  return null
}

// ─── Group hours by day ──────────────────────────────────────────────────────
interface DayGroup {
  key: string
  label: { weekday: string; date: string }
  hours: ForecastHour[]
  peakScore: number
  peakHeight: number
}

function groupByDay(hours: ForecastHour[]): DayGroup[] {
  const map = new Map<string, DayGroup>()
  for (const h of hours) {
    const key = getDayKey(h.forecast_time)
    if (!map.has(key)) {
      map.set(key, {
        key,
        label: getDayLabel(h.forecast_time),
        hours: [],
        peakScore: 0,
        peakHeight: 0,
      })
    }
    const group = map.get(key)!
    group.hours.push(h)
    const score  = h.quality_score ?? 0
    const height = h.wave_height_face_m ?? h.wave_height_m ?? 0
    if (score  > group.peakScore)  group.peakScore  = score
    if (height > group.peakHeight) group.peakHeight = height
  }
  return Array.from(map.values())
}

// ─── Day Selector Tab ────────────────────────────────────────────────────────
function DayTab({
  group,
  isActive,
  onClick,
}: {
  group: DayGroup
  isActive: boolean
  onClick: () => void
}) {
  const color    = qualityColor(group.peakScore)
  const barPct   = Math.min(100, (group.peakScore / 10) * 100)

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        padding: '10px 14px',
        borderRadius: 10,
        border: isActive ? `1px solid ${color}55` : '1px solid rgba(6,182,212,0.07)',
        background: isActive ? `${color}12` : 'rgba(6,13,26,0.5)',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minWidth: 60,
        flexShrink: 0,
        boxShadow: isActive ? `0 0 12px ${color}22` : 'none',
      }}
    >
      <span style={{
        fontFamily: 'var(--font-display)',
        fontSize: 11,
        fontWeight: 700,
        color: isActive ? 'var(--foam)' : 'var(--spray)',
        letterSpacing: '0.04em',
      }}>
        {group.label.weekday.toUpperCase()}
      </span>
      <span style={{
        fontFamily: 'var(--font-data)',
        fontSize: 10,
        color: isActive ? 'var(--mist)' : 'var(--deep-text)',
      }}>
        {group.label.date}
      </span>

      {/* Quality mini-bar */}
      <div style={{ width: 32, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{
          width: `${barPct}%`,
          height: '100%',
          borderRadius: 2,
          background: color,
          transition: 'width 0.3s ease',
        }} />
      </div>

      {/* Peak score */}
      <span style={{
        fontFamily: 'var(--font-data)',
        fontSize: 10,
        fontWeight: 700,
        color: isActive ? color : 'var(--deep-text)',
      }}>
        {group.peakScore > 0 ? group.peakScore.toFixed(1) : '—'}
      </span>
    </button>
  )
}

// ─── Wave height bar chart ────────────────────────────────────────────────────
function WaveBarChart({ hours, clientNow }: { hours: ForecastHour[]; clientNow: number }) {
  // Show every 3h for readability, or every 1h if <= 12 hours
  const step     = hours.length > 12 ? 3 : 1
  const displayed = hours.filter((_, i) => i % step === 0)

  const maxHeight = Math.max(
    0.5,
    ...displayed.map(h => h.wave_height_face_m ?? h.wave_height_m ?? 0)
  )

  return (
    <div style={{
      padding: '0 4px 0 4px',
      marginBottom: 4,
    }}>
      {/* Chart area */}
      <div style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 3,
        height: 90,
        padding: '0 2px',
        position: 'relative',
      }}>
        {/* Horizontal grid lines */}
        {[25, 50, 75, 100].map(pct => (
          <div key={pct} style={{
            position: 'absolute',
            left: 0, right: 0,
            bottom: `${pct}%`,
            borderTop: '1px dashed rgba(6,182,212,0.07)',
            pointerEvents: 'none',
          }} />
        ))}

        {displayed.map((h, i) => {
          const rawH  = h.wave_height_face_m ?? h.wave_height_m ?? 0
          const pct   = maxHeight > 0 ? rawH / maxHeight : 0
          const color = qualityColor(h.quality_score)
          const isCur = isCurrentHour(h.forecast_time, clientNow)

          return (
            <div
              key={h.forecast_time}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                height: '100%',
                justifyContent: 'flex-end',
                gap: 3,
                position: 'relative',
              }}
            >
              {/* Wind direction arrow above bar */}
              <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)' }}>
                <WindArrow deg={h.wind_direction} size={11} color={isCur ? 'var(--cyan-bright)' : '#2E5568'} />
              </div>

              {/* The bar */}
              <div style={{
                width: '100%',
                height: `${Math.max(4, pct * 72)}px`,
                borderRadius: '3px 3px 1px 1px',
                background: rawH > 0
                  ? `linear-gradient(180deg, ${color} 0%, ${color}88 100%)`
                  : 'rgba(255,255,255,0.04)',
                boxShadow: rawH > 0 && pct > 0.3
                  ? `0 0 8px ${color}55, 0 -2px 10px ${color}30`
                  : 'none',
                transition: 'height 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
                outline: isCur ? `1px solid ${color}` : 'none',
                outlineOffset: 1,
              }} />
            </div>
          )
        })}
      </div>

      {/* X-axis hour labels */}
      <div style={{ display: 'flex', gap: 3, padding: '4px 2px 0' }}>
        {displayed.map((h, i) => {
          const isCur = isCurrentHour(h.forecast_time, clientNow)
          return (
            <div key={h.forecast_time} style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: isCur ? 'var(--cyan-bright)' : 'var(--deep-text)',
              fontWeight: isCur ? 700 : 400,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
            }}>
              {formatHour12(h.forecast_time)}
            </div>
          )
        })}
      </div>

      {/* Y-axis label (max height) */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        marginTop: 2,
      }}>
        <span style={{
          fontFamily: 'var(--font-data)',
          fontSize: 9,
          color: 'var(--deep-text)',
          letterSpacing: '0.04em',
        }}>
          max {toFt(maxHeight)}
        </span>
      </div>
    </div>
  )
}

// ─── Swell breakdown row ─────────────────────────────────────────────────────
function SwellBreakdown({ hours }: { hours: ForecastHour[] }) {
  // Use the "current" hour or first hour with swell data
  const h = hours.find(x => x.swell_height_m != null) ?? hours[0]
  if (!h) return null

  const hasPrimary = h.swell_height_m != null
  const hasWind    = h.wind_swell_height_m != null

  if (!hasPrimary && !hasWind) return null

  return (
    <div style={{
      borderTop: '1px solid rgba(6,182,212,0.08)',
      marginTop: 6,
      paddingTop: 10,
      display: 'flex',
      gap: 16,
      flexWrap: 'wrap',
    }}>
      <span style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        color: 'var(--deep-text)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        alignSelf: 'center',
        flexShrink: 0,
      }}>
        Swell
      </span>

      {hasPrimary && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#06B6D4',
            boxShadow: '0 0 6px #06B6D4',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', marginBottom: 1 }}>PRIMARY</div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--foam)', fontWeight: 600 }}>
              {toFt(h.swell_height_m)}
              <span style={{ color: 'var(--spray)', fontWeight: 400, marginLeft: 4 }}>
                @ {toPeriod(h.swell_period_s)} {toCompass(h.swell_direction)}
              </span>
            </div>
          </div>
        </div>
      )}

      {hasWind && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6, height: 6, borderRadius: '50%',
            background: '#6366F1',
            flexShrink: 0,
          }} />
          <div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', marginBottom: 1 }}>WIND SWELL</div>
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--mist)' }}>
              {toFt(h.wind_swell_height_m)}
              <span style={{ color: 'var(--spray)', fontWeight: 400, marginLeft: 4 }}>
                @ {toPeriod(h.wind_swell_period_s)} {toCompass(h.wind_swell_direction)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hourly table ────────────────────────────────────────────────────────────
function HourlyTable({ hours, clientNow }: { hours: ForecastHour[]; clientNow: number }) {
  const currentIdx  = clientNow === 0 ? -1 : hours.reduce((best, h, i) => {
    const diff = Math.abs(clientNow - new Date(h.forecast_time).getTime())
    return diff < Math.abs(clientNow - new Date(hours[best].forecast_time).getTime()) ? i : best
  }, 0)

  const COL_STYLE: React.CSSProperties = {
    fontFamily: 'var(--font-data)',
    fontSize: 10,
    color: 'var(--deep-text)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    padding: '6px 8px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
  }

  return (
    <div style={{ overflowX: 'auto', marginTop: 8, borderRadius: 10, border: '1px solid rgba(6,182,212,0.07)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid rgba(6,182,212,0.1)' }}>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Time</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Surf</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Period</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Swell Dir</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Wind</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Tide</th>
            <th style={{ ...COL_STYLE, textAlign: 'left' }}>Crowd</th>
          </tr>
        </thead>
        <tbody>
          {hours.map((h, i) => {
            const isCurrent = i === currentIdx
            const color     = qualityColor(h.quality_score)
            const heightFt  = h.wave_height_face_m ?? h.wave_height_m
            const swellDir  = h.swell_direction ?? h.wave_direction
            const windGust  = h.wind_gust_ms != null
              ? ` G${(h.wind_gust_ms * MS_TO_KT).toFixed(0)}`
              : ''

            return (
              <tr
                key={h.forecast_time}
                style={{
                  background: isCurrent
                    ? `${color}10`
                    : i % 2 === 0
                    ? 'transparent'
                    : 'rgba(6,13,26,0.35)',
                  borderLeft: isCurrent ? `2px solid ${color}` : '2px solid transparent',
                  transition: 'background 0.15s',
                }}
              >
                {/* TIME */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: isCurrent ? 'var(--cyan-bright)' : 'var(--mist)',
                    fontWeight: isCurrent ? 700 : 400,
                  }}>
                    {formatTime12(h.forecast_time)}
                    {isCurrent && (
                      <span style={{
                        marginLeft: 5,
                        fontSize: 8,
                        fontWeight: 700,
                        color: 'var(--cyan)',
                        letterSpacing: '0.08em',
                        verticalAlign: 'middle',
                      }}>
                        NOW
                      </span>
                    )}
                  </div>
                </td>

                {/* SURF */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: color,
                    }}>
                      {toFt(heightFt)}
                    </span>
                    {h.quality_score != null && (
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 8,
                        color: color,
                        background: `${color}15`,
                        padding: '1px 5px',
                        borderRadius: 4,
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                      }}>
                        {qualityLabel(h.quality_score)}
                      </span>
                    )}
                  </div>
                </td>

                {/* PERIOD */}
                <td style={{ padding: '7px 8px' }}>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 12,
                    color: 'var(--mist)',
                  }}>
                    {toPeriod(h.wave_period_s)}
                  </span>
                </td>

                {/* SWELL DIR */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <WindArrow deg={swellDir} size={12} color='#06B6D4' />
                    <span style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: 'var(--mist)',
                    }}>
                      {toShortCompass(swellDir)}
                      {swellDir != null && (
                        <span style={{ color: 'var(--deep-text)', marginLeft: 3 }}>
                          {Math.round(swellDir)}°
                        </span>
                      )}
                    </span>
                  </div>
                </td>

                {/* WIND */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <WindArrow deg={h.wind_direction} size={12} color='#F59E0B' />
                    <span style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: 'var(--mist)',
                    }}>
                      {toKt(h.wind_speed_ms)}
                      <span style={{ color: 'var(--deep-text)' }}>{windGust}</span>
                    </span>
                  </div>
                </td>

                {/* TIDE */}
                <td style={{ padding: '7px 8px', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <TideIcon state={h.tide_state} />
                    <span style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: 'var(--mist)',
                    }}>
                      {h.tide_height_m != null
                        ? `${(h.tide_height_m * M_TO_FT).toFixed(1)}ft`
                        : '--'}
                    </span>
                    {h.tide_state && (
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 8,
                        color: 'var(--deep-text)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}>
                        {h.tide_state}
                      </span>
                    )}
                  </div>
                </td>

                {/* CROWD */}
                <td style={{ padding: '7px 8px' }}>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: crowdColor(h.crowd_label, h.crowd_score),
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}>
                    {h.crowd_label ?? (h.crowd_score != null ? `${(h.crowd_score * 100).toFixed(0)}%` : '--')}
                  </span>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function ForecastTimeline({ hours }: { hours: ForecastHour[] }) {
  const [selectedDayIdx, setSelectedDayIdx] = useState(0)
  // Initialize to 0 (epoch) so nothing is highlighted as "current" during SSR.
  // Set to real Date.now() on client after mount.
  const [clientNow, setClientNow] = useState(0)

  useEffect(() => {
    setClientNow(Date.now())
  }, [])

  const days = useMemo(() => groupByDay(hours), [hours])

  if (hours.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '48px 0',
        color: 'var(--deep-text)',
        fontFamily: 'var(--font-data)',
        fontSize: 13,
      }}>
        No forecast data available
      </div>
    )
  }

  const safeIdx   = Math.min(selectedDayIdx, days.length - 1)
  const activeDay = days[safeIdx]
  if (!activeDay) return null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Day selector tabs ── */}
      <div style={{
        display: 'flex',
        gap: 6,
        overflowX: 'auto',
        paddingBottom: 2,
        scrollbarWidth: 'none',
      }}>
        {days.map((group, i) => (
          <DayTab
            key={group.key}
            group={group}
            isActive={i === safeIdx}
            onClick={() => setSelectedDayIdx(i)}
          />
        ))}
      </div>

      {/* ── Selected day panel ── */}
      <div style={{
        background: 'rgba(6,13,26,0.5)',
        border: '1px solid rgba(6,182,212,0.08)',
        borderRadius: 12,
        padding: '14px 12px',
      }}>
        {/* Day heading row */}
        <div style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 6,
        }}>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--foam)',
          }}>
            {activeDay.label.weekday} · {activeDay.label.date}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeDay.peakScore > 0 && (
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: qualityColor(activeDay.peakScore),
                background: `${qualityColor(activeDay.peakScore)}14`,
                border: `1px solid ${qualityColor(activeDay.peakScore)}30`,
                padding: '2px 8px',
                borderRadius: 6,
                fontWeight: 700,
                letterSpacing: '0.06em',
              }}>
                PEAK {activeDay.peakScore.toFixed(1)}
              </span>
            )}
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 10,
              color: 'var(--spray)',
            }}>
              max {toFt(activeDay.peakHeight)}
            </span>
          </div>
        </div>

        {/* Wave height bar chart */}
        <WaveBarChart hours={activeDay.hours} clientNow={clientNow} />

        {/* Hourly detail table */}
        <HourlyTable hours={activeDay.hours} clientNow={clientNow} />

        {/* Swell breakdown */}
        <SwellBreakdown hours={activeDay.hours} />
      </div>
    </div>
  )
}
