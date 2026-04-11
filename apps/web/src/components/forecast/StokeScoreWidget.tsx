'use client'

/**
 * StokeScoreWidget — fetches user preferences from Supabase,
 * POSTs to /api/v1/stoke, renders StokeScore ring.
 *
 * Falls back to a generic quality-score display if not authenticated
 * or if the NUC API is unavailable.
 */

import { useEffect, useState } from 'react'
import StokeScore from './StokeScore'
import type { ForecastHour } from '@/types'
import { getConditionLabel } from '@/types'

interface StokeScoreWidgetProps {
  spotId: string
  spotName: string
  currentHour?: ForecastHour
}

interface StokeResult {
  stoke_score: number
  label: string
  emoji: string
  components: {
    height: number
    period: number
    direction: number
    wind: number
    crowd: number
  }
  is_personalized: boolean
}

function qualityToStokeProxy(qualityScore?: number | null): StokeResult {
  // Map 0-10 quality score → 0-100 peak score for generic display
  const score = (qualityScore ?? 5) * 10
  const label = getConditionLabel(qualityScore)
  const LABELS: Record<string, string> = {
    firing: 'FIRING', pumping: 'PUMPING', fun: 'FUN',
    worth_it: 'WORTH IT', flat: 'FLAT SPELL', no_data: 'UNKNOWN',
  }
  const EMOJIS: Record<string, string> = {
    firing: '🔥', pumping: '🤙', fun: '😎',
    worth_it: '🏄', flat: '😴', no_data: '?',
  }
  return {
    stoke_score: score,
    label: LABELS[label],
    emoji: EMOJIS[label],
    components: { height: score, period: score, direction: score, wind: score, crowd: score },
    is_personalized: false,
  }
}

export default function StokeScoreWidget({ spotId, spotName, currentHour }: StokeScoreWidgetProps) {
  const [result, setResult] = useState<StokeResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStoke() {
      try {
        const res = await fetch('/api/stoke', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spot_id: spotId }),
        })

        if (!res.ok) throw new Error('API error')
        const data = await res.json()
        setResult(data)
      } catch {
        // Fall back to quality score proxy
        setResult(qualityToStokeProxy(currentHour?.quality_score))
      } finally {
        setLoading(false)
      }
    }

    fetchStoke()
  }, [spotId, currentHour?.quality_score])

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 animate-pulse">
        <div className="w-28 h-28 rounded-full bg-gray-800" />
        <div className="w-16 h-3 bg-gray-800 rounded" />
        <div className="w-full space-y-1.5">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-2 bg-gray-800 rounded" />)}
        </div>
      </div>
    )
  }

  if (!result) {
    return <div className="text-gray-500 text-sm text-center py-4">Stoke score unavailable</div>
  }

  return (
    <StokeScore
      score={result.stoke_score}
      label={result.label}
      emoji={result.emoji}
      components={result.components}
      isPersonalized={result.is_personalized}
      size={120}
    />
  )
}
