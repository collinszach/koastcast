'use client'

/**
 * Conditions Intelligence Card
 *
 * Always-visible plain-English "what does this mean for you" summary.
 * No NLQ interaction required — displayed automatically on every spot page.
 *
 * Design goal: a surfer checking their phone at 5:30am should read this and
 * know in 10 seconds whether to get in the van.
 */

import type { ConditionsIntelligence as CIData } from '@/lib/conditions-intelligence'

interface Props {
  data: CIData
  spotName: string
}

const ASSESSMENT_CONFIG = {
  firing:   { bg: 'bg-red-950/60',    border: 'border-red-800',    dot: 'bg-red-400',    label: 'FIRING',   text: 'text-red-300'    },
  pumping:  { bg: 'bg-orange-950/60', border: 'border-orange-800', dot: 'bg-orange-400', label: 'PUMPING',  text: 'text-orange-300' },
  fun:      { bg: 'bg-green-950/60',  border: 'border-green-800',  dot: 'bg-green-400',  label: 'FUN',      text: 'text-green-300'  },
  worth_it: { bg: 'bg-blue-950/60',   border: 'border-blue-800',   dot: 'bg-blue-400',   label: 'WORTH IT', text: 'text-blue-300'   },
  flat:     { bg: 'bg-gray-900/60',   border: 'border-gray-700',   dot: 'bg-gray-500',   label: 'FLAT',     text: 'text-gray-400'   },
}

function formatWindowTime(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffH = Math.round((d.getTime() - now.getTime()) / 3600000)

  if (diffH < 0) return 'now'
  if (diffH < 1) return 'in under an hour'
  if (diffH < 24) {
    const h = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    return `today at ${h}`
  }
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const h = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  return `${days[d.getDay()]} at ${h}`
}

export default function ConditionsIntelligence({ data, spotName }: Props) {
  const cfg = ASSESSMENT_CONFIG[data.overallAssessment]

  return (
    <div className={`rounded-2xl border p-5 ${cfg.bg} ${cfg.border}`}>
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} mt-0.5`} />
          <span className={`text-xs font-bold tracking-widest ${cfg.text}`}>{cfg.label}</span>
        </div>
        <span className="text-xs text-gray-500">Conditions brief</span>
      </div>

      {/* Headline */}
      <h3 className="text-white font-semibold text-base leading-snug mb-3">
        {data.headline}
      </h3>

      {/* Summary */}
      <p className="text-gray-300 text-sm leading-relaxed mb-4">
        {data.summary}
      </p>

      {/* Key factors */}
      {data.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.keyFactors.map((factor, i) => (
            <span
              key={i}
              className="text-xs bg-gray-800 text-gray-300 px-2.5 py-1 rounded-full border border-gray-700"
            >
              {factor}
            </span>
          ))}
        </div>
      )}

      {/* Best window highlight */}
      {data.bestWindow && (
        <div className="bg-gray-900/70 rounded-xl border border-gray-700 px-4 py-3 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-gray-400 mb-0.5">Best window</div>
              <div className="text-white font-medium text-sm">
                {formatWindowTime(data.bestWindow.start)}
              </div>
              <div className="text-gray-400 text-xs mt-0.5">{data.bestWindow.reason}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">score</div>
              <div className={`font-bold text-lg ${cfg.text}`}>
                {data.bestWindow.quality.toFixed(1)}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Warning signs */}
      {data.warningSigns.length > 0 && (
        <div className="space-y-1.5 mb-3">
          {data.warningSigns.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-amber-300">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Confidence note */}
      {data.confidenceNote && (
        <div className="text-xs text-gray-500 pt-2 border-t border-gray-800">
          {data.confidenceNote}
        </div>
      )}
    </div>
  )
}
