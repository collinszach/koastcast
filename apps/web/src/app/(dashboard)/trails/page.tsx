export const revalidate = 300

export default function TrailsPage() {
  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#060D1A' }}>
      {/* Coming-soon notice */}
      <div style={{
        fontSize: 12,
        color: 'var(--deep-text)',
        background: 'rgba(6,182,212,0.05)',
        padding: '8px 16px',
        borderBottom: '1px solid rgba(6,182,212,0.08)',
        flexShrink: 0,
      }}>
        Trails is coming soon — trail conditions, difficulty ratings, and route maps.
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontSize: 40 }}>🥾</div>
        <div style={{ fontFamily: 'Syne, sans-serif', fontSize: 22, fontWeight: 700, color: '#fff' }}>Trails — Coming Soon</div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', textAlign: 'center', maxWidth: 320 }}>
          Trail conditions, difficulty ratings, and interactive route maps are on the roadmap.
        </div>
      </div>
    </div>
  )
}
