/**
 * Next.js API route: proxy swell events to NUC backend
 */
import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spotId')
  const days = searchParams.get('days') ?? '16'

  if (!spotId) {
    return NextResponse.json({ error: 'spotId required' }, { status: 400 })
  }

  try {
    const upstreamRes = await fetch(
      `${NUC_BASE}/api/v1/swell-events/${spotId}?days=${days}`,
      {
        headers: { 'X-API-Secret': NUC_SECRET },
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
