'use client'

/**
 * Safety & Hazards Panel
 *
 * Shows real safety data that zero other surf apps display:
 * - Post-rain water quality warnings (72-hour bacterial contamination rule)
 * - NWS rip current risk level
 * - Active surf advisories / high surf warnings
 * - Spot-specific static hazard notes
 *
 * Data from: Open-Meteo precipitation, NWS Weather API alerts
 */

import { useEffect, useState } from 'react'

interface WaterQuality {
  safe: boolean
  reason: string
  advisory?: string
  post_rain_hours?: number
}

interface RipCurrent {
  risk_level: 'low' | 'moderate' | 'high' | 'extreme' | 'unknown'
  description: string
  source: string
}

interface SurfAdvisory {
  active: boolean
  type: string
  headline?: string
  description?: string
}

interface SafetyData {
  water_quality: WaterQuality
  rip_current: RipCurrent
  surf_advisory: SurfAdvisory | null
  static_hazards: string[]
  overall_risk: 'low' | 'moderate' | 'high' | 'extreme' | 'unknown'
}

interface Props {
  spotId: string
  spotName: string
}

const RISK_CONFIG = {
  low:     { bg: 'bg-green-50',  border: 'border-green-200',  badge: 'bg-green-100 text-green-700',  label: 'LOW RISK'     },
  moderate:{ bg: 'bg-yellow-50', border: 'border-yellow-200', badge: 'bg-yellow-100 text-yellow-700',label: 'MODERATE RISK'},
  high:    { bg: 'bg-orange-50', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700',label: 'HIGH RISK'    },
  extreme: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700',      label: 'EXTREME RISK' },
  unknown: { bg: 'bg-[var(--paper-sunken)]',   border: 'border-[var(--tile-border-strong)]',   badge: 'bg-[var(--paper-sunken)] text-[var(--spray)]',    label: 'UNKNOWN RISK' },
}

const RIP_COLORS = {
  low:     'text-green-700',
  moderate:'text-yellow-700',
  high:    'text-orange-700',
  extreme: 'text-red-700',
  unknown: 'text-[var(--spray)]',
}

export default function SafetyPanel({ spotId, spotName }: Props) {
  const [data, setData] = useState<SafetyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    fetch(`/api/safety?spotId=${encodeURIComponent(spotId)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        setData(d)
        // Auto-expand if there's a risk worth showing
        if (d && (d.overall_risk === 'high' || d.overall_risk === 'extreme' || !d.water_quality.safe)) {
          setExpanded(true)
        }
      })
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [spotId])

  if (loading) {
    return (
      <div className="bg-[var(--tile-bg)] border border-[var(--tile-border)] rounded-2xl p-4 animate-pulse">
        <div className="h-4 bg-[var(--paper-sunken)] rounded w-32 mb-2" />
        <div className="h-3 bg-[var(--paper-sunken)] rounded w-48" />
      </div>
    )
  }

  if (!data) return null

  const cfg = RISK_CONFIG[data.overall_risk]
  const hasAlerts = !data.water_quality.safe ||
    data.rip_current.risk_level !== 'low' ||
    data.surf_advisory?.active ||
    data.static_hazards.length > 0

  return (
    <div className={`rounded-2xl border ${cfg.bg} ${cfg.border}`}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-base">🛡️</span>
          <div>
            <span className="text-[var(--foam)] text-sm font-semibold">Safety & Hazards</span>
            {!expanded && data.overall_risk !== 'unknown' && (
              <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                {cfg.label}
              </span>
            )}
          </div>
        </div>
        <span className="text-[var(--spray)] text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Overall risk badge */}
          <div className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full ${cfg.badge}`}>
            {cfg.label}
          </div>

          {/* Water quality */}
          <div className="bg-[var(--tile-bg)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>{data.water_quality.safe ? '💧' : '⚠️'}</span>
              <span className="text-sm font-medium text-[var(--foam)]">Water Quality</span>
              <span className={`text-xs font-medium ${data.water_quality.safe ? 'text-green-700' : 'text-red-700'}`}>
                {data.water_quality.safe ? 'OK' : 'WARNING'}
              </span>
            </div>
            <p className="text-[var(--spray)] text-xs leading-relaxed">{data.water_quality.reason}</p>
            {data.water_quality.advisory && (
              <p className="text-amber-700 text-xs mt-2 leading-relaxed">{data.water_quality.advisory}</p>
            )}
          </div>

          {/* Rip current */}
          <div className="bg-[var(--tile-bg)] rounded-xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span>🌊</span>
              <span className="text-sm font-medium text-[var(--foam)]">Rip Current Risk</span>
              <span className={`text-xs font-bold uppercase ${RIP_COLORS[data.rip_current.risk_level]}`}>
                {data.rip_current.risk_level}
              </span>
            </div>
            <p className="text-[var(--spray)] text-xs leading-relaxed">{data.rip_current.description}</p>
            <p className="text-[var(--deep-text)] text-xs mt-1">Source: {data.rip_current.source}</p>
          </div>

          {/* Surf advisory */}
          {data.surf_advisory?.active && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-2 mb-1">
                <span>🚨</span>
                <span className="text-sm font-medium text-red-700">
                  {data.surf_advisory.type.replace(/_/g, ' ').toUpperCase()} IN EFFECT
                </span>
              </div>
              {data.surf_advisory.headline && (
                <p className="text-red-700 text-xs font-medium mb-1">{data.surf_advisory.headline}</p>
              )}
              {data.surf_advisory.description && (
                <p className="text-red-700/80 text-xs leading-relaxed line-clamp-4">
                  {data.surf_advisory.description}
                </p>
              )}
            </div>
          )}

          {/* Static hazards */}
          {data.static_hazards.length > 0 && (
            <div className="bg-[var(--tile-bg)] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-2">
                <span>⚠️</span>
                <span className="text-sm font-medium text-[var(--foam)]">Known Hazards at {spotName}</span>
              </div>
              <ul className="space-y-1.5">
                {data.static_hazards.map((h, i) => (
                  <li key={i} className="text-xs text-[var(--spray)] flex gap-2">
                    <span className="text-[var(--deep-text)] shrink-0 mt-0.5">•</span>
                    {h}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {!hasAlerts && (
            <p className="text-[var(--spray)] text-xs text-center py-2">
              No active advisories — always assess conditions before paddling out
            </p>
          )}
        </div>
      )}
    </div>
  )
}
