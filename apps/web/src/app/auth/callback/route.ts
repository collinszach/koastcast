import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Only allow redirects to same-origin paths — prevents open redirect attacks
function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/home'
  // Must start with / and not be protocol-relative or external
  if (!path.startsWith('/') || path.startsWith('//')) return '/home'
  // Allowlist of valid destination path prefixes
  const allowed = [
    '/home',
    '/map',
    '/sessions',
    '/profile',
    '/explore',
    '/weather',
    '/wind',
    '/snow',
    '/trails',
    '/spots',
    '/spot',
    '/upgrade',
  ]
  if (allowed.some((p) => path === p || path.startsWith(p + '/'))) return path
  return '/home'
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = sanitizeRedirectPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth callback error:', error.message)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
