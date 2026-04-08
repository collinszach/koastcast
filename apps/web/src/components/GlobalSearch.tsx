'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import Fuse from 'fuse.js'

// ─── Data types ───────────────────────────────────────────────────────────────

interface SpotEntry   { name: string; slug: string; region: string; country: string }
interface ResortEntry { name: string; slug: string; region: string; state: string }
interface TrailEntry  { name: string; slug: string; region: string; state: string }

interface SearchResult {
  type: 'surf' | 'snow' | 'trail'
  name: string
  slug: string
  sub: string
  href: string
}

// ─── Accent colors per sport ──────────────────────────────────────────────────

const ACCENT = {
  surf:  '#06B6D4',
  snow:  '#8B5CF6',
  trail: '#10B981',
} as const

const LABEL = {
  surf:  'SURF',
  snow:  'SNOW',
  trail: 'TRAIL',
} as const

// ─── Component ────────────────────────────────────────────────────────────────

export default function GlobalSearch() {
  const [query,    setQuery]    = useState('')
  const [open,     setOpen]     = useState(false)
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [active,   setActive]   = useState(0)
  const [spots,    setSpots]    = useState<SpotEntry[]>([])
  const [resorts,  setResorts]  = useState<ResortEntry[]>([])
  const [trails,   setTrails]   = useState<TrailEntry[]>([])

  const router      = useRouter()
  const inputRef    = useRef<HTMLInputElement>(null)
  const wrapperRef  = useRef<HTMLDivElement>(null)

  // Fuse instances — created once when data loads
  const fuseSpots   = useRef<Fuse<SpotEntry> | null>(null)
  const fuseResorts = useRef<Fuse<ResortEntry> | null>(null)
  const fuseTrails  = useRef<Fuse<TrailEntry> | null>(null)

  // Load static data once
  useEffect(() => {
    fetch('/spots.json')
      .then(r => r.ok ? r.json() : [])
      .then((d: SpotEntry[]) => {
        setSpots(d)
        fuseSpots.current = new Fuse(d, { keys: ['name', 'region', 'country'], threshold: 0.4 })
      })
      .catch(() => {})

    import('@/data/resorts.json')
      .then(m => {
        const d = m.default as ResortEntry[]
        setResorts(d)
        fuseResorts.current = new Fuse(d, { keys: ['name', 'region', 'state'], threshold: 0.4 })
      })
      .catch(() => {})

    import('@/data/trails.json')
      .then(m => {
        const d = m.default as TrailEntry[]
        setTrails(d)
        fuseTrails.current = new Fuse(d, { keys: ['name', 'region', 'state'], threshold: 0.4 })
      })
      .catch(() => {})
  }, [])

  // Filter results whenever query changes
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults([]); return }

    const surfResults: SearchResult[] = (
      fuseSpots.current
        ? fuseSpots.current.search(q).slice(0, 4).map(r => r.item)
        : spots.slice(0, 4)
    ).map(s => ({ type: 'surf', name: s.name, slug: s.slug, sub: s.region, href: `/spot/${s.slug}` }))

    const snowResults: SearchResult[] = (
      fuseResorts.current
        ? fuseResorts.current.search(q).slice(0, 4).map(r => r.item)
        : resorts.slice(0, 4)
    ).map(r => ({ type: 'snow', name: r.name, slug: r.slug, sub: `${r.region} · ${r.state}`, href: `/snow/${r.slug}` }))

    const trailResults: SearchResult[] = (
      fuseTrails.current
        ? fuseTrails.current.search(q).slice(0, 4).map(r => r.item)
        : trails.slice(0, 4)
    ).map(t => ({ type: 'trail', name: t.name, slug: t.slug, sub: `${t.region} · ${t.state}`, href: `/trails/${t.slug}` }))

    setResults([...surfResults, ...snowResults, ...trailResults])
    setActive(0)
  }, [query, spots, resorts, trails])

  // ⌘K global shortcut
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
        setOpen(true)
      }
      if (e.key === 'Escape') {
        setOpen(false)
        inputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Click outside to close
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const navigate = useCallback((href: string) => {
    setOpen(false)
    setQuery('')
    router.push(href)
  }, [router])

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive(a => Math.min(a + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive(a => Math.max(a - 1, 0))
    } else if (e.key === 'Enter') {
      const r = results[active]
      if (r) navigate(r.href)
    }
  }

  const hasResults = open && results.length > 0

  // Group results by type for display
  const groups: Array<{ type: SearchResult['type']; items: SearchResult[] }> = []
  ;(['surf', 'snow', 'trail'] as const).forEach(type => {
    const items = results.filter(r => r.type === type)
    if (items.length > 0) groups.push({ type, items })
  })

  return (
    <div ref={wrapperRef} style={{ position: 'relative', marginBottom: 8 }}>
      {/* Trigger / input */}
      <div
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: open ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${open ? 'rgba(6,182,212,0.25)' : 'rgba(6,182,212,0.1)'}`,
          borderRadius: 10, padding: '7px 10px',
          transition: 'border-color 0.15s, background 0.15s',
          boxSizing: 'border-box',
        }}
      >
        <Search size={12} style={{ color: '#2E5568', flexShrink: 0 }} />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onInputKeyDown}
          placeholder="Search spots, resorts, trails..."
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 11,
            letterSpacing: '0.04em', color: '#6B9BAD',
            minWidth: 0,
          }}
        />
        <kbd style={{
          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
          color: '#2E5568', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 4, padding: '1px 5px', flexShrink: 0,
          letterSpacing: '0.04em',
        }}>⌘K</kbd>
      </div>

      {/* Dropdown */}
      {hasResults && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(4,8,18,0.97)',
          border: '1px solid rgba(6,182,212,0.12)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
          zIndex: 100,
        }}>
          {groups.map(({ type, items }) => {
            const accent = ACCENT[type]
            const label  = LABEL[type]
            return (
              <div key={type}>
                {/* Section header */}
                <div style={{
                  padding: '6px 12px 3px',
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 8, fontWeight: 700,
                  color: accent, letterSpacing: '0.12em',
                  borderTop: type !== groups[0].type ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  {label}
                </div>
                {items.map(r => {
                  const idx = results.indexOf(r)
                  const isActive = idx === active
                  return (
                    <button
                      key={r.href}
                      onClick={() => navigate(r.href)}
                      onMouseEnter={() => setActive(idx)}
                      style={{
                        width: '100%', background: isActive ? `${accent}10` : 'none',
                        border: 'none', cursor: 'pointer', padding: '7px 12px',
                        display: 'flex', alignItems: 'center', gap: 10,
                        textAlign: 'left', transition: 'background 0.08s',
                      }}
                    >
                      {/* Sport dot */}
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                        background: isActive ? accent : `${accent}60`,
                        boxShadow: isActive ? `0 0 6px ${accent}` : 'none',
                        transition: 'all 0.1s',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700,
                          color: isActive ? '#f0f6ff' : '#c8d8e8',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{r.name}</div>
                        <div style={{
                          fontFamily: 'JetBrains Mono, monospace', fontSize: 9,
                          color: 'rgba(255,255,255,0.28)', letterSpacing: '0.04em', marginTop: 1,
                        }}>{r.sub}</div>
                      </div>
                      {isActive && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
                          <path d="M3.5 2L7 5 3.5 8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* No results */}
      {open && query.trim() && results.length === 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'rgba(4,8,18,0.97)',
          border: '1px solid rgba(6,182,212,0.12)',
          borderRadius: 12, padding: '14px 12px', zIndex: 100,
          fontFamily: 'JetBrains Mono, monospace', fontSize: 10,
          color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em', textAlign: 'center',
        }}>
          No results for "{query}"
        </div>
      )}
    </div>
  )
}
