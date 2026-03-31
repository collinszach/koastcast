'use client'

/**
 * Profile page — surf preferences that power the personalized Stoke Score™.
 */

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
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

const SKILL_LEVELS = ['beginner', 'intermediate', 'advanced', 'pro']
const BOARD_TYPES = ['shortboard', 'longboard', 'fish', 'funboard', 'SUP', 'bodyboard']

function mToFt(m: number) {
  return (m * 3.281).toFixed(0)
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE)
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs>(DEFAULT_NOTIF_PREFS)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLoading, setPushLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Check current push permission state
    if ('Notification' in window) {
      setPushEnabled(Notification.permission === 'granted')
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

  if (loading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="skeleton rounded-xl h-24" />)}
      </div>
    )
  }

  return (
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
            Add boards & wetsuits — we&apos;ll recommend what to grab based on today&apos;s conditions.
          </p>
        </div>
        <QuiverManager />
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
