'use client'

import { useState, useEffect } from 'react'
import { useLocation, dismissLocationPrompt, isLocationPromptDismissed } from '@/lib/location'

export default function LocationPermissionPrompt() {
  const { permission, requestLocation, locating } = useLocation()
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(true) // start hidden, check on mount

  useEffect(() => {
    // Only show after checking localStorage (avoids flash on SSR)
    setDismissed(isLocationPromptDismissed())
  }, [])

  useEffect(() => {
    // Show after 1.5s if permission is 'prompt' and not dismissed
    if (permission === 'prompt' && !dismissed) {
      const t = setTimeout(() => setVisible(true), 1500)
      return () => clearTimeout(t)
    } else {
      setVisible(false)
    }
  }, [permission, dismissed])

  if (!visible) return null

  function handleEnable() {
    requestLocation()
    setVisible(false)
  }

  function handleDismiss() {
    dismissLocationPrompt()
    setDismissed(true)
    setVisible(false)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={handleDismiss}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.4)',
          backdropFilter: 'blur(4px)',
          animation: 'loc-fade-in 0.2s ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 101,
        background: 'var(--paper-raised)',
        border: '1px solid var(--tile-border-strong)',
        borderBottom: 'none',
        borderRadius: '20px 20px 0 0',
        padding: '24px 24px 40px',
        maxWidth: 480,
        margin: '0 auto',
        boxShadow: '0 -12px 40px rgba(18,24,31,0.16)',
        animation: 'loc-slide-up 0.35s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        {/* Handle bar */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'var(--tile-border-strong)',
          margin: '-8px auto 20px',
        }} />

        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 16,
          background: 'var(--cyan-muted)',
          border: '1px solid rgba(14,165,233,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 16,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="3" fill="#0EA5E9"/>
            <circle cx="12" cy="12" r="7" stroke="#0EA5E9" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.5"/>
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="#0EA5E9" strokeWidth="1.5" strokeLinecap="round" opacity="0.4"/>
          </svg>
        </div>

        {/* Copy */}
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20, fontWeight: 800,
          color: 'var(--foam)', letterSpacing: '-0.01em',
          marginBottom: 8,
        }}>
          Find surf near you
        </h2>
        <p style={{
          fontFamily: 'var(--font-data)', fontSize: 12,
          color: 'var(--spray)', lineHeight: 1.7,
          marginBottom: 24, letterSpacing: '0.01em',
        }}>
          Enable location to see spots sorted by distance, get auto-selected to your nearest break, and track live conditions around you.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={handleEnable}
            disabled={locating}
            style={{
              width: '100%', padding: '14px 0', borderRadius: 12,
              background: locating ? 'var(--cyan-dim)' : 'var(--cyan)',
              border: 'none', cursor: locating ? 'default' : 'pointer',
              fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800,
              color: '#fff', letterSpacing: '0.01em',
              boxShadow: locating ? 'none' : '0 4px 20px rgba(14,165,233,0.3)',
              transition: 'all 0.15s',
            }}
          >
            {locating ? 'Getting location\u2026' : '\uD83D\uDCCD Enable Location'}
          </button>

          <button
            onClick={handleDismiss}
            style={{
              width: '100%', padding: '12px 0', borderRadius: 12,
              background: 'transparent', border: '1px solid var(--tile-border-strong)',
              cursor: 'pointer',
              fontFamily: 'var(--font-data)', fontSize: 12,
              color: 'var(--deep-text)', letterSpacing: '0.04em',
            }}
          >
            Not now
          </button>
        </div>
      </div>

      <style>{`
        @keyframes loc-fade-in { from { opacity:0 } to { opacity:1 } }
        @keyframes loc-slide-up { from { transform:translateY(100%) } to { transform:translateY(0) } }
      `}</style>
    </>
  )
}
