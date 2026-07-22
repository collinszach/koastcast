'use client'

/**
 * Swell Event Tracker
 *
 * Shows named upcoming swell events from the 16-day forecast.
 * Surfers watch building events from 10+ days out — this is the feature
 * that drives the 10-20 check/day obsessive habit documented in our research.
 *
 * Each event has: name, confidence level, days away, size, period, direction,
 * and whether it's a good angle for this spot.
 */

import { useEffect, useState } from 'react'

interface SwellEvent {
  id: string
  name: string
  origin: string
  start_time: string
  peak_time: string
  end_time: string
  peak_height_m: number
  peak_height_ft: number
  peak_period_s: number
  peak_direction: number
  peak_direction_str: string
  confidence: 'high' | 'medium' | 'low' | 'speculative'
  confidence_note: string
  score: number
  days_away: number
  duration_h: number
  direction_fit: string | null
}

interface SwellData {
  spot_name: string
  events: SwellEvent[]
  has_significant_events: boolean
}

interface Props {
  spotId: string
}

const CONFIDENCE_CONFIG = {
  high:       { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200',  label: 'HIGH' },
  medium:     { color: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', label: 'MEDIUM' },
  low:        { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', label: 'LOW' },
  speculative:{ color: 'text-[var(--spray)]',   bg: 'bg-[var(--paper-sunken)]',   border: 'border-[var(--tile-border-strong)]',   label: '?' },
}

const ORIGIN_EMOJI: Record<string, string> = {
  north_pacific:      '🌊',
  south_pacific:      '🏄',
  northwest:          '🌊',
  southwest:          '🏄',
  northwest_atlantic: '🌊',
  southeast:          '🌀',
  hurricane:          '🌀',
  local_wind:         '💨',
  unknown:            '🌊',
}

function formatDaysAway(days: number): string {
  if (days < 1) return 'arriving now'
  if (days < 2) return 'tomorrow'
  return `in ${Math.round(days)} days`
}

function formatPeakTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) +
    ' ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

export default function SwellTracker({ spotId }: Props) {
  const [data, setData] = useState<SwellData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/swell-events?spotId=${encodeURIComponent(spotId)}&days=16`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [spotId])

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 bg-[var(--paper-sunken)] rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data || data.events.length === 0) {
    return (
      <div className="text-center py-6 text-[var(--spray)] text-sm">
        <div className="text-2xl mb-2">🌊</div>
        No significant swell events detected in the next 16 days.
        <div className="text-xs mt-1 text-[var(--deep-text)]">Check back — models update every 6 hours</div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-[var(--spray)] mb-1">
        <span>{data.events.length} event{data.events.length !== 1 ? 's' : ''} detected</span>
        <span>Models update every 6h</span>
      </div>

      {data.events.map(event => {
        const cfg = CONFIDENCE_CONFIG[event.confidence]
        const isExpanded = expanded === event.id
        const emoji = ORIGIN_EMOJI[event.origin] || '🌊'

        return (
          <div
            key={event.id}
            className={`rounded-xl border transition-all ${cfg.bg} ${cfg.border} overflow-hidden`}
          >
            {/* Event header — always visible */}
            <button
              onClick={() => setExpanded(isExpanded ? null : event.id)}
              className="w-full flex items-center gap-3 p-3 text-left"
            >
              {/* Emoji + size indicator */}
              <div className="text-xl shrink-0">{emoji}</div>

              {/* Main info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[var(--foam)] font-medium text-sm">{event.name}</span>
                  <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                </div>
                <div className="text-[var(--spray)] text-xs mt-0.5">
                  {formatDaysAway(event.days_away)} · {event.peak_height_ft}ft @ {event.peak_period_s}s · {event.peak_direction_str}
                </div>
              </div>

              {/* Score + expand arrow */}
              <div className="text-right shrink-0">
                <div className={`font-bold text-base ${cfg.color}`}>{event.score.toFixed(0)}</div>
                <div className="text-[var(--deep-text)] text-xs">score</div>
              </div>

              <span className="text-[var(--deep-text)] text-xs ml-1">{isExpanded ? '▲' : '▼'}</span>
            </button>

            {/* Expanded detail */}
            {isExpanded && (
              <div className="px-3 pb-3 space-y-3 border-t border-[var(--tile-border-strong)] pt-3">
                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-[var(--tile-bg)] rounded-lg p-2">
                    <div className="text-[var(--foam)] font-bold text-lg">{event.peak_height_ft}ft</div>
                    <div className="text-[var(--spray)] text-xs">face height</div>
                  </div>
                  <div className="bg-[var(--tile-bg)] rounded-lg p-2">
                    <div className="text-[var(--foam)] font-bold text-lg">{event.peak_period_s}s</div>
                    <div className="text-[var(--spray)] text-xs">period</div>
                  </div>
                  <div className="bg-[var(--tile-bg)] rounded-lg p-2">
                    <div className="text-[var(--foam)] font-bold text-lg">{event.peak_direction_str}</div>
                    <div className="text-[var(--spray)] text-xs">{event.peak_direction}° direction</div>
                  </div>
                </div>

                {/* Timing */}
                <div className="bg-[var(--tile-bg)] rounded-lg p-2.5 space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--spray)]">Peak</span>
                    <span className="text-[var(--foam)] font-medium">{formatPeakTime(event.peak_time)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--spray)]">Duration</span>
                    <span className="text-[var(--mist)]">{event.duration_h}h window</span>
                  </div>
                </div>

                {/* Direction fit for this spot */}
                {event.direction_fit && (
                  <div className="text-xs text-[var(--spray)] flex items-start gap-1.5">
                    <span>📐</span>
                    <span className="capitalize">{event.direction_fit}</span>
                  </div>
                )}

                {/* Confidence note */}
                <div className={`text-xs ${cfg.color} flex items-start gap-1.5`}>
                  <span>📡</span>
                  <span>{event.confidence_note}</span>
                </div>

                {/* Speculative warning */}
                {event.confidence === 'speculative' && (
                  <p className="text-xs text-[var(--spray)] italic">
                    At 10+ days out, models are still resolving this event. Check back daily
                    as the forecast refines — size and timing may shift significantly.
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}

      <p className="text-xs text-[var(--deep-text)] text-center pt-1">
        Tap an event to track its development. Confidence increases as it approaches.
      </p>
    </div>
  )
}
