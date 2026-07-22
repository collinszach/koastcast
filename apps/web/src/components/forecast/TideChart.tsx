'use client'

/**
 * TideChart — SVG 48h tide curve with high/low markers and current position indicator.
 * Pure SVG, no external chart library dependency.
 */

interface TidePoint {
  time: string       // ISO string
  height_m: number
  is_high?: boolean
  is_low?: boolean
}

interface TideChartProps {
  points: TidePoint[]
  currentTime?: string  // ISO string for "now" marker
  height?: number
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function toSvgCoords(
  points: TidePoint[],
  width: number,
  height: number,
  padding: { top: number; bottom: number; left: number; right: number },
) {
  if (!points.length) return []

  const times = points.map(p => new Date(p.time).getTime())
  const heights = points.map(p => p.height_m)
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const minH = Math.min(...heights) - 0.1
  const maxH = Math.max(...heights) + 0.1

  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  return points.map((p, i) => ({
    x: padding.left + ((times[i] - minT) / (maxT - minT)) * plotW,
    y: padding.top + (1 - (p.height_m - minH) / (maxH - minH)) * plotH,
    ...p,
  }))
}

function buildPathD(pts: Array<{ x: number; y: number }>) {
  if (!pts.length) return ''
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1]
    const curr = pts[i]
    const cpX = (prev.x + curr.x) / 2
    d += ` C ${cpX.toFixed(1)} ${prev.y.toFixed(1)} ${cpX.toFixed(1)} ${curr.y.toFixed(1)} ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`
  }
  return d
}

export default function TideChart({
  points,
  currentTime,
  height: svgHeight = 120,
}: TideChartProps) {
  const width = 600
  const padding = { top: 12, bottom: 28, left: 36, right: 12 }

  if (!points.length) {
    return (
      <div className="h-28 flex items-center justify-center text-gray-500 text-sm">
        No tide data available
      </div>
    )
  }

  const coords = toSvgCoords(points, width, svgHeight, padding)
  const linePath = buildPathD(coords)

  // Area fill path
  const areaPath =
    linePath +
    ` L ${coords[coords.length - 1].x.toFixed(1)} ${(svgHeight - padding.bottom).toFixed(1)}` +
    ` L ${coords[0].x.toFixed(1)} ${(svgHeight - padding.bottom).toFixed(1)} Z`

  // Current time marker
  const times = points.map(p => new Date(p.time).getTime())
  const minT = Math.min(...times)
  const maxT = Math.max(...times)
  const plotW = width - padding.left - padding.right
  let nowX: number | null = null

  if (currentTime) {
    const nowT = new Date(currentTime).getTime()
    if (nowT >= minT && nowT <= maxT) {
      nowX = padding.left + ((nowT - minT) / (maxT - minT)) * plotW
    }
  }

  // Time axis labels (every 6h)
  const axisLabels: Array<{ x: number; label: string }> = []
  const startDate = new Date(minT)
  startDate.setMinutes(0, 0, 0)
  for (let t = startDate.getTime(); t <= maxT; t += 6 * 3600 * 1000) {
    if (t >= minT) {
      const x = padding.left + ((t - minT) / (maxT - minT)) * plotW
      const d = new Date(t)
      axisLabels.push({
        x,
        label: d.getHours() === 0
          ? d.toLocaleDateString('en', { weekday: 'short' })
          : `${d.getHours()}h`,
      })
    }
  }

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${svgHeight}`}
        className="w-full"
        style={{ minWidth: 300 }}
      >
        <defs>
          <linearGradient id="tide-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#tide-grad)" />

        {/* Line */}
        <path d={linePath} fill="none" stroke="#3b82f6" strokeWidth={1.5} />

        {/* High/Low markers */}
        {coords
          .filter(c => c.is_high || c.is_low)
          .map((c, i) => (
            <g key={i}>
              <circle cx={c.x} cy={c.y} r={3} fill={c.is_high ? '#EA580C' : '#2563EB'} />
              <text
                x={c.x}
                y={c.is_high ? c.y - 7 : c.y + 14}
                textAnchor="middle"
                fontSize={8}
                fill={c.is_high ? '#EA580C' : '#2563EB'}
              >
                {c.height_m.toFixed(1)}m
              </text>
            </g>
          ))}

        {/* Current time marker */}
        {nowX != null && (
          <g>
            <line
              x1={nowX}
              y1={padding.top}
              x2={nowX}
              y2={svgHeight - padding.bottom}
              stroke="#D97706"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            <text
              x={nowX}
              y={svgHeight - padding.bottom + 10}
              textAnchor="middle"
              fontSize={8}
              fill="#D97706"
            >
              Now
            </text>
          </g>
        )}

        {/* Time axis */}
        {axisLabels.map((l, i) => (
          <text
            key={i}
            x={l.x}
            y={svgHeight - 4}
            textAnchor="middle"
            fontSize={8}
            fill="#6b7280"
          >
            {l.label}
          </text>
        ))}

        {/* Height axis (left) */}
        {[0, 1, 2].map(tick => {
          const heights = points.map(p => p.height_m)
          const minH = Math.min(...heights) - 0.1
          const maxH = Math.max(...heights) + 0.1
          const h = minH + (tick / 2) * (maxH - minH)
          const y =
            padding.top +
            (1 - (h - minH) / (maxH - minH)) * (svgHeight - padding.top - padding.bottom)
          return (
            <text key={tick} x={padding.left - 4} y={y + 3} textAnchor="end" fontSize={8} fill="#6b7280">
              {h.toFixed(1)}
            </text>
          )
        })}
      </svg>
    </div>
  )
}
