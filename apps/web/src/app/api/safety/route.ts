/**
 * Next.js API route: proxy safety report to NUC backend
 */
import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8000'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const spotId = searchParams.get('spotId')

  if (!spotId) {
    return NextResponse.json({ error: 'spotId required' }, { status: 400 })
  }

  try {
    const upstreamRes = await fetch(`${NUC_BASE}/api/v1/safety/${spotId}`, {
      headers: { 'X-API-Secret': NUC_SECRET },
      next: { revalidate: 3600 }, // safety reports cache for 1h
    })

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: `Upstream error: ${upstreamRes.status}` },
        { status: upstreamRes.status },
      )
    }

    return NextResponse.json(await upstreamRes.json())
  } catch (err) {
    console.error('Safety proxy error:', err)
    return NextResponse.json({ error: 'Safety data unavailable' }, { status: 503 })
  }
}
