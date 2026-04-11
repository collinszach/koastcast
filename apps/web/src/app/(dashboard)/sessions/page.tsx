'use client'

import { useState, useCallback, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
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

interface RawSession {
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

interface SessionStats {
  totalSessions: number
  thisYear: number
  thisMonth: number
  avgRating: number
  avgWaveHeightFt: number
  favoriteSpot: string
  uniqueSpots: number
  bestSession: {
    spotName: string
    date: string
    rating: number
    waveHeight?: number | null
  } | null
}

interface LastSession {
  spotSlug: string
  spotName: string
  sessionDate: string
}

// Rating filter pill definitions
const RATING_PILLS = [
  { label: 'All', value: null },
  { label: '★★★+', value: 7 },
  { label: '★★★★+', value: 8 },
  { label: '★★★★★', value: 9 },
] as const

type RatingValue = null | 7 | 8 | 9

function computeStats(sessions: RawSession[]): SessionStats {
  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()

  let ratingSum = 0
  let ratingCount = 0
  let heightSum = 0
  let heightCount = 0
  let bestSession: SessionStats['bestSession'] = null
  const spotCounts: Record<string, { name: string; count: number }> = {}
  const spotSlugs = new Set<string>()

  for (const s of sessions) {
    const d = new Date(s.session_date)
    const sYear = d.getFullYear()
    const sMonth = d.getMonth()

    // Spot tracking
    const slug = s.spots?.slug || s.spot_id || ''
    const name = s.spots?.name || 'Unknown'
    if (slug) spotSlugs.add(slug)
    if (slug) {
      if (!spotCounts[slug]) spotCounts[slug] = { name, count: 0 }
      spotCounts[slug].count++
    }

    // Ratings
    if (s.quality_rating != null) {
      ratingSum += s.quality_rating
      ratingCount++

      // Best session
      if (!bestSession || s.quality_rating > bestSession.rating) {
        bestSession = {
          spotName: name,
          date: d.toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' }),
          rating: s.quality_rating,
          waveHeight: s.wave_height_face_m,
        }
      }
    }

    // Wave height
    if (s.wave_height_face_m != null) {
      heightSum += s.wave_height_face_m
      heightCount++
    }

    void sYear
    void sMonth
  }

  const countThisYear = sessions.filter(s => new Date(s.session_date).getFullYear() === thisYear).length
  const countThisMonth = sessions.filter(s => {
    const d = new Date(s.session_date)
    return d.getFullYear() === thisYear && d.getMonth() === thisMonth
  }).length

  // Favorite spot
  let favoriteSpot = '—'
  let maxCount = 0
  for (const { name, count } of Object.values(spotCounts)) {
    if (count > maxCount) { maxCount = count; favoriteSpot = name }
  }

  return {
    totalSessions: sessions.length,
    thisYear: countThisYear,
    thisMonth: countThisMonth,
    avgRating: ratingCount > 0 ? Math.round((ratingSum / ratingCount) * 10) / 10 : 0,
    avgWaveHeightFt: heightCount > 0 ? Math.round((heightSum / heightCount) * 3.281 * 10) / 10 : 0,
    favoriteSpot,
    uniqueSpots: spotSlugs.size,
    bestSession,
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({ value, label }: { value: string | number; label: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      padding: '16px 14px',
      flex: '1 1 0',
      minWidth: 0,
      textAlign: 'center',
    }}>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 30,
        fontWeight: 700,
        color: 'var(--foam)',
        lineHeight: 1,
        marginBottom: 6,
        letterSpacing: '-0.02em',
      }}>{value || '—'}</div>
      <div style={{
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 500,
      }}>{label}</div>
    </div>
  )
}

function SkeletonStatCard() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)',
      borderRadius: 12,
      padding: '16px 14px',
      flex: '1 1 0',
      minWidth: 0,
      height: 74,
      animation: 'pulse 1.5s ease-in-out infinite',
    }} />
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SessionsPage() {
  const [showLogger, setShowLogger] = useState(false)
  const [refreshCount, setRefreshCount] = useState(0)
  const [lastSession, setLastSession] = useState<LastSession | null>(null)

  // Stats state
  const [stats, setStats] = useState<SessionStats | null>(null)
  const [allSessions, setAllSessions] = useState<RawSession[]>([])

  // Filter state
  const [spotFilter, setSpotFilter] = useState<string | null>(null)
  const [minRating, setMinRating] = useState<RatingValue>(null)
  const [searchQuery, setSearchQuery] = useState('')

  function handleSuccess(info: LastSession) {
    setRefreshCount(c => c + 1)
    setLastSession(info)
  }

  // Callback from SessionHistory once it fetches sessions
  const handleSessionsLoaded = useCallback((sessions: RawSession[]) => {
    setAllSessions(sessions)
    setStats(computeStats(sessions))
  }, [])

  // Unique spot slugs present in the loaded sessions for the filter dropdown
  const uniqueSpotOptions = Array.from(
    new Map(
      allSessions
        .filter(s => s.spots?.slug)
        .map(s => [s.spots!.slug, s.spots!.name])
    ).entries()
  ).sort((a, b) => a[1].localeCompare(b[1]))

  const statsLoaded = stats !== null

  // ── Analytics chart data ──────────────────────────────────────────────────

  const monthlyData = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
      return {
        month: d.toLocaleString('en', { month: 'short' }),
        count: 0,
        key: `${d.getFullYear()}-${d.getMonth()}`,
      }
    })
    for (const s of allSessions) {
      const d = new Date(s.session_date)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const entry = months.find(m => m.key === key)
      if (entry) entry.count++
    }
    return months
  }, [allSessions])

  const qualityDistData = useMemo(() => {
    return Array.from({ length: 10 }, (_, i) => ({
      rating: i + 1,
      count: allSessions.filter(s => s.quality_rating === i + 1).length,
    }))
  }, [allSessions])

  const spotAffinityData = useMemo(() => {
    const spotCounts: Record<string, { name: string; count: number }> = {}
    for (const s of allSessions) {
      const slug = s.spots?.slug || s.spot_id || ''
      const name = s.spots?.name || 'Unknown'
      if (!slug) continue
      if (!spotCounts[slug]) spotCounts[slug] = { name, count: 0 }
      spotCounts[slug].count++
    }
    return Object.values(spotCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(({ name, count }) => ({
        spot: name.length > 14 ? name.slice(0, 13) + '…' : name,
        count,
      }))
  }, [allSessions])

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-3xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
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
            Log sessions to train your personalized Peak Score™
          </p>
        </div>
        <button
          onClick={() => setShowLogger(true)}
          className="flex-shrink-0"
          style={{
            padding: '10px 20px',
            fontSize: 12,
            fontFamily: 'var(--font-display)',
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: '#0A1628',
            background: 'linear-gradient(135deg, #22D3EE 0%, #06B6D4 60%, #0891B2 100%)',
            border: 'none',
            borderRadius: 10,
            cursor: 'pointer',
            boxShadow: '0 0 0 1px rgba(6,182,212,0.4), 0 4px 20px rgba(6,182,212,0.25)',
            transition: 'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(6,182,212,0.5), 0 8px 28px rgba(6,182,212,0.35)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'
            ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 0 0 1px rgba(6,182,212,0.4), 0 4px 20px rgba(6,182,212,0.25)'
          }}
        >
          + LOG SESSION
        </button>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Stats dashboard                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card p-5 mb-4">
        {/* Stat cards row */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
          {statsLoaded ? (
            <>
              <StatCard value={stats.totalSessions} label="Sessions" />
              <StatCard
                value={stats.avgWaveHeightFt > 0 ? `${stats.avgWaveHeightFt}` : '—'}
                label="Avg ft"
              />
              <StatCard
                value={stats.avgRating > 0 ? stats.avgRating : '—'}
                label="Avg Score"
              />
              <StatCard value={stats.uniqueSpots > 0 ? stats.uniqueSpots : '—'} label="Spots" />
            </>
          ) : (
            <>
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
              <SkeletonStatCard />
            </>
          )}
        </div>

        {/* Secondary totals line */}
        {statsLoaded && stats.totalSessions > 0 && (
          <p style={{
            fontFamily: 'var(--font-data)',
            fontSize: 11,
            color: 'var(--deep-text)',
            letterSpacing: '0.03em',
            marginBottom: stats.bestSession ? 14 : 0,
          }}>
            <span style={{ color: 'var(--foam)' }}>{stats.totalSessions}</span> sessions
            {'  ·  '}
            <span style={{ color: 'var(--foam)' }}>{stats.thisYear}</span> this year
            {'  ·  '}
            <span style={{ color: 'var(--foam)' }}>{stats.thisMonth}</span> this month
          </p>
        )}

        {/* Best session highlight */}
        {statsLoaded && stats.bestSession && (
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            borderRadius: 10,
            padding: '12px 16px',
            borderLeft: '3px solid #06B6D4',
          }}>
            <div style={{
              fontFamily: 'var(--font-data)',
              fontSize: 9,
              color: 'var(--deep-text)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 6,
            }}>Best Session</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 600,
                color: 'var(--foam)',
              }}>
                {stats.bestSession.spotName}
              </span>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--spray)',
              }}>
                {stats.bestSession.date}
              </span>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: '#06B6D4',
                fontWeight: 600,
              }}>
                {stats.bestSession.rating}/10
              </span>
              {stats.bestSession.waveHeight != null && (
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  color: 'var(--spray)',
                }}>
                  {(stats.bestSession.waveHeight * 3.281).toFixed(0)}ft
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Analytics charts — only when ≥ 2 sessions                         */}
      {/* ------------------------------------------------------------------ */}
      {allSessions.length >= 2 && (
        <div style={{
          background: 'rgba(6,12,24,0.85)',
          border: '1px solid rgba(6,182,212,0.08)',
          borderRadius: 16,
          padding: 20,
          marginBottom: 16,
        }}>
          {/* Section label */}
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            color: '#06B6D4',
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            Analytics
          </div>

          {/* Row: Monthly + Quality side by side */}
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 20 }}>

            {/* Chart 1: Monthly Sessions */}
            <div style={{ flex: '1 1 200px', minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>Sessions / Month</div>
              <ResponsiveContainer width="100%" height={140}>
                <BarChart data={monthlyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.08)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 9, fill: '#475569', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: '#475569', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(6,182,212,0.06)' }}
                    contentStyle={{
                      background: 'rgba(6,12,24,0.95)',
                      border: '1px solid rgba(6,182,212,0.2)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: '#e2e8f0',
                    }}
                    itemStyle={{ color: '#06B6D4' }}
                    formatter={(value: number) => [value, 'sessions']}
                  />
                  <Bar dataKey="count" fill="#06B6D4" radius={[3, 3, 0, 0]} maxBarSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Quality Distribution */}
            <div style={{ flex: '1 1 180px', minWidth: 0 }}>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>Quality Distribution</div>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={qualityDistData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.08)" vertical={false} />
                  <XAxis
                    dataKey="rating"
                    tick={{ fontSize: 9, fill: '#475569', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: '#475569', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(6,182,212,0.06)' }}
                    contentStyle={{
                      background: 'rgba(6,12,24,0.95)',
                      border: '1px solid rgba(6,182,212,0.2)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: '#e2e8f0',
                    }}
                    itemStyle={{ color: '#06B6D4' }}
                    formatter={(value: number) => [value, 'sessions']}
                  />
                  <Bar dataKey="count" radius={[3, 3, 0, 0]} maxBarSize={22}>
                    {qualityDistData.map((entry) => {
                      const r = entry.rating
                      const color =
                        r <= 4 ? '#475569' :
                        r <= 6 ? '#3B82F6' :
                        r <= 8 ? '#06B6D4' :
                                 '#F97316'
                      return <Cell key={`qd-${r}`} fill={color} />
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Chart 3: Spot Affinity — only when ≥ 2 unique spots */}
          {(stats?.uniqueSpots ?? 0) >= 2 && spotAffinityData.length >= 2 && (
            <div>
              <div style={{
                fontFamily: 'var(--font-data)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.35)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>Top Spots</div>
              <ResponsiveContainer width="100%" height={spotAffinityData.length * 28 + 16}>
                <BarChart
                  data={spotAffinityData}
                  layout="vertical"
                  margin={{ top: 0, right: 16, left: 4, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(6,182,212,0.08)" horizontal={false} />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    tick={{ fontSize: 9, fill: '#475569', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="spot"
                    width={84}
                    tick={{ fontSize: 9, fill: '#94a3b8', fontFamily: 'var(--font-data)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgba(139,92,246,0.06)' }}
                    contentStyle={{
                      background: 'rgba(6,12,24,0.95)',
                      border: '1px solid rgba(139,92,246,0.25)',
                      borderRadius: 8,
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      color: '#e2e8f0',
                    }}
                    itemStyle={{ color: '#8B5CF6' }}
                    formatter={(value: number) => [value, 'sessions']}
                  />
                  <Bar dataKey="count" fill="#8B5CF6" radius={[0, 3, 3, 0]} maxBarSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* My Surf Insights                                                    */}
      {/* ------------------------------------------------------------------ */}
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

      {/* ------------------------------------------------------------------ */}
      {/* Session history                                                     */}
      {/* ------------------------------------------------------------------ */}
      <div className="glass-card p-5">
        {/* Section header */}
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

        {/* Filter row — only show once sessions are loaded and there are some */}
        {statsLoaded && allSessions.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            marginBottom: 16,
          }}>
            {/* Spot dropdown */}
            <div style={{ position: 'relative' }}>
              <select
                value={spotFilter ?? ''}
                onChange={e => setSpotFilter(e.target.value || null)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  color: spotFilter ? 'var(--foam)' : 'var(--spray)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  padding: '5px 28px 5px 12px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">All Spots</option>
                {uniqueSpotOptions.map(([slug, name]) => (
                  <option key={slug} value={slug}>{name}</option>
                ))}
              </select>
              {/* Chevron */}
              <span style={{
                position: 'absolute',
                right: 9,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 8,
                color: 'var(--spray)',
                pointerEvents: 'none',
              }}>▾</span>
            </div>

            {/* Rating pills */}
            <div style={{ display: 'flex', gap: 4 }}>
              {RATING_PILLS.map(pill => {
                const active = minRating === pill.value
                return (
                  <button
                    key={String(pill.value)}
                    onClick={() => setMinRating(pill.value as RatingValue)}
                    style={{
                      padding: '5px 10px',
                      borderRadius: 20,
                      border: active
                        ? '1px solid rgba(6,182,212,0.5)'
                        : '1px solid rgba(255,255,255,0.1)',
                      background: active
                        ? 'rgba(6,182,212,0.15)'
                        : 'rgba(255,255,255,0.06)',
                      color: active ? '#06B6D4' : 'var(--spray)',
                      fontFamily: 'var(--font-data)',
                      fontSize: 11,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {pill.label}
                  </button>
                )
              })}
            </div>

            {/* Notes search */}
            <div style={{ position: 'relative', flex: '1 1 120px', minWidth: 100 }}>
              <span style={{
                position: 'absolute',
                left: 10,
                top: '50%',
                transform: 'translateY(-50%)',
                fontSize: 11,
                color: 'var(--deep-text)',
                pointerEvents: 'none',
              }}>🔍</span>
              <input
                type="text"
                placeholder="Search notes…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20,
                  color: 'var(--foam)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  padding: '5px 12px 5px 28px',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Clear button — only visible when any filter is active */}
            {(spotFilter || minRating || searchQuery) && (
              <button
                onClick={() => {
                  setSpotFilter(null)
                  setMinRating(null)
                  setSearchQuery('')
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--deep-text)',
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  cursor: 'pointer',
                  padding: '5px 4px',
                  textDecoration: 'underline',
                }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        <SessionHistory
          refresh={refreshCount}
          spotFilter={spotFilter}
          minRating={minRating}
          searchQuery={searchQuery || null}
          onSessionsLoaded={handleSessionsLoaded}
        />
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
    </div>
  )
}
