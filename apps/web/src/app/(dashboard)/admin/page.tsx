/**
 * /admin — Internal analytics dashboard.
 * Only visible to users with admin role (email domain check for now).
 * Shows: DAU, spot views, conversion rate, top spots, top upgrade moments.
 *
 * Data comes from Supabase tables — no external analytics service required.
 */
// Admin: accessible only from Me > Settings when user.role === 'admin'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean)

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email) return false
  return ADMIN_EMAILS.length > 0 && ADMIN_EMAILS.includes(user.email)
}

async function fetchStats() {
  try {
    const supabase = await createClient()

  const [
    { count: totalUsers },
    { count: totalSessions },
    { count: proUsers },
    { count: explorerUsers },
    { data: topSpotsData },
    { data: recentSessions },
    { data: trainingRuns },
  ] = await Promise.all([
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('user_sessions').select('*', { count: 'exact', head: true }),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'pro'),
    supabase.from('user_profiles').select('*', { count: 'exact', head: true }).eq('subscription_tier', 'explorer'),
    supabase.from('user_sessions')
      .select('spot_id, spots(name, slug)')
      .limit(200),
    supabase.from('user_sessions')
      .select('created_at, quality_rating')
      .gte('created_at', new Date(Date.now() - 7 * 86400_000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.from('model_training_runs')
      .select('model_type, status, mae, rmse, finished_at')
      .order('finished_at', { ascending: false })
      .limit(10),
  ])

  // Sessions per day (last 7 days)
  const sessionsByDay: Record<string, number> = {}
  for (const s of recentSessions ?? []) {
    const day = s.created_at.slice(0, 10)
    sessionsByDay[day] = (sessionsByDay[day] || 0) + 1
  }

  // Top spots by session count
  const spotCounts: Record<string, { name: string; slug: string; count: number }> = {}
  for (const s of topSpotsData ?? []) {
    const spot = (Array.isArray(s.spots) ? s.spots[0] : s.spots) as { name: string; slug: string } | null
    if (!spot) continue
    const key = spot.slug
    if (!spotCounts[key]) spotCounts[key] = { name: spot.name, slug: spot.slug, count: 0 }
    spotCounts[key].count++
  }
  const topSpots = Object.values(spotCounts).sort((a, b) => b.count - a.count).slice(0, 10)

  const freeCount = (totalUsers ?? 0) - (proUsers ?? 0) - (explorerUsers ?? 0)
  const conversionRate = totalUsers ? (((proUsers ?? 0) + (explorerUsers ?? 0)) / totalUsers * 100).toFixed(1) : '0'

  return {
    totalUsers: totalUsers ?? 0,
    freeCount,
    proUsers: proUsers ?? 0,
    explorerUsers: explorerUsers ?? 0,
    conversionRate,
    totalSessions: totalSessions ?? 0,
    weekSessions: recentSessions?.length ?? 0,
    sessionsByDay,
    topSpots,
    trainingRuns: trainingRuns ?? [],
  }
  } catch {
    // Supabase not configured or DB unavailable — return empty stats
    return {
      totalUsers: 0,
      freeCount: 0,
      proUsers: 0,
      explorerUsers: 0,
      conversionRate: '0',
      totalSessions: 0,
      weekSessions: 0,
      sessionsByDay: {} as Record<string, number>,
      topSpots: [] as { name: string; slug: string; count: number }[],
      trainingRuns: [] as { model_type: string; status: string; mae: number | null; rmse: number | null; finished_at: string | null }[],
    }
  }
}

export default async function AdminPage() {
  if (!(await isAdmin())) {
    redirect('/map')
  }

  const stats = await fetchStats()

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">Internal metrics — not for public consumption</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KPI label="Total users" value={stats.totalUsers.toLocaleString()} />
        <KPI label="Paid users" value={`${(stats.proUsers + stats.explorerUsers).toLocaleString()}`} sub={`${stats.conversionRate}% conversion`} />
        <KPI label="Pro" value={stats.proUsers.toLocaleString()} sub="$4.99/mo" />
        <KPI label="Explorer" value={stats.explorerUsers.toLocaleString()} sub="$9.99/mo" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <KPI label="Total sessions logged" value={stats.totalSessions.toLocaleString()} />
        <KPI label="Sessions (7d)" value={stats.weekSessions.toLocaleString()} />
        <KPI label="Avg sessions/day" value={(stats.weekSessions / 7).toFixed(1)} />
      </div>

      {/* Sessions per day */}
      <Section title="Sessions by day (last 7 days)">
        <div className="flex items-end gap-2 h-24">
          {Object.entries(stats.sessionsByDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, count]) => (
              <div key={day} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-blue-600 rounded-t"
                  style={{ height: `${Math.max(8, (count / Math.max(...Object.values(stats.sessionsByDay))) * 80)}px` }}
                />
                <div className="text-gray-600 text-[10px]">{day.slice(5)}</div>
              </div>
            ))}
        </div>
      </Section>

      {/* Tier breakdown */}
      <Section title="User tier breakdown">
        <div className="space-y-2">
          {[
            { label: 'Free', count: stats.freeCount, color: 'bg-gray-600' },
            { label: 'Pro ($4.99)', count: stats.proUsers, color: 'bg-blue-500' },
            { label: 'Explorer ($9.99)', count: stats.explorerUsers, color: 'bg-purple-500' },
          ].map(({ label, count, color }) => (
            <div key={label} className="flex items-center gap-3">
              <div className="text-gray-400 text-sm w-32">{label}</div>
              <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full rounded-full ${color}`}
                  style={{ width: stats.totalUsers ? `${(count / stats.totalUsers) * 100}%` : '0%' }}
                />
              </div>
              <div className="text-gray-300 text-sm w-12 text-right">{count}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Top spots */}
      <Section title="Top spots by session count">
        <div className="space-y-2">
          {stats.topSpots.map((spot, i) => (
            <div key={spot.slug} className="flex items-center gap-3">
              <span className="text-gray-600 text-xs w-5">{i + 1}</span>
              <span className="text-gray-300 text-sm flex-1">{spot.name}</span>
              <span className="text-gray-500 text-xs">{spot.count} sessions</span>
            </div>
          ))}
          {stats.topSpots.length === 0 && (
            <p className="text-gray-600 text-sm">No session data yet.</p>
          )}
        </div>
      </Section>

      {/* Model training runs */}
      <Section title="Recent model training runs">
        <div className="space-y-2">
          {stats.trainingRuns.map((run, i) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                run.status === 'completed' ? 'bg-green-500' :
                run.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
              }`} />
              <span className="text-gray-400 capitalize w-32">{run.model_type}</span>
              {run.mae != null && (
                <span className="text-gray-500 text-xs">MAE {Number(run.mae).toFixed(4)}</span>
              )}
              {run.finished_at && (
                <span className="text-gray-600 text-xs ml-auto">
                  {new Date(run.finished_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
          {stats.trainingRuns.length === 0 && (
            <p className="text-gray-600 text-sm">No training runs logged yet.</p>
          )}
        </div>
      </Section>
    </div>
  )
}

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className="text-white font-bold text-2xl">{value}</div>
      {sub && <div className="text-gray-600 text-xs mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </div>
  )
}
