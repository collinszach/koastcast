import Link from 'next/link'

/* ─────────────────────────────────────────────────────────────────
   nSwell — Marketing Homepage
   Aesthetic: Deep-ocean data intelligence. Cinematic dark, cyan bioluminescent.
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
  FIRING:   { text: '#FB923C', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.3)'  },
  PUMPING:  { text: '#22D3EE', bg: 'rgba(34,211,238,0.12)',  border: 'rgba(34,211,238,0.3)'  },
  FUN:      { text: '#34D399', bg: 'rgba(52,211,153,0.12)',  border: 'rgba(52,211,153,0.3)'  },
  'WORTH IT': { text: '#818CF8', bg: 'rgba(129,140,248,0.12)', border: 'rgba(129,140,248,0.3)' },
  FLAT:     { text: '#64748B', bg: 'rgba(100,116,139,0.1)',  border: 'rgba(100,116,139,0.2)' },
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
        @keyframes waveFloat1 {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50%       { transform: translateX(-2%) scaleY(1.06); }
        }
        @keyframes waveFloat2 {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50%       { transform: translateX(2.5%) scaleY(0.95); }
        }
        @keyframes waveFloat3 {
          0%, 100% { transform: translateX(0) scaleY(1); }
          50%       { transform: translateX(-1.5%) scaleY(1.03); }
        }
        @keyframes ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes orbPulse {
          0%, 100% { opacity: 0.5; transform: translateX(-50%) scale(1); }
          50%       { opacity: 0.8; transform: translateX(-50%) scale(1.08); }
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
          0%, 100% { box-shadow: 0 0 0 0 rgba(6,182,212,0.6); }
          50%       { box-shadow: 0 0 0 8px rgba(6,182,212,0); }
        }
        @keyframes barGrow {
          from { transform: scaleY(0); opacity: 0; }
          to   { transform: scaleY(1); opacity: 1; }
        }
        @keyframes ringDraw {
          from { stroke-dashoffset: 283; }
          to   { stroke-dashoffset: 58; }
        }
        @keyframes scanLine {
          0%   { top: 0; opacity: 0.8; }
          100% { top: 100%; opacity: 0; }
        }
        @keyframes gridFade {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes countUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .hero-line-1 { animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        .hero-line-2 { animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.3s both; }
        .hero-line-3 { animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.45s both; }
        .hero-ctas   { animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.6s both; }
        .hero-badges { animation: heroFadeUp 0.9s cubic-bezier(0.16,1,0.3,1) 0.75s both; }

        .wave-1 { animation: waveFloat1 14s ease-in-out infinite; transform-origin: center bottom; }
        .wave-2 { animation: waveFloat2 10s ease-in-out infinite; transform-origin: center bottom; }
        .wave-3 { animation: waveFloat3 17s ease-in-out infinite; transform-origin: center bottom; }

        .orb { animation: orbPulse 6s ease-in-out infinite; }

        .ticker-track { animation: ticker 40s linear infinite; }
        .ticker-track:hover { animation-play-state: paused; }

        .badge-float-1 { animation: badgeFloat 4s ease-in-out infinite; }
        .badge-float-2 { animation: badgeFloat 5s ease-in-out 1s infinite; }
        .badge-float-3 { animation: badgeFloat 3.5s ease-in-out 0.5s infinite; }
        .live-dot      { animation: bioPulse 2s ease-in-out infinite; }

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

        .scan-line {
          position: absolute; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent);
          animation: scanLine 3s linear infinite;
        }

        .nav-link {
          color: #6B9BAD;
          font-family: var(--font-display);
          font-weight: 600;
          font-size: 12px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          text-decoration: none;
          transition: color 0.15s;
        }
        .nav-link:hover { color: #E0F7FA; }

        .feature-card {
          background: rgba(6,13,26,0.7);
          border: 1px solid rgba(6,182,212,0.1);
          border-radius: 24px;
          padding: 36px;
          position: relative;
          overflow: hidden;
          transition: border-color 0.25s, box-shadow 0.25s;
        }
        .feature-card:hover {
          border-color: rgba(6,182,212,0.22);
          box-shadow: 0 0 60px rgba(6,182,212,0.06), 0 24px 48px rgba(0,0,0,0.4);
        }
        .feature-card::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top left, rgba(6,182,212,0.04) 0%, transparent 60%);
          pointer-events: none;
        }

        .pricing-card {
          background: rgba(6,13,26,0.72);
          border: 1px solid rgba(6,182,212,0.12);
          border-radius: 24px;
          padding: 40px 36px;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .pricing-card.featured {
          border-color: rgba(6,182,212,0.35);
          box-shadow: 0 0 80px rgba(6,182,212,0.1), 0 24px 48px rgba(0,0,0,0.5);
        }
        .pricing-card:hover { transform: translateY(-4px); }

        .check-item {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #B0D4DC;
          font-size: 14px;
          line-height: 1.5;
        }
        .check-icon {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: rgba(6,182,212,0.15);
          border: 1px solid rgba(6,182,212,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          font-size: 10px;
          color: #06B6D4;
        }

        .stat-num {
          font-family: var(--font-display);
          font-weight: 800;
          font-size: clamp(40px, 6vw, 72px);
          color: #E0F7FA;
          letter-spacing: -0.03em;
          line-height: 1;
          animation: countUp 0.8s cubic-bezier(0.16,1,0.3,1) var(--delay) both;
        }

        .optimal-bar {
          height: 28px;
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(6,182,212,0.15), rgba(6,182,212,0.08));
          border: 1px solid rgba(6,182,212,0.2);
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
          color: #E0F7FA;
          letter-spacing: 0.04em;
        }
        .optimal-bar-score {
          position: absolute;
          right: 10px; top: 50%;
          transform: translateY(-50%);
          font-family: var(--font-data);
          font-size: 11px;
          color: #06B6D4;
        }

        @media (max-width: 768px) {
          .hero-title { font-size: clamp(52px, 14vw, 96px) !important; }
          .hero-badges-wrap { display: none !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .nav-links { display: none !important; }
        }
      `}</style>

      <div style={{ background: 'var(--deep)', minHeight: '100vh', overflowX: 'hidden' }}>

        {/* ──────────────────────────────────────────────
            NAV
            ────────────────────────────────────────────── */}
        <nav style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 40px', height: 64,
          background: 'rgba(6,13,26,0.85)',
          borderBottom: '1px solid rgba(6,182,212,0.08)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(6,182,212,0.4)',
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M1 10 C3 7, 5 11, 8 8 C11 5, 13 9, 15 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
                <path d="M1 13 C3 10, 5 14, 8 11 C11 8, 13 12, 15 9" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: 17,
              color: '#E0F7FA',
              letterSpacing: '-0.01em',
            }}>nSwell</span>
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
              color: '#6B9BAD',
              textDecoration: 'none',
              letterSpacing: '0.04em',
            }}>Log in</Link>
            <Link href="/map" style={{
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#060D1A',
              fontFamily: 'var(--font-display)',
              fontWeight: 700,
              fontSize: 13,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              padding: '8px 20px',
              borderRadius: 10,
              textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(6,182,212,0.35)',
              transition: 'box-shadow 0.15s',
            }}>Try Free</Link>
          </div>
        </nav>

        {/* ──────────────────────────────────────────────
            HERO
            ────────────────────────────────────────────── */}
        <section style={{
          position: 'relative',
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          overflow: 'hidden',
          paddingTop: 64,
        }}>
          {/* Grid background */}
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            backgroundImage: [
              'linear-gradient(rgba(6,182,212,0.025) 1px, transparent 1px)',
              'linear-gradient(90deg, rgba(6,182,212,0.025) 1px, transparent 1px)',
            ].join(','),
            backgroundSize: '64px 64px',
          }} />

          {/* Radial glow orb */}
          <div className="orb" style={{
            position: 'absolute',
            top: '30%',
            left: '50%',
            width: 900,
            height: 700,
            background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.09) 0%, rgba(6,182,212,0.03) 40%, transparent 70%)',
            borderRadius: '50%',
            zIndex: 0,
            pointerEvents: 'none',
          }} />

          {/* Secondary glow — warmer, lower */}
          <div style={{
            position: 'absolute',
            bottom: '10%',
            left: '30%',
            width: 600,
            height: 400,
            background: 'radial-gradient(ellipse at center, rgba(14,165,233,0.06) 0%, transparent 70%)',
            borderRadius: '50%',
            zIndex: 0,
            pointerEvents: 'none',
          }} />

          {/* Animated waves */}
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', zIndex: 1, pointerEvents: 'none' }}>
            <svg viewBox="0 0 1440 480" preserveAspectRatio="none" style={{ width: '100%', height: '100%', display: 'block' }}>
              <path className="wave-3"
                d="M0,320 C200,290 350,350 540,310 C720,270 900,330 1100,300 C1260,280 1380,320 1440,305 L1440,480 L0,480 Z"
                fill="rgba(6,182,212,0.04)"
              />
              <path className="wave-2"
                d="M0,350 C180,310 400,370 640,340 C860,310 1080,370 1280,350 C1360,342 1410,356 1440,350 L1440,480 L0,480 Z"
                fill="rgba(6,182,212,0.06)"
              />
              <path className="wave-1"
                d="M0,390 C160,365 320,400 520,380 C720,360 920,400 1120,380 C1280,365 1380,385 1440,378 L1440,480 L0,480 Z"
                fill="rgba(6,182,212,0.1)"
              />
              {/* Foam line */}
              <path
                d="M0,392 C100,385 200,395 300,390 C400,385 500,393 600,389 C700,385 800,392 900,388 C1000,384 1100,391 1200,387 C1300,383 1380,390 1440,387"
                stroke="rgba(6,182,212,0.2)" strokeWidth="1" fill="none"
              />
            </svg>
          </div>

          {/* Live buoy badges — floating */}
          <div className="hero-badges hero-badges-wrap" style={{
            position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
          }}>
            {/* Left badge — Mavericks */}
            <div className="badge-float-1" style={{
              position: 'absolute', left: '8%', top: '28%',
              background: 'rgba(6,13,26,0.85)',
              border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 14, padding: '12px 16px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              minWidth: 160,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#6B9BAD', letterSpacing: '0.08em', textTransform: 'uppercase' }}>NDBC 46026</span>
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 22, fontWeight: 700, color: '#E0F7FA', lineHeight: 1 }}>14.2<span style={{ fontSize: 12, color: '#6B9BAD', marginLeft: 2 }}>ft</span></div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#06B6D4', marginTop: 2 }}>18s @ 298°</div>
            </div>

            {/* Right badge — live quality */}
            <div className="badge-float-2" style={{
              position: 'absolute', right: '8%', top: '32%',
              background: 'rgba(6,13,26,0.85)',
              border: '1px solid rgba(251,146,60,0.25)',
              borderRadius: 14, padding: '12px 16px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#FB923C', animation: 'bioPulse 1.5s ease-in-out infinite', flexShrink: 0 }} />
                <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#6B9BAD', letterSpacing: '0.08em' }}>MAVERICKS</span>
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#FB923C', letterSpacing: '0.04em' }}>🔥 FIRING</div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#B0D4DC', marginTop: 3 }}>Peak Score™ <span style={{ color: '#FB923C' }}>94</span></div>
            </div>

            {/* Bottom left — model confidence */}
            <div className="badge-float-3" style={{
              position: 'absolute', left: '14%', bottom: '22%',
              background: 'rgba(6,13,26,0.85)',
              border: '1px solid rgba(6,182,212,0.15)',
              borderRadius: 14, padding: '10px 14px',
              backdropFilter: 'blur(12px)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            }}>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#6B9BAD', letterSpacing: '0.06em', marginBottom: 4 }}>ENSEMBLE CONFIDENCE</div>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end' }}>
                {[65,80,90,87,75,60,45].map((h, i) => (
                  <div key={i} style={{ width: 6, background: `rgba(6,182,212,${0.3 + h/200})`, borderRadius: 2, height: h/8 }} />
                ))}
              </div>
              <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#06B6D4', marginTop: 3 }}>87% · 7-day window</div>
            </div>
          </div>

          {/* Hero content */}
          <div style={{ position: 'relative', zIndex: 3, padding: '0 24px', maxWidth: 900, width: '100%' }}>
            {/* Eyebrow */}
            <div className="hero-line-1" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.2)',
              borderRadius: 100, padding: '6px 14px',
              marginBottom: 28,
            }}>
              <div className="live-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: '#06B6D4' }} />
              <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#06B6D4', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                Live · 10 Spots Tracked · AI-Powered
              </span>
            </div>

            {/* Main headline */}
            <h1 className="hero-title" style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 900,
              fontSize: 'clamp(60px, 10vw, 108px)',
              lineHeight: 0.95,
              letterSpacing: '-0.04em',
              color: '#E0F7FA',
              margin: 0,
              marginBottom: 10,
            }}>
              <span className="hero-line-2" style={{ display: 'block' }}>KNOW THE</span>
              <span className="hero-line-3" style={{
                display: 'block',
                background: 'linear-gradient(135deg, #06B6D4 0%, #67E8F9 50%, #22D3EE 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>OCEAN.</span>
            </h1>

            {/* Subheadline */}
            <p className="hero-ctas" style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'clamp(15px, 2.2vw, 19px)',
              color: '#6B9BAD',
              maxWidth: 560,
              margin: '0 auto 40px',
              lineHeight: 1.65,
            }}>
              AI-powered surf forecasts with full spectral wave analysis, personalized{' '}
              <span style={{ color: '#06B6D4' }}>Peak Score™</span>, and 16-day windows.
              Built for surfers who take the ocean seriously.
            </p>

            {/* CTAs */}
            <div className="hero-ctas" style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Link href="/map" style={{
                background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                color: '#030810',
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 15,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '16px 36px',
                borderRadius: 14,
                textDecoration: 'none',
                boxShadow: '0 8px 32px rgba(6,182,212,0.45)',
                transition: 'transform 0.15s, box-shadow 0.15s',
                display: 'inline-flex', alignItems: 'center', gap: 8,
              }}>
                See Live Conditions
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
              <Link href="/auth/login" style={{
                background: 'rgba(6,13,26,0.8)',
                color: '#B0D4DC',
                fontFamily: 'var(--font-display)',
                fontWeight: 700,
                fontSize: 15,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '16px 36px',
                borderRadius: 14,
                textDecoration: 'none',
                border: '1px solid rgba(6,182,212,0.2)',
                transition: 'border-color 0.15s, color 0.15s',
                backdropFilter: 'blur(12px)',
              }}>
                Create Free Account
              </Link>
            </div>

            {/* Micro trust signals */}
            <div className="hero-badges" style={{
              display: 'flex', gap: 24, justifyContent: 'center',
              marginTop: 32, alignItems: 'center',
              fontFamily: 'var(--font-data)', fontSize: 12, color: '#2E5568',
            }}>
              <span>✓ No credit card</span>
              <span style={{ color: '#164E63' }}>·</span>
              <span>✓ Free forever tier</span>
              <span style={{ color: '#164E63' }}>·</span>
              <span>✓ NOAA data · Open-source models</span>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────
            LIVE CONDITIONS TICKER
            ────────────────────────────────────────────── */}
        <div style={{
          borderTop: '1px solid rgba(6,182,212,0.08)',
          borderBottom: '1px solid rgba(6,182,212,0.08)',
          background: 'rgba(6,13,26,0.8)',
          padding: '0',
          overflow: 'hidden',
          position: 'relative',
          zIndex: 10,
        }}>
          {/* Fade edges */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(90deg, rgba(6,13,26,0.95), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 120, zIndex: 2,
            background: 'linear-gradient(-90deg, rgba(6,13,26,0.95), transparent)',
            pointerEvents: 'none',
          }} />

          <div className="ticker-track" style={{ display: 'flex', gap: 0, width: 'max-content' }}>
            {tickerItems.map((spot, i) => {
              const c = CONDITION_COLORS[spot.condition] ?? CONDITION_COLORS.FLAT
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  padding: '12px 32px',
                  borderRight: '1px solid rgba(6,182,212,0.06)',
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{
                    fontFamily: 'var(--font-display)',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#B0D4DC',
                    letterSpacing: '0.02em',
                  }}>{spot.name}</span>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 13,
                    color: '#E0F7FA',
                    fontWeight: 600,
                  }}>{spot.height}</span>
                  <span style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: '#6B9BAD',
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
                    color: '#06B6D4',
                    opacity: 0.7,
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
                color: '#06B6D4',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: 16,
                background: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.15)',
                borderRadius: 100,
                padding: '5px 14px',
              }}>Intelligence Layer</div>
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 'clamp(36px, 5vw, 58px)',
                color: '#E0F7FA',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                margin: '0 0 16px',
              }}>
                Not just a forecast.<br />
                <span style={{ color: '#06B6D4' }}>A system.</span>
              </h2>
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 17,
                color: '#6B9BAD',
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
                    background: 'rgba(6,182,212,0.08)', border: '1px solid rgba(6,182,212,0.18)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <rect x="1" y="4" width="2" height="7" rx="1" fill="#06B6D4"/>
                      <rect x="4" y="2" width="2" height="9" rx="1" fill="#06B6D4" opacity="0.7"/>
                      <rect x="7" y="0" width="2" height="11" rx="1" fill="#06B6D4"/>
                      <rect x="10" y="3" width="2" height="8" rx="1" fill="#06B6D4" opacity="0.6"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#06B6D4', letterSpacing: '0.1em' }}>SPECTRAL ANALYSIS</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: '#E0F7FA', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Full Spectral<br />Wave Model</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD', lineHeight: 1.65, margin: 0 }}>
                    48 frequency bands of real energy density — not just Hs and Tp. See exactly which swells are stacking and which will cancel.
                  </p>
                </div>

                {/* Mini spectrum visualization */}
                <div style={{
                  background: 'rgba(3,8,16,0.6)',
                  border: '1px solid rgba(6,182,212,0.1)',
                  borderRadius: 12, padding: '16px 14px',
                  position: 'relative', overflow: 'hidden',
                }}>
                  <div className="scan-line" style={{ position: 'absolute', left: 0, right: 0, height: 1, top: 0,
                    background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.4), transparent)',
                    animation: 'scanLine 3s linear infinite',
                  }} />
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#2E5568', marginBottom: 8, letterSpacing: '0.08em' }}>
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
                            background: `linear-gradient(to top, rgba(6,182,212,${0.3 + intensity * 0.6}), rgba(6,182,212,${0.1 + intensity * 0.3}))`,
                            borderRadius: '2px 2px 0 0',
                            '--delay': `${bar.delay}s`,
                          } as React.CSSProperties}
                        />
                      )
                    })}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#2E5568' }}>0.05Hz</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#06B6D4' }}>peak: 0.10 Hz · 10s</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#2E5568' }}>0.40Hz</span>
                  </div>
                </div>
              </div>

              {/* ── Card 2: Peak Score ── */}
              <div className="feature-card">
                <div style={{ marginBottom: 24 }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'rgba(251,146,60,0.08)', border: '1px solid rgba(251,146,60,0.18)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="#FB923C">
                      <polygon points="6,1 7.5,4.5 11,5 8.5,7.5 9.2,11 6,9.3 2.8,11 3.5,7.5 1,5 4.5,4.5" fill="#FB923C"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#FB923C', letterSpacing: '0.1em' }}>STOKE SCORE™</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: '#E0F7FA', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Personalized<br />for Your Style</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD', lineHeight: 1.65, margin: 0 }}>
                    A 0–100 score tuned to your board, skill level, and tolerance for crowds. Not Surfline's generic star rating.
                  </p>
                </div>

                {/* Stoke ring visualization */}
                <div style={{
                  background: 'rgba(3,8,16,0.6)',
                  border: '1px solid rgba(251,146,60,0.1)',
                  borderRadius: 12, padding: '16px 14px',
                  display: 'flex', alignItems: 'center', gap: 20,
                }}>
                  {/* Ring gauge */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <svg width="80" height="80" viewBox="0 0 100 100">
                      {/* Track */}
                      <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(251,146,60,0.1)" strokeWidth="8"/>
                      {/* Fill arc */}
                      <circle
                        className="stoke-arc"
                        cx="50" cy="50" r="40"
                        fill="none"
                        stroke="url(#stokeGrad)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        transform="rotate(-90 50 50)"
                      />
                      <defs>
                        <linearGradient id="stokeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#FB923C"/>
                          <stop offset="100%" stopColor="#FCD34D"/>
                        </linearGradient>
                      </defs>
                      <text x="50" y="46" textAnchor="middle" style={{ fontFamily: 'var(--font-display)', fontSize: 18, fill: '#E0F7FA', fontWeight: 800 }}>92</text>
                      <text x="50" y="60" textAnchor="middle" style={{ fontFamily: 'var(--font-data)', fontSize: 8, fill: '#6B9BAD', letterSpacing: '0.1em' }}>STOKE</text>
                    </svg>
                  </div>
                  {/* Component breakdown */}
                  <div style={{ flex: 1 }}>
                    {[
                      { label: 'Height',    val: 88, color: '#06B6D4' },
                      { label: 'Period',    val: 95, color: '#22D3EE' },
                      { label: 'Direction', val: 100, color: '#FB923C' },
                      { label: 'Wind',      val: 78, color: '#34D399' },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#6B9BAD' }}>{label}</span>
                          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color }}>{val}</span>
                        </div>
                        <div style={{ height: 3, background: 'rgba(255,255,255,0.05)', borderRadius: 2 }}>
                          <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 2, opacity: 0.8 }} />
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
                    background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.18)',
                    borderRadius: 8, padding: '4px 10px', marginBottom: 16,
                  }}>
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="#34D399" strokeWidth="1.2"/>
                      <path d="M6 3v3l2 2" stroke="#34D399" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: '#34D399', letterSpacing: '0.1em' }}>OPTIMAL WINDOWS</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 22, color: '#E0F7FA', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>Best Times<br />Ranked For You</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD', lineHeight: 1.65, margin: 0 }}>
                    Compound scoring across wave quality, tide, wind, and crowd levels. Know exactly when to paddle out — 16 days out.
                  </p>
                </div>

                {/* Optimal windows visualization */}
                <div style={{
                  background: 'rgba(3,8,16,0.6)',
                  border: '1px solid rgba(52,211,153,0.1)',
                  borderRadius: 12, padding: '14px',
                }}>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 9, color: '#2E5568', marginBottom: 10, letterSpacing: '0.08em' }}>
                    TOP WINDOWS THIS WEEK · STEAMER LANE
                  </div>
                  {[
                    { time: 'Sat 06:30', label: 'Dawn patrol', score: 94, color: '#FB923C', w: 94 },
                    { time: 'Sun 07:00', label: 'Early bird',  score: 87, color: '#06B6D4', w: 87 },
                    { time: 'Fri 16:00', label: 'Evening push', score: 71, color: '#34D399', w: 71 },
                    { time: 'Mon 08:00', label: 'Morning run',  score: 58, color: '#818CF8', w: 58 },
                  ].map(({ time, label, score, color, w }) => (
                    <div key={time} className="optimal-bar" style={{ marginBottom: 6 }}>
                      <div className="optimal-bar-fill" style={{ width: `${w}%`, background: `${color}22`, borderRight: `2px solid ${color}60` }} />
                      <span className="optimal-bar-text">{time} <span style={{ color: '#2E5568' }}>·</span> {label}</span>
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
                  icon: '🔭',
                  badge: 'ML MODELS',
                  badgeColor: '#818CF8',
                  title: 'Per-Spot Bias Correction',
                  body: 'LightGBM models trained on NDBC historical data translate open-ocean buoy readings to actual face height at each break.',
                },
                {
                  icon: '🌊',
                  badge: 'PHYSICS',
                  badgeColor: '#22D3EE',
                  title: 'SWAN Nearshore Model',
                  body: 'DELFT3D SWAN wave physics — refraction, shoaling, and bathymetry effects modeled for selected spots. Not just offshore interpolation.',
                },
                {
                  icon: '🤙',
                  badge: 'AI · ON-DEVICE',
                  badgeColor: '#34D399',
                  title: 'Ask Stoke™ NLQ',
                  body: '"Will it be good at Mavericks Saturday morning?" On-device Phi-4-mini answers in natural language. Zero API costs.',
                },
              ].map(({ icon: _icon, badge, badgeColor, title, body }) => (
                <div key={title} className="feature-card" style={{ padding: '28px 28px' }}>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: `${badgeColor}14`, border: `1px solid ${badgeColor}30`,
                    borderRadius: 8, padding: '4px 10px', marginBottom: 14,
                  }}>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: badgeColor, letterSpacing: '0.1em' }}>{badge}</span>
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800,
                    fontSize: 18, color: '#E0F7FA', letterSpacing: '-0.02em',
                    margin: '0 0 10px',
                  }}>{title}</h3>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD', lineHeight: 1.65, margin: 0 }}>{body}</p>
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
          background: 'rgba(6,13,26,0.5)',
          borderTop: '1px solid rgba(6,182,212,0.06)',
          borderBottom: '1px solid rgba(6,182,212,0.06)',
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
                      color: '#06B6D4',
                      marginLeft: 4,
                    }}>{unit}</span>}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    color: '#6B9BAD',
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
                color: '#06B6D4',
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginBottom: 16,
                background: 'rgba(6,182,212,0.06)',
                border: '1px solid rgba(6,182,212,0.15)',
                borderRadius: 100,
                padding: '5px 14px',
              }}>Pricing</div>
              <h2 style={{
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 'clamp(32px, 5vw, 52px)',
                color: '#E0F7FA', letterSpacing: '-0.03em', lineHeight: 1.05,
                margin: '0 0 12px',
              }}>
                Start free.<br />Go pro when you're ready.
              </h2>
            </div>

            <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>

              {/* Free */}
              <div className="pricing-card">
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#E0F7FA', marginBottom: 4 }}>Free</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42, color: '#E0F7FA' }}>$0</span>
                    <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: '#6B9BAD' }}>/mo forever</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD' }}>Good enough to get addicted.</div>
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
                  background: 'rgba(6,182,212,0.08)',
                  border: '1px solid rgba(6,182,212,0.2)',
                  color: '#06B6D4',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '14px 24px', borderRadius: 12, textDecoration: 'none',
                  transition: 'background 0.15s',
                }}>Start Free</Link>
              </div>

              {/* Pro */}
              <div className="pricing-card featured">
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28,
                }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: '#E0F7FA', marginBottom: 4 }}>Pro</div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42, color: '#E0F7FA' }}>$9</span>
                      <span style={{ fontFamily: 'var(--font-data)', fontSize: 13, color: '#6B9BAD' }}>/mo</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, color: '#6B9BAD' }}>For surfers who take it seriously.</div>
                  </div>
                  <div style={{
                    background: 'rgba(6,182,212,0.1)',
                    border: '1px solid rgba(6,182,212,0.25)',
                    borderRadius: 8, padding: '4px 10px',
                    fontFamily: 'var(--font-data)', fontSize: 10, color: '#06B6D4',
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
                      <div className="check-icon" style={{ background: 'rgba(6,182,212,0.15)', borderColor: 'rgba(6,182,212,0.4)' }}>✓</div>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
                <Link href="/auth/login" style={{
                  display: 'block', textAlign: 'center',
                  background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
                  color: '#030810',
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 14, letterSpacing: '0.06em', textTransform: 'uppercase',
                  padding: '14px 24px', borderRadius: 12, textDecoration: 'none',
                  boxShadow: '0 8px 32px rgba(6,182,212,0.35)',
                  transition: 'box-shadow 0.15s',
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
          position: 'relative',
          overflow: 'hidden',
          borderTop: '1px solid rgba(6,182,212,0.06)',
        }}>
          <div style={{
            position: 'absolute', inset: 0, zIndex: 0,
            background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.07) 0%, transparent 65%)',
          }} />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 680, margin: '0 auto' }}>
            <div style={{
              fontFamily: 'var(--font-data)', fontSize: 11, color: '#06B6D4',
              letterSpacing: '0.2em', textTransform: 'uppercase',
              marginBottom: 20,
            }}>The ocean doesn't wait</div>
            <h2 style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 'clamp(36px, 6vw, 64px)',
              color: '#E0F7FA', letterSpacing: '-0.03em', lineHeight: 1.0,
              margin: '0 0 20px',
            }}>
              Stop guessing.<br />
              <span style={{ color: '#06B6D4' }}>Start knowing.</span>
            </h2>
            <p style={{
              fontFamily: 'var(--font-body)', fontSize: 17, color: '#6B9BAD',
              maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.65,
            }}>
              Join surfers using AI and real spectral data to score better sessions.
              Free forever, no card required.
            </p>
            <Link href="/map" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              color: '#030810',
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 16, letterSpacing: '0.04em', textTransform: 'uppercase',
              padding: '18px 48px', borderRadius: 16, textDecoration: 'none',
              boxShadow: '0 12px 48px rgba(6,182,212,0.45)',
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
          borderTop: '1px solid rgba(6,182,212,0.06)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #06B6D4 0%, #0891B2 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M1 10 C3 7, 5 11, 8 8 C11 5, 13 9, 15 6" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              </svg>
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: '#E0F7FA' }}>nSwell</span>
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#2E5568', marginLeft: 8 }}>
              Powered by NOAA · Open-Meteo · ECMWF
            </span>
          </div>
          <div style={{ display: 'flex', gap: 28 }}>
            {['Dashboard', 'Login', 'Spots', 'API'].map(label => (
              <Link key={label} href={label === 'Dashboard' ? '/map' : label === 'Login' ? '/auth/login' : label === 'Spots' ? '/map' : '/api-portal'}
                style={{ fontFamily: 'var(--font-data)', fontSize: 12, color: '#2E5568', textDecoration: 'none', letterSpacing: '0.06em', transition: 'color 0.15s' }}
              >{label}</Link>
            ))}
          </div>
          <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: '#2E5568' }}>
            © 2025 nSwell · MIT License
          </div>
        </footer>

      </div>
    </>
  )
}
