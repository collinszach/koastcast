'use client'

/**
 * Onboarding wizard — 6 steps to configure the personalized Peak Score™.
 * Shown to new users before they reach the main app.
 * Pure inline styles — surf-report paper theme, zero Tailwind classes.
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const STEPS = ['Welcome', 'Location', 'Skill', 'Board', 'Waves', 'Preferences']

interface OnboardingData {
  display_name: string
  skill_level: string
  board_type: string
  pref_min_height_m: number
  pref_max_height_m: number
  pref_min_period_s: number
  pref_offshore_importance: number
  pref_crowd_tolerance: number
}

const SKILL_LEVELS = [
  { value: 'beginner', label: 'Beginner', desc: 'Learning to stand up and catch whitewater' },
  { value: 'intermediate', label: 'Intermediate', desc: 'Riding green waves, working on turns' },
  { value: 'advanced', label: 'Advanced', desc: 'Comfortable in overhead surf, aerial tricks' },
  { value: 'pro', label: 'Pro', desc: 'Big wave surfer, competing, charging anything' },
]

const BOARD_TYPES = [
  { value: 'shortboard', label: 'Shortboard', emoji: '🏄' },
  { value: 'longboard', label: 'Longboard', emoji: '🏄' },
  { value: 'fish', label: 'Fish', emoji: '🐟' },
  { value: 'funboard', label: 'Funboard', emoji: '😎' },
  { value: 'SUP', label: 'SUP', emoji: '🚣' },
  { value: 'bodyboard', label: 'Bodyboard', emoji: '🌊' },
]

function mToFt(m: number) {
  return `${(m * 3.281).toFixed(0)}ft`
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [locPermission, setLocPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt')
  const [data, setData] = useState<OnboardingData>({
    display_name: '',
    skill_level: 'intermediate',
    board_type: 'shortboard',
    pref_min_height_m: 0.6,
    pref_max_height_m: 2.5,
    pref_min_period_s: 8.0,
    pref_offshore_importance: 0.8,
    pref_crowd_tolerance: 0.5,
  })

  useEffect(() => {
    if (!navigator.permissions) return
    navigator.permissions
      .query({ name: 'geolocation' })
      .then(s => setLocPermission(s.state as 'granted' | 'denied' | 'prompt'))
      .catch(() => {})
  }, [])

  function update<K extends keyof OnboardingData>(key: K, value: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  async function finish() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (user) {
      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        ...data,
        updated_at: new Date().toISOString(),
      })
    }

    router.push('/map')
  }

  function canAdvance(): boolean {
    if (step === 0) return data.display_name.trim().length > 0
    // Location step is always skippable
    return true
  }

  // ── Shared style tokens ──────────────────────────────────────────────────
  // Colors reference the global design-system CSS custom properties (see
  // globals.css) so this file stays in sync with the rest of the app's
  // surf-report paper theme even though it uses inline styles throughout.

  const cardStyle: React.CSSProperties = {
    background: 'var(--tile-bg)',
    border: '1px solid var(--tile-border-strong)',
    borderRadius: 20,
    boxShadow: 'var(--tile-shadow)',
    padding: '28px 28px 24px',
  }

  const headingStyle: React.CSSProperties = {
    fontFamily: 'var(--font-display)',
    fontSize: 22,
    fontWeight: 800,
    color: 'var(--foam)',
    marginBottom: 8,
    marginTop: 0,
    letterSpacing: '-0.01em',
  }

  const subStyle: React.CSSProperties = {
    fontFamily: 'monospace',
    fontSize: 11,
    color: 'var(--spray)',
    lineHeight: 1.7,
    marginBottom: 20,
    marginTop: 0,
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'monospace',
    fontSize: 10,
    color: 'var(--spray)',
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    marginBottom: 6,
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box' as const,
    background: 'var(--paper-raised)',
    border: '1px solid var(--tile-border-strong)',
    borderRadius: 12,
    padding: '12px 14px',
    color: 'var(--foam)',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    outline: 'none',
  }

  const primaryBtn: React.CSSProperties = {
    flex: 1,
    padding: '14px',
    borderRadius: 14,
    background: 'var(--cyan)',
    border: 'none',
    cursor: 'pointer',
    color: '#fff',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 700,
    letterSpacing: '0.02em',
    transition: 'opacity 0.15s',
  }

  const backBtn: React.CSSProperties = {
    flex: 1,
    padding: '14px',
    borderRadius: 14,
    background: 'transparent',
    border: '1px solid var(--tile-border-strong)',
    cursor: 'pointer',
    color: 'var(--spray)',
    fontFamily: 'var(--font-display)',
    fontSize: 14,
    fontWeight: 600,
    letterSpacing: '0.02em',
  }

  const selectionCard = (active: boolean): React.CSSProperties => ({
    width: '100%',
    textAlign: 'left' as const,
    padding: '12px 14px',
    borderRadius: 14,
    border: active ? '1px solid var(--cyan)' : '1px solid var(--tile-border)',
    background: active ? 'var(--cyan-muted)' : 'var(--paper-sunken)',
    cursor: 'pointer',
    transition: 'all 0.15s',
    marginBottom: 8,
  })

  const selectionGrid = (active: boolean): React.CSSProperties => ({
    textAlign: 'center' as const,
    padding: '14px 10px',
    borderRadius: 14,
    border: active ? '1px solid var(--cyan)' : '1px solid var(--tile-border)',
    background: active ? 'var(--cyan-muted)' : 'var(--paper-sunken)',
    cursor: 'pointer',
    transition: 'all 0.15s',
  })

  const rangeHintRow: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    fontFamily: 'monospace',
    fontSize: 9,
    color: 'var(--deep-text)',
    letterSpacing: '0.04em',
    marginTop: 4,
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--deep)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px 16px',
    }}>
      <div style={{ width: '100%', maxWidth: 440 }}>

        {/* Koastcast logo mark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{
            background: 'var(--cyan)',
            width: 28, height: 28, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 3L20 18H4L12 3Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M12 3L15 9H9L12 3Z" fill="white"/>
              <path d="M2 20C5 17 8 17 12 19C16 21 19 19 22 16" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: 'var(--foam)', letterSpacing: '0.08em' }}>Koastcast</span>
        </div>

        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {STEPS.map((s, i) => (
            <div
              key={s}
              style={{
                flex: 1,
                height: 3,
                borderRadius: 99,
                background: i <= step ? 'var(--cyan)' : 'var(--tile-border)',
                transition: 'background 0.3s',
              }}
            />
          ))}
        </div>

        {/* Step label */}
        <div style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'var(--deep-text)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginBottom: 16,
        }}>
          Step {step + 1} of {STEPS.length} — {STEPS[step]}
        </div>

        {/* Card */}
        <div style={cardStyle}>

          {/* ── Step 0: Welcome ── */}
          {step === 0 && (
            <div>
              <div style={{ fontSize: 32, marginBottom: 14 }}>🌊</div>
              <h1 style={{ ...headingStyle, fontSize: 26 }}>Welcome to Koastcast</h1>
              <p style={subStyle}>
                Your AI-powered surf &amp; outdoor intelligence platform.
                Let&apos;s set up your personalized Peak Score™ — it only takes 2 minutes.
              </p>
              <div>
                <label style={labelStyle}>What do your friends call you?</label>
                <input
                  autoFocus
                  type="text"
                  value={data.display_name}
                  onChange={e => update('display_name', e.target.value)}
                  placeholder="Your name"
                  style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && canAdvance() && setStep(s => s + 1)}
                />
              </div>
            </div>
          )}

          {/* ── Step 1: Location ── */}
          {step === 1 && (
            <div>
              <div style={{ fontSize: 32, marginBottom: 16 }}>📍</div>
              <h2 style={headingStyle}>Find surf near you</h2>
              <p style={subStyle}>
                Koastcast uses your location to sort spots by distance, auto-select your nearest break,
                and personalize conditions for where you actually surf.
              </p>

              {locPermission === 'granted' ? (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: '#F0FDF4',
                  border: '1px solid #BBF7D0',
                  borderRadius: 12, padding: '12px 16px',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#16A34A',
                    flexShrink: 0,
                  }} />
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#15803D', letterSpacing: '0.04em' }}>
                    Location enabled ✓
                  </span>
                </div>
              ) : locPermission === 'denied' ? (
                <div style={{
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <p style={{ fontFamily: 'monospace', fontSize: 10, color: '#B91C1C', letterSpacing: '0.04em', margin: '0 0 4px' }}>
                    Location blocked
                  </p>
                  <p style={{ fontFamily: 'monospace', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.02em', margin: 0 }}>
                    Enable in your browser settings → Site Settings → Location
                  </p>
                </div>
              ) : (
                <button
                  onClick={() => {
                    navigator.geolocation?.getCurrentPosition(
                      () => setLocPermission('granted'),
                      () => setLocPermission('denied'),
                    )
                  }}
                  style={{
                    width: '100%',
                    padding: '14px',
                    borderRadius: 12,
                    background: 'var(--cyan-muted)',
                    border: '1px solid var(--cyan)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 10,
                    fontFamily: 'var(--font-display)',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--cyan-bright)',
                    letterSpacing: '0.02em',
                  }}
                >
                  <span style={{ fontSize: 18 }}>📍</span>
                  Enable Location Access
                </button>
              )}

              <p style={{
                fontFamily: 'monospace',
                fontSize: 9,
                color: 'var(--deep-text)',
                textAlign: 'center',
                marginTop: 12,
                marginBottom: 0,
                letterSpacing: '0.04em',
              }}>
                Location data stays on your device · Never shared
              </p>
            </div>
          )}

          {/* ── Step 2: Skill ── */}
          {step === 2 && (
            <div>
              <h2 style={headingStyle}>What&apos;s your skill level?</h2>
              <p style={subStyle}>This adjusts how the Peak Score weights wave size.</p>
              <div>
                {SKILL_LEVELS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => update('skill_level', s.value)}
                    style={selectionCard(data.skill_level === s.value)}
                  >
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 13,
                      fontWeight: 700,
                      color: data.skill_level === s.value ? 'var(--cyan-bright)' : 'var(--foam)',
                      marginBottom: 2,
                    }}>
                      {s.label}
                    </div>
                    <div style={{
                      fontFamily: 'monospace',
                      fontSize: 10,
                      color: 'var(--spray)',
                      letterSpacing: '0.02em',
                    }}>
                      {s.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 3: Board ── */}
          {step === 3 && (
            <div>
              <h2 style={headingStyle}>What do you ride?</h2>
              <p style={subStyle}>Longboarders get credit for shorter periods too.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {BOARD_TYPES.map(b => (
                  <button
                    key={b.value}
                    type="button"
                    onClick={() => update('board_type', b.value)}
                    style={selectionGrid(data.board_type === b.value)}
                  >
                    <div style={{ fontSize: 22, marginBottom: 6 }}>{b.emoji}</div>
                    <div style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 12,
                      fontWeight: 700,
                      color: data.board_type === b.value ? 'var(--cyan-bright)' : 'var(--foam)',
                    }}>
                      {b.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 4: Wave size ── */}
          {step === 4 && (
            <div>
              <h2 style={headingStyle}>Ideal wave size?</h2>
              <p style={subStyle}>The Peak Score peaks when waves are in your sweet spot.</p>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Minimum height —{' '}
                  <span style={{ color: 'var(--cyan-bright)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {mToFt(data.pref_min_height_m)}
                  </span>
                </label>
                <input
                  type="range" min={0.2} max={4} step={0.1}
                  value={data.pref_min_height_m}
                  onChange={e => update('pref_min_height_m', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
                <div style={rangeHintRow}><span>Knee high</span><span>Overhead+</span></div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={labelStyle}>
                  Maximum height —{' '}
                  <span style={{ color: 'var(--cyan-bright)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {mToFt(data.pref_max_height_m)}
                  </span>
                </label>
                <input
                  type="range" min={0.5} max={10} step={0.1}
                  value={data.pref_max_height_m}
                  onChange={e => update('pref_max_height_m', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
                <div style={rangeHintRow}><span>Waist high</span><span>Double overhead</span></div>
              </div>

              <div>
                <label style={labelStyle}>
                  Min period I care about —{' '}
                  <span style={{ color: 'var(--cyan-bright)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {data.pref_min_period_s.toFixed(0)}s
                  </span>
                </label>
                <input
                  type="range" min={5} max={18} step={0.5}
                  value={data.pref_min_period_s}
                  onChange={e => update('pref_min_period_s', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
                <div style={rangeHintRow}><span>5s windswell</span><span>18s groundswell</span></div>
              </div>
            </div>
          )}

          {/* ── Step 5: Wind & Crowd ── */}
          {step === 5 && (
            <div>
              <h2 style={headingStyle}>Wind &amp; crowds?</h2>
              <p style={subStyle}>Fine-tune how much these affect your score.</p>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>
                  Offshore importance —{' '}
                  <span style={{ color: 'var(--cyan-bright)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {Math.round(data.pref_offshore_importance * 100)}%
                  </span>
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={data.pref_offshore_importance}
                  onChange={e => update('pref_offshore_importance', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
                <div style={rangeHintRow}><span>Wind doesn&apos;t matter</span><span>Offshore only</span></div>
              </div>

              <div style={{ marginBottom: 22 }}>
                <label style={labelStyle}>
                  Crowd tolerance —{' '}
                  <span style={{ color: 'var(--cyan-bright)', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                    {Math.round(data.pref_crowd_tolerance * 100)}%
                  </span>
                </label>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={data.pref_crowd_tolerance}
                  onChange={e => update('pref_crowd_tolerance', parseFloat(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--cyan)' }}
                />
                <div style={rangeHintRow}><span>Hate crowds</span><span>Don&apos;t mind</span></div>
              </div>

              <div style={{
                background: 'var(--cyan-muted)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: 14,
                padding: '14px 16px',
              }}>
                <p style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: 'var(--foam)',
                  margin: '0 0 4px',
                }}>
                  You&apos;re all set, {data.display_name || 'surfer'}!
                </p>
                <p style={{
                  fontFamily: 'monospace',
                  fontSize: 10,
                  color: 'var(--spray)',
                  letterSpacing: '0.03em',
                  margin: 0,
                }}>
                  You can update any of these in your profile at any time.
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep(s => s - 1)}
                style={backBtn}
              >
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="button"
                disabled={!canAdvance()}
                onClick={() => setStep(s => s + 1)}
                style={{ ...primaryBtn, opacity: canAdvance() ? 1 : 0.4 }}
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={finish}
                style={{ ...primaryBtn, opacity: saving ? 0.6 : 1 }}
              >
                {saving ? 'Setting up...' : "Let's Go 🌊"}
              </button>
            )}
          </div>
        </div>

        {/* Skip — only on Welcome step */}
        {step === 0 && (
          <button
            type="button"
            onClick={() => router.push('/map')}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'monospace',
              fontSize: 10,
              color: 'var(--deep-text)',
              letterSpacing: '0.06em',
              marginTop: 16,
              padding: '4px 0',
              transition: 'color 0.15s',
            }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  )
}
