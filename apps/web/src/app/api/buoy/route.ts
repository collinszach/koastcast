import { NextRequest, NextResponse } from 'next/server'

const NUC_BASE = process.env.NUC_API_BASE_URL || ''

/**
 * Parse NDBC realtime2 text file format.
 * First two lines are headers, data starts at line 3.
 * Columns (space-separated): #YY MM DD hh mm WDIR WSPD GST WVHT DPD APD MWD PRES ATMP WTMP DEWP VIS PTDY TIDE
 * Missing values are represented as "MM" or "99.00" / "999" / "9999.0"
 */
function parseNdbcText(text: string) {
  const lines = text.trim().split('\n')
  if (lines.length < 3) return null

  // Find first data line with valid wave height
  for (let i = 2; i < Math.min(lines.length, 10); i++) {
    const cols = lines[i].trim().split(/\s+/)
    if (cols.length < 15) continue

    const wvht = parseFloat(cols[8])
    const dpd = parseFloat(cols[9])
    const mwd = parseFloat(cols[11])
    const wspd = parseFloat(cols[6])
    const wdir = parseFloat(cols[5])
    const wtmp = parseFloat(cols[14])

    // Skip if wave height is missing (MM = 99.00)
    if (wvht >= 90) continue

    const year = cols[0].length === 2 ? `20${cols[0]}` : cols[0]
    const timestamp = `${year}-${cols[1]}-${cols[2]}T${cols[3]}:${cols[4]}:00Z`

    return {
      station_id: '', // filled by caller
      wave_height: wvht,
      dominant_period: dpd < 90 ? dpd : null,
      mean_direction: mwd < 900 ? mwd : null,
      wind_speed: wspd < 90 ? wspd : null,
      wind_direction: wdir < 900 ? wdir : null,
      water_temp: wtmp < 90 ? wtmp : null,
      timestamp,
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const stationId = searchParams.get('station_id')

  if (!stationId || !/^[A-Za-z0-9]{4,7}$/.test(stationId)) {
    return NextResponse.json({ error: 'Invalid station_id' }, { status: 400 })
  }

  // Try NUC backend first if configured
  if (NUC_BASE) {
    try {
      const res = await fetch(`${NUC_BASE}/api/v1/buoys/${stationId}/live`, {
        cache: 'no-store',
        signal: AbortSignal.timeout(5000),
      })
      if (res.ok) {
        return NextResponse.json(await res.json())
      }
    } catch {
      // Fall through to NDBC direct
    }
  }

  // Fallback: fetch directly from NDBC
  try {
    const res = await fetch(
      `https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`,
      { next: { revalidate: 900 } }, // 15 min cache
    )

    if (!res.ok) {
      return NextResponse.json(
        { error: `NDBC station ${stationId} unavailable` },
        { status: 503 },
      )
    }

    const text = await res.text()
    const reading = parseNdbcText(text)

    if (!reading) {
      return NextResponse.json(
        { error: `No valid readings from station ${stationId}` },
        { status: 503 },
      )
    }

    reading.station_id = stationId
    return NextResponse.json(reading)
  } catch {
    return NextResponse.json({ error: 'Buoy data unavailable' }, { status: 503 })
  }
}
