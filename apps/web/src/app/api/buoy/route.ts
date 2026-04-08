import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || 'http://localhost:8002'
const NUC_SECRET = process.env.NUC_API_SECRET || ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stationId = searchParams.get('station_id')

  if (!stationId) {
    return NextResponse.json({ error: 'station_id required' }, { status: 400 })
  }

  try {
    const res = await fetch(
      `${NUC_BASE}/api/v1/buoys/${stationId}/live`,
      {
        headers: { 'X-API-Secret': NUC_SECRET },
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Upstream: ${res.status}` }, { status: res.status })
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json({ error: 'Buoy data unavailable' }, { status: 503 })
  }
}
