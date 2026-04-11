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
  if (score >= 80) return '#ef4444'   // red (FIRING)
  if (score >= 65) return '#f97316'   // orange (PUMPING)
  if (score >= 50) return '#22c55e'   // green (FUN)
  if (score >= 35) return '#3b82f6'   // blue (WORTH IT)
  return '#6b7280'                     // gray (FLAT)
}

function ComponentBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-gray-500 w-16 flex-shrink-0 capitalize">{label}</span>
      <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-gray-400 w-8 text-right">{Math.round(value)}</span>
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
          style={{ filter: `drop-shadow(0 0 10px ${color}50)` }}
        >
          {/* Track */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
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
          <span className="text-3xl font-black text-white leading-none" style={{ textShadow: `0 0 20px ${color}60` }}>
            {Math.round(score)}
          </span>
          <span className="text-sm mt-0.5">{emoji}</span>
        </div>
      </div>

      {/* Label */}
      <div className="text-center">
        <div className="font-black text-sm tracking-wider" style={{ color }}>{label}</div>
        <div className="text-xs text-gray-500 mt-0.5">
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
