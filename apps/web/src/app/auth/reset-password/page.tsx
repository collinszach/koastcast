'use client'

import { useState, useEffect } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type MessageState = { type: 'success' | 'error'; text: string } | null

function getPasswordStrength(p: string): { score: number; label: string; color: string } {
  const score =
    (p.length >= 8 ? 1 : 0) +
    (/[A-Z]/.test(p) ? 1 : 0) +
    (/[0-9]/.test(p) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(p) ? 1 : 0)
  if (score <= 1) return { score, label: 'Weak', color: '#EF4444' }
  if (score === 2) return { score, label: 'Fair', color: '#F59E0B' }
  return { score, label: 'Strong', color: '#10B981' }
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sessionReady, setSessionReady] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)

  const configured = isSupabaseConfigured()
  const strength = getPasswordStrength(newPassword)

  // Verify the user has a recovery session from the email link
  useEffect(() => {
    if (!configured) {
      setSessionReady(true)
      return
    }
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSessionReady(true)
      } else {
        // No session — the link may have expired or already been used
        setMessage({
          type: 'error',
          text: 'This reset link is invalid or has expired. Please request a new one.',
        })
        setSessionReady(true)
      }
    })
  }, [configured])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (!configured) {
      setMessage({ type: 'error', text: 'Authentication is in demo mode' })
      return
    }

    setLoading(true)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })

    if (error) {
      setMessage({ type: 'error', text: error.message || 'Failed to update password — please try again' })
    } else {
      setMessage({ type: 'success', text: 'Password updated successfully! Redirecting…' })
      setTimeout(() => router.push('/home'), 2000)
    }
    setLoading(false)
  }

  const canSubmit = newPassword.length >= 8 && confirmPassword.length > 0

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--paper)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        position: 'relative',
      }}
    >
      {/* Fine dot grid texture — same convention as spot-detail hero */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(18,24,31,0.8) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      <div className="relative w-full" style={{ maxWidth: 420 }}>

        {/* Demo Mode banner */}
        {!configured && (
          <div
            style={{
              marginBottom: 20,
              padding: '12px 16px',
              background: 'rgba(245,158,11,0.1)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 10,
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              color: 'var(--amber-bright)',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ fontWeight: 700 }}>Demo Mode</strong> — Supabase auth is not
            configured in this environment. Password reset is disabled.
          </div>
        )}

        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 36 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'var(--cyan)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 18px',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path
                d="M12 3L20 18H4L12 3Z"
                fill="rgba(255,255,255,0.15)"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M12 3L15 9H9L12 3Z" fill="white" />
              <path
                d="M2 20C5 17 8 17 12 19C16 21 19 19 22 16"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 30,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              lineHeight: 1,
              marginBottom: 8,
              color: 'var(--foam)',
            }}
          >
            Koastcast
          </h1>
          <p style={{ fontSize: 13, color: 'var(--spray)', lineHeight: 1.5 }}>
            AI-native forecasting for surf, snow &amp; trails.
          </p>
        </div>

        {/* Card */}
        <div
          className="glass-card-elevated"
          style={{ padding: '36px 32px' }}
        >
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--foam)',
              letterSpacing: '-0.01em',
              marginBottom: 8,
            }}
          >
            Set new password
          </h2>
          <p
            style={{
              fontFamily: 'var(--font-data)',
              fontSize: 12,
              color: 'var(--deep-text)',
              marginBottom: 24,
              lineHeight: 1.6,
            }}
          >
            Choose a strong password for your account.
          </p>

          {sessionReady && (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* New password */}
              <div>
                <label
                  htmlFor="new-password"
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: 'var(--spray)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  New password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="ocean-input"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--deep-text)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showNew ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password strength indicator */}
                {newPassword.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          style={{
                            flex: 1,
                            height: 3,
                            borderRadius: 2,
                            background: i <= strength.score ? strength.color : 'var(--tile-border)',
                            transition: 'background 0.2s',
                          }}
                        />
                      ))}
                    </div>
                    <span
                      style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 10,
                        color: strength.color,
                        letterSpacing: '0.05em',
                      }}
                    >
                      {strength.label}
                    </span>
                  </div>
                )}
              </div>

              {/* Confirm password */}
              <div>
                <label
                  htmlFor="confirm-password"
                  style={{
                    display: 'block',
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: 'var(--spray)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    marginBottom: 8,
                  }}
                >
                  Confirm new password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="confirm-password"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    autoComplete="new-password"
                    className="ocean-input"
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                    style={{
                      position: 'absolute',
                      right: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--deep-text)',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {showConfirm ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Match indicator */}
                {confirmPassword.length > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span
                      style={{
                        fontFamily: 'var(--font-data)',
                        fontSize: 10,
                        color: newPassword === confirmPassword ? 'var(--trail)' : '#DC2626',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {newPassword === confirmPassword ? 'Passwords match' : 'Passwords do not match'}
                    </span>
                  </div>
                )}
              </div>

              {message && (
                <p
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-data)',
                    color: message.type === 'error' ? '#B91C1C' : 'var(--cyan-bright)',
                    lineHeight: 1.5,
                  }}
                >
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || !canSubmit}
                className="btn-ocean w-full"
                style={{
                  padding: '13px',
                  opacity: loading || !canSubmit ? 0.5 : 1,
                  cursor: loading || !canSubmit ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}
        </div>

        {/* Back link */}
        <p
          style={{
            textAlign: 'center',
            fontFamily: 'var(--font-data)',
            fontSize: 12,
            color: 'var(--deep-text)',
            marginTop: 20,
            letterSpacing: '0.02em',
          }}
        >
          <Link
            href="/auth/login"
            style={{ color: 'var(--cyan-bright)', textDecoration: 'none' }}
          >
            &larr; Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
