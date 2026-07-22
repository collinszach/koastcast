'use client'

import React, { useState, useMemo } from 'react'
import type { Resort } from '@/types/snow'
import { getSnowConditionLabel, cmToInches, metersToFeet } from '@/types/snow'
import resortsData from '@/data/resorts.json'

// ─── Condition config ──────────────────────────────────────────────────────────

const SC = {
  epic_powder:  { label: 'POWDER',       accent: 'var(--snow)',       bg: 'var(--snow-muted)',        border: 'rgba(124,58,237,0.3)'  },
  fresh_tracks: { label: 'FRESH TRACKS', accent: 'var(--q-pumping)',  bg: 'rgba(8,145,178,0.10)',      border: 'rgba(8,145,178,0.28)'  },
  good_snow:    { label: 'GOOD SNOW',    accent: 'var(--q-good)',     bg: 'rgba(37,99,235,0.08)',      border: 'rgba(37,99,235,0.22)'  },
  packed:       { label: 'PACKED',       accent: 'var(--spray)',      bg: 'rgba(107,118,134,0.08)',    border: 'rgba(107,118,134,0.2)' },
  icy:          { label: 'ICY',          accent: 'var(--deep-text)',  bg: 'rgba(168,176,188,0.08)',    border: 'rgba(168,176,188,0.18)'},
  no_data:      { label: 'NO DATA',      accent: 'var(--deep-text)',  bg: 'rgba(168,176,188,0.05)',    border: 'rgba(168,176,188,0.12)'},
} as const

// ─── Mock snow (deterministic, same as SnowMapClient) ─────────────────────────

function mockSnow(name: string) {
  const h = name.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0)
  const abs = Math.abs(h)
  return { newSnow: abs % 20, base: 40 + (abs % 80) }
}

// ─── Sort types ───────────────────────────────────────────────────────────────

type SortKey = 'powder' | 'new_snow' | 'base_depth' | 'alpha'
type RegionGroup = 'all' | 'West' | 'Rockies' | 'East'

const REGION_GROUPS: Record<Exclude<RegionGroup, 'all'>, string[]> = {
  West:    ['California', 'Pacific Northwest', 'Alaska', 'Sierra Nevada', 'Cascades'],
  Rockies: ['Colorado', 'Utah', 'Wyoming', 'Montana', 'Idaho', 'Nevada', 'New Mexico', 'Arizona'],
  East:    ['New England', 'Mid-Atlantic', 'Southeast', 'Midwest', 'Great Lakes', 'Northeast'],
}

function matchesRegionGroup(resort: Resort, group: RegionGroup): boolean {
  if (group === 'all') return true
  const regionWords = [resort.region, resort.state].join(' ').toLowerCase()
  const targets = REGION_GROUPS[group] ?? []
  return targets.some(t => regionWords.includes(t.toLowerCase()))
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="tile" style={{
      padding: '14px 16px',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      animation: 'snow-skeleton-pulse 1.5s ease-in-out infinite',
    }}>
      <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--paper-sunken)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 12, width: '60%', borderRadius: 6, background: 'var(--paper-sunken)' }} />
        <div style={{ height: 9, width: '40%', borderRadius: 5, background: 'var(--paper-sunken)' }} />
      </div>
      <div style={{ width: 48, height: 20, borderRadius: 10, background: 'var(--paper-sunken)', flexShrink: 0 }} />
    </div>
  )
}

function SkeletonList() {
  return (
    <>
      <style>{`
        @keyframes snow-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3].map(i => <SkeletonCard key={i} />)}
      </div>
    </>
  )
}

// ─── Resort card (list mode only) ────────────────────────────────────────────

function ResortListCard({ resort }: { resort: Resort }) {
  const cc       = resort.current_conditions
  const condKey  = getSnowConditionLabel(cc?.powder_score)
  const m        = SC[condKey]
  const mock     = mockSnow(resort.name)
  const newSnow  = cc?.new_snow_24h_in  ?? mock.newSnow
  const baseDepth = cc?.base_depth_in   ?? mock.base
  const vertFt   = metersToFeet(resort.vertical_m)
  const avgIn    = cmToInches(resort.annual_snowfall_cm)

  const passColor = resort.pass === 'epic' ? 'var(--q-good)' : resort.pass === 'ikon' ? 'var(--amber)' : 'var(--spray)'
  const passLabel = resort.pass === 'epic' ? 'EPIC'      : resort.pass === 'ikon' ? 'IKON'      : 'INDEP'

  return (
    <a
      href={`/snow/${resort.slug}`}
      className="tile"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '13px 14px',
        textDecoration: 'none',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = `${m.border}`
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--paper-sunken)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--tile-border)'
        ;(e.currentTarget as HTMLAnchorElement).style.background = 'var(--tile-bg)'
      }}
    >
      {/* Left accent bar */}
      <div style={{
        position: 'absolute', left: 0, top: 6, bottom: 6, width: 3,
        borderRadius: 2, background: m.accent,
      }} />

      {/* New snow badge */}
      <div style={{
        width: 44, height: 44, borderRadius: 10, flexShrink: 0,
        background: m.bg, border: `1px solid ${m.border}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: 'var(--font-data, monospace)', fontSize: 15, fontWeight: 900,
          color: (newSnow ?? 0) >= 6 ? 'var(--snow-bright)' : m.accent, lineHeight: 1, letterSpacing: '-0.02em',
        }}>{newSnow ?? '—'}</span>
        <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>in</span>
      </div>

      {/* Main info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700,
          color: 'var(--foam)', lineHeight: 1.2, marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{resort.name}</div>
        <div style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8.5, color: 'var(--spray)', letterSpacing: '0.04em' }}>
          {resort.region} · {resort.state}
          {vertFt != null && <span style={{ color: 'var(--deep-text)' }}> · {vertFt.toLocaleString()}ft vert</span>}
          {avgIn  != null && <span style={{ color: 'var(--deep-text)' }}> · {avgIn}" avg</span>}
        </div>
      </div>

      {/* Right: pass + condition badge */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5, flexShrink: 0 }}>
        <span style={{
          fontFamily: 'var(--font-data, monospace)', fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
          color: passColor, background: 'var(--paper-sunken)', border: `1px solid ${passColor}`,
          padding: '2px 7px', borderRadius: 20,
        }}>{passLabel}</span>
        <span style={{
          fontFamily: 'var(--font-data, monospace)', fontSize: 7.5, fontWeight: 700, letterSpacing: '0.04em',
          color: m.accent, background: m.bg, border: `1px solid ${m.border}`,
          padding: '2px 7px', borderRadius: 20, whiteSpace: 'nowrap',
        }}>❄ {m.label}</span>
        {baseDepth != null && (
          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 7.5, color: 'var(--spray)', letterSpacing: '0.03em' }}>
            {baseDepth}" base
          </span>
        )}
      </div>
    </a>
  )
}

// ─── Sort helper ──────────────────────────────────────────────────────────────

function powderOrder(r: Resort): number {
  const k = getSnowConditionLabel(r.current_conditions?.powder_score)
  return { epic_powder: 0, fresh_tracks: 1, good_snow: 2, packed: 3, icy: 4, no_data: 5 }[k]
}

function sortResorts(list: Resort[], key: SortKey): Resort[] {
  const copy = [...list]
  switch (key) {
    case 'powder':
      return copy.sort((a, b) => {
        const pA = powderOrder(a), pB = powderOrder(b)
        if (pA !== pB) return pA - pB
        const scoreA = a.current_conditions?.powder_score ?? -1
        const scoreB = b.current_conditions?.powder_score ?? -1
        return scoreB - scoreA
      })
    case 'new_snow': {
      const mockA = (r: Resort) => mockSnow(r.name).newSnow
      return copy.sort((a, b) => {
        const A = a.current_conditions?.new_snow_24h_in ?? mockA(a)
        const B = b.current_conditions?.new_snow_24h_in ?? mockA(b)
        return (B ?? 0) - (A ?? 0)
      })
    }
    case 'base_depth': {
      const mockB = (r: Resort) => mockSnow(r.name).base
      return copy.sort((a, b) => {
        const A = a.current_conditions?.base_depth_in ?? mockB(a)
        const B = b.current_conditions?.base_depth_in ?? mockB(b)
        return (B ?? 0) - (A ?? 0)
      })
    }
    case 'alpha':
      return copy.sort((a, b) => a.name.localeCompare(b.name))
    default:
      return copy
  }
}

// ─── Snow List view ───────────────────────────────────────────────────────────

function SnowListView({ resorts }: { resorts: Resort[] }) {
  const [sortKey,       setSortKey]       = useState<SortKey>('powder')
  const [regionGroup,   setRegionGroup]   = useState<RegionGroup>('all')
  const [searchQuery,   setSearchQuery]   = useState('')
  const [loaded,        setLoaded]        = useState(false)

  // Simulate async load for skeleton demo (data is already available server-side)
  React.useEffect(() => {
    const t = setTimeout(() => setLoaded(true), 300)
    return () => clearTimeout(t)
  }, [])

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    return resorts.filter(r => {
      if (!matchesRegionGroup(r, regionGroup)) return false
      if (q) {
        const hay = [r.name, r.state, r.region, r.description ?? ''].join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [resorts, regionGroup, searchQuery])

  const sorted = useMemo(() => sortResorts(filtered, sortKey), [filtered, sortKey])

  const powderCount = useMemo(
    () => resorts.filter(r => ['epic_powder', 'fresh_tracks'].includes(getSnowConditionLabel(r.current_conditions?.powder_score))).length,
    [resorts]
  )

  const SORT_OPTIONS: { key: SortKey; label: string }[] = [
    { key: 'powder',    label: 'Powder Quality' },
    { key: 'new_snow',  label: 'New Snow'        },
    { key: 'base_depth', label: 'Base Depth'     },
    { key: 'alpha',     label: 'Alphabetical'    },
  ]

  const REGION_OPTIONS: { key: RegionGroup; label: string }[] = [
    { key: 'all',     label: 'All'     },
    { key: 'West',    label: 'West'    },
    { key: 'Rockies', label: 'Rockies' },
    { key: 'East',    label: 'East'    },
  ]

  return (
    <div style={{
      height: '100%', overflowY: 'auto', background: 'var(--deep)',
      padding: '0 0 40px',
    }}>
      <style>{`
        @keyframes snow-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.45; }
        }
        .snow-list-search::placeholder { color: var(--deep-text); }
        .snow-list-search:focus { outline: none; border-color: var(--snow-dim) !important; }
      `}</style>

      {/* Header */}
      <div style={{
        padding: '24px 20px 20px',
        borderBottom: '1px solid var(--tile-border)',
        background: 'var(--paper-raised)',
        position: 'sticky', top: 0, zIndex: 10,
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 'clamp(1.4rem, 4vw, 1.9rem)', fontWeight: 900, color: 'var(--foam)', letterSpacing: '-0.03em', margin: 0, lineHeight: 1 }}>
              Snow Resorts
            </h1>
            <p style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--spray)', letterSpacing: '0.1em', marginTop: 4 }}>
              {resorts.length} RESORTS · {powderCount} WITH FRESH SNOW
            </p>
          </div>
          {/* Map link */}
          <a href="/snow?view=map" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontFamily: 'var(--font-data, monospace)', fontSize: 9, fontWeight: 700,
            color: 'var(--snow-bright)', background: 'var(--snow-muted)',
            border: '1px solid rgba(124,58,237,0.25)', padding: '6px 12px', borderRadius: 20,
            textDecoration: 'none', letterSpacing: '0.06em',
          }}>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><rect x="1" y="1" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M3.5 3.5L6.5 6.5M6.5 3.5L3.5 6.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
            MAP VIEW
          </a>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, pointerEvents: 'none' }}>
            <circle cx="5.5" cy="5.5" r="4" stroke="var(--spray)" strokeWidth="1.5"/>
            <path d="M8.5 8.5L11.5 11.5" stroke="var(--spray)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            className="snow-list-search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search resorts by name, state, or region..."
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '11px 12px 11px 32px',
              background: 'var(--paper-sunken)',
              border: '1px solid var(--tile-border-strong)',
              borderRadius: 12, color: 'var(--foam)',
              fontFamily: 'var(--font-data, monospace)', fontSize: 12, letterSpacing: '0.02em',
              transition: 'border-color 0.15s',
            }}
          />
        </div>

        {/* Region group pills */}
        <div style={{ display: 'flex', gap: 5, marginBottom: 10, flexWrap: 'wrap' }}>
          {REGION_OPTIONS.map(({ key, label }) => {
            const active = regionGroup === key
            return (
              <button key={key} onClick={() => setRegionGroup(key)} style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: 10, fontWeight: 600,
                padding: '4px 13px', borderRadius: 20, cursor: 'pointer', letterSpacing: '0.05em',
                border: `1px solid ${active ? 'rgba(124,58,237,0.4)' : 'var(--tile-border)'}`,
                background: active ? 'var(--snow-muted)' : 'var(--paper-sunken)',
                color: active ? 'var(--snow-bright)' : 'var(--spray)',
                transition: 'all 0.12s',
              }}>{label}</button>
            )
          })}
        </div>

        {/* Sort controls */}
        <div style={{ display: 'flex', gap: 5, overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--deep-text)', letterSpacing: '0.1em', alignSelf: 'center', whiteSpace: 'nowrap', marginRight: 2 }}>SORT BY</span>
          {SORT_OPTIONS.map(({ key, label }) => {
            const active = sortKey === key
            return (
              <button key={key} onClick={() => setSortKey(key)} style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: 9, fontWeight: 600,
                padding: '3px 11px', borderRadius: 20, cursor: 'pointer', letterSpacing: '0.04em',
                whiteSpace: 'nowrap',
                border: `1px solid ${active ? 'rgba(124,58,237,0.35)' : 'var(--tile-border)'}`,
                background: active ? 'var(--snow-muted)' : 'var(--paper-sunken)',
                color: active ? 'var(--snow-bright)' : 'var(--spray)',
                transition: 'all 0.12s',
              }}>{label}</button>
            )
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 16px 0' }}>
        {/* Count */}
        <p style={{ fontFamily: 'var(--font-data, monospace)', fontSize: 8, color: 'var(--deep-text)', letterSpacing: '0.07em', marginBottom: 12 }}>
          {sorted.length}{sorted.length !== resorts.length ? `/${resorts.length}` : ''} RESORTS
        </p>

        {!loaded ? (
          <SkeletonList />
        ) : sorted.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div style={{ fontSize: 32, marginBottom: 10, opacity: 0.3 }}>⛷</div>
            <p style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, color: 'var(--spray)', marginBottom: 12 }}>
              No resorts match
            </p>
            <button
              onClick={() => { setRegionGroup('all'); setSearchQuery('') }}
              style={{
                fontFamily: 'var(--font-data, monospace)', fontSize: 9, color: 'var(--snow-bright)',
                background: 'none', border: 'none', cursor: 'pointer',
                letterSpacing: '0.08em', textTransform: 'uppercase',
              }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sorted.map(r => <ResortListCard key={r.slug} resort={r} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────
// Primary view: enhanced list with sort / region / search / skeleton.
// Map view is still available via SnowMapClient (used in the sidebar panel).

export default function SnowPage() {
  const resorts = resortsData as Resort[]
  return <SnowListView resorts={resorts} />
}
