# Claude Code: Phase 2 Prompt
# Use after Phase 1 is complete and checked off in TASKS.md
# ─────────────────────────────────────────────────────────────────────────────

Read CLAUDE.md and TASKS.md. Confirm Phase 1 is complete, then execute Phase 2.

## Your job in this session:

### 2.1 — Train Bias Correction Models

1. Write `ml/download_ndbc_history.py`:
   - Downloads 10 years of stdmet + spectral history for these buoys: 46026, 46012, 46042, 46053, 46047, 41047, 41025, 44025, 51001
   - Saves as compressed parquet to data/ndbc_historical/{station_id}_{year}.parquet
   - Skips already-downloaded files (resumable)
   - Use the NDBC historical data URL: https://www.ndbc.noaa.gov/data/historical/

2. Write `ml/train_bias_correction.py`:
   - Load historical data for a spot's nearest buoy
   - Feature engineering (see CLAUDE.md SpotBiasCorrector)
   - Bootstrap labels: for now use Hs * 0.85 * cos(swell_angle_to_spot) as initial labels
     (we'll replace with real session data later)
   - Train LightGBM with 5-fold time-series cross-validation
   - Save model + feature importances to apps/api/models/ml/bias_{spot_slug}.pkl
   - Print RMSE, MAE per spot

3. Update `apps/api/services/bias_correction.py` to load and use trained models.
   Keep the physics fallback for spots without a trained model.

### 2.2 — Peak Score Engine

4. Implement the full `StokeScore` computation from CLAUDE.md in `apps/api/services/stoke_score.py`
5. Add `POST /api/v1/stoke` endpoint — body: { spot_id, user_id, forecast_time }
6. Add peak score to all forecast responses (per-user if authenticated, generic if not)
7. Write unit tests for peak score edge cases

### 2.3 — Spectral Visualization

8. Build `apps/web/components/forecast/SwellSpectrum.tsx`:
   - Recharts AreaChart: X = period in seconds (inverse of Hz, more intuitive), Y = energy density
   - Show 4 time snapshots: Now, +6h, +12h, +24h as overlapping areas
   - Label the zones: "Short Period Chop" (< 8s), "Swell" (8-14s), "Groundswell" (> 14s)
   - Smooth animation between time steps
   - Mobile-responsive

9. Build `apps/web/components/forecast/TideChart.tsx`:
   - SVG-based tide curve (D3 or Recharts LineChart)
   - 48h window, current time as vertical line
   - Mark high/low tide times with dots and labels
   - Color zone: show "surf window" (tide range good for this spot) as green band

10. Build `apps/web/components/forecast/WindRose.tsx`:
    - D3 polar chart: 8 directional segments, petal length = frequency
    - 24h forecast wind data
    - Highlight the spot's offshore direction as a green arc
    - Show current wind as an arrow

### 2.4 — Session Logging

11. Build `apps/web/components/sessions/SessionLogger.tsx`:
    - Modal form: date picker, spot selector, conditions (auto-filled from forecast)
    - Sliders: quality 1-10, crowd 1-5
    - Textarea for notes
    - Submit → POST to Supabase

12. Build `apps/web/app/(dashboard)/sessions/page.tsx`:
    - Calendar view (current month) — green dots on days with logged sessions
    - List view below: cards showing each session with ratings
    - Click → expand to see conditions and notes

13. Implement notes embedding: on session save, call a lightweight embedding API
    (use Supabase edge function calling transformers.js with all-MiniLM-L6-v2)
    to generate 384-dim embedding, store in notes_embedding column.

### 2.5 — User Preference Profile

14. Build onboarding flow `apps/web/app/(dashboard)/onboarding/page.tsx`:
    - 5-step wizard (1 question per screen)
    - Progress bar
    - Saves to user_profiles on completion, sets onboarding_complete = true

15. Build `apps/web/app/(dashboard)/profile/page.tsx`:
    - Edit preferences (sliders + radio buttons)
    - Show session stats: total sessions, sessions by spot
    - Stoke score preview with current conditions at home spots

16. Add onboarding redirect: middleware.ts checks if onboarding_complete = false,
    redirects to /onboarding after login (skip if user has been using app > 7 days)

### 2.6 — Personalized Peak Score on Forecast Page

17. Update `apps/web/app/(dashboard)/spot/[id]/page.tsx`:
    - Show `StokeScore` component (0-100 ring with breakdown bars)
    - If logged in + onboarding complete: use personalized score
    - If not: show generic quality score with "Sign in for your score" CTA
    - Show `SwellSpectrum`, `TideChart`, `WindRose` components

18. Build `apps/web/components/forecast/StokeScore.tsx`:
    - Animated SVG ring, gradient color (gray→blue→green→yellow→orange→red)
    - Numeric score in center
    - 5 component bars below: Height, Period, Direction, Wind, Crowd
    - Emoji label from CLAUDE.md (_score_to_emoji function)

## Definition of Done for Phase 2:
- ML training script runs without errors (even if accuracy isn't perfect yet)
- Stoke score is visible on spot pages
- Spectral chart renders with real data
- Session logging saves to database
- User profile/preferences save and affect peak score
- All new components have Vitest unit tests
- `pnpm build` and `uv run pytest` pass clean
