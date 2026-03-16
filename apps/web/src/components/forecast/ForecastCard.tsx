import type { ForecastHour } from '@/types'
import { formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow } from '@/types'

interface ForecastCardProps {
  hour: ForecastHour
  isSelected?: boolean
  onClick?: () => void
}

function qualityColor(score?: number | null): string {
  if (score == null) return '#334155'
  if (score >= 8) return '#ef4444'
  if (score >= 6) return '#f97316'
  if (score >= 4) return '#22c55e'
  if (score >= 2) return '#3b82f6'
  return '#334155'
}

function qualityBg(score?: number | null): string {
  if (score == null) return 'transparent'
  if (score >= 8) return 'rgba(239,68,68,0.07)'
  if (score >= 6) return 'rgba(249,115,22,0.07)'
  if (score >= 4) return 'rgba(34,197,94,0.07)'
  if (score >= 2) return 'rgba(59,130,246,0.07)'
  return 'transparent'
}

function formatHour(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

function formatDay(ts: string): string {
  return new Date(ts).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/* SVG direction arrow that rotates to the given bearing */
function DirectionArrow({ degrees, size = 14, color = '#94a3b8' }: { degrees?: number | null; size?: number; color?: string }) {
  if (degrees == null) return <span className="text-slate-600 text-xs">--</span>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ transform: `rotate(${degrees}deg)`, display: 'inline-block', flexShrink: 0 }}>
      <path d="M12 2 L18 20 L12 16 L6 20 Z" fill={color} />
    </svg>
  )
}

export default function ForecastCard({ hour, isSelected, onClick }: ForecastCardProps) {
  const qColor = qualityColor(hour.quality_score)
  const qBg    = qualityBg(hour.quality_score)

  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-[116px] rounded-2xl border cursor-pointer transition-all select-none ${
        isSelected
          ? 'border-sky-500/60 ring-1 ring-sky-500/30'
          : 'border-slate-800/60 hover:border-slate-600/60'
      }`}
      style={{ background: isSelected ? 'rgba(14,165,233,0.08)' : qBg || 'rgba(15,23,42,0.7)' }}
    >
      {/* Quality bar — top accent */}
      <div className="h-1 rounded-t-2xl" style={{ background: qColor }} />

      <div className="p-3">
        {/* Time */}
        <div className="text-center mb-2.5">
          <div className="text-[10px] text-slate-500 leading-tight">{formatDay(hour.forecast_time)}</div>
          <div className="text-xs font-bold text-slate-300 leading-tight">{formatHour(hour.forecast_time)}</div>
        </div>

        {/* Wave height */}
        <div className="text-center mb-2.5">
          <div className="text-2xl font-black text-white leading-none">
            {formatWaveHeight(hour.wave_height_face_m ?? hour.wave_height_m)}
          </div>
          <div className="text-[9px] text-slate-600 uppercase tracking-wider mt-0.5">face</div>
        </div>

        {/* Period + swell direction */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-slate-400 font-medium">{formatPeriod(hour.wave_period_s)}</span>
          <DirectionArrow degrees={hour.swell_direction ?? hour.wave_direction} size={13} color="#94a3b8" />
        </div>

        {/* Wind */}
        <div className="flex items-center justify-center gap-1.5 mb-2.5">
          <DirectionArrow degrees={hour.wind_direction} size={11} color="#64748b" />
          <span className="text-[11px] text-slate-500">{formatWindSpeed(hour.wind_speed_ms)}</span>
        </div>

        {/* Quality score bar */}
        <div className="w-full bg-slate-800 rounded-full h-1 overflow-hidden mb-1.5">
          <div
            className="h-full rounded-full"
            style={{
              width: hour.quality_score != null ? `${hour.quality_score * 10}%` : '0%',
              background: qColor,
            }}
          />
        </div>

        {/* Crowd bar */}
        {hour.crowd_score != null && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-slate-700 text-[9px] w-7">crowd</span>
            <div className="flex-1 bg-slate-800 rounded-full h-0.5 overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${hour.crowd_score * 100}%`,
                  background: hour.crowd_score > 0.7 ? '#ef4444' : hour.crowd_score > 0.4 ? '#f97316' : '#22c55e',
                }}
              />
            </div>
          </div>
        )}

        {/* Model agreement */}
        {hour.model_agreement_label != null && (
          <div className={`text-[9px] text-center mt-1 font-medium ${
            hour.model_agreement_label === 'agree' ? 'text-green-600' :
            hour.model_agreement_label === 'mild_disagreement' ? 'text-yellow-600' : 'text-red-600'
          }`}>
            {hour.model_agreement_label === 'agree' ? '✓ agree' :
             hour.model_agreement_label === 'mild_disagreement' ? '~ uncertain' : '⚠ differ'}
          </div>
        )}
      </div>
    </div>
  )
}
