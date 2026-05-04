import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require authentication — unauthenticated users are redirected to login
const PROTECTED_ROUTES = ['/profile', '/sessions', '/upgrade', '/admin']

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next()
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // If Supabase is not configured (dev / demo mode), allow access
  if (!supabaseUrl.includes('.supabase.co')) {
    return NextResponse.next()
  }

  let response = NextResponse.next({ request })

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value)
          response.cookies.set(name, value, options)
        })
      },
    },
  })

  // Always refresh the session — this keeps auth tokens valid across all pages
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Only enforce auth on explicitly protected routes
  if (PROTECTED_ROUTES.some((route) => pathname.startsWith(route))) {
    // Admin always requires real auth — no guest bypass
    const isAdmin = pathname.startsWith('/admin')
    const guestCookie = request.cookies.get('terrain_guest')
    if (!user && (isAdmin || !guestCookie)) {
      const loginUrl = new URL('/auth/login', request.url)
      loginUrl.searchParams.set('next', pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
