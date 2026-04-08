# Claude Code: Phase 1 Prompt
# Paste this entire block as your first message to Claude Code
# after opening the swellstack/ directory.
# ─────────────────────────────────────────────────────────────────────────────

Please read CLAUDE.md and TASKS.md in full before starting.

Then execute Phase 1 of TASKS.md completely. Here is the priority order:

## Your job in this session:

1. **Scaffold the monorepo** using pnpm workspaces. Create apps/web (Next.js 15 with TypeScript + Tailwind + shadcn/ui + App Router) and apps/api (FastAPI with the existing main.py and requirements.txt). Add a root package.json with workspaces config.

2. **Build the NDBC data pipeline** in apps/api/services/ndbc.py:
   - Async fetch of stdmet (.txt) and spectral (.data_spec + .swdir) files
   - Parser for NDBC's fixed-width whitespace-delimited format
   - Handle MM (missing) values, convert to proper float nulls
   - Unit tests in apps/api/tests/test_ndbc.py using real fixture data (fetch one real file from NDBC as a fixture)

3. **Build the Open-Meteo client** in apps/api/services/open_meteo.py:
   - fetch_marine_forecast(lat, lon, days=7) → structured dict
   - fetch_wind_forecast(lat, lon) → aligned wind data
   - Use the self-hosted URL from env (falls back to open-meteo.com/en/docs/marine-weather-api for dev)

4. **Build the NOAA tides client** in apps/api/services/tides.py:
   - fetch_tide_predictions(station_id, days=7) using NOAA CO-OPS API
   - In-memory cache (24h TTL) since tides are deterministic

5. **Write the database client** in apps/api/db/supabase_client.py:
   - Async Supabase client wrapper
   - upsert_buoy_observations(station_id, df)
   - upsert_spot_forecasts(spot_id, forecasts)
   - get_spots() → list of Spot objects
   - get_spot_by_slug(slug) → Spot

6. **Wire up the scheduler** in apps/api/scheduler/jobs.py:
   - update_buoy_data() runs every hour at :30
   - update_forecasts() runs every 6 hours
   - Both jobs log success/failure with structlog

7. **Build the forecast router** in apps/api/routers/forecast.py:
   - GET /api/v1/forecast/{spot_id}?days=7 → assembled hourly forecast
   - Combine Open-Meteo + NDBC correction (physics fallback from CLAUDE.md)
   - Include tide data aligned to forecast hours
   - Return Pydantic model with all fields from CLAUDE.md schema

8. **Build the spots router** in apps/api/routers/spots.py:
   - GET /api/v1/spots → list with current conditions
   - GET /api/v1/spots/{slug} → detail with metadata

9. **Build the Next.js frontend shell**:
   - Auth: apps/web/app/(auth)/login/page.tsx with Supabase magic link
   - Layout: apps/web/app/(dashboard)/layout.tsx with sidebar nav
   - Home: apps/web/app/(dashboard)/page.tsx with SpotMap (MapLibre GL)
   - Spot page: apps/web/app/(dashboard)/spot/[id]/page.tsx with:
     - Current conditions hero
     - 7-day forecast cards (scrollable row)
     - Each card: wave height, period, direction icon, wind, quality bar
   - NUC API client: apps/web/lib/api.ts

10. **Configure docker-compose.yml** (already exists at root) — verify it's correct, add any missing health checks.

## Constraints:
- All Python: use `async/await`, Pydantic v2, type hints everywhere
- All TypeScript: strict mode, no `any`, Zod for API response validation
- Never hardcode secrets — always use env vars
- MapLibre GL is the map library (not Google Maps, not Mapbox with paid key)
- Use shadcn/ui components for the frontend
- Run `pnpm build` and `uv run pytest` before declaring done

## Definition of Done for Phase 1:
- `docker-compose up` starts all services without errors
- `/health` endpoint returns 200
- NDBC data fetches real buoy data and parses without errors
- `/api/v1/spots` returns the 10 spots from data/spots.json
- `/api/v1/forecast/{spot_id}` returns 7 days of forecast data
- Next.js app builds successfully with `pnpm build`
- Spot map renders with pins for all 10 spots
- Clicking a spot shows forecast data

Start with the project scaffold, then work through the list in order.
Ask clarifying questions only if something is genuinely ambiguous.
Otherwise, make sensible decisions and proceed.
