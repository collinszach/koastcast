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
  firing:   { bg: 'bg-orange-50',  border: 'border-orange-200', dot: 'bg-orange-600', label: 'FIRING',   text: 'text-orange-700' },
  pumping:  { bg: 'bg-cyan-50',    border: 'border-cyan-200',   dot: 'bg-cyan-600',   label: 'PUMPING',  text: 'text-cyan-700'   },
  fun:      { bg: 'bg-blue-50',    border: 'border-blue-200',   dot: 'bg-blue-600',   label: 'FUN',      text: 'text-blue-700'   },
  worth_it: { bg: 'bg-indigo-50',  border: 'border-indigo-200', dot: 'bg-indigo-600', label: 'WORTH IT', text: 'text-indigo-700' },
  flat:     { bg: 'bg-[var(--paper-sunken)]', border: 'border-[var(--tile-border-strong)]', dot: 'bg-slate-500', label: 'FLAT', text: 'text-[var(--spray)]' },
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
        <span className="text-xs text-[var(--spray)]">Conditions brief</span>
      </div>

      {/* Headline */}
      <h3 className="text-[var(--foam)] font-semibold text-base leading-snug mb-3">
        {data.headline}
      </h3>

      {/* Summary */}
      <p className="text-[var(--mist)] text-sm leading-relaxed mb-4">
        {data.summary}
      </p>

      {/* Key factors */}
      {data.keyFactors.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {data.keyFactors.map((factor, i) => (
            <span
              key={i}
              className="text-xs bg-[var(--paper-sunken)] text-[var(--mist)] px-2.5 py-1 rounded-full border border-[var(--tile-border-strong)]"
            >
              {factor}
            </span>
          ))}
        </div>
      )}

      {/* Best window highlight */}
      {data.bestWindow && (
        <div className="bg-[var(--tile-bg)] rounded-xl border border-[var(--tile-border-strong)] px-4 py-3 mb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-[var(--spray)] mb-0.5">Best window</div>
              <div className="text-[var(--foam)] font-medium text-sm">
                {formatWindowTime(data.bestWindow.start)}
              </div>
              <div className="text-[var(--spray)] text-xs mt-0.5">{data.bestWindow.reason}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-[var(--spray)]">score</div>
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
            <div key={i} className="flex items-start gap-2 text-xs text-amber-700">
              <span className="mt-0.5 shrink-0">⚠</span>
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {/* Confidence note */}
      {data.confidenceNote && (
        <div className="text-xs text-[var(--spray)] pt-2 border-t border-[var(--tile-border)]">
          {data.confidenceNote}
        </div>
      )}
    </div>
  )
}
