'use client'

/**
 * OptimalWindows — Calendar heatmap + ranked window cards.
 * Shows the top surf windows for the next 14 days.
 * Premium feature (pro/explorer).
 */

import { useState, useEffect } from 'react'

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

interface OptimalWindowsProps {
  spotId: string
  spotName: string
  isPremium?: boolean
}

function scoreColor(score: number): string {
  if (score >= 80) return '#DC2626'
  if (score >= 65) return '#EA580C'
  if (score >= 50) return '#16A34A'
  if (score >= 35) return '#2563EB'
  return '#64748B'
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-red-500/20 border-red-500/40'
  if (score >= 65) return 'bg-orange-500/20 border-orange-500/40'
  if (score >= 50) return 'bg-green-500/20 border-green-500/40'
  if (score >= 35) return 'bg-blue-500/20 border-blue-500/40'
  return 'bg-[var(--paper-sunken)] border-[var(--tile-border-strong)]'
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en', { hour: 'numeric', minute: '2-digit', hour12: true })
}

function formatDay(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })
}

// Build 14-day calendar grid with peak scores per day
function buildCalendarDays(windows: OptimalWindow[], today: Date) {
  const days: Array<{ date: Date; dateStr: string; peakScore: number | null }> = []
  for (let i = 0; i < 14; i++) {
    const d = new Date(today)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    const dayWindows = windows.filter(w => w.start_time.startsWith(dateStr))
    const peakScore = dayWindows.length > 0 ? Math.max(...dayWindows.map(w => w.peak_score)) : null
    days.push({ date: d, dateStr, peakScore })
  }
  return days
}

export default function OptimalWindows({ spotId, spotName, isPremium = true }: OptimalWindowsProps) {
  const [windows, setWindows] = useState<OptimalWindow[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const today = new Date()

  useEffect(() => {
    fetch(`/api/optimal?spot_id=${spotId}&days=14`)
      .then(r => r.json())
      .then(data => {
        setWindows(data.windows || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [spotId, isPremium])

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-6 animate-pulse">
        <div className="h-5 rounded w-40 mb-4 bg-[var(--tile-border)]" />
        <div className="grid grid-cols-7 gap-1 mb-4">
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} className="h-10 rounded bg-[var(--tile-border)]" />
          ))}
        </div>
      </div>
    )
  }

  const calDays = buildCalendarDays(windows, today)
  const selectedWindows = selectedDay
    ? windows.filter(w => w.start_time.startsWith(selectedDay))
    : windows.slice(0, 5)

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-[var(--foam)]">Optimal Windows</h2>
        <span className="text-xs text-[var(--deep-text)]">next 14 days</span>
      </div>

      {/* 14-day calendar heatmap */}
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-xs text-[var(--deep-text)]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map(({ date, dateStr, peakScore }) => {
            const isToday = dateStr === today.toISOString().split('T')[0]
            const isSelected = selectedDay === dateStr
            const hasWindows = peakScore !== null

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs transition-all border ${
                  isSelected ? 'ring-1 ring-[var(--cyan)]' : ''
                } ${hasWindows ? scoreBg(peakScore!) : 'bg-[var(--paper-sunken)] border-[var(--tile-border)]'}`}
              >
                <span className={`font-medium ${isToday ? 'text-[var(--foam)]' : 'text-[var(--spray)]'}`}>
                  {date.getDate()}
                </span>
                {hasWindows && (
                  <span className="font-bold" style={{ color: scoreColor(peakScore!), fontSize: 9 }}>
                    {Math.round(peakScore!)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Window list */}
      <div className="space-y-2">
        {selectedWindows.length === 0 ? (
          <p className="text-[var(--deep-text)] text-sm text-center py-3">
            {selectedDay ? 'No optimal windows on this day.' : 'No high-scoring windows in the next 14 days.'}
          </p>
        ) : (
          <>
            {selectedDay && (
              <div className="text-xs text-[var(--spray)] mb-2">
                {formatDay(selectedDay + 'T00:00')}
              </div>
            )}
            {selectedWindows.map((w, i) => (
              <div
                key={i}
                className={`border rounded-xl p-3.5 ${scoreBg(w.peak_score)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[var(--foam)] text-sm font-semibold">
                        {formatTime(w.start_time)} – {formatTime(w.end_time)}
                      </span>
                      <span className="text-[var(--spray)] text-xs">
                        {w.duration_hours}h · {formatDay(w.start_time)}
                      </span>
                    </div>
                    <p className="text-[var(--mist)] text-xs mt-1">{w.reason}</p>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-[var(--deep-text)]">
                      {w.peak_wave_height_ft != null && (
                        <span>🌊 {w.peak_wave_height_ft}ft</span>
                      )}
                      {w.peak_wave_period_s != null && (
                        <span>@ {w.peak_wave_period_s.toFixed(0)}s</span>
                      )}
                      {w.peak_wind_speed_kt != null && (
                        <span>💨 {w.peak_wind_speed_kt.toFixed(0)}kt</span>
                      )}
                      <span className={`
                        ${w.crowd_level === 'empty' || w.crowd_level === 'uncrowded' ? 'text-green-700' : ''}
                        ${w.crowd_level === 'crowded' || w.crowd_level === 'very crowded' ? 'text-red-700' : ''}
                      `}>
                        👥 {w.crowd_level}
                      </span>
                    </div>
                  </div>
                  {/* Score ring */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-black" style={{ color: scoreColor(w.peak_score) }}>
                      {Math.round(w.peak_score)}
                    </div>
                    <div className="text-xs text-[var(--deep-text)]">score</div>
                  </div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
