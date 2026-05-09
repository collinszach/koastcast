'use client'

import 'leaflet/dist/leaflet.css'
import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Bookmark } from 'lucide-react'
import type { Resort } from '@/types/snow'
import { getSnowConditionLabel, metersToFeet, cmToInches } from '@/types/snow'
import { useSavedSpots } from '@/lib/useSavedSpots'

// ─── Types ─────────────────────────────────────────────────────────────────────

type PassFilter = 'all' | 'epic' | 'ikon'
export type SnowMapStyle = 'dark' | 'satellite' | 'topo'

// ─── Condition config ──────────────────────────────────────────────────────────

const SC = {
  epic_powder:  { label: 'POWDER',       accent: '#a78bfa', bg: 'rgba(167,139,250,0.1)'  },
  fresh_tracks: { label: 'FRESH TRACKS', accent: '#06b6d4', bg: 'rgba(6,182,212,0.1)'    },
  good_snow:    { label: 'GOOD SNOW',    accent: '#3b82f6', bg: 'rgba(59,130,246,0.1)'   },
  packed:       { label: 'PACKED',       accent: '#94a3b8', bg: 'rgba(148,163,184,0.08)' },
  icy:          { label: 'ICY',          accent: '#475569', bg: 'rgba(71,85,105,0.06)'   },
  no_data:      { label: 'NO DATA',      accent: '#334155', bg: 'rgba(51,65,85,0.06)'    },
} as const

function condMeta(powder_score?: number | null) {
  return SC[getSnowConditionLabel(powder_score)]
}

// ─── Mock snow helper ──────────────────────────────────────────────────────────

function mockSnow(name: string) {
  const h = name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)
  const abs = Math.abs(h)
  const newSnow = abs % 20
  const base = 40 + (abs % 80)
  const conds = ['Powder', 'Packed', 'Groomed', 'Icy']
  const condition = conds[abs % 4]
  return { newSnow, base, condition }
}

// ─── Tile configs ──────────────────────────────────────────────────────────────

function getSnowTileConfigs(style: SnowMapStyle): Array<{ url: string; options: Record<string, unknown> }> {
  if (style === 'satellite') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 20, attribution: '© Esri, Maxar' } },
  ]
  if (style === 'topo') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 18, attribution: '© Esri, HERE, DeLorme' } },
  ]
  return [
    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', options: { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 19, attribution: '© OpenStreetMap © CARTO' } },
  ]
}

// ─── Global CSS injected once ──────────────────────────────────────────────────

const KEYFRAMES = `
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes snow-blink { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
  @keyframes det-shimmer { 0%,100% { opacity:0.4; } 50% { opacity:0.8; } }

  .leaflet-control-zoom,
  .leaflet-control-attribution { display: none !important; }
  .leaflet-container { background: #030810 !important; }
  .leaflet-div-icon { background: transparent !important; border: none !important; }

  /* Simple dot markers */
  .snow-marker {
    width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.25);
    cursor: pointer;
    transition: transform 0.15s, box-shadow 0.15s;
    box-sizing: border-box;
  }
  .snow-marker:hover {
    transform: scale(1.4);
    border-color: rgba(255,255,255,0.6);
  }
  .snow-marker.selected {
    width: 16px; height: 16px;
    border: 2.5px solid white;
    box-shadow: 0 0 0 3px rgba(255,255,255,0.15);
    transform: scale(1);
  }

  /* Tooltip on hover */
  .snow-marker-wrap { position: relative; display: inline-flex; align-items: center; justify-content: center; }
  .snow-marker-tip {
    position: absolute; bottom: calc(100% + 7px); left: 50%;
    transform: translateX(-50%);
    background: rgba(4,8,16,0.97); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 5px 9px;
    white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 0.15s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6);
    z-index: 10;
  }
  .snow-marker-tip-name {
    font-family: monospace; font-size: 11px; font-weight: 700;
    color: #e2e8f0; display: block; letter-spacing: 0.01em;
  }
  .snow-marker-tip-cond {
    font-family: monospace; font-size: 9px;
    color: rgba(255,255,255,0.4); display: block;
    letter-spacing: 0.08em; margin-top: 2px;
  }
  .snow-marker-wrap:hover .snow-marker-tip { opacity: 1; }

  /* Scrollbar */
  .snow-scroll::-webkit-scrollbar { width: 3px; }
  .snow-scroll::-webkit-scrollbar-track { background: transparent; }
  .snow-scroll::-webkit-scrollbar-thumb { background: rgba(6,182,212,0.2); border-radius: 2px; }
  .snow-scroll::-webkit-scrollbar-thumb:hover { background: rgba(6,182,212,0.4); }
`

// ─── Snow Map (Leaflet) ────────────────────────────────────────────────────────

function SnowMap({
  resorts,
  filteredSlugs,
  selectedSlug,
  onResortSelect,
  mapStyle,
  onMapReady,
}: {
  resorts: Resort[]
  filteredSlugs: Set<string>
  selectedSlug: string | null
  onResortSelect: (slug: string | null) => void
  mapStyle: SnowMapStyle
  onMapReady?: (map: unknown) => void
}) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<import('leaflet').Map | null>(null)
  const markersRef    = useRef<Array<{ dot: HTMLElement; wrap: HTMLElement; slug: string; marker: import('leaflet').Marker }>>([])
  const tileLayersRef = useRef<import('leaflet').TileLayer[]>([])
  const onSelectRef   = useRef(onResortSelect)
  onSelectRef.current = onResortSelect

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('ss-snow-map-css')) return
    const el = document.createElement('style')
    el.id = 'ss-snow-map-css'
    el.textContent = KEYFRAMES
    document.head.appendChild(el)
  }, [])

  // Build map + markers
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    let cancelled = false

    import('leaflet').then(({ default: L }) => {
      if (cancelled) return
      if (!containerRef.current) return
      if ((containerRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return

      const map = L.map(containerRef.current, {
        center: [43, -110],
        zoom: 4.5,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      })
      mapRef.current = map
      onMapReady?.(map)

      tileLayersRef.current = getSnowTileConfigs(mapStyle).map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )

      resorts.forEach(resort => {
        const ps        = resort.current_conditions?.powder_score
        const condLabel = getSnowConditionLabel(ps)
        const meta      = SC[condLabel]
        const newSnow   = resort.current_conditions?.new_snow_24h_in
        const baseDepth = resort.current_conditions?.base_depth_in

        // Wrapper (for tooltip)
        const wrap = document.createElement('div')
        wrap.className = 'snow-marker-wrap'

        // Tooltip
        const tip = document.createElement('div')
        tip.className = 'snow-marker-tip'
        const tipName = document.createElement('span')
        tipName.className = 'snow-marker-tip-name'
        tipName.textContent = resort.name
        const tipCond = document.createElement('span')
        tipCond.className = 'snow-marker-tip-cond'
        const newSnowStr  = newSnow  != null ? ` · ${newSnow}"` : ''
        const baseStr     = baseDepth != null ? ` · ${baseDepth}" base` : ''
        tipCond.textContent = `${meta.label}${newSnowStr}${baseStr}`
        tip.appendChild(tipName)
        tip.appendChild(tipCond)

        // Dot
        const dot = document.createElement('div')
        dot.className = 'snow-marker'
        dot.setAttribute('data-slug', resort.slug)
        dot.style.background = meta.accent

        wrap.appendChild(tip)
        wrap.appendChild(dot)

        const icon = L.divIcon({ html: wrap, className: '', iconSize: [16, 16], iconAnchor: [8, 8] })
        const marker = L.marker([resort.lat, resort.lng], { icon }).addTo(map)
        marker.on('click', () => onSelectRef.current(resort.slug))

        markersRef.current.push({ dot, wrap, slug: resort.slug, marker })
      })

      let lastDragEnd = 0
      map.on('dragend', () => { lastDragEnd = Date.now() })
      map.on('click', () => {
        if (Date.now() - lastDragEnd > 200) onSelectRef.current(null)
      })
    })

    return () => {
      cancelled = true
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
      tileLayersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resorts])

  // Sync visibility
  useEffect(() => {
    markersRef.current.forEach(({ wrap, slug }) => {
      wrap.style.display = filteredSlugs.has(slug) ? '' : 'none'
    })
  }, [filteredSlugs])

  // Sync selected
  useEffect(() => {
    markersRef.current.forEach(({ dot, slug }) => {
      dot.classList.toggle('selected', slug === selectedSlug)
    })
    if (selectedSlug && mapRef.current) {
      const resort = resorts.find(r => r.slug === selectedSlug)
      if (resort) {
        mapRef.current.flyTo([resort.lat, resort.lng], Math.max(mapRef.current.getZoom(), 8), { duration: 0.6 })
      }
    }
  }, [selectedSlug, resorts])

  // Swap tile style
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(({ default: L }) => {
      const map = mapRef.current
      if (!map) return
      tileLayersRef.current.forEach(l => map.removeLayer(l))
      tileLayersRef.current = getSnowTileConfigs(mapStyle).map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )
    })
  }, [mapStyle])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ─── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({ resort, onBack }: { resort: Resort; onBack: () => void }) {
  const cc         = resort.current_conditions
  const m          = condMeta(cc?.powder_score)
  const summitFt   = metersToFeet(resort.summit_elevation_m)
  const baseFt     = metersToFeet(resort.base_elevation_m)
  const vertFt     = metersToFeet(resort.vertical_m)
  const avgSnowIn  = cmToInches(resort.annual_snowfall_cm)
  const passColor  = resort.pass === 'epic' ? '#3b82f6' : resort.pass === 'ikon' ? '#fb923c' : '#94a3b8'
  const passLabel  = resort.pass === 'epic' ? 'EPIC' : resort.pass === 'ikon' ? 'IKON' : 'INDEP'

  const mock       = mockSnow(resort.name)
  const newSnow    = cc?.new_snow_24h_in ?? mock.newSnow
  const baseDepth  = cc?.base_depth_in   ?? mock.base

  const { isSaved, toggle } = useSavedSpots()
  const saved = isSaved('resorts', resort.slug)
  const bookmarkBtnRef = useRef<HTMLButtonElement>(null)

  function handleBookmark() {
    toggle('resorts', resort.slug)
    const el = bookmarkBtnRef.current
    if (!el) return
    el.style.transform = 'scale(0.8)'
    el.style.transition = 'transform 0.15s ease'
    setTimeout(() => { el.style.transform = 'scale(1.1)' }, 0)
    setTimeout(() => { el.style.transform = 'scale(1.0)' }, 150)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: `1px solid ${m.accent}20`,
        background: `linear-gradient(to bottom, ${m.accent}08, transparent)`,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)',
          letterSpacing: '0.1em', textTransform: 'uppercase',
        }}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M6.5 1.5L2.5 5l4 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Resorts
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 5 }}>
              {resort.region} · {resort.state}
            </p>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
              color: '#f0f6ff', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0,
            }}>{resort.name}</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
              color: passColor, background: `${passColor}18`, border: `1px solid ${passColor}30`,
              padding: '4px 9px', borderRadius: 20,
            }}>{passLabel}</span>
            <button
              ref={bookmarkBtnRef}
              onClick={handleBookmark}
              style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${saved ? 'rgba(167,139,250,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: saved ? '#a78bfa' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              aria-label={saved ? 'Remove from saved' : 'Save resort'}
            >
              <Bookmark size={13} style={{ fill: saved ? '#a78bfa' : 'none', stroke: 'currentColor', transition: 'fill 0.15s' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="snow-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Hero: base depth */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 64, fontWeight: 900, lineHeight: 1,
            letterSpacing: '-0.04em', color: m.accent,
          }}>
            {baseDepth ?? '—'}
          </span>
          <div>
            <p style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.06em', marginBottom: 2 }}>INCHES BASE</p>
            <p style={{ fontFamily: 'monospace', fontSize: 11, color: m.accent, letterSpacing: '0.04em' }}>{m.label}</p>
          </div>
        </div>

        {/* Stats grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {[
            { label: 'New Snow', val: newSnow  != null ? `${newSnow}"` : null },
            { label: 'Condition', val: m.label },
            { label: 'Vertical', val: vertFt   != null ? `${vertFt.toLocaleString()}ft` : null },
          ].map(({ label, val }) => (
            <div key={label} style={{
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              borderRadius: 10, padding: '10px 10px 8px',
            }}>
              <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</p>
              <p style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: val ? '#e2e8f0' : 'rgba(255,255,255,0.12)', letterSpacing: '-0.01em' }}>
                {val ?? '—'}
              </p>
            </div>
          ))}
        </div>

        {/* Elevation row */}
        <div style={{ background: 'rgba(167,139,250,0.04)', border: '1px solid rgba(167,139,250,0.1)', borderRadius: 10, padding: '10px 12px' }}>
          <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(167,139,250,0.5)', letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 8 }}>Elevation</p>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { label: 'Summit', val: summitFt != null ? `${summitFt.toLocaleString()}ft` : '—' },
              { label: 'Base',   val: baseFt   != null ? `${baseFt.toLocaleString()}ft`   : '—' },
              { label: 'Vert',   val: vertFt   != null ? `${vertFt.toLocaleString()}ft`   : '—' },
            ].map(({ label, val }) => (
              <div key={label}>
                <p style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>{label}</p>
                <p style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: 'rgba(167,139,250,0.8)' }}>{val}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Resort metadata pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {resort.trails != null && (
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              padding: '4px 10px', borderRadius: 20,
            }}>▦ {resort.trails} trails</span>
          )}
          {resort.lifts != null && (
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.09)',
              padding: '4px 10px', borderRadius: 20,
            }}>↑ {resort.lifts} lifts</span>
          )}
          {avgSnowIn != null && (
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)',
              background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
              padding: '4px 10px', borderRadius: 20,
            }}>{avgSnowIn}" avg/yr</span>
          )}
        </div>

        {resort.description && (
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 11, color: 'rgba(255,255,255,0.3)',
            lineHeight: 1.7, borderLeft: `2px solid ${m.accent}30`, paddingLeft: 10, margin: 0,
          }}>{resort.description}</p>
        )}

        {resort.nearest_snotel_id && (
          <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.06em' }}>
            SNOTEL #{resort.nearest_snotel_id}
          </p>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '14px 16px 16px', flexShrink: 0, borderTop: `1px solid ${m.accent}15` }}>
        <Link href={`/snow/${resort.slug}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          width: '100%', padding: '14px 0', borderRadius: 12, textDecoration: 'none',
          background: `linear-gradient(135deg, ${m.accent}ee 0%, ${m.accent}99 100%)`,
          color: '#fff',
          fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: '0.01em',
          boxShadow: `0 4px 24px ${m.accent}50`,
          border: `1px solid ${m.accent}40`,
        }}>
          Full Resort Forecast
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M8 3L12 7l-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>
    </div>
  )
}

// ─── Resort Row ────────────────────────────────────────────────────────────────

function ResortRow({ resort, selected, onClick, distKm }: {
  resort: Resort
  selected: boolean
  onClick: () => void
  distKm?: number
}) {
  const cc        = resort.current_conditions
  const m         = condMeta(cc?.powder_score)
  const mock      = mockSnow(resort.name)
  const newSnow   = cc?.new_snow_24h_in ?? mock.newSnow
  const rawCond   = cc != null ? m.label : mock.condition
  const accentColor =
    rawCond === 'Powder'  || rawCond === 'POWDER'       ? '#a78bfa' :
    rawCond === 'Packed'  || rawCond === 'PACKED'       ? '#94a3b8' :
    rawCond === 'Groomed' || rawCond === 'FRESH TRACKS' ? '#06b6d4' :
    rawCond === 'GOOD SNOW'                              ? '#3b82f6' :
    '#475569'

  return (
    <button onClick={onClick} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 12, padding: '11px 12px',
          borderRadius: 10, position: 'relative', overflow: 'hidden',
          background: selected ? 'rgba(6,182,212,0.08)' : 'rgba(255,255,255,0.02)',
          border: `1px solid ${selected ? 'rgba(6,182,212,0.3)' : 'rgba(255,255,255,0.05)'}`,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!selected) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'
          }
        }}
        onMouseLeave={e => {
          if (!selected) {
            (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.05)'
          }
        }}
      >
        {/* Left accent bar */}
        <div style={{
          position: 'absolute', left: 0, top: 4, bottom: 4, width: 3,
          borderRadius: 2, background: accentColor,
        }} />

        {/* New snow badge */}
        <div style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: `${accentColor}10`,
          border: `1px solid ${accentColor}25`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 900, color: newSnow >= 6 ? '#22d3ee' : accentColor, lineHeight: 1, letterSpacing: '-0.02em' }}>{newSnow}</span>
          <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>in</span>
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <p style={{
            fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
            color: selected ? '#06b6d4' : '#dde4ee', lineHeight: 1.2,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            transition: 'color 0.15s', marginBottom: 3,
          }}>{resort.name}</p>
          <p style={{ fontFamily: 'monospace', fontSize: 8.5, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.04em' }}>
            {resort.region} · {resort.state}
            {distKm != null && (
              <span style={{ color: 'rgba(59,130,246,0.7)', marginLeft: 5 }}>
                · {distKm < 100 ? distKm.toFixed(0) : Math.round(distKm)}km
              </span>
            )}
          </p>
        </div>

        {/* Right: condition label + chevron */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontFamily: 'monospace', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em',
            color: accentColor, background: `${accentColor}10`, border: `1px solid ${accentColor}25`,
            padding: '2px 6px', borderRadius: 20, whiteSpace: 'nowrap',
          }}>
            {rawCond}
          </span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ opacity: selected ? 0.6 : 0.2, color: selected ? '#06b6d4' : 'white' }}>
            <path d="M3.5 2L7 5 3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </button>
  )
}

// ─── Resort List ───────────────────────────────────────────────────────────────

function ResortList({
  resorts,
  filtered,
  selected,
  passFilter,
  regionFilter,
  regions,
  searchQuery,
  userLocation,
  onSelect,
  onPassFilterChange,
  onRegionFilterChange,
  onSearchChange,
}: {
  resorts: Resort[]
  filtered: Resort[]
  selected: Resort | null
  passFilter: PassFilter
  regionFilter: string
  regions: string[]
  searchQuery: string
  userLocation: { lat: number; lng: number } | null
  onSelect: (slug: string) => void
  onPassFilterChange: (f: PassFilter) => void
  onRegionFilterChange: (r: string) => void
  onSearchChange: (s: string) => void
}) {
  return (
    <>
      {/* Panel header */}
      <div style={{ padding: '14px 14px 10px', flexShrink: 0 }}>

        {/* Status banner */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10,
          background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.12)',
          borderRadius: 8, padding: '7px 10px',
        }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0, background: '#a78bfa', boxShadow: '0 0 5px #a78bfa', animation: 'snow-blink 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 9, fontWeight: 700, color: '#a78bfa', letterSpacing: '0.06em' }}>Snow</span>
          <span style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.03em' }}>· {resorts.length} resorts</span>
        </div>

        {/* Pass filter pills */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
          {([
            { key: 'all'  as PassFilter, label: 'All'  },
            { key: 'epic' as PassFilter, label: 'Epic' },
            { key: 'ikon' as PassFilter, label: 'Ikon' },
          ]).map(({ key, label }) => {
            const active = passFilter === key
            const accent =
              key === 'epic' ? '#60A5FA' :
              key === 'ikon' ? '#FB923C' : 'white'
            const bg =
              key === 'epic' && active ? 'rgba(59,130,246,0.15)' :
              key === 'ikon' && active ? 'rgba(249,115,22,0.15)' :
              active                   ? 'rgba(255,255,255,0.12)' :
              'rgba(255,255,255,0.06)'
            return (
              <button key={key} onClick={() => onPassFilterChange(key)} style={{
                fontFamily: 'monospace', fontSize: 11, fontWeight: 600, padding: '4px 12px',
                borderRadius: 20, cursor: 'pointer', letterSpacing: '0.04em',
                border: `1px solid ${active ? `${accent}40` : 'rgba(255,255,255,0.07)'}`,
                background: bg,
                color: active ? accent : 'rgba(255,255,255,0.4)',
                transition: 'all 0.12s',
              }}>{label}</button>
            )
          })}
        </div>

        {/* Region chips — horizontally scrollable */}
        <div style={{
          display: 'flex', gap: 4, overflowX: 'auto', marginBottom: 8,
          scrollbarWidth: 'none', paddingBottom: 2,
        }}>
          <button onClick={() => onRegionFilterChange('all')} style={{
            fontFamily: 'monospace', fontSize: 9, fontWeight: 600, padding: '3px 10px',
            borderRadius: 20, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
            border: `1px solid ${regionFilter === 'all' ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
            background: regionFilter === 'all' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
            color: regionFilter === 'all' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
            transition: 'all 0.12s', flexShrink: 0,
          }}>All</button>
          {regions.map(region => (
            <button key={region} onClick={() => onRegionFilterChange(region)} style={{
              fontFamily: 'monospace', fontSize: 9, fontWeight: 600, padding: '3px 10px',
              borderRadius: 20, cursor: 'pointer', letterSpacing: '0.04em', whiteSpace: 'nowrap',
              border: `1px solid ${regionFilter === region ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
              background: regionFilter === region ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)',
              color: regionFilter === region ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)',
              transition: 'all 0.12s', flexShrink: 0,
            }}>{region}</button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.25 }}>
            <circle cx="5" cy="5" r="3.5" stroke="white" strokeWidth="1.4"/>
            <path d="M8 8l2.5 2.5" stroke="white" strokeWidth="1.4" strokeLinecap="round"/>
          </svg>
          <input
            value={searchQuery} onChange={e => onSearchChange(e.target.value)}
            placeholder="Search resorts..."
            style={{
              width: '100%', padding: '10px 10px 10px 30px', boxSizing: 'border-box',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, color: '#dde4ee', outline: 'none',
              fontFamily: 'monospace', fontSize: 13, letterSpacing: '0.02em',
            }}
          />
        </div>

        {/* Resort count */}
        <p style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', marginTop: 6 }}>
          {filtered.length}{filtered.length !== resorts.length ? `/${resorts.length}` : ''} resorts
        </p>
      </div>

      <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

      {/* List */}
      <div className="snow-scroll" style={{ flex: 1, overflowY: 'auto', minHeight: 0, overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch', padding: '8px 10px', scrollbarWidth: 'thin', scrollbarColor: 'rgba(6,182,212,0.2) transparent' }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 16px' }}>
            <p style={{ fontSize: 24, marginBottom: 8, opacity: 0.3 }}>⛷</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'rgba(255,255,255,0.25)', marginBottom: 12 }}>No resorts match</p>
            <button onClick={() => { onPassFilterChange('all'); onRegionFilterChange('all'); onSearchChange('') }} style={{
              fontFamily: 'monospace', fontSize: 9, color: '#a78bfa', background: 'none', border: 'none',
              cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Clear filters</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {filtered.map(r => {
              const distKm = userLocation ? distanceKm(userLocation.lat, userLocation.lng, r.lat, r.lng) : undefined
              return (
                <ResortRow
                  key={r.slug} resort={r}
                  selected={selected?.slug === r.slug}
                  onClick={() => onSelect(r.slug)}
                  distKm={distKm}
                />
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

// ─── Haversine distance ────────────────────────────────────────────────────────

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Sidebar width ─────────────────────────────────────────────────────────────

const SIDEBAR_W = 360

// ─── Main Export ───────────────────────────────────────────────────────────────

export default function SnowMapClient({ resorts }: { resorts: Resort[] }) {
  const [passFilter,    setPassFilter]    = useState<PassFilter>('all')
  const [regionFilter,  setRegionFilter]  = useState<string>('all')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [selected,      setSelected]      = useState<Resort | null>(null)
  const [sidebarOpen,   setSidebarOpen]   = useState(true)
  const [mapStyle,      setMapStyle]      = useState<SnowMapStyle>('dark')
  const [locating,      setLocating]      = useState(false)
  const [locError,      setLocError]      = useState<string | null>(null)
  const [userLocation,  setUserLocation]  = useState<{ lat: number; lng: number } | null>(null)
  const snowMapRef    = useRef<import('leaflet').Map | null>(null)
  const userMarkerRef = useRef<import('leaflet').Marker | null>(null)

  // Restore location from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('koastcast_user_location')
      if (stored) {
        const parsed = JSON.parse(stored) as { lat: number; lng: number }
        if (parsed.lat && parsed.lng) setUserLocation(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // User location marker
  useEffect(() => {
    if (!snowMapRef.current || !userLocation) return
    import('leaflet').then(({ default: L }) => {
      if (!snowMapRef.current) return
      if (userMarkerRef.current) { userMarkerRef.current.remove(); userMarkerRef.current = null }
      const el = document.createElement('div')
      el.style.cssText = `
        width: 18px; height: 18px; border-radius: 50%;
        background: #3B82F6; border: 3px solid white;
        box-shadow: 0 0 0 4px rgba(59,130,246,0.3), 0 0 20px rgba(59,130,246,0.5);
        cursor: default;
      `
      const icon = L.divIcon({ html: el, className: '', iconSize: [18, 18], iconAnchor: [9, 9] })
      userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], { icon })
        .bindPopup('You are here')
        .addTo(snowMapRef.current)
    })
  }, [userLocation])

  const regions = useMemo(() => {
    return Array.from(new Set(resorts.map(r => r.region))).sort()
  }, [resorts])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    const base = resorts.filter(r => {
      if (passFilter !== 'all' && r.pass !== passFilter) return false
      if (regionFilter !== 'all' && r.region !== regionFilter) return false
      if (q) {
        const passLabel = r.pass === 'epic' ? 'epic pass' : r.pass === 'ikon' ? 'ikon pass' : 'independent'
        const haystack = [r.name, r.state, r.region, passLabel, r.description ?? ''].join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }
      return true
    })
    if (userLocation) {
      return [...base].sort((a, b) =>
        distanceKm(userLocation.lat, userLocation.lng, a.lat, a.lng) -
        distanceKm(userLocation.lat, userLocation.lng, b.lat, b.lng)
      )
    }
    return base
  }, [resorts, passFilter, regionFilter, searchQuery, userLocation])

  const filteredSlugs = useMemo(() => new Set(filtered.map(r => r.slug)), [filtered])

  const handleSelect = useCallback((slug: string | null) => {
    const r = slug ? (resorts.find(x => x.slug === slug) ?? null) : null
    setSelected(r)
  }, [resorts])

  const handleDetailClose = useCallback(() => { setSelected(null) }, [])

  function handleLocate() {
    if (!navigator.geolocation) { setLocError('Geolocation not supported'); setTimeout(() => setLocError(null), 3000); return }
    setLocating(true); setLocError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords
        setLocating(false)
        setUserLocation({ lat: latitude, lng: longitude })
        try { localStorage.setItem('koastcast_user_location', JSON.stringify({ lat: latitude, lng: longitude })) } catch { /* ignore */ }
        snowMapRef.current?.flyTo([latitude, longitude], 8, { duration: 1.5 })
      },
      () => { setLocating(false); setLocError('Location access denied'); setTimeout(() => setLocError(null), 3000) },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  const powderCount = resorts.filter(r => {
    const c = getSnowConditionLabel(r.current_conditions?.powder_score)
    return c === 'epic_powder' || c === 'fresh_tracks'
  }).length

  const mapStyles: { key: SnowMapStyle; icon: string }[] = [
    { key: 'dark',      icon: '🌑' },
    { key: 'topo',      icon: '🗻' },
    { key: 'satellite', icon: '🛰️' },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', display: 'flex' }}>

      {/* Map */}
      <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <SnowMap
          resorts={resorts}
          filteredSlugs={filteredSlugs}
          selectedSlug={selected?.slug ?? null}
          onResortSelect={handleSelect}
          mapStyle={mapStyle}
          onMapReady={map => { snowMapRef.current = map as import('leaflet').Map }}
        />

        {/* Bottom-left: map style + legend */}
        <div style={{ position: 'absolute', bottom: 14, left: 14, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Style pills */}
          <div style={{ display: 'flex', gap: 3 }}>
            {mapStyles.map(s => (
              <button key={s.key} onClick={() => setMapStyle(s.key)} style={{
                fontFamily: 'monospace', fontSize: 12, padding: '5px 9px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${mapStyle === s.key ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.07)'}`,
                background: mapStyle === s.key ? 'rgba(167,139,250,0.12)' : 'rgba(6,10,22,0.85)',
                color: mapStyle === s.key ? '#a78bfa' : 'rgba(255,255,255,0.35)',
                backdropFilter: 'blur(12px)', transition: 'all 0.12s',
              }}>{s.icon}</button>
            ))}
          </div>
          {/* Condition legend */}
          <div style={{ background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(['epic_powder','fresh_tracks','good_snow','packed','icy'] as const).map(k => (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: SC[k].accent, flexShrink: 0 }} />
                <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.04em' }}>{SC[k].label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Top-left: Near Me */}
        <div style={{ position: 'absolute', top: 14, left: 14, zIndex: 20, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <button onClick={handleLocate} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: userLocation ? 'rgba(59,130,246,0.15)' : 'rgba(6,13,26,0.92)',
            border: `1px solid ${userLocation ? 'rgba(59,130,246,0.5)' : 'rgba(59,130,246,0.4)'}`,
            borderRadius: 6, padding: '6px 12px', cursor: 'pointer',
            color: '#93C5FD', fontFamily: 'var(--font-data)', fontSize: 11,
            backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}>
            {locating ? (
              <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(59,130,246,0.3)', borderTopColor: '#93C5FD', animation: 'spin 0.7s linear infinite' }} />
            ) : (
              <span style={{ fontSize: 12 }}>📍</span>
            )}
            {locating ? 'Locating...' : 'Near Me'}
          </button>
          {locError && (
            <div style={{
              background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8, padding: '5px 10px',
              fontFamily: 'monospace', fontSize: 9, color: '#ef4444',
              letterSpacing: '0.04em', whiteSpace: 'nowrap',
            }}>{locError}</div>
          )}
        </div>

        {/* Sidebar collapse toggle */}
        <button
          onClick={() => setSidebarOpen(v => !v)}
          style={{
            position: 'absolute', top: '50%', right: 0, transform: 'translateY(-50%)',
            zIndex: 20, width: 20, height: 48,
            background: 'rgba(4,8,18,0.92)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.08)', borderRight: 'none',
            borderRadius: '8px 0 0 8px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'rgba(255,255,255,0.3)', transition: 'color 0.15s, background 0.15s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = '#a78bfa'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(167,139,250,0.1)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'
            ;(e.currentTarget as HTMLElement).style.background = 'rgba(4,8,18,0.92)'
          }}
          aria-label={sidebarOpen ? 'Collapse sidebar' : 'Open resorts list'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transition: 'transform 0.25s', transform: sidebarOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
            <path d="M3.5 2L7 5 3.5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Right sidebar */}
      <div style={{
        width: sidebarOpen ? SIDEBAR_W : 0,
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'width 0.3s cubic-bezier(0.34,1.05,0.64,1)',
      }}>
        <div style={{
          width: SIDEBAR_W,
          height: '100%',
          background: 'rgba(4,8,18,0.97)',
          borderLeft: '1px solid rgba(255,255,255,0.07)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {selected ? (
            <DetailPanel resort={selected} onBack={handleDetailClose} />
          ) : (
            <ResortList
              resorts={resorts}
              filtered={filtered}
              selected={selected}
              passFilter={passFilter}
              regionFilter={regionFilter}
              regions={regions}
              searchQuery={searchQuery}
              userLocation={userLocation}
              onSelect={slug => handleSelect(slug)}
              onPassFilterChange={setPassFilter}
              onRegionFilterChange={setRegionFilter}
              onSearchChange={setSearchQuery}
            />
          )}
        </div>
      </div>

      {/* Floating badge when sidebar collapsed */}
      {!sidebarOpen && (
        <div style={{
          position: 'absolute', top: 14, right: 14, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'rgba(4,8,18,0.9)', backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10,
          padding: '8px 14px', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          pointerEvents: 'none',
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', boxShadow: '0 0 6px #a78bfa', flexShrink: 0, animation: 'snow-blink 2s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'monospace', fontSize: 10, fontWeight: 700, color: '#c8d8e8', letterSpacing: '0.02em' }}>
            {filtered.length}<span style={{ color: 'rgba(255,255,255,0.28)', fontWeight: 400 }}>{filtered.length !== resorts.length ? `/${resorts.length}` : ''} resorts</span>
          </span>
          {powderCount > 0 && (
            <span style={{ fontFamily: 'monospace', fontSize: 8, fontWeight: 700, color: '#a78bfa', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.25)', padding: '2px 6px', borderRadius: 8 }}>
              ❄{powderCount}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
