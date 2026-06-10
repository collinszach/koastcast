'use client'

/**
 * TrustRing — Koastcast's claim to fame, made visible.
 *
 * A 0-100 "how much should I trust this forecast?" ring. The stroke is solid
 * when we're confident and progressively dashed/faded as trust drops — you can
 * *see* the model losing certainty. Tap "Why?" to reveal the factors:
 * model agreement, prediction confidence, data freshness, and lead time.
 *
 * No other consumer surf app shows users how much to trust the number.
 */

import { useState } from 'react'
import type { TrustLabel } from '@/types'

interface TrustRingProps {
  score: number // 0-100
  label?: TrustLabel | string
  factors?: Record<string, number> | null // normalized 0-1
  limitingFactor?: string | null
  size?: number
  showWhy?: boolean
}

const FACTOR_META: Record<string, { label: string; blurb: string }> = {
  agreement: { label: 'Model agreement', blurb: 'How closely ECMWF, GFS & ICON agree' },
  confidence: { label: 'Local confidence', blurb: 'Bias-model certainty for this break' },
  freshness: { label: 'Data freshness', blurb: 'How recent the live buoy reading is' },
  lead: { label: 'Lead time', blurb: 'Forecasts degrade further out' },
  historical_skill: { label: 'Track record', blurb: "This spot's verified accuracy" },
}

function trustColor(score: number): string {
  if (score >= 80) return '#22d3ee' // cyan — high trust (on-brand)
  if (score >= 60) return '#34d399' // emerald — good
  if (score >= 40) return '#fbbf24' // amber — moderate
  if (score >= 20) return '#fb923c' // orange — low
  return '#f87171' // red — speculative
}

/** Dash pattern: solid when sure, increasingly broken as trust drops. */
function dashArray(score: number, circumference: number): string | undefined {
  if (score >= 80) return undefined // solid
  // shorter dashes + bigger gaps the lower the trust
  const t = Math.max(0, Math.min(1, score / 80))
  const dash = 4 + 14 * t
  const gap = 10 - 7 * t
  return `${dash.toFixed(1)} ${gap.toFixed(1)}`
}

function FactorBar({ name, value }: { name: string; value: number }) {
  const meta = FACTOR_META[name] ?? { label: name, blurb: '' }
  const pct = Math.round(value * 100)
  const color = trustColor(pct)
  return (
    <div className="flex items-center gap-2 text-xs" title={meta.blurb}>
      <span className="text-gray-400 w-28 flex-shrink-0">{meta.label}</span>
      <div className="flex-1 bg-white/5 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-gray-500 w-8 text-right tabular-nums">{pct}</span>
    </div>
  )
}

export default function TrustRing({
  score,
  label,
  factors,
  limitingFactor,
  size = 96,
  showWhy = true,
}: TrustRingProps) {
  const [open, setOpen] = useState(false)
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(100, Math.max(0, score))
  const dashOffset = circumference * (1 - progress / 100)
  const color = trustColor(score)
  // Glow softens as trust drops — confident forecasts feel solid, shaky ones feel hazy.
  const glow = Math.round((score / 100) * 12)
  const opacity = 0.5 + 0.5 * (score / 100)

  const limitMeta = limitingFactor ? FACTOR_META[limitingFactor] : undefined

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
          style={{ filter: `drop-shadow(0 0 ${glow}px ${color}55)` }}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={8}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={dashArray(score, circumference) ?? circumference}
            strokeDashoffset={dashArray(score, circumference) ? 0 : dashOffset}
            style={{ opacity }}
            className="transition-all duration-700"
          />
          {/* When dashed, draw an underlay arc to still convey the fill level */}
          {dashArray(score, circumference) && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ opacity: 0.12 }}
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span
            className="text-2xl font-black text-white leading-none tabular-nums"
            style={{ textShadow: `0 0 16px ${color}55` }}
          >
            {Math.round(score)}
          </span>
          <span className="text-[9px] uppercase tracking-widest text-gray-500 mt-0.5">
            Trust
          </span>
        </div>
      </div>

      <div className="text-center">
        <div className="font-bold text-xs tracking-wider" style={{ color }}>
          {label ?? ''} confidence
        </div>
        {limitMeta && score < 80 && (
          <div className="text-[10px] text-gray-500 mt-0.5">
            Limited by {limitMeta.label.toLowerCase()}
          </div>
        )}
      </div>

      {showWhy && factors && Object.keys(factors).length > 0 && (
        <div className="w-full">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-[11px] text-cyan-400/80 hover:text-cyan-300 transition-colors"
          >
            {open ? 'Hide' : 'Why?'}
          </button>
          {open && (
            <div className="mt-2 space-y-1.5">
              {Object.entries(factors).map(([name, value]) => (
                <FactorBar key={name} name={name} value={value} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
