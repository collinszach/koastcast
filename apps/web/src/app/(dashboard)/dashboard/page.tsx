import Link from 'next/link'
import { getSpots } from '@/lib/api'
import type { Spot } from '@/types'
import { getConditionLabel, formatWaveHeight, formatPeriod, formatWindSpeed, directionArrow } from '@/types'

export const revalidate = 300

async function loadSpots(): Promise<Spot[]> {
  try { return await getSpots() } catch { return [] }
}

const CONDITION_META = {
  firing:   { emoji: '🔥', label: 'FIRING',   text: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20'    },
  pumping:  { emoji: '🤙', label: 'PUMPING',  text: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
  fun:      { emoji: '😎', label: 'FUN',      text: 'text-green-400',  bg: 'bg-green-500/10',  border: 'border-green-500/20'  },
  worth_it: { emoji: '🏄', label: 'WORTH IT', text: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20'   },
  flat:     { emoji: '😴', label: 'FLAT',     text: 'text-slate-500',  bg: 'bg-slate-800/50',  border: 'border-slate-700/50'  },
  no_data:  { emoji: '—',  label: 'NO DATA',  text: 'text-slate-600',  bg: 'bg-slate-800/50',  border: 'border-slate-700/50'  },
}

export default async function DashboardPage() {
  const spots = await loadSpots()

  /* Sort by quality score descending */
  const sorted = [...spots].sort((a, b) => {
    const qa = a.current_conditions?.quality_score ?? -1
    const qb = b.current_conditions?.quality_score ?? -1
    return qb - qa
  })

  const topSpots  = sorted.slice(0, 3)
  const alertSpot = sorted.find(s => (s.current_conditions?.quality_score ?? 0) >= 6)
  const now = new Date()
  const hour = now.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const dateStr  = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-full p-4 md:p-8 max-w-3xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">{greeting} 🤙</h1>
        <p className="text-slate-400 mt-1">{dateStr}</p>
      </div>

      {/* Swell Alert Banner */}
      {alertSpot && (
        <Link href={`/spot/${alertSpot.slug}`} className="block mb-6">
          <div className="relative overflow-hidden rounded-2xl border border-orange-500/30 bg-gradient-to-r from-orange-950/60 to-red-950/60 p-5 hover:border-orange-500/50 transition-colors">
            <div className="flex items-center gap-4">
              <div className="text-4xl">🔔</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-orange-400 uppercase tracking-widest mb-0.5">Swell Alert</div>
                <div className="text-white font-bold text-lg truncate">
                  {alertSpot.name} is {getConditionLabel(alertSpot.current_conditions?.quality_score).replace('_', ' ').toUpperCase()}
                </div>
                <div className="text-slate-400 text-sm mt-0.5">
                  {alertSpot.current_conditions?.wave_height_face_m != null
                    ? `${formatWaveHeight(alertSpot.current_conditions.wave_height_face_m)} @ ${formatPeriod(alertSpot.current_conditions.wave_period_s)}`
                    : 'Check conditions'
                  }
                </div>
              </div>
              <div className="text-slate-400 text-xl flex-shrink-0">→</div>
            </div>
          </div>
        </Link>
      )}

      {/* Top Spots */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white">Best Spots Right Now</h2>
          <Link href="/map" className="text-sm text-sky-400 hover:text-sky-300 transition-colors font-medium">
            See all →
          </Link>
        </div>

        {spots.length === 0 ? (
          <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-8 text-center">
            <div className="text-4xl mb-3">📡</div>
            <div className="text-slate-300 font-semibold">Connecting to NUC API...</div>
            <div className="text-slate-500 text-sm mt-1">Start the backend to see live conditions</div>
          </div>
        ) : (
          <div className="space-y-3">
            {topSpots.map((spot, i) => {
              const label = getConditionLabel(spot.current_conditions?.quality_score)
              const meta  = CONDITION_META[label]
              const cc    = spot.current_conditions
              return (
                <Link key={spot.slug} href={`/spot/${spot.slug}`} className="block">
                  <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-4 hover:scale-[1.01] transition-all`}>
                    <div className="flex items-center gap-4">
                      {/* Rank */}
                      <div className="w-8 h-8 rounded-full bg-slate-800/80 flex items-center justify-center text-sm font-bold text-slate-400 flex-shrink-0">
                        {i + 1}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-bold text-white truncate">{spot.name}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${meta.bg} ${meta.text} border ${meta.border} flex-shrink-0`}>
                            {meta.emoji} {meta.label}
                          </span>
                        </div>
                        <div className="text-xs text-slate-500">{spot.region} · {spot.break_type}</div>
                      </div>

                      {/* Conditions */}
                      {cc?.wave_height_face_m != null ? (
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-right">
                            <div className="text-xl font-black text-white">{formatWaveHeight(cc.wave_height_face_m)}</div>
                            <div className="text-xs text-slate-500">{formatPeriod(cc.wave_period_s)}</div>
                          </div>
                          <div className="text-right hidden sm:block">
                            <div className="text-sm font-semibold text-slate-300">
                              {directionArrow(cc.wind_direction)} {formatWindSpeed(cc.wind_speed_ms)}
                            </div>
                            <div className="text-xs text-slate-500">wind</div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-600 text-sm">No data</div>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <Link href="/map"
          className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5 hover:bg-sky-500/10 transition-colors text-center">
          <div className="text-3xl mb-2">🗺️</div>
          <div className="font-bold text-white text-sm">Explore Map</div>
          <div className="text-slate-500 text-xs mt-0.5">All spots + live data</div>
        </Link>
        <Link href="/sessions"
          className="rounded-2xl border border-slate-700/50 bg-slate-800/30 p-5 hover:bg-slate-800/50 transition-colors text-center">
          <div className="text-3xl mb-2">📓</div>
          <div className="font-bold text-white text-sm">Log Session</div>
          <div className="text-slate-500 text-xs mt-0.5">Track your surfs</div>
        </Link>
      </div>

      {/* Upgrade CTA */}
      <div className="rounded-2xl border border-sky-500/20 bg-gradient-to-br from-sky-950/40 to-slate-900/60 p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚡</div>
          <div className="flex-1">
            <div className="font-bold text-white mb-1">Unlock SwellStack Pro</div>
            <div className="text-slate-400 text-sm mb-3">
              Personalized Stoke Score™, 16-day forecasts, optimal session windows, crowd predictions, and AI chat.
            </div>
            <Link href="/upgrade"
              className="inline-flex items-center gap-2 bg-sky-500 hover:bg-sky-400 text-white font-bold text-sm px-4 py-2 rounded-xl transition-colors">
              Upgrade to Pro →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
