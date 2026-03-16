'use client'

import { useEffect, useRef, useState } from 'react'
import type { Spot } from '@/types'
import { getConditionColor, getConditionLabel } from '@/types'

interface SpotMapProps {
  spots: Spot[]
}

type MapStyle = 'dark' | 'satellite'

function makeDarkStyle() {
  return {
    version: 8 as const,
    sources: {
      tiles: {
        type: 'raster' as const,
        tiles: ['https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png'],
        tileSize: 256,
        attribution: '© <a href="https://stadiamaps.com/" target="_blank">Stadia Maps</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
      },
    },
    layers: [{ id: 'tiles', type: 'raster' as const, source: 'tiles' }],
  }
}

function makeSatelliteStyle() {
  return {
    version: 8 as const,
    sources: {
      tiles: {
        type: 'raster' as const,
        tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
        tileSize: 256,
        attribution: '© Esri, Maxar, Earthstar Geographics',
      },
    },
    layers: [{ id: 'tiles', type: 'raster' as const, source: 'tiles' }],
  }
}

const LEGEND = [
  { label: 'FIRING',      color: '#ef4444', emoji: '🔥' },
  { label: 'PUMPING',     color: '#f97316', emoji: '🤙' },
  { label: 'FUN',         color: '#22c55e', emoji: '😎' },
  { label: 'WORTH IT',    color: '#3b82f6', emoji: '🏄' },
  { label: 'FLAT / –',    color: '#475569', emoji: '😴' },
]

export default function SpotMap({ spots }: SpotMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef       = useRef<import('maplibre-gl').Map | null>(null)
  const [mapStyle, setMapStyle] = useState<MapStyle>('dark')

  /* Inject global CSS for markers + popups once */
  useEffect(() => {
    if (document.getElementById('swellstack-map-styles')) return
    const el = document.createElement('style')
    el.id = 'swellstack-map-styles'
    el.textContent = `
      @keyframes pulse-ring-red {
        0%,100%{ box-shadow:0 0 0 0 rgba(239,68,68,.7),0 3px 12px rgba(0,0,0,.7); }
        50%    { box-shadow:0 0 0 14px rgba(239,68,68,0),0 3px 12px rgba(0,0,0,.7); }
      }
      @keyframes pulse-ring-orange {
        0%,100%{ box-shadow:0 0 0 0 rgba(249,115,22,.6),0 3px 12px rgba(0,0,0,.7); }
        50%    { box-shadow:0 0 0 11px rgba(249,115,22,0),0 3px 12px rgba(0,0,0,.7); }
      }
      .swellstack-marker {
        border-radius:50%;
        border:2.5px solid rgba(255,255,255,.9);
        cursor:pointer;
        transition:transform .2s cubic-bezier(.34,1.56,.64,1);
      }
      .swellstack-marker:hover { transform:scale(1.6) !important; }
      .swellstack-marker.firing  { animation:pulse-ring-red    2s ease-in-out infinite; }
      .swellstack-marker.pumping { animation:pulse-ring-orange 2.5s ease-in-out infinite; }
    `
    document.head.appendChild(el)
  }, [])

  /* Build and mount map */
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    import('maplibre-gl').then(({ Map, Marker, Popup }) => {
      const map = new Map({
        container: containerRef.current!,
        style: makeDarkStyle(),
        center: [-119, 36.5],
        zoom: 5.2,
        attributionControl: { compact: true },
      })
      mapRef.current = map

      map.on('load', () => {
        spots.forEach((spot) => {
          const label = getConditionLabel(spot.current_conditions?.quality_score)
          const color = getConditionColor(label)
          const cc    = spot.current_conditions

          /* Marker element */
          const size = label === 'firing' ? 22 : label === 'pumping' ? 20 : 17
          const el = document.createElement('div')
          el.className = `swellstack-marker ${label}`
          el.style.width  = `${size}px`
          el.style.height = `${size}px`
          el.style.background = color

          /* Popup HTML */
          const conditionMeta: Record<string, { emoji: string; label: string; headerBg: string }> = {
            firing:   { emoji: '🔥', label: 'FIRING',   headerBg: 'rgba(127,29,29,.95)' },
            pumping:  { emoji: '🤙', label: 'PUMPING',  headerBg: 'rgba(124,45,18,.95)' },
            fun:      { emoji: '😎', label: 'FUN',      headerBg: 'rgba(20,83,45,.95)'  },
            worth_it: { emoji: '🏄', label: 'WORTH IT', headerBg: 'rgba(23,37,84,.95)'  },
            flat:     { emoji: '😴', label: 'FLAT',     headerBg: 'rgba(15,23,42,.95)'  },
            no_data:  { emoji: '—',  label: 'NO DATA',  headerBg: 'rgba(15,23,42,.95)'  },
          }
          const meta = conditionMeta[label]
          const heightFt = cc?.wave_height_face_m != null
            ? `${(cc.wave_height_face_m * 3.281).toFixed(0)}ft`
            : '--'
          const period = cc?.wave_period_s != null ? `${cc.wave_period_s.toFixed(0)}s` : '--'
          const wind   = cc?.wind_speed_ms  != null ? `${(cc.wind_speed_ms * 1.944).toFixed(0)}kt` : '--'

          const popup = new Popup({ offset: 18, closeButton: true, maxWidth: '250px' })
            .setHTML(`
              <div style="font-family:system-ui,-apple-system,sans-serif;">
                <div style="background:${meta.headerBg};padding:12px 36px 12px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid rgba(255,255,255,.07);">
                  <div style="flex:1;min-width:0;">
                    <div style="font-weight:700;font-size:14px;color:#f0f9ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${spot.name}</div>
                    <div style="font-size:11px;color:#94a3b8;margin-top:1px;">${spot.region} · ${spot.break_type}</div>
                  </div>
                  <div style="text-align:center;flex-shrink:0;">
                    <div style="font-size:22px;line-height:1;">${meta.emoji}</div>
                    <div style="font-size:9px;font-weight:800;color:${color};letter-spacing:.06em;margin-top:1px;">${meta.label}</div>
                  </div>
                </div>
                <div style="padding:12px 14px;">
                  <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px;text-align:center;">
                    <div>
                      <div style="font-size:20px;font-weight:800;color:#f0f9ff;line-height:1;">${heightFt}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;">height</div>
                    </div>
                    <div>
                      <div style="font-size:20px;font-weight:800;color:#f0f9ff;line-height:1;">${period}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;">period</div>
                    </div>
                    <div>
                      <div style="font-size:20px;font-weight:800;color:#f0f9ff;line-height:1;">${wind}</div>
                      <div style="font-size:10px;color:#64748b;margin-top:2px;">wind</div>
                    </div>
                  </div>
                  <a href="/spot/${spot.slug}"
                     style="display:flex;align-items:center;justify-content:center;gap:6px;background:#0ea5e9;color:#fff;text-decoration:none;padding:9px;border-radius:8px;font-size:13px;font-weight:700;letter-spacing:.01em;"
                     onmouseover="this.style.background='#0284c7'"
                     onmouseout="this.style.background='#0ea5e9'">
                    View Forecast <span style="font-size:16px;">→</span>
                  </a>
                </div>
              </div>
            `)

          new Marker({ element: el })
            .setLngLat([spot.lng, spot.lat])
            .setPopup(popup)
            .addTo(map)
        })

        /* Fit to all spots */
        if (spots.length > 0) {
          const lngs = spots.map(s => s.lng)
          const lats = spots.map(s => s.lat)
          map.fitBounds(
            [[Math.min(...lngs) - 0.5, Math.min(...lats) - 0.5],
             [Math.max(...lngs) + 0.5, Math.max(...lats) + 0.5]],
            { padding: 60, maxZoom: 9, duration: 1200 },
          )
        }
      })
    })

    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [spots])

  function toggleStyle() {
    const next = mapStyle === 'dark' ? 'satellite' : 'dark'
    setMapStyle(next)
    mapRef.current?.setStyle(next === 'dark' ? makeDarkStyle() : makeSatelliteStyle())
  }

  return (
    <div className="relative w-full h-full">
      <div ref={containerRef} className="w-full h-full" />

      {/* Top controls row */}
      <div className="absolute top-3 left-3 right-3 flex items-start justify-between pointer-events-none z-10">
        {/* Spot count pill */}
        <div className="pointer-events-auto bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-full px-4 py-2 text-sm text-slate-200 shadow-xl">
          <span className="font-bold text-white">{spots.length}</span> surf spots
        </div>

        {/* Satellite/Map toggle */}
        <button
          onClick={toggleStyle}
          className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-full px-4 py-2 text-sm text-slate-200 hover:bg-slate-800/90 transition-colors shadow-xl"
        >
          <span>{mapStyle === 'dark' ? '🛰️' : '🗺️'}</span>
          <span className="font-medium">{mapStyle === 'dark' ? 'Satellite' : 'Street'}</span>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-8 left-3 bg-slate-900/90 backdrop-blur border border-slate-700/50 rounded-xl p-3 shadow-xl z-10">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Conditions</div>
        <div className="space-y-1.5">
          {LEGEND.map(({ label, color, emoji }) => (
            <div key={label} className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-1 ring-white/20" style={{ background: color }} />
              <span className="text-xs text-slate-400">
                {emoji} <span className="text-slate-300 font-medium">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
