# Claude Code: Phase 3 Prompt — The Differentiators
# Use after Phase 2 is complete and checked off in TASKS.md
# ─────────────────────────────────────────────────────────────────────────────

Read CLAUDE.md and TASKS.md. Confirm Phase 2 is complete, then execute Phase 3.

## Your job in this session:

### 3.1 — Optimal Window Finder

1. Implement `apps/api/services/optimal_windows.py`:
   - Score every forecast hour for next 16 days for a spot + user
   - Compound score: stoke_score × tide_bonus × time_of_day × crowd_inverse
   - tide_bonus: +20% during incoming tide, -10% at high/low extremes
   - time_of_day: morning (5-10am) gets +15% (typically glassy)
   - Group adjacent high-scoring hours into "windows" (consecutive hours ≥ 60 stoke)
   - Return top 10 windows with: start_time, end_time, peak_score, peak_conditions, reason_string
   - reason_string: human-readable e.g. "Offshore NE, 4ft @ 14s groundswell, incoming tide"

2. Add `GET /api/v1/optimal/{spot_id}` endpoint — auth required, premium gate (pro/explorer)

3. Build `apps/web/components/forecast/OptimalWindows.tsx`:
   - Calendar grid: 14 days × rows, heat map colored by peak window score
   - Click a day → expand to show ranked windows for that day
   - Each window card: time range, score ring, wave icon, wind icon, crowd icon
   - "Set alert" toggle button (saves to user_profiles.notification_prefs)

### 3.2 — Crowd Prediction

4. Implement `apps/api/services/crowd_model.py`:
   ```python
   class CrowdPredictor:
       BASE_MULTIPLIERS = {
           "monday": 0.5, "tuesday": 0.5, "wednesday": 0.6,
           "thursday": 0.6, "friday": 0.8,
           "saturday": 1.5, "sunday": 1.4
       }
       HOLIDAY_BOOST = 2.0
       QUALITY_CURVE = {10: 1.8, 8: 1.5, 6: 1.2, 4: 1.0, 2: 0.8}
       
       def predict(self, spot_id, forecast_time, quality_score) -> float:
           # Returns 0-1 crowd probability (1 = very crowded)
           # Factor in: day of week, local holidays, quality score, month
   ```
   
5. Add crowd score to all forecast and optimal window responses
6. Add crowd prediction bar to forecast cards (color: green=empty, red=packed)

### 3.3 — Natural Language Queries (llama.cpp)

7. Implement `apps/api/services/llm.py`:
   ```python
   SURF_SYSTEM_PROMPT = """
   You are a surf forecaster AI with deep knowledge of wave physics and surf culture.
   You have access to forecast data for specific surf spots.
   Answer questions about surf conditions accurately and concisely.
   Use surfer language naturally. Be honest about uncertainty.
   When referencing forecasts, cite specific numbers (height, period, direction, wind).
   Keep answers to 3-5 sentences unless the user asks for detail.
   """
   
   async def answer_surf_query(query: str, spot: dict, forecast: dict) -> str:
       # Build context from forecast data
       # Call llama.cpp via OpenAI-compatible API
       # Stream response tokens
   ```

8. Implement `apps/api/routers/nlq.py`:
   - `POST /api/v1/nlq` — body: { query, spot_id, forecast_time }
   - Server-sent events (SSE) streaming response
   - Auth required, rate limited by subscription tier (0/day free, 10/day pro, 50/day explorer)

9. Build `apps/web/components/forecast/AskPeak.tsx`:
   - Floating "Ask Stoke" button (bottom-right of spot page)
   - Opens slide-up panel with chat interface
   - Input field + send button
   - Streams response in real-time (fetch with ReadableStream)
   - Show 3 suggested questions:
     - "Is it worth the drive {tomorrow/Saturday}?"
     - "Best time to surf today?"
     - "Compare this to last {week/season}?"
   - Premium gate: show teaser for free users, "Unlock AI Forecaster" CTA

### 3.4 — Multi-Model Ensemble

10. Update `apps/api/services/open_meteo.py`:
    - Fetch from all 3 models: ECMWF IFS, NOAA GFS, DWD ICON
    - Each returns the same structure
    
11. Implement `apps/api/services/ensemble.py`:
    - Combine 3 model forecasts with skill-based weights
    - Compute model agreement score: std_dev of height predictions / mean
    - agreement < 0.1 = "Models agree" → high confidence
    - agreement > 0.3 = "Models disagree" → show uncertainty range
    
12. Update forecast responses to include:
    - ensemble: weighted average (default display)
    - model_agreement: 0-1 confidence indicator  
    - For premium: individual model forecasts array

13. Frontend: add "confidence indicator" to forecast cards:
    - Green shield = models agree
    - Yellow warning = mild disagreement
    - Gray question = limited data

### 3.5 — Push Notifications (Web Push)

14. Create Supabase Edge Function `supabase/functions/send-push/index.ts`:
    - Accepts: { user_id, title, body, url }
    - Fetches user's push subscription from user_profiles
    - Sends via web-push library

15. Create notification scheduler job in `apps/api/scheduler/jobs.py`:
    - Runs daily at 6pm: find optimal windows starting in next 18h
    - For each user with that spot in home_spots: send push notification
    - Respect notification_prefs settings

16. Frontend: `apps/web/lib/push.ts`:
    - Register service worker
    - Subscribe to web push
    - Save subscription to user_profiles via Supabase
    - Permission request flow in profile settings

## Definition of Done for Phase 3:
- Optimal Window Finder shows calendar heat map for premium users
- Crowd prediction bars visible on all forecast cards
- NLQ chat works and streams responses from NUC LLM
- Model agreement indicator on forecast cards
- Web push notifications work end-to-end (test with Chrome DevTools)
- All Phase 3 features properly gated behind subscription tier

---

# Claude Code: Phase 4 Prompt — Monetization & Launch
# Use after Phase 3 is complete
# ─────────────────────────────────────────────────────────────────────────────

### 4.1 — Stripe Integration

1. Set up Stripe products and prices (provide instructions for manual setup in Stripe dashboard).
   Document the price IDs to add to .env.

2. Build `apps/web/app/(dashboard)/upgrade/page.tsx`:
   - Pricing table: Free / Surfer Pro $4.99 / Explorer $9.99
   - Feature comparison table (use FEATURE_GATES from CLAUDE.md)
   - "Most Popular" badge on Pro
   - Stripe Checkout redirect on plan click

3. Implement `apps/web/app/api/webhook/stripe/route.ts`:
   - Verify stripe signature
   - Handle: checkout.session.completed → update subscription_tier
   - Handle: customer.subscription.deleted → downgrade to free
   - Handle: customer.subscription.updated → update tier

4. Build feature gate middleware `apps/web/lib/gates.ts`:
   - `requireTier(tier)` server-side guard
   - `FeatureGate` React component that shows paywall or children
   - Wire to all premium features

### 4.2 — B2B API Portal

5. Build `apps/web/app/(dashboard)/api-portal/page.tsx` (Explorer only):
   - API key generation button → calls Supabase to create key, returns once
   - Key display (show full key only once with copy button)
   - Usage stats: requests today, this month, monthly limit
   - Embed FastAPI `/docs` in iframe (OpenAPI spec auto-generated)

6. Add API key auth middleware to `apps/api/middleware/api_key.py`:
   - Check Authorization: Bearer header
   - Look up key hash in api_keys table
   - Inject key owner's user_id into request state
   - Increment requests_this_month counter
   - Return 429 if over limit

### 4.3 — SEO & Sharing

7. Add OpenGraph + Twitter meta tags to spot pages:
   - Dynamic: "Mavericks: 8ft @ 18s groundswell, Offshore wind — Check forecast →"
   - Generate OG image via Vercel OG (canvas-based, free)
   - OG image: spot name, wave height, period, peak score, tide chart mini

8. Build `apps/web/app/surf/[slug]/page.tsx` (public, no auth needed):
   - Static generation at build time for all 10 spots
   - Shows 3-day free forecast preview
   - Big "Sign up for 16-day forecast + personalized score" CTA
   - This is the SEO landing page for organic search

9. Generate `sitemap.xml` and `robots.txt` automatically from spots list

### 4.4 — PWA & Performance

10. Add `apps/web/public/manifest.json`:
    - App name, icons, theme color, display: standalone
    
11. Create service worker `apps/web/public/sw.js`:
    - Cache last-viewed spot forecast for offline access
    - Background sync: queue session logs when offline, submit when back online

12. Add loading skeletons for all async components using shadcn/ui Skeleton

13. Run Lighthouse in CI: add GitHub Action that fails if score < 85

### 4.5 — Final Polish

14. Add error boundaries to all pages with user-friendly fallbacks
15. Add Umami analytics (self-hosted privacy-first) — add `NEXT_PUBLIC_UMAMI_WEBSITE_ID` to env
16. Write `RUNBOOK.md`: NUC goes offline procedures, backup data sources, incident response
17. Final: run full Playwright E2E test: signup → onboarding → view forecast → log session → upgrade → use premium feature

## Definition of Done for Phase 4:
- Stripe checkout flow works end-to-end (use test mode)
- B2B API portal shows usage stats
- Public SEO pages built and indexed
- PWA installable on iOS Safari and Chrome Android
- Lighthouse score ≥ 85 on spot page
- E2E test suite passes
