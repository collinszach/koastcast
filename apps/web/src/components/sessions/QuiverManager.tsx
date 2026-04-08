'use client'

/**
 * Quiver Manager
 *
 * Lets surfers register their boards and wetsuits.
 * Stored in Supabase (boards + wetsuits tables).
 * Used by GearRecommendation to give personalized picks.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Board {
  id: string
  name: string
  brand?: string
  model?: string
  length_ft?: number
  volume_L?: number
  board_type: string
  best_wave_min_ft?: number
  best_wave_max_ft?: number
  active: boolean
  primary_board: boolean
}

interface Wetsuit {
  id: string
  name: string
  brand?: string
  thickness: string
  temp_min_f?: number
  temp_max_f?: number
  booties: boolean
  gloves: boolean
  hood: boolean
  active: boolean
}

const BOARD_TYPES = [
  'shortboard', 'longboard', 'fish', 'funboard', 'egg', 'gun', 'SUP', 'bodyboard', 'foil', 'other'
]

const WETSUIT_THICKNESSES = [
  '6/5/4', '5/4/3', '4/3', '3/2', '2/2', '1mm', 'spring', 'boardshorts'
]

export default function QuiverManager() {
  const [boards, setBoards] = useState<Board[]>([])
  const [wetsuits, setWetsuits] = useState<Wetsuit[]>([])
  const [loading, setLoading] = useState(true)
  const [isGuest, setIsGuest] = useState(false)
  const [tab, setTab] = useState<'boards' | 'wetsuits'>('boards')
  const [showAddBoard, setShowAddBoard] = useState(false)
  const [showAddWetsuit, setShowAddWetsuit] = useState(false)
  const [saving, setSaving] = useState(false)

  const [newBoard, setNewBoard] = useState({
    name: '', brand: '', model: '', length_ft: '', volume_L: '',
    board_type: 'shortboard', best_wave_min_ft: '', best_wave_max_ft: '',
  })
  const [newWetsuit, setNewWetsuit] = useState({
    name: '', brand: '', thickness: '3/2',
    temp_min_f: '', temp_max_f: '',
    booties: false, gloves: false, hood: false,
  })

  const supabase = createClient()

  useEffect(() => {
    loadQuiver()
  }, [])

  async function loadQuiver() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setIsGuest(true)
        setLoading(false)
        return
      }

      const [{ data: boardData }, { data: wsData }] = await Promise.all([
        supabase.from('boards').select('*').eq('user_id', user.id).eq('active', true),
        supabase.from('wetsuits').select('*').eq('user_id', user.id).eq('active', true),
      ])

      setBoards((boardData ?? []) as Board[])
      setWetsuits((wsData ?? []) as Wetsuit[])
    } catch {
      // DB not available
    } finally {
      setLoading(false)
    }
  }

  async function saveBoard() {
    if (!newBoard.name) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('boards').insert({
        user_id: user.id,
        name: newBoard.name,
        brand: newBoard.brand || null,
        model: newBoard.model || null,
        length_ft: newBoard.length_ft ? parseFloat(newBoard.length_ft) : null,
        volume_L: newBoard.volume_L ? parseFloat(newBoard.volume_L) : null,
        board_type: newBoard.board_type,
        best_wave_min_ft: newBoard.best_wave_min_ft ? parseFloat(newBoard.best_wave_min_ft) : null,
        best_wave_max_ft: newBoard.best_wave_max_ft ? parseFloat(newBoard.best_wave_max_ft) : null,
        primary_board: boards.length === 0,
      })

      if (!error) {
        setNewBoard({ name: '', brand: '', model: '', length_ft: '', volume_L: '', board_type: 'shortboard', best_wave_min_ft: '', best_wave_max_ft: '' })
        setShowAddBoard(false)
        await loadQuiver()
      }
    } finally {
      setSaving(false)
    }
  }

  async function saveWetsuit() {
    if (!newWetsuit.name) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from('wetsuits').insert({
        user_id: user.id,
        name: newWetsuit.name,
        brand: newWetsuit.brand || null,
        thickness: newWetsuit.thickness,
        temp_min_f: newWetsuit.temp_min_f ? parseFloat(newWetsuit.temp_min_f) : null,
        temp_max_f: newWetsuit.temp_max_f ? parseFloat(newWetsuit.temp_max_f) : null,
        booties: newWetsuit.booties,
        gloves: newWetsuit.gloves,
        hood: newWetsuit.hood,
      })

      if (!error) {
        setNewWetsuit({ name: '', brand: '', thickness: '3/2', temp_min_f: '', temp_max_f: '', booties: false, gloves: false, hood: false })
        setShowAddWetsuit(false)
        await loadQuiver()
      }
    } finally {
      setSaving(false)
    }
  }

  async function retireBoard(id: string) {
    await supabase.from('boards').update({ active: false }).eq('id', id)
    await loadQuiver()
  }

  async function retireWetsuit(id: string) {
    await supabase.from('wetsuits').update({ active: false }).eq('id', id)
    await loadQuiver()
  }

  if (loading) {
    return <div className="animate-pulse space-y-2">
      {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-800 rounded-lg" />)}
    </div>
  }

  if (isGuest) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--spray)', fontSize: 13 }}>
        Sign in to manage your quiver — boards and wetsuits help us recommend the right gear for the forecast.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2">
        {(['boards', 'wetsuits'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >
            {t === 'boards' ? `🏄 Boards (${boards.length})` : `🤿 Wetsuits (${wetsuits.length})`}
          </button>
        ))}
      </div>

      {/* Boards tab */}
      {tab === 'boards' && (
        <div className="space-y-2">
          {boards.map(board => (
            <div key={board.id} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{board.name}</span>
                  {board.primary_board && (
                    <span className="text-xs bg-blue-900 text-blue-300 px-1.5 py-0.5 rounded">primary</span>
                  )}
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{board.board_type}</span>
                </div>
                <div className="text-gray-500 text-xs mt-0.5 flex gap-3">
                  {board.length_ft && <span>{board.length_ft}ft</span>}
                  {board.volume_L && <span>{board.volume_L}L</span>}
                  {board.best_wave_min_ft && board.best_wave_max_ft && (
                    <span>Best: {board.best_wave_min_ft}–{board.best_wave_max_ft}ft</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => retireBoard(board.id)}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors"
              >
                retire
              </button>
            </div>
          ))}

          {!showAddBoard ? (
            <button
              onClick={() => setShowAddBoard(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl p-3 text-gray-400 text-sm transition-colors"
            >
              + Add board
            </button>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium text-white mb-2">Add board</div>

              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                placeholder="Name (e.g. 'my fish', 'the step-up') *"
                value={newBoard.name}
                onChange={e => setNewBoard(p => ({ ...p, name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Brand"
                  value={newBoard.brand}
                  onChange={e => setNewBoard(p => ({ ...p, brand: e.target.value }))}
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Model"
                  value={newBoard.model}
                  onChange={e => setNewBoard(p => ({ ...p, model: e.target.value }))}
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Length (ft, e.g. 6.2)"
                  value={newBoard.length_ft}
                  onChange={e => setNewBoard(p => ({ ...p, length_ft: e.target.value }))}
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Volume (L, e.g. 34.5)"
                  value={newBoard.volume_L}
                  onChange={e => setNewBoard(p => ({ ...p, volume_L: e.target.value }))}
                />
              </div>

              <select
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                value={newBoard.board_type}
                onChange={e => setNewBoard(p => ({ ...p, board_type: e.target.value }))}
              >
                {BOARD_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Best conditions min (ft)"
                  value={newBoard.best_wave_min_ft}
                  onChange={e => setNewBoard(p => ({ ...p, best_wave_min_ft: e.target.value }))}
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Best conditions max (ft)"
                  value={newBoard.best_wave_max_ft}
                  onChange={e => setNewBoard(p => ({ ...p, best_wave_max_ft: e.target.value }))}
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveBoard}
                  disabled={saving || !newBoard.name}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Add board'}
                </button>
                <button
                  onClick={() => setShowAddBoard(false)}
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Wetsuits tab */}
      {tab === 'wetsuits' && (
        <div className="space-y-2">
          {wetsuits.map(ws => (
            <div key={ws.id} className="bg-gray-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium text-sm">{ws.name}</span>
                  <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">{ws.thickness}</span>
                </div>
                <div className="text-gray-500 text-xs mt-0.5 flex gap-3">
                  {ws.temp_min_f && ws.temp_max_f && (
                    <span>{ws.temp_min_f}–{ws.temp_max_f}°F</span>
                  )}
                  {ws.booties && <span>booties</span>}
                  {ws.gloves && <span>gloves</span>}
                  {ws.hood && <span>hood</span>}
                </div>
              </div>
              <button
                onClick={() => retireWetsuit(ws.id)}
                className="text-gray-600 hover:text-red-400 text-xs transition-colors"
              >
                retire
              </button>
            </div>
          ))}

          {!showAddWetsuit ? (
            <button
              onClick={() => setShowAddWetsuit(true)}
              className="w-full bg-gray-800 hover:bg-gray-700 border border-dashed border-gray-600 rounded-xl p-3 text-gray-400 text-sm transition-colors"
            >
              + Add wetsuit
            </button>
          ) : (
            <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 space-y-3">
              <div className="text-sm font-medium text-white mb-2">Add wetsuit</div>

              <input
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                placeholder="Name (e.g. '4/3 winter suit') *"
                value={newWetsuit.name}
                onChange={e => setNewWetsuit(p => ({ ...p, name: e.target.value }))}
              />

              <div className="grid grid-cols-2 gap-2">
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Brand"
                  value={newWetsuit.brand}
                  onChange={e => setNewWetsuit(p => ({ ...p, brand: e.target.value }))}
                />
                <select
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm"
                  value={newWetsuit.thickness}
                  onChange={e => setNewWetsuit(p => ({ ...p, thickness: e.target.value }))}
                >
                  {WETSUIT_THICKNESSES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Min temp (°F)"
                  value={newWetsuit.temp_min_f}
                  onChange={e => setNewWetsuit(p => ({ ...p, temp_min_f: e.target.value }))}
                />
                <input
                  className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500"
                  placeholder="Max temp (°F)"
                  value={newWetsuit.temp_max_f}
                  onChange={e => setNewWetsuit(p => ({ ...p, temp_max_f: e.target.value }))}
                />
              </div>

              <div className="flex gap-4">
                {(['booties', 'gloves', 'hood'] as const).map(acc => (
                  <label key={acc} className="flex items-center gap-1.5 text-sm text-gray-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={newWetsuit[acc]}
                      onChange={e => setNewWetsuit(p => ({ ...p, [acc]: e.target.checked }))}
                      className="rounded"
                    />
                    {acc}
                  </label>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={saveWetsuit}
                  disabled={saving || !newWetsuit.name}
                  className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2 text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving…' : 'Add wetsuit'}
                </button>
                <button
                  onClick={() => setShowAddWetsuit(false)}
                  className="px-4 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
