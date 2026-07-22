'use client'

/**
 * StokeScore — Animated SVG ring showing 0-100 personalized peak score.
 * Below the ring: 5 component bar chart (height, period, direction, wind, crowd).
 */

interface StokeComponents {
  height: number
  period: number
  direction: number
  wind: number
  crowd: number
}

interface StokeScoreProps {
  score: number           // 0-100
  label: string           // e.g. "FIRING"
  emoji: string           // e.g. "🔥"
  components: StokeComponents
  isPersonalized?: boolean
  size?: number
}

function scoreColor(score: number): string {
  if (score >= 80) return '#DC2626'   // red (FIRING)
  if (score >= 65) return '#EA580C'   // orange (PUMPING)
  if (score >= 50) return '#16A34A'   // green (FUN)
  if (score >= 35) return '#2563EB'   // blue (WORTH IT)
  return '#64748B'                     // gray (FLAT)
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 flex-shrink-0 capitalize" style={{ color: 'var(--spray)' }}>{label}</span>
      <div className="flex-1 rounded-full h-1.5 overflow-hidden" style={{ background: 'var(--tile-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
      <span className="w-8 text-right" style={{ color: 'var(--deep-text)' }}>{Math.round(value)}</span>
    </div>
  )
}

export default function StokeScore({
  score,
  label,
  emoji,
  components,
  isPersonalized = false,
  size = 120,
}: StokeScoreProps) {
  const radius = (size - 16) / 2
  const circumference = 2 * Math.PI * radius
  const progress = Math.min(100, Math.max(0, score))
  const dashOffset = circumference * (1 - progress / 100)
  const color = scoreColor(score)

  const componentEntries: [string, number][] = [
    ['height', components.height],
    ['period', components.period],
    ['direction', components.direction],
    ['wind', components.wind],
    ['crowd', components.crowd],
  ]

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Ring with glow */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="-rotate-90"
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--tile-border)"
            strokeWidth={10}
          />
          {/* Progress */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={10}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            className="transition-all duration-700"
          />
        </svg>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black leading-none" style={{ color: 'var(--foam)' }}>
            {Math.round(score)}
          </span>
          <span className="text-sm mt-0.5">{emoji}</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <div className="font-black text-sm tracking-wider" style={{ color }}>{label}</div>
        <div className="text-xs mt-0.5" style={{ color: 'var(--spray)' }}>
          {isPersonalized ? 'Your peak score' : 'General quality'}
        </div>
      </div>

      {/* Component bars */}
      <div className="w-full space-y-2">
        {componentEntries.map(([key, val]) => (
          <ComponentBar key={key} label={key} value={val} color={color} />
        ))}
      </div>
    </div>
  )
}
