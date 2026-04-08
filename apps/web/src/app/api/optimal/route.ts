/**
 * GET /api/optimal?spot_id=...&days=14 — Proxy optimal windows to NUC.
 */
import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spot_id')
  const days = searchParams.get('days') || '14'

  if (!spotId) {
    return NextResponse.json({ error: 'spot_id required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${NUC_BASE}/api/v1/optimal/${spotId}?days=${days}`,
      {
        headers: { 'X-API-Secret': NUC_SECRET },
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
