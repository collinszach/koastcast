# Peakcast — AI-Native Outdoor Forecasting Platform
## Claude Code Master Context

---

## PROJECT OVERVIEW

**Peakcast** (codebase: Peakcast) is an AI-native surf and outdoor forecasting platform competing with Surfline. Infrastructure costs under $100/year. Uses free government data (NOAA NDBC buoys, ECMWF open data, Open-Meteo), runs ML and LLM inference on a local Intel NUC, and serves a Next.js frontend via Vercel + Supabase.

**Brand name:** Peakcast (UI-facing). Internal codebase/service name: Peakcast.

**Core differentiators vs Surfline:**
1. Full spectral wave analysis (not just Hs/Tp summary stats)
2. ML bias correction per spot trained on NDBC historical data (2016–2025)
3. Personalized Peak Score™ (per-user quality rating, not generic stars)
4. Crowd prediction layer (quality × day × local patterns)
5. Natural language forecast queries via on-device LLM (Ollama/phi4-mini, zero API cost)
6. SWAN nearshore physics model for selected spots (Phase 3, not yet active)

---

## WHAT'S BUILT (as of April 2026)

### Frontend (Next.js 15 / React 19)
- **140+ US surf spots** in `data/spots.json` with full metadata
- **100 ski resorts** in `data/resorts.json`
- **Ocean-themed UI** throughout — dark (`#060D1A` bg), cyan accents, glass cards, Syne headings, JetBrains Mono data
- **Pages implemented:**
  - Landing/home (`/`)
  - Auth: login, signup, forgot/reset password, OAuth callback
  - Map view with Leaflet (`/map`) — spot pins, right sidebar cards, location detection
  - Spot detail (`/spot/[id]`) — peak score ring, 7-day timeline, swell spectrum, tide chart, wind rose, optimal windows, buoy readings, "Ask Stoke" NLQ
  - Sessions (`/sessions`) — session logger + history
  - Profile (`/profile`) — preferences, quiver management
  - Explore (`/explore`)
  - Snow map + resort detail (`/snow`, `/snow/[id]`) — 10-day Open-Meteo forecast, optimal days, avalanche links
  - Trails map (`/trails`)
  - Weather map (`/weather`), Wind view (`/wind`)
  - API portal (`/api-portal`) — API key management for B2B
  - Admin (`/admin`)
  - Onboarding (`/onboarding`) — 6-step flow (welcome, location, skill, board, waves, preferences)
  - Upgrade (`/upgrade`) — Stripe subscription flow
- **API routes (Next.js proxy):**
  - `/api/forecast`, `/api/buoy`, `/api/stoke`, `/api/optimal`
  - `/api/nlq/stream` (streaming LLM responses)
  - `/api/insights`, `/api/safety`, `/api/swell-events`
  - `/api/snow-forecast` (Open-Meteo proxy)
  - `/api/checkout` (Stripe), `/api/webhook/stripe`, `/api/generate-api-key`

### Backend (FastAPI / Python 3.12)
All routers live in `apps/api/routers/`:
- `spots.py` — spot list + detail
- `forecast.py` — 7/16-day ensemble hourly forecast
- `buoys.py` — live NDBC readings + spectral data
- `sessions.py` — session CRUD + analytics
- `stoke.py` — personalized Peak Score™ computation
- `nlq.py` — natural language queries to on-device LLM
- `optimal.py` — ranked optimal surf windows
- `safety.py` — hazard detection (rip currents, rocks, etc.)
- `gear.py` — board/gear recommendations
- `snow.py` — snow forecasts (SNOTEL integration)
- `insights.py` — surf session insights
- `swell_events.py` — swell event tracking

### Services
All in `apps/api/services/`:
- `ndbc.py` — NOAA NDBC realtime + spectral fetcher
- `open_meteo.py` — Open-Meteo marine + atmosphere client
- `tides.py` — NOAA CO-OPS tides API
- `bias_correction.py` — LightGBM per-spot wave height correction
- `ensemble.py` — multi-model forecast assembly
- `stoke_score.py` — personalized scoring (height/period/direction/wind/crowd, user-weighted)
- `crowd_model.py` — crowd prediction (time + day patterns)
- `optimal_windows.py` — optimal time slot ranking algorithm
- `llm.py` — Ollama / llama.cpp client
- `swan_runner.py` — SWAN nearshore model wrapper (Phase 3+)
- `gear_recommender.py` — board/gear suggestions
- `safety.py` — hazard analysis
- `surf_insights.py` — session analytics
- `swell_tracker.py` — swell event tracking
- `snow/snotel.py` — SNOTEL snow data

### ML Models
10 trained LightGBM bias correction models in `apps/api/models/ml/` (~8.8MB total):
- Mavericks, Ocean Beach SF, Steamer Lane, Rincon, Lower Trestles, Blacks Beach, Pipeline HI, Sebastian Inlet FL, Cape Hatteras NC, Montauk NY
- Trained on 2016–2025 NDBC historical data (69MB parquet files in `data/ndbc_historical/`)
- Features: buoy Hs, Tp, direction, wind speed/dir, tide, spectral bands (12), day-of-year
- Output: face height (m) + confidence score (0–1)

LLM model: `models/phi-6-mini-q6_k_l.gguf` (3.1GB, Q6_K_L quantization, served via Ollama)

---

## ARCHITECTURE

```
[Intel NUC — Home Server]
  ├── Open-Meteo (self-hosted Docker :8080) ← pulls ECMWF/DWD/NOAA open data
  ├── FastAPI backend (:8000 internal, :8002 host)
  │    ├── NDBC data pipeline (hourly APScheduler)
  │    ├── ML inference (LightGBM per-spot bias correction)
  │    └── llama.cpp/Ollama (:11434) — Phi-4-mini NLQ
  ├── Next.js frontend (:3001 internal, :3002 host)
  └── Nginx (:8880→80, :8443→443) — HTTPS reverse proxy, Tailscale Let's Encrypt TLS

[Supabase — Free Tier]
  ├── PostgreSQL + PostGIS (spots, sessions, users, API keys, quiver)
  ├── TimescaleDB (buoy_observations, spot_forecasts hypertables)
  ├── Supabase Auth (magic link + Google OAuth)
  └── pgvector (session notes embeddings)

[Vercel — Free Tier]
  └── Next.js 15 (TypeScript, App Router, Tailwind CSS v4)

[Cloudflare Tunnel — future production]
  └── Exposes NUC API to internet (config in docker-compose.yml, currently commented)
```

---

## TECH STACK

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 | App Router, RSC |
| Charts | Recharts 2.13, D3 | Spectral waterfall, tide, wind rose |
| Maps | Leaflet 1.9.4 + MapLibre GL 4.7 | Leaflet used for surf/snow/trails maps |
| Backend | FastAPI (Python 3.12), async | ML-native, APScheduler for cron |
| Database | Supabase (Postgres 15 + PostGIS + TimescaleDB) | Free tier |
| Auth | Supabase Auth | Magic link + Google OAuth |
| ML | LightGBM, scikit-learn, numpy, pandas | CPU-optimized on NUC |
| LLM | Ollama (phi4-mini Q6_K_L) | On-device, zero API cost |
| Data | NOAA NDBC, Open-Meteo self-hosted, NOAA CO-OPS tides | All free |
| Payments | Stripe | Freemium gates |
| Infra | Docker Compose (NUC) + Nginx + Tailscale TLS + Vercel | ~$12/year |
| Secrets | Bitwarden Secrets Manager (bws) | Dev: .env file |

---

## MONOREPO STRUCTURE

```
peakcast/
├── CLAUDE.md                      ← you are here
├── RUNBOOK.md                     ← operational runbook (start/stop, certs, SMTP, etc.)
├── PRODUCT_ROADMAP.md
├── NUC_SETUP.md
├── docker-compose.yml             ← NUC services (open-meteo, api, web, llm, nginx)
├── .env.example                   ← secrets template
├── inject-secrets.sh              ← Bitwarden secrets injection
├── start.sh                       ← startup helper
│
├── scripts/
│   ├── setup-certs.sh             ← Tailscale cert setup (run on host before first start)
│   └── renew-certs.sh             ← weekly cert renewal cron script
│
├── apps/
│   ├── web/                       ← Next.js 15 frontend (Vercel)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/        ← login, signup, forgot/reset password
│   │   │   │   ├── (dashboard)/   ← all authenticated pages
│   │   │   │   │   ├── layout.tsx          ← sidebar + LocationProvider
│   │   │   │   │   ├── page.tsx            ← dashboard home
│   │   │   │   │   ├── map/                ← Leaflet surf map
│   │   │   │   │   ├── spot/[id]/          ← full spot forecast page
│   │   │   │   │   ├── sessions/           ← session log
│   │   │   │   │   ├── profile/            ← user profile + quiver
│   │   │   │   │   ├── explore/            ← spot discovery
│   │   │   │   │   ├── snow/               ← ski resort map + detail
│   │   │   │   │   ├── trails/             ← hiking/trail map
│   │   │   │   │   ├── weather/            ← weather map
│   │   │   │   │   ├── wind/               ← wind visualization
│   │   │   │   │   ├── api-portal/         ← B2B API key management
│   │   │   │   │   ├── admin/              ← admin panel
│   │   │   │   │   ├── onboarding/         ← 6-step onboarding
│   │   │   │   │   └── upgrade/            ← Stripe subscription
│   │   │   │   ├── api/                    ← Next.js API routes (proxy + webhooks)
│   │   │   │   ├── auth/                   ← OAuth callback, password reset
│   │   │   │   ├── surf/[slug]/            ← public (unauth) spot landing page
│   │   │   │   └── layout.tsx              ← root layout (Syne + JetBrains Mono + Inter)
│   │   │   ├── components/
│   │   │   │   ├── forecast/               ← ForecastTimeline, StokeScore, SwellSpectrum,
│   │   │   │   │                              TideChart, WindRose, OptimalWindows,
│   │   │   │   │                              BuoyReadings, AskPeak, ModelComparison,
│   │   │   │   │                              WeekQualityBar, StokeScoreWidget, etc.
│   │   │   │   ├── spots/                  ← SpotMap (Leaflet), SpotCard, SpotCams
│   │   │   │   ├── sessions/               ← SessionLogger, SessionHistory, QuiverManager
│   │   │   │   ├── LocationPermissionPrompt.tsx
│   │   │   │   ├── GlobalSearch.tsx
│   │   │   │   └── SidebarAuthButton.tsx
│   │   │   ├── lib/
│   │   │   │   ├── supabase/client.ts      ← browser Supabase client
│   │   │   │   ├── supabase/server.ts      ← server-side Supabase client
│   │   │   │   ├── api.ts                  ← NUC API fetch wrappers
│   │   │   │   ├── location.tsx            ← LocationProvider + useLocation() hook
│   │   │   │   ├── gates.ts                ← subscription feature gates
│   │   │   │   ├── utils.ts                ← formatting helpers
│   │   │   │   ├── useSavedSpots.ts        ← saved spots hook
│   │   │   │   ├── analytics.ts
│   │   │   │   └── push.ts                 ← push notifications
│   │   │   ├── types/
│   │   │   │   ├── index.ts                ← Spot, Forecast, Session types
│   │   │   │   ├── snow.ts                 ← SnowForecastDay, resort types
│   │   │   │   └── trails.ts               ← trail/hiking types
│   │   │   └── data/
│   │   ├── package.json
│   │   ├── next.config.ts
│   │   ├── tailwind.config.ts
│   │   └── Dockerfile
│   │
│   └── api/                       ← FastAPI backend (NUC Docker)
│       ├── main.py                ← FastAPI app, CORS, APScheduler
│       ├── config.py              ← Pydantic Settings (bws secrets)
│       ├── requirements.txt
│       ├── Dockerfile
│       ├── routers/               ← 12 REST routers (see above)
│       ├── services/              ← 15 service modules (see above)
│       ├── models/
│       │   ├── schemas.py         ← 100+ Pydantic v2 models
│       │   └── ml/                ← 10 trained LightGBM .pkl models
│       ├── db/
│       │   ├── supabase_client.py ← async Supabase wrapper, fallback to JSON
│       │   └── timeseries.py      ← TimescaleDB helpers
│       ├── middleware/
│       │   ├── auth.py            ← API key validation
│       │   └── api_key.py         ← secret header check
│       └── scheduler/
│           └── jobs.py            ← hourly buoy, 6h forecast, daily model refresh
│
├── ml/                            ← training scripts (run locally, not in Docker)
│   ├── download_ndbc_history.py
│   ├── train_bias_correction.py
│   ├── train_stoke_model.py
│   ├── train_crowd_model.py
│   └── evaluate_models.py
│
├── data/
│   ├── spots.json                 ← 140 US surf breaks (lat/lng, optimal conditions, buoy IDs)
│   ├── resorts.json               ← 100 US ski resorts
│   ├── ndbc_historical/           ← 69MB parquet files (8 buoys, 2016–2025)
│   ├── bathymetry/                ← NOAA bathy grids per spot (SWAN input)
│   └── swan_configs/              ← SWAN input files per spot
│
├── models/
│   └── phi-6-mini-q6_k_l.gguf    ← 3.1GB quantized LLM (Ollama serves this)
│
├── nginx/
│   ├── Dockerfile                 ← nginx:1.27-alpine + openssl + dhparam at build
│   ├── nginx.conf                 ← TLS 1.2/1.3, strong ciphers, security headers
│   ├── generate-certs.sh          ← Container entrypoint: verify certs, fallback self-signed
│   └── certs/                     ← cert.pem + key.pem (gitignored, host-persisted volume)
│
└── supabase/
    ├── migrations/
    │   ├── 001_init.sql           ← spots, buoy_observations, spot_forecasts, user_sessions, user_profiles
    │   ├── 002_timeseries.sql     ← TimescaleDB hypertables
    │   ├── 003_ml_features.sql    ← ML feature materialization views
    │   ├── 004_api_keys.sql       ← B2B API key table
    │   └── 005_quiver.sql         ← board/quiver management tables
    └── seed.sql
```

---

## DATABASE SCHEMA

### Core Tables

```sql
-- spots: surf break metadata
CREATE TABLE spots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  region TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  break_type TEXT CHECK (break_type IN ('beach','reef','point','rivermouth','jetty')),
  optimal_swell_direction NUMERIC,
  optimal_swell_direction_range NUMERIC DEFAULT 45,
  optimal_wind_direction NUMERIC,
  optimal_period_min NUMERIC DEFAULT 10,
  optimal_period_max NUMERIC DEFAULT 20,
  optimal_size_min NUMERIC DEFAULT 1.5,
  optimal_size_max NUMERIC DEFAULT 3.0,
  nearest_buoy_id TEXT,
  swan_enabled BOOLEAN DEFAULT FALSE,
  bathymetry_file TEXT,
  timezone TEXT DEFAULT 'America/Los_Angeles',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- buoy_observations: raw NDBC readings (TimescaleDB hypertable)
CREATE TABLE buoy_observations (
  station_id TEXT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL,
  wvht NUMERIC, dpd NUMERIC, apd NUMERIC, mwd NUMERIC,
  wspd NUMERIC, wdir NUMERIC, pres NUMERIC, atmp NUMERIC, wtmp NUMERIC,
  spectral_energy JSONB,
  PRIMARY KEY (station_id, observed_at)
);

-- spot_forecasts: assembled forecasts (TimescaleDB hypertable)
CREATE TABLE spot_forecasts (
  spot_id UUID REFERENCES spots(id),
  forecast_time TIMESTAMPTZ NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  model_source TEXT NOT NULL,
  wave_height_m NUMERIC, wave_height_face_m NUMERIC,
  wave_period_s NUMERIC, wave_direction NUMERIC,
  swell_height_m NUMERIC, swell_period_s NUMERIC, swell_direction NUMERIC,
  wind_swell_height_m NUMERIC,
  wind_speed_ms NUMERIC, wind_direction NUMERIC, wind_gust_ms NUMERIC,
  tide_height_m NUMERIC, tide_state TEXT,
  quality_score NUMERIC CHECK (quality_score BETWEEN 0 AND 10),
  confidence NUMERIC CHECK (confidence BETWEEN 0 AND 1),
  wave_spectrum JSONB,
  PRIMARY KEY (spot_id, forecast_time, model_source)
);

-- user_sessions: logged surf sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  spot_id UUID REFERENCES spots(id),
  session_date DATE NOT NULL,
  start_time TIMESTAMPTZ, end_time TIMESTAMPTZ,
  wave_height_face_m NUMERIC, wave_period_s NUMERIC,
  wave_direction NUMERIC, wind_speed_ms NUMERIC,
  wind_direction NUMERIC, tide_height_m NUMERIC,
  quality_rating INTEGER CHECK (quality_rating BETWEEN 1 AND 10),
  crowd_rating INTEGER CHECK (crowd_rating BETWEEN 1 AND 5),
  notes TEXT,
  notes_embedding VECTOR(384),
  skill_tags JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- user_profiles: stoke preferences + subscription tier
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT,
  skill_level TEXT CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
  board_type TEXT CHECK (board_type IN ('shortboard','longboard','fish','funboard','SUP','bodyboard')),
  pref_min_height_m NUMERIC DEFAULT 0.6,
  pref_max_height_m NUMERIC DEFAULT 2.5,
  pref_min_period_s NUMERIC DEFAULT 8,
  pref_offshore_importance NUMERIC DEFAULT 0.8,
  pref_crowd_tolerance NUMERIC DEFAULT 0.5,
  home_spots UUID[],
  subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free','pro','explorer')),
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- boards: user's surfboard quiver (005_quiver.sql)
CREATE TABLE boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  brand TEXT, model TEXT,
  length_ft NUMERIC, width_in NUMERIC, thickness_in NUMERIC,
  volume_L NUMERIC,                    -- capital L, matches component
  board_type TEXT CHECK (board_type IN ('shortboard','longboard','fish','funboard','egg','gun','SUP','bodyboard','foil','other')),
  fin_setup TEXT,
  best_wave_min_ft NUMERIC, best_wave_max_ft NUMERIC, best_period_min_s NUMERIC,
  notes TEXT,
  active BOOLEAN DEFAULT TRUE,
  primary_board BOOLEAN DEFAULT FALSE, -- enforced unique per user via partial index
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- wetsuits: user's wetsuit quiver (005_quiver.sql)
CREATE TABLE wetsuits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, brand TEXT,
  thickness TEXT NOT NULL,             -- e.g. '4/3', '3/2', 'spring', 'boardshorts'
  temp_min_f NUMERIC, temp_max_f NUMERIC,
  booties BOOLEAN DEFAULT FALSE,       -- no "has_" prefix — matches component fields
  gloves  BOOLEAN DEFAULT FALSE,
  hood    BOOLEAN DEFAULT FALSE,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- session_gear: links surf sessions to the gear used (005_quiver.sql)

-- api_keys: B2B API access (explorer tier)
-- quiver: user board collection (005_quiver.sql)
```

---

## SUBSCRIPTION GATING

```typescript
// lib/gates.ts
export const FEATURE_GATES = {
  forecast_days:          { free: 7,     pro: 16,   explorer: 16 },
  spots_saved:            { free: 3,     pro: 20,   explorer: 50 },
  stoke_score:            { free: false, pro: true,  explorer: true },
  optimal_windows:        { free: false, pro: true,  explorer: true },
  nlq_queries_per_day:    { free: 0,     pro: 10,   explorer: 50 },
  crowd_prediction:       { free: false, pro: true,  explorer: true },
  spectral_data:          { free: false, pro: true,  explorer: true },
  b2b_api_access:         { free: false, pro: false, explorer: true },
} as const;
```

---

## API ENDPOINTS

### FastAPI (NUC backend)

```
GET  /api/v1/spots                        → list all spots with current conditions
GET  /api/v1/spots/{slug}                 → spot detail + metadata
GET  /api/v1/forecast/{spot_id}           → 7/16-day hourly forecast
GET  /api/v1/forecast/{spot_id}/ensemble  → model comparison (pro/explorer)
GET  /api/v1/buoys/{station_id}/live      → current buoy reading
GET  /api/v1/buoys/{station_id}/spectrum  → full spectral data
GET  /api/v1/optimal/{spot_id}            → ranked optimal windows
GET  /api/v1/crowd/{spot_id}              → crowd prediction next 7 days
POST /api/v1/stoke                        → compute personalized peak score
POST /api/v1/nlq                          → natural language query
GET  /api/v1/safety/{spot_id}             → hazard/safety data
GET  /api/v1/gear/{spot_id}               → gear recommendations
GET  /api/v1/snow/{resort_id}             → snow forecast
GET  /api/v1/insights/{user_id}           → surf session insights
GET  /health                              → health check
```

### Next.js API Routes (Vercel proxy)

```
POST /api/forecast        → proxy to NUC (adds auth header)
POST /api/webhook/stripe  → handle subscription events
GET  /api/buoy            → buoy data proxy
POST /api/stoke           → peak score proxy
GET  /api/optimal         → optimal windows proxy
GET  /api/nlq/stream      → streaming NLQ (SSE)
GET  /api/snow-forecast   → Open-Meteo snow proxy
POST /api/checkout        → Stripe checkout session
POST /api/generate-api-key → B2B API key generation
```

---

## DOCKER COMPOSE SERVICES

| Service | Internal Port | Host Port | Purpose |
|---|---|---|---|
| `open-meteo-api` | 8080 | — (internal only) | Self-hosted Open-Meteo marine API |
| `api` | 8000 | 8002 | FastAPI backend |
| `web` | 3001 | 3002 | Next.js frontend |
| `llm` | 11434 | — (internal only) | Ollama LLM server |
| `nginx` | 80, 443 | **8880, 8443** | HTTPS reverse proxy |

> **Port conflict note:** Ports 80/443 are occupied by `hive-nginx-1` (another project, uses `network_mode: host`). Peakcast nginx maps to 8880/8443 on the host.

**Start the stack:**
```bash
# First run only — get Let's Encrypt cert via Tailscale (see RUNBOOK §13)
./scripts/setup-certs.sh

# Start all services
docker compose up -d

# With Bitwarden secrets injection (production)
bws run -- docker compose up -d
```

---

## TLS / HTTPS

Uses **Tailscale** for browser-trusted Let's Encrypt certificates — no rootCA distribution needed. Any device on the tailnet gets the padlock automatically.

**Prerequisites (one-time in Tailscale admin console):**
1. Enable MagicDNS: https://login.tailscale.com/admin/dns
2. Enable HTTPS Certificates: same page

```bash
# One-time cert setup
chmod +x scripts/setup-certs.sh scripts/renew-certs.sh
./scripts/setup-certs.sh            # get Let's Encrypt cert via tailscale cert
docker compose restart nginx
```

App is at `https://<nuc-hostname>.tail12345.ts.net:8443` from any tailnet device.

**Auto-renewal** (weekly cron — `crontab -e`):
```
0 3 * * 1 /home/zach/nSwell/scripts/renew-certs.sh >> /var/log/peakcast-certs.log 2>&1
```

**Public access**: `tailscale funnel --bg 8443` (replaces Cloudflare Tunnel)

**Fallback**: If `setup-certs.sh` hasn't been run, nginx auto-generates a self-signed cert on startup (browsers show "Not Secure").

Local access still works at:
- `https://localhost:8443` (NUC local, self-signed warning if no Tailscale cert)
- `http://localhost:8880` → auto-redirects to HTTPS

---

## ENVIRONMENT VARIABLES

```bash
# .env / Bitwarden secrets (API server)
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_ANON_KEY=...
NOAA_TIDES_API_KEY=...         # free — tidesandcurrents.noaa.gov
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SECRET_KEY=...                  # FastAPI JWT signing key
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=["https://peakcast.app"]
OPEN_METEO_BASE_URL=http://open-meteo-api:8080
OPEN_METEO_FORECAST_BASE_URL=https://api.open-meteo.com
LLAMA_CPP_BASE_URL=http://llm:11434/v1

# .env.local (Next.js / Vercel)
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=http://localhost:8002   # local dev
NUC_API_BASE_URL=https://api.peakcast.app   # production (Cloudflare Tunnel)
NUC_API_SECRET=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_APP_URL=https://peakcast.app
```

---

## CODING STANDARDS

- **Python:** `async/await` throughout. Pydantic v2 for all schemas. Type hints everywhere. `ruff` for linting.
- **TypeScript:** Strict mode. No `any`. Zod for runtime validation. Server Components by default; `'use client'` only when needed.
- **Leaflet:** Always dynamic import with `ssr: false`. Guard double-init with `_leaflet_id` check + `cancelled` closure flag in `useEffect`. Import `leaflet/dist/leaflet.css` inside the client component — never in root layout (causes hydration mismatch).
- **React:** `suppressHydrationWarning` on `<html>` and `<body>`. Use `await params` in server components (not `use(params)`).
- **Database:** All queries through Supabase client or typed RPC. Enable RLS on all user-facing tables.
- **Error handling:** Never swallow errors silently. Log with structlog (Python) / console.error with context (TS).
- **Maps:** Prevent drag-deselect with `lastDragEnd` timestamp (200ms window). Default `panelOpen: false`; sidebar starts hidden (`visibility: hidden`) with delayed transition.
- **Scroll in panels:** `minHeight: 0` on flex children (critical for flex shrink + scroll), `overscrollBehavior: contain`, `WebkitOverflowScrolling: touch`.

---

## IMPLEMENTATION STATUS

### Fully Implemented ✅
- REST API (12 routers, all endpoints)
- 140-spot database with NDBC buoy mappings
- Real-time NDBC data pipeline (hourly APScheduler)
- Open-Meteo marine forecast (wave, wind, tide)
- 10 trained LightGBM bias correction models (2016–2025 data)
- Personalized Peak Score™ with component breakdown
- Crowd prediction model
- Optimal windows ranking
- Natural language queries (Ollama on-device)
- Safety/hazard detection
- Gear recommendations
- Surf session logging + analytics + insights
- Swell event tracking
- User subscription tiers (free/pro/explorer) + Stripe
- Feature gating throughout
- All frontend pages (forecast, map, sessions, profile, snow, trails, weather, wind, admin, onboarding, upgrade)
- Ocean/Peakcast brand UI
- Leaflet maps with live location detection + permission flow
- Recharts spectral waterfall, tide chart, wind rose
- OAuth + magic link auth (Supabase)
- API key management (B2B explorer tier)
- Docker Compose stack (NUC)
- Nginx HTTPS with Tailscale Let's Encrypt workflow + dhparam hardening
- 6-step onboarding flow

### Scaffolded / Partial 🔧
- SWAN nearshore model (config + runner present, commented out in compose — Phase 3)
- Cloudflare Tunnel (commented in compose, local dev only)
- Spectral data storage pipeline (schema ready, not fully populated)
- Session notes embedding pipeline (pgvector schema ready)

### Future (Phase 3+) 📋
- SWAN active for Mavericks, Pipeline
- Cloudflare Tunnel for public production access
- ML model auto-retraining pipeline
- B2B API tier full enforcement
- Advanced crowd model training
