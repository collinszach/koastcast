'use client'

import { useState } from 'react'
import SessionLogger from '@/components/sessions/SessionLogger'
import SessionHistory from '@/components/sessions/SessionHistory'
import ForecastAccuracyPrompt from '@/components/forecast/ForecastAccuracyPrompt'
import SurfInsights from '@/components/sessions/SurfInsights'

const SPOTS = [
  { id: 'mavericks-ca',       name: 'Mavericks',       slug: 'mavericks-ca'       },
  { id: 'steamer-lane-ca',    name: 'Steamer Lane',    slug: 'steamer-lane-ca'    },
  { id: 'ocean-beach-sf-ca',  name: 'Ocean Beach SF',  slug: 'ocean-beach-sf-ca'  },
  { id: 'rincon-ca',          name: 'Rincon',           slug: 'rincon-ca'          },
  { id: 'lower-trestles-ca',  name: 'Trestles',         slug: 'lower-trestles-ca'  },
  { id: 'blacks-beach-ca',    name: "Blacks Beach",     slug: 'blacks-beach-ca'    },
  { id: 'sebastian-inlet-fl', name: 'Sebastian Inlet',  slug: 'sebastian-inlet-fl' },
  { id: 'outer-banks-nc',     name: 'Outer Banks',      slug: 'outer-banks-nc'     },
  { id: 'montauk-ny',         name: 'Montauk',          slug: 'montauk-ny'         },
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

      {/* Header */}
      <div className="flex items-start justify-between mb-7">
        <div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 800,
            color: 'var(--foam)',
            letterSpacing: '-0.02em',
            lineHeight: 1.1,
          }}>Sessions</h1>
          <p style={{ fontSize: 13, color: 'var(--spray)', marginTop: 5 }}>
            Log sessions to train your personalized Stoke Score™
          </p>
        </div>
        <button
          onClick={() => setShowLogger(true)}
          className="btn-ocean flex-shrink-0"
          style={{ padding: '10px 18px', fontSize: 12 }}
        >
          + Log Session
        </button>
      </div>

      {/* My Surf Insights */}
      <div className="glass-card p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              color: 'var(--foam)',
            }}>My Surf Insights</h2>
            <p style={{ fontSize: 11, color: 'var(--deep-text)', marginTop: 3 }}>
              Patterns from your session history
            </p>
          </div>
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            color: 'var(--cyan)',
            background: 'rgba(6,182,212,0.1)',
            border: '1px solid rgba(6,182,212,0.2)',
            padding: '3px 10px',
            borderRadius: 20,
            letterSpacing: '0.08em',
            fontWeight: 600,
          }}>
            AI
          </div>
        </div>
        <SurfInsights />
      </div>

      {/* Session history */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--foam)',
          }}>Session History</h2>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            color: 'var(--deep-text)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}>LOG</span>
        </div>
        <SessionHistory refresh={refreshCount} />
      </div>

      {/* Logger modal */}
      {showLogger && (
        <SessionLogger
          spots={SPOTS}
          onSuccess={handleSuccess}
          onClose={() => setShowLogger(false)}
        />
      )}

      {/* Accuracy prompt */}
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
