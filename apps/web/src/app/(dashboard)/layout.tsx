'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import type { ReactNode, ElementType, CSSProperties } from 'react'
import {
  Home,
  Map,
  Mountain,
  User,
} from 'lucide-react'
import GlobalSearch from '@/components/GlobalSearch'
import { SidebarAuthButton } from '@/components/SidebarAuthButton'
import { LocationProvider } from '@/lib/location'
import LocationPermissionPrompt from '@/components/LocationPermissionPrompt'

// ── Sport accent color helper ──────────────────────────────────────────────
function getNavAccent(href: string): string {
  if (href.startsWith('/snow'))   return '#8B5CF6'
  if (href.startsWith('/trail'))  return '#10B981'
  return '#06B6D4' // default cyan for surf / sessions / profile
}

function getNavAccentBright(href: string): string {
  if (href.startsWith('/snow'))   return '#A78BFA'
  if (href.startsWith('/trail'))  return '#34D399'
  return '#22D3EE'
}

function getNavActiveBg(href: string): string {
  if (href.startsWith('/snow'))   return 'rgba(139,92,246,0.1)'
  if (href.startsWith('/trail'))  return 'rgba(16,185,129,0.1)'
  return 'rgba(6,182,212,0.1)'
}

function getNavActiveBorder(href: string): string {
  if (href.startsWith('/snow'))   return 'rgba(139,92,246,0.2)'
  if (href.startsWith('/trail'))  return 'rgba(16,185,129,0.2)'
  return 'rgba(6,182,212,0.2)'
}

// ── Nav items ─────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { href: '/home',     icon: Home,     label: 'Home'     },
  { href: '/map',      icon: Map,      label: 'Spots'    },
  { href: '/snow',     icon: Mountain, label: 'Snow'     },
  { href: '/profile',  icon: User,     label: 'Me'       },
]

// Mobile bottom nav
const MOBILE_NAV = NAV_ITEMS

// ── Nav item ─────────────────────────────────────────────────────────────
function NavItem({
  href,
  icon: Icon,
  label,
  active,
  dimmed = false,
  soon = false,
}: {
  href: string
  icon: ElementType<{ className?: string; style?: CSSProperties }>
  label: string
  active: boolean
  dimmed?: boolean
  soon?: boolean
}) {
  const accent       = getNavAccent(href)
  const accentBright = getNavAccentBright(href)
  const activeBg     = getNavActiveBg(href)
  const activeBorder = getNavActiveBorder(href)

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150"
      style={
        active
          ? {
              background: activeBg,
              border: `1px solid ${activeBorder}`,
              color: accentBright,
              fontFamily: 'var(--font-display)',
            }
          : {
              color: dimmed ? 'var(--deep-text)' : 'var(--spray)',
              opacity: dimmed ? 0.75 : 1,
              border: '1px solid transparent',
            }
      }
    >
      <Icon
        className="w-4 h-4 flex-shrink-0 transition-colors"
        style={{ color: active ? accent : dimmed ? '#2E5568' : 'var(--deep-text)' }}
      />
      <span
        className="flex-1 group-hover:[color:var(--mist)] transition-colors"
        style={active ? { color: accentBright } : {}}
      >
        {label}
      </span>

      {active && (
        <div
          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
          style={{ background: accent }}
        />
      )}

      {soon && !active && (
        <span style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 8,
          fontWeight: 600,
          letterSpacing: '0.08em',
          color: '#92703A',
          background: 'rgba(245,158,11,0.12)',
          border: '1px solid rgba(245,158,11,0.2)',
          borderRadius: 4,
          padding: '1px 5px',
        }}>
          SOON
        </span>
      )}
    </Link>
  )
}

// ── Layout ────────────────────────────────────────────────────────────────
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [isLight, setIsLight] = useState(false)

  // Read persisted theme preference on mount
  useEffect(() => {
    const saved = localStorage.getItem('terrain_theme')
    const light = saved === 'light'
    setIsLight(light)
    document.documentElement.classList.toggle('light', light)
  }, [])

  function toggleTheme() {
    const next = !isLight
    setIsLight(next)
    document.documentElement.classList.toggle('light', next)
    localStorage.setItem('terrain_theme', next ? 'light' : 'dark')
  }

  function isActive(href: string) {
    if (href === '/home') return pathname === '/home'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <LocationProvider>
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--deep)' }}>

      {/* ── Desktop Sidebar ─────────────────────────────────────────── */}
      <aside
        className="hidden md:flex w-[220px] flex-shrink-0 flex-col"
        style={{
          background: 'rgba(6, 13, 26, 0.97)',
          borderRight: '1px solid rgba(6,182,212,0.1)',
          backdropFilter: 'blur(24px)',
        }}
      >

        {/* Logo */}
        <Link
          href="/home"
          className="flex items-center gap-3 px-5 py-5 hover:opacity-90 transition-opacity"
          style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}
        >
          {/* Mountain + Wave mark */}
          <div style={{
            background: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 60%, #10B981 100%)',
            boxShadow: '0 4px 16px rgba(139,92,246,0.35)',
            width: 32,
            height: 32,
            borderRadius: 10,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              {/* Mountain body */}
              <path
                d="M12 3L20 18H4L12 3Z"
                fill="rgba(255,255,255,0.15)"
                stroke="white"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              {/* Snow cap */}
              <path d="M12 3L15 9H9L12 3Z" fill="white" />
              {/* Wave at base */}
              <path
                d="M2 20C5 17 8 17 12 19C16 21 19 19 22 16"
                stroke="rgba(255,255,255,0.6)"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* Wordmark */}
          <div className="flex-1 min-w-0">
            <span style={{
              fontFamily: 'var(--font-display)',
              fontSize: 17,
              fontWeight: 800,
              color: 'var(--foam)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
            }}>
              nSwell
            </span>
          </div>

          {/* Live dot */}
          <div
            className="w-1.5 h-1.5 rounded-full animate-bio-pulse flex-shrink-0"
            style={{ background: 'var(--cyan)' }}
          />
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-3 overflow-y-auto">

          {/* Global Search */}
          <div style={{ marginBottom: 4 }}>
            <GlobalSearch />
          </div>

          {/* Nav items */}
          <div className="space-y-0.5 mt-1">
            {NAV_ITEMS.map(({ href, icon, label }) => (
              <NavItem
                key={href}
                href={href}
                icon={icon}
                label={label}
                active={isActive(href)}
              />
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(6,182,212,0.07)' }}>
          {/* Theme toggle */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
            <button
              onClick={toggleTheme}
              title={isLight ? 'Switch to dark mode' : 'Switch to light mode'}
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                border: '1px solid rgba(6,182,212,0.15)',
                background: 'rgba(6,182,212,0.06)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                lineHeight: 1,
                transition: 'background 0.15s, border-color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'rgba(6,182,212,0.14)'
                e.currentTarget.style.borderColor = 'rgba(6,182,212,0.35)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(6,182,212,0.06)'
                e.currentTarget.style.borderColor = 'rgba(6,182,212,0.15)'
              }}
            >
              {isLight ? '🌙' : '☀️'}
            </button>
          </div>
          <SidebarAuthButton />
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Nav (5 core items only) ───────────────────── */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-50 flex"
        style={{
          background: 'rgba(6, 13, 26, 0.98)',
          borderTop: '1px solid rgba(6,182,212,0.12)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
        }}
      >
        {MOBILE_NAV.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          const accent = getNavAccent(href)
          return (
            <Link
              key={href}
              href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                color: active ? accent : 'var(--deep-text)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {active && (
                <div
                  className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-b-full"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  }}
                />
              )}
              <Icon
                className="w-5 h-5"
                style={{
                  color: active ? accent : 'var(--deep-text)',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                  transition: 'transform 0.15s',
                }}
              />
              {label}
            </Link>
          )
        })}
      </nav>
      <LocationPermissionPrompt />
    </div>
    </LocationProvider>
  )
}
