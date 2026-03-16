import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getForecast, getSpot } from '@/lib/api'
import { createClient } from '@/lib/supabase/server'
import ForecastTimeline from '@/components/forecast/ForecastTimeline'
import StokeScoreWidget from '@/components/forecast/StokeScoreWidget'
import SwellSpectrumWidget from '@/components/forecast/SwellSpectrumWidget'
import TideChartWidget from '@/components/forecast/TideChartWidget'
import WindRoseWidget from '@/components/forecast/WindRoseWidget'
import OptimalWindows from '@/components/forecast/OptimalWindows'
import AskStoke from '@/components/forecast/AskStoke'
import ModelComparison from '@/components/forecast/ModelComparison'
import {
  formatWaveHeight,
  formatPeriod,
  formatWindSpeed,
  directionArrow,
  getConditionLabel,
} from '@/types'
import type { ForecastHour } from '@/types'
import type { ReactNode } from 'react'
import ConditionsIntelligence from '@/components/forecast/ConditionsIntelligence'
import SafetyPanel from '@/components/forecast/SafetyPanel'
import GearRecommendation from '@/components/forecast/GearRecommendation'
import SwellTracker from '@/components/forecast/SwellTracker'
import { generateConditionsIntelligence } from '@/lib/conditions-intelligence'

export const revalidate = 300

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadData(slug: string, isPremium: boolean) {
  try {
    const [spot, forecast] = await Promise.all([
      getSpot(slug),
      getForecast(slug, isPremium ? 16 : 7, isPremium),
    ])
    return { spot, forecast, error: null }
  } catch (err) {
    return { spot: null, forecast: null, error: String(err) }
  }
}

async function getUserTier(): Promise<'free' | 'pro' | 'explorer'> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return 'free'
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('subscription_tier')
      .eq('user_id', user.id)
      .single()
    return (profile?.subscription_tier as 'free' | 'pro' | 'explorer') ?? 'free'
  } catch {
    return 'free'
  }
}

const CONDITION_CONFIG = {
  firing:   { text: 'text-red-400',    badge: 'bg-red-500/20 text-red-300 border border-red-500/30',           heroGrad: 'from-red-950/80 via-slate-950/60 to-transparent',    label: '🔥 FIRING'   },
  pumping:  { text: 'text-orange-400', badge: 'bg-orange-500/20 text-orange-300 border border-orange-500/30',  heroGrad: 'from-orange-950/80 via-slate-950/60 to-transparent', label: '🤙 PUMPING'  },
  fun:      { text: 'text-green-400',  badge: 'bg-green-500/20 text-green-300 border border-green-500/30',     heroGrad: 'from-green-950/80 via-slate-950/60 to-transparent',  label: '😎 FUN'      },
  worth_it: { text: 'text-blue-400',   badge: 'bg-blue-500/20 text-blue-300 border border-blue-500/30',        heroGrad: 'from-blue-950/80 via-slate-950/60 to-transparent',   label: '🏄 WORTH IT' },
  flat:     { text: 'text-slate-400',  badge: 'bg-slate-700/50 text-slate-400 border border-slate-600/30',     heroGrad: 'from-slate-900/80 via-slate-950/60 to-transparent',  label: '😴 FLAT'     },
  no_data:  { text: 'text-slate-500',  badge: 'bg-slate-800/50 text-slate-500 border border-slate-700/30',     heroGrad: 'from-slate-900/80 via-slate-950/60 to-transparent',  label: '— NO DATA'   },
}

export default async function SpotPage({ params }: PageProps) {
  const { id } = await params
  const tier = await getUserTier()
  const isPremium = tier === 'pro' || tier === 'explorer'
  const { spot, forecast, error } = await loadData(id, isPremium)

  if (!spot) notFound()

  const currentHour: ForecastHour | undefined = forecast?.hours[0]
  const label  = getConditionLabel(currentHour?.quality_score)
  const config = CONDITION_CONFIG[label]

  const intelligence = forecast ? generateConditionsIntelligence(spot, forecast.hours) : null

  const windReadings = (forecast?.hours ?? [])
    .slice(0, 24)
    .filter(h => h.wind_direction != null && h.wind_speed_ms != null)
    .map(h => ({ direction: h.wind_direction!, speed_ms: h.wind_speed_ms!, time: h.forecast_time }))

  const tidePoints = (forecast?.hours ?? [])
    .filter(h => h.tide_height_m != null)
    .map(h => ({ time: h.forecast_time, height_m: h.tide_height_m!, is_high: h.tide_state === 'high', is_low: h.tide_state === 'low' }))

  const spectrumSnapshots = [0, 6, 12, 24]
    .map(offset => {
      const hour = forecast?.hours[offset]
      if (!hour?.wave_spectrum) return null
      return { label: offset === 0 ? 'Now' : `+${offset}h`, spectrum: hour.wave_spectrum }
    })
    .filter(Boolean) as Array<{ label: string; spectrum: Record<string, number> }>

  const heightFt  = currentHour?.wave_height_face_m != null
    ? (currentHour.wave_height_face_m * 3.281).toFixed(0)
    : currentHour?.wave_height_m != null
    ? (currentHour.wave_height_m * 3.281).toFixed(0)
    : null

  return (
    <div className="min-h-full">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ background: '#020b18' }}>
        {/* Condition color gradient overlay */}
        <div className={`absolute inset-0 bg-gradient-to-b ${config.heroGrad} pointer-events-none`} />

        {/* Wave pattern decoration */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
             style={{ backgroundImage: `repeating-linear-gradient(45deg, #0ea5e9 0, #0ea5e9 1px, transparent 0, transparent 50%)`, backgroundSize: '20px 20px' }} />

        <div className="relative max-w-4xl mx-auto px-4 pt-6 pb-8">
          {/* Back */}
          <Link href="/map" className="inline-flex items-center gap-2 text-slate-400 hover:text-slate-200 text-sm transition-colors mb-6">
            ← Map
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{spot.region}</span>
                <span className="text-slate-700">·</span>
                <span className="text-xs text-slate-500 capitalize">{spot.break_type} break</span>
                {spot.skill_minimum && (
                  <>
                    <span className="text-slate-700">·</span>
                    <span className="text-xs text-slate-500 capitalize">{spot.skill_minimum}+</span>
                  </>
                )}
                {spot.swan_enabled && (
                  <span className="text-xs bg-cyan-900/50 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-800/50 font-medium">
                    Physics Model
                  </span>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight leading-tight">
                {spot.name}
              </h1>
              {spot.description && (
                <p className="text-slate-400 text-sm mt-2 max-w-lg">{spot.description}</p>
              )}
            </div>

            {/* Current condition badge + height */}
            <div className="flex items-end gap-5 flex-shrink-0">
              {heightFt && (
                <div className="text-right">
                  <div className="text-6xl font-black text-white leading-none animate-count">
                    {heightFt}
                    <span className="text-2xl text-slate-400 font-bold">ft</span>
                  </div>
                  <div className="text-slate-500 text-sm mt-0.5">face height</div>
                </div>
              )}
              <div className="text-right">
                <span className={`inline-block text-sm font-black px-3 py-1.5 rounded-xl ${config.badge}`}>
                  {config.label}
                </span>
                {currentHour?.quality_score != null && (
                  <div className="text-slate-500 text-xs mt-1">
                    {currentHour.quality_score.toFixed(1)} / 10
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Conditions strip */}
          {currentHour && (
            <div className="mt-6 pt-6 border-t border-slate-800/60">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <CondStat icon="🌊" label="Wave Height"
                  value={formatWaveHeight(currentHour.wave_height_face_m ?? currentHour.wave_height_m)} />
                <CondStat icon="⏱️" label="Period"
                  value={formatPeriod(currentHour.wave_period_s)} />
                <CondStat icon="🧭" label="Swell Direction"
                  value={directionArrow(currentHour.swell_direction ?? currentHour.wave_direction)} />
                <CondStat icon="💨" label="Wind"
                  value={`${directionArrow(currentHour.wind_direction)} ${formatWindSpeed(currentHour.wind_speed_ms)}`} />
                {currentHour.tide_height_m != null && (
                  <CondStat icon="🌊" label="Tide"
                    value={`${currentHour.tide_height_m.toFixed(1)}m ${currentHour.tide_state ?? ''}`} />
                )}
                {currentHour.swell_height_m != null && (
                  <CondStat icon="↗️" label="Swell Height"
                    value={formatWaveHeight(currentHour.swell_height_m)} />
                )}
                {currentHour.confidence != null && (
                  <CondStat icon="🎯" label="Confidence"
                    value={`${(currentHour.confidence * 100).toFixed(0)}%`} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-5">

        {/* Safety */}
        <SafetyPanel spotId={spot.slug} spotName={spot.name} />

        {/* Conditions Intelligence */}
        {intelligence && <ConditionsIntelligence data={intelligence} spotName={spot.name} />}

        {/* Stoke / Wind / Tide */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Stoke Score™">
            <StokeScoreWidget spotId={spot.slug} spotName={spot.name} currentHour={currentHour} />
          </Card>
          <Card title="Wind (24h)">
            <WindRoseWidget readings={windReadings} offshoreDirection={spot.optimal_wind_direction} />
          </Card>
          <Card title="Tides">
            <TideChartWidget points={tidePoints} currentTime={currentHour?.forecast_time} />
          </Card>
        </div>

        {/* Gear */}
        <Card title="What to Grab">
          <GearRecommendation
            spotId={spot.slug}
            faceHeightM={currentHour?.wave_height_face_m ?? currentHour?.wave_height_m}
            wavePeriodS={currentHour?.wave_period_s}
          />
        </Card>

        {/* Swell Spectrum */}
        {spectrumSnapshots.length > 0 && (
          <Card title="Swell Spectrum" subtitle="wave energy by period">
            <SwellSpectrumWidget snapshots={spectrumSnapshots} />
          </Card>
        )}

        {/* Model Comparison */}
        <Card title="Model Comparison" subtitle="ECMWF · GFS · ICON">
          <ModelComparison modelForecasts={forecast?.model_forecasts ?? {}} isPremium={isPremium} />
        </Card>

        {/* Optimal Windows */}
        <Card title="Optimal Windows" subtitle="best sessions next 14 days">
          <OptimalWindows spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />
        </Card>

        {/* Swell Tracker */}
        <Card title="Swell Tracker" subtitle="upcoming events · 16-day">
          <SwellTracker spotId={spot.slug} />
        </Card>

        {/* Forecast Timeline */}
        <Card title="7-Day Forecast" subtitle={forecast ? `via ${forecast.model_sources.join(', ')}` : undefined}>
          {error ? (
            <div className="text-red-400 text-sm">Failed to load forecast: {error}</div>
          ) : forecast ? (
            <ForecastTimeline hours={forecast.hours} />
          ) : (
            <div className="text-slate-500 text-sm">Loading forecast...</div>
          )}
        </Card>

        {/* Spot metadata footer */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-slate-600 pb-6">
          <div>Optimal swell: {spot.optimal_swell_direction ?? '--'}° ± {spot.optimal_swell_direction_range}°</div>
          <div>Optimal period: {spot.optimal_period_min}–{spot.optimal_period_max}s</div>
          <div>Optimal size: {formatWaveHeight(spot.optimal_size_min)}–{formatWaveHeight(spot.optimal_size_max)}</div>
          {spot.nearest_buoy_id && <div>Buoy: {spot.nearest_buoy_id}</div>}
        </div>
      </div>

      {/* Ask Stoke */}
      <AskStoke spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />
    </div>
  )
}

function CondStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-500 text-xs mb-1 flex items-center gap-1">
        <span>{icon}</span> {label}
      </div>
      <div className="text-white font-bold text-xl">{value}</div>
    </div>
  )
}

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/50 p-5">
      <div className="flex items-baseline gap-2 mb-4">
        <h2 className="text-base font-bold text-white">{title}</h2>
        {subtitle && <span className="text-slate-500 text-xs">{subtitle}</span>}
      </div>
      {children}
    </div>
  )
}
