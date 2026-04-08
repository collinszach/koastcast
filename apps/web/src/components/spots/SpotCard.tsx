'use client'

import { useRef } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import type { Spot } from '@/types'
import { formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow, getConditionLabel } from '@/types'
import { useSavedSpots } from '@/lib/useSavedSpots'

interface SpotCardProps {
  spot: Spot
}

const CONDITION_STYLES: Record<string, { accent: string; color: string; bg: string; border: string; label: string }> = {
  firing:   { accent: '#F97316', color: '#F97316', bg: 'rgba(249,115,22,0.08)',  border: 'rgba(249,115,22,0.2)',  label: '🔥 FIRING'   },
  pumping:  { accent: '#06B6D4', color: '#06B6D4', bg: 'rgba(6,182,212,0.08)',   border: 'rgba(6,182,212,0.2)',   label: '🤙 PUMPING'  },
  fun:      { accent: '#3B82F6', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.2)',  label: '😎 FUN'      },
  worth_it: { accent: '#6366F1', color: '#6366F1', bg: 'rgba(99,102,241,0.08)',  border: 'rgba(99,102,241,0.2)',  label: '🏄 WORTH IT' },
  flat:     { accent: '#334155', color: '#475569', bg: 'rgba(30,42,60,0.4)',     border: 'rgba(51,65,85,0.3)',    label: 'FLAT'        },
  no_data:  { accent: '#1E2A3C', color: '#2E5568', bg: 'rgba(15,22,36,0.4)',     border: 'rgba(30,42,60,0.3)',    label: 'NO DATA'     },
}

export default function SpotCard({ spot }: SpotCardProps) {
  const label = getConditionLabel(spot.current_conditions?.quality_score)
  const s = CONDITION_STYLES[label] ?? CONDITION_STYLES.no_data
  const cc = spot.current_conditions
  const { isSaved, toggle } = useSavedSpots()
  const saved = isSaved('spots', spot.slug)
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleBookmark(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    toggle('spots', spot.slug)
    // Scale pulse animation
    const el = btnRef.current
    if (!el) return
    el.style.transform = 'scale(0.8)'
    requestAnimationFrame(() => {
      el.style.transition = 'transform 0.15s ease'
      el.style.transform = 'scale(1.1)'
      setTimeout(() => { el.style.transform = 'scale(1.0)' }, 150)
    })
  }

  return (
    <Link href={`/spot/${spot.slug}`} className="block group">
      <div
        className="relative rounded-xl overflow-hidden transition-all duration-200"
        style={{
          background: 'rgba(6, 12, 24, 0.85)',
          border: `1px solid rgba(6,182,212,0.08)`,
          boxShadow: `0 2px 16px rgba(0,0,0,0.3)`,
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'translateY(-2px) scale(1.01)'
          e.currentTarget.style.borderColor = `rgba(6,182,212,0.18)`
          e.currentTarget.style.boxShadow = `0 6px 24px rgba(0,0,0,0.4)`
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ''
          e.currentTarget.style.borderColor = 'rgba(6,182,212,0.08)'
          e.currentTarget.style.boxShadow = '0 2px 16px rgba(0,0,0,0.3)'
        }}
      >
        {/* Left condition accent */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
             style={{ background: `linear-gradient(180deg, ${s.accent}cc, ${s.accent}40)` }} />

        <div style={{ paddingLeft: 16, paddingRight: 12, paddingTop: 11, paddingBottom: 11 }}>
          {/* Header row */}
          <div className="flex items-start justify-between gap-2 mb-2.5">
            <div className="min-w-0">
              <h3 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--foam)',
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }} className="group-hover:[color:var(--cyan-bright)]">
                {spot.name}
              </h3>
              <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', marginTop: 2, letterSpacing: '0.04em' }}>
                {spot.region}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 9,
                fontWeight: 700,
                color: s.color,
                background: s.bg,
                border: `1px solid ${s.border}`,
                padding: '3px 8px',
                borderRadius: 8,
                letterSpacing: '0.06em',
                whiteSpace: 'nowrap',
              }}>
                {s.label}
              </span>
              <button
                ref={btnRef}
                onClick={handleBookmark}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: saved ? '#06B6D4' : '#2E5568',
                  transition: 'color 0.15s',
                }}
                aria-label={saved ? 'Remove from saved' : 'Save spot'}
              >
                <Bookmark
                  size={14}
                  style={{
                    fill: saved ? '#06B6D4' : 'none',
                    stroke: saved ? '#06B6D4' : '#2E5568',
                    transition: 'fill 0.15s, stroke 0.15s',
                  }}
                />
              </button>
            </div>
          </div>

          {/* Conditions grid — JetBrains Mono for all numbers */}
          {cc?.wave_height_face_m != null ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, textAlign: 'center', marginBottom: 10 }}>
              {[
                { value: formatWaveHeight(cc.wave_height_face_m),                                      label: 'HT'   },
                { value: formatPeriod(cc.wave_period_s),                                               label: 'PD'   },
                { value: cc.wind_speed_ms != null ? formatWindSpeed(cc.wind_speed_ms) : '—',          label: 'WIND' },
                { value: directionArrow(cc.wave_direction),                                            label: 'DIR'  },
              ].map(({ value, label: lbl }) => (
                <div key={lbl}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 15, fontWeight: 600, color: 'var(--foam)', lineHeight: 1 }}>
                    {value}
                  </div>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 8, color: 'var(--deep-text)', letterSpacing: '0.12em', marginTop: 3 }}>
                    {lbl}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', textAlign: 'center', padding: '10px 0', letterSpacing: '0.06em' }}>
              Loading forecast...
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-2"
               style={{ borderTop: '1px solid rgba(6,182,212,0.07)', fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.06em' }}>
            <div className="flex items-center gap-1.5">
              <span style={{ textTransform: 'capitalize' }}>{spot.break_type}</span>
              {spot.skill_minimum && (
                <>
                  <span>·</span>
                  <span style={{ textTransform: 'capitalize' }}>{spot.skill_minimum}+</span>
                </>
              )}
              {spot.swan_enabled && (
                <span style={{ color: 'var(--cyan)', fontWeight: 600 }}>⚡ PHYSICS</span>
              )}
            </div>
            {cc?.wind_speed_ms != null && (
              <span style={{ color: 'var(--spray)' }}>
                {directionArrow(cc.wind_direction)} {formatWindSpeed(cc.wind_speed_ms)}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  )
}
