import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getForecast, getSpot } from '@/lib/api'
import ForecastTimeline from '@/components/forecast/ForecastTimeline'
import StokeScoreWidget from '@/components/forecast/StokeScoreWidget'
import SwellSpectrumWidget from '@/components/forecast/SwellSpectrumWidget'
import TideChartWidget from '@/components/forecast/TideChartWidget'
import WindRoseWidget from '@/components/forecast/WindRoseWidget'
import OptimalWindows from '@/components/forecast/OptimalWindows'
import AskStoke from '@/components/forecast/AskStoke'
import ModelComparison from '@/components/forecast/ModelComparison'
import WeekQualityBar from '@/components/forecast/WeekQualityBar'
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

async function loadData(slug: string) {
  try {
    const [spot, forecast] = await Promise.all([
      getSpot(slug),
      getForecast(slug, 16, true),
    ])
    return { spot, forecast, error: null }
  } catch (err) {
    return { spot: null, forecast: null, error: String(err) }
  }
}

const CONDITION_CONFIG = {
  firing:   { textColor: '#F97316', badgeBg: 'rgba(249,115,22,0.15)',   badgeBorder: 'rgba(249,115,22,0.35)',  heroClass: 'hero-firing',   label: '🔥 FIRING',   glow: '#F97316' },
  pumping:  { textColor: '#06B6D4', badgeBg: 'rgba(6,182,212,0.15)',    badgeBorder: 'rgba(6,182,212,0.35)',   heroClass: 'hero-pumping',  label: '🤙 PUMPING',  glow: '#06B6D4' },
  fun:      { textColor: '#3B82F6', badgeBg: 'rgba(59,130,246,0.15)',   badgeBorder: 'rgba(59,130,246,0.35)',  heroClass: 'hero-fun',      label: '😎 FUN',      glow: '#3B82F6' },
  worth_it: { textColor: '#6366F1', badgeBg: 'rgba(99,102,241,0.15)',   badgeBorder: 'rgba(99,102,241,0.35)',  heroClass: 'hero-worth_it', label: '🏄 WORTH IT', glow: '#6366F1' },
  flat:     { textColor: '#475569', badgeBg: 'rgba(71,85,105,0.2)',     badgeBorder: 'rgba(71,85,105,0.3)',    heroClass: 'hero-flat',     label: '😴 FLAT',     glow: '#475569' },
  no_data:  { textColor: '#2E5568', badgeBg: 'rgba(15,32,64,0.5)',      badgeBorder: 'rgba(46,85,104,0.3)',    heroClass: 'hero-no_data',  label: '— NO DATA',   glow: '#2E5568' },
}

export default async function SpotPage({ params }: PageProps) {
  const { id } = await params
  const isPremium = true
  const { spot, forecast, error } = await loadData(id)

  if (!spot) notFound()

  const currentHour: ForecastHour | undefined = forecast?.hours[0]
  const label  = getConditionLabel(currentHour?.quality_score)
  const config = CONDITION_CONFIG[label as keyof typeof CONDITION_CONFIG] ?? CONDITION_CONFIG.no_data

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

  const heightFt = currentHour?.wave_height_face_m != null
    ? (currentHour.wave_height_face_m * 3.281).toFixed(0)
    : currentHour?.wave_height_m != null
    ? (currentHour.wave_height_m * 3.281).toFixed(0)
    : null

  return (
    <div className="min-h-full">

      {/* ── HERO ── */}
      <div className={`relative overflow-hidden ${config.heroClass}`}>
        {/* Fine dot grid */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.018]"
             style={{ backgroundImage: `radial-gradient(circle, rgba(6,182,212,0.8) 1px, transparent 1px)`, backgroundSize: '32px 32px' }} />

        {/* Radial glow from bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 pointer-events-none"
             style={{ background: `radial-gradient(ellipse at 50% 100%, ${config.glow}18 0%, transparent 65%)` }} />

        {/* Left-edge cyan trace */}
        <div className="absolute top-0 left-0 w-[2px] h-full pointer-events-none"
             style={{ background: `linear-gradient(180deg, transparent, ${config.glow}40, transparent)` }} />

        <div className="relative max-w-5xl mx-auto px-4 pt-5 pb-9">
          {/* Back */}
          <Link href="/map"
            className="inline-flex items-center gap-1.5 text-sm transition-colors mb-5 group"
            style={{ color: 'var(--spray)' }}>
            <span className="group-hover:-translate-x-0.5 transition-transform">←</span>
            <span className="group-hover:[color:var(--mist)] transition-colors">All Spots</span>
          </Link>

          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            {/* Left: spot info */}
            <div className="animate-fade-up">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span style={{
                  fontFamily: 'var(--font-data)',
                  fontSize: 10,
                  fontWeight: 600,
                  color: 'var(--spray)',
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}>{spot.region}</span>
                <span style={{ color: 'var(--deep-text)' }}>·</span>
                <span style={{ fontSize: 11, color: 'var(--spray)', textTransform: 'capitalize' }}>{spot.break_type} break</span>
                {spot.skill_minimum && (
                  <>
                    <span style={{ color: 'var(--deep-text)' }}>·</span>
                    <span style={{ fontSize: 11, color: 'var(--spray)', textTransform: 'capitalize' }}>{spot.skill_minimum}+</span>
                  </>
                )}
                {spot.swan_enabled && (
                  <span style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: 'var(--cyan-bright)',
                    background: 'rgba(6,182,212,0.12)',
                    border: '1px solid rgba(6,182,212,0.25)',
                    padding: '2px 8px',
                    borderRadius: 20,
                    letterSpacing: '0.06em',
                    fontFamily: 'var(--font-data)',
                  }}>
                    ⚡ PHYSICS MODEL
                  </span>
                )}
              </div>

              <h1 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(2rem, 5vw, 3.25rem)',
                fontWeight: 800,
                color: 'var(--foam)',
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}>
                {spot.name}
              </h1>
              {spot.description && (
                <p style={{ fontSize: 13, color: 'var(--spray)', marginTop: 8, maxWidth: 480, lineHeight: 1.6 }}>
                  {spot.description}
                </p>
              )}
            </div>

            {/* Right: dominant wave height */}
            <div className="flex items-end gap-5 flex-shrink-0 animate-fade-up-delay">
              {heightFt && (
                <div className="text-right">
                  <div className="animate-count" style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 'clamp(3rem, 8vw, 5rem)',
                    fontWeight: 700,
                    lineHeight: 1,
                    color: 'var(--foam)',
                    textShadow: `0 0 40px ${config.glow}45`,
                  }}>
                    {heightFt}<span style={{ fontSize: '1.5rem', color: 'var(--spray)', fontWeight: 400, marginLeft: 3 }}>ft</span>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 9,
                    color: 'var(--deep-text)',
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    marginTop: 4,
                  }}>face height</div>
                </div>
              )}
              <div className="text-right pb-1">
                <span style={{
                  display: 'inline-block',
                  fontFamily: 'var(--font-display)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: config.textColor,
                  background: config.badgeBg,
                  border: `1px solid ${config.badgeBorder}`,
                  padding: '6px 14px',
                  borderRadius: 10,
                  boxShadow: `0 4px 20px ${config.glow}20`,
                }}>
                  {config.label}
                </span>
                {currentHour?.quality_score != null && (
                  <div style={{
                    fontFamily: 'var(--font-data)',
                    fontSize: 11,
                    color: 'var(--spray)',
                    marginTop: 6,
                  }}>
                    {currentHour.quality_score.toFixed(1)}<span style={{ color: 'var(--deep-text)' }}>/10</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Conditions data strip */}
          {currentHour && (
            <div className="mt-6 pt-5 flex flex-wrap gap-x-7 gap-y-3"
                 style={{ borderTop: '1px solid rgba(6,182,212,0.08)' }}>
              <CondStat label="Height"
                value={formatWaveHeight(currentHour.wave_height_face_m ?? currentHour.wave_height_m)}
                color={config.textColor} />
              <CondStat label="Period"
                value={formatPeriod(currentHour.wave_period_s)}
                color={config.textColor} />
              <CondStat label="Swell"
                value={directionArrow(currentHour.swell_direction ?? currentHour.wave_direction)}
                color={config.textColor} />
              <CondStat label="Wind"
                value={`${directionArrow(currentHour.wind_direction)} ${formatWindSpeed(currentHour.wind_speed_ms)}`}
                color={config.textColor} />
              {currentHour.tide_height_m != null && (
                <CondStat label="Tide"
                  value={`${currentHour.tide_height_m.toFixed(1)}m ${currentHour.tide_state ?? ''}`}
                  color={config.textColor} />
              )}
              {currentHour.swell_height_m != null && (
                <CondStat label="Swell Ht"
                  value={formatWaveHeight(currentHour.swell_height_m)}
                  color={config.textColor} />
              )}
              {currentHour.confidence != null && (
                <CondStat label="Confidence"
                  value={`${(currentHour.confidence * 100).toFixed(0)}%`}
                  color={config.textColor} />
              )}
            </div>
          )}
        </div>

        {/* Wave SVG bottom edge */}
        <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none pointer-events-none">
          <svg viewBox="0 0 1440 36" className="w-full animate-wave-drift" preserveAspectRatio="none" style={{ height: 36 }}>
            <path d="M0,18 C200,36 400,0 600,18 C800,36 1000,0 1200,18 C1350,30 1420,10 1440,18 L1440,36 L0,36 Z"
                  fill="#060D1A" />
          </svg>
        </div>
      </div>

      {/* ── CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-5">

        {/* Conditions intelligence — first thing to read */}
        {intelligence && <ConditionsIntelligence data={intelligence} spotName={spot.name} />}

        {/* 7-day overview — click to jump to day */}
        {forecast && forecast.hours.length > 0 && (
          <WeekQualityBar hours={forecast.hours} />
        )}

        {/* Stoke / Wind / Tide trinity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card title="Stoke Score™" accent={config.glow}>
            <StokeScoreWidget spotId={spot.slug} spotName={spot.name} currentHour={currentHour} />
          </Card>
          <Card title="Wind Rose" subtitle="24h">
            <WindRoseWidget readings={windReadings} offshoreDirection={spot.optimal_wind_direction} />
          </Card>
          <Card title="Tides" subtitle="48h">
            <TideChartWidget points={tidePoints} currentTime={currentHour?.forecast_time} />
          </Card>
        </div>

        {/* 7-Day Forecast Timeline — moved up, it's the core feature */}
        <Card title={`${forecast?.days_available ?? 7}-Day Forecast`}
              subtitle={forecast ? `via ${forecast.model_sources.join(', ')}` : undefined}>
          {error ? (
            <div className="text-red-400 text-sm py-2">Failed to load forecast: {error}</div>
          ) : forecast ? (
            <ForecastTimeline hours={forecast.hours} />
          ) : (
            <div className="text-slate-500 text-sm py-8 text-center">Loading forecast...</div>
          )}
        </Card>

        {/* Optimal Windows */}
        <Card title="Optimal Windows" subtitle="best sessions next 14 days">
          <OptimalWindows spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />
        </Card>

        {/* Model Comparison */}
        <Card title="Model Comparison" subtitle="ECMWF · GFS · ICON">
          <ModelComparison modelForecasts={forecast?.model_forecasts ?? {}} isPremium={isPremium} />
        </Card>

        {/* Swell Spectrum */}
        {spectrumSnapshots.length > 0 && (
          <Card title="Swell Spectrum" subtitle="wave energy by period">
            <SwellSpectrumWidget snapshots={spectrumSnapshots} />
          </Card>
        )}

        {/* Gear */}
        <Card title="What to Grab">
          <GearRecommendation
            spotId={spot.slug}
            faceHeightM={currentHour?.wave_height_face_m ?? currentHour?.wave_height_m}
            wavePeriodS={currentHour?.wave_period_s}
          />
        </Card>

        {/* Swell Tracker */}
        <Card title="Swell Tracker" subtitle="named events · 16-day">
          <SwellTracker spotId={spot.slug} />
        </Card>

        {/* Safety */}
        <SafetyPanel spotId={spot.slug} spotName={spot.name} />

        {/* Spot metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pb-6 px-1"
             style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
          <div>Optimal swell: {spot.optimal_swell_direction ?? '--'}° ± {spot.optimal_swell_direction_range}°</div>
          <div>Period: {spot.optimal_period_min}–{spot.optimal_period_max}s</div>
          <div>Size: {formatWaveHeight(spot.optimal_size_min)}–{formatWaveHeight(spot.optimal_size_max)}</div>
          {spot.nearest_buoy_id && <div>Buoy: {spot.nearest_buoy_id}</div>}
        </div>
      </div>

      {/* Ask Stoke — floating AI chat */}
      <AskStoke spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />
    </div>
  )
}

function CondStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        color: 'var(--deep-text)',
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
        marginBottom: 4,
      }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 18,
        fontWeight: 600,
        color: color,
        lineHeight: 1,
      }}>
        {value}
      </div>
    </div>
  )
}

function Card({ title, subtitle, children, accent }: { title: string; subtitle?: string; children: ReactNode; accent?: string }) {
  return (
    <div className="glass-card p-5"
         style={accent ? { boxShadow: `0 0 0 1px ${accent}12, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(6,182,212,0.06)` } : {}}>
      <div className="flex items-baseline gap-2.5 mb-4">
        <h2 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--foam)',
          letterSpacing: '0.01em',
        }}>{title}</h2>
        {subtitle && (
          <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
            {subtitle}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}
