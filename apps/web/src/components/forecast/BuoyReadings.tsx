'use client'

import { useState, useEffect } from 'react'

interface BuoyData {
  station_id: string
  observed_at: string
  wvht: number | null   // significant wave height (m)
  dpd: number | null    // dominant period (s)
  apd: number | null    // average period (s)
  mwd: number | null    // mean wave direction (deg)
  wspd: number | null   // wind speed (m/s)
  wdir: number | null   // wind direction (deg)
  wtmp: number | null   // water temp (C)
  atmp: number | null   // air temp (C)
}

function compassDir(deg: number | null): string {
  if (deg == null) return '--'
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(deg / 22.5) % 16]
}

function mToFt(m: number | null): string {
  if (m == null) return '--'
  return `${(m * 3.281).toFixed(1)}ft`
}

function msToKnots(ms: number | null): string {
  if (ms == null) return '--'
  return `${(ms * 1.944).toFixed(0)}kts`
}

function celsiusToF(c: number | null): string {
  if (c == null) return '--'
  return `${((c * 9/5) + 32).toFixed(0)}°F`
}

function StatCell({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div style={{
      background: 'rgba(6,182,212,0.04)',
      border: '1px solid rgba(6,182,212,0.08)',
      borderRadius: 8,
      padding: '10px 12px',
      minWidth: 80,
    }}>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        color: 'var(--deep-text)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 5,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--foam)',
        lineHeight: 1,
      }}>{value}</div>
      {sub && (
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          color: 'var(--spray)',
          marginTop: 3,
        }}>{sub}</div>
      )}
    </div>
  )
}

export default function BuoyReadings({
  buoyId,
  spotName,
}: {
  buoyId: string
  spotName: string
}) {
  const [data, setData] = useState<BuoyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!buoyId) return
    const controller = new AbortController()
    fetch(`/api/buoy?station_id=${buoyId}`, { signal: controller.signal })
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
    return () => controller.abort()
  }, [buoyId])

  const lastUpdated = data?.observed_at
    ? new Date(data.observed_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    : null

  return (
    <div className="glass-card" style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: loading ? '#F59E0B' : error ? '#EF4444' : '#10B981',
            boxShadow: `0 0 6px ${loading ? '#F59E0B' : error ? '#EF4444' : '#10B981'}`,
            flexShrink: 0,
          }} />
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--foam)',
          }}>
            Buoy {buoyId}
          </span>
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            color: 'var(--deep-text)',
            letterSpacing: '0.06em',
          }}>
            NDBC · nearest to {spotName}
          </span>
        </div>
        {lastUpdated && (
          <span style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            color: 'var(--deep-text)',
            letterSpacing: '0.05em',
          }}>Updated {lastUpdated}</span>
        )}
      </div>

      {loading && (
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: 'var(--deep-text)',
          padding: '12px 0',
          textAlign: 'center',
          letterSpacing: '0.06em',
        }}>
          Fetching live buoy data...
        </div>
      )}

      {error && (
        <div style={{
          fontFamily: 'var(--font-data)',
          fontSize: 11,
          color: '#64748B',
          padding: '12px 0',
          textAlign: 'center',
          letterSpacing: '0.05em',
        }}>
          Buoy data temporarily unavailable · NDBC station {buoyId}
        </div>
      )}

      {data && !error && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <StatCell
            label="Sig. Height"
            value={mToFt(data.wvht)}
            sub={data.wvht ? `${data.wvht.toFixed(1)}m` : undefined}
          />
          <StatCell
            label="Dom. Period"
            value={data.dpd ? `${data.dpd.toFixed(0)}s` : '--'}
            sub={data.apd ? `avg ${data.apd.toFixed(0)}s` : undefined}
          />
          <StatCell
            label="Swell Dir"
            value={compassDir(data.mwd)}
            sub={data.mwd ? `${data.mwd.toFixed(0)}°` : undefined}
          />
          <StatCell
            label="Wind"
            value={msToKnots(data.wspd)}
            sub={data.wdir ? `from ${compassDir(data.wdir)}` : undefined}
          />
          <StatCell
            label="Water Temp"
            value={celsiusToF(data.wtmp)}
            sub={data.wtmp ? `${data.wtmp.toFixed(1)}°C` : undefined}
          />
          <StatCell
            label="Air Temp"
            value={celsiusToF(data.atmp)}
          />
        </div>
      )}
    </div>
  )
}
