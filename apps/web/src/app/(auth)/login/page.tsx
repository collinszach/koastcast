'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
    } else {
      setMessage(`Magic link sent to ${email}. Check your inbox.`)
    }
    setLoading(false)
  }

  async function handleGoogleOAuth() {
    const supabase = createClient()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--deep)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 16px' }}>
      {/* Background radial glow */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 100%, rgba(6,182,212,0.06) 0%, transparent 60%)',
      }} />
      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.015]" style={{
        backgroundImage: 'radial-gradient(circle, rgba(6,182,212,0.8) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }} />

      <div className="relative w-full max-w-[400px]">
        {/* Logo */}
        <div className="text-center mb-10">
          {/* Wave icon */}
          <div style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
            boxShadow: '0 8px 32px rgba(6,182,212,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M2 12C5 8 8 6 12 8C16 10 19 8 22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M2 18C5 14 8 12 12 14C16 16 19 14 22 10" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            marginBottom: 8,
          }}>
            <span style={{ color: 'var(--foam)' }}>Swell</span>
            <span style={{ color: 'var(--cyan)' }}>Stack</span>
          </h1>
          <p style={{ fontSize: 13, color: 'var(--spray)', lineHeight: 1.5 }}>
            AI-native surf forecasting.<br />More accurate. More personal.
          </p>
        </div>

        {/* Card */}
        <div className="glass-card-elevated" style={{ padding: '32px' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 18,
            fontWeight: 700,
            color: 'var(--foam)',
            letterSpacing: '-0.01em',
            marginBottom: 24,
          }}>Sign in</h2>

          {/* Magic Link Form */}
          <form onSubmit={handleMagicLink} className="space-y-4">
            <div>
              <label htmlFor="email" style={{
                display: 'block',
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'var(--spray)',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}>
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="ocean-input"
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: '#FCA5A5', fontFamily: 'var(--font-data)' }}>{error}</p>
            )}
            {message && (
              <p style={{ fontSize: 12, color: 'var(--cyan)', fontFamily: 'var(--font-data)' }}>{message}</p>
            )}

            <button
              type="submit"
              disabled={loading || !email}
              className="btn-ocean w-full"
              style={{ padding: '13px', opacity: (loading || !email) ? 0.5 : 1, cursor: (loading || !email) ? 'not-allowed' : 'pointer' }}
            >
              {loading ? 'Sending...' : 'Send magic link'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ position: 'relative', margin: '24px 0' }}>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center' }}>
              <div style={{ width: '100%', height: 1, background: 'rgba(6,182,212,0.1)' }} />
            </div>
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'var(--deep-text)',
                background: 'rgba(10,22,40,0.97)',
                padding: '0 12px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}>or</span>
            </div>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleOAuth}
            className="w-full flex items-center justify-center gap-3 transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              padding: '11px',
              color: 'var(--mist)',
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          color: 'var(--deep-text)',
          marginTop: 20,
          letterSpacing: '0.04em',
        }}>
          By signing in, you agree to our terms and privacy policy.
        </p>
      </div>
    </div>
  )
}
