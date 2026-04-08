'use client'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'

interface Spot {
  slug: string
  name: string
  lat: number
  lng: number
  quality_score?: number
  current_conditions?: { wave_height_face_m?: number; condition_label?: string }
}

interface Props {
  spots: Spot[]
  height?: number
}

export default function GlobalMap({ spots, height = 340 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let cancelled = false

    import('leaflet').then(L => {
      if (cancelled) return
      if ((container as any)._leaflet_id) return

      const map = L.map(container, {
        center: [30, -30],
        zoom: 2,
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
        dragging: true,
      })

      // Dark tile layer (CartoDB dark matter — free, no key)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 10,
      }).addTo(map)

      mapRef.current = map

      // Add spot markers
      spots.forEach(spot => {
        if (!spot.lat || !spot.lng) return
        const q = spot.quality_score ?? 5
        const color = q >= 7 ? '#06B6D4' : q >= 5 ? '#22C55E' : q >= 3 ? '#EAB308' : '#6B7280'

        const icon = L.divIcon({
          className: '',
          html: `<div style="width:8px;height:8px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color};border:1.5px solid rgba(255,255,255,0.3)"></div>`,
          iconSize: [8, 8],
          iconAnchor: [4, 4],
        })

        const marker = L.marker([spot.lat, spot.lng], { icon }).addTo(map)

        marker.bindTooltip(
          `<div style="background:#0a1628;border:1px solid rgba(255,255,255,0.1);border-radius:6px;padding:6px 10px;font-size:12px;color:white;white-space:nowrap">${spot.name}</div>`,
          { className: 'global-map-tip', permanent: false, direction: 'top', offset: [0, -6] }
        )
      })
    })

    return () => {
      cancelled = true
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
  }, [spots])

  return (
    <div
      ref={containerRef}
      style={{
        height,
        borderRadius: 16,
        overflow: 'hidden',
        background: '#0a1628',
      }}
    />
  )
}
