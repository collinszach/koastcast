'use client'

/**
 * Profile page — surf preferences that power the personalized Stoke Score™.
 */

import { useState, useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { setupPushNotifications } from '@/lib/push'
import QuiverManager from '@/components/sessions/QuiverManager'

interface UserProfile {
  display_name: string
  skill_level: string
  board_type: string
  pref_min_height_m: number
  pref_max_height_m: number
  pref_min_period_s: number
  pref_offshore_importance: number
  pref_crowd_tolerance: number
}

interface NotificationPrefs {
  optimal_windows: boolean
  swell_alerts: boolean
  crowd_alerts: boolean
  min_stoke_threshold: number
}

interface TerrainSettings {
  tempUnit: 'C' | 'F'
  waveHeightUnit: 'ft' | 'm'
  windUnit: 'kt' | 'mph' | 'kmh'
  distanceUnit: 'mi' | 'km'
  timeFormat: '12h' | '24h'
  tideUnit: 'ft' | 'm'
  notifySwell: boolean
  notifyOptimal: boolean
  notifyMorning: boolean
  minStokeAlert: number
  defaultMapStyle: 'ocean' | 'satellite' | 'topo'
  showOfflineSpots: boolean
  autoCenterLocation: boolean
  forecastDays: number
  defaultSport: 'surf' | 'snow' | 'trails' | 'all'
}

const DEFAULT_PROFILE: UserProfile = {
  display_name: '',
  skill_level: 'intermediate',
  board_type: 'shortboard',
  pref_min_height_m: 0.6,
  pref_max_height_m: 2.5,
  pref_min_period_s: 8.0,
  pref_offshore_importance: 0.8,
  pref_crowd_tolerance: 0.5,
}

const DEFAULT_NOTIF_PREFS: NotificationPrefs = {
  optimal_windows: true,
  swell_alerts: true,
  crowd_alerts: false,
  min_stoke_threshold: 65,
}

const DEFAULT_SETTINGS: TerrainSettings = {
  tempUnit: 'F',
  waveHeightUnit: 'ft',
  windUnit: 'kt',
  distanceUnit: 'mi',
  timeFormat: '12h',
  tideUnit: 'ft',
  notifySwell: true,
  notifyOptimal: true,
  notifyMorning: true,
  minStokeAlert: 6,
  defaultMapStyle: 'ocean',
  showOfflineSpots: true,
  autoCenterLocation: true,
  forecastDays: 7,
  defaultSport: 'surf',
}

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro']
const BOARD_TYPES = ['shortboard', 'longboard', 'fish', 'funboard', 'SUP', 'bodyboard']

function mToFt(m: number) {
  return (m * 3.281).toFixed(0)
}

/** Inline boolean toggle switch */
function SettingToggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string
  desc?: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid rgba(6,182,212,0.06)',
      }}
    >
      <div>
        <div
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: 13,
            color: 'var(--foam)',
            fontWeight: 600,
          }}
        >
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 11,
              color: 'var(--deep-text)',
              marginTop: 2,
            }}
          >
            {desc}
          </div>
        )}
      </div>
      <div
        role="switch"
        aria-checked={value}
        onClick={() => onChange(!value)}
        style={{
          width: 44,
          height: 24,
          borderRadius: 12,
          cursor: 'pointer',
          background: value ? '#06B6D4' : 'rgba(30,41,59,0.8)',
          border: value
            ? '1px solid rgba(6,182,212,0.5)'
            : '1px solid rgba(6,182,212,0.15)',
          position: 'relative',
          transition: 'all 0.2s',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: 'absolute',
            top: 2,
            left: value ? 22 : 2,
            width: 18,
            height: 18,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.2s',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}
        />
      </div>
    </div>
  )
}

/** Multi-option pill selector */
function SettingSelect({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 0',
        borderBottom: '1px solid rgba(6,182,212,0.06)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-data)',
          fontSize: 13,
          color: 'var(--foam)',
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            style={{
              padding: '4px 12px',
              borderRadius: 6,
              cursor: 'pointer',
              background:
                value === opt ? 'rgba(6,182,212,0.2)' : 'rgba(6,13,26,0.6)',
              border:
                value === opt
                  ? '1px solid rgba(6,182,212,0.4)'
                  : '1px solid rgba(6,182,212,0.1)',
              color:
                value === opt ? 'var(--cyan-bright)' : 'var(--deep-text)',
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Sub-heading within the settings card */
function SettingsSubHeading({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        fontWeight: 700,
        color: 'var(--spray)',
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        paddingTop: 4,
        paddingBottom: 2,
        marginTop: 8,
      }}
    >
      {children}
    </div>
  )
}

interface SurfStats {
  totalSessions: number
  thisYear: number
  avgRating: number
  avgWaveHeightFt: number
  favoriteSpot: string
  uniqueSpots: number
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS)
  const [settings, setSettings] = useState<TerrainSettings>(DEFAULT_SETTINGS)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [subscriptionTier, setSubscriptionTier] = useState<'free' | 'pro' | 'explorer'>('free')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pwResetSent, setPwResetSent] = useState(false)
  const [pwResetLoading, setPwResetLoading] = useState(false)
  const [surfStats, setSurfStats] = useState<SurfStats | null>(null)

  useEffect(() => {
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
    }
    // Load terrain settings from localStorage
    try {
      const raw = localStorage.getItem('terrain_settings')
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<TerrainSettings>
        setSettings(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // ignore malformed stored data
    }
  }, [])

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setEmail(user.email || '')

      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single()

      if (data) {
        setProfile({
          display_name: data.display_name || '',
          skill_level: data.skill_level || DEFAULT_PROFILE.skill_level,
          board_type: data.board_type || DEFAULT_PROFILE.board_type,
          pref_min_height_m: data.pref_min_height_m ?? DEFAULT_PROFILE.pref_min_height_m,
          pref_max_height_m: data.pref_max_height_m ?? DEFAULT_PROFILE.pref_max_height_m,
          pref_min_period_s: data.pref_min_period_s ?? DEFAULT_PROFILE.pref_min_period_s,
          pref_offshore_importance: data.pref_offshore_importance ?? DEFAULT_PROFILE.pref_offshore_importance,
          pref_crowd_tolerance: data.pref_crowd_tolerance ?? DEFAULT_PROFILE.pref_crowd_tolerance,
        })
        if (data.notification_prefs) {
          setNotifPrefs({ ...DEFAULT_NOTIF_PREFS, ...data.notification_prefs })
        }
        if (data.subscription_tier) {
          setSubscriptionTier(data.subscription_tier as 'free' | 'pro' | 'explorer')
        }
      }

      // Fetch surf stats from user_sessions
      const { data: sessions } = await supabase
        .from('user_sessions')
        .select('session_date, wave_height_face_m, quality_rating, spot_id, spots(name,slug)')
        .eq('user_id', user.id)
        .order('session_date', { ascending: false })

      if (sessions && sessions.length > 0) {
        const thisYear = new Date().getFullYear()
        const countThisYear = sessions.filter(s => new Date(s.session_date).getFullYear() === thisYear).length
        const rated = sessions.filter(s => s.quality_rating != null)
        const avgRating = rated.length > 0 ? rated.reduce((a, s) => a + (s.quality_rating ?? 0), 0) / rated.length : 0
        const withHeight = sessions.filter(s => s.wave_height_face_m != null)
        const avgH = withHeight.length > 0 ? withHeight.reduce((a, s) => a + (s.wave_height_face_m ?? 0), 0) / withHeight.length : 0
        const spotCounts: Record<string, { name: string; count: number }> = {}
        const spotSlugs = new Set<string>()
        for (const s of sessions) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const row = s as any
          const slug = row.spots?.slug || s.spot_id
          const name = row.spots?.name || 'Unknown'
          spotSlugs.add(slug)
          if (!spotCounts[slug]) spotCounts[slug] = { name, count: 0 }
          spotCounts[slug].count++
        }
        let favoriteSpot = '—'
        let maxCount = 0
        for (const { name, count } of Object.values(spotCounts)) {
          if (count > maxCount) { maxCount = count; favoriteSpot = name }
        }
        setSurfStats({
          totalSessions: sessions.length,
          thisYear: countThisYear,
          avgRating: Math.round(avgRating * 10) / 10,
          avgWaveHeightFt: Math.round(avgH * 3.281 * 10) / 10,
          favoriteSpot,
          uniqueSpots: spotSlugs.size,
        })
      }

      setLoading(false)
    }
    load()
  }, [])

  function update<K extends keyof UserProfile>(key: K, value: UserProfile[K]) {
    setProfile(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function updateNotif<K extends keyof NotificationPrefs>(key: K, value: NotificationPrefs[K]) {
    setNotifPrefs(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  function updateSetting<K extends keyof TerrainSettings>(key: K, value: TerrainSettings[K]) {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSettingsSaved(false)
  }

  function handleSaveSettings() {
    try {
      localStorage.setItem('terrain_settings', JSON.stringify(settings))
      setSettingsSaved(true)
      setTimeout(() => setSettingsSaved(false), 2000)
    } catch {
      // localStorage may be unavailable in some contexts
    }
  }

  async function handleEnablePush() {
    setPushLoading(true)
    try {
      const ok = await setupPushNotifications()
      setPushEnabled(ok)
      if (!ok) setError('Could not enable push notifications. Check browser permissions.')
    } catch {
      setError('Push notification setup failed.')
    } finally {
      setPushLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // No auth — save to localStorage as guest preferences
        localStorage.setItem('swellstack_guest_prefs', JSON.stringify({ ...profile, notification_prefs: notifPrefs }))
        setSaved(true)
        setSaving(false)
        return
      }

      const { error: upsertError } = await supabase.from('user_profiles').upsert({
        user_id: user.id,
        ...profile,
        notification_prefs: notifPrefs,
        updated_at: new Date().toISOString(),
      })

      if (upsertError) throw upsertError
      setSaved(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  /** Generate initials from display_name or email */
  function getInitials() {
    if (profile.display_name) {
      return profile.display_name
        .split(' ')
        .map(w => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    }
    if (email) return email[0].toUpperCase()
    return '?'
  }

  const isProOrExplorer = subscriptionTier === 'pro' || subscriptionTier === 'explorer'

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-xl h-24" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 28,
        fontWeight: 800,
        color: 'var(--foam)',
        letterSpacing: '-0.02em',
        marginBottom: 5,
      }}>Profile</h1>
      <p style={{ fontSize: 13, color: 'var(--spray)', marginBottom: 24 }}>
        Your surf preferences power the personalized Stoke Score™
      </p>

      {/* ── ACCOUNT ──────────────────────────────────────────────── */}
      <div className="glass-card p-5" style={{ marginBottom: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--spray)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>Account</h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Avatar circle */}
          <div style={{
            width: 56,
            height: 56,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, rgba(6,182,212,0.35) 0%, rgba(14,165,233,0.25) 100%)',
            border: '2px solid rgba(6,182,212,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 20,
              fontWeight: 800,
              color: 'var(--cyan-bright)',
              letterSpacing: '-0.02em',
            }}>
              {getInitials()}
            </span>
          </div>

          {/* Name + tier */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 16,
              fontWeight: 700,
              color: 'var(--foam)',
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {profile.display_name || (email ? email.split('@')[0] : 'Guest User')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {/* Subscription badge */}
              {subscriptionTier === 'free' && (
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#D97706',
                  background: 'rgba(217,119,6,0.12)',
                  border: '1px solid rgba(217,119,6,0.3)',
                  padding: '2px 8px',
                  borderRadius: 20,
                }}>FREE PLAN</span>
              )}
              {subscriptionTier === 'pro' && (
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: 'var(--cyan-bright)',
                  background: 'rgba(6,182,212,0.12)',
                  border: '1px solid rgba(6,182,212,0.3)',
                  padding: '2px 8px',
                  borderRadius: 20,
                }}>PRO</span>
              )}
              {subscriptionTier === 'explorer' && (
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  color: '#A78BFA',
                  background: 'rgba(167,139,250,0.12)',
                  border: '1px solid rgba(167,139,250,0.3)',
                  padding: '2px 8px',
                  borderRadius: 20,
                }}>EXPLORER</span>
              )}

              {!email && (
                <a
                  href="/auth/login"
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: 'var(--cyan)',
                    textDecoration: 'underline',
                    textUnderlineOffset: 2,
                  }}
                >
                  Sign in to sync preferences across devices
                </a>
              )}
              {email && (
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 11,
                  color: 'var(--deep-text)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 180,
                }}>
                  {email}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(6,182,212,0.08)' }}>
          {!email || !isSupabaseConfigured() ? (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--deep-text)' }}>
              Sign in to change your password
            </span>
          ) : pwResetSent ? (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--cyan)' }}>
              Password reset email sent — check your inbox
            </span>
          ) : (
            <button
              type="button"
              disabled={pwResetLoading}
              onClick={async () => {
                setPwResetLoading(true)
                const supabase = createClient()
                await supabase.auth.resetPasswordForEmail(email, {
                  redirectTo: `${location.origin}/auth/reset-password`,
                })
                setPwResetSent(true)
                setPwResetLoading(false)
              }}
              style={{
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                fontWeight: 600,
                color: 'rgba(6,182,212,0.7)',
                background: 'none',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 8,
                padding: '7px 14px',
                cursor: pwResetLoading ? 'not-allowed' : 'pointer',
                opacity: pwResetLoading ? 0.5 : 1,
                letterSpacing: '0.04em',
                transition: 'all 0.15s',
              }}
            >
              {pwResetLoading ? 'Sending…' : 'Change Password'}
            </button>
          )}
        </div>
      </div>

      {/* ── SURF STATS ───────────────────────────────────────────── */}
      {surfStats && (
        <div className="glass-card p-5" style={{ marginBottom: 16 }}>
          <h2 style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 600,
            color: 'var(--spray)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 14,
          }}>Surf Stats</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { value: surfStats.totalSessions, label: 'Sessions' },
              { value: surfStats.thisYear, label: 'This Year' },
              { value: surfStats.uniqueSpots, label: 'Spots' },
              { value: surfStats.avgRating > 0 ? surfStats.avgRating.toFixed(1) : '—', label: 'Avg Rating' },
              { value: surfStats.avgWaveHeightFt > 0 ? `${surfStats.avgWaveHeightFt}ft` : '—', label: 'Avg Height' },
              { value: surfStats.favoriteSpot !== '—' ? surfStats.favoriteSpot.split(' ')[0] : '—', label: 'Home Break' },
            ].map(({ value, label }) => (
              <div key={label} style={{
                background: 'rgba(6,182,212,0.05)',
                border: '1px solid rgba(6,182,212,0.1)',
                borderRadius: 10,
                padding: '10px 8px',
                textAlign: 'center',
              }}>
                <div style={{
                  fontFamily: 'var(--font-jetbrains)',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--cyan-bright)',
                  lineHeight: 1,
                  marginBottom: 4,
                }}>{value}</div>
                <div style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 9,
                  fontWeight: 600,
                  color: 'var(--deep-text)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-4">
        {/* Identity */}
        <Section title="Identity">
          <Field label="Display name">
            <input
              type="text"
              value={profile.display_name}
              onChange={e => update('display_name', e.target.value)}
              placeholder="How you want to be called"
              className="ocean-input"
            />
          </Field>
          {email && (
            <Field label="Email">
              <input type="email" value={email} disabled className="ocean-input" style={{ opacity: 0.4 }} />
            </Field>
          )}
        </Section>

        {/* Surfing profile */}
        <Section title="Surfing Profile">
          <Field label="Skill level">
            <div className="flex gap-2 flex-wrap">
              {SKILL_LEVELS.map(level => (
                <button
                  key={level}
                  type="button"
                  onClick={() => update('skill_level', level)}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    letterSpacing: '0.04em',
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: profile.skill_level === level
                      ? '1px solid rgba(6,182,212,0.5)'
                      : '1px solid rgba(6,182,212,0.1)',
                    background: profile.skill_level === level
                      ? 'rgba(6,182,212,0.15)'
                      : 'rgba(6,13,26,0.6)',
                    color: profile.skill_level === level ? 'var(--cyan-bright)' : 'var(--spray)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {level}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Board type">
            <div className="flex gap-2 flex-wrap">
              {BOARD_TYPES.map(board => (
                <button
                  key={board}
                  type="button"
                  onClick={() => update('board_type', board)}
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: 'capitalize',
                    letterSpacing: '0.04em',
                    padding: '6px 14px',
                    borderRadius: 8,
                    border: profile.board_type === board
                      ? '1px solid rgba(6,182,212,0.5)'
                      : '1px solid rgba(6,182,212,0.1)',
                    background: profile.board_type === board
                      ? 'rgba(6,182,212,0.15)'
                      : 'rgba(6,13,26,0.6)',
                    color: profile.board_type === board ? 'var(--cyan-bright)' : 'var(--spray)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {board}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Wave preferences */}
        <Section title="Wave Preferences">
          <Field label={`Preferred height: ${mToFt(profile.pref_min_height_m)}–${mToFt(profile.pref_max_height_m)} ft`}>
            <div className="flex items-center gap-3">
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', width: 28 }}>Min</span>
              <input
                type="range" min={0.2} max={4} step={0.1}
                value={profile.pref_min_height_m}
                onChange={e => update('pref_min_height_m', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--spray)', width: 36, textAlign: 'right' }}>
                {mToFt(profile.pref_min_height_m)}ft
              </span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', width: 28 }}>Max</span>
              <input
                type="range" min={0.5} max={10} step={0.1}
                value={profile.pref_max_height_m}
                onChange={e => update('pref_max_height_m', parseFloat(e.target.value))}
                className="flex-1"
              />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--spray)', width: 36, textAlign: 'right' }}>
                {mToFt(profile.pref_max_height_m)}ft
              </span>
            </div>
          </Field>

          <Field label={`Min period: ${profile.pref_min_period_s.toFixed(0)}s`}>
            <input
              type="range" min={5} max={18} step={0.5}
              value={profile.pref_min_period_s}
              onChange={e => update('pref_min_period_s', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1" style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
              <span>5s · choppy</span><span>18s · groundswell</span>
            </div>
          </Field>
        </Section>

        {/* Wind & crowd */}
        <Section title="Wind & Crowd">
          <Field label={`Offshore importance: ${Math.round(profile.pref_offshore_importance * 100)}%`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={profile.pref_offshore_importance}
              onChange={e => update('pref_offshore_importance', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1" style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
              <span>Don&apos;t care</span><span>Must have offshore</span>
            </div>
          </Field>

          <Field label={`Crowd tolerance: ${Math.round(profile.pref_crowd_tolerance * 100)}%`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={profile.pref_crowd_tolerance}
              onChange={e => update('pref_crowd_tolerance', parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1" style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
              <span>Hate crowds</span><span>Don&apos;t mind</span>
            </div>
          </Field>
        </Section>

        {/* Notifications */}
        <Section title="Notifications">
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontSize: 13, color: 'var(--mist)' }}>Push notifications</div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', marginTop: 3 }}>
                {pushEnabled ? 'Enabled — browser will notify you' : 'Disabled — click to enable'}
              </div>
            </div>
            {pushEnabled ? (
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                background: 'rgba(6,182,212,0.12)',
                color: 'var(--cyan)',
                border: '1px solid rgba(6,182,212,0.25)',
                padding: '3px 10px',
                borderRadius: 20,
                letterSpacing: '0.06em',
                fontWeight: 600,
              }}>ON</span>
            ) : (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="btn-ocean"
                style={{ padding: '6px 14px', fontSize: 11, opacity: pushLoading ? 0.5 : 1 }}
              >
                {pushLoading ? 'Enabling…' : 'Enable'}
              </button>
            )}
          </div>

          {/* Alert toggles */}
          <div className="space-y-3 pt-3" style={{ borderTop: '1px solid rgba(6,182,212,0.08)' }}>
            {([
              { key: 'optimal_windows', label: 'Optimal window alerts', desc: '18h notice when your top-rated window is confirmed' },
              { key: 'swell_alerts',    label: 'Swell alerts',          desc: 'When a buoy exceeds your preferred height' },
              { key: 'crowd_alerts',   label: 'Low-crowd alerts',       desc: 'When a good day is predicted to be uncrowded' },
            ] as Array<{ key: keyof NotificationPrefs; label: string; desc: string }>).map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <div style={{ fontSize: 13, color: 'var(--mist)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', marginTop: 2 }}>{desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateNotif(key, !notifPrefs[key])}
                  className="flex-shrink-0 relative transition-all"
                  style={{
                    width: 40,
                    height: 20,
                    borderRadius: 10,
                    background: notifPrefs[key] ? 'var(--cyan)' : 'rgba(15,32,64,0.8)',
                    border: notifPrefs[key] ? 'none' : '1px solid rgba(6,182,212,0.15)',
                    cursor: 'pointer',
                  }}
                  aria-checked={!!notifPrefs[key]}
                  role="switch"
                >
                  <span className="absolute top-[3px] w-[14px] h-[14px] bg-white rounded-full shadow transition-all"
                        style={{ left: notifPrefs[key] ? 23 : 3 }} />
                </button>
              </div>
            ))}
          </div>

          <Field label={`Alert threshold: Stoke ${notifPrefs.min_stoke_threshold}+`}>
            <input
              type="range" min={40} max={90} step={5}
              value={notifPrefs.min_stoke_threshold}
              onChange={e => updateNotif('min_stoke_threshold', parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between mt-1" style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
              <span>40 · anything</span><span>90 · only epic</span>
            </div>
          </Field>
        </Section>

        {error && (
          <div style={{
            fontSize: 13,
            color: '#FCA5A5',
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 10,
            padding: '10px 14px',
          }}>
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-ocean w-full"
          style={{ padding: '13px', fontSize: 13, opacity: saving ? 0.6 : 1 }}
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Preferences'}
        </button>
      </form>

      {/* ── DISPLAY SETTINGS ─────────────────────────────────────── */}
      <div className="glass-card p-5" style={{ marginTop: 16 }}>
        <h2 style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--spray)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}>Display Settings</h2>
        <p style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)', marginBottom: 12 }}>
          Controls how data is displayed throughout the app. Saved locally on this device.
        </p>

        {/* ── UNITS ── */}
        <SettingsSubHeading>Units</SettingsSubHeading>

        <SettingSelect
          label="Temperature"
          options={['°F', '°C']}
          value={settings.tempUnit === 'F' ? '°F' : '°C'}
          onChange={v => updateSetting('tempUnit', v === '°F' ? 'F' : 'C')}
        />
        <SettingSelect
          label="Wave height"
          options={['ft', 'm']}
          value={settings.waveHeightUnit}
          onChange={v => updateSetting('waveHeightUnit', v as 'ft' | 'm')}
        />
        <SettingSelect
          label="Wind speed"
          options={['kt', 'mph', 'km/h']}
          value={settings.windUnit === 'kmh' ? 'km/h' : settings.windUnit}
          onChange={v => updateSetting('windUnit', v === 'km/h' ? 'kmh' : (v as 'kt' | 'mph'))}
        />
        <SettingSelect
          label="Distance"
          options={['mi', 'km']}
          value={settings.distanceUnit}
          onChange={v => updateSetting('distanceUnit', v as 'mi' | 'km')}
        />
        <SettingSelect
          label="Time format"
          options={['12h', '24h']}
          value={settings.timeFormat}
          onChange={v => updateSetting('timeFormat', v as '12h' | '24h')}
        />
        <SettingSelect
          label="Tide height"
          options={['ft', 'm']}
          value={settings.tideUnit}
          onChange={v => updateSetting('tideUnit', v as 'ft' | 'm')}
        />

        {/* ── NOTIFICATIONS ── */}
        <SettingsSubHeading>Notifications</SettingsSubHeading>

        <SettingToggle
          label="Swell alerts"
          desc="Notify when a significant swell is incoming"
          value={settings.notifySwell}
          onChange={v => updateSetting('notifySwell', v)}
        />
        <SettingToggle
          label="Optimal window alerts"
          desc="Alert 18h before your best-rated windows"
          value={settings.notifyOptimal}
          onChange={v => updateSetting('notifyOptimal', v)}
        />
        <SettingToggle
          label="Morning briefing"
          desc="Daily 6am conditions summary for your home spots"
          value={settings.notifyMorning}
          onChange={v => updateSetting('notifyMorning', v)}
        />

        {/* Min stoke alert slider */}
        <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(6,182,212,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--foam)', fontWeight: 600 }}>
                Minimum stoke threshold
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)', marginTop: 2 }}>
                Only alert when Stoke Score is {settings.minStokeAlert}+
              </div>
            </div>
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 18,
              fontWeight: 800,
              color: 'var(--cyan-bright)',
              minWidth: 28,
              textAlign: 'right',
            }}>
              {settings.minStokeAlert}
            </span>
          </div>
          <input
            type="range" min={1} max={10} step={1}
            value={settings.minStokeAlert}
            onChange={e => updateSetting('minStokeAlert', parseInt(e.target.value))}
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
            <span>1 · any conditions</span>
            <span>10 · only epic</span>
          </div>
        </div>

        {/* ── PREFERENCES ── */}
        <SettingsSubHeading>Preferences</SettingsSubHeading>

        <SettingSelect
          label="Default map style"
          options={['Ocean', 'Satellite', 'Topo']}
          value={settings.defaultMapStyle.charAt(0).toUpperCase() + settings.defaultMapStyle.slice(1)}
          onChange={v => updateSetting('defaultMapStyle', v.toLowerCase() as 'ocean' | 'satellite' | 'topo')}
        />
        <SettingToggle
          label="Show offline spots"
          desc="Display spots that have no live buoy data"
          value={settings.showOfflineSpots}
          onChange={v => updateSetting('showOfflineSpots', v)}
        />
        <SettingToggle
          label="Auto-center on location"
          desc="Map auto-pans to your GPS position on load"
          value={settings.autoCenterLocation}
          onChange={v => updateSetting('autoCenterLocation', v)}
        />

        {/* Forecast days — locked for free tier */}
        <div style={{ padding: '10px 0', borderBottom: '1px solid rgba(6,182,212,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: isProOrExplorer ? 8 : 0 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--foam)', fontWeight: 600 }}>
                  Forecast days
                </span>
                {!isProOrExplorer && (
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    color: '#D97706',
                    background: 'rgba(217,119,6,0.1)',
                    border: '1px solid rgba(217,119,6,0.25)',
                    padding: '1px 6px',
                    borderRadius: 10,
                  }}>PRO ONLY</span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)', marginTop: 2 }}>
                {isProOrExplorer
                  ? `Showing ${settings.forecastDays}-day forecast`
                  : 'Free plan: 7-day forecast. Upgrade for up to 16 days.'}
              </div>
            </div>
            {isProOrExplorer && (
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 18,
                fontWeight: 800,
                color: 'var(--cyan-bright)',
                minWidth: 28,
                textAlign: 'right',
              }}>
                {settings.forecastDays}d
              </span>
            )}
          </div>
          {isProOrExplorer ? (
            <>
              <input
                type="range" min={7} max={16} step={1}
                value={settings.forecastDays}
                onChange={e => updateSetting('forecastDays', parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
                <span>7 days</span>
                <span>16 days</span>
              </div>
            </>
          ) : (
            <a
              href="/upgrade"
              style={{
                display: 'inline-block',
                marginTop: 8,
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--cyan)',
                textDecoration: 'underline',
                textUnderlineOffset: 2,
              }}
            >
              Upgrade to Pro →
            </a>
          )}
        </div>

        <SettingSelect
          label="Default sport"
          options={['Surf', 'Snow', 'Trails', 'All']}
          value={settings.defaultSport.charAt(0).toUpperCase() + settings.defaultSport.slice(1)}
          onChange={v => updateSetting('defaultSport', v.toLowerCase() as 'surf' | 'snow' | 'trails' | 'all')}
        />

        {/* Save settings button */}
        <button
          type="button"
          onClick={handleSaveSettings}
          className="btn-ocean w-full"
          style={{ marginTop: 20, padding: '12px', fontSize: 13 }}
        >
          {settingsSaved ? '✓ Saved' : 'Save Settings'}
        </button>
      </div>

      {/* Quiver */}
      <div id="quiver" className="glass-card p-5 space-y-4 mt-4">
        <div>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--foam)',
            letterSpacing: '0.01em',
          }}>My Quiver</h2>
          <p style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', marginTop: 4 }}>
            Add boards &amp; wetsuits — we&apos;ll recommend what to grab based on today&apos;s conditions.
          </p>
        </div>
        <QuiverManager />
      </div>
    </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass-card p-5 space-y-4">
      <h2 style={{
        fontFamily: 'var(--font-data)',
        fontSize: 10,
        fontWeight: 600,
        color: 'var(--spray)',
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
      }}>{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{
        display: 'block',
        fontFamily: 'var(--font-data)',
        fontSize: 10,
        color: 'var(--spray)',
        letterSpacing: '0.04em',
        marginBottom: 8,
      }}>{label}</label>
      {children}
    </div>
  )
}
