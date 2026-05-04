'use client'

import { useState } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type MessageState = { type: 'success' | 'error'; text: string } | null

function friendlyError(msg: string): string {
  if (msg.includes('User already registered')) return 'An account with this email already exists — try signing in'
  if (msg.includes('Password should be')) return 'Password must be at least 8 characters'
  if (msg.includes('Invalid email')) return 'Please enter a valid email address'
  if (msg.includes('not configured')) return 'Authentication is in demo mode — use Continue as Guest'
  return 'Sign up failed — please try again'
}

type PasswordStrength = { label: string; color: string; width: string }

function getPasswordStrength(pw: string): PasswordStrength {
  if (pw.length === 0) return { label: '', color: 'transparent', width: '0%' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++

  if (score <= 1) return { label: 'Weak', color: '#EF4444', width: '25%' }
  if (score <= 3) return { label: 'Fair', color: '#F59E0B', width: '60%' }
  return { label: 'Strong', color: '#10B981', width: '100%' }
}

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [agreedToTos, setAgreedToTos] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)

  const configured = isSupabaseConfigured()
  const strength = getPasswordStrength(password)
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    if (!configured) {
      setMessage({ type: 'error', text: friendlyError('not configured') })
      return
    }
    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'Passwords do not match' })
      return
    }
    if (password.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters' })
      return
    }
    if (!agreedToTos) {
      setMessage({ type: 'error', text: 'Please agree to the Terms of Service to continue' })
      return
    }
    setLoading(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      setMessage({ type: 'error', text: friendlyError(error.message) })
    } else {
      setMessage({
        type: 'success',
        text: 'Account created! Check your email to confirm your address before signing in.',
      })
    }
    setLoading(false)
  }

  function continueAsGuest() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('terrain_guest', 'true')
      document.cookie = 'terrain_guest=true; path=/; max-age=86400; SameSite=Lax'
    }
    router.push('/home')
  }

  const canSubmit = !loading && !!email && !!password && !!confirmPassword && agreedToTos

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--deep)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 16px',
        position: 'relative',
      }}
    >
      {/* Background radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 50% 100%, rgba(6,182,212,0.07) 0%, transparent 60%)',
        }}
      />
      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.015]"
        style={{
          backgroundImage:
            'radial-gradient(circle, rgba(6,182,212,0.8) 1px, transparent 1px)',
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
              color: '#FCD34D',
              lineHeight: 1.5,
            }}
          >
            <strong style={{ fontWeight: 700 }}>Demo Mode</strong> — Supabase auth is not
            configured in this environment. Sign-up is disabled.{' '}
            <button
              onClick={continueAsGuest}
              style={{
                color: '#06B6D4',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
                textDecoration: 'underline',
              }}
            >
              Continue as Guest →
            </button>
          </div>
        )}

        {/* Logo */}
        <div className="text-center" style={{ marginBottom: 36 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 60%, #10B981 100%)',
              boxShadow: '0 8px 32px rgba(6,182,212,0.35)',
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
            Peakcast
          </h1>
          <p style={{ fontSize: 13, color: 'var(--spray)', lineHeight: 1.5 }}>
            Create your account and start forecasting.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated" style={{ padding: '36px 32px' }}>
          <h2
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 18,
              fontWeight: 700,
              color: 'var(--foam)',
              letterSpacing: '-0.01em',
              marginBottom: 24,
            }}
          >
            Create account
          </h2>

          <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label
                htmlFor="email"
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
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
                className="ocean-input"
              />
            </div>

            <div>
              <label
                htmlFor="password"
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
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Min. 8 characters"
                  autoComplete="new-password"
                  className="ocean-input"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
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
                  {showPassword ? (
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

              {/* Password strength bar */}
              {password.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: 'rgba(255,255,255,0.07)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: strength.width,
                        background: strength.color,
                        borderRadius: 2,
                        transition: 'width 0.3s, background 0.3s',
                      }}
                    />
                  </div>
                  <p
                    style={{
                      marginTop: 4,
                      fontFamily: 'var(--font-data)',
                      fontSize: 10,
                      color: strength.color,
                    }}
                  >
                    {strength.label}
                  </p>
                </div>
              )}
            </div>

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
                Confirm password
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                className="ocean-input"
                style={{
                  boxShadow: !passwordsMatch ? '0 0 0 1px rgba(239,68,68,0.5)' : undefined,
                }}
              />
              {!passwordsMatch && (
                <p
                  style={{
                    marginTop: 4,
                    fontFamily: 'var(--font-data)',
                    fontSize: 10,
                    color: '#FCA5A5',
                  }}
                >
                  Passwords do not match
                </p>
              )}
            </div>

            {/* Terms of Service */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                cursor: 'pointer',
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                color: 'var(--deep-text)',
                lineHeight: 1.5,
              }}
            >
              <input
                type="checkbox"
                checked={agreedToTos}
                onChange={(e) => setAgreedToTos(e.target.checked)}
                required
                style={{ accentColor: 'var(--cyan)', width: 14, height: 14, marginTop: 2, flexShrink: 0 }}
              />
              <span>
                I agree to the{' '}
                <Link
                  href="/terms"
                  style={{ color: 'var(--cyan)', textDecoration: 'none' }}
                  target="_blank"
                >
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link
                  href="/privacy"
                  style={{ color: 'var(--cyan)', textDecoration: 'none' }}
                  target="_blank"
                >
                  Privacy Policy
                </Link>
              </span>
            </label>

            {message && (
              <p
                style={{
                  fontSize: 12,
                  fontFamily: 'var(--font-data)',
                  color: message.type === 'error' ? '#FCA5A5' : 'var(--cyan)',
                  lineHeight: 1.5,
                }}
              >
                {message.text}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="btn-ocean w-full"
              style={{
                padding: '13px',
                opacity: !canSubmit ? 0.5 : 1,
                cursor: !canSubmit ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ position: 'relative', margin: '24px 0' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 1, background: 'rgba(6,182,212,0.1)' }} />
            </div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  color: 'var(--deep-text)',
                  background: 'rgba(10,22,40,0.97)',
                  padding: '0 12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                or
              </span>
            </div>
          </div>

          {/* Guest button */}
          <button
            onClick={continueAsGuest}
            className="w-full flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'transparent',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: 10,
              padding: '11px',
              color: 'var(--deep-text)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.3)'
              e.currentTarget.style.color = 'var(--spray)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)'
              e.currentTarget.style.color = 'var(--deep-text)'
            }}
          >
            Continue as Guest
          </button>
        </div>

        {/* Bottom link */}
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
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--cyan)', textDecoration: 'none' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
