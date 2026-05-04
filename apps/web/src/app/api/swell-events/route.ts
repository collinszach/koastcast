/**
 * Next.js API route: proxy swell events to NUC backend
 * Forwards the user's Supabase JWT for auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spotId')
  const days = searchParams.get('days') ?? '16'

  if (!spotId || !/^[a-z0-9-]+$/.test(spotId)) {
    return NextResponse.json({ error: 'Invalid spotId' }, { status: 400 })
  }

  let accessToken: string | null = null
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token ?? null
  } catch {
    // unauthenticated
  }

  try {
    const upstreamRes = await fetch(
      `${NUC_BASE}/api/v1/swell-events/${spotId}?days=${days}`,
      {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        next: { revalidate: 3600 },
      },
    )
    if (!upstreamRes.ok) {
      return NextResponse.json({ error: `Upstream: ${upstreamRes.status}` }, { status: upstreamRes.status })
    }
    return NextResponse.json(await upstreamRes.json())
  } catch (err) {
    console.error('Swell events proxy error:', err)
    return NextResponse.json({ error: 'Swell event data unavailable' }, { status: 503 })
  }
}
