'use client'

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import type { SnowForecastDay } from '@/types/snow'

interface Props {
  days: SnowForecastDay[]
  accentColor?: string
}

interface TooltipPayload {
  value: number
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean
  payload?: TooltipPayload[]
  label?: string
}) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value ?? 0
  return (
    <div style={{
      background: 'var(--paper-raised)',
      border: '1px solid var(--tile-border-strong)',
      borderRadius: 10,
      padding: '8px 12px',
      fontFamily: 'var(--font-data, monospace)',
      boxShadow: 'var(--tile-shadow)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--spray)', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: val >= 6 ? 'var(--snow)' : val >= 3 ? 'var(--snow-bright)' : val > 0 ? 'var(--snow-dim)' : 'var(--deep-text)', lineHeight: 1 }}>
        {val > 0 ? `${val}"` : '—'}
      </div>
      <div style={{ fontSize: 7.5, color: 'var(--spray)', marginTop: 2, letterSpacing: '0.06em' }}>NEW SNOW</div>
    </div>
  )
}

export default function SnowForecastChart({ days, accentColor = 'var(--snow)' }: Props) {
  const data = days.map(d => ({
    day: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    snow: d.snowfall_in,
  }))

  function barColor(snow: number): string {
    if (snow >= 6) return 'var(--snow)'
    if (snow >= 4) return accentColor
    if (snow >= 2) return 'var(--snow-dim)'
    if (snow > 0)  return 'rgba(124,58,237,0.35)'
    return 'var(--tile-border-strong)'
  }

  return (
    <div style={{ width: '100%', height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="var(--tile-border)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="day"
            tick={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, fill: 'var(--spray)', letterSpacing: '0.04em' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, fill: 'var(--deep-text)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v > 0 ? `${v}"` : ''}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--snow-muted)', radius: 4 }} />
          <Bar dataKey="snow" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={barColor(entry.snow)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
