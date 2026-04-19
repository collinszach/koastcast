/**
 * GET /api/optimal?spot_id=...&days=14 — Proxy optimal windows to NUC.
 * Forwards the user's Supabase JWT for auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spot_id')
  const days = searchParams.get('days') || '14'

  if (!spotId) {
    return NextResponse.json({ error: 'spot_id required' }, { status: 400 })
  }

  // Get user JWT
  let accessToken: string | null = null
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()
    accessToken = session?.access_token ?? null
  } catch {
    // unauthenticated — FastAPI will reject if JWT required
  }

  try {
    const res = await fetch(
      `${NUC_BASE}/api/v1/optimal/${spotId}?days=${days}`,
      {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
        },
        next: { revalidate: 1800 }, // 30 min cache
      },
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Upstream ${res.status}` }, { status: res.status })
    }

    return NextResponse.json(await res.json())
  } catch (err) {
    console.error('Optimal windows proxy error:', err)
    return NextResponse.json({ error: 'Service unavailable', windows: [] }, { status: 503 })
  }
}
