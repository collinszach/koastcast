'use client'

import { useState, useRef } from 'react'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import Link from 'next/link'

type MessageState = { type: 'success' | 'error'; text: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const RATE_LIMIT_ATTEMPTS = 3
const RATE_LIMIT_SECONDS = 30

function friendlyError(msg: string): string {
  if (msg.includes('Too many requests')) return 'Too many attempts — please wait before trying again'
  if (msg.includes('not configured')) return 'Authentication is in demo mode'
  if (msg.includes('User not found')) return 'No account found with that email address'
  return 'Failed to send reset email — please try again'
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<MessageState>(null)

  const [failCount, setFailCount] = useState(0)
  const [cooldown, setCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const configured = isSupabaseConfigured()

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
  const isDisabled = loading || isRateLimited

  async function handleSubmit(e: React.FormEvent) {
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
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/reset-password`,
    })

    if (error) {
      recordFailure()
      setMessage({ type: 'error', text: friendlyError(error.message) })
    } else {
      setMessage({
        type: 'success',
        text: 'Check your email for a password reset link',
      })
    }
    setLoading(false)
  }

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
            TERRAIN
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
            Reset password
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
            Enter your email and we&apos;ll send you a link to reset your password.
          </p>

          {/* Rate limit banner */}
          {isRateLimited && (
            <div
              style={{
                marginBottom: 16,
                padding: '10px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                fontFamily: 'var(--font-data)',
                fontSize: 12,
                color: '#FCA5A5',
              }}
            >
              Too many failed attempts. Please wait {cooldown}s before trying again.
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
              disabled={isDisabled || !email}
              className="btn-ocean w-full"
              style={{
                padding: '13px',
                opacity: isDisabled || !email ? 0.5 : 1,
                cursor: isDisabled || !email ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
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
            style={{ color: 'var(--cyan)', textDecoration: 'none' }}
          >
            &larr; Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
