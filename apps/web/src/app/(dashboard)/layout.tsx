'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { Map, BookOpen, User, Zap, MapPin, Settings } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/map',      icon: Map,      label: 'Spots'    },
  { href: '/sessions', icon: BookOpen, label: 'Sessions' },
  { href: '/profile',  icon: User,     label: 'Profile'  },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--deep)' }}>

      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-[220px] flex-shrink-0 flex-col"
             style={{
               background: 'rgba(6, 13, 26, 0.97)',
               borderRight: '1px solid rgba(6,182,212,0.1)',
               backdropFilter: 'blur(24px)',
             }}>

        {/* Logo */}
        <Link href="/map"
          className="flex items-center gap-3 px-5 py-5 hover:opacity-90 transition-opacity group"
          style={{ borderBottom: '1px solid rgba(6,182,212,0.08)' }}>
          {/* Wave mark */}
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 relative"
               style={{
                 background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                 boxShadow: '0 4px 16px rgba(6,182,212,0.4)',
               }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M2 12C5 8 8 6 12 8C16 10 19 8 22 4" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M2 18C5 14 8 12 12 14C16 16 19 14 22 10" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-0.5">
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--foam)', letterSpacing: '-0.03em' }}>Swell</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--cyan)', letterSpacing: '-0.03em' }}>Stack</span>
            </div>
          </div>
          {/* Live indicator */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-1.5 h-1.5 rounded-full animate-bio-pulse" style={{ background: 'var(--cyan)' }} />
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto pt-4">
          {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all duration-150 ${
                  active ? 'nav-active' : ''
                }`}
                style={active
                  ? { fontFamily: 'var(--font-display)', color: 'var(--cyan-bright)' }
                  : { color: 'var(--spray)' }
                }
              >
                <Icon className={`w-4 h-4 flex-shrink-0 transition-colors ${
                  active ? '' : 'group-hover:opacity-80'
                }`}
                style={{ color: active ? 'var(--cyan)' : 'var(--deep-text)' }} />
                <span style={active ? {} : { transition: 'color 0.15s' }}
                  className="group-hover:[color:var(--mist)]">
                  {label}
                </span>
                {active && (
                  <div className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0"
                       style={{ background: 'var(--cyan)' }} />
                )}
              </Link>
            )
          })}

          <div className="pt-3 mt-2 space-y-0.5" style={{ borderTop: '1px solid rgba(6,182,212,0.07)' }}>
            <Link href="/upgrade"
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all"
              style={{ color: '#FCD34D' }}>
              <Zap className="w-4 h-4 flex-shrink-0" style={{ color: '#F59E0B' }} />
              <span>Upgrade</span>
            </Link>
            <Link href="/spots/submit"
              className="group flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] transition-all"
              style={{ color: 'var(--deep-text)' }}>
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--deep-text)' }} />
              <span className="group-hover:[color:var(--spray)] transition-colors">Submit Spot</span>
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3" style={{ borderTop: '1px solid rgba(6,182,212,0.07)' }}>
          <Link href="/admin"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs transition-colors"
            style={{ color: 'var(--deep-text)' }}>
            <Settings className="w-3.5 h-3.5" />
            Admin
          </Link>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex"
           style={{
             background: 'rgba(6, 13, 26, 0.98)',
             borderTop: '1px solid rgba(6,182,212,0.12)',
             backdropFilter: 'blur(24px)',
             WebkitBackdropFilter: 'blur(24px)',
           }}>
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className="relative flex-1 flex flex-col items-center justify-center gap-1 py-3 text-[10px] font-semibold transition-all"
              style={{
                fontFamily: 'var(--font-display)',
                color: active ? 'var(--cyan)' : 'var(--deep-text)',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[2px] rounded-b-full"
                     style={{ background: 'linear-gradient(90deg, transparent, var(--cyan), transparent)' }} />
              )}
              <Icon className="w-5 h-5" style={{ color: active ? 'var(--cyan)' : 'var(--deep-text)', transform: active ? 'scale(1.1)' : 'scale(1)', transition: 'transform 0.15s' }} />
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
