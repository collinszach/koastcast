'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type AuthMode = 'magic' | 'password'
type MessageState = { type: 'success' | 'error'; text: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_ATTEMPTS = 3
const RATE_LIMIT_SECONDS = 30

// Only allow redirects to same-origin paths
function sanitizeNext(path: string | null): string {
  if (!path) return '/home'
  if (!path.startsWith('/') || path.startsWith('//')) return '/home'
  const allowed = [
    '/home', '/map', '/sessions', '/profile', '/explore',
    '/weather', '/wind', '/snow', '/trails', '/spots', '/spot', '/upgrade',
  ]
  if (allowed.some((p) => path === p || path.startsWith(p + '/'))) return path
  return '/home'
}

function friendlyError(msg: string): string {
  if (msg.includes('Invalid login credentials')) return 'Incorrect email or password'
  if (msg.includes('Email not confirmed')) return 'Please check your email to confirm your account'
  if (msg.includes('Too many requests')) return 'Too many attempts — please wait before trying again'
  if (msg.includes('not configured')) return 'Authentication is in demo mode — use Continue as Guest'
  if (msg.includes('auth_failed')) return 'Sign-in link expired or invalid — try again'
  return 'Sign in failed — please try again'
}

function LoginPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const nextPath = sanitizeNext(searchParams.get('next'))

  const [mode, setMode] = useState<AuthMode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)

  // Client-side rate limiting
  const [failCount, setFailCount] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const configured = isSupabaseConfigured()

  // Show error from callback redirect
  useEffect(() => {
    const err = searchParams.get('error')
    if (err) setMessage({ type: 'error', text: friendlyError(err) })
  }, [searchParams])

  // Load remember-me preference
  useEffect(() => {
    const stored = localStorage.getItem('koastcast_remember_me')
    if (stored === 'true') setRememberMe(true)
  }, [])

  function startCooldown() {
    setCooldown(RATE_LIMIT_SECONDS)
    cooldownRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(cooldownRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }

  function recordFailure() {
    const next = failCount + 1
    setFailCount(next)
    if (next >= RATE_LIMIT_ATTEMPTS) startCooldown()
  }

  const isRateLimited = cooldown > 0

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }
    if (!configured) {
      setMessage({ type: 'error', text: friendlyError('not configured') })
      return
    }
    if (isRateLimited) return
    setLoading(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL || location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
    if (error) {
      recordFailure()
      setMessage({ type: 'error', text: friendlyError(error.message) })
    } else {
      setMessage({ type: 'success', text: 'Check your email for the magic link!' })
    }
    setLoading(false)
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setMessage({ type: 'error', text: 'Please enter a valid email address' })
      return
    }
    if (!configured) {
      setMessage({ type: 'error', text: friendlyError('not configured') })
      return
    }
    if (isRateLimited) return
    setLoading(true)
    setMessage(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      recordFailure()
      setMessage({ type: 'error', text: friendlyError(error.message) })
    } else {
      localStorage.setItem('koastcast_remember_me', rememberMe ? 'true' : 'false')
      router.push(nextPath)
    }
    setLoading(false)
  }

  async function handleGoogle() {
    if (!configured) {
      setMessage({ type: 'error', text: friendlyError('not configured') })
      return
    }
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    })
  }

  function continueAsGuest() {
    if (typeof window !== 'undefined') {
      localStorage.setItem('koastcast_guest', 'true')
      // Set a cookie so middleware can detect guest mode server-side
      document.cookie = 'koastcast_guest=true; path=/; max-age=86400; SameSite=Lax'
    }
    router.push('/home')
  }

  const isDisabled = loading || isRateLimited

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
            configured in this environment. Sign-in is disabled.{' '}
            <button
              onClick={continueAsGuest}
              style={{
                color: 'var(--cyan-bright)',
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
              marginBottom: 24,
            }}
          >
            Sign in
          </h2>

          {/* Mode tabs */}
          <div
            style={{
              display: 'flex',
              gap: 4,
              background: 'var(--paper-sunken)',
              border: '1px solid var(--tile-border)',
              borderRadius: 10,
              padding: 4,
              marginBottom: 24,
            }}
          >
            {(['magic', 'password'] as AuthMode[]).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setMessage(null) }}
                style={{
                  flex: 1,
                  padding: '7px 0',
                  borderRadius: 7,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.05em',
                  transition: 'all 0.15s',
                  background: mode === m ? 'var(--cyan-muted)' : 'transparent',
                  color: mode === m ? 'var(--cyan-bright)' : 'var(--spray)',
                  boxShadow: mode === m ? '0 0 0 1px rgba(14,165,233,0.25)' : 'none',
                }}
              >
                {m === 'magic' ? 'Magic Link' : 'Password'}
              </button>
            ))}
          </div>

          {/* Rate limit banner */}
          {isRateLimited && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 8,
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                color: '#B91C1C',
              }}
            >
              Too many failed attempts. Please wait {cooldown}s before trying again.
            </div>
          )}

          {/* Magic Link form */}
          {mode === 'magic' && (
            <form onSubmit={handleMagicLink} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="email-magic"
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
                  id="email-magic"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="ocean-input"
                />
              </div>

              {message && (
                <p
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-data)',
                    color: message.type === 'error' ? '#B91C1C' : 'var(--cyan-bright)',
                  }}
                >
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={isDisabled || !email}
                className="btn-ocean w-full"
                style={{
                  padding: '13px',
                  opacity: isDisabled || !email ? 0.5 : 1,
                  cursor: isDisabled || !email ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          )}

          {/* Password form */}
          {mode === 'password' && (
            <form onSubmit={handlePassword} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label
                  htmlFor="email-pw"
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
                  id="email-pw"
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
                    placeholder="••••••••"
                    autoComplete="current-password"
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
                      // Eye-off icon
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      // Eye icon
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontFamily: 'var(--font-data)',
                  fontSize: 12,
                  color: 'var(--deep-text)',
                }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ accentColor: 'var(--cyan)', width: 14, height: 14 }}
                />
                Remember me
              </label>

              {message && (
                <p
                  style={{
                    fontSize: 12,
                    fontFamily: 'var(--font-data)',
                    color: message.type === 'error' ? '#B91C1C' : 'var(--cyan-bright)',
                  }}
                >
                  {message.text}
                </p>
              )}

              <button
                type="submit"
                disabled={isDisabled || !email || !password}
                className="btn-ocean w-full"
                style={{
                  padding: '13px',
                  opacity: isDisabled || !email || !password ? 0.5 : 1,
                  cursor: isDisabled || !email || !password ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? 'Signing in…' : 'Sign in'}
              </button>

              <div style={{ textAlign: 'right', marginTop: -8, marginBottom: 4 }}>
                <Link
                  href="/auth/forgot-password"
                  style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: 'var(--cyan-bright)',
                    textDecoration: 'none',
                    letterSpacing: '0.04em',
                  }}
                >
                  Forgot password?
                </Link>
              </div>
            </form>
          )}

          {/* Divider */}
          <div style={{ position: 'relative', margin: '24px 0' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 1, background: 'var(--tile-border)' }} />
            </div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span
                style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  color: 'var(--deep-text)',
                  background: 'var(--tile-bg)',
                  padding: '0 12px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}
              >
                or
              </span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 transition-all"
            style={{
              background: 'var(--paper-sunken)',
              border: '1px solid var(--tile-border-strong)',
              borderRadius: 10,
              padding: '11px',
              color: 'var(--mist)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              marginBottom: 10,
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.borderColor = 'var(--tile-border-strong)')
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = 'var(--tile-border-strong)')
            }
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>

          {/* Guest button */}
          <button
            onClick={continueAsGuest}
            className="w-full flex items-center justify-center gap-2 transition-all"
            style={{
              background: 'transparent',
              border: '1px solid var(--tile-border-strong)',
              borderRadius: 10,
              padding: '11px',
              color: 'var(--spray)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--cyan)'
              e.currentTarget.style.color = 'var(--mist)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--tile-border-strong)'
              e.currentTarget.style.color = 'var(--spray)'
            }}
          >
            Continue as Guest
          </button>
        </div>

        {/* Bottom links */}
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
          Don&apos;t have an account?{' '}
          <Link
            href="/auth/signup"
            style={{ color: 'var(--cyan-bright)', textDecoration: 'none' }}
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--paper)' }} />}>
      <LoginPageInner />
    </Suspense>
  )
}
