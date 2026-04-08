'use client'

/**
 * /spots/submit — Community spot submission form.
 * Any authenticated user can submit a new surf spot for review.
 * Submissions go into the spots table with status='pending'.
 * Admin reviews via Supabase Studio and sets status='active'.
 */

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { trackSpotSubmission } from '@/lib/analytics'

const BREAK_TYPES = ['beach', 'reef', 'point', 'rivermouth', 'jetty']
const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const DIR_DEGREES: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
}

interface FormData {
  name: string
  region: string
  lat: string
  lng: string
  break_type: string
  optimal_swell_direction: string
  optimal_wind_direction: string
  nearest_buoy_id: string
  description: string
}

const EMPTY: FormData = {
  name: '', region: '', lat: '', lng: '',
  break_type: 'beach',
  optimal_swell_direction: 'W',
  optimal_wind_direction: 'E',
  nearest_buoy_id: '',
  description: '',
}

export default function SubmitSpotPage() {
  const [form, setForm] = useState<FormData>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof FormData>(k: K, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const lat = parseFloat(form.lat)
    const lng = parseFloat(form.lng)

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Invalid coordinates. Latitude must be −90 to 90, longitude −180 to 180.')
      setSubmitting(false)
      return
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setError('You must be signed in to submit a spot.')
        setSubmitting(false)
        return
      }

      const slug = form.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        + '-' + form.region.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 6)

      const { error: insertError } = await supabase.from('spots').insert({
        name: form.name.trim(),
        slug: slug + '-' + Math.random().toString(36).slice(2, 6),  // ensure uniqueness
        region: form.region.trim(),
        country: 'US',
        location: `POINT(${lng} ${lat})`,
        break_type: form.break_type,
        optimal_swell_direction: DIR_DEGREES[form.optimal_swell_direction],
        optimal_swell_direction_range: 45,
        optimal_wind_direction: DIR_DEGREES[form.optimal_wind_direction],
        optimal_period_min: 10,
        optimal_period_max: 20,
        optimal_size_min: 1.0,
        optimal_size_max: 3.0,
        nearest_buoy_id: form.nearest_buoy_id.trim() || null,
        description: form.description.trim() || null,
        swan_enabled: false,
        // submitted_by: user.id,   -- add this column in a future migration if desired
        // status: 'pending',       -- add this column in a future migration
      })

      if (insertError) throw insertError

      trackSpotSubmission(form.region)
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed. Try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">🤙</div>
        <h2 className="text-xl font-bold text-white mb-2">Spot submitted!</h2>
        <p className="text-gray-400 text-sm mb-6">
          Thanks for contributing. Our team will review it and add it to the map within 48 hours.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/map" className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors">
            Back to map
          </Link>
          <button
            onClick={() => { setForm(EMPTY); setDone(false) }}
            className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm px-4 py-2 rounded-lg transition-colors"
          >
            Submit another
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6">
      <Link href="/map" className="text-gray-400 hover:text-white text-sm flex items-center gap-1 mb-6 transition-colors">
        ← Back to map
      </Link>

      <h1 className="text-2xl font-bold text-white mb-1">Submit a Spot</h1>
      <p className="text-gray-400 text-sm mb-6">
        Know a break that&apos;s not on the map? Add it. Submissions are reviewed within 48h.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Card title="Spot Info">
          <Field label="Spot name *">
            <input
              required value={form.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Pacifica Pier, CA"
              className="input"
            />
          </Field>
          <Field label="Region / State *">
            <input
              required value={form.region} onChange={e => set('region', e.target.value)}
              placeholder="e.g. Northern California"
              className="input"
            />
          </Field>
          <Field label="Break type">
            <div className="flex flex-wrap gap-2">
              {BREAK_TYPES.map(bt => (
                <button
                  key={bt} type="button"
                  onClick={() => set('break_type', bt)}
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                    form.break_type === bt
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {bt}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card title="Location">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude *">
              <input
                required type="number" step="0.0001" min="-90" max="90"
                value={form.lat} onChange={e => set('lat', e.target.value)}
                placeholder="37.5630"
                className="input"
              />
            </Field>
            <Field label="Longitude *">
              <input
                required type="number" step="0.0001" min="-180" max="180"
                value={form.lng} onChange={e => set('lng', e.target.value)}
                placeholder="-122.5130"
                className="input"
              />
            </Field>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Find coordinates at{' '}
            <a href="https://www.google.com/maps" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
              Google Maps
            </a>
            {' '}→ right-click the spot → copy lat/lng.
          </p>
        </Card>

        <Card title="Wave Characteristics">
          <Field label="Optimal swell direction (where swell comes FROM)">
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map(d => (
                <button
                  key={d} type="button"
                  onClick={() => set('optimal_swell_direction', d)}
                  className={`w-12 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.optimal_swell_direction === d
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Best wind direction (offshore = going out to sea)">
            <div className="flex flex-wrap gap-2">
              {DIRECTIONS.map(d => (
                <button
                  key={d} type="button"
                  onClick={() => set('optimal_wind_direction', d)}
                  className={`w-12 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    form.optimal_wind_direction === d
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </Field>
        </Card>

        <Card title="Data Sources (optional)">
          <Field label="Nearest NDBC buoy ID">
            <input
              value={form.nearest_buoy_id}
              onChange={e => set('nearest_buoy_id', e.target.value)}
              placeholder="e.g. 46026"
              className="input"
            />
            <p className="text-xs text-gray-600 mt-1">
              Find at{' '}
              <a href="https://www.ndbc.noaa.gov" target="_blank" rel="noopener noreferrer" className="text-blue-500">
                ndbc.noaa.gov
              </a>
            </p>
          </Field>
          <Field label="Description">
            <textarea
              value={form.description}
              onChange={e => set('description', e.target.value)}
              rows={3}
              placeholder="Anything useful: sandbars, hazards, parking, crowds..."
              className="input resize-none"
            />
          </Field>
        </Card>

        {error && (
          <div className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit" disabled={submitting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Spot'}
        </button>
      </form>

      <style jsx>{`
        .input {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus { border-color: #3b82f6; }
      `}</style>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-2">{label}</label>
      {children}
    </div>
  )
}
