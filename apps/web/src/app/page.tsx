import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────
   Koastcast — Marketing Homepage
   Aesthetic: warm-paper surf-report utility. Flat tiles, bold Archivo
   type, real numbers carrying the page — no gradient blobs, no glow.
   ───────────────────────────────────────────────────────────────── */

const TICKER_SPOTS = [
  { name: 'Mavericks',     height: '14–18ft', period: '18s', condition: 'FIRING',   score: 92 },
  { name: 'Steamer Lane',  height: '6–8ft',   period: '14s', condition: 'PUMPING',  score: 78 },
  { name: 'Rincon',        height: '4–5ft',   period: '16s', condition: 'FUN',      score: 65 },
  { name: 'Trestles',      height: '3–4ft',   period: '12s', condition: 'WORTH IT', score: 51 },
  { name: 'Ocean Beach',   height: '8–10ft',  period: '15s', condition: 'PUMPING',  score: 81 },
  { name: 'Blacks Beach',  height: '4–6ft',   period: '13s', condition: 'FUN',      score: 68 },
  { name: 'Pipeline',      height: '10–12ft', period: '17s', condition: 'FIRING',   score: 95 },
  { name: 'Montauk',       height: '2–3ft',   period: '9s',  condition: 'WORTH IT', score: 42 },
]

const CONDITION_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  FIRING:     { text: 'var(--q-firing)',  bg: 'rgba(234,88,12,0.1)',  border: 'rgba(234,88,12,0.3)'  },
  PUMPING:    { text: 'var(--q-pumping)', bg: 'rgba(8,145,178,0.1)',  border: 'rgba(8,145,178,0.3)'  },
  FUN:        { text: 'var(--q-good)',    bg: 'rgba(37,99,235,0.1)',  border: 'rgba(37,99,235,0.3)'  },
  'WORTH IT': { text: 'var(--q-ok)',      bg: 'rgba(79,70,229,0.1)',  border: 'rgba(79,70,229,0.3)'  },
  FLAT:       { text: 'var(--q-flat)',    bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
}

// Spectrum bars for the spectral analysis feature card
const SPECTRUM_BARS = [
  3, 8, 18, 42, 76, 95, 88, 71, 52, 38, 28, 20, 14, 10, 7, 5,
].map((h, i) => ({ h, delay: i * 0.04 }))

export default function HomePage() {
  const tickerItems = [...TICKER_SPOTS, ...TICKER_SPOTS]

  return (
    <>
      <style>{`
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes badgeFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
        @keyframes bioPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to   { transform: scaleY(1); opacity: 1; }
        }
        @keyframes ringDraw {
          from { stroke-dashoffset: 283; }
          to   { stroke-dashoffset: 58; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes waveDrift {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50%       { transform: translateX(-2.5%) scaleY(1.04); }
        }

        .hero-line-1 { animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.1s both; }
        .hero-line-2 { animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.2s both; }
        .hero-line-3 { animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .hero-ctas   { animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.4s both; }
        .hero-badges { animation: heroFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) 0.5s both; }

        .ticker-track { animation: ticker 40s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }

        .badge-float-1 { animation: badgeFloat 4s ease-in-out infinite; }
        .badge-float-2 { animation: badgeFloat 5s ease-in-out 1s infinite; }
        .badge-float-3 { animation: badgeFloat 3.5s ease-in-out 0.5s infinite; }
        .live-dot      { animation: bioPulse 2s ease-in-out infinite; }

        .hero-wave { animation: waveDrift 12s ease-in-out infinite; transform-origin: center bottom; }

        .spec-bar {
          transform-origin: bottom;
          transform: scaleY(0);
          animation: barGrow 0.6s cubic-bezier(0.34,1.56,0.64,1) var(--delay) forwards;
        }
        .stoke-arc {
          stroke-dasharray: 283;
          stroke-dashoffset: 283;
          animation: ringDraw 1.6s cubic-bezier(0.16,1,0.3,1) 0.4s forwards;
        }

        .nav-link {
          color: var(--spray);
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 0.15s;
        }
        .nav-link:hover { color: var(--foam); }

        .feature-card {
          background: var(--tile-bg);
          border: 1px solid var(--tile-border);
          border-radius: 16px;
          padding: 36px;
          box-shadow: var(--tile-shadow);
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .feature-card:hover {
          border-color: var(--tile-border-strong);
        }

        .pricing-card {
          background: var(--tile-bg);
          border: 1px solid var(--tile-border);
          border-radius: 16px;
          padding: 40px 36px;
          box-shadow: var(--tile-shadow);
        }
        .pricing-card.featured {
          border: 2px solid var(--cyan);
        }

        .check-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--mist);
          font-size: 14px;
          line-height: 1.5;
        }
        .check-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--cyan-muted);
          border: 1px solid rgba(14,165,233,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 10px;
          color: var(--cyan-bright);
        }

        .stat-num {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(40px, 6vw, 72px);
          color: var(--foam);
          letter-spacing: -0.03em;
          line-height: 1;
          animation: countUp 0.8s cubic-bezier(0.16,1,0.3,1) var(--delay) both;
        }

        .optimal-bar {
          height: 28px;
          border-radius: 6px;
          background: var(--paper-sunken);
          border: 1px solid var(--tile-border);
          position: relative;
          overflow: hidden;
        }
        .optimal-bar-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          border-radius: 6px;
          transition: width 0.6s ease;
        }
        .optimal-bar-text {
          position: absolute;
          left: 10px; top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-data);
          font-size: 11px;
          color: var(--foam);
          letter-spacing: 0.04em;
        }
        .optimal-bar-score {
          position: absolute;
          right: 10px; top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-data);
          font-size: 11px;
          color: var(--cyan-bright);
        }

        @media (max-width: 768px) {
          .hero-title { font-size: clamp(44px, 14vw, 96px) !important; }
          .hero-badges-wrap { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
        }
      `}</style>

      <div style={{ background: 'var(--paper)', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ──────────────────────────────────────────────
            NAV
            ────────────────────────────────────────────── */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: 64,
          background: 'var(--paper-raised)',
          borderBottom: '1px solid var(--tile-border)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'var(--cyan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 10 C3 7, 5 11, 8 8 C11 5, 13 9, 15 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                <path d="M1 13 C3 10, 5 14, 8 11 C11 8, 13 12, 15 9" stroke="rgba(255,255,255,0.6)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 17,
              color: 'var(--foam)',
              letterSpacing: '-0.01em',
            }}>Koastcast</span>
          </div>

          {/* Nav links */}
          <div className="nav-links" style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How It Works</a>
            <a href="#pricing" className="nav-link">Pricing</a>
          </div>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <Link href="/auth/login" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 600,
              fontSize: 13,
              color: 'var(--spray)',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>Log in</Link>
            <Link href="/map" className="btn-ocean" style={{
              fontSize: 13,
              padding: '8px 20px',
              textDecoration: 'none',
              display: 'inline-block',
            }}>Try Free</Link>
          </div>
        </nav>

        {/* ──────────────────────────────────────────────
            HERO — flat sky/sea split (.horizon motif),
            no radial glows, no gradient text-fill
            ────────────────────────────────────────────── */}
        <section className="relative horizon hero-pumping" style={{
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          paddingTop: 64,
          overflow: 'hidden',
        }}>
          {/* Fine dot grid texture — same convention as spot-detail hero */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]"
               style={{ backgroundImage: `radial-gradient(circle, rgba(18,24,31,0.8) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

          {/* Sea band — flat lower half, distinguishes sky/sea like the horizon motif */}
          <div className="absolute left-0 right-0 bottom-0 pointer-events-none"
               style={{ height: '38%', background: 'var(--paper-sunken)', borderTop: '1px solid var(--tile-border)' }} />

          {/* Foam line drawn just above the sea band */}
          <div className="absolute left-0 right-0 pointer-events-none hero-wave" style={{ bottom: '38%', height: 8 }}>
            <svg viewBox="0 0 1440 16" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <path d="M0,8 C160,2 320,14 520,7 C720,1 920,14 1120,7 C1280,2 1380,10 1440,7"
                    stroke="var(--cyan-dim)" strokeWidth="1.5" fill="none" opacity="0.5" />
            </svg>
          </div>

          {/* Live data badges — flat stat tiles, not glow cards */}
          <div className="hero-badges hero-badges-wrap" style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          }}>
            {/* Left badge — Mavericks */}
            <div className="badge-float-1 tile" style={{
              position: 'absolute', left: '8%', top: '22%',
              padding: '12px 16px',
              minWidth: 160,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>NDBC 46026</span>
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, fontWeight: 700, color: 'var(--foam)', lineHeight: 1 }}>14.2<span style={{ fontSize: 12, color: 'var(--spray)', marginLeft: 2 }}>ft</span></div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--cyan-bright)', marginTop: 2 }}>18s @ 298°</div>
            </div>

            {/* Right badge — live quality */}
            <div className="badge-float-2 tile" style={{
              position: 'absolute', right: '8%', top: '26%',
              padding: '12px 16px',
              borderColor: 'rgba(234,88,12,0.3)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--q-firing)', animation: 'bioPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', letterSpacing: '0.08em' }}>MAVERICKS</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: 'var(--q-firing)', letterSpacing: '0.04em' }}>🔥 FIRING</div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--mist)', marginTop: 3 }}>Peak Score™ <span style={{ color: 'var(--q-firing)' }}>94</span></div>
            </div>

            {/* Bottom left — model confidence */}
            <div className="badge-float-3 tile" style={{
              position: 'absolute', left: '14%', bottom: '16%',
              padding: '10px 14px',
            }}>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)', letterSpacing: '0.06em', marginBottom: 4 }}>ENSEMBLE CONFIDENCE</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                {[65,80,90,87,75,60,45].map((h, i) => (
                  <div key={i} style={{ width: 6, background: `rgba(14,165,233,${0.3 + h/200})`, borderRadius: 2, height: h/8 }} />
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--cyan-bright)', marginTop: 3 }}>87% · 7-day window</div>
            </div>
          </div>

          {/* Hero content */}
          <div style={{ position: 'relative', zIndex: 3, padding: '0 24px', maxWidth: 900, width: '100%', margin: '0 auto', textAlign: 'center' }}>
            {/* Eyebrow */}
            <div className="hero-line-1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'var(--cyan-muted)',
              border: '1px solid rgba(14,165,233,0.25)',
              borderRadius: 100, padding: '6px 14px',
              marginBottom: 28,
            }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)' }} />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--cyan-bright)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Live · 10 Spots Tracked · AI-Powered
              </span>
            </div>

            {/* Main headline — solid ink color, no gradient text-fill */}
            <h1 className="hero-title" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(52px, 9vw, 100px)',
              lineHeight: 0.98,
              letterSpacing: '-0.04em',
              color: 'var(--foam)',
              margin: 0,
              marginBottom: 10,
            }}>
              <span className="hero-line-2" style={{ display: 'block' }}>KNOW THE</span>
              <span className="hero-line-3" style={{ display: 'block', color: 'var(--cyan-bright)' }}>OCEAN.</span>
            </h1>

            {/* Subheadline */}
            <p className="hero-ctas" style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(15px, 2.2vw, 19px)',
              color: 'var(--mist)',
              maxWidth: 560,
              margin: '0 auto 40px',
              lineHeight: 1.65,
            }}>
              AI-powered surf forecasts with full spectral wave analysis, personalized{' '}
              <span style={{ color: 'var(--cyan-bright)', fontWeight: 600 }}>Peak Score™</span>, and 16-day windows.
              Built for surfers who take the ocean seriously.
            </p>

            {/* CTAs */}
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/map" className="btn-ocean" style={{
                fontSize: 15,
                padding: '16px 36px',
                textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                See Live Conditions
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link href="/auth/login" style={{
                background: 'var(--tile-bg)',
                color: 'var(--mist)',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '16px 36px',
                borderRadius: 14,
                textDecoration: 'none',
                border: '1px solid var(--tile-border-strong)',
              }}>
                Create Free Account
              </Link>
            </div>

            {/* Micro trust signals */}
            <div className="hero-badges" style={{
              display: 'flex', gap: 24, justifyContent: 'center',
              marginTop: 32, alignItems: 'center',
              fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--spray)',
            }}>
              <span>✓ No credit card</span>
              <span style={{ color: 'var(--deep-text)' }}>·</span>
              <span>✓ Free forever tier</span>
              <span style={{ color: 'var(--deep-text)' }}>·</span>
              <span>✓ NOAA data · Open-source models</span>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            LIVE CONDITIONS TICKER
            ────────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid var(--tile-border)',
          borderBottom: '1px solid var(--tile-border)',
          background: 'var(--paper-raised)',
          padding: '0',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Fade edges */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(90deg, var(--paper-raised), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(-90deg, var(--paper-raised), transparent)',
            pointerEvents: 'none',
          }} />

          <div className="ticker-track" style={{ display: 'flex', gap: 0, width: 'max-content' }}>
            {tickerItems.map((spot, i) => {
              const c = CONDITION_COLORS[spot.condition] ?? CONDITION_COLORS.FLAT
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '12px 32px',
                  borderRight: '1px solid var(--tile-border)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: 'var(--mist)',
                    letterSpacing: '0.02em',
                  }}>{spot.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 13,
                    color: 'var(--foam)',
                    fontWeight: 600,
                  }}>{spot.height}</span>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: 'var(--spray)',
                  }}>{spot.period}</span>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 10,
                    letterSpacing: '0.1em',
                    color: c.text,
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    borderRadius: 6,
                    padding: '2px 8px',
                  }}>{spot.condition}</span>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 12,
                    color: 'var(--cyan-bright)',
                    opacity: 0.85,
                  }}>{spot.score}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ──────────────────────────────────────────────
            FEATURES
            ────────────────────────────────────────────── */}
        <section id="features" style={{ padding: 'clamp(80px, 12vw, 140px) clamp(20px, 5vw, 80px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>

            {/* Section header */}
            <div style={{ textAlign: 'center', marginBottom: 64 }}>
              <div style={{
                display: 'inline-block',
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--cyan-bright)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: 16,
                background: 'var(--cyan-muted)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: 100,
                padding: '5px 14px',
              }}>Intelligence Layer</div>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(36px, 5vw, 58px)',
                color: 'var(--foam)',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                margin: '0 0 16px',
              }}>
                Not just a forecast.<br />
                <span style={{ color: 'var(--cyan-bright)' }}>A system.</span>
              </h2>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 17,
                color: 'var(--spray)',
                maxWidth: 520,
                margin: '0 auto',
                lineHeight: 1.65,
              }}>
                Six layers of analysis that Surfline doesn't touch.
                Each one tuned to your break, your board, your style.
              </p>
            </div>

            {/* Feature grid — 3 cards */}
            <div className="features-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
              marginBottom: 20,
            }}>

              {/* ── Card 1: Spectral Analysis ── */}
              <div className="feature-card">
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--cyan-muted)', border: '1px solid rgba(14,165,233,0.25)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="4" width="2" height="7" rx="1" fill="var(--cyan-bright)"/>
                      <rect x="4" y="2" width="2" height="9" rx="1" fill="var(--cyan-bright)" opacity="0.7"/>
                      <rect x="7" y="0" width="2" height="11" rx="1" fill="var(--cyan-bright)"/>
                      <rect x="10" y="3" width="2" height="8" rx="1" fill="var(--cyan-bright)" opacity="0.6"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--cyan-bright)', letterSpacing: '0.1em' }}>SPECTRAL ANALYSIS</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: 'var(--foam)', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Full Spectral<br />Wave Model</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)', lineHeight: 1.65, margin: 0 }}>
                    48 frequency bands of real energy density — not just Hs and Tp. See exactly which swells are stacking and which will cancel.
                  </p>
                </div>

                {/* Mini spectrum visualization */}
                <div style={{
                  background: 'var(--paper-sunken)',
                  border: '1px solid var(--tile-border)',
                  borderRadius: 12, padding: '16px 14px',
                }}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', marginBottom: 8, letterSpacing: '0.08em' }}>
                    ENERGY DENSITY (m²/Hz) · 46026 · NOW
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 56 }}>
                    {SPECTRUM_BARS.map((bar, i) => {
                      const intensity = bar.h / 100
                      return (
                        <div
                          key={i}
                          className="spec-bar"
                          style={{
                            flex: 1,
                            height: `${bar.h}%`,
                            background: `rgba(14,165,233,${0.35 + intensity * 0.55})`,
                            borderRadius: '2px 2px 0 0',
                            '--delay': `${bar.delay}s`,
                          } as React.CSSProperties}
                        />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)' }}>0.05Hz</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--cyan-bright)' }}>peak: 0.10 Hz · 10s</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)' }}>0.40Hz</span>
                  </div>
                </div>
              </div>

              {/* ── Card 2: Peak Score ── */}
              <div className="feature-card">
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(234,88,12,0.08)', border: '1px solid rgba(234,88,12,0.2)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="var(--q-firing)">
                      <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9.2,11 6,9.3 2.8,11 3.5,7.5 1,5 4.5,4.5" fill="var(--q-firing)"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--q-firing)', letterSpacing: '0.1em' }}>STOKE SCORE™</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: 'var(--foam)', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Personalized<br />for Your Style</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)', lineHeight: 1.65, margin: 0 }}>
                    A 0–100 score tuned to your board, skill level, and tolerance for crowds. Not Surfline's generic star rating.
                  </p>
                </div>

                {/* Stoke ring visualization */}
                <div style={{
                  background: 'var(--paper-sunken)',
                  border: '1px solid var(--tile-border)',
                  borderRadius: 12, padding: '16px 14px',
                  display: 'flex', alignItems: 'center', gap: 20,
                }}>
                  {/* Ring gauge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <svg width="80" height="80" viewBox="0 0 100 100">
                      {/* Track */}
                      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(234,88,12,0.12)" strokeWidth="8"/>
                      {/* Fill arc */}
                      <circle
                        className="stoke-arc"
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke="var(--q-firing)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                      <text x="50" y="46" textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fill: 'var(--foam)', fontWeight: 800 }}>92</text>
                      <text x="50" y="60" textAnchor="middle" style={{ fontFamily: 'var(--font-data)', fontSize: 8, fill: 'var(--spray)', letterSpacing: '0.1em' }}>STOKE</text>
                    </svg>
                  </div>
                  {/* Component breakdown */}
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Height',    val: 88, color: 'var(--cyan-bright)' },
                      { label: 'Period',    val: 95, color: 'var(--cyan-dim)' },
                      { label: 'Direction', val: 100, color: 'var(--q-firing)' },
                      { label: 'Wind',      val: 78, color: 'var(--trail)' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--spray)' }}>{label}</span>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color }}>{val}</span>
                        </div>
                        <div style={{ height: 3, background: 'var(--tile-border)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* ── Card 3: Optimal Windows ── */}
              <div className="feature-card">
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--trail-muted)', border: '1px solid rgba(5,150,105,0.25)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="var(--trail)" strokeWidth="1.2"/>
                      <path d="M6 3v3l2 2" stroke="var(--trail)" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--trail)', letterSpacing: '0.1em' }}>OPTIMAL WINDOWS</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: 'var(--foam)', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Best Times<br />Ranked For You</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)', lineHeight: 1.65, margin: 0 }}>
                    Compound scoring across wave quality, tide, wind, and crowd levels. Know exactly when to paddle out — 16 days out.
                  </p>
                </div>

                {/* Optimal windows visualization */}
                <div style={{
                  background: 'var(--paper-sunken)',
                  border: '1px solid var(--tile-border)',
                  borderRadius: 12, padding: '14px',
                }}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: 'var(--deep-text)', marginBottom: 10, letterSpacing: '0.08em' }}>
                    TOP WINDOWS THIS WEEK · STEAMER LANE
                  </div>
                  {[
                    { time: 'Sat 06:30', label: 'Dawn patrol', score: 94, color: 'var(--q-firing)', w: 94 },
                    { time: 'Sun 07:00', label: 'Early bird',  score: 87, color: 'var(--cyan-bright)', w: 87 },
                    { time: 'Fri 16:00', label: 'Evening push', score: 71, color: 'var(--trail)', w: 71 },
                    { time: 'Mon 08:00', label: 'Morning run',  score: 58, color: 'var(--q-ok)', w: 58 },
                  ].map(({ time, label, score, color, w }) => (
                    <div key={time} className="optimal-bar" style={{ marginBottom: 6 }}>
                      <div className="optimal-bar-fill" style={{ width: `${w}%`, background: `${color}`, opacity: 0.16, borderRight: `2px solid ${color}` }} />
                      <span className="optimal-bar-text">{time} <span style={{ color: 'var(--deep-text)' }}>·</span> {label}</span>
                      <span className="optimal-bar-score">{score}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Row 2 — 3 more features (compact) */}
            <div className="features-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 20,
            }}>
              {[
                {
                  badge: 'ML MODELS',
                  badgeColor: 'var(--q-ok)',
                  title: 'Per-Spot Bias Correction',
                  body: 'LightGBM models trained on NDBC historical data translate open-ocean buoy readings to actual face height at each break.',
                },
                {
                  badge: 'PHYSICS',
                  badgeColor: 'var(--cyan-bright)',
                  title: 'SWAN Nearshore Model',
                  body: 'DELFT3D SWAN wave physics — refraction, shoaling, and bathymetry effects modeled for selected spots. Not just offshore interpolation.',
                },
                {
                  badge: 'AI · ON-DEVICE',
                  badgeColor: 'var(--trail)',
                  title: 'Ask Stoke™ NLQ',
                  body: '"Will it be good at Mavericks Saturday morning?" On-device Phi-4-mini answers in natural language. Zero API costs.',
                },
              ].map(({ badge, badgeColor, title, body }) => (
                <div key={title} className="feature-card" style={{ padding: '28px 28px' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'var(--paper-sunken)', border: `1px solid ${badgeColor}`,
                    borderRadius: 8, padding: '4px 10px', marginBottom: 14,
                  }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: badgeColor, letterSpacing: '0.1em' }}>{badge}</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 18, color: 'var(--foam)', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>{title}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)', lineHeight: 1.65, margin: 0 }}>{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            STATS
            ────────────────────────────────────────────── */}
        <section id="how-it-works" style={{
          padding: 'clamp(60px, 10vw, 100px) clamp(20px, 5vw, 80px)',
          background: 'var(--paper-raised)',
          borderTop: '1px solid var(--tile-border)',
          borderBottom: '1px solid var(--tile-border)',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div className="stats-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 40,
            }}>
              {[
                { num: '16', unit: 'days', label: "Forecast window vs Surfline's 7", delay: '0s' },
                { num: '48', unit: 'bands', label: 'Spectral frequency bands analyzed', delay: '0.1s' },
                { num: '10', unit: 'spots', label: 'US breaks covered at launch', delay: '0.2s' },
                { num: '$0', unit: '', label: 'API cost for AI forecasts', delay: '0.3s' },
              ].map(({ num, unit, label, delay }) => (
                <div key={num + label} style={{ textAlign: 'center' }}>
                  <div>
                    <span className="stat-num" style={{ '--delay': delay } as React.CSSProperties}>{num}</span>
                    {unit && <span style={{
                      fontFamily: 'var(--font-data)',
                      fontSize: 16,
                      color: 'var(--cyan-bright)',
                      marginLeft: 4,
                    }}>{unit}</span>}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: 'var(--spray)',
                    marginTop: 8,
                    lineHeight: 1.5,
                  }}>{label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            PRICING
            ────────────────────────────────────────────── */}
        <section id="pricing" style={{ padding: 'clamp(80px, 12vw, 140px) clamp(20px, 5vw, 80px)' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 60 }}>
              <div style={{
                display: 'inline-block',
                fontFamily: 'var(--font-data)',
                fontSize: 11,
                color: 'var(--cyan-bright)',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: 16,
                background: 'var(--cyan-muted)',
                border: '1px solid rgba(14,165,233,0.2)',
                borderRadius: 100,
                padding: '5px 14px',
              }}>Pricing</div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 'clamp(32px, 5vw, 52px)',
                color: 'var(--foam)', letterSpacing: '-0.03em', lineHeight: 1.05,
                margin: '0 0 12px',
              }}>
                Start free.<br />Go pro when you're ready.
              </h2>
            </div>

            <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Free */}
              <div className="pricing-card">
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--foam)', marginBottom: 4 }}>Free</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42, color: 'var(--foam)' }}>$0</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--spray)' }}>/mo forever</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)' }}>Good enough to get addicted.</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {['7-day forecast window', '10 spots, live conditions', 'Interactive spot map', '3 saved spots', 'Session logging'].map(f => (
                    <div key={f} className="check-item">
                      <div className="check-icon">✓</div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/auth/login" style={{
                  display: 'block', textAlign: 'center',
                  background: 'var(--cyan-muted)',
                  border: '1px solid rgba(14,165,233,0.25)',
                  color: 'var(--cyan-bright)',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '14px 24px', borderRadius: 12, textDecoration: 'none',
                }}>Start Free</Link>
              </div>

              {/* Pro */}
              <div className="pricing-card featured">
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28,
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: 'var(--foam)', marginBottom: 4 }}>Pro</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42, color: 'var(--foam)' }}>$9</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: 'var(--spray)' }}>/mo</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: 'var(--spray)' }}>For surfers who take it seriously.</div>
                  </div>
                  <div style={{
                    background: 'var(--cyan-muted)',
                    border: '1px solid rgba(14,165,233,0.3)',
                    borderRadius: 8, padding: '4px 10px',
                    fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--cyan-bright)',
                    letterSpacing: '0.08em', whiteSpace: 'nowrap',
                  }}>MOST POPULAR</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
                  {[
                    '16-day forecast window',
                    'Peak Score™ personalized',
                    'Optimal session windows',
                    'Full spectral wave analysis',
                    'Crowd prediction layer',
                    '20 saved spots',
                    '10 NLQ queries/day',
                  ].map(f => (
                    <div key={f} className="check-item">
                      <div className="check-icon" style={{ background: 'var(--cyan-muted)', borderColor: 'rgba(14,165,233,0.45)' }}>✓</div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/auth/login" className="btn-ocean" style={{
                  display: 'block', textAlign: 'center',
                  fontSize: 14,
                  padding: '14px 24px',
                  textDecoration: 'none',
                }}>Start 14-Day Trial</Link>
              </div>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            FINAL CTA
            ────────────────────────────────────────────── */}
        <section style={{
          padding: 'clamp(80px, 12vw, 120px) clamp(20px, 5vw, 80px)',
          textAlign: 'center',
          borderTop: '1px solid var(--tile-border)',
          background: 'var(--paper-raised)',
        }}>
          <div style={{ maxWidth: 680, margin: '0 auto' }}>
            <div style={{
              fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--cyan-bright)',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              marginBottom: 20,
            }}>The ocean doesn't wait</div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(36px, 6vw, 64px)',
              color: 'var(--foam)', letterSpacing: '-0.03em', lineHeight: 1.0,
              margin: '0 0 20px',
            }}>
              Stop guessing.<br />
              <span style={{ color: 'var(--cyan-bright)' }}>Start knowing.</span>
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 17, color: 'var(--spray)',
              maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.65,
            }}>
              Join surfers using AI and real spectral data to score better sessions.
              Free forever, no card required.
            </p>
            <Link href="/map" className="btn-ocean" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              fontSize: 16,
              padding: '18px 48px',
              borderRadius: 16,
              textDecoration: 'none',
            }}>
              Open the App — It's Free
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9h12M9 3l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            FOOTER
            ────────────────────────────────────────────── */}
        <footer style={{
          padding: '40px clamp(20px, 5vw, 80px)',
          borderTop: '1px solid var(--tile-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'var(--cyan)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M1 10 C3 7, 5 11, 8 8 C11 5, 13 9, 15 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--foam)' }}>Koastcast</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)', marginLeft: 8 }}>
              Powered by NOAA · Open-Meteo · ECMWF
            </span>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {['Dashboard', 'Login', 'Spots', 'API'].map(label => (
              <Link key={label} href={label === 'Dashboard' ? '/map' : label === 'Login' ? '/auth/login' : label === 'Spots' ? '/map' : '/api-portal'}
                style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: 'var(--deep-text)', textDecoration: 'none', letterSpacing: '0.06em', transition: 'color 0.15s' }}
              >{label}</Link>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)' }}>
            © 2025 Koastcast · MIT License
          </div>
        </footer>

      </div>
    </>
  )
}
