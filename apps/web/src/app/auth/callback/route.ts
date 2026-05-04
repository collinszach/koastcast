import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

// Only allow redirects to same-origin paths — prevents open redirect attacks
function sanitizeRedirectPath(path: string | null): string {
  if (!path) return '/home'
  if (!path.startsWith('/') || path.startsWith('//')) return '/home'
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
    const cookieStore = await cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )

    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      console.error('Auth callback error:', error.message)
      return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
