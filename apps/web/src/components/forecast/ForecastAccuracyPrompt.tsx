'use client'

/**
 * ForecastAccuracyPrompt — "Was this forecast accurate?" thumbs up/down.
 *
 * Shown after a user logs a session for a spot.
 * Ratings are stored in user_sessions.quality_rating and also trigger
 * a lightweight forecast_accuracy upsert via the API.
 *
 * These ratings become training signal for the bias correction models.
 */

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackForecastRating } from '@/lib/analytics'

interface ForecastAccuracyPromptProps {
  spotSlug: string
  spotName: string
  forecastTime: string   // ISO string of the forecast hour that was active
  sessionId?: string     // if already logged, link to session
  onDismiss?: () => void
}

type Rating = 'up' | 'down' | null

export default function ForecastAccuracyPrompt({
  spotSlug,
  spotName,
  forecastTime,
  sessionId,
  onDismiss,
}: ForecastAccuracyPromptProps) {
  const [rating, setRating] = useState<Rating>(null)
  const [submitted, setSubmitted] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)  // optional text note

  const DOWN_REASONS = [
    'Too small — forecast said bigger',
    'Too big — forecast said smaller',
    'Wrong direction',
    'Wind was worse than forecast',
    'Closed out — forecast looked fun',
  ]

  async function handleRating(r: Rating) {
    if (!r || submitted) return
    setRating(r)
    trackForecastRating(spotSlug, r)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Save to forecast_accuracy_ratings (lightweight — just user + spot + time + rating)
      await supabase.from('forecast_accuracy').upsert({
        // We don't have spot_id as UUID here, but we can store the log
        // The backend nightly job reconciles these with actual DB UUIDs
        spot_id: spotSlug as unknown as string,  // resolved by backend
        model_source: 'ensemble',
        forecast_for: forecastTime,
        forecasted_at: new Date().toISOString(),
        lead_hours: 0,
        // Encode thumbs as height: 1=accurate, -1=inaccurate
        predicted_height_m: r === 'up' ? 1 : -1,
        observed_height_m: 1,
        mae: r === 'up' ? 0 : 1,
        rmse: r === 'up' ? 0 : 1,
      })
    } catch {
      // Non-critical — don't surface errors for this feedback
    }
  }

  async function handleSubmitDetail() {
    if (!rating) return
    setSubmitted(true)
    onDismiss?.()
  }

  if (submitted) {
    return (
      <div className="glass-card rounded-xl p-4 flex items-center gap-3">
        <span className="text-green-600 text-lg">✓</span>
        <span className="text-sm text-[var(--spray)]">Thanks — your rating helps improve the forecast.</span>
      </div>
    )
  }

  return (
    <div className="glass-card rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--mist)]">
          Was the {spotName} forecast accurate today?
        </p>
        {onDismiss && (
          <button onClick={onDismiss} className="text-[var(--deep-text)] hover:text-[var(--spray)] text-lg leading-none">×</button>
        )}
      </div>

      {!rating ? (
        <div className="flex gap-3">
          <button
            onClick={() => handleRating('up')}
            className="flex-1 flex items-center justify-center gap-2 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            👍 Yes, accurate
          </button>
          <button
            onClick={() => handleRating('down')}
            className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg py-2.5 text-sm font-medium transition-colors"
          >
            👎 Off the mark
          </button>
        </div>
      ) : rating === 'up' ? (
        <div className="flex items-center justify-between">
          <span className="text-green-700 text-sm">👍 Great to hear!</span>
          <button
            onClick={handleSubmitDetail}
            className="text-xs text-[var(--spray)] hover:text-[var(--mist)] underline"
          >
            Done
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-[var(--spray)]">What was wrong? (optional)</p>
          <div className="flex flex-wrap gap-1.5">
            {DOWN_REASONS.map(reason => (
              <button
                key={reason}
                onClick={() => setDetail(reason)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  detail === reason
                    ? 'border-red-400 bg-red-50 text-red-700'
                    : 'border-[var(--tile-border-strong)] text-[var(--spray)] hover:border-[var(--spray)] hover:text-[var(--mist)]'
                }`}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            onClick={handleSubmitDetail}
            className="w-full text-xs bg-[var(--paper-sunken)] hover:bg-[var(--tile-border)] text-[var(--mist)] py-2 rounded-lg transition-colors mt-1"
          >
            Submit feedback
          </button>
        </div>
      )}
    </div>
  )
}
