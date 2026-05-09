/**
 * Upgrade page — pricing table with feature comparison.
 */
import { FEATURE_GATES, TIER_PRICES } from '@/lib/gates'

const PLANS = [
  {
    tier: 'free' as const,
    name: 'Free',
    price: '$0',
    description: 'Get started with surf forecasting',
    color: 'border-gray-700',
    badge: null,
    stripePriceId: null,
  },
  {
    tier: 'pro' as const,
    name: 'Surfer Pro',
    price: '$4.99',
    description: 'For the dedicated local',
    color: 'border-blue-500',
    badge: 'Most Popular',
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID,
  },
  {
    tier: 'explorer' as const,
    name: 'Explorer',
    price: '$9.99',
    description: 'For the serious surfer or developer',
    color: 'border-orange-500',
    badge: null,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_EXPLORER_PRICE_ID,
  },
]

const FEATURES: Array<{ label: string; key: keyof typeof FEATURE_GATES; format?: (v: unknown) => string }> = [
  { label: 'Forecast range', key: 'forecast_days', format: v => `${v} days` },
  { label: 'Saved spots', key: 'spots_saved', format: v => `${v} spots` },
  { label: 'Personalized Peak Score™', key: 'stoke_score' },
  { label: 'Optimal window finder', key: 'optimal_windows' },
  { label: 'AI surf queries (Ask Stoke)', key: 'nlq_queries_per_day', format: v => v === 0 ? '—' : `${v}/day` },
  { label: 'Crowd prediction', key: 'crowd_prediction' },
  { label: 'Full spectral data', key: 'spectral_data' },
  { label: 'Push notifications', key: 'push_notifications' },
  { label: 'Multi-model ensemble', key: 'ensemble_forecast' },
  { label: 'B2B API access', key: 'b2b_api_access' },
]

function FeatureValue({ value, format }: { value: unknown; format?: (v: unknown) => string }) {
  if (format) {
    return <span className="text-gray-300 text-sm">{format(value)}</span>
  }
  if (value === true) {
    return <span className="text-green-400 text-base">✓</span>
  }
  if (value === false || value === 0) {
    return <span className="text-gray-600 text-base">—</span>
  }
  return <span className="text-gray-300 text-sm">{String(value)}</span>
}

export default function UpgradePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold text-white mb-3">Upgrade Koastcast</h1>
        <p className="text-gray-400 max-w-lg mx-auto text-sm">
          More accurate forecasts. Personalized scoring. Optimal windows.
          Everything a serious surfer needs.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {PLANS.map(plan => (
          <div
            key={plan.tier}
            className={`relative bg-gray-900 border-2 ${plan.color} rounded-2xl p-6 flex flex-col`}
          >
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                {plan.badge}
              </div>
            )}

            <div className="mb-4">
              <div className="text-white font-bold text-lg">{plan.name}</div>
              <div className="text-gray-400 text-xs mt-0.5">{plan.description}</div>
            </div>

            <div className="mb-5">
              <span className="text-3xl font-black text-white">{plan.price}</span>
              {plan.tier !== 'free' && <span className="text-gray-400 text-sm">/month</span>}
            </div>

            <div className="flex-1" />

            {plan.stripePriceId ? (
              <StripeCheckoutButton priceId={plan.stripePriceId} tierName={plan.name} />
            ) : plan.tier === 'free' ? (
              <div className="text-center text-gray-500 text-sm py-2">Current plan</div>
            ) : (
              <div className="text-center text-gray-600 text-xs py-2">
                Configure STRIPE_PRICE_ID in .env
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Feature comparison table */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-4 gap-0">
          {/* Header */}
          <div className="p-4 border-b border-gray-800">
            <div className="text-gray-400 text-xs font-semibold uppercase tracking-wider">Feature</div>
          </div>
          {PLANS.map(plan => (
            <div key={plan.tier} className="p-4 border-b border-gray-800 text-center">
              <div className="text-white text-sm font-semibold">{plan.name}</div>
            </div>
          ))}

          {/* Feature rows */}
          {FEATURES.map((feature, fi) => (
            <>
              <div
                key={`label-${fi}`}
                className={`px-4 py-3 text-gray-300 text-sm ${fi < FEATURES.length - 1 ? 'border-b border-gray-800/50' : ''}`}
              >
                {feature.label}
              </div>
              {PLANS.map(plan => (
                <div
                  key={`${plan.tier}-${fi}`}
                  className={`px-4 py-3 text-center ${fi < FEATURES.length - 1 ? 'border-b border-gray-800/50' : ''}`}
                >
                  <FeatureValue
                    value={FEATURE_GATES[feature.key][plan.tier]}
                    format={feature.format}
                  />
                </div>
              ))}
            </>
          ))}
        </div>
      </div>

      <p className="text-center text-gray-600 text-xs mt-6">
        Cancel anytime. No hidden fees. Billed monthly via Stripe.
      </p>
    </div>
  )
}

function StripeCheckoutButton({ priceId, tierName }: { priceId: string; tierName: string }) {
  return (
    <form action="/api/checkout" method="POST">
      <input type="hidden" name="price_id" value={priceId} />
      <button
        type="submit"
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm"
      >
        Upgrade to {tierName}
      </button>
    </form>
  )
}
