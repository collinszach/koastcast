'use client'

/**
 * WeekQualityBar — 7-day quality overview with scroll-to-day navigation.
 * Shows peak quality score per day as a colored bar. Clicking a day
 * scrolls to that day's section in the ForecastTimeline.
 */

import type { ForecastHour } from '@/types'

interface DaySummary {
  label: string        // "Mon"
  date: string         // "Mar 18"
  peakScore: number    // 0-10
  avgScore: number
  peakHeightFt: number | null
  dayIndex: number     // 0-6 for scroll ID
}

interface WeekQualityBarProps {
  hours: ForecastHour[]
}

function buildDaySummaries(hours: ForecastHour[]): DaySummary[] {
  const dayMap = new Map<string, { hours: ForecastHour[]; index: number }>()
  let dayIndex = 0

  for (const h of hours) {
    const d = new Date(h.forecast_time)
    const key = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    if (!dayMap.has(key)) {
      dayMap.set(key, { hours: [], index: dayIndex++ })
    }
    dayMap.get(key)!.hours.push(h)
  }

  return Array.from(dayMap.entries()).slice(0, 7).map(([key, { hours: dayHours, index }]) => {
    const scores = dayHours.map(h => h.quality_score ?? 0)
    const peakScore = Math.max(...scores)
    const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length
    const peakHour = dayHours.find(h => h.quality_score === peakScore)
    const peakHeightM = peakHour?.wave_height_face_m ?? peakHour?.wave_height_m
    const parts = key.split(' ')

    return {
      label: parts[0],
      date: parts.slice(1).join(' '),
      peakScore,
      avgScore,
      peakHeightFt: peakHeightM != null ? Math.round(peakHeightM * 3.281) : null,
      dayIndex: index,
    }
  })
}

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--q-firing)'
  if (score >= 6) return 'var(--q-pumping)'
  if (score >= 4) return 'var(--q-good)'
  if (score >= 2) return 'var(--q-ok)'
  return 'var(--q-flat)'
}

function scoreBg(score: number): string {
  if (score >= 8) return 'rgba(234,88,12,0.1)'
  if (score >= 6) return 'rgba(8,145,178,0.1)'
  if (score >= 4) return 'rgba(37,99,235,0.1)'
  if (score >= 2) return 'rgba(79,70,229,0.1)'
  return 'var(--paper-sunken)'
}

function scoreBorder(score: number): string {
  if (score >= 8) return 'rgba(234,88,12,0.25)'
  if (score >= 6) return 'rgba(8,145,178,0.25)'
  if (score >= 4) return 'rgba(37,99,235,0.25)'
  if (score >= 2) return 'rgba(79,70,229,0.25)'
  return 'var(--tile-border-strong)'
}

function scoreLabel(score: number): string {
  if (score >= 8) return 'FIRING'
  if (score >= 6) return 'PUMPING'
  if (score >= 4) return 'FUN'
  if (score >= 2) return 'OK'
  return 'FLAT'
}

export default function WeekQualityBar({ hours }: WeekQualityBarProps) {
  const days = buildDaySummaries(hours)
  if (!days.length) return null

  // Check if today is represented
  const todayStr = new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

  function scrollToDay(index: number) {
    const el = document.getElementById(`forecast-day-${index}`)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const maxScore = Math.max(...days.map(d => d.peakScore), 1)

  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--tile-bg)', border: '1px solid var(--tile-border)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--spray)' }}>7-Day Overview</h3>
        <span className="text-[10px]" style={{ color: 'var(--deep-text)' }}>tap day to jump</span>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const color = scoreColor(day.peakScore)
          const bg = scoreBg(day.peakScore)
          const border = scoreBorder(day.peakScore)
          const barH = Math.max(6, Math.round((day.peakScore / maxScore) * 48))
          const isToday = day.label === todayStr.split(' ')[0]

          return (
            <button
              key={day.dayIndex}
              onClick={() => scrollToDay(day.dayIndex)}
              className="group flex flex-col items-center gap-1 rounded-xl p-2 transition-all hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-sky-500/50"
              style={{ background: bg, border: `1px solid ${border}` }}
            >
              <span className="text-[10px] font-bold" style={{ color: isToday ? 'var(--foam)' : 'var(--spray)' }}>
                {day.label}
              </span>
              <span className="text-[9px] leading-none" style={{ color: 'var(--deep-text)' }}>{day.date}</span>

              {/* Bar */}
              <div className="w-full flex items-end justify-center mt-1" style={{ height: 52 }}>
                <div
                  className="w-4/5 rounded-t-md transition-all"
                  style={{ height: barH, background: color }}
                />
              </div>

              {/* Score */}
              <span className="text-[12px] font-black leading-none" style={{ color }}>
                {day.peakScore.toFixed(1)}
              </span>
              <span className="text-[8px] font-bold uppercase tracking-wider leading-none" style={{ color }}>
                {scoreLabel(day.peakScore)}
              </span>

              {/* Wave height */}
              {day.peakHeightFt != null && (
                <span className="text-[9px] mt-0.5" style={{ color: 'var(--spray)' }}>{day.peakHeightFt}ft</span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
