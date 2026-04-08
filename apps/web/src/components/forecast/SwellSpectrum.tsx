'use client'

/**
 * SwellSpectrum — Recharts AreaChart showing wave energy spectrum.
 * X axis: wave period in seconds (converted from frequency Hz).
 * Y axis: spectral energy density (m²/Hz).
 *
 * Shows up to 4 time snapshots as separate area series.
 */

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'

interface SpectrumSnapshot {
  label: string         // e.g. "Now", "+6h", "+12h", "+24h"
  spectrum: Record<string, number>  // freq(Hz) → energy(m²/Hz)
}

interface SwellSpectrumProps {
  snapshots: SpectrumSnapshot[]
}

const SNAPSHOT_COLORS = ['#3b82f6', '#22c55e', '#f97316', '#a855f7']

/**
 * Merge multiple spectrum snapshots into a single chart data array.
 * X axis value is wave period in seconds (T = 1/f), rounded to 1 decimal.
 */
function buildChartData(snapshots: SpectrumSnapshot[]) {
  if (!snapshots.length) return []

  // Collect all frequency keys across all snapshots
  const allFreqs = Array.from(
    new Set(snapshots.flatMap(s => Object.keys(s.spectrum).map(Number)))
  ).sort((a, b) => b - a)  // sort descending freq → ascending period

  return allFreqs.map(freq => {
    const period = freq > 0 ? Math.round((1 / freq) * 10) / 10 : 0
    const row: Record<string, number | string> = { period }
    snapshots.forEach((snap, i) => {
      row[snap.label] = snap.spectrum[String(freq)] ?? snap.spectrum[freq.toFixed(4)] ?? 0
    })
    return row
  })
}

export default function SwellSpectrum({ snapshots }: SwellSpectrumProps) {
  if (!snapshots.length) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-500 text-sm">
        No spectral data available
      </div>
    )
  }

  const data = buildChartData(snapshots)

  return (
    <div className="w-full h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
          <defs>
            {snapshots.map((snap, i) => (
              <linearGradient key={snap.label} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={SNAPSHOT_COLORS[i]} stopOpacity={0.4} />
                <stop offset="95%" stopColor={SNAPSHOT_COLORS[i]} stopOpacity={0.05} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="period"
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={v => `${v}s`}
            label={{ value: 'Period', position: 'insideBottomRight', offset: -4, fill: '#6b7280', fontSize: 10 }}
          />
          <YAxis
            tick={{ fill: '#6b7280', fontSize: 10 }}
            tickFormatter={v => `${v.toFixed(2)}`}
          />
          <Tooltip
            contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8, fontSize: 11 }}
            labelFormatter={v => `${v}s period`}
            formatter={(value: number, name: string) => [`${value.toFixed(3)} m²/Hz`, name]}
          />
          {snapshots.length > 1 && (
            <Legend wrapperStyle={{ fontSize: 10, color: '#9ca3af' }} />
          )}
          {snapshots.map((snap, i) => (
            <Area
              key={snap.label}
              type="monotone"
              dataKey={snap.label}
              stroke={SNAPSHOT_COLORS[i]}
              strokeWidth={1.5}
              fill={`url(#grad-${i})`}
              dot={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
