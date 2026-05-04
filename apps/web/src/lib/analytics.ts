/**
 * Analytics — thin wrapper around Plausible.
 *
 * Add the Plausible script to app/layout.tsx to activate:
 *   <script defer data-domain="nswell.zacharyjcollins.com" src="https://plausible.io/js/script.js" />
 *
 * All calls are no-ops if Plausible is not loaded (dev / before setup).
 * Goal names must match what's configured in the Plausible dashboard.
 */

declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void
  }
}

function track(event: string, props?: Record<string, string | number>) {
  if (typeof window === 'undefined') return
  window.plausible?.(event, props ? { props } : undefined)
}

// ─── Spot events ──────────────────────────────────────────────────────────────

export function trackSpotView(spotSlug: string) {
  track('Spot View', { spot: spotSlug })
}

export function trackForecastShare(spotSlug: string) {
  track('Forecast Share', { spot: spotSlug })
}

// ─── Session events ───────────────────────────────────────────────────────────

export function trackSessionLogged(spotSlug: string) {
  track('Session Logged', { spot: spotSlug })
}

export function trackForecastRating(spotSlug: string, rating: 'up' | 'down') {
  track('Forecast Rated', { spot: spotSlug, rating })
}

// ─── Upgrade events ───────────────────────────────────────────────────────────

export function trackUpgradeClick(feature: string, fromTier: string) {
  track('Upgrade Click', { feature, from_tier: fromTier })
}

export function trackUpgradeSuccess(plan: string) {
  track('Upgrade Success', { plan })
}

// ─── NLQ events ───────────────────────────────────────────────────────────────

export function trackNLQQuery(spotSlug: string) {
  track('NLQ Query', { spot: spotSlug })
}

// ─── Spot submission ──────────────────────────────────────────────────────────

export function trackSpotSubmission(region: string) {
  track('Spot Submitted', { region })
}
