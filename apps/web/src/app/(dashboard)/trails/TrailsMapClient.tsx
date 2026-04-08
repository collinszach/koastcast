'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { TreePine, LocateFixed, Bookmark } from 'lucide-react'
import type { Trail } from '@/types/trails'
import {
  getTrailConditionLabel,
  DIFFICULTY_COLORS,
  DIFFICULTY_LABELS,
  TRAIL_TYPE_LABELS,
} from '@/types/trails'
import { useSavedSpots } from '@/lib/useSavedSpots'

// ─── Types ────────────────────────────────────────────────────────────────────

type DifficultyFilter = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'
type TypeFilter       = 'all' | 'day_hike' | 'backpacking' | 'thru_hike'
export type TrailMapStyle = 'dark' | 'satellite' | 'topo'

// ─── Condition config ─────────────────────────────────────────────────────────

const TC = {
  prime:   { label: 'PRIME',   accent: '#10B981', glow: 'rgba(16,185,129,0.5)',  bg: 'rgba(16,185,129,0.1)'  },
  good:    { label: 'GOOD',    accent: '#3B82F6', glow: 'rgba(59,130,246,0.4)',  bg: 'rgba(59,130,246,0.1)'  },
  fair:    { label: 'FAIR',    accent: '#F59E0B', glow: 'rgba(245,158,11,0.4)',  bg: 'rgba(245,158,11,0.1)'  },
  caution: { label: 'CAUTION', accent: '#F97316', glow: 'rgba(249,115,22,0.4)',  bg: 'rgba(249,115,22,0.1)'  },
  closed:  { label: 'CLOSED',  accent: '#EF4444', glow: 'rgba(239,68,68,0.4)',   bg: 'rgba(239,68,68,0.08)'  },
  no_data: { label: 'NO DATA', accent: '#475569', glow: 'transparent',           bg: 'rgba(71,85,105,0.06)'  },
} as const

function condMeta(score?: number | null, status?: string) {
  return TC[getTrailConditionLabel(score, status)]
}

// ─── Map tile styles ──────────────────────────────────────────────────────────

function tileStyle(style: TrailMapStyle) {
  const sources: Record<TrailMapStyle, { tiles: string[]; attribution: string }> = {
    dark: {
      tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'],
      attribution: '© OpenStreetMap © CARTO',
    },
    satellite: {
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      attribution: '© Esri, Maxar',
    },
    topo: {
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'],
      attribution: '© Esri',
    },
  }
  const s = sources[style]
  return {
    version: 8 as const,
    sources: { tiles: { type: 'raster' as const, tiles: s.tiles, tileSize: 256, attribution: s.attribution } },
    layers: [{ id: 'tiles', type: 'raster' as const, source: 'tiles' }],
  }
}

// ─── Injected CSS ─────────────────────────────────────────────────────────────

const MAP_CSS = `
  .leaflet-control-zoom,
  .leaflet-control-attribution { display: none !important; }
  .leaflet-container { background: #030810 !important; }
  .leaflet-div-icon { background: transparent !important; border: none !important; }

  @keyframes trail-pulse {
    0%,100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.55), 0 2px 8px rgba(0,0,0,0.55); }
    60%     { box-shadow: 0 0 0 7px rgba(16,185,129,0),  0 2px 8px rgba(0,0,0,0.55); }
  }
  @keyframes tmc-pulse {
    0%,100% { opacity:1; box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
    50%     { opacity:.7; box-shadow: 0 0 0 5px rgba(16,185,129,0); }
  }

  .trail-marker {
    display: flex; align-items: center; gap: 4px;
    background: rgba(6,13,26,0.92);
    border: 1.5px solid rgba(255,255,255,0.15);
    border-radius: 6px; padding: 3px 8px;
    cursor: pointer; white-space: nowrap;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 600;
    color: rgba(255,255,255,0.75);
    letter-spacing: 0.04em; text-transform: uppercase;
    transition: all 0.15s;
    box-shadow: 0 2px 8px rgba(0,0,0,0.5);
    transform-origin: bottom center;
  }
  .trail-marker:hover { transform: scale(1.3) !important; color: #fff; }
  .trail-marker.active {
    border-color: rgba(255,255,255,0.7) !important;
    color: #fff; transform: scale(1.2) !important;
    box-shadow: 0 4px 16px rgba(0,0,0,0.7);
  }
  .trail-marker.prime   { border-color: #10B981; animation: trail-pulse 2.8s ease-in-out infinite; }
  .trail-marker.good    { border-color: #3B82F6; }
  .trail-marker.fair    { border-color: #F59E0B; }
  .trail-marker.caution { border-color: #F97316; }
  .trail-marker.closed  { border-color: #EF4444; opacity: 0.7; }
  .trail-marker.no_data { border-color: rgba(255,255,255,0.1); }

  .trail-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .trail-marker.beginner     .trail-dot { background: #10B981; }
  .trail-marker.intermediate .trail-dot { background: #3B82F6; }
  .trail-marker.advanced     .trail-dot { background: #F97316; }
  .trail-marker.expert       .trail-dot { background: #EF4444; }

  .trail-marker.filtered-out { opacity: 0.1; pointer-events: none; }

  .trail-tooltip {
    position: absolute; bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
    background: rgba(4,8,16,0.97); border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px; padding: 6px 10px;
    white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 0.15s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.6); z-index: 10;
  }
  .trail-tooltip-name {
    font-family: monospace; font-size: 11px; font-weight: 700;
    color: #e2e8f0; display: block; letter-spacing: 0.01em;
  }
  .trail-tooltip-meta {
    font-family: monospace; font-size: 9px;
    color: rgba(255,255,255,0.38); display: block;
    letter-spacing: 0.06em; margin-top: 2px;
  }
  .trail-wrap { position: relative; display: flex; flex-direction: column; align-items: center; }
  .trail-wrap:hover .trail-tooltip { opacity: 1; }
`

// ─── Trail Map (Leaflet) ──────────────────────────────────────────────────────

function getTrailTileConfigs(style: TrailMapStyle): Array<{ url: string; options: Record<string, unknown> }> {
  if (style === 'satellite') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 20, attribution: '© Esri, Maxar' } },
  ]
  if (style === 'topo') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 18, attribution: '© Esri' } },
  ]
  return [
    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', options: { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 19, attribution: '© OpenStreetMap © CARTO' } },
  ]
}

function TrailMap({
  trails,
  filteredSlugs,
  selectedSlug,
  onTrailSelect,
  mapStyle,
  onMapReady,
}: {
  trails: Trail[]
  filteredSlugs: Set<string>
  selectedSlug: string | null
  onTrailSelect: (slug: string | null) => void
  mapStyle: TrailMapStyle
  onMapReady?: (map: unknown) => void
}) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const mapRef        = useRef<import('leaflet').Map | null>(null)
  const markersRef    = useRef<Array<{ el: HTMLElement; slug: string; marker: import('leaflet').Marker }>>([])
  const tileLayersRef = useRef<import('leaflet').TileLayer[]>([])
  const onSelectRef   = useRef(onTrailSelect)
  onSelectRef.current = onTrailSelect

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('tm-trail-map-css')) return
    const el = document.createElement('style')
    el.id = 'tm-trail-map-css'
    el.textContent = MAP_CSS
    document.head.appendChild(el)
  }, [])

  // Build map + markers
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('leaflet').then(({ default: L }) => {
      if (!containerRef.current) return

      const map = L.map(containerRef.current, {
        center: [39, -96],
        zoom: 4,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      })
      mapRef.current = map
      onMapReady?.(map)

      // Add tile layers
      tileLayersRef.current = getTrailTileConfigs(mapStyle).map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )

      trails.forEach(trail => {
        const cc    = trail.current_conditions
        const label = getTrailConditionLabel(cc?.conditions_score, cc?.trail_status)

        const wrap = document.createElement('div')
        wrap.className = 'trail-wrap'
        wrap.style.cssText = 'position:relative;display:inline-flex;flex-direction:column;align-items:center;'

        const tip = document.createElement('div')
        tip.className = 'trail-tooltip'
        const tipNameEl = document.createElement('span')
        tipNameEl.className = 'trail-tooltip-name'
        tipNameEl.textContent = trail.name
        const tipMetaEl = document.createElement('span')
        tipMetaEl.className = 'trail-tooltip-meta'
        tipMetaEl.textContent = `${trail.region} · ${DIFFICULTY_LABELS[trail.difficulty]}${cc ? ` · ${TC[label].label}` : ' · NO DATA'}`
        tip.appendChild(tipNameEl)
        tip.appendChild(tipMetaEl)

        const markerEl = document.createElement('div')
        markerEl.className = `trail-marker ${trail.difficulty} ${label}`
        markerEl.setAttribute('data-slug', trail.slug)

        const dot = document.createElement('span')
        dot.className = 'trail-dot'

        const nameEl = document.createElement('span')
        nameEl.className = 'trail-name'
        nameEl.style.color = 'inherit'
        nameEl.textContent = trail.name.split(' ').slice(0, 3).join(' ')

        markerEl.appendChild(dot)
        markerEl.appendChild(nameEl)
        wrap.appendChild(tip)
        wrap.appendChild(markerEl)

        const icon = L.divIcon({ html: wrap, className: '', iconSize: [100, 40], iconAnchor: [50, 40] })
        const leafletMarker = L.marker([trail.lat, trail.lng], { icon }).addTo(map)
        leafletMarker.on('click', () => onSelectRef.current(trail.slug))

        markersRef.current.push({ el: markerEl, slug: trail.slug, marker: leafletMarker })
      })

      map.on('click', () => onSelectRef.current(null))
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
      markersRef.current = []
      tileLayersRef.current = []
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trails])

  // Sync visibility
  useEffect(() => {
    markersRef.current.forEach(({ el, slug }) => {
      const wrap = el.parentElement
      if (wrap) wrap.style.display = filteredSlugs.has(slug) ? '' : 'none'
    })
  }, [filteredSlugs])

  // Sync selected state
  useEffect(() => {
    markersRef.current.forEach(({ el, slug }) => {
      el.classList.toggle('active', slug === selectedSlug)
    })
    if (selectedSlug && mapRef.current) {
      const trail = trails.find(t => t.slug === selectedSlug)
      if (trail) {
        mapRef.current.flyTo([trail.lat, trail.lng], Math.max(mapRef.current.getZoom(), 8), { duration: 0.6 })
      }
    }
  }, [selectedSlug, trails])

  // Swap tile style
  useEffect(() => {
    if (!mapRef.current) return
    import('leaflet').then(({ default: L }) => {
      const map = mapRef.current
      if (!map) return
      tileLayersRef.current.forEach(l => map.removeLayer(l))
      tileLayersRef.current = getTrailTileConfigs(mapStyle).map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )
    })
  }, [mapStyle])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

// ─── Conditions Score Ring ────────────────────────────────────────────────────

function ConditionsRing({ score, status, size = 72 }: { score: number | null; status?: string; size?: number }) {
  const label = getTrailConditionLabel(score, status)
  const m     = TC[label]
  const r     = (size / 2) - 6
  const circ  = 2 * Math.PI * r
  const filled = score != null ? Math.max(0, Math.min(1, score / 100)) * circ : 0
  const cx = size / 2, cy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
        {score != null && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={m.accent} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={`${filled} ${circ}`}
            transform={`rotate(-90 ${cx} ${cy})`}
            style={{ filter: `drop-shadow(0 0 5px ${m.glow})`, transition: 'stroke-dasharray 0.8s cubic-bezier(0.34,1.1,0.64,1)' }}
          />
        )}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {score != null ? (
          <>
            <span style={{ fontFamily: 'monospace', fontSize: size * 0.22, fontWeight: 900, color: m.accent, lineHeight: 1, letterSpacing: '-0.03em' }}>{Math.round(score)}</span>
            <span style={{ fontFamily: 'monospace', fontSize: size * 0.1, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.04em', marginTop: 1 }}>COND</span>
          </>
        ) : (
          <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.18)' }}>—</span>
        )}
      </div>
    </div>
  )
}

// ─── Conditions Icon ──────────────────────────────────────────────────────────

function conditionsEmoji(c?: string) {
  switch (c) {
    case 'clear':       return '☀️'
    case 'cloudy':      return '⛅'
    case 'rain':        return '🌧'
    case 'snow':        return '❄️'
    case 'fog':         return '🌫'
    case 'thunderstorm':return '⛈'
    default:            return '—'
  }
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function DetailPanel({ trail, onBack }: { trail: Trail; onBack: () => void }) {
  const cc    = trail.current_conditions
  const label = getTrailConditionLabel(cc?.conditions_score, cc?.trail_status)
  const m     = TC[label]
  const diffColor = DIFFICULTY_COLORS[trail.difficulty]
  const { isSaved, toggle } = useSavedSpots()
  const saved = isSaved('trails', trail.slug)
  const bookmarkBtnRef = useRef<HTMLButtonElement>(null)

  function handleBookmark() {
    toggle('trails', trail.slug)
    const el = bookmarkBtnRef.current
    if (!el) return
    el.style.transform = 'scale(0.8)'
    el.style.transition = 'transform 0.15s ease'
    setTimeout(() => { el.style.transform = 'scale(1.1)' }, 0)
    setTimeout(() => { el.style.transform = 'scale(1.0)' }, 150)
  }

  const statCell = (lbl: string, val: string) => (
    <div key={lbl} style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
      borderRadius: 10, padding: '8px 10px',
    }}>
      <div style={{ fontFamily: 'monospace', fontSize: 7.5, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>{lbl}</div>
      <div style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1 }}>{val}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header */}
      <div style={{
        padding: '14px 14px 12px',
        background: `linear-gradient(135deg, ${diffColor}12 0%, transparent 60%)`,
        borderBottom: `1px solid ${diffColor}20`,
        flexShrink: 0,
      }}>
        <button onClick={onBack} style={{
          display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10,
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 8, padding: '5px 10px 5px 8px', cursor: 'pointer',
          fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.06em',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M7.5 2L3 6l4.5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          All trails
        </button>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 4 }}>
              {trail.region} · {trail.state}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#f0f6ff', letterSpacing: '-0.02em', lineHeight: 1.1, margin: 0 }}>
              {trail.name}
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginTop: 2 }}>
            <span style={{
              fontFamily: 'monospace', fontSize: 8, fontWeight: 700,
              color: diffColor, background: `${diffColor}18`, border: `1px solid ${diffColor}35`,
              padding: '3px 8px', borderRadius: 20, letterSpacing: '0.06em', textTransform: 'uppercase',
            }}>{DIFFICULTY_LABELS[trail.difficulty]}</span>
            <button
              ref={bookmarkBtnRef}
              onClick={handleBookmark}
              style={{
                background: 'rgba(255,255,255,0.06)', border: `1px solid ${saved ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 8, padding: '5px 6px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: saved ? '#10B981' : 'rgba(255,255,255,0.3)',
                transition: 'color 0.15s, border-color 0.15s',
              }}
              aria-label={saved ? 'Remove from saved' : 'Save trail'}
            >
              <Bookmark size={13} style={{ fill: saved ? '#10B981' : 'none', stroke: 'currentColor', transition: 'fill 0.15s' }} />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Conditions hero */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ConditionsRing score={cc?.conditions_score ?? null} status={cc?.trail_status} size={72} />
          <div style={{ flex: 1 }}>
            {cc ? (
              <>
                <div style={{
                  fontFamily: 'monospace', fontSize: 40, fontWeight: 900, lineHeight: 1,
                  letterSpacing: '-0.04em', color: m.accent,
                  filter: `drop-shadow(0 0 12px ${m.glow})`,
                }}>
                  {cc.temperature_f}°
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', marginTop: 2 }}>
                  {conditionsEmoji(cc.conditions)} {cc.conditions.toUpperCase()}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 10, color: m.accent, marginTop: 4, letterSpacing: '0.04em' }}>
                  {m.label}
                  {cc.trail_status !== 'open' && (
                    <span style={{ color: TC[getTrailConditionLabel(cc.conditions_score, cc.trail_status)].accent }}>
                      {' '}· {cc.trail_status.toUpperCase()}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 900, lineHeight: 1, color: 'rgba(255,255,255,0.15)', letterSpacing: '-0.04em' }}>—</div>
                <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em', marginTop: 4 }}>NO CONDITIONS DATA</div>
              </>
            )}
          </div>
        </div>

        {/* Conditions stats */}
        {cc && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {statCell('Wind', `${cc.wind_speed_mph}mph ${cc.wind_direction}`)}
            {statCell('Snow Cover', cc.snow_coverage.toUpperCase())}
          </div>
        )}

        {/* Trail stats */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {statCell('Length', `${trail.length_miles}mi`)}
          {statCell('Elev Gain', `${trail.elevation_gain_ft.toLocaleString()}ft`)}
          {statCell('Type', TRAIL_TYPE_LABELS[trail.trail_type])}
          {statCell('Best Season', trail.best_months.slice(0, 3).join(', '))}
        </div>

        {/* Summit elevation */}
        {trail.summit_elevation_ft && (
          <div style={{
            background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 12, padding: '10px 12px', display: 'flex', justifyContent: 'space-around',
          }}>
            {[
              { lbl: 'Summit', val: `${trail.summit_elevation_ft.toLocaleString()}ft` },
              { lbl: 'Gain', val: `${trail.elevation_gain_ft.toLocaleString()}ft` },
              { lbl: 'Miles', val: `${trail.length_miles}mi` },
            ].map(({ lbl, val }) => (
              <div key={lbl} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 2 }}>{lbl}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>{val}</div>
              </div>
            ))}
          </div>
        )}

        {/* Hazards */}
        {cc && cc.hazards.length > 0 && (
          <div style={{
            background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 10, padding: '9px 12px',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 8, color: '#EF4444', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>⚠ Active Hazards</div>
            {cc.hazards.map(h => (
              <div key={h} style={{ fontFamily: 'monospace', fontSize: 9.5, color: 'rgba(255,255,255,0.45)', marginTop: 3, letterSpacing: '0.02em' }}>
                · {h}
              </div>
            ))}
          </div>
        )}

        {/* Meta flags */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {trail.permit_required && (
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: '#F59E0B',
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              padding: '3px 8px', borderRadius: 20,
            }}>PERMIT REQUIRED</span>
          )}
          {trail.dog_friendly && (
            <span style={{
              fontFamily: 'monospace', fontSize: 9, color: '#10B981',
              background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
              padding: '3px 8px', borderRadius: 20,
            }}>DOG FRIENDLY</span>
          )}
        </div>

        {/* Tags */}
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
          {trail.tags.map(tag => (
            <span key={tag} style={{
              fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.3)',
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)',
              padding: '3px 8px', borderRadius: 20,
            }}>{tag}</span>
          ))}
        </div>

        {/* Description */}
        {trail.description && (
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.35)',
            lineHeight: 1.65, margin: 0, borderLeft: `2px solid ${diffColor}35`, paddingLeft: 10,
          }}>{trail.description}</p>
        )}
      </div>

      {/* CTA */}
      <div style={{ padding: '10px 14px', flexShrink: 0, borderTop: `1px solid ${diffColor}18` }}>
        <Link href={`/trails/${trail.slug}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '11px 0', borderRadius: 10,
          background: `linear-gradient(135deg, ${diffColor}cc, ${diffColor}70)`,
          color: '#fff', fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800,
          letterSpacing: '0.01em', textDecoration: 'none',
          boxShadow: `0 4px 20px ${diffColor}40, inset 0 1px 0 rgba(255,255,255,0.15)`,
        }}>
          View Full Details
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2.5 7h9M8 3.5L11.5 7 8 10.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em', marginTop: 6 }}>
          TRAIL DETAIL PAGE COMING SOON
        </div>
      </div>
    </div>
  )
}

// ─── Trail Row ────────────────────────────────────────────────────────────────

function TrailRow({ trail, onClick }: { trail: Trail; onClick: () => void }) {
  const cc         = trail.current_conditions
  const label      = getTrailConditionLabel(cc?.conditions_score, cc?.trail_status)
  const m          = TC[label]
  const diffColor  = DIFFICULTY_COLORS[trail.difficulty]

  return (
    <button onClick={onClick} style={{ width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '9px 12px', borderRadius: 10,
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          position: 'relative', overflow: 'hidden',
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onMouseEnter={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(16,185,129,0.05)'
          el.style.borderColor = 'rgba(16,185,129,0.2)'
        }}
        onMouseLeave={e => {
          const el = e.currentTarget as HTMLElement
          el.style.background = 'rgba(255,255,255,0.025)'
          el.style.borderColor = 'rgba(255,255,255,0.06)'
        }}
      >
        {/* Left difficulty accent */}
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: `linear-gradient(180deg, ${diffColor}cc, ${diffColor}30)`, borderRadius: '10px 0 0 10px' }} />

        {/* Score badge */}
        <div style={{
          width: 38, height: 38, borderRadius: 9, flexShrink: 0,
          background: m.bg, border: `1px solid ${m.accent}25`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        }}>
          {cc ? (
            <>
              <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 900, color: m.accent, lineHeight: 1, letterSpacing: '-0.02em' }}>{cc.conditions_score}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 7, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em' }}>cond</span>
            </>
          ) : (
            <span style={{ fontSize: 14 }}>🌲</span>
          )}
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#e2e8f0', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {trail.name}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.28)', marginTop: 3, letterSpacing: '0.04em' }}>
            {trail.region} · {trail.state}
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
            <span style={{ color: diffColor }}>{DIFFICULTY_LABELS[trail.difficulty]}</span>
            <span style={{ color: 'rgba(255,255,255,0.3)' }}> · {trail.length_miles}mi</span>
            {cc && <span style={{ color: m.accent }}> · {m.label}</span>}
          </div>
        </div>

        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0, opacity: 0.25 }}>
          <path d="M4.5 2.5L8.5 6l-4 3.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  )
}

// ─── Floating Panel ───────────────────────────────────────────────────────────

function FloatingPanel({
  trails, filtered, selected,
  diffFilter, setDiffFilter,
  typeFilter, setTypeFilter,
  onSelect, onBack,
  open, onToggle,
  mapStyle, setMapStyle,
}: {
  trails: Trail[]
  filtered: Trail[]
  selected: Trail | null
  diffFilter: DifficultyFilter
  setDiffFilter: (v: DifficultyFilter) => void
  typeFilter: TypeFilter
  setTypeFilter: (v: TypeFilter) => void
  onSelect: (t: Trail) => void
  onBack: () => void
  open: boolean
  onToggle: () => void
  mapStyle: TrailMapStyle
  setMapStyle: (s: TrailMapStyle) => void
}) {
  const chip = (active: boolean, color = '#10B981') => ({
    fontFamily: 'monospace' as const, fontSize: 10, fontWeight: 600,
    padding: '3px 9px', borderRadius: 20, cursor: 'pointer' as const,
    border: `1px solid ${active ? color + '50' : 'rgba(255,255,255,0.08)'}`,
    background: active ? `${color}18` : 'rgba(255,255,255,0.03)',
    color: active ? color : 'rgba(255,255,255,0.4)',
    transition: 'all 0.13s', letterSpacing: '0.03em',
    display: 'flex' as const, alignItems: 'center' as const, gap: 4,
    flexShrink: 0 as const,
  })

  const diffOptions: { key: DifficultyFilter; label: string; color: string }[] = [
    { key: 'all',          label: 'All',    color: '#10B981' },
    { key: 'beginner',     label: 'Easy',   color: DIFFICULTY_COLORS.beginner },
    { key: 'intermediate', label: 'Mod',    color: DIFFICULTY_COLORS.intermediate },
    { key: 'advanced',     label: 'Hard',   color: DIFFICULTY_COLORS.advanced },
    { key: 'expert',       label: 'Expert', color: DIFFICULTY_COLORS.expert },
  ]

  const typeOptions: { key: TypeFilter; label: string }[] = [
    { key: 'all',         label: 'All Types'   },
    { key: 'day_hike',    label: 'Day Hike'    },
    { key: 'backpacking', label: 'Backpacking' },
    { key: 'thru_hike',   label: 'Thru Hike'  },
  ]

  const primeCount = trails.filter(t => {
    const s = t.current_conditions?.conditions_score
    return s != null && s >= 80 && t.current_conditions?.trail_status !== 'closed'
  }).length

  return (
    <>
      {/* Toggle button */}
      <button onClick={onToggle} style={{
        position: 'absolute', top: 14, right: open ? 'calc(296px + 14px + 10px)' : 14,
        zIndex: 20, display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(6,10,22,0.92)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        padding: '8px 14px', cursor: 'pointer',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        transition: 'right 0.3s cubic-bezier(0.34,1.05,0.64,1)',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', boxShadow: '0 0 6px #10B981', animation: 'tmc-pulse 2s ease-in-out infinite', flexShrink: 0 }} />
        <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 700, color: '#e2e8f0', letterSpacing: '0.04em' }}>
          {open ? 'Hide Panel' : 'Trails'}
        </span>
        {!open && primeCount > 0 && (
          <span style={{
            background: '#10B981', color: '#fff',
            fontFamily: 'monospace', fontSize: 9, fontWeight: 900,
            padding: '1px 6px', borderRadius: 20, letterSpacing: '0.04em',
          }}>{primeCount} prime</span>
        )}
      </button>

      {/* Map style switcher */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14, zIndex: 10,
        display: 'flex', gap: 4, background: 'rgba(6,10,22,0.88)',
        backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10, padding: '4px',
      }}>
        {(['dark', 'topo', 'satellite'] as TrailMapStyle[]).map(s => (
          <button key={s} onClick={() => setMapStyle(s)} style={{
            fontFamily: 'monospace', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em',
            padding: '4px 10px', borderRadius: 7, cursor: 'pointer', textTransform: 'uppercase',
            background: mapStyle === s ? 'rgba(16,185,129,0.18)' : 'transparent',
            color: mapStyle === s ? '#10B981' : 'rgba(255,255,255,0.35)',
            border: mapStyle === s ? '1px solid rgba(16,185,129,0.3)' : '1px solid transparent',
            transition: 'all 0.12s',
          }}>{s}</button>
        ))}
      </div>

      {/* Difficulty legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
        zIndex: 10, display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(6,10,22,0.88)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10, padding: '6px 12px',
      }}>
        {(Object.entries(DIFFICULTY_COLORS) as [keyof typeof DIFFICULTY_COLORS, string][]).map(([key, color]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
            <span style={{ fontFamily: 'monospace', fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{key}</span>
          </div>
        ))}
      </div>

      {/* Sliding panel */}
      <div style={{
        position: 'absolute', top: 0, right: 0, bottom: 0,
        width: 296, zIndex: 15,
        background: 'rgba(4, 8, 18, 0.97)',
        backdropFilter: 'blur(32px)',
        borderLeft: '1px solid rgba(16,185,129,0.1)',
        display: 'flex', flexDirection: 'column',
        transform: open ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.32s cubic-bezier(0.34,1.05,0.64,1)',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}>
        {selected ? (
          <DetailPanel trail={selected} onBack={onBack} />
        ) : (
          <>
            {/* Panel header */}
            <div style={{ padding: '14px 14px 10px', borderBottom: '1px solid rgba(16,185,129,0.08)', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TreePine size={14} style={{ color: '#10B981' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#f0f6ff', letterSpacing: '-0.02em' }}>
                  Trails
                </span>
                <span style={{ marginLeft: 'auto', fontFamily: 'monospace', fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.06em' }}>
                  {filtered.length} / {trails.length}
                </span>
              </div>

              {/* Difficulty filter */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8, overflowX: 'auto' }}>
                {diffOptions.map(({ key, label, color }) => (
                  <button key={key} onClick={() => setDiffFilter(key)} style={chip(diffFilter === key, color)}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Type filter */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {typeOptions.map(({ key, label }) => (
                  <button key={key} onClick={() => setTypeFilter(key)} style={chip(typeFilter === key, '#06b6d4')}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trail list */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', fontFamily: 'monospace', fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.08em' }}>
                  NO TRAILS MATCH FILTERS
                </div>
              ) : (
                filtered.map(trail => (
                  <TrailRow key={trail.slug} trail={trail} onClick={() => onSelect(trail)} />
                ))
              )}
            </div>
          </>
        )}
      </div>
    </>
  )
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export default function TrailsMapClient({ trails }: { trails: Trail[] }) {
  const [diffFilter, setDiffFilter] = useState<DifficultyFilter>('all')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [selected,   setSelected]   = useState<Trail | null>(null)
  const [panelOpen,  setPanelOpen]  = useState(true)
  const [mapStyle,   setMapStyle]   = useState<TrailMapStyle>('topo')
  const [locating,   setLocating]   = useState(false)
  const [locError,   setLocError]   = useState<string | null>(null)
  const trailMapRef = useRef<import('leaflet').Map | null>(null)

  const filtered = useMemo(() => {
    return trails.filter(t => {
      if (diffFilter !== 'all' && t.difficulty !== diffFilter) return false
      if (typeFilter !== 'all' && t.trail_type !== typeFilter) return false
      return true
    })
  }, [trails, diffFilter, typeFilter])

  const filteredSlugs = useMemo(() => new Set(filtered.map(t => t.slug)), [filtered])

  const handleSelect = useCallback((trail: Trail) => {
    setSelected(trail)
    setPanelOpen(true)
  }, [])

  const handleMapSelect = useCallback((slug: string | null) => {
    if (!slug) { setSelected(null); return }
    const t = trails.find(x => x.slug === slug)
    if (t) { setSelected(t); setPanelOpen(true) }
  }, [trails])

  const handleBack = useCallback(() => { setSelected(null) }, [])

  function handleLocate() {
    if (!navigator.geolocation) {
      setLocError('Geolocation not supported')
      setTimeout(() => setLocError(null), 3000)
      return
    }
    setLocating(true)
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false)
        trailMapRef.current?.flyTo([pos.coords.latitude, pos.coords.longitude], 8, { duration: 1.5 })
      },
      () => {
        setLocating(false)
        setLocError('Location access denied')
        setTimeout(() => setLocError(null), 3000)
      },
      { timeout: 8000 }
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <TrailMap
        trails={trails}
        filteredSlugs={filteredSlugs}
        selectedSlug={selected?.slug ?? null}
        onTrailSelect={handleMapSelect}
        mapStyle={mapStyle}
        onMapReady={map => { trailMapRef.current = map as import('leaflet').Map }}
      />

      {/* Locate button */}
      <div style={{ position: 'absolute', bottom: 54, left: 14, zIndex: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={handleLocate} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'rgba(6,13,26,0.9)', border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: 8, padding: '6px 10px', cursor: 'pointer', color: '#10B981',
          fontFamily: 'monospace', fontSize: 10, letterSpacing: '0.08em',
          backdropFilter: 'blur(20px)', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        }}>
          {locating ? (
            <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(16,185,129,0.3)', borderTopColor: '#10B981', animation: 'tmc-pulse 0.7s linear infinite' }} />
          ) : (
            <LocateFixed size={12} />
          )}
          LOCATE
        </button>
        {locError && (
          <div style={{
            background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: 8, padding: '5px 10px',
            fontFamily: 'monospace', fontSize: 9, color: '#ef4444',
            letterSpacing: '0.04em', whiteSpace: 'nowrap',
          }}>
            {locError}
          </div>
        )}
      </div>
      <FloatingPanel
        trails={trails}
        filtered={filtered}
        selected={selected}
        diffFilter={diffFilter}
        setDiffFilter={setDiffFilter}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onSelect={handleSelect}
        onBack={handleBack}
        open={panelOpen}
        onToggle={() => setPanelOpen(v => !v)}
        mapStyle={mapStyle}
        setMapStyle={setMapStyle}
      />
    </div>
  )
}
