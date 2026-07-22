'use client'

/**
 * Gear Recommendation Widget
 *
 * Shown on the spot forecast page — tells surfers what board and wetsuit to grab.
 * Personalizes based on user's saved quiver if logged in.
 * Falls back to generic recommendations if no quiver saved.
 */

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface GearRec {
  board_name: string | null
  board_reason: string
  board_type?: string
  wetsuit_name: string | null
  wetsuit_reason: string
  wetsuit_thickness?: string
  water_temp_f: number | null
  conditions_summary: string
  is_personalized: boolean
}

interface Props {
  spotId: string
  faceHeightM: number | null | undefined
  wavePeriodS: number | null | undefined
  waterTempC?: number | null
}

// Default wetsuit thickness table (mirrors backend)
const WETSUIT_TABLE = [
  [0,  50,  '6/5/4',      '❄️  Drysuit territory'],
  [50, 55,  '5/4/3',      '🥶 Thick winter suit + hood, gloves, booties'],
  [55, 60,  '4/3',        '🧊 Winter suit + 3mm booties'],
  [60, 65,  '3/2',        '🌊 Full suit, booties optional'],
  [65, 70,  '2/2',        '🤿 Springsuit'],
  [70, 75,  '1mm / rashguard', '☀️  Warm water — light protection'],
  [75, 999, 'Boardshorts', '🌴 No wetsuit needed'],
] as const

function getWetsuitForTemp(f: number): { thickness: string; desc: string } {
  for (const [min, max, thickness, desc] of WETSUIT_TABLE) {
    if (f >= min && f < max) return { thickness, desc }
  }
  return { thickness: 'Boardshorts', desc: '🌴 No wetsuit needed' }
}

function getBoardTypeForConditions(heightFt: number, periodS: number): { types: string[]; reason: string } {
  if (heightFt < 1.5) return { types: ['Longboard', 'Funboard'], reason: 'Small surf — maximize wave count with volume' }
  if (heightFt < 3) {
    if (periodS < 8) return { types: ['Fish', 'Funboard'], reason: 'Weak short-period swell — fish generates its own speed' }
    return { types: ['Fish', 'Shortboard'], reason: 'Fun-sized waves with decent period' }
  }
  if (heightFt < 5) {
    if (periodS >= 14) return { types: ['Shortboard', 'Gun'], reason: 'Long-period power — ideal shortboard conditions' }
    return { types: ['Shortboard', 'Fish'], reason: 'Good solid surf' }
  }
  if (heightFt < 8) return { types: ['Gun', 'Shortboard'], reason: 'Solid overhead surf — gun preferred' }
  return { types: ['Gun'], reason: `${heightFt.toFixed(0)}ft — gun territory` }
}

export default function GearRecommendation({ spotId, faceHeightM, wavePeriodS, waterTempC }: Props) {
  const [rec, setRec] = useState<GearRec | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()

  useEffect(() => {
    buildRecommendation()
  }, [spotId, faceHeightM, wavePeriodS, waterTempC])

  async function buildRecommendation() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      const heightFt = (faceHeightM ?? 0.9) * 3.28
      const period = wavePeriodS ?? 10

      // Try to get user's quiver
      let boardName: string | null = null
      let boardReason = ''
      let boardType: string | undefined
      let wetsuitName: string | null = null
      let wetsuitReason = ''
      let wetsuitThickness: string | undefined
      let isPersonalized = false

      if (user) {
        const [{ data: boards }, { data: wetsuits }] = await Promise.all([
          supabase.from('boards').select('*').eq('user_id', user.id).eq('active', true)
            .order('primary_board', { ascending: false }),
          supabase.from('wetsuits').select('*').eq('user_id', user.id).eq('active', true),
        ])

        // Board match from quiver
        if (boards && boards.length > 0) {
          isPersonalized = true
          const boardTypes = getBoardTypeForConditions(heightFt, period)
          const preferredTypes = boardTypes.types.map(t => t.toLowerCase())

          // Find board with matching wave range first
          let matched = boards.find(b =>
            b.best_wave_min_ft && b.best_wave_max_ft &&
            heightFt >= b.best_wave_min_ft && heightFt <= b.best_wave_max_ft
          )

          if (!matched) {
            // Match by type preference
            for (const pref of preferredTypes) {
              matched = boards.find(b => b.board_type === pref)
              if (matched) break
            }
          }

          if (!matched) matched = boards[0] // fallback to primary

          boardName = matched.name
          boardType = matched.board_type
          boardReason = matched.best_wave_min_ft && matched.best_wave_max_ft
            ? `Dialed in for ${matched.best_wave_min_ft}–${matched.best_wave_max_ft}ft conditions`
            : boardTypes.reason
        }

        // Wetsuit match from quiver
        const waterF = waterTempC != null ? waterTempC * 9 / 5 + 32 : null
        if (wetsuits && wetsuits.length > 0 && waterF != null) {
          isPersonalized = true
          const wsMatch = wetsuits.find(ws =>
            ws.temp_min_f && ws.temp_max_f &&
            waterF >= ws.temp_min_f && waterF <= ws.temp_max_f
          )
          if (wsMatch) {
            wetsuitName = wsMatch.name
            wetsuitThickness = wsMatch.thickness
            wetsuitReason = `Rated ${wsMatch.temp_min_f}–${wsMatch.temp_max_f}°F, water is ${waterF.toFixed(0)}°F`
          }
        }
      }

      // Fill gaps with generic recommendations
      if (!boardName) {
        const bt = getBoardTypeForConditions(heightFt, period)
        boardName = bt.types[0]
        boardReason = bt.reason
        boardType = bt.types[0].toLowerCase()
      }

      if (!wetsuitName) {
        const waterF = waterTempC != null ? waterTempC * 9 / 5 + 32 : null
        if (waterF != null) {
          const ws = getWetsuitForTemp(waterF)
          wetsuitName = ws.thickness
          wetsuitThickness = ws.thickness
          wetsuitReason = `${ws.desc} — water is ${waterF.toFixed(0)}°F`
        } else {
          wetsuitName = null
          wetsuitReason = 'Check local buoy for water temperature'
        }
      }

      setRec({
        board_name: boardName,
        board_reason: boardReason,
        board_type: boardType,
        wetsuit_name: wetsuitName,
        wetsuit_reason: wetsuitReason,
        wetsuit_thickness: wetsuitThickness,
        water_temp_f: waterTempC != null ? waterTempC * 9 / 5 + 32 : null,
        conditions_summary: `${heightFt.toFixed(0)}ft @ ${period.toFixed(0)}s`,
        is_personalized: isPersonalized,
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        <div className="h-14 bg-[var(--paper-sunken)] rounded-xl" />
        <div className="h-14 bg-[var(--paper-sunken)] rounded-xl" />
      </div>
    )
  }

  if (!rec) return null

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--spray)]">
          {rec.is_personalized ? '🎯 From your quiver' : '📖 Generic recommendation'}
        </span>
        <span className="text-xs text-[var(--deep-text)]">{rec.conditions_summary}</span>
      </div>

      {/* Board recommendation */}
      <div className="bg-[var(--paper-sunken)] rounded-xl p-3 flex items-center gap-3">
        <div className="text-2xl w-8 text-center shrink-0">🏄</div>
        <div className="flex-1 min-w-0">
          <div className="text-[var(--foam)] font-medium text-sm truncate">{rec.board_name}</div>
          <div className="text-[var(--spray)] text-xs leading-snug mt-0.5">{rec.board_reason}</div>
        </div>
      </div>

      {/* Wetsuit recommendation */}
      <div className="bg-[var(--paper-sunken)] rounded-xl p-3 flex items-center gap-3">
        <div className="text-2xl w-8 text-center shrink-0">🤿</div>
        <div className="flex-1 min-w-0">
          <div className="text-[var(--foam)] font-medium text-sm truncate">
            {rec.wetsuit_name ?? 'Wetsuit data unavailable'}
          </div>
          <div className="text-[var(--spray)] text-xs leading-snug mt-0.5">{rec.wetsuit_reason}</div>
        </div>
        {rec.water_temp_f != null && (
          <div className="text-right shrink-0">
            <div className="text-blue-700 font-bold text-sm">{rec.water_temp_f.toFixed(0)}°F</div>
            <div className="text-[var(--deep-text)] text-xs">water</div>
          </div>
        )}
      </div>

      {!rec.is_personalized && (
        <p className="text-xs text-[var(--deep-text)] text-center">
          Add your boards &amp; wetsuits in{' '}
          <a href="/profile#quiver" className="text-blue-600 hover:text-blue-700">your profile</a>
          {' '}for personalized picks
        </p>
      )}
    </div>
  )
}
