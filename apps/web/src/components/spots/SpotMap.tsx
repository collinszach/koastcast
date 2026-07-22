'use client'

import 'leaflet/dist/leaflet.css'
import { useEffect, useRef } from 'react'
import type { Spot } from '@/types'
import { getConditionLabel } from '@/types'
import type { MapStyle } from '@/app/(dashboard)/map/MapPageClient'
import { useLocation } from '@/lib/location'

// ─── Clustering ────────────────────────────────────────────────────────────────

interface ClusterItem {
  lat: number
  lng: number
  spots: Spot[]
  isCluster: boolean
}

function clusterSpots(spots: Spot[], zoom: number): ClusterItem[] {
  if (zoom > 9) return spots.map(s => ({ lat: s.lat, lng: s.lng, spots: [s], isCluster: false }))

  const radius = zoom <= 6 ? 3 : zoom <= 8 ? 1.5 : 0.8 // degrees
  const result: ClusterItem[] = []
  const used = new Set<number>()

  for (let i = 0; i < spots.length; i++) {
    if (used.has(i)) continue
    const group = [spots[i]]
    used.add(i)
    for (let j = i + 1; j < spots.length; j++) {
      if (used.has(j)) continue
      const dlat = Math.abs(spots[j].lat - spots[i].lat)
      const dlng = Math.abs(spots[j].lng - spots[i].lng)
      if (dlat < radius && dlng < radius) {
        group.push(spots[j])
        used.add(j)
      }
    }
    const avgLat = group.reduce((s, sp) => s + sp.lat, 0) / group.length
    const avgLng = group.reduce((s, sp) => s + sp.lng, 0) / group.length
    result.push({ lat: avgLat, lng: avgLng, spots: group, isCluster: group.length > 1 })
  }
  return result
}

// Cluster marker CSS — injected once
const CLUSTER_CSS = `
.sm-cluster {
  background: var(--cyan);
  color: white;
  border: 2px solid white;
  border-radius: 50%;
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
  cursor: pointer;
}
`

// ─── Condition config ──────────────────────────────────────────────────────────
// Note: these badges render as Leaflet DivIcons floating over live map tile
// imagery (dark basemap), independent of the app's light/dark chrome — kept
// dark/high-contrast intentionally so pins stay legible against the map.

const CM = {
  firing:   { accent: '#EA580C', glow: 'rgba(234,88,12,0.6)',   pulse: 'sm-pulse-r', bg: 'rgba(6,13,26,0.92)', icon: '🔥' },
  pumping:  { accent: '#0891B2', glow: 'rgba(8,145,178,0.5)',   pulse: 'sm-pulse-o', bg: 'rgba(6,13,26,0.92)', icon: '🤙' },
  fun:      { accent: '#2563EB', glow: 'rgba(37,99,235,0.4)',   pulse: null,         bg: 'rgba(6,13,26,0.92)', icon: '😎' },
  worth_it: { accent: '#4F46E5', glow: 'rgba(79,70,229,0.35)',  pulse: null,         bg: 'rgba(6,13,26,0.92)', icon: '🏄' },
  flat:     { accent: '#64748B', glow: 'rgba(100,116,139,0.2)', pulse: null,         bg: 'rgba(6,13,26,0.92)', icon: '😴' },
  no_data:  { accent: '#2d3748', glow: 'transparent',           pulse: null,         bg: 'rgba(6,13,26,0.92)', icon: '—' },
} as const

function degToArrow(deg: number | null | undefined): string {
  if (deg == null) return '—'
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8]
}

// ─── Tile layer configs ────────────────────────────────────────────────────────

interface TileConfig { url: string; options: Record<string, unknown> }

function getTileConfigs(style: MapStyle): TileConfig[] {
  if (style === 'ocean') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 18, attribution: '© Esri, GEBCO, NOAA' } },
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Reference/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 18, opacity: 0.85 } },
  ]
  if (style === 'satellite') return [
    { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', options: { maxZoom: 20, attribution: '© Esri, Maxar' } },
  ]
  // dark (default)
  return [
    { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png', options: { subdomains: ['a', 'b', 'c', 'd'], maxZoom: 19, attribution: '© OpenStreetMap © CARTO' } },
  ]
}

// ─── User location pulse CSS ───────────────────────────────────────────────────

const USER_LOC_CSS = `
  @keyframes sm-user-pulse {
    0%   { transform: scale(1);   opacity: 0.6; }
    50%  { transform: scale(1.6); opacity: 0; }
    100% { transform: scale(1.6); opacity: 0; }
  }
  .sm-user-dot-wrap {
    position: relative;
    width: 16px; height: 16px;
  }
  .sm-user-ring {
    position: absolute;
    inset: -6px;
    border-radius: 50%;
    border: 2px solid #3B82F6;
    animation: sm-user-pulse 2s ease-out infinite;
  }
  .sm-user-dot {
    width: 16px; height: 16px; border-radius: 50%;
    background: #3B82F6;
    border: 2.5px solid #fff;
    box-shadow: 0 0 0 3px rgba(59,130,246,0.25), 0 2px 8px rgba(59,130,246,0.5);
  }
`

// ─── CSS ───────────────────────────────────────────────────────────────────────

const MAP_CSS = `
  /* ── Leaflet base overrides ── */
  .leaflet-container {
    background: #030810 !important;
    font-family: monospace;
  }
  .leaflet-control-zoom,
  .leaflet-control-attribution { display: none !important; }

  /* Remove Leaflet's default white-square DivIcon style */
  .leaflet-div-icon {
    background: transparent !important;
    border: none !important;
    overflow: visible !important;
  }

  /* ── Pulse animations ── */
  @keyframes sm-pulse-r {
    0%,100% { box-shadow: 0 0 0 0 rgba(239,68,68,0.7), 0 2px 12px rgba(0,0,0,0.6); }
    65%     { box-shadow: 0 0 0 8px rgba(239,68,68,0),  0 2px 12px rgba(0,0,0,0.6); }
  }
  @keyframes sm-pulse-o {
    0%,100% { box-shadow: 0 0 0 0 rgba(249,115,22,0.6), 0 2px 12px rgba(0,0,0,0.6); }
    65%     { box-shadow: 0 0 0 7px rgba(249,115,22,0),  0 2px 12px rgba(0,0,0,0.6); }
  }

  /* ── Station card marker ── */
  .sm-card {
    display: flex; align-items: center; gap: 6px;
    padding: 5px 9px 5px 7px; border-radius: 10px;
    background: rgba(6,13,26,0.92);
    border: 1.5px solid rgba(6,182,212,0.6);
    cursor: pointer; white-space: nowrap;
    box-shadow: 0 2px 16px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4);
    transform-origin: bottom center;
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1), border-color 0.15s;
    position: relative;
    min-width: 64px;
  }
  .sm-card::after {
    content: ''; position: absolute; bottom: -6px; left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(6,13,26,0.92);
  }
  .sm-card-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .sm-card-data { display: flex; flex-direction: column; gap: 1px; }
  .sm-card-height { font-family: monospace; font-size: 13px; font-weight: 900; color: #F0F9FF; line-height: 1; letter-spacing: -0.02em; }
  .sm-card-sub { font-family: monospace; font-size: 9px; color: rgba(240,249,255,0.6); letter-spacing: 0.02em; }
  .sm-card:hover { transform: scale(1.12); border-color: rgba(6,182,212,0.7); }
  .sm-card.active { transform: scale(1.2); border-color: #06b6d4; box-shadow: 0 0 0 2px rgba(6,182,212,0.25), 0 2px 16px rgba(0,0,0,0.7) !important; }
  .sm-card.sm-pulse-r { animation: sm-pulse-r 2.2s ease-in-out infinite; }
  .sm-card.sm-pulse-o { animation: sm-pulse-o 2.8s ease-in-out infinite; }

  /* ── Dot marker ── */
  .sm-dot {
    width: 10px; height: 10px; border-radius: 50%;
    border: 1.5px solid rgba(255,255,255,0.35);
    cursor: pointer;
    box-shadow: 0 1px 6px rgba(0,0,0,0.5);
    transition: transform 0.2s cubic-bezier(.34,1.56,.64,1);
  }
  .sm-dot:hover { transform: scale(1.5); }
  .sm-dot.active { transform: scale(1.35); border-color: #fff; box-shadow: 0 0 0 3px rgba(255,255,255,0.2) !important; }

  /* ── Wrapper + tooltip ── */
  .sm-wrap {
    position: relative;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
  }
  .sm-tip {
    position: absolute; bottom: calc(100% + 8px); left: 50%;
    transform: translateX(-50%);
    background: rgba(3,6,14,0.96);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 7px; padding: 5px 9px;
    white-space: nowrap; pointer-events: none;
    opacity: 0; transition: opacity 0.12s;
    box-shadow: 0 4px 16px rgba(0,0,0,0.5);
    z-index: 999;
  }
  .sm-tip::after {
    content: '';
    position: absolute; top: 100%; left: 50%;
    transform: translateX(-50%);
    border: 4px solid transparent;
    border-top-color: rgba(255,255,255,0.1);
  }
  .sm-tip-name { font-family: monospace; font-size: 10px; font-weight: 700; color: #e2e8f0; display: block; }
  .sm-tip-sub  { font-family: monospace; font-size: 8px;  color: rgba(255,255,255,0.35); display: block; margin-top: 2px; letter-spacing: 0.05em; }
  .sm-wrap:hover .sm-tip { opacity: 1; }

  /* ── Filtered state (dimmed) ── */
  .sm-wrap.filtered { opacity: 0.15; pointer-events: none; }
`

// ─── Props ─────────────────────────────────────────────────────────────────────

interface SpotMapProps {
  spots: Spot[]
  filteredSlugs: Set<string>
  selectedSlug: string | null
  onSpotSelect: (slug: string | null) => void
  mapStyle: MapStyle
  onStyleChange: (style: MapStyle) => void
  onMapReady?: (map: unknown) => void
  onBoundsChange?: (bounds: { north: number; south: number; east: number; west: number }, center: { lat: number; lng: number }) => void
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SpotMap({
  spots,
  filteredSlugs,
  selectedSlug,
  onSpotSelect,
  mapStyle,
  onMapReady,
  onBoundsChange,
}: SpotMapProps) {
  const containerRef          = useRef<HTMLDivElement>(null)
  const mapRef                = useRef<import('leaflet').Map | null>(null)
  // Cluster markers: key is either spot slug (individual) or cluster id (cluster-${i})
  const markersRef            = useRef<Map<string, { pin: HTMLElement; wrap: HTMLElement; marker: import('leaflet').Marker }>>(new Map())
  // Separate tracking for individual spot slug → marker key (for filter/active effects)
  const slugToKeyRef          = useRef<Map<string, string>>(new Map())
  const tileLayersRef         = useRef<import('leaflet').TileLayer[]>([])
  const mapReadyRef           = useRef(false)
  const spotsRef              = useRef<Spot[]>([])
  const zoomRef               = useRef(6)
  const onSelectRef           = useRef(onSpotSelect)
  onSelectRef.current         = onSpotSelect
  const onBoundsChangeRef     = useRef(onBoundsChange)
  useEffect(() => { onBoundsChangeRef.current = onBoundsChange }, [onBoundsChange])

  // User location markers
  const userDotMarkerRef      = useRef<import('leaflet').Marker | null>(null)
  const userPulseCircleRef    = useRef<import('leaflet').Circle | null>(null)

  const { location: userLocation } = useLocation()

  // Inject CSS once
  useEffect(() => {
    if (document.getElementById('sm-css')) return
    const el = document.createElement('style')
    el.id = 'sm-css'
    el.textContent = MAP_CSS
    document.head.appendChild(el)
  }, [])

  // Inject cluster CSS once
  useEffect(() => {
    if (document.getElementById('sm-cluster-css')) return
    const el = document.createElement('style')
    el.id = 'sm-cluster-css'
    el.textContent = CLUSTER_CSS
    document.head.appendChild(el)
  }, [])

  // Inject user-loc CSS once
  useEffect(() => {
    if (document.getElementById('sm-user-loc-css')) return
    const el = document.createElement('style')
    el.id = 'sm-user-loc-css'
    el.textContent = USER_LOC_CSS
    document.head.appendChild(el)
  }, [])

  // ── Effect 1: Map init (once) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    // Cancellation flag — guards against StrictMode double-invoke where the
    // cleanup runs before the async import resolves, leaving a stale callback
    // that would call L.map() on an already-initialized container.
    let cancelled = false

    import('leaflet').then((leafletMod) => {
      if (cancelled) return
      const L = (leafletMod.default ?? leafletMod) as typeof import('leaflet')
      const container = containerRef.current
      if (!container) return

      // Guard against Leaflet's "Map container is already initialized" error.
      // React StrictMode unmounts+remounts components; map.remove() should clear
      // _leaflet_id but in some Leaflet versions it does not. Bail out if the
      // container already carries a Leaflet instance id.
      if ((container as HTMLElement & { _leaflet_id?: number })._leaflet_id) return

      const map = L.map(container, {
        center: [37, -122],
        zoom: 6,
        minZoom: 1,
        maxZoom: 18,
        zoomControl: false,
        attributionControl: false,
      })
      mapRef.current = map
      mapReadyRef.current = true
      onMapReady?.(map)

      // Add tile layers
      const configs = getTileConfigs('dark') // default style at mount
      tileLayersRef.current = configs.map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )

      // Add initial markers (clustered)
      zoomRef.current = map.getZoom()
      _renderClusters(L, map, spotsRef.current)

      // Emit bounds on pan/zoom/load
      const emitBounds = () => {
        if (!onBoundsChangeRef.current) return
        const b = map.getBounds()
        const c = map.getCenter()
        onBoundsChangeRef.current(
          { north: b.getNorth(), south: b.getSouth(), east: b.getEast(), west: b.getWest() },
          { lat: c.lat, lng: c.lng }
        )
      }

      // Re-render clusters when zoom crosses the threshold
      const onZoomEnd = () => {
        const newZoom = map.getZoom()
        const prevZoom = zoomRef.current
        zoomRef.current = newZoom
        // Re-cluster whenever zoom changes (threshold check inside clusterSpots)
        const crossedThreshold =
          (prevZoom <= 9 && newZoom > 9) ||
          (prevZoom > 9 && newZoom <= 9) ||
          (newZoom <= 9 && newZoom !== prevZoom)
        if (crossedThreshold) {
          _renderClusters(L, map, spotsRef.current)
        }
        emitBounds()
      }

      map.on('moveend', emitBounds)
      map.on('zoomend', onZoomEnd)
      map.once('load', emitBounds)
      setTimeout(emitBounds, 500)

      // Click on map background → deselect (suppress if user just panned)
      let lastDragEnd = 0
      map.on('dragend', () => { lastDragEnd = Date.now() })
      map.on('click', () => {
        if (Date.now() - lastDragEnd > 200) onSelectRef.current(null)
      })
    })

    return () => {
      cancelled = true
      mapReadyRef.current = false
      markersRef.current.clear()
      slugToKeyRef.current.clear()
      tileLayersRef.current = []
      if (userDotMarkerRef.current) { userDotMarkerRef.current.remove(); userDotMarkerRef.current = null }
      if (userPulseCircleRef.current) { userPulseCircleRef.current.remove(); userPulseCircleRef.current = null }
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Effect 2: Sync spots ──────────────────────────────────────────────────────
  useEffect(() => {
    spotsRef.current = spots
    if (!mapReadyRef.current || !mapRef.current) return

    import('leaflet').then((leafletMod) => {
      const L = (leafletMod.default ?? leafletMod) as typeof import('leaflet')
      const map = mapRef.current
      if (!map) return
      _renderClusters(L, map, spots)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spots])

  // ── Effect 3: Filter visibility ───────────────────────────────────────────────
  // At low zoom (clusters), filtering dims individual sub-spot elements — but since
  // clusters combine multiple spots we can't dim reliably; filtering only applies
  // to individual markers (zoom > 9).
  useEffect(() => {
    markersRef.current.forEach(({ wrap }, key) => {
      // Individual markers: key === slug; cluster markers: key starts with 'cluster-'
      if (!key.startsWith('cluster-')) {
        wrap.classList.toggle('filtered', !filteredSlugs.has(key))
      }
    })
  }, [filteredSlugs])

  // ── Effect 4: Active state ────────────────────────────────────────────────────
  useEffect(() => {
    markersRef.current.forEach(({ pin }, key) => {
      if (!key.startsWith('cluster-')) {
        pin.classList.toggle('active', selectedSlug === key)
      }
    })
  }, [selectedSlug])

  // ── Effect 5: Fly to selected ─────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSlug || !mapRef.current) return
    const spot = spots.find(s => s.slug === selectedSlug)
    if (spot) {
      mapRef.current.flyTo(
        [spot.lat, spot.lng],
        Math.max(mapRef.current.getZoom(), 8),
        { duration: 0.8 }
      )
    }
  }, [selectedSlug, spots])

  // ── Effect 6: Tile style ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current) return
    import('leaflet').then((leafletMod) => {
      const L = (leafletMod.default ?? leafletMod) as typeof import('leaflet')
      const map = mapRef.current
      if (!map) return
      tileLayersRef.current.forEach(l => map.removeLayer(l))
      tileLayersRef.current = getTileConfigs(mapStyle).map(({ url, options }) =>
        L.tileLayer(url, options).addTo(map)
      )
    })
  }, [mapStyle])

  // ── Effect 7: User location blue dot ─────────────────────────────────────────
  useEffect(() => {
    if (!mapReadyRef.current || !mapRef.current || !userLocation) {
      // Remove stale markers if location was cleared
      if (userDotMarkerRef.current) { userDotMarkerRef.current.remove(); userDotMarkerRef.current = null }
      if (userPulseCircleRef.current) { userPulseCircleRef.current.remove(); userPulseCircleRef.current = null }
      return
    }

    import('leaflet').then((leafletMod) => {
      const L = (leafletMod.default ?? leafletMod) as typeof import('leaflet')
      const map = mapRef.current
      if (!map) return

      // Remove previous markers
      if (userDotMarkerRef.current) { userDotMarkerRef.current.remove(); userDotMarkerRef.current = null }
      if (userPulseCircleRef.current) { userPulseCircleRef.current.remove(); userPulseCircleRef.current = null }

      // Outer pulse ring (accuracy / visual ring)
      userPulseCircleRef.current = L.circle(
        [userLocation.lat, userLocation.lng],
        {
          radius: userLocation.accuracy != null && userLocation.accuracy > 20
            ? userLocation.accuracy
            : 200,            // fallback 200m ring when accuracy not available
          color: '#3B82F6',
          fillColor: '#3B82F6',
          fillOpacity: 0.08,
          weight: 1,
          opacity: 0.3,
          interactive: false,
        }
      ).addTo(map)

      // Pulsing blue dot marker
      const wrap = document.createElement('div')
      wrap.className = 'sm-user-dot-wrap'
      const ring = document.createElement('div')
      ring.className = 'sm-user-ring'
      const dot = document.createElement('div')
      dot.className = 'sm-user-dot'
      wrap.appendChild(ring)
      wrap.appendChild(dot)

      const icon = L.divIcon({
        html: wrap,
        className: '',
        iconSize: [16, 16],
        iconAnchor: [8, 8],
      })

      userDotMarkerRef.current = L.marker(
        [userLocation.lat, userLocation.lng],
        { icon, zIndexOffset: 1000, interactive: false }
      ).addTo(map)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation])

  // ── Cluster renderer — clears all existing markers and re-adds based on zoom ──
  function _renderClusters(L: typeof import('leaflet'), map: import('leaflet').Map, spots: Spot[]) {
    // Remove all current markers
    markersRef.current.forEach(({ marker }) => map.removeLayer(marker))
    markersRef.current.clear()
    slugToKeyRef.current.clear()

    const zoom = zoomRef.current
    const items = clusterSpots(spots, zoom)

    items.forEach((item, idx) => {
      if (item.isCluster) {
        // Cluster marker
        const count = item.spots.length
        const clusterDiv = document.createElement('div')
        clusterDiv.className = 'sm-cluster'
        const span = document.createElement('span')
        span.textContent = String(count)
        clusterDiv.appendChild(span)

        const icon = L.divIcon({
          html: clusterDiv,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([item.lat, item.lng], { icon }).addTo(map)
        marker.on('click', () => {
          map.flyTo([item.lat, item.lng], map.getZoom() + 2, { animate: true, duration: 0.5 })
        })

        const key = `cluster-${idx}`
        markersRef.current.set(key, { pin: clusterDiv, wrap: clusterDiv, marker })
        // Track each sub-spot slug → cluster key so fly-to still works
        item.spots.forEach(s => slugToKeyRef.current.set(s.slug, key))
      } else {
        // Individual spot marker
        _addMarker(L, map, item.spots[0])
        slugToKeyRef.current.set(item.spots[0].slug, item.spots[0].slug)
      }
    })
  }

  // ── Individual marker builder ─────────────────────────────────────────────────
  function _addMarker(L: typeof import('leaflet'), map: import('leaflet').Map, spot: Spot) {
    if (markersRef.current.has(spot.slug)) return

    const label    = getConditionLabel(spot.current_conditions?.quality_score)
    const m        = CM[label]
    const heightM  = spot.current_conditions?.wave_height_face_m
    const heightFt = heightM != null ? Math.round(heightM * 3.281) : null
    const per      = spot.current_conditions?.wave_period_s
    const waveDir  = spot.current_conditions?.wave_direction
    const hasData  = spot.current_conditions != null
    const showCard = hasData && heightFt != null && heightFt > 0

    // Wrapper
    const wrap = document.createElement('div')
    wrap.className = 'sm-wrap'

    // Tooltip
    const tip = document.createElement('div')
    tip.className = 'sm-tip'
    const tipName = document.createElement('span')
    tipName.className = 'sm-tip-name'
    tipName.textContent = spot.name
    const tipSub = document.createElement('span')
    tipSub.className = 'sm-tip-sub'
    tipSub.textContent = hasData && heightFt ? `${heightFt}ft · ${label.replace('_', ' ').toUpperCase()}` : 'OFFLINE'
    tip.appendChild(tipName)
    tip.appendChild(tipSub)
    wrap.appendChild(tip)

    // Pin
    const pin = document.createElement('div')
    pin.setAttribute('data-slug', spot.slug)

    if (showCard) {
      pin.className = `sm-card${m.pulse ? ` ${m.pulse}` : ''}`
      const dot = document.createElement('span')
      dot.className = 'sm-card-dot'
      dot.style.cssText = `background:${m.accent};box-shadow:0 0 6px ${m.glow}`
      pin.appendChild(dot)
      const data = document.createElement('div')
      data.className = 'sm-card-data'
      const h = document.createElement('span')
      h.className = 'sm-card-height'
      h.textContent = `${heightFt}ft`
      data.appendChild(h)
      const s = document.createElement('span')
      s.className = 'sm-card-sub'
      s.textContent = `${per != null ? per.toFixed(0) + 's' : '—'} · ${degToArrow(waveDir)}`
      data.appendChild(s)
      pin.appendChild(data)
    } else {
      pin.className = 'sm-dot'
      pin.style.cssText = hasData
        ? `background:${m.accent};box-shadow:0 0 8px ${m.glow}`
        : 'background:#2d3748'
    }

    wrap.appendChild(pin)

    const icon = L.divIcon({
      html: wrap,
      className: '',
      iconSize:   showCard ? [100, 46] : [10, 10],
      iconAnchor: showCard ? [50, 46]  : [5, 5],
    })

    const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map)
    // Marker click — don't bubble to map so deselect doesn't fire
    marker.on('click', () => {
      onSelectRef.current(spot.slug)
    })

    markersRef.current.set(spot.slug, { pin, wrap, marker })
  }

  function handleFlyToUser() {
    if (!mapRef.current || !userLocation) return
    mapRef.current.flyTo([userLocation.lat, userLocation.lng], 11, { animate: true, duration: 1.0 })
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', touchAction: 'none' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* MY LOCATION button — top right, only when location is available */}
      {userLocation && (
        <button
          onClick={handleFlyToUser}
          title="Fly to my location"
          aria-label="Fly to my location"
          style={{
            position: 'absolute', top: 14, right: 14, zIndex: 20,
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--paper-raised)',
            border: '1px solid var(--tile-border-strong)',
            borderRadius: 8, padding: '7px 12px',
            cursor: 'pointer', color: 'var(--cyan-bright)',
            fontFamily: 'var(--font-data)', fontSize: 10, letterSpacing: '0.08em', fontWeight: 700,
            boxShadow: 'var(--tile-shadow)',
            transition: 'background 0.12s, border-color 0.12s',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--cyan-muted)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'rgba(14,165,233,0.5)'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.background = 'var(--paper-raised)'
            ;(e.currentTarget as HTMLElement).style.borderColor = 'var(--tile-border-strong)'
          }}
        >
          {/* Crosshair icon */}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" fill="currentColor" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          MY LOCATION
        </button>
      )}
    </div>
  )
}
