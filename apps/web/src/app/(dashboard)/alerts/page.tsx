'use client'

import { useState, useEffect, useCallback, useId } from 'react'
import {
  Bell,
  Plus,
  Trash2,
  X,
  ChevronDown,
  Zap,
} from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────

interface Alert {
  id: string
  name: string
  spotSlug: string
  spotName: string
  spotRegion: string
  minWaveHeightFt?: number
  minPeriodS?: number
  maxWindKt?: number
  minQualityScore?: number
  days: number[] // 0=Sun … 6=Sat
  timeWindow: 'morning' | 'afternoon' | 'evening' | 'anytime'
  active: boolean
  createdAt: string
}

interface SpotOption {
  slug: string
  name: string
  region: string
}

// ── Constants ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'terrain_alerts'
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TIME_WINDOWS: { value: Alert['timeWindow']; label: string; sub: string }[] = [
  { value: 'morning',   label: 'Morning',   sub: '5am – 10am'  },
  { value: 'afternoon', label: 'Afternoon', sub: '10am – 2pm'  },
  { value: 'evening',   label: 'Evening',   sub: '2pm – 7pm'   },
  { value: 'anytime',   label: 'Anytime',   sub: 'All day'     },
]

// ── localStorage helpers ──────────────────────────────────────────────────

function loadAlerts(): Alert[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as Alert[]) : []
  } catch {
    return []
  }
}

function saveAlerts(alerts: Alert[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts))
  } catch {
    // storage full or blocked
  }
}

// ── Threshold summary ─────────────────────────────────────────────────────

function buildThresholdSummary(alert: Alert): string {
  const parts: string[] = []
  if (alert.minWaveHeightFt != null) parts.push(`≥ ${alert.minWaveHeightFt}ft`)
  if (alert.minPeriodS       != null) parts.push(`≥ ${alert.minPeriodS}s`)
  if (alert.maxWindKt        != null) parts.push(`≤ ${alert.maxWindKt}kt wind`)
  if (alert.minQualityScore  != null) parts.push(`quality ≥ ${alert.minQualityScore}`)
  return parts.length ? parts.join(' · ') : 'Any conditions'
}

function buildScheduleSummary(alert: Alert): string {
  const dayPart =
    alert.days.length === 7
      ? 'Every day'
      : alert.days.length === 0
      ? 'No days'
      : alert.days.map(d => DAY_LABELS[d]).join(', ')

  const windowLabel = TIME_WINDOWS.find(w => w.value === alert.timeWindow)?.label ?? 'Anytime'
  return `${dayPart} · ${windowLabel}`
}

// ── Slider sub-component ──────────────────────────────────────────────────

function LabeledSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  enabled,
  onToggle,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  enabled: boolean
  onToggle: () => void
  onChange: (v: number) => void
}) {
  return (
    <div
      style={{
        background: enabled ? 'rgba(6,182,212,0.06)' : 'rgba(255,255,255,0.02)',
        border: `1px solid ${enabled ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 10,
        padding: '12px 14px',
        transition: 'background 0.15s, border-color 0.15s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: enabled ? 10 : 0 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 12,
          fontWeight: 600,
          color: enabled ? 'var(--foam)' : 'var(--deep-text)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          transition: 'color 0.15s',
        }}>
          {label}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {enabled && (
            <span style={{
              fontFamily: 'var(--font-data)',
              fontSize: 13,
              color: '#06B6D4',
              fontWeight: 700,
            }}>
              {value}{unit}
            </span>
          )}
          {/* Toggle */}
          <button
            onClick={onToggle}
            style={{
              width: 36,
              height: 20,
              borderRadius: 10,
              background: enabled ? '#06B6D4' : 'rgba(255,255,255,0.1)',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
              transition: 'background 0.2s',
              flexShrink: 0,
            }}
            aria-pressed={enabled}
            aria-label={`${enabled ? 'Disable' : 'Enable'} ${label} threshold`}
          >
            <div style={{
              position: 'absolute',
              top: 2,
              left: enabled ? 18 : 2,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: 'white',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
            }} />
          </button>
        </div>
      </div>

      {enabled && (
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          style={{
            width: '100%',
            accentColor: '#06B6D4',
            cursor: 'pointer',
            height: 4,
          }}
        />
      )}
    </div>
  )
}

// ── Alert creation form ───────────────────────────────────────────────────

interface FormState {
  spotSlug: string
  spotName: string
  spotRegion: string
  spotSearch: string
  name: string
  enableHeight: boolean
  minWaveHeightFt: number
  enablePeriod: boolean
  minPeriodS: number
  enableWind: boolean
  maxWindKt: number
  enableQuality: boolean
  minQualityScore: number
  days: number[]
  timeWindow: Alert['timeWindow']
}

function defaultForm(): FormState {
  return {
    spotSlug: '',
    spotName: '',
    spotRegion: '',
    spotSearch: '',
    name: '',
    enableHeight: false,
    minWaveHeightFt: 5,
    enablePeriod: false,
    minPeriodS: 10,
    enableWind: false,
    maxWindKt: 15,
    enableQuality: false,
    minQualityScore: 6,
    days: [1, 2, 3, 4, 5], // Mon-Fri
    timeWindow: 'morning',
  }
}

function AlertForm({
  spots,
  onSave,
  onCancel,
}: {
  spots: SpotOption[]
  onSave: (alert: Alert) => void
  onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(defaultForm)
  const [spotDropdownOpen, setSpotDropdownOpen] = useState(false)
  const searchId = useId()

  const filteredSpots = form.spotSearch.trim()
    ? spots.filter(s =>
        s.name.toLowerCase().includes(form.spotSearch.toLowerCase()) ||
        s.region.toLowerCase().includes(form.spotSearch.toLowerCase())
      ).slice(0, 8)
    : spots.slice(0, 8)

  function selectSpot(s: SpotOption) {
    const autoName = `${s.name} fires`
    setForm(f => ({ ...f, spotSlug: s.slug, spotName: s.name, spotRegion: s.region, spotSearch: s.name, name: autoName }))
    setSpotDropdownOpen(false)
  }

  function toggleDay(d: number) {
    setForm(f => ({
      ...f,
      days: f.days.includes(d) ? f.days.filter(x => x !== d) : [...f.days, d].sort((a, b) => a - b),
    }))
  }

  function handleSave() {
    if (!form.spotSlug) return
    const alert: Alert = {
      id: crypto.randomUUID(),
      name: form.name || `${form.spotName} fires`,
      spotSlug: form.spotSlug,
      spotName: form.spotName,
      spotRegion: form.spotRegion,
      minWaveHeightFt: form.enableHeight ? form.minWaveHeightFt : undefined,
      minPeriodS:      form.enablePeriod  ? form.minPeriodS      : undefined,
      maxWindKt:       form.enableWind    ? form.maxWindKt        : undefined,
      minQualityScore: form.enableQuality ? form.minQualityScore  : undefined,
      days: form.days,
      timeWindow: form.timeWindow,
      active: true,
      createdAt: new Date().toISOString(),
    }
    onSave(alert)
  }

  const canSave = form.spotSlug !== '' && (
    form.enableHeight || form.enablePeriod || form.enableWind || form.enableQuality
  )

  return (
    <div
      style={{
        background: 'rgba(6,12,24,0.92)',
        border: '1px solid rgba(6,182,212,0.18)',
        borderRadius: 16,
        padding: 24,
        marginBottom: 28,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <span style={{
          fontFamily: 'var(--font-display)',
          fontSize: 15,
          fontWeight: 700,
          color: '#06B6D4',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
        }}>
          New Alert
        </span>
        <button
          onClick={onCancel}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 8,
            color: 'var(--deep-text)',
            cursor: 'pointer',
            padding: '4px 8px',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="Cancel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Spot selector */}
        <div style={{ position: 'relative' }}>
          <label
            htmlFor={searchId}
            style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--deep-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}
          >
            Spot
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id={searchId}
              type="text"
              placeholder="Search spots…"
              value={form.spotSearch}
              onChange={e => {
                setForm(f => ({ ...f, spotSearch: e.target.value, spotSlug: '', spotName: '', spotRegion: '' }))
                setSpotDropdownOpen(true)
              }}
              onFocus={() => setSpotDropdownOpen(true)}
              autoComplete="off"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(6,182,212,0.18)',
                borderRadius: 10,
                padding: '10px 36px 10px 14px',
                color: 'var(--foam)',
                fontFamily: 'var(--font-display)',
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <ChevronDown
              className="w-4 h-4"
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--deep-text)',
                pointerEvents: 'none',
              }}
            />
          </div>

          {spotDropdownOpen && filteredSpots.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 50,
                marginTop: 4,
                background: 'rgba(6,12,24,0.98)',
                border: '1px solid rgba(6,182,212,0.2)',
                borderRadius: 10,
                overflow: 'hidden',
                boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              }}
            >
              {filteredSpots.map(s => (
                <button
                  key={s.slug}
                  onMouseDown={() => selectSpot(s)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    cursor: 'pointer',
                    color: 'var(--foam)',
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.08)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
                >
                  {s.name}
                  <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--deep-text)' }}>{s.region}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Alert name */}
        <div>
          <label
            style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--deep-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}
          >
            Alert name
          </label>
          <input
            type="text"
            placeholder="e.g. Mavericks fires"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{
              width: '100%',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(6,182,212,0.18)',
              borderRadius: 10,
              padding: '10px 14px',
              color: 'var(--foam)',
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Thresholds */}
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--deep-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Condition thresholds <span style={{ opacity: 0.5 }}>(enable at least one)</span>
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <LabeledSlider
              label="Wave height min"
              value={form.minWaveHeightFt}
              min={1} max={20} step={1} unit="ft"
              enabled={form.enableHeight}
              onToggle={() => setForm(f => ({ ...f, enableHeight: !f.enableHeight }))}
              onChange={v => setForm(f => ({ ...f, minWaveHeightFt: v }))}
            />
            <LabeledSlider
              label="Wave period min"
              value={form.minPeriodS}
              min={6} max={20} step={1} unit="s"
              enabled={form.enablePeriod}
              onToggle={() => setForm(f => ({ ...f, enablePeriod: !f.enablePeriod }))}
              onChange={v => setForm(f => ({ ...f, minPeriodS: v }))}
            />
            <LabeledSlider
              label="Wind speed max"
              value={form.maxWindKt}
              min={5} max={40} step={5} unit="kt"
              enabled={form.enableWind}
              onToggle={() => setForm(f => ({ ...f, enableWind: !f.enableWind }))}
              onChange={v => setForm(f => ({ ...f, maxWindKt: v }))}
            />
            <LabeledSlider
              label="Quality score min"
              value={form.minQualityScore}
              min={4} max={10} step={1} unit=""
              enabled={form.enableQuality}
              onToggle={() => setForm(f => ({ ...f, enableQuality: !f.enableQuality }))}
              onChange={v => setForm(f => ({ ...f, minQualityScore: v }))}
            />
          </div>
        </div>

        {/* Days of week */}
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--deep-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Days
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {DAY_LABELS.map((label, idx) => {
              const on = form.days.includes(idx)
              return (
                <button
                  key={label}
                  onClick={() => toggleDay(idx)}
                  style={{
                    padding: '5px 11px',
                    borderRadius: 20,
                    fontFamily: 'var(--font-display)',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.04em',
                    cursor: 'pointer',
                    border: `1px solid ${on ? '#06B6D4' : 'rgba(255,255,255,0.1)'}`,
                    background: on ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
                    color: on ? '#22D3EE' : 'var(--deep-text)',
                    transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Time window */}
        <div>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 600, color: 'var(--deep-text)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            Time window
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {TIME_WINDOWS.map(w => {
              const on = form.timeWindow === w.value
              return (
                <button
                  key={w.value}
                  onClick={() => setForm(f => ({ ...f, timeWindow: w.value }))}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 10,
                    textAlign: 'left',
                    border: `1px solid ${on ? '#06B6D4' : 'rgba(255,255,255,0.08)'}`,
                    background: on ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 600, color: on ? '#22D3EE' : 'var(--foam)', marginBottom: 2 }}>
                    {w.label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-data)', fontSize: 11, color: 'var(--deep-text)' }}>
                    {w.sub}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            onClick={handleSave}
            disabled={!canSave}
            style={{
              flex: 1,
              padding: '11px 0',
              borderRadius: 10,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              border: '1px solid #06B6D4',
              background: canSave ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.03)',
              color: canSave ? '#22D3EE' : 'var(--deep-text)',
              cursor: canSave ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s',
            }}
          >
            Save Alert
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: '11px 20px',
              borderRadius: 10,
              fontFamily: 'var(--font-display)',
              fontSize: 13,
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--deep-text)',
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Alert card ────────────────────────────────────────────────────────────

function AlertCard({
  alert,
  onToggle,
  onDelete,
}: {
  alert: Alert
  onToggle: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div
      style={{
        background: 'rgba(6,12,24,0.85)',
        border: `1px solid ${alert.active ? 'rgba(6,182,212,0.12)' : 'rgba(255,255,255,0.06)'}`,
        borderRadius: 16,
        padding: '18px 20px',
        transition: 'border-color 0.2s',
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        {/* Status badge */}
        <div
          style={{
            padding: '3px 8px',
            borderRadius: 6,
            fontFamily: 'var(--font-data)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            flexShrink: 0,
            marginTop: 2,
            ...(alert.active
              ? { background: 'rgba(6,182,212,0.15)', color: '#22D3EE', border: '1px solid rgba(6,182,212,0.3)' }
              : { background: 'rgba(255,255,255,0.05)', color: 'var(--deep-text)', border: '1px solid rgba(255,255,255,0.08)' }
            ),
          }}
        >
          {alert.active ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap className="w-3 h-3" style={{ display: 'inline' }} />
              ACTIVE
            </span>
          ) : 'PAUSED'}
        </div>

        {/* Name + spot */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 15,
            fontWeight: 700,
            color: 'var(--foam)',
            marginBottom: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            {alert.name}
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--deep-text)' }}>
            {alert.spotName}
            {alert.spotRegion && (
              <span style={{ opacity: 0.6 }}> · {alert.spotRegion}</span>
            )}
          </div>
        </div>

        {/* Active toggle */}
        <button
          onClick={() => onToggle(alert.id)}
          style={{
            width: 40,
            height: 22,
            borderRadius: 11,
            background: alert.active ? '#06B6D4' : 'rgba(255,255,255,0.1)',
            border: 'none',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s',
            flexShrink: 0,
          }}
          aria-pressed={alert.active}
          aria-label={alert.active ? 'Pause alert' : 'Activate alert'}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: alert.active ? 20 : 3,
            width: 16,
            height: 16,
            borderRadius: '50%',
            background: 'white',
            transition: 'left 0.2s',
            boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
          }} />
        </button>
      </div>

      {/* Threshold summary */}
      <div style={{
        fontFamily: 'var(--font-data)',
        fontSize: 12,
        color: '#06B6D4',
        marginBottom: 6,
        letterSpacing: '0.02em',
      }}>
        {buildThresholdSummary(alert)}
      </div>

      {/* Schedule */}
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        color: 'var(--deep-text)',
        marginBottom: 14,
      }}>
        {buildScheduleSummary(alert)}
      </div>

      {/* Delete */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {confirmDelete ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--deep-text)' }}>
              Delete this alert?
            </span>
            <button
              onClick={() => onDelete(alert.id)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid rgba(239,68,68,0.4)',
                background: 'rgba(239,68,68,0.12)',
                color: '#F87171',
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--deep-text)',
                fontFamily: 'var(--font-display)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'none',
              color: 'var(--deep-text)',
              fontFamily: 'var(--font-display)',
              fontSize: 12,
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = '#F87171'
              e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'var(--deep-text)'
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
            }}
            aria-label="Delete alert"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '64px 24px',
      gap: 16,
    }}>
      <div style={{
        width: 72,
        height: 72,
        borderRadius: 20,
        background: 'rgba(6,182,212,0.06)',
        border: '1px solid rgba(6,182,212,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
      }}>
        <Bell className="w-8 h-8" style={{ color: 'rgba(6,182,212,0.35)' }} />
      </div>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 20,
        fontWeight: 700,
        color: 'var(--foam)',
        letterSpacing: '0.04em',
      }}>
        No alerts set
      </div>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 14,
        color: 'var(--deep-text)',
        maxWidth: 320,
        lineHeight: 1.6,
      }}>
        Start tracking your spots and we&apos;ll notify you when conditions hit your thresholds.
      </p>
      <button
        onClick={onNew}
        style={{
          marginTop: 8,
          padding: '12px 28px',
          borderRadius: 12,
          fontFamily: 'var(--font-display)',
          fontSize: 13,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          border: 'none',
          background: 'linear-gradient(135deg, rgba(6,182,212,0.9) 0%, rgba(6,182,212,0.7) 100%)',
          color: '#060D1A',
          cursor: 'pointer',
          boxShadow: '0 4px 20px rgba(6,182,212,0.25)',
          transition: 'opacity 0.15s, box-shadow 0.15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.opacity = '0.9'
          e.currentTarget.style.boxShadow = '0 4px 28px rgba(6,182,212,0.4)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.opacity = '1'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(6,182,212,0.25)'
        }}
      >
        Create Your First Alert
      </button>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [spots, setSpots] = useState<SpotOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [spotsLoaded, setSpotsLoaded] = useState(false)

  // Load persisted alerts on mount
  useEffect(() => {
    setAlerts(loadAlerts())
  }, [])

  // Load spots list for selector
  useEffect(() => {
    if (spotsLoaded) return
    fetch('/spots.json')
      .then(r => r.json())
      .then((data: { name: string; slug: string; region: string }[]) => {
        setSpots(
          data
            .map(s => ({ slug: s.slug, name: s.name, region: s.region ?? '' }))
            .sort((a, b) => a.name.localeCompare(b.name))
        )
        setSpotsLoaded(true)
      })
      .catch(() => setSpotsLoaded(true))
  }, [spotsLoaded])

  const persistAndSet = useCallback((next: Alert[]) => {
    setAlerts(next)
    saveAlerts(next)
  }, [])

  function handleSave(alert: Alert) {
    persistAndSet([alert, ...alerts])
    setShowForm(false)
  }

  function handleToggle(id: string) {
    persistAndSet(alerts.map(a => a.id === id ? { ...a, active: !a.active } : a))
  }

  function handleDelete(id: string) {
    persistAndSet(alerts.filter(a => a.id !== id))
  }

  return (
    <div
      style={{
        minHeight: '100%',
        background: '#060D1A',
        overflowY: 'auto',
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch' as React.CSSProperties['WebkitOverflowScrolling'],
      }}
    >
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 20px 48px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, gap: 16 }}>
          <div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 28,
              fontWeight: 800,
              color: '#06B6D4',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
              lineHeight: 1.1,
            }}>
              Alerts
            </h1>
            <p style={{
              fontFamily: 'var(--font-display)',
              fontSize: 14,
              color: 'var(--deep-text)',
              marginTop: 6,
              marginBottom: 0,
            }}>
              Get notified when your spots fire
            </p>
          </div>

          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '9px 16px',
                borderRadius: 10,
                fontFamily: 'var(--font-display)',
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.04em',
                border: '1px solid #06B6D4',
                background: 'rgba(6,182,212,0.08)',
                color: '#22D3EE',
                cursor: 'pointer',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.15)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(6,182,212,0.08)' }}
            >
              <Plus className="w-4 h-4" />
              New Alert
            </button>
          )}
        </div>

        {/* Inline creation form */}
        {showForm && (
          <AlertForm
            spots={spots}
            onSave={handleSave}
            onCancel={() => setShowForm(false)}
          />
        )}

        {/* Alerts list or empty state */}
        {alerts.length === 0 && !showForm ? (
          <EmptyState onNew={() => setShowForm(true)} />
        ) : alerts.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={{
              fontFamily: 'var(--font-data)',
              fontSize: 11,
              color: 'var(--deep-text)',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}>
              {alerts.length} alert{alerts.length !== 1 ? 's' : ''} · {alerts.filter(a => a.active).length} active
            </p>
            {alerts.map(alert => (
              <AlertCard
                key={alert.id}
                alert={alert}
                onToggle={handleToggle}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
