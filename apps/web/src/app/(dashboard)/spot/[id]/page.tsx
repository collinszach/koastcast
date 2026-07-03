import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getForecast, getForecastFallback, getSpot } from '@/lib/api'
import ForecastTimeline from '@/components/forecast/ForecastTimeline'
import StokeScoreWidget from '@/components/forecast/StokeScoreWidget'
import SwellSpectrumWidget from '@/components/forecast/SwellSpectrumWidget'
import TideChartWidget from '@/components/forecast/TideChartWidget'
import WindRoseWidget from '@/components/forecast/WindRoseWidget'
import OptimalWindows from '@/components/forecast/OptimalWindows'
import AskPeak from '@/components/forecast/AskPeak'
import ModelComparison from '@/components/forecast/ModelComparison'
import WeekQualityBar from '@/components/forecast/WeekQualityBar'
import BuoyReadings from '@/components/forecast/BuoyReadings'
import SpotCams from '@/components/spots/SpotCams'
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
import SessionLogButton from '@/components/sessions/SessionLogButton'
import SpotActions from './SpotActions'
import Reveal from '@/components/Reveal'

export const revalidate = 300

interface PageProps {
  params: Promise<{ id: string }>
}

async function loadData(slug: string) {
  // Fetch spot and forecast independently — a forecast failure should not 404 the page
  let spot = null
  let forecast = null
  let error: string | null = null

  try {
    spot = await getSpot(slug)
  } catch (err) {
    return { spot: null, forecast: null, error: String(err) }
  }

  try {
    // Request 7 days — ensemble models are capped at 7d anyway
    forecast = await getForecast(slug, 7, true)
  } catch {
    // NUC offline — fall back to Open-Meteo marine directly
    try {
      forecast = await getForecastFallback(spot, 7)
    } catch (fallbackErr) {
      error = String(fallbackErr)
    }
  }

  return { spot, forecast, error }
}

const CONDITION_CONFIG = {
  firing:   { textColor: '#F97316', badgeBg: 'rgba(249,115,22,0.15)',   badgeBorder: 'rgba(249,115,22,0.35)',  heroClass: 'hero-firing',   label: '🔥 FIRING',   glow: '#F97316' },
  pumping:  { textColor: '#06B6D4', badgeBg: 'rgba(6,182,212,0.15)',    badgeBorder: 'rgba(6,182,212,0.35)',   heroClass: 'hero-pumping',  label: '🤙 PUMPING',  glow: '#06B6D4' },
  fun:      { textColor: '#3B82F6', badgeBg: 'rgba(59,130,246,0.15)',   badgeBorder: 'rgba(59,130,246,0.35)',  heroClass: 'hero-fun',      label: '😎 FUN',      glow: '#3B82F6' },
  worth_it: { textColor: '#6366F1', badgeBg: 'rgba(99,102,241,0.15)',   badgeBorder: 'rgba(99,102,241,0.35)',  heroClass: 'hero-worth_it', label: '🏄 WORTH IT', glow: '#6366F1' },
  flat:     { textColor: '#475569', badgeBg: 'rgba(71,85,105,0.2)',     badgeBorder: 'rgba(71,85,105,0.3)',    heroClass: 'hero-flat',     label: '😴 FLAT',     glow: '#475569' },
  no_data:  { textColor: '#F59E0B', badgeBg: 'rgba(245,158,11,0.15)',   badgeBorder: 'rgba(245,158,11,0.3)',   heroClass: 'hero-no_data',  label: '📡 BASIC FORECAST', glow: '#2E5568' },
}

export default async function SpotPage({ params }: PageProps) {
  const { id } = await params
  const isPremium = true
  const { spot, forecast, error } = await loadData(id)

  if (!spot) notFound()

  const isFallback = forecast?.model_sources?.includes('open_meteo_fallback') ?? false
  const currentHour: ForecastHour | undefined = forecast?.hours[0]
  const label  = getConditionLabel(currentHour?.quality_score)
  const config = {
    ...(CONDITION_CONFIG[label as keyof typeof CONDITION_CONFIG] ?? CONDITION_CONFIG.no_data),
    // When on fallback, override the badge label to be more informative
    ...(label === 'no_data' && isFallback ? { label: '📡 BASIC FORECAST' } : {}),
    ...(label === 'no_data' && !isFallback && !forecast ? { label: '⚠️ NO DATA' } : {}),
  }

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
    <div className="h-full overflow-y-auto">
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

              <SpotActions
                spotSlug={spot.slug}
                spotName={spot.name}
                region={spot.region}
                currentConditions={currentHour ? {
                  wave_height_face_m: currentHour.wave_height_face_m,
                  wave_height_m: currentHour.wave_height_m,
                  wave_period_s: currentHour.wave_period_s,
                  wind_speed_ms: currentHour.wind_speed_ms,
                  wind_direction: currentHour.wind_direction,
                  quality_score: currentHour.quality_score,
                  forecast_time: currentHour.forecast_time,
                  water_temp_c: currentHour.water_temp_c,
                } : spot.current_conditions}
              />
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
                  boxShadow: label === 'no_data' ? `0 0 0 0 rgba(245,158,11,0.4)` : `0 4px 20px ${config.glow}20`,
                  animation: label === 'no_data' ? 'offlinePulse 2s ease-in-out infinite' : undefined,
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
          {currentHour ? (
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
              {currentHour.water_temp_c != null && (
                <WaterTempStat tempC={currentHour.water_temp_c} color={config.textColor} />
              )}
            </div>
          ) : (
            <div className="mt-6 pt-5" style={{ borderTop: '1px solid rgba(6,182,212,0.08)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '28px 28px', marginBottom: 10 }}>
                {['Height', 'Period', 'Swell', 'Wind', 'Tide'].map(lbl => (
                  <CondStat key={lbl} label={lbl} value="--" color="rgba(245,158,11,0.35)" offline />
                ))}
              </div>
              <p style={{
                fontFamily: 'var(--font-data)',
                fontSize: 10,
                color: 'rgba(245,158,11,0.55)',
                letterSpacing: '0.06em',
                marginTop: 6,
              }}>
                Awaiting live data — NUC server offline
              </p>
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

        {/* ── CAMS (Surfline-style, primary section) ── */}
        <Reveal>
          <SectionHeader label="Surf Cams" />
          <SpotCams spot={spot} />
        </Reveal>

        {/* ── REPORT / AI ANALYSIS ── */}
        {intelligence ? (
          <Reveal delay={0.05}>
            <SectionHeader label="Conditions Report" />
            <ConditionsIntelligence data={intelligence} spotName={spot.name} />
          </Reveal>
        ) : (
          <Reveal delay={0.05}>
            <SectionHeader label="Conditions Report" />
            <div className="glass-card p-5" style={{
              border: '1px solid rgba(245,158,11,0.2)',
              background: 'rgba(245,158,11,0.04)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(245,158,11,0.12)',
                border: '1px solid rgba(245,158,11,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                flexShrink: 0,
              }}>⚠️</div>
              <div>
                <div style={{
                  fontFamily: 'var(--font-display)',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#F59E0B',
                  marginBottom: 4,
                }}>NUC server offline</div>
                <p style={{
                  fontSize: 12,
                  color: 'var(--spray)',
                  lineHeight: 1.6,
                  margin: 0,
                }}>
                  Showing last known data for {spot.name}. Live conditions, AI analysis, and real-time updates will resume when the forecast server reconnects.
                </p>
              </div>
            </div>
          </Reveal>
        )}

        {/* ── FORECAST (main feature — Surfline-style with day tabs + chart + table) ── */}
        <Reveal delay={0.1}>
          <SectionHeader
            label={`${forecast?.days_available ?? 7}-Day Forecast`}
            sub={
              forecast
                ? forecast.model_sources?.includes('open_meteo_fallback')
                  ? 'Open-Meteo · NUC offline — basic forecast'
                  : `Open-Meteo · ML-corrected`
                : undefined
            }
          />
          {error ? (
            <div className="glass-card p-5" style={{ color: '#EF4444', fontSize: 13 }}>
              Forecast unavailable — backend may be starting up
            </div>
          ) : forecast ? (
            <div className="glass-card" style={{ padding: '20px 20px 12px' }}>
              <ForecastTimeline hours={forecast.hours} />
            </div>
          ) : (
            <div className="glass-card p-8" style={{ textAlign: 'center', color: 'var(--deep-text)', fontSize: 13 }}>
              Loading forecast...
            </div>
          )}
        </Reveal>

        {/* ── WIND / TIDE / STOKE trinity ── */}
        <Reveal delay={0.05}>
          <SectionHeader label="Conditions Detail" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card title="Peak Score™" accent={config.glow}>
              <StokeScoreWidget spotId={spot.slug} spotName={spot.name} currentHour={currentHour} />
            </Card>
            <Card title="Wind Rose" subtitle="24h">
              <WindRoseWidget readings={windReadings} offshoreDirection={spot.optimal_wind_direction} />
            </Card>
            <Card title="Tides" subtitle="48h">
              <TideChartWidget points={tidePoints} currentTime={currentHour?.forecast_time} />
            </Card>
          </div>
        </Reveal>

        {/* ── WEEK OVERVIEW ── */}
        {forecast && forecast.hours.length > 0 && (
          <Reveal>
            <SectionHeader label="7-Day Overview" />
            <div className="glass-card p-4">
              <WeekQualityBar hours={forecast.hours} />
            </div>
          </Reveal>
        )}

        {/* ── LIVE BUOY DATA ── */}
        {spot.nearest_buoy_id && (
          <Reveal>
            <SectionHeader label="Live Buoy Data" sub={`NDBC Station ${spot.nearest_buoy_id}`} />
            <BuoyReadings buoyId={spot.nearest_buoy_id} spotName={spot.name} />
          </Reveal>
        )}

        {/* ── OPTIMAL WINDOWS ── */}
        <Reveal>
          <SectionHeader label="Optimal Sessions" sub="best windows next 14 days" />
          <Card>
            <OptimalWindows spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />
          </Card>
        </Reveal>

        {/* ── SWELL SPECTRUM ── */}
        {spectrumSnapshots.length > 0 && (
          <Reveal>
            <SectionHeader label="Swell Spectrum" sub="wave energy by period" />
            <Card>
              <SwellSpectrumWidget snapshots={spectrumSnapshots} />
            </Card>
          </Reveal>
        )}

        {/* ── SWELL TRACKER ── */}
        <Reveal>
          <SectionHeader label="Swell Tracker" sub="named events · 16-day" />
          <Card>
            <SwellTracker spotId={spot.slug} />
          </Card>
        </Reveal>

        {/* ── MODEL COMPARISON ── */}
        <Reveal>
          <SectionHeader label="Model Comparison" sub="ECMWF · GFS · ICON" />
          <Card>
            <ModelComparison modelForecasts={forecast?.model_forecasts ?? {}} isPremium={isPremium} />
          </Card>
        </Reveal>

        {/* ── GEAR ── */}
        <Reveal>
          <SectionHeader label="Gear Recommendation" />
          <Card>
            <GearRecommendation
              spotId={spot.slug}
              faceHeightM={(currentHour?.wave_height_face_m ?? currentHour?.wave_height_m) ?? undefined}
              wavePeriodS={currentHour?.wave_period_s ?? undefined}
            />
          </Card>
        </Reveal>

        {/* ── SAFETY ── */}
        <Reveal>
          <SafetyPanel spotId={spot.slug} spotName={spot.name} />
        </Reveal>

        {/* ── SPOT INFO FOOTER ── */}
        <div
          className="glass-card"
          style={{ padding: '14px 18px', marginBottom: 8 }}
        >
          <div style={{
            fontFamily: 'var(--font-data)',
            fontSize: 9,
            color: 'var(--deep-text)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            marginBottom: 10,
          }}>Spot Details</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <MetaItem label="Optimal Swell" value={`${spot.optimal_swell_direction ?? '--'}° ± ${spot.optimal_swell_direction_range}°`} />
            <MetaItem label="Period" value={`${spot.optimal_period_min}–${spot.optimal_period_max}s`} />
            <MetaItem label="Size" value={`${formatWaveHeight(spot.optimal_size_min)} – ${formatWaveHeight(spot.optimal_size_max)}`} />
            <MetaItem label="Break Type" value={spot.break_type} />
            {spot.nearest_buoy_id && <MetaItem label="Nearest Buoy" value={`NDBC ${spot.nearest_buoy_id}`} />}
            {spot.skill_minimum && <MetaItem label="Skill Level" value={`${spot.skill_minimum}+`} />}
            <MetaItem label="Timezone" value={spot.timezone.replace('America/', '')} />
            {spot.swan_enabled && <MetaItem label="Physics Model" value="⚡ SWAN enabled" />}
          </div>
        </div>

      </div>

      {/* Ask Stoke — floating AI chat */}
      <AskPeak spotId={spot.slug} spotName={spot.name} isPremium={isPremium} />

      {/* Sticky Log Session bar */}
      <SessionLogButton
        spotSlug={spot.slug}
        spotName={spot.name}
        conditionsSummary={buildConditionsSummary(currentHour)}
        prefilledConditions={{
          wave_height_face_m: (currentHour?.wave_height_face_m ?? currentHour?.wave_height_m) ?? undefined,
          wave_period_s: currentHour?.wave_period_s ?? undefined,
        }}
      />
    </div>
    </div>
  )
}

function buildConditionsSummary(hour: ForecastHour | undefined): string {
  if (!hour) return ''
  const parts: string[] = []
  const h = hour.wave_height_face_m ?? hour.wave_height_m
  if (h != null) parts.push(`${(h * 3.28084).toFixed(0)}ft`)
  if (hour.wave_period_s != null) parts.push(`${hour.wave_period_s.toFixed(0)}s`)
  if (hour.wind_speed_ms != null) {
    const w = hour.wind_speed_ms
    parts.push(w < 5 ? 'calm' : w < 10 ? 'light winds' : w < 15 ? 'moderate' : 'windy')
  }
  return parts.join(' · ')
}

function SectionHeader({ label, sub }: { label: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 10 }}>
      <h2 style={{
        fontFamily: 'var(--font-display)',
        fontSize: 15,
        fontWeight: 700,
        color: 'var(--foam)',
        letterSpacing: '0.01em',
      }}>{label}</h2>
      {sub && (
        <span style={{
          fontFamily: 'var(--font-data)',
          fontSize: 10,
          color: 'var(--deep-text)',
          letterSpacing: '0.04em',
        }}>{sub}</span>
      )}
    </div>
  )
}

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        color: 'var(--deep-text)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 3,
      }}>{label}</div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 12,
        color: 'var(--spray)',
        textTransform: 'capitalize',
      }}>{value}</div>
    </div>
  )
}

function wetsuitRecommendation(tempF: number): string {
  if (tempF < 55) return '4/3mm+'
  if (tempF < 62) return '3/2mm'
  if (tempF < 68) return 'Spring suit'
  return 'Boardshorts'
}

function WaterTempStat({ tempC, color }: { tempC: number; color: string }) {
  const tempF = Math.round(tempC * 9 / 5 + 32)
  const wetsuit = wetsuitRecommendation(tempF)
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
        Water Temp
      </div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 18,
        fontWeight: 600,
        color: color,
        lineHeight: 1,
      }}>
        {tempF}°F
      </div>
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 9,
        color: 'var(--spray)',
        letterSpacing: '0.06em',
        marginTop: 4,
        background: 'rgba(6,182,212,0.08)',
        border: '1px solid rgba(6,182,212,0.15)',
        borderRadius: 4,
        padding: '2px 6px',
        display: 'inline-block',
      }}>
        {wetsuit}
      </div>
    </div>
  )
}

function CondStat({ label, value, color, offline }: { label: string; value: string; color: string; offline?: boolean }) {
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
        opacity: offline ? 0.45 : 1,
        background: offline ? 'linear-gradient(90deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.18) 50%, rgba(245,158,11,0.08) 100%)' : undefined,
        backgroundSize: offline ? '200% 100%' : undefined,
        animation: offline ? 'shimmer 2.4s ease-in-out infinite' : undefined,
        borderRadius: offline ? 4 : undefined,
        padding: offline ? '2px 6px' : undefined,
      }}>
        {value}
      </div>
    </div>
  )
}

function Card({ title, subtitle, children, accent }: { title?: string; subtitle?: string; children: ReactNode; accent?: string }) {
  return (
    <div className="glass-card p-5"
         style={accent ? { boxShadow: `0 0 0 1px ${accent}12, 0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(6,182,212,0.06)` } : {}}>
      {title && (
        <div className="flex items-baseline gap-2.5 mb-4">
          <h3 style={{
            fontFamily: 'var(--font-display)',
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--foam)',
            letterSpacing: '0.01em',
          }}>{title}</h3>
          {subtitle && (
            <span style={{ fontFamily: 'var(--font-data)', fontSize: 10, color: 'var(--deep-text)', letterSpacing: '0.04em' }}>
              {subtitle}
            </span>
          )}
        </div>
      )}
      {children}
    </div>
  )
}
