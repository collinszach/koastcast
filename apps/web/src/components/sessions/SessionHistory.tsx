'use client'

/**
 * SessionHistory — List view of past surf sessions, grouped by month.
 * Accepts optional filter props to narrow the displayed sessions client-side.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Session {
  id: string
  spot_id?: string | null
  session_date: string
  wave_height_face_m?: number | null
  wave_period_s?: number | null
  quality_rating?: number | null
  crowd_rating?: number | null
  notes?: string | null
  spots?: { name: string; slug: string } | null
  created_at?: string | null
}

export interface SessionHistoryProps {
  refresh?: number
  spotFilter?: string | null
  minRating?: number | null
  searchQuery?: string | null
  /** Called with the full unfiltered session list so the parent can compute stats */
  onSessionsLoaded?: (sessions: Session[]) => void
}

const QUALITY_EMOJIS: Record<number, string> = {
  1: '😤', 2: '😞', 3: '😐', 4: '🙂', 5: '😊',
  6: '😄', 7: '🤙', 8: '🔥', 9: '🚀', 10: '🏆',
}

function formatHeight(m?: number | null) {
  if (m == null) return '?'
  return `${(m * 3.281).toFixed(0)}ft`
}

export default function SessionHistory({
  refresh,
  spotFilter,
  minRating,
  searchQuery,
  onSessionsLoaded,
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          const stored = JSON.parse(localStorage.getItem('koastcast_guest_sessions') || '[]')
          setSessions(stored as Session[])
          onSessionsLoaded?.(stored as Session[])
          setLoading(false)
          return
        }

        const { data, error } = await supabase
          .from('user_sessions')
          .select('*, spots(name, slug)')
          .order('session_date', { ascending: false })
          .limit(50)

        if (!error && data) {
          setSessions(data as Session[])
          onSessionsLoaded?.(data as Session[])
        }
      } catch {
        const stored = JSON.parse(localStorage.getItem('koastcast_guest_sessions') || '[]')
        setSessions(stored as Session[])
        onSessionsLoaded?.(stored as Session[])
      } finally {
        setLoading(false)
      }
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh])

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: 72,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    )
  }

  if (!sessions.length) {
    return <EmptySessionState />
  }

  // Apply client-side filters
  const filtered = sessions.filter(s => {
    if (spotFilter && s.spots?.slug !== spotFilter) return false
    if (minRating && (s.quality_rating ?? 0) < minRating) return false
    if (searchQuery && !s.notes?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const isFiltered = !!spotFilter || !!minRating || !!searchQuery

  // Group filtered sessions by month
  const grouped: Record<string, Session[]> = {}
  for (const s of filtered) {
    const d = new Date(s.session_date)
    const key = d.toLocaleDateString('en', { month: 'long', year: 'numeric' })
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(s)
  }

  return (
    <div>
      {/* Filtered count indicator */}
      {isFiltered && (
        <p style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: 'var(--deep-text)',
          marginBottom: 14,
          letterSpacing: '0.04em',
        }}>
          Showing{' '}
          <span style={{ color: 'var(--cyan)' }}>{filtered.length}</span>
          {' '}of {sessions.length} sessions
        </p>
      )}

      {filtered.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '32px 0',
          color: 'var(--spray)',
          fontSize: 13,
        }}>
          No sessions match your filters.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Object.entries(grouped).map(([month, monthSessions]) => (
          <div key={month}>
            {/* Month label */}
            <h3 style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              fontWeight: 600,
              color: 'var(--deep-text)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>{month}</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {monthSessions.map(session => (
                <div
                  key={session.id}
                  style={{
                    background: 'rgba(6,13,26,0.6)',
                    border: '1px solid rgba(6,182,212,0.08)',
                    borderRadius: 14,
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                      marginBottom: 5,
                    }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--foam)',
                      }}>
                        {session.spots?.name || 'Unknown spot'}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 11,
                        color: 'var(--spray)',
                      }}>
                        {new Date(session.session_date).toLocaleDateString('en', {
                          weekday: 'short', month: 'short', day: 'numeric',
                        })}
                      </span>
                    </div>

                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: 'var(--spray)',
                    }}>
                      {session.wave_height_face_m != null && (
                        <span>{formatHeight(session.wave_height_face_m)}</span>
                      )}
                      {session.wave_period_s != null && (
                        <span>{session.wave_period_s.toFixed(0)}s</span>
                      )}
                      {session.crowd_rating != null && (
                        <span>Crowd {session.crowd_rating}/5</span>
                      )}
                    </div>

                    {session.notes && (
                      <p style={{
                        fontSize: 11,
                        color: 'var(--deep-text)',
                        marginTop: 5,
                        lineHeight: 1.4,
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                      }}>{session.notes}</p>
                    )}
                  </div>

                  {session.quality_rating != null && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: 20 }}>
                        {QUALITY_EMOJIS[session.quality_rating] || '🌊'}
                      </div>
                      <div style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 11,
                        color: 'var(--spray)',
                      }}>
                        {session.quality_rating}/10
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

const GHOST_SESSIONS = [
  { spot: 'Steamer Lane',  date: 'Sat, Mar 15',  height: '6ft', period: '14s', crowd: '3/5', rating: 8,  emoji: '🔥' },
  { spot: 'Ocean Beach SF', date: 'Wed, Mar 12', height: '4ft', period: '11s', crowd: '2/5', rating: 6,  emoji: '😄' },
  { spot: 'Mavericks',     date: 'Sun, Mar 9',   height: '12ft', period: '18s', crowd: '1/5', rating: 9, emoji: '🚀' },
]

const HOW_IT_WORKS = [
  { step: '1', icon: '📍', title: 'Pick a spot', desc: 'Choose from 10 iconic breaks or search by location' },
  { step: '2', icon: '📋', title: 'Log conditions', desc: 'Rate waves, wind, crowd — takes under 30 seconds' },
  { step: '3', icon: '🤙', title: 'Improve accuracy', desc: 'Your sessions train a personalized Peak Score™' },
]

function EmptySessionState() {
  return (
    <div>
      <p style={{
        fontSize: 11,
        color: 'var(--deep-text)',
        textAlign: 'center',
        marginBottom: 14,
        letterSpacing: '0.04em',
      }}>
        No sessions yet — hit the water and come back
      </p>

      <div style={{ position: 'relative', marginBottom: 28 }}>
        {GHOST_SESSIONS.map((s, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(6,13,26,0.6)',
              border: '1px solid rgba(6,182,212,0.08)',
              borderRadius: 14,
              padding: '14px 16px',
              marginBottom: 8,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
              opacity: 0.32,
              filter: 'blur(0.4px)',
              userSelect: 'none',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const, marginBottom: 5 }}>
                <span style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--foam)',
                }}>{s.spot}</span>
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  color: 'var(--spray)',
                }}>{s.date}</span>
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--spray)',
              }}>
                <span>{s.height}</span>
                <span>{s.period}</span>
                <span>Crowd {s.crowd}</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 20 }}>{s.emoji}</div>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--spray)',
              }}>{s.rating}/10</div>
            </div>
          </div>
        ))}

        {/* Overlay */}
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column' as const,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 28 }}>🏄</div>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 11,
            color: 'var(--spray)',
            letterSpacing: '0.06em',
            background: 'rgba(6,13,26,0.7)',
            padding: '4px 12px',
            borderRadius: 20,
          }}>No sessions logged yet</span>
        </div>
      </div>

      {/* How it works */}
      <div style={{
        background: 'rgba(6,13,26,0.5)',
        border: '1px solid rgba(6,182,212,0.1)',
        borderRadius: 12,
        padding: '16px 18px',
      }}>
        <p style={{
          fontFamily: 'var(--font-data)',
          fontSize: 9,
          color: 'var(--deep-text)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase' as const,
          marginBottom: 12,
        }}>How it works</p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
          {HOW_IT_WORKS.map((item) => (
            <div key={item.step} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.18)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 15,
                flexShrink: 0,
              }}>{item.icon}</div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 600,
                  color: 'var(--foam)',
                  marginBottom: 2,
                }}>{item.title}</div>
                <div style={{
                  fontSize: 11,
                  color: 'var(--spray)',
                  lineHeight: 1.5,
                }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
