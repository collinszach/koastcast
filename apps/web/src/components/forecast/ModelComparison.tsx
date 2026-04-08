'use client'

/**
 * ModelComparison — Ensemble model spread chart.
 * Shows wave height predictions from each model (ECMWF, GFS, ICON)
 * as overlapping area charts. The spread between them = forecast uncertainty.
 * Premium feature (pro/explorer).
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

interface ModelHour {
  forecast_time: string
  wave_height_face_m?: number | null
  wave_height_m?: number | null
}

interface ModelComparisonProps {
  /** Map of model name → array of forecast hours */
  modelForecasts: Record<string, ModelHour[]>
  isPremium?: boolean
}

const MODEL_COLORS: Record<string, string> = {
  ecmwf_ifs: '#3b82f6',  // blue
  gfs:       '#22c55e',  // green
  icon:      '#f97316',  // orange
  ensemble:  '#a78bfa',  // purple
}

const MODEL_LABELS: Record<string, string> = {
  ecmwf_ifs: 'ECMWF IFS',
  gfs:       'GFS',
  icon:      'ICON',
  ensemble:  'Ensemble',
}

function formatHour(ts: string): string {
  const d = new Date(ts)
  return d.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', hour12: true })
}

function mToFt(m: number): number {
  return parseFloat((m * 3.281).toFixed(1))
}

/** Merge all model forecasts into a single array keyed by forecast_time. */
function buildChartData(modelForecasts: Record<string, ModelHour[]>) {
  const byTime = new Map<string, Record<string, unknown>>()

  for (const [model, hours] of Object.entries(modelForecasts)) {
    if (!Array.isArray(hours)) continue
    for (const h of hours) {
      if (!byTime.has(h.forecast_time)) {
        byTime.set(h.forecast_time, { time: h.forecast_time, label: formatHour(h.forecast_time) })
      }
      const row = byTime.get(h.forecast_time)!
      const ht = h.wave_height_face_m ?? h.wave_height_m
      row[model] = ht != null ? mToFt(ht) : null
    }
  }

  return Array.from(byTime.values())
    .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime())
    .slice(0, 72) // 3 days
}

function AgreementBadge({ modelForecasts }: { modelForecasts: Record<string, ModelHour[]> }) {
  const models = Object.keys(modelForecasts).filter(k => k !== 'ensemble')
  if (models.length < 2) return null

  // Compute average std deviation of heights across all time steps
  const firstModel = modelForecasts[models[0]]
  const spreads: number[] = []

  for (let i = 0; i < Math.min(24, firstModel.length); i++) {
    const heights = models
      .map(m => {
        const h = modelForecasts[m]?.[i]
        return h?.wave_height_face_m ?? h?.wave_height_m ?? null
      })
      .filter((v): v is number => v != null)

    if (heights.length >= 2) {
      const mean = heights.reduce((a, b) => a + b, 0) / heights.length
      const std = Math.sqrt(heights.reduce((s, v) => s + (v - mean) ** 2, 0) / heights.length)
      spreads.push(std / (mean || 1))
    }
  }

  const avgSpread = spreads.length ? spreads.reduce((a, b) => a + b, 0) / spreads.length : 0

  const { label, color } =
    avgSpread < 0.1
      ? { label: 'Models agree', color: 'text-green-400' }
      : avgSpread < 0.25
      ? { label: 'Mild uncertainty', color: 'text-yellow-400' }
      : { label: 'Models disagree', color: 'text-red-400' }

  return (
    <span className={`text-xs font-medium ${color}`}>
      {label} ({(avgSpread * 100).toFixed(0)}% spread)
    </span>
  )
}

export default function ModelComparison({ modelForecasts, isPremium = true }: ModelComparisonProps) {
  const models = Object.keys(modelForecasts).filter(k => k !== 'ensemble')
  if (models.length === 0) {
    return (
      <div className="text-gray-500 text-sm text-center py-8">
        Enable ensemble mode to compare models.
        <br />
        <span className="text-xs">Append <code className="text-gray-400">?ensemble=true</code> to the forecast URL.</span>
      </div>
    )
  }

  const data = buildChartData(modelForecasts)
  const nowLabel = formatHour(new Date().toISOString())

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">Wave height (ft) — next 72h</div>
        <AgreementBadge modelForecasts={modelForecasts} />
      </div>

      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            {models.map(model => (
              <linearGradient key={model} id={`grad-${model}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={MODEL_COLORS[model] ?? '#888'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={MODEL_COLORS[model] ?? '#888'} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          <XAxis
            dataKey="label"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            interval={11}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}ft`}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
            labelStyle={{ color: '#9ca3af', fontSize: 11 }}
            itemStyle={{ fontSize: 12 }}
            formatter={(val: number, name: string) => [`${val}ft`, MODEL_LABELS[name] ?? name]}
          />
          <Legend
            formatter={(value) => (
              <span style={{ color: '#9ca3af', fontSize: 11 }}>
                {MODEL_LABELS[value] ?? value}
              </span>
            )}
          />
          <ReferenceLine x={nowLabel} stroke="#4b5563" strokeDasharray="3 3" label={{ value: 'Now', fill: '#6b7280', fontSize: 10 }} />

          {models.map(model => (
            <Area
              key={model}
              type="monotone"
              dataKey={model}
              stroke={MODEL_COLORS[model] ?? '#888'}
              strokeWidth={2}
              fill={`url(#grad-${model})`}
              connectNulls
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
