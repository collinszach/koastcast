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
      if (!user) throw new Error('Not authenticated')

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
        {[1, 2, 3].map(i => <div key={i} className="bg-gray-800 rounded-xl h-24 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-white mb-1">Profile</h1>
      <p className="text-gray-400 text-sm mb-6">
        Your surf preferences power the personalized Stoke Score™
      </p>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Identity */}
        <Section title="Identity">
          <Field label="Display name">
            <input
              type="text"
              value={profile.display_name}
              onChange={e => update('display_name', e.target.value)}
              placeholder="How you want to be called"
              className="input"
            />
          </Field>
          {email && (
            <Field label="Email">
              <input type="email" value={email} disabled className="input opacity-50" />
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
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                    profile.skill_level === level
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
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
                  className={`px-3 py-1.5 rounded-lg text-sm capitalize transition-colors ${
                    profile.board_type === board
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                  }`}
                >
                  {board}
                </button>
              ))}
            </div>
          </Field>
        </Section>

        {/* Wave preferences */}
        <Section title="Wave Preferences">
          <Field label={`Preferred height: ${mToFt(profile.pref_min_height_m)}–${mToFt(profile.pref_max_height_m)}ft`}>
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-8">Min</span>
              <input
                type="range" min={0.2} max={4} step={0.1}
                value={profile.pref_min_height_m}
                onChange={e => update('pref_min_height_m', parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-10">{mToFt(profile.pref_min_height_m)}ft</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <span className="text-xs text-gray-500 w-8">Max</span>
              <input
                type="range" min={0.5} max={10} step={0.1}
                value={profile.pref_max_height_m}
                onChange={e => update('pref_max_height_m', parseFloat(e.target.value))}
                className="flex-1 accent-blue-500"
              />
              <span className="text-xs text-gray-400 w-10">{mToFt(profile.pref_max_height_m)}ft</span>
            </div>
          </Field>

          <Field label={`Min period: ${profile.pref_min_period_s.toFixed(0)}s`}>
            <input
              type="range" min={5} max={18} step={0.5}
              value={profile.pref_min_period_s}
              onChange={e => update('pref_min_period_s', parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>5s (choppy)</span><span>18s (groundswell)</span>
            </div>
          </Field>
        </Section>

        {/* Wind & crowd preferences */}
        <Section title="Wind & Crowd">
          <Field label={`Offshore importance: ${Math.round(profile.pref_offshore_importance * 100)}%`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={profile.pref_offshore_importance}
              onChange={e => update('pref_offshore_importance', parseFloat(e.target.value))}
              className="w-full accent-green-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>Don&apos;t care</span><span>Must have offshore</span>
            </div>
          </Field>

          <Field label={`Crowd tolerance: ${Math.round(profile.pref_crowd_tolerance * 100)}%`}>
            <input
              type="range" min={0} max={1} step={0.05}
              value={profile.pref_crowd_tolerance}
              onChange={e => update('pref_crowd_tolerance', parseFloat(e.target.value))}
              className="w-full accent-orange-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>Hate crowds</span><span>Don&apos;t mind</span>
            </div>
          </Field>
        </Section>

        {/* Push notifications */}
        <Section title="Notifications">
          {/* Enable / disable push */}
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-gray-200">Push notifications</div>
              <div className="text-xs text-gray-500 mt-0.5">
                {pushEnabled ? 'Enabled — browser will notify you' : 'Disabled — click to enable'}
              </div>
            </div>
            {pushEnabled ? (
              <span className="text-xs bg-green-900/60 text-green-400 px-2.5 py-1 rounded-full">On</span>
            ) : (
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushLoading}
                className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg transition-colors"
              >
                {pushLoading ? 'Enabling…' : 'Enable'}
              </button>
            )}
          </div>

          {/* Alert toggles */}
          <div className="space-y-3 pt-2 border-t border-gray-800">
            {([
              { key: 'optimal_windows', label: 'Optimal window alerts', desc: '18h notice when your top-rated session window is confirmed' },
              { key: 'swell_alerts',    label: 'Swell alerts',          desc: 'When a buoy exceeds your preferred height' },
              { key: 'crowd_alerts',   label: 'Low-crowd alerts',       desc: 'When a good day is predicted to be uncrowded' },
            ] as Array<{ key: keyof NotificationPrefs; label: string; desc: string }>).map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm text-gray-300">{label}</div>
                  <div className="text-xs text-gray-500">{desc}</div>
                </div>
                <button
                  type="button"
                  onClick={() => updateNotif(key, !notifPrefs[key])}
                  className={`flex-shrink-0 w-10 h-5 rounded-full transition-colors relative ${
                    notifPrefs[key] ? 'bg-blue-600' : 'bg-gray-700'
                  }`}
                  aria-checked={!!notifPrefs[key]}
                  role="switch"
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    notifPrefs[key] ? 'left-5' : 'left-0.5'
                  }`} />
                </button>
              </div>
            ))}
          </div>

          {/* Min stoke threshold */}
          <Field label={`Alert threshold: Stoke ${notifPrefs.min_stoke_threshold}+`}>
            <input
              type="range" min={40} max={90} step={5}
              value={notifPrefs.min_stoke_threshold}
              onChange={e => updateNotif('min_stoke_threshold', parseInt(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-0.5">
              <span>40 (anything)</span><span>90 (only epic)</span>
            </div>
          </Field>
        </Section>

        {error && (
          <div className="text-red-400 text-sm bg-red-950/50 border border-red-800 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Preferences'}
        </button>
      </form>

      {/* Quiver Manager */}
      <div id="quiver" className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">My Quiver</h2>
        <p className="text-xs text-gray-500">
          Add your boards and wetsuits — the app will recommend what to grab based on today&apos;s conditions.
        </p>
        <QuiverManager />
      </div>

      <style jsx>{`
        .input {
          width: 100%;
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          color: white;
          font-size: 0.875rem;
          outline: none;
        }
        .input:focus {
          border-color: #3b82f6;
        }
      `}</style>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
      <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">{title}</h2>
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-2">{label}</label>
      {children}
    </div>
  )
}
