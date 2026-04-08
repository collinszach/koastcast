import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = searchParams.get('lat')
  const lng = searchParams.get('lng')
  const tz  = searchParams.get('tz') ?? 'America/Denver'

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng required' }, { status: 400 })
  }

  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', lat)
  url.searchParams.set('longitude', lng)
  url.searchParams.set('timezone', tz)
  url.searchParams.set('forecast_days', '10')
  url.searchParams.set('daily', [
    'snowfall_sum',           // cm
    'temperature_2m_max',     // °F (with unit override)
    'temperature_2m_min',     // °F
    'wind_speed_10m_max',     // mph (with unit override)
    'precipitation_sum',      // mm
    'weather_code',
  ].join(','))
  url.searchParams.set('hourly', [
    'snowfall',               // cm
    'temperature_2m',         // °F
    'wind_speed_10m',         // mph
    'weather_code',
  ].join(','))
  url.searchParams.set('wind_speed_unit', 'mph')
  url.searchParams.set('temperature_unit', 'fahrenheit')

  try {
    const res = await fetch(url.toString(), {
      next: { revalidate: 3600 }, // cache 1 hour
    })
    if (!res.ok) {
      return NextResponse.json({ error: 'Weather data unavailable' }, { status: 503 })
    }
    const data = await res.json()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch weather' }, { status: 503 })
  }
}
