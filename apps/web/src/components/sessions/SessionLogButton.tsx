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
          background: 'var(--paper-raised)',
          borderTop: '1px solid var(--tile-border-strong)',
          boxShadow: 'var(--tile-shadow)',
          padding: '12px 24px',
          paddingBottom: 'calc(12px + env(safe-area-inset-bottom))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--foam)' }}>
            {spotName}
          </div>
          {conditionsSummary && (
            <div
              style={{
                fontSize: 12,
                color: 'var(--spray)',
                fontFamily: 'var(--font-data)',
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
            background: 'rgba(14,165,233,0.15)',
            border: '1px solid rgba(14,165,233,0.3)',
            color: 'var(--cyan)',
            borderRadius: 10,
            padding: '10px 20px',
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e =>
            (e.currentTarget.style.background = 'rgba(14,165,233,0.25)')
          }
          onMouseLeave={e =>
            (e.currentTarget.style.background = 'rgba(14,165,233,0.15)')
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
