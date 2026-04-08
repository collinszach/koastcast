/**
 * Feature gating for TERRAIN subscription tiers.
 * Free / Pro ($4.99/mo) / Explorer ($9.99/mo)
 */

export type Tier = 'free' | 'pro' | 'explorer'

export const FEATURE_GATES = {
  forecast_days: { free: 7, pro: 16, explorer: 16 },
  spots_saved: { free: 3, pro: 20, explorer: 50 },
  stoke_score: { free: false, pro: true, explorer: true },
  optimal_windows: { free: false, pro: true, explorer: true },
  nlq_queries_per_day: { free: 0, pro: 10, explorer: 50 },
  crowd_prediction: { free: false, pro: true, explorer: true },
  spectral_data: { free: false, pro: true, explorer: true },
  b2b_api_access: { free: false, pro: false, explorer: true },
  ensemble_forecast: { free: false, pro: false, explorer: true },
  push_notifications: { free: false, pro: true, explorer: true },
} as const

export type FeatureKey = keyof typeof FEATURE_GATES

/**
 * Check if a tier has access to a boolean feature.
 */
export function canAccess(tier: Tier, feature: FeatureKey): boolean {
  const gate = FEATURE_GATES[feature]
  const val = gate[tier]
  if (typeof val === 'boolean') return val
  if (typeof val === 'number') return val > 0
  return false
}

/**
 * Get the numeric limit for a feature at a given tier.
 */
export function getLimit(tier: Tier, feature: FeatureKey): number {
  const gate = FEATURE_GATES[feature]
  const val = gate[tier]
  return typeof val === 'number' ? val : val ? Infinity : 0
}

/**
 * Check if a tier is premium (pro or explorer).
 */
export function isPremiumTier(tier: Tier | null | undefined): boolean {
  return tier === 'pro' || tier === 'explorer'
}

/**
 * Get the display name for a tier.
 */
export function tierLabel(tier: Tier): string {
  const labels: Record<Tier, string> = {
    free: 'Free',
    pro: 'Surfer Pro',
    explorer: 'Explorer',
  }
  return labels[tier]
}

/**
 * Get the price for a tier (monthly).
 */
export const TIER_PRICES: Record<Tier, string> = {
  free: '$0',
  pro: '$4.99/mo',
  explorer: '$9.99/mo',
}
