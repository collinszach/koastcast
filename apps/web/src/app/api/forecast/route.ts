/**
 * Next.js API route: proxy to NUC backend
 * Adds the NUC API secret header so it's not exposed to the browser.
 */
import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spot_id')
  const days = searchParams.get('days') ?? '7'

  if (!spotId) {
    return NextResponse.json({ error: 'spot_id required' }, { status: 400 })
  }

  try {
    const upstreamRes = await fetch(
      `${NUC_BASE}/api/v1/forecast/${spotId}?days=${days}`,
      {
        headers: {},
        cache: 'no-store',
      },
    )

    if (!upstreamRes.ok) {
      // Don't leak NUC auth errors (401/403) to the browser
      const status = upstreamRes.status === 401 || upstreamRes.status === 403 ? 503 : upstreamRes.status
      return NextResponse.json({ error: 'Forecast unavailable' }, { status })
    }

    const data = await upstreamRes.json()
    return NextResponse.json(data)
  } catch (err) {
    console.error('Forecast proxy error:', err)
    return NextResponse.json({ error: 'Failed to fetch forecast' }, { status: 503 })
  }
}
