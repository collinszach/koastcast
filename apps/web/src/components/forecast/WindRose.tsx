'use client'

/**
 * WindRose — Polar SVG chart showing wind speed and direction over 24h.
 * Each spoke = one forecast hour, radius = wind speed, color = speed category.
 */

interface WindReading {
  direction: number   // degrees (0 = N, 90 = E, etc.)
  speed_ms: number
  time?: string
}

interface WindRoseProps {
  readings: WindReading[]
  offshoreDirection?: number  // spot's offshore wind direction (degrees)
  size?: number
}

function msToKnots(ms: number) {
  return ms * 1.944
}

function speedColor(speedMs: number): string {
  const kt = msToKnots(speedMs)
  if (kt < 5) return '#22c55e'    // light — green
  if (kt < 10) return '#84cc16'   // gentle — lime
  if (kt < 15) return '#eab308'   // moderate — yellow
  if (kt < 20) return '#f97316'   // fresh — orange
  return '#ef4444'                 // strong — red
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  // SVG: 0° = north (up), clockwise
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  }
}

export default function WindRose({
  readings,
  offshoreDirection,
  size = 200,
}: WindRoseProps) {
  if (!readings.length) {
    return (
      <div className="flex items-center justify-center text-gray-500 text-sm" style={{ height: size }}>
        No wind data available
      </div>
    )
  }

  const cx = size / 2
  const cy = size / 2
  const maxR = (size / 2) - 20

  const maxSpeed = Math.max(...readings.map(r => r.speed_ms), 1)

  // Compass ring labels
  const compassPoints = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

  return (
    <svg width={size} height={size} className="mx-auto">
      {/* Concentric rings */}
      {[0.25, 0.5, 0.75, 1.0].map(ratio => (
        <circle
          key={ratio}
          cx={cx}
          cy={cy}
          r={maxR * ratio}
          fill="none"
          stroke="var(--tile-border-strong)"
          strokeWidth={ratio === 1.0 ? 1 : 0.5}
        />
      ))}

      {/* Compass spokes */}
      {compassPoints.map((dir, i) => {
        const angle = i * 45
        const inner = polarToCartesian(cx, cy, 8, angle)
        const outer = polarToCartesian(cx, cy, maxR + 2, angle)
        const label = polarToCartesian(cx, cy, maxR + 12, angle)
        return (
          <g key={dir}>
            <line x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} stroke="var(--tile-border)" strokeWidth={0.5} />
            <text x={label.x} y={label.y + 3} textAnchor="middle" fontSize={8} fill="var(--spray)">
              {dir}
            </text>
          </g>
        )
      })}

      {/* Offshore direction indicator */}
      {offshoreDirection != null && (
        <g opacity={0.4}>
          {(() => {
            const tip = polarToCartesian(cx, cy, maxR - 4, offshoreDirection)
            return (
              <>
                <line x1={cx} y1={cy} x2={tip.x} y2={tip.y} stroke="var(--cyan-bright)" strokeWidth={1.5} strokeDasharray="4 2" />
                <text
                  x={tip.x}
                  y={tip.y - 4}
                  textAnchor="middle"
                  fontSize={7}
                  fill="var(--cyan-bright)"
                >
                  offshore
                </text>
              </>
            )
          })()}
        </g>
      )}

      {/* Wind readings as bars */}
      {readings.map((r, i) => {
        if (r.speed_ms < 0.1) return null
        const radius = (r.speed_ms / maxSpeed) * (maxR - 4)
        const barW = Math.max(2, (maxR * 2 * Math.PI) / (readings.length * 1.5))
        const angle = r.direction
        const tip = polarToCartesian(cx, cy, radius, angle)
        const color = speedColor(r.speed_ms)

        // Draw as a radial line/bar
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={tip.x}
            y2={tip.y}
            stroke={color}
            strokeWidth={Math.max(1, barW * 0.4)}
            strokeOpacity={0.7}
          />
        )
      })}

      {/* Center dot */}
      <circle cx={cx} cy={cy} r={3} fill="var(--deep-text)" />

      {/* Speed legend */}
      <g transform={`translate(4, ${size - 36})`}>
        {[
          { label: '<5kt', color: '#22c55e' },
          { label: '5-10', color: '#eab308' },
          { label: '10+', color: '#ef4444' },
        ].map((l, i) => (
          <g key={l.label} transform={`translate(${i * 36}, 0)`}>
            <circle cx={4} cy={4} r={3} fill={l.color} />
            <text x={10} y={7} fontSize={7} fill="var(--spray)">{l.label}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}
