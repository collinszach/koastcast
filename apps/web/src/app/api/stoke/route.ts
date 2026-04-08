/**
 * Next.js API route: POST /api/stoke
 * Proxies to NUC backend /api/v1/stoke, attaching user preferences from Supabase.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { spot_id, forecast_time } = body

  if (!spot_id) {
    return NextResponse.json({ error: 'spot_id required' }, { status: 400 })
  }

  // Try to get user preferences from Supabase
  let userPrefs: Record<string, unknown> = {}
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll() {},
        },
      },
    )

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('pref_min_height_m, pref_max_height_m, pref_min_period_s, pref_offshore_importance, pref_crowd_tolerance, skill_level, board_type')
        .eq('user_id', user.id)
        .single()

      if (profile) {
        userPrefs = {
          pref_min_height_m: profile.pref_min_height_m,
          pref_max_height_m: profile.pref_max_height_m,
          pref_min_period_s: profile.pref_min_period_s,
          pref_offshore_importance: profile.pref_offshore_importance,
          pref_crowd_tolerance: profile.pref_crowd_tolerance,
          skill_level: profile.skill_level,
          board_type: profile.board_type,
        }
      }
    }
  } catch {
    // No auth or profile — use generic scoring
  }

  const nucBody = {
    spot_id,
    forecast_time: forecast_time ?? null,
    ...userPrefs,
  }

  try {
    const upstreamRes = await fetch(`${NUC_BASE}/api/v1/stoke`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Secret': NUC_SECRET,
      },
      body: JSON.stringify(nucBody),
      next: { revalidate: 0 },
    })

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.status}` },
        { status: upstreamRes.status },
      )
    }

    const data = await upstreamRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Stoke proxy error:', err)
    return NextResponse.json({ error: 'Failed to compute stoke score' }, { status: 503 })
  }
}
