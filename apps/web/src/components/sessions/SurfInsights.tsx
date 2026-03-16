'use client'

/**
 * Surf Insights Component
 *
 * Shows pattern-recognition insights from the user's session history.
 * "What conditions produce your best surfing?"
 *
 * Cards types:
 * - pattern: correlation between conditions and session quality
 * - stat: summary statistics (total sessions, avg rating, best month)
 * - board_tip: board performance in specific conditions
 * - accuracy: forecast vs. actual comparison
 * - onboarding: prompt to log first session
 */

import { useEffect, useState } from 'react'

interface InsightCard {
  type: string
  title: string
  body: string
  icon: string
  data?: Record<string, unknown>
}

interface InsightsData {
  session_count: number
  insights: InsightCard[]
}

const TYPE_COLORS: Record<string, string> = {
  pattern:   'border-blue-800 bg-blue-950/30',
  stat:      'border-gray-700 bg-gray-900/30',
  board_tip: 'border-purple-800 bg-purple-950/30',
  accuracy:  'border-cyan-800 bg-cyan-950/30',
  tip:       'border-yellow-800 bg-yellow-950/30',
  onboarding:'border-gray-700 bg-gray-900/30',
}

function MiniBarChart({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).slice(-12)
  if (entries.length === 0) return null
  const max = Math.max(...entries.map(([, v]) => v))
  return (
    <div className="flex items-end gap-1 h-12 mt-2">
      {entries.map(([label, value]) => (
        <div key={label} className="flex-1 flex flex-col items-center gap-0.5">
          <div
            className="w-full bg-blue-500/60 rounded-sm"
            style={{ height: `${(value / max) * 100}%` }}
          />
          <span className="text-gray-600 text-xs truncate w-full text-center" style={{ fontSize: '9px' }}>
            {label.slice(0, 3)}
          </span>
        </div>
      ))}
    </div>
  )
}

function SpotBreakdown({ data }: { data: Record<string, { avg: number; count: number }> }) {
  const entries = Object.entries(data).sort((a, b) => b[1].avg - a[1].avg)
  return (
    <div className="space-y-1.5 mt-2">
      {entries.map(([spot, { avg, count }]) => (
        <div key={spot} className="flex items-center gap-2">
          <span className="text-gray-400 text-xs w-32 truncate">{spot}</span>
          <div className="flex-1 bg-gray-800 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full"
              style={{ width: `${(avg / 10) * 100}%` }}
            />
          </div>
          <span className="text-gray-400 text-xs w-12 text-right">{avg}/10 ({count})</span>
        </div>
      ))}
    </div>
  )
}

function CardChart({ card }: { card: InsightCard }) {
  if (!card.data) return null

  // Monthly session count chart
  if ('monthly_counts' in card.data) {
    return <MiniBarChart data={card.data.monthly_counts as Record<string, number>} />
  }

  // Spot breakdown
  if ('spot_avgs' in card.data) {
    return <SpotBreakdown data={card.data.spot_avgs as Record<string, { avg: number; count: number }>} />
  }

  // Day of week chart
  if ('dow_avgs' in card.data) {
    return (
      <div className="flex gap-1 mt-2">
        {Object.entries(card.data.dow_avgs as Record<string, number>).map(([day, avg]) => (
          <div key={day} className="flex-1 text-center">
            <div
              className="mx-auto rounded-sm bg-blue-500/60"
              style={{ width: '100%', height: `${(avg / 10) * 40}px` }}
            />
            <span className="text-gray-600 text-xs">{day.slice(0, 2)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Crowd comparison
  if ('uncrowded_avg' in card.data && 'crowded_avg' in card.data) {
    const unc = card.data.uncrowded_avg as number
    const crd = card.data.crowded_avg as number
    return (
      <div className="flex gap-3 mt-2">
        <div className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-green-400 font-bold">{unc.toFixed(1)}</div>
          <div className="text-gray-500 text-xs">uncrowded</div>
        </div>
        <div className="flex-1 bg-gray-800 rounded-lg p-2 text-center">
          <div className="text-orange-400 font-bold">{crd.toFixed(1)}</div>
          <div className="text-gray-500 text-xs">crowded</div>
        </div>
      </div>
    )
  }

  return null
}

export default function SurfInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/insights')
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-800 rounded-xl" />
        ))}
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <div className="text-2xl mb-2">📊</div>
        Sign in to see your personalized surf insights
      </div>
    )
  }

  if (data.insights.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
        <div className="text-2xl mb-2">📔</div>
        No insights yet — log your first session to get started
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500 flex justify-between">
        <span>Based on {data.session_count} logged sessions</span>
        <span>Updates as you log more</span>
      </div>

      {data.insights.map((card, i) => (
        <div
          key={i}
          className={`rounded-xl border p-4 ${TYPE_COLORS[card.type] ?? 'border-gray-700 bg-gray-900/30'}`}
        >
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">{card.icon}</span>
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-medium text-sm leading-snug">{card.title}</h3>
              <p className="text-gray-400 text-xs leading-relaxed mt-1">{card.body}</p>
              <CardChart card={card} />
            </div>
          </div>
        </div>
      ))}

      <p className="text-xs text-gray-600 text-center pt-1">
        Log more sessions to unlock deeper pattern analysis
      </p>
    </div>
  )
}
