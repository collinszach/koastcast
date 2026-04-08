'use client'

import { useState } from 'react'
import SessionLogger from './SessionLogger'

interface Props {
  spotSlug: string
  spotName: string
  conditionsSummary: string
  prefilledConditions?: {
    wave_height_face_m?: number
    wave_period_s?: number
  }
}

export default function SessionLogButton({
  spotSlug,
  spotName,
  conditionsSummary,
  prefilledConditions,
}: Props) {
  const [loggerOpen, setLoggerOpen] = useState(false)

  // Build a minimal spots array so SessionLogger can resolve the spot name.
  // spot_id is matched against s.id, so we use slug as the id key — consistent
  // with how guest sessions store spot_id.
  const spots = [{ id: spotSlug, name: spotName, slug: spotSlug }]

  return (
    <>
      {/* Sticky bottom bar */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          background: 'rgba(6,13,26,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          padding: '12px 24px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'white' }}>
            {spotName}
          </div>
          {conditionsSummary && (
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.5)',
                fontFamily: 'var(--font-jetbrains)',
                marginTop: 2,
              }}
            >
              {conditionsSummary}
            </div>
          )}
        </div>

        <button
          onClick={() => setLoggerOpen(true)}
          style={{
            background: 'rgba(6,182,212,0.15)',
            border: '1px solid rgba(6,182,212,0.3)',
            color: '#06B6D4',
            borderRadius: 10,
            padding: '10px 20px',
            fontFamily: 'var(--font-syne)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.background = 'rgba(6,182,212,0.25)')
          }
          onMouseLeave={e =>
            (e.currentTarget.style.background = 'rgba(6,182,212,0.15)')
          }
        >
          📋 LOG SESSION
        </button>
      </div>

      {/* Spacer so page content isn't hidden behind fixed bar */}
      <div style={{ height: 68 }} />

      {/* Session Logger Modal */}
      {loggerOpen && (
        <SessionLogger
          spots={spots}
          prefilledSpotId={spotSlug}
          prefilledConditions={prefilledConditions}
          onClose={() => setLoggerOpen(false)}
          onSuccess={() => setLoggerOpen(false)}
        />
      )}
    </>
  )
}
