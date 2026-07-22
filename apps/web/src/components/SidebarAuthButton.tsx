'use client'

import { createClient, isSupabaseConfigured } from '@/lib/supabase/client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, LogIn } from 'lucide-react'

export function SidebarAuthButton() {
  const [email, setEmail] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setLoaded(true)
      return
    }
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        setEmail(data.user?.email ?? null)
        setLoaded(true)
      })
  }, [])

  async function signOut() {
    await createClient().auth.signOut()
    if (typeof window !== 'undefined') {
      localStorage.removeItem('koastcast_guest')
    }
    router.push('/auth/login')
  }

  // Don't flash anything while loading
  if (!loaded) return null

  if (email) {
    return (
      <div style={{ padding: '8px 12px' }}>
        <p
          style={{
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            color: 'var(--deep-text)',
            letterSpacing: '0.06em',
            marginBottom: 6,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={email}
        >
          {email}
        </p>
        <button
          onClick={signOut}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-all"
          style={{
            color: 'var(--deep-text)',
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            fontFamily: 'var(--font-display)',
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#FCA5A5'
            e.currentTarget.style.borderColor = 'rgba(252,165,165,0.15)'
            e.currentTarget.style.background = 'rgba(252,165,165,0.05)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--deep-text)'
            e.currentTarget.style.borderColor = 'transparent'
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0" />
          Sign out
        </button>
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 12px' }}>
      <Link
        href="/auth/login"
        className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-xs transition-all"
        style={{
          color: 'var(--spray)',
          border: '1px solid rgba(14,165,233,0.15)',
          fontFamily: 'var(--font-display)',
          fontWeight: 600,
          letterSpacing: '0.04em',
          textDecoration: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--cyan)'
          e.currentTarget.style.borderColor = 'rgba(14,165,233,0.3)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--spray)'
          e.currentTarget.style.borderColor = 'rgba(14,165,233,0.15)'
        }}
      >
        <LogIn className="w-3.5 h-3.5 flex-shrink-0" />
        Sign in
      </Link>
    </div>
  )
}
