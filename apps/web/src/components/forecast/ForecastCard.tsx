import type { ForecastHour } from '@/types'
import { formatWaveHeight, formatPeriod, formatWindSpeed } from '@/types'

interface ForecastCardProps {
  hour: ForecastHour
  isSelected?: boolean
  onClick?: () => void
}

/** Maps quality score → ocean design system colors */
function qualityColor(score?: number | null): string {
  if (score == null) return 'var(--deep-text)'
  if (score >= 8) return 'var(--q-firing)'
  if (score >= 6) return 'var(--q-pumping)'
  if (score >= 4) return 'var(--q-good)'
  if (score >= 2) return 'var(--q-ok)'
  return 'var(--q-flat)'
}

function qualityLabel(score?: number | null): string {
  if (score == null) return ''
  if (score >= 8) return 'FIRE'
  if (score >= 6) return 'PUMP'
  if (score >= 4) return 'FUN'
  if (score >= 2) return 'OK'
  return 'FLAT'
}

function formatHour(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true })
}

function DirectionArrow({ degrees, size = 13, color = 'var(--deep-text)' }: { degrees?: number | null; size?: number; color?: string }) {
  if (degrees == null) return <span style={{ color: 'var(--deep-text)', fontSize: 10 }}>--</span>
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
         style={{ transform: `rotate(${degrees}deg)`, display: 'inline-block', flexShrink: 0 }}>
      <path d="M12 2 L17 19 L12 15 L7 19 Z" fill={color} />
    </svg>
  )
}

export default function ForecastCard({ hour, isSelected, onClick }: ForecastCardProps) {
  const color = qualityColor(hour.quality_score)
  const score = hour.quality_score

  return (
    <div
      onClick={onClick}
      className={`flex-shrink-0 w-[108px] rounded-2xl cursor-pointer select-none transition-all duration-150 ${
        isSelected ? 'scale-[1.06]' : 'hover:scale-[1.03]'
      }`}
      style={{
        background: 'var(--tile-bg)',
        border: isSelected
          ? `1px solid ${color}66`
          : '1px solid var(--tile-border)',
        boxShadow: isSelected ? '0 6px 20px rgba(18,24,31,0.1)' : 'var(--tile-shadow)',
      }}
    >
      {/* Top quality bar */}
      <div className="h-[3px] rounded-t-2xl" style={{ background: color, opacity: isSelected ? 1 : 0.6 }} />

      <div className="p-3">
        {/* Time */}
        <div className="text-center mb-3">
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--spray)',
            letterSpacing: '0.04em',
          }}>
            {formatHour(hour.forecast_time)}
          </div>
        </div>

        {/* Wave height — dominant data element */}
        <div className="text-center mb-2">
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1,
            color: isSelected ? color : 'var(--foam)',
            transition: 'color 0.15s',
          }}>
            {formatWaveHeight(hour.wave_height_face_m ?? hour.wave_height_m)}
          </div>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 8,
            color: 'var(--deep-text)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginTop: 2,
          }}>face</div>
        </div>

        {/* Period + swell dir */}
        <div className="flex items-center justify-between mb-2">
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, fontWeight: 600, color: 'var(--spray)' }}>
            {formatPeriod(hour.wave_period_s)}
          </span>
          <DirectionArrow degrees={hour.swell_direction ?? hour.wave_direction} color="var(--deep-text)" />
        </div>

        {/* Wind */}
        <div className="flex items-center justify-center gap-1.5 mb-3">
          <DirectionArrow degrees={hour.wind_direction} size={10} color="var(--deep-text)" />
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)' }}>
            {formatWindSpeed(hour.wind_speed_ms)}
          </span>
        </div>

        {/* Quality pill */}
        {score != null && (
          <div className="flex items-center justify-between">
            <div className="w-full rounded-full overflow-hidden" style={{ height: 2, background: 'var(--tile-border)' }}>
              <div className="h-full rounded-full transition-all duration-500"
                   style={{ width: `${score * 10}%`, background: color }} />
            </div>
          </div>
        )}

        {score != null && (
          <div className="flex items-center justify-between mt-1.5">
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: color,
              letterSpacing: '0.06em',
              fontWeight: 600,
            }}>
              {qualityLabel(score)}
            </span>
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: color,
              fontWeight: 700,
            }}>
              {score.toFixed(1)}
            </span>
          </div>
        )}

        {/* Crowd indicator */}
        {hour.crowd_score != null && (
          <div className="flex items-center gap-1 mt-1.5">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 2, background: 'var(--tile-border)' }}>
              <div className="h-full rounded-full"
                   style={{
                     width: `${hour.crowd_score * 100}%`,
                     background: hour.crowd_score > 0.7 ? '#EF4444' : hour.crowd_score > 0.4 ? '#F97316' : '#14B8A6',
                   }} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
