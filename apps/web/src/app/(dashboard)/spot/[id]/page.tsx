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
import ConditionsIntelligence from '@/components/forecast/ConditionsIntelligence'
import SafetyPanel from '@/components/forecast/SafetyPanel'
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

export default async function SpotPage({ params }: PageProps) {
  const { id } = await params
  const tier = await getUserTier()
  const isPremium = tier === 'pro' || tier === 'explorer'
  const { spot, forecast, error } = await loadData(id, isPremium)

  if (!spot) {
    notFound()
  }

  const currentHour: ForecastHour | undefined = forecast?.hours[0]
  const label = getConditionLabel(currentHour?.quality_score)

  // Conditions Intelligence: plain-English summary
  const intelligence = forecast ? generateConditionsIntelligence(spot, forecast.hours) : null

  const CONDITION_COLORS: Record<string, string> = {
    firing: 'text-red-400',
    pumping: 'text-orange-400',
    fun: 'text-green-400',
    worth_it: 'text-blue-400',
    flat: 'text-gray-400',
    no_data: 'text-gray-500',
  }

  const CONDITION_LABELS: Record<string, string> = {
    firing: 'FIRING',
    pumping: 'PUMPING',
    fun: 'FUN',
    worth_it: 'WORTH IT',
    flat: 'FLAT',
    no_data: 'NO DATA',
  }

  // Build wind readings for WindRose (24h)
  const windReadings = (forecast?.hours ?? [])
    .slice(0, 24)
    .filter(h => h.wind_direction != null && h.wind_speed_ms != null)
    .map(h => ({
      direction: h.wind_direction!,
      speed_ms: h.wind_speed_ms!,
      time: h.forecast_time,
    }))

  // Build tide points from forecast hours
  const tidePoints = (forecast?.hours ?? [])
    .filter(h => h.tide_height_m != null)
    .map(h => ({
      time: h.forecast_time,
      height_m: h.tide_height_m!,
      is_high: h.tide_state === 'high',
      is_low: h.tide_state === 'low',
    }))

  // Build spectrum snapshots (now + 6h + 12h + 24h)
  const spectrumHours = [0, 6, 12, 24]
  const spectrumSnapshots = spectrumHours
    .map(offset => {
      const hour = forecast?.hours[offset]
      if (!hour?.wave_spectrum) return null
      const label = offset === 0 ? 'Now' : `+${offset}h`
      return { label, spectrum: hour.wave_spectrum }
    })
    .filter(Boolean) as Array<{ label: string; spectrum: Record<string, number> }>

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Back nav */}
      <Link href="/map" className="text-gray-400 hover:text-white text-sm flex items-center gap-2 transition-colors">
        ← Back to map
      </Link>

      {/* Hero */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">{spot.name}</h1>
            <p className="text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>{spot.region} · {spot.break_type} break{spot.skill_minimum && ` · ${spot.skill_minimum}+`}</span>
              {spot.swan_enabled && (
                <span className="text-xs bg-cyan-900/50 text-cyan-400 px-2 py-0.5 rounded-full font-medium">
                  Physics Model
                </span>
              )}
            </p>
            {spot.description && (
              <p className="text-gray-500 text-sm mt-2 max-w-xl">{spot.description}</p>
            )}
          </div>

          <div className="text-right">
            <div className={`text-2xl font-black ${CONDITION_COLORS[label]}`}>
              {CONDITION_LABELS[label]}
            </div>
            {currentHour?.quality_score != null && (
              <div className="text-gray-500 text-sm">
                Quality {currentHour.quality_score.toFixed(1)}/10
              </div>
            )}
          </div>
        </div>

        {/* Current conditions grid */}
        {currentHour && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-800">
            <ConditionStat
              label="Wave Height"
              value={formatWaveHeight(currentHour.wave_height_face_m ?? currentHour.wave_height_m)}
            />
            <ConditionStat
              label="Period"
              value={formatPeriod(currentHour.wave_period_s)}
            />
            <ConditionStat
              label="Swell"
              value={directionArrow(currentHour.swell_direction ?? currentHour.wave_direction)}
            />
            <ConditionStat
              label="Wind"
              value={`${directionArrow(currentHour.wind_direction)} ${formatWindSpeed(currentHour.wind_speed_ms)}`}
            />
            {currentHour.tide_height_m != null && (
              <ConditionStat
                label="Tide"
                value={`${currentHour.tide_height_m.toFixed(1)}m ${currentHour.tide_state ?? ''}`}
              />
            )}
            {currentHour.swell_height_m != null && (
              <ConditionStat
                label="Swell Height"
                value={formatWaveHeight(currentHour.swell_height_m)}
              />
            )}
            {currentHour.swell_period_s != null && (
              <ConditionStat
                label="Swell Period"
                value={formatPeriod(currentHour.swell_period_s)}
              />
            )}
            {currentHour.confidence != null && (
              <ConditionStat
                label="Confidence"
                value={`${(currentHour.confidence * 100).toFixed(0)}%`}
              />
            )}
          </div>
        )}

        {/* Spot metadata */}
        <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t border-gray-800 text-xs text-gray-500">
          <div>Optimal swell: {spot.optimal_swell_direction ?? '--'}° ± {spot.optimal_swell_direction_range}°</div>
          <div>Optimal period: {spot.optimal_period_min}-{spot.optimal_period_max}s</div>
          <div>Optimal size: {formatWaveHeight(spot.optimal_size_min)}-{formatWaveHeight(spot.optimal_size_max)}</div>
          {spot.nearest_buoy_id && (
            <div>Nearest buoy: {spot.nearest_buoy_id}</div>
          )}
        </div>
      </div>

      {/* Safety & Hazards Panel */}
      <SafetyPanel spotId={spot.slug} spotName={spot.name} />

      {/* Conditions Intelligence — plain-English summary */}
      {intelligence && (
        <ConditionsIntelligence data={intelligence} spotName={spot.name} />
      )}

      {/* Phase 2 visualizations row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Stoke Score */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Stoke Score™</h2>
          <StokeScoreWidget
            spotId={spot.slug}
            spotName={spot.name}
            currentHour={currentHour}
          />
        </div>

        {/* Wind Rose */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Wind (24h)</h2>
          <WindRoseWidget
            readings={windReadings}
            offshoreDirection={spot.optimal_wind_direction}
          />
        </div>

        {/* Tide Chart */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Tides</h2>
          <TideChartWidget
            points={tidePoints}
            currentTime={currentHour?.forecast_time}
          />
        </div>
      </div>

      {/* Swell Spectrum */}
      {spectrumSnapshots.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Swell Spectrum
            <span className="text-gray-500 text-sm font-normal ml-2">wave energy by period</span>
          </h2>
          <SwellSpectrumWidget snapshots={spectrumSnapshots} />
        </div>
      )}

      {/* Model Comparison (premium) */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Model Comparison
          <span className="text-gray-500 text-sm font-normal ml-2">ECMWF · GFS · ICON</span>
        </h2>
        <ModelComparison
          modelForecasts={forecast?.model_forecasts ?? {}}
          isPremium={isPremium}
        />
      </div>

      {/* Optimal Windows */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Optimal Windows
          <span className="text-gray-500 text-sm font-normal ml-2">best sessions next 14 days</span>
        </h2>
        <OptimalWindows
          spotId={spot.slug}
          spotName={spot.name}
          isPremium={isPremium}
        />
      </div>

      {/* 7-Day Forecast Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          7-Day Forecast
          {forecast && (
            <span className="text-gray-500 text-sm font-normal ml-2">
              via {forecast.model_sources.join(', ')}
            </span>
          )}
        </h2>

        {error ? (
          <div className="text-red-400 text-sm">
            Failed to load forecast: {error}
          </div>
        ) : forecast ? (
          <ForecastTimeline hours={forecast.hours} />
        ) : (
          <div className="text-gray-500 text-sm">Loading forecast...</div>
        )}
      </div>

      {/* Ask Stoke — NLQ chat */}
      <AskStoke
        spotId={spot.slug}
        spotName={spot.name}
        isPremium={isPremium}
      />
    </div>
  )
}

function ConditionStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-gray-500 text-xs mb-1">{label}</div>
      <div className="text-white font-semibold text-lg">{value}</div>
    </div>
  )
}
