'use client'

import { useState, useCallback } from 'react'
import { useSavedSpots } from '@/lib/useSavedSpots'

interface CurrentConditions {
  wave_height_face_m?: number | null
  wave_height_m?: number | null
  wave_period_s?: number | null
  wind_speed_ms?: number | null
  wind_direction?: number | null
  quality_score?: number | null
  forecast_time?: string | null
  water_temp_c?: number | null
}

interface SpotActionsProps {
  spotSlug: string
  spotName: string
  region: string
  currentConditions?: CurrentConditions | null
}

function toCardinal(deg?: number | null): string {
  if (deg == null) return ''
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

function buildShareText(
  spotName: string,
  region: string,
  cond?: CurrentConditions | null,
): string {
  if (!cond) {
    return `📍 ${spotName} — ${region}\nCheck it out on Peakcast app`
  }

  const lines: string[] = []
  lines.push(`📍 ${spotName} — ${region}`)

  // Day + date from forecast_time if available
  if (cond.forecast_time) {
    const d = new Date(cond.forecast_time)
    const dayStr = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    lines.push(dayStr)
  }

  // Wave height + period
  const hM = cond.wave_height_face_m ?? cond.wave_height_m
  if (hM != null && cond.wave_period_s != null) {
    const hFt = Math.round(hM * 3.281)
    const period = Math.round(cond.wave_period_s)
    lines.push(`🌊 ${hFt}ft @ ${period}s`)
  } else if (hM != null) {
    lines.push(`🌊 ${Math.round(hM * 3.281)}ft`)
  }

  // Wind
  if (cond.wind_speed_ms != null) {
    const kt = Math.round(cond.wind_speed_ms * 1.944)
    const cardinal = toCardinal(cond.wind_direction)
    lines.push(`💨 ${kt}kt${cardinal ? ` ${cardinal}` : ''}`)
  }

  // Quality
  if (cond.quality_score != null) {
    lines.push(`⭐ Quality: ${cond.quality_score.toFixed(1)}/10`)
  }

  lines.push('—')
  lines.push('via Peakcast app')

  return lines.join('\n')
}

export default function SpotActions({
  spotSlug,
  spotName,
  region,
  currentConditions,
}: SpotActionsProps) {
  const { isSaved, toggle } = useSavedSpots()
  const saved = isSaved('spots', spotSlug)
  const [copied, setCopied] = useState(false)

  const handleBookmark = useCallback(() => {
    toggle('spots', spotSlug)
  }, [toggle, spotSlug])

  const handleShare = useCallback(async () => {
    const text = buildShareText(spotName, region, currentConditions)
    const shareData = {
      title: `${spotName} — Peakcast Forecast`,
      text,
      url: window.location.href,
    }

    // Try Web Share API first (mobile / supported browsers)
    if (typeof navigator.share === 'function' && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch (err) {
        // User dismissed the share sheet — don't fall through to clipboard
        if (err instanceof Error && err.name === 'AbortError') return
        // Other share error — fall through to clipboard
      }
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      // Last-resort textarea fallback for browsers that block clipboard API
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [spotName, region, currentConditions])

  const btnBase: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '8px 12px',
    borderRadius: 8,
    background: 'rgba(6,182,212,0.08)',
    border: '1px solid rgba(6,182,212,0.15)',
    cursor: 'pointer',
    transition: 'background 0.15s, border-color 0.15s',
    lineHeight: 1,
  }

  const btnSaved: React.CSSProperties = {
    ...btnBase,
    background: 'rgba(6,182,212,0.18)',
    border: '1px solid rgba(6,182,212,0.4)',
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        {/* Bookmark */}
        <button
          onClick={handleBookmark}
          style={saved ? btnSaved : btnBase}
          title={saved ? 'Remove bookmark' : 'Bookmark this spot'}
          aria-label={saved ? 'Remove bookmark' : 'Bookmark this spot'}
        >
          {saved ? (
            // Filled heart
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#06B6D4" stroke="none">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          ) : (
            // Outline heart
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          )}
        </button>

        {/* Share / Copy */}
        <button
          onClick={handleShare}
          style={{ ...( copied ? btnSaved : btnBase), gap: 6 }}
          title="Share forecast"
          aria-label="Share forecast"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#06B6D4" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 600,
            color: '#06B6D4',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            {copied ? 'Copied!' : 'Share'}
          </span>
        </button>
      </div>

      {/* "Copied!" toast */}
      {copied && (
        <div
          style={{
            position: 'fixed',
            bottom: 80,
            right: 24,
            zIndex: 9999,
            background: 'rgba(6,182,212,0.15)',
            border: '1px solid rgba(6,182,212,0.3)',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 12,
            color: '#06B6D4',
            fontFamily: 'var(--font-data)',
            letterSpacing: '0.04em',
            pointerEvents: 'none',
            animation: 'fadeInUp 0.15s ease-out',
          }}
        >
          Copied!
        </div>
      )}
    </>
  )
}
