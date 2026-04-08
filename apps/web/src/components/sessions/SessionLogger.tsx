'use client'

/**
 * SessionLogger — Modal form for logging a surf session.
 * Auto-fills conditions from the current forecast if spot_id provided.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SessionFormData {
  spot_id: string
  spot_name: string
  session_date: string
  wave_height_face_m?: number
  wave_period_s?: number
  quality_rating: number
  crowd_rating: number
  notes: string
}

interface SessionLoggerProps {
  spots: Array<{ id: string; name: string; slug: string }>
  prefilledSpotId?: string
  prefilledConditions?: {
    wave_height_face_m?: number
    wave_period_s?: number
  }
  onSuccess?: (info: { spotSlug: string; spotName: string; sessionDate: string }) => void
  onClose?: () => void
}

const QUALITY_LABELS: Record<number, string> = {
  1: 'Terrible', 2: 'Bad', 3: 'Poor', 4: 'Below avg', 5: 'Average',
  6: 'Good', 7: 'Very good', 8: 'Excellent', 9: 'Epic', 10: 'All-time',
}

const CROWD_LABELS: Record<number, string> = {
  1: 'Empty', 2: 'Few out', 3: 'Moderate', 4: 'Crowded', 5: 'Packed',
}

export default function SessionLogger({
  spots,
  prefilledSpotId,
  prefilledConditions,
  onSuccess,
  onClose,
}: SessionLoggerProps) {
  const [form, setForm] = useState<SessionFormData>({
    spot_id: prefilledSpotId || '',
    spot_name: spots.find(s => s.id === prefilledSpotId)?.name || '',
    session_date: new Date().toISOString().split('T')[0],
    wave_height_face_m: prefilledConditions?.wave_height_face_m,
    wave_period_s: prefilledConditions?.wave_period_s,
    quality_rating: 5,
    crowd_rating: 3,
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update<K extends keyof SessionFormData>(key: K, value: SessionFormData[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.spot_id) {
      setError('Please select a spot')
      return
    }
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        // Save to localStorage as guest session
        const existing = JSON.parse(localStorage.getItem('terrain_guest_sessions') || '[]')
        const guestSession = {
          id: `guest-${Date.now()}`,
          spot_id: form.spot_id,
          spots: { name: form.spot_name, slug: form.spot_id },
          session_date: form.session_date,
          wave_height_face_m: form.wave_height_face_m || null,
          wave_period_s: form.wave_period_s || null,
          quality_rating: form.quality_rating,
          crowd_rating: form.crowd_rating,
          notes: form.notes || null,
        }
        localStorage.setItem('terrain_guest_sessions', JSON.stringify([guestSession, ...existing]))
        const spot = spots.find(s => s.id === form.spot_id)
        onSuccess?.({
          spotSlug: spot?.slug ?? form.spot_id,
          spotName: form.spot_name,
          sessionDate: form.session_date,
        })
        onClose?.()
        return
      }

      const { error: insertError } = await supabase.from('user_sessions').insert({
        user_id: user.id,
        spot_id: form.spot_id,
        session_date: form.session_date,
        wave_height_face_m: form.wave_height_face_m || null,
        wave_period_s: form.wave_period_s || null,
        quality_rating: form.quality_rating,
        crowd_rating: form.crowd_rating,
        notes: form.notes || null,
      })

      if (insertError) throw insertError

      const spot = spots.find(s => s.id === form.spot_id)
      onSuccess?.({
        spotSlug: spot?.slug ?? form.spot_id,
        spotName: form.spot_name,
        sessionDate: form.session_date,
      })
      onClose?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save session')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-gray-800">
          <h2 className="text-lg font-semibold text-white">Log Session</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Spot selector */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Spot *</label>
            <select
              value={form.spot_id}
              onChange={e => {
                const spot = spots.find(s => s.id === e.target.value)
                update('spot_id', e.target.value)
                update('spot_name', spot?.name || '')
              }}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            >
              <option value="">Select a spot...</option>
              {spots.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Date</label>
            <input
              type="date"
              value={form.session_date}
              onChange={e => update('session_date', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Conditions (optional) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Wave height (m)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="15"
                value={form.wave_height_face_m ?? ''}
                onChange={e => update('wave_height_face_m', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g. 1.5"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Period (s)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="30"
                value={form.wave_period_s ?? ''}
                onChange={e => update('wave_period_s', e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="e.g. 12"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600"
              />
            </div>
          </div>

          {/* Quality rating */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Session quality: <span className="text-white font-medium">{form.quality_rating}/10 — {QUALITY_LABELS[form.quality_rating]}</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.quality_rating}
              onChange={e => update('quality_rating', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>

          {/* Crowd rating */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Crowd: <span className="text-white font-medium">{form.crowd_rating}/5 — {CROWD_LABELS[form.crowd_rating]}</span>
            </label>
            <input
              type="range"
              min={1}
              max={5}
              value={form.crowd_rating}
              onChange={e => update('crowd_rating', parseInt(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={e => update('notes', e.target.value)}
              rows={3}
              placeholder="How was it? Any observations about the break, crowds, conditions..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 placeholder-gray-600 resize-none"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg py-2.5 text-sm font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors"
            >
              {saving ? 'Saving...' : 'Log Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
