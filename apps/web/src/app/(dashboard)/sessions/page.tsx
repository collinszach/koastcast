'use client'

/**
 * Sessions page — log sessions + view history.
 */

import { useState } from 'react'
import SessionLogger from '@/components/sessions/SessionLogger'
import SessionHistory from '@/components/sessions/SessionHistory'
import ForecastAccuracyPrompt from '@/components/forecast/ForecastAccuracyPrompt'
import SurfInsights from '@/components/sessions/SurfInsights'

// Hardcoded spot list — in production this would come from the API/Supabase
const SPOTS = [
  { id: 'mavericks-ca', name: 'Mavericks', slug: 'mavericks-ca' },
  { id: 'steamer-lane-ca', name: 'Steamer Lane', slug: 'steamer-lane-ca' },
  { id: 'ocean-beach-sf-ca', name: 'Ocean Beach SF', slug: 'ocean-beach-sf-ca' },
  { id: 'rincon-ca', name: 'Rincon', slug: 'rincon-ca' },
  { id: 'trestles-ca', name: 'Trestles', slug: 'trestles-ca' },
  { id: 'blacks-beach-ca', name: "Blacks Beach", slug: 'blacks-beach-ca' },
  { id: 'sebastian-inlet-fl', name: 'Sebastian Inlet', slug: 'sebastian-inlet-fl' },
  { id: 'outer-banks-nc', name: 'Outer Banks', slug: 'outer-banks-nc' },
  { id: 'montauk-ny', name: 'Montauk', slug: 'montauk-ny' },
]

interface LastSession {
  spotSlug: string
  spotName: string
  sessionDate: string
}

export default function SessionsPage() {
  const [showLogger, setShowLogger] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastSession, setLastSession] = useState<LastSession | null>(null)

  function handleSuccess(info: LastSession) {
    setRefreshCount(c => c + 1)
    setLastSession(info)
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Sessions</h1>
          <p className="text-gray-400 text-sm mt-1">
            Log your surf sessions to train your personalized Stoke Score™
          </p>
        </div>
        <button
          onClick={() => setShowLogger(true)}
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors flex-shrink-0"
        >
          + Log Session
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <StatCard label="Sessions" value="—" />
        <StatCard label="Avg Quality" value="—" />
        <StatCard label="Favorite Spot" value="—" />
      </div>

      {/* Surf Insights — pattern recognition from session history */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-300 mb-1">My Surf Insights</h2>
        <p className="text-xs text-gray-600 mb-4">
          What conditions produce your best sessions?
        </p>
        <SurfInsights />
      </div>

      {/* Session history */}
      <SessionHistory refresh={refreshCount} />

      {/* Session logger modal */}
      {showLogger && (
        <SessionLogger
          spots={SPOTS}
          onSuccess={handleSuccess}
          onClose={() => setShowLogger(false)}
        />
      )}

      {/* Forecast accuracy prompt — shown after logging a session */}
      {lastSession && (
        <ForecastAccuracyPrompt
          spotSlug={lastSession.spotSlug}
          spotName={lastSession.spotName}
          forecastTime={`${lastSession.sessionDate}T12:00:00Z`}
          onDismiss={() => setLastSession(null)}
        />
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-xl font-bold text-white">{value}</div>
    </div>
  )
}
