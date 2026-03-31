import SpotMapClient from '@/components/spots/SpotMapClient'
import SpotCard from '@/components/spots/SpotCard'
import { getSpots } from '@/lib/api'
import type { Spot } from '@/types'
import { getConditionLabel } from '@/types'

export const revalidate = 300

async function loadSpots(): Promise<Spot[]> {
  try {
    return await getSpots()
  } catch {
    return []
  }
}

function buildConditionSummary(spots: Spot[]) {
  const counts: Record<string, number> = {}
  for (const s of spots) {
    const label = getConditionLabel(s.current_conditions?.quality_score)
    counts[label] = (counts[label] || 0) + 1
  }
  return counts
}

const CONDITION_PILLS = {
  firing:   { emoji: '🔥', label: 'Firing',  color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)' },
  pumping:  { emoji: '🤙', label: 'Pumping', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)',   border: 'rgba(6,182,212,0.25)'  },
  fun:      { emoji: '😎', label: 'Fun',     color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  worth_it: { emoji: '🏄', label: 'OK',      color: '#6366F1', bg: 'rgba(99,102,241,0.1)',  border: 'rgba(99,102,241,0.25)' },
}

export default async function MapPage() {
  const spots = await loadSpots()
  const counts = buildConditionSummary(spots)

  return (
    <div className="flex h-full">
      {/* Map */}
      <div className="flex-1 relative">
        <SpotMapClient spots={spots} />
      </div>

      {/* Sidebar */}
      <div className="hidden md:flex w-[300px] flex-shrink-0 flex-col overflow-hidden"
           style={{
             background: 'rgba(6, 10, 20, 0.98)',
             borderLeft: '1px solid rgba(6,182,212,0.1)',
           }}>

        {/* Header */}
        <div className="p-4 flex-shrink-0" style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}>
          <div className="flex items-center justify-between mb-3">
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              fontWeight: 700,
              color: 'var(--foam)',
            }}>
              {spots.length} Spots
            </span>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-bio-pulse" style={{ background: 'var(--cyan)' }} />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--cyan)', letterSpacing: '0.1em' }}>LIVE</span>
            </div>
          </div>

          {/* Condition pills */}
          <div className="flex flex-wrap gap-1.5">
            {(Object.entries(CONDITION_PILLS) as Array<[string, typeof CONDITION_PILLS[keyof typeof CONDITION_PILLS]]>)
              .filter(([key]) => counts[key])
              .map(([key, cfg]) => (
                <span key={key} style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  fontWeight: 600,
                  color: cfg.color,
                  background: cfg.bg,
                  border: `1px solid ${cfg.border}`,
                  padding: '3px 9px',
                  borderRadius: 20,
                  letterSpacing: '0.04em',
                }}>
                  {cfg.emoji} {counts[key]} {cfg.label}
                </span>
              ))}
          </div>
        </div>

        {/* Spot list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {spots.length === 0 ? (
            <div className="text-center py-16">
              <div style={{ fontSize: 36, marginBottom: 12 }}>🌊</div>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: 'var(--spray)' }}>No spots loaded</p>
              <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', marginTop: 6, letterSpacing: '0.04em' }}>
                Is the NUC API running?
              </p>
            </div>
          ) : (
            spots.map((spot) => (
              <SpotCard key={spot.slug} spot={spot} />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
