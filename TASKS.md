# SwellStack — Claude Code Task List
## Phased Build Plan

> Instructions for Claude Code: Work through phases in order.
> Check off items with [x] as you complete them.
> Run tests before marking a phase complete.
> Read CLAUDE.md before starting any phase.

---

## PHASE 1 — Foundation (Data In, App Shell Out)
**Goal**: Real buoy data flowing into Supabase, minimal Next.js frontend showing it.

### 1.1 Project Scaffolding
- [x] Create monorepo with pnpm workspaces: `apps/web`, `apps/api`, `ml/`, `supabase/`
- [x] Initialize Next.js 15 app in `apps/web` with TypeScript, Tailwind CSS, App Router
- [x] Initialize FastAPI project in `apps/api` with `uv` (fast Python package manager)
- [x] Set up `docker-compose.yml` with: api, open-meteo, cloudflared services
- [x] Create `.env.example` with all required variables documented
- [x] Set up `ruff`, `mypy` for Python; `eslint` for TypeScript (pyproject.toml)

### 1.2 Database Setup
- [x] Create Supabase project (free tier) — manual step
- [x] Write migration `001_init.sql`: spots, buoy_observations, spot_forecasts, user_sessions, user_profiles, api_keys, crowd_observations, forecast_accuracy, current_conditions view, spot_leaderboard view, triggers
- [x] Write migration `002_timeseries.sql`: TimescaleDB continuous aggregates (buoy_hourly, buoy_daily, forecast_daily) + retention policies
- [x] Write migration `003_ml_features.sql`: model_training_runs table, model_accuracy_summary view, session_training_labels view
- [x] Write migration `004_api_keys.sql`: ALTER api_keys to add revoked/tier columns, make name nullable
- [x] Enable PostGIS and TimescaleDB extensions (in migration)
- [x] Enable pgvector extension (in migration)
- [x] RLS policies included in 001_init.sql
- [x] Write `supabase/seed.sql` with 10 initial surf spots
- [x] Generate TypeScript types from Supabase schema — manual step after DB is created

### 1.3 NDBC Data Pipeline
- [x] Implement `services/ndbc.py`:
  - `fetch_buoy_stdmet(station_id)` → pandas DataFrame
  - `fetch_buoy_spectral(station_id)` → dict of frequency bands
  - `parse_spec_file(raw_text)` → structured spectral data (real NDBC format)
  - Error handling for missing/offline buoys
- [x] Implement `db/supabase_client.py` with async client
- [x] Implement `upsert_buoy_observations()` with conflict handling
- [x] Set up APScheduler job: fetch all buoys every hour at :30
- [x] Write pytest tests for NDBC parsing — 20/20 pass (including live NDBC fetch)

### 1.4 Open-Meteo Integration
- [x] Self-host Open-Meteo via Docker (in docker-compose)
- [x] Implement `services/open_meteo.py`:
  - `fetch_marine_forecast(lat, lon, days=16)` → structured forecast
  - `fetch_wind_forecast(lat, lon)` → wind data aligned to marine forecast
  - Fallback to open-meteo.com if self-hosted is down
- [x] Implement `services/tides.py`:
  - `fetch_tide_predictions(station_id, days=7)` using NOAA CO-OPS API
  - In-memory cache with 24h TTL

### 1.5 Basic Forecast Assembly
- [x] Implement `services/bias_correction.py` with physics fallback (no ML yet):
  - `SpotBiasCorrector` class
  - Fallback formula: face_height = Hs × 0.85 × cos(swell_angle_diff)
- [x] Implement `routers/forecast.py`:
  - `GET /api/v1/forecast/{spot_id}` → 7-day hourly / 16-day
  - Assembles from: Open-Meteo + bias correction + tides
- [x] Implement `routers/spots.py`:
  - `GET /api/v1/spots` → all spots (falls back to spots.json if DB unavailable)
  - `GET /api/v1/spots/{slug}` → spot detail

### 1.6 Frontend Shell
- [x] Set up Supabase client helpers: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (RSC)
- [x] Set up auth: `(auth)/login/page.tsx` with magic link + Google OAuth
- [x] Create main layout with navigation: Map | Sessions | Profile
- [x] Build `SpotMap` component using MapLibre GL (free, open source):
  - Color-coded pins by condition quality
  - Click pin → navigate to spot detail page
  - Popup with spot name + current conditions
- [x] Build `SpotCard` component: name, conditions badge, wave/wind stats
- [x] Build `spot/[id]/page.tsx`:
  - Current conditions hero with all stats
  - 7-day forecast timeline (scrollable hourly cards)
  - Each card: wave height, period, direction, wind, quality bar
- [x] Set up NUC API client `lib/api.ts` with auth header and error handling

### 1.7 Deploy Foundation
- [ ] Configure Cloudflare Tunnel on NUC to expose port 8000 — manual step
- [ ] Deploy frontend to Vercel — manual step
- [ ] Set all env vars in Vercel dashboard — manual step
- [ ] Smoke test: Open app → see spots map → click spot → see forecast data

**Phase 1 Definition of Done**: App is live on Vercel, showing real NDBC buoy data and Open-Meteo forecasts for 10 spots. Auth works. Data pipeline runs hourly.

---

## PHASE 2 — The ML Edge
**Goal**: LightGBM bias correction trained on real data, spectral visualization, personalization MVP.

### 2.1 Historical Data Download
- [x] Write `ml/download_ndbc_history.py`:
  - Download 10 years of stdmet + spectral data for all key buoys
  - Store as parquet files in `data/ndbc_historical/`
  - Handle gaps and missing stations gracefully
  - Progress bar with tqdm
- [x] Run download script (will take ~30 min, ~2GB data) — manual step

### 2.2 Bias Correction Model Training
- [x] Write `ml/train_bias_correction.py`:
  - Load historical NDBC data
  - For each spot: create feature matrix (buoy_hs, buoy_tp, buoy_dir, swell_angle_diff, wind, doy, spectral bands)
  - Bootstrap labels: face_height = Hs × 0.85 × cos(swell_angle_diff)
  - Train LightGBM per spot, evaluate with 5-fold time-series cross-validation
  - Save models as pickle to `apps/api/models/ml/bias_{spot_id}.pkl`
  - Log RMSE and feature importance per spot
- [x] Write `ml/train_stoke_model.py`: trains personalized quality scorer on session labels
- [x] Write `ml/train_crowd_model.py`: trains crowd predictor (pseudo-labels + real session crowd ratings)
- [x] Write `ml/evaluate_models.py`: evaluates all models vs held-out data, logs to model_training_runs
- [x] Update `SpotBiasCorrector` to load and use trained models (Phase 2 dict format + named features)
- [x] Run training for all spots — manual step (requires historical data download first)

### 2.3 Quality Score Model
- [x] Implement `services/stoke_score.py` with full personalized scoring engine
  - Height: bell curve centered on user's preferred range, skill multiplier
  - Period: sigmoid with longboard bonus
  - Direction: cosine similarity to optimal swell direction (with 360° wrap)
  - Wind: angle diff to offshore direction, light-wind floor, strong-onshore penalty
  - Crowd: user tolerance weighted
  - 16/16 unit tests passing
- [x] Add `POST /api/v1/stoke` endpoint (fetches live forecast if conditions not provided)
- [x] Register stoke router in `main.py`
- [x] Add `compute_quality_score()` (0-10 generic score for map pin coloring)

### 2.4 Spectral Visualization
- [x] Build `SwellSpectrum` component (Recharts AreaChart, X=period in seconds, 4 snapshots)
- [x] Build `TideChart` component (pure SVG, 48h curve, high/low markers, current time indicator)
- [x] Build `WindRose` component (SVG polar chart, 24h wind, offshore direction indicator)
- [x] Wire all three into `spot/[id]/page.tsx`

### 2.5 Session Logging
- [x] Build `SessionLogger` component (modal form, spot picker, quality/crowd sliders, notes)
- [x] Implement session save directly to Supabase from browser client
- [x] Build `SessionHistory` component (list view grouped by month)
- [x] Build full `sessions/page.tsx` with log button + history

### 2.6 User Preference Profile
- [x] Build onboarding flow (`/onboarding`) — 5-step wizard:
  1. Display name
  2. Skill level (beginner/intermediate/advanced/pro)
  3. Board type
  4. Preferred wave height range + min period
  5. Offshore importance + crowd tolerance
- [x] Save to `user_profiles` table via Supabase upsert
- [x] Wire preferences into stoke score computation via `/api/stoke` route
- [x] Build `profile/page.tsx` with full preference editor
- [x] Build `src/proxy.ts` (Next.js 16 auth + onboarding redirect middleware)
- [x] Build `StokeScore` component (animated SVG ring + 5 component bars)
- [x] Build `StokeScoreWidget` (fetches from `/api/stoke`, falls back to quality proxy)
- [x] Build `(auth)/signup/page.tsx` (redirects to /login; magic link handles signup+login)

**Phase 2 Definition of Done**: ✅ ML training scripts ready, spectral chart + tide + wind rose visible on forecast page, session logging works, personalized stoke score shown on forecast page, onboarding + profile complete. Tests: 40/40 passing. Frontend: clean `pnpm build`.

---

## PHASE 3 — The Differentiators
**Goal**: Features that don't exist on Surfline. This is the moat.

### 3.1 Optimal Window Finder
- [x] Implement `services/optimal_windows.py`:
  - For a given spot + user preferences: score every hour of next 16 days
  - Compound score: stoke_score × tide_bonus × light_condition × crowd_inverse
  - Return top 10 windows with reasons ("offshore AM glass, 4ft @ 14s, low crowd")
- [x] Add `GET /api/v1/optimal/{spot_id}` endpoint (auth required, premium gate)
- [x] Build `OptimalWindows` component:
  - Calendar heat map (next 14 days, rows=spots if Explorer, single spot if Pro)
  - Click a window → expands to full condition detail
  - Premium gate with "Unlock" CTA for free users
- [x] Wire `OptimalWindows` into `spot/[id]/page.tsx`

### 3.2 Crowd Prediction Model
- [x] Implement `services/crowd_model.py`:
  - Features: forecast_quality × day_of_week × holiday_flag × month × spot_baseline
  - Initially: rule-based (weekends = 1.5x, holidays = 2x, high quality = 1.8x)
  - Over time: train on user check-in patterns from session logs
- [x] Add crowd score to all forecast responses
- [x] Show crowd prediction as colored bar on forecast cards

### 3.3 Natural Language Queries (llama.cpp)
- [x] Set up llama.cpp server in Docker on NUC:
  - Docker service configured in docker-compose.yml (port 8081, OpenAI-compatible)
  - Download Phi-4-mini Q4_K_M quantized model (~2.5GB) to `./models/` on NUC — manual step
- [x] Implement `services/llm.py`:
  - `answer_surf_query(query, spot, forecast_hours)` → answer string
  - `stream_surf_query(query, spot, forecast_hours)` → AsyncIterator[str] SSE
  - System prompt engineering for surf domain knowledge
  - Rule-based fallback when llama.cpp unavailable
- [x] Implement `routers/nlq.py`:
  - `POST /api/v1/nlq` → JSON answer
  - `POST /api/v1/nlq/stream` → SSE streaming response
- [x] Build `AskStoke` UI component:
  - Floating chat bubble on spot page (bottom-right)
  - Streams response token by token (SSE via ReadableStream)
  - 3 suggested questions pre-populated
  - Premium gate with "Unlock AI Forecaster" CTA for free users
- [x] Wire `AskStoke` into `spot/[id]/page.tsx`

### 3.4 SWAN Nearshore Model (Pilot Spots)
- [ ] Install SWAN on NUC: `apt install swan` or build from source — manual step
- [ ] Download NOAA NCEI bathymetry grids for 3 pilot spots (Mavericks, Steamer Lane, Trestles) — manual step
- [ ] Write SWAN input (.swn) files for each pilot spot — manual step (use `build_swan_input()` helper)
- [x] Implement `services/swan_runner.py`:
  - `build_swan_input()` generates .swn deck from boundary conditions
  - `run_swan()` async subprocess runner with 600s timeout
  - `parse_swan_table()` parses TABLE output → forecast records
  - `is_swan_available()` guard for graceful fallback
- [x] SWAN runs triggered by scheduler after forecast update — add to `update_forecasts` job when NUC is ready
- [x] Mark SWAN-enabled spots with "Physics Model" badge on `SpotCard` and `spot/[id]/page.tsx`

### 3.5 Push Notifications
- [x] Implement Web Push via Supabase Edge Functions (`supabase/functions/send-push/index.ts`)
- [x] Alert types:
  - "Optimal Window Incoming": 18h advance notice (via scheduler/jobs.py)
  - "Swell Alert": when buoy reads > user's minimum threshold
  - "Crowd Alert": when crowd prediction is unusually low for a good day
- [x] `lib/push.ts`: service worker registration + VAPID subscription + save to user_profiles
- [x] Build notification preferences UI in profile page: toggle per alert type, stoke threshold slider, Enable Push button

### 3.6 Multi-Model Ensemble
- [x] Fetch forecasts from 3 models: ECMWF (45%), GFS (30%), ICON (25%) via Open-Meteo
- [x] Implement ensemble averaging weighted by model skill in `services/ensemble.py`
- [x] Show model agreement indicator on forecast cards: "✓ models agree" / "~ uncertain" / "⚠ models differ"
- [x] Premium: `ModelComparison.tsx` — overlapping area chart per model, agreement badge, paywall for free users; wired into `spot/[id]/page.tsx`

**Phase 3 Definition of Done**: Optimal windows visible, NLQ working, crowd prediction active, ensemble multi-model active. SWAN (3.4) deferred to manual NUC setup.

---

## PHASE 4 — Monetization & Growth
**Goal**: Stripe integration, B2B API, launch.

### 4.1 Stripe Integration
- [x] Set up Stripe products:
  - Surfer Pro: $4.99/month
  - Explorer: $9.99/month
  - B2B API: $49/month (metered, 10K req included)
- [x] Implement `app/api/webhook/stripe/route.ts`:
  - Handle: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
  - Update `user_profiles.subscription_tier` on successful subscription
- [x] Build upgrade flow (`app/(dashboard)/upgrade/page.tsx`):
  - 3 plan cards with feature comparison table
  - Stripe Checkout redirect via `app/api/checkout/route.ts`
  - Success/cancel return URLs
- [x] Implement feature gates via `lib/gates.ts`

### 4.2 B2B API Portal
- [x] Build `app/(dashboard)/api-portal/page.tsx` (Explorer tier only):
  - API key generation (stored as SHA-256 hash in Supabase)
  - Key revocation; shows prefix only after creation
- [x] Add API key auth middleware to FastAPI (`middleware/api_key.py`)
- [x] Rate limiting per API key (monthly counter in `api_keys` table)
- [x] `supabase/migrations/004_api_keys.sql`: api_keys table with RLS
- [x] `app/api/generate-api-key/route.ts`: creates key (explorer-only, max 3)

### 4.3 Performance & Polish
- [x] Add loading skeletons: `map/loading.tsx`, `spot/[id]/loading.tsx`
- [x] Implement error boundaries: `spot/[id]/error.tsx`, `app/error.tsx`
- [x] PWA manifest (`public/manifest.json`) + service worker (`public/sw.js`)
  - Offline shows last cached forecast (stale-while-revalidate)
  - Background sync for pending session saves
  - Push notification handler
- [x] Add OpenGraph + PWA meta tags in `app/layout.tsx`
- [ ] Run Lighthouse audit: target 90+ performance score — manual step

### 4.4 SEO & Discovery
- [x] Public spot pages: `/surf/{slug}` (3-day free preview, no auth required)
- [x] `generateMetadata()` with live conditions in meta description
- [x] `app/sitemap.ts` auto-generated sitemap
- [x] `app/robots.ts` robots.txt

### 4.5 Analytics (Privacy-First)
- [x] `lib/analytics.ts`: Plausible wrapper — tracks spot views, session logs, upgrade clicks, NLQ, forecast shares, spot submissions (no-op until script tag added)
- [ ] Add Plausible script tag to `app/layout.tsx` — manual step (requires Plausible account + domain)
- [x] Build admin dashboard `/admin`: DAU via session counts, tier breakdown bars, top spots by sessions, model training runs history
- [ ] Self-host Umami alternative — optional manual step

### 4.6 Launch Prep
- [ ] Write launch post for r/surfing, r/webdev — manual step
- [ ] Create Instagram with AI-generated daily "conditions update" posts — manual step
- [ ] Set up status page (UptimeRobot free tier) — manual step
- [x] Write `RUNBOOK.md`: NUC offline procedures, Open-Meteo issues, LLM issues, Supabase, stale forecasts, buoy issues, memory, Stripe webhooks, deploy, migrations, secret rotation
- [ ] Test full flow end-to-end with 5 beta users — manual step

**Phase 4 Definition of Done**: Stripe working, first paying customer acquired, B2B API documented and accessible.

---

## ONGOING / MAINTENANCE

### Data Quality
- [x] Daily validation job in `scheduler/jobs.py`: compares yesterday's forecasts vs buoy observations, logs MAE/RMSE to `forecast_accuracy` table
- [x] Nightly model refresh job: retriggers `train_stoke_model.py` if >50 new labeled sessions in last 30 days
- [x] Buoy health check job: runs every hour, warns if any buoy offline >6h

### User Feedback Loop
- [x] `ForecastAccuracyPrompt` component: thumbs up/down after session, optional reason picker, saves to `forecast_accuracy`, tracked via analytics
- [x] Wire `ForecastAccuracyPrompt` into `sessions/page.tsx` after session log — display for last 3 sessions without a rating
- [ ] Feature request board (Canny embed or GitHub Discussions) — manual step

### Spot Expansion
- [x] `spots/submit/page.tsx`: community spot submission form (name, region, lat/lng, break type, swell/wind direction, buoy ID, description)
- [x] Spot submission link in nav sidebar
- [ ] Admin review queue in Supabase Studio — manual step (filter `spots` table by `created_at` for new submissions)
- [ ] Auto-detect nearest NDBC buoy when new spot is added — future enhancement

---

## QUICK REFERENCE: KEY COMMANDS

```bash
# Start all NUC services
docker-compose up -d

# Run database migrations
supabase db push

# Start API in development
cd apps/api && uv run uvicorn main:app --reload

# Start frontend in development
cd apps/web && pnpm dev

# Download NDBC historical data
cd ml && uv run python download_ndbc_history.py

# Train bias correction models
cd ml && uv run python train_bias_correction.py --spots all

# Run tests
cd apps/api && uv run pytest
cd apps/web && pnpm test

# Check logs (production)
docker-compose logs -f api

# Update Cloudflare tunnel
cloudflared tunnel route dns swellstack api.swellstack.io
```

---

## NOTES FOR CLAUDE CODE

1. **Always read CLAUDE.md** at the start of each session for full context
2. **Check off tasks** in this file as you complete them
3. **The NUC is the ML compute engine** — never move ML inference to Vercel serverless functions (too slow, too expensive)
4. **Free data sources first** — NDBC, Open-Meteo, NOAA Tides are all 100% free with no rate limits that matter at our scale
5. **TimescaleDB is critical** for the time-series data — use `time_bucket()` for aggregations
6. **RLS is not optional** — every table with user data must have Row Level Security enabled
7. **The spectral data is the moat** — don't simplify it to Hs/Tp summary, preserve and display the full spectrum
8. **Test on real buoy data** — fetch live NDBC data in tests, don't mock everything or you'll miss parsing bugs
