'use client'

import { useState, useEffect } from 'react'
import type { Spot, SpotCam } from '@/types'

// ─── Cam viewer helpers ──────────────────────────────────────────────────────

function YouTubeCam({ cam }: { cam: SpotCam }) {
  return (
    <iframe
      src={`https://www.youtube.com/embed/${cam.embed_id}?autoplay=1&mute=1&rel=0&modestbranding=1`}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      allow="autoplay; fullscreen; picture-in-picture"
      allowFullScreen
      title={cam.label}
    />
  )
}

function ImageCam({ cam }: { cam: SpotCam }) {
  const [cacheBust, setCacheBust] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setCacheBust(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <img
      src={`${cam.embed_id}?t=${cacheBust}`}
      alt={cam.label}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
      }}
    />
  )
}

function IframeCam({ cam }: { cam: SpotCam }) {
  return (
    <iframe
      src={cam.embed_id}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
      allow="autoplay; fullscreen"
      allowFullScreen
      title={cam.label}
    />
  )
}

// ─── Placeholder ocean scene ─────────────────────────────────────────────────

function OceanPlaceholder() {
  return (
    <svg
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.6 }}
      viewBox="0 0 800 450"
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0A1628" />
          <stop offset="60%" stopColor="#0F2040" />
          <stop offset="100%" stopColor="#152B50" />
        </linearGradient>
        <linearGradient id="ocean" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B3D66" />
          <stop offset="100%" stopColor="#051220" />
        </linearGradient>
        <linearGradient id="wave1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#0891B2" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width="800" height="300" fill="url(#sky)" />
      <ellipse cx="400" cy="280" rx="300" ry="30" fill="#06B6D4" opacity="0.06" />
      <rect y="275" width="800" height="175" fill="url(#ocean)" />
      <path d="M0,200 L80,170 L140,165 L200,175 L260,180 L300,275 L0,275 Z" fill="#061422" opacity="0.8" />
      <path d="M-20,310 C60,295 120,325 200,308 C280,291 340,318 420,305 C500,292 560,315 640,302 C720,289 780,308 820,300 L820,320 C780,315 720,300 640,312 C560,324 500,305 420,318 C340,331 280,308 200,322 C120,336 60,310 -20,322 Z"
        fill="url(#wave1)" />
      <path d="M-20,345 C80,328 160,355 260,340 C360,325 440,350 540,337 C640,324 720,345 820,335 L820,360 C720,368 640,348 540,358 C440,368 360,345 260,358 C160,371 80,348 -20,360 Z"
        fill="rgba(6,182,212,0.2)" />
      <path d="M150,318 C180,305 220,300 260,310 C300,320 320,315 340,308 C360,301 370,295 380,302 C390,309 395,318 400,322 C405,326 395,328 380,325 C365,322 350,315 330,318 C310,321 290,325 270,322 C250,319 220,320 190,325 C165,330 150,325 150,318 Z"
        fill="white" opacity="0.3" />
      <path d="M140,322 C170,318 200,322 240,318 C280,314 310,320 350,316 L360,325 C320,328 285,322 245,326 C205,330 175,327 145,332 Z"
        fill="white" opacity="0.5" />
      {[30,80,150,220,350,420,500,580,640,700,760].map((x, i) => (
        <circle key={i} cx={x} cy={(i % 3) * 30 + 20} r="1" fill="white" opacity={0.3 + (i % 3) * 0.2} />
      ))}
      <circle cx="680" cy="60" r="18" fill="#F1F5F9" opacity="0.15" />
      <circle cx="688" cy="55" r="18" fill="#0A1628" opacity="0.8" />
    </svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SpotCams({ spot }: { spot: Spot }) {
  const hasCams = Array.isArray(spot.cams) && spot.cams.length > 0
  const [activeIndex, setActiveIndex] = useState(0)
  // Initialize as '' to avoid hydration mismatch — set on client after mount
  const [localTime, setLocalTime] = useState('')

  const activeCam = hasCams ? spot.cams![activeIndex] : null

  useEffect(() => {
    const tick = () => {
      setLocalTime(
        new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      )
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  // Reset to first cam when navigating to a different spot
  useEffect(() => {
    setActiveIndex(0)
  }, [spot.slug])

  return (
    <div style={{ marginBottom: 4 }}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          maxHeight: 420,
          borderRadius: 12,
          overflow: 'hidden',
          background: 'linear-gradient(180deg, #0A1628 0%, #060D1A 40%, #081520 100%)',
          border: '1px solid rgba(6,182,212,0.12)',
        }}
      >
        {/* Feed layer */}
        {hasCams && activeCam ? (
          activeCam.type === 'youtube' ? (
            <YouTubeCam cam={activeCam} />
          ) : activeCam.type === 'image' ? (
            <ImageCam cam={activeCam} />
          ) : (
            <IframeCam cam={activeCam} />
          )
        ) : (
          <OceanPlaceholder />
        )}

        {/* Top-left: LIVE badge + cam label */}
        <div style={{
          position: 'absolute',
          top: 14,
          left: 14,
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(6,13,26,0.85)',
            border: '1px solid rgba(6,182,212,0.2)',
            borderRadius: 6,
            padding: '5px 10px',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: hasCams ? '#EF4444' : '#6B7280',
              boxShadow: hasCams ? '0 0 6px #EF4444' : 'none',
              animation: hasCams ? 'pulse 2s infinite' : 'none',
            }} />
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 10,
              fontWeight: 700,
              color: 'var(--foam)',
              letterSpacing: '0.08em',
            }}>{hasCams ? 'LIVE · HD' : 'NO CAM'}</span>
          </div>

          {activeCam && (
            <div style={{
              background: 'rgba(6,13,26,0.75)',
              border: '1px solid rgba(6,182,212,0.12)',
              borderRadius: 6,
              padding: '4px 10px',
            }}>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--foam)',
                fontWeight: 600,
              }}>{activeCam.label}</div>
              {activeCam.angle && (
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  color: 'var(--deep-text)',
                  marginTop: 1,
                }}>{activeCam.angle}</div>
              )}
            </div>
          )}
        </div>

        {/* Top-right: region + local time */}
        <div style={{
          position: 'absolute',
          top: 14,
          right: 14,
          textAlign: 'right',
          pointerEvents: 'none',
          zIndex: 10,
        }}>
          <div style={{
            background: 'rgba(6,13,26,0.75)',
            border: '1px solid rgba(6,182,212,0.12)',
            borderRadius: 6,
            padding: '4px 10px',
          }}>
            <div style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: 'var(--deep-text)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>{spot.region}</div>
            {localTime && (
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'var(--spray)',
                marginTop: 1,
              }}>{localTime}</div>
            )}
          </div>
        </div>

        {/* Bottom: multi-cam tab bar OR no-cam coming-soon banner */}
        {hasCams && spot.cams!.length > 1 ? (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            padding: '10px 14px',
            background: 'linear-gradient(0deg, rgba(6,13,26,0.9) 0%, transparent 100%)',
            zIndex: 10,
          }}>
            {spot.cams!.map((cam, i) => (
              <button
                key={i}
                onClick={() => setActiveIndex(i)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  borderRadius: 6,
                  background: i === activeIndex ? 'rgba(6,182,212,0.15)' : 'rgba(6,13,26,0.5)',
                  border: i === activeIndex
                    ? '1px solid rgba(6,182,212,0.3)'
                    : '1px solid rgba(6,182,212,0.06)',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.15s',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  fontWeight: 600,
                  color: i === activeIndex ? 'var(--cyan-bright)' : 'var(--deep-text)',
                  letterSpacing: '0.04em',
                }}>{cam.label}</div>
              </button>
            ))}
          </div>
        ) : !hasCams ? (
          <div style={{
            position: 'absolute',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10,
          }}>
            <div style={{
              background: 'rgba(6,13,26,0.85)',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: 8,
              padding: '8px 20px',
            }}>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                color: 'var(--spray)',
                letterSpacing: '0.06em',
              }}>
                Cam Partnership Coming Soon
              </div>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 9,
                color: 'var(--deep-text)',
                marginTop: 3,
                letterSpacing: '0.06em',
              }}>
                PEAKCAST CAMS NETWORK · 2026
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
