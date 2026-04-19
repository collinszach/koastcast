/**
 * Next.js API route: proxy insights to NUC backend
 * Forwards the user's Supabase JWT for auth.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const upstreamRes = await fetch(`${NUC_BASE}/api/v1/insights`, {
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
      },
      next: { revalidate: 300 },
    })

    if (!upstreamRes.ok) {
      return NextResponse.json({ error: `Upstream: ${upstreamRes.status}` }, { status: upstreamRes.status })
    }

    return NextResponse.json(await upstreamRes.json())
  } catch (err) {
    console.error('Insights proxy error:', err)
    return NextResponse.json({ error: 'Insights unavailable' }, { status: 503 })
  }
}
