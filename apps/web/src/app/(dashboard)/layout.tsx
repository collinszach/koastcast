'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

const NAV_ITEMS = [
  { href: '/dashboard', icon: '🏠', label: 'Home'     },
  { href: '/map',       icon: '🗺️', label: 'Map'      },
  { href: '/sessions',  icon: '📓', label: 'Sessions' },
  { href: '/profile',   icon: '👤', label: 'Profile'  },
]

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--ocean-deep, #020b18)' }}>
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-slate-800/60"
             style={{ background: 'var(--ocean-mid, #0c1a2e)' }}>

        {/* Logo */}
        <Link href="/dashboard" className="flex items-center gap-3 px-5 py-5 border-b border-slate-800/60 hover:opacity-90 transition-opacity">
          <div className="w-9 h-9 rounded-xl bg-sky-500/15 border border-sky-500/30 flex items-center justify-center text-xl">
            🌊
          </div>
          <div>
            <span className="text-lg font-black text-white tracking-tight">Swell</span>
            <span className="text-lg font-black text-sky-400 tracking-tight">Stack</span>
          </div>
        </Link>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ href, icon, label }) => {
            const active = isActive(href)
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? 'bg-sky-500/15 text-sky-300 border border-sky-500/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50'
                }`}>
                <span className="text-lg w-6 text-center">{icon}</span>
                {label}
                {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-sky-400" />}
              </Link>
            )
          })}

          <div className="pt-3 border-t border-slate-800/60 mt-3">
            <Link href="/upgrade"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/20">
              <span className="text-lg w-6 text-center">⚡</span>
              Pro
            </Link>
            <Link href="/spots/submit"
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-500 hover:text-slate-300 hover:bg-slate-800/50 transition-all">
              <span className="text-lg w-6 text-center">📍</span>
              Submit Spot
            </Link>
          </div>
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800/60">
          <Link href="/admin"
            className="flex items-center gap-3 px-4 py-2 rounded-xl text-xs text-slate-600 hover:text-slate-400 transition-colors">
            <span>🔧</span>
            Admin
          </Link>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto pb-16 md:pb-0">
        {children}
      </main>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex border-t border-slate-800/80"
           style={{ background: 'rgba(12,26,46,0.97)', backdropFilter: 'blur(20px)' }}>
        {NAV_ITEMS.map(({ href, icon, label }) => {
          const active = isActive(href)
          return (
            <Link key={href} href={href}
              className={`relative flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-semibold transition-all ${
                active ? 'text-sky-400' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-sky-400 rounded-b-full" />
              )}
              <span className={`text-2xl leading-tight transition-transform ${active ? 'scale-110' : ''}`}>
                {icon}
              </span>
              {label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
