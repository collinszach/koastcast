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
      background: 'rgba(4,8,16,0.97)',
      border: '1px solid rgba(139,92,246,0.3)',
      borderRadius: 10,
      padding: '8px 12px',
      fontFamily: 'var(--font-data, monospace)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 900, color: val >= 6 ? '#a78bfa' : val >= 3 ? '#8B5CF6' : val > 0 ? '#6d28d9' : 'rgba(255,255,255,0.2)', lineHeight: 1 }}>
        {val > 0 ? `${val}"` : '—'}
      </div>
      <div style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.25)', marginTop: 2, letterSpacing: '0.06em' }}>NEW SNOW</div>
    </div>
  )
}

export default function SnowForecastChart({ days, accentColor = '#8B5CF6' }: Props) {
  const data = days.map(d => ({
    day: new Date(d.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    snow: d.snowfall_in,
  }))

  function barColor(snow: number): string {
    if (snow >= 6) return '#a78bfa'
    if (snow >= 4) return accentColor
    if (snow >= 2) return '#7c3aed'
    if (snow > 0)  return '#4c1d95'
    return '#1e1b4b'
  }

  return (
    <div style={{ width: '100%', height: 120 }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barCategoryGap="20%" margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
          <CartesianGrid
            vertical={false}
            stroke="rgba(255,255,255,0.04)"
            strokeDasharray="3 3"
          />
          <XAxis
            dataKey="day"
            tick={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, fill: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, fill: 'rgba(255,255,255,0.22)' }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => v > 0 ? `${v}"` : ''}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(139,92,246,0.07)', radius: 4 }} />
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
