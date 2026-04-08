# TERRAIN — Product Roadmap
## Senior PM Perspective: From Good Data App to Essential Outdoor Intelligence

> **North Star Metric**: Daily Active Users who make a real-world outdoor decision using TERRAIN.
> **The Gap We're Closing**: Raw forecast data → "I know exactly what to do this weekend."
> Every item below closes that gap for one more type of user.

---

## HOW TO READ THIS DOCUMENT

- **P0** = Blocking launch / retention is broken without this
- **P1** = Core daily habit drivers — highest ROI after P0
- **P2** = Differentiation from every competitor in the space
- **P3** = Growth and community flywheel
- **P4** = Platform expansion and revenue scale

Priority is listed inline as `[P0]` etc. Work P0 → P4 in order within each section.

---

## 1. INTELLIGENCE LAYER — The Brain

*The app knows things. Users just ask it questions.*

### 1.1 Smart Alerts Engine
- [ ] `[P0]` Alert builder UI — user sets condition thresholds per spot/resort/trail (wave height ≥ 5ft, powder score ≥ 80, conditions = "prime")
- [ ] `[P0]` Push notification delivery (via web push / PWA) when threshold is crossed
- [ ] `[P0]` Email digest fallback for users who haven't enabled push
- [ ] `[P0]` Alert scheduling — "only alert me Friday 5pm–Sunday" (weekender mode)
- [ ] `[P1]` Alert cadence control — max 1 alert per 6h per spot (no spam)
- [ ] `[P1]` "Watch" list — favorite spots/resorts/trails that surface in dashboard automatically
- [ ] `[P1]` Swell/storm event alerts — "A NW swell is incoming: 14ft @ 18s arrives Saturday 6am at your saved spots"
- [ ] `[P2]` ML-predicted alert timing — "Based on your session history, you prefer 6ft+ on rising tide. Alert at 5am?"
- [ ] `[P2]` Avalanche bulletin change alerts for watched ski regions
- [ ] `[P2]` Trail closure alerts via USFS/NPS webhook integration

### 1.2 Personalized Morning Brief
- [ ] `[P1]` Daily 6am push/email: top 3 conditions for your sport at your saved spots today
- [ ] `[P1]` Weekly outlook: best windows for the next 7 days, ranked by your preferences
- [ ] `[P2]` "Glass morning" brief — detects early morning glassy windows before crowds hit
- [ ] `[P2]` Narrative format via LLM: "This weekend looks FIRING at Steamer Lane. The NW swell peaks Saturday morning with offshore winds. Tide is rising at 7am — perfect. Get there early."
- [ ] `[P3]` Briefing personalization: learn from which alerts the user acts on vs. ignores

### 1.3 Trip Planner
- [ ] `[P1]` Multi-spot comparison view — pick a weekend, compare 3–5 spots side-by-side on the same grid (height, period, wind, quality score)
- [ ] `[P1]` "Best day this week" smart picker — given user's home location + preferences, recommend the single best surf/snow/hike window
- [ ] `[P2]` Drive time integration — radius filter (within 2h of my location) using OpenRouteService API
- [ ] `[P2]` Multi-day trip builder — "Planning a surf trip to Santa Cruz next Thursday–Sunday" — show optimal session windows across days
- [ ] `[P2]` Snow road conditions — CDOT/Caltrans road closures + chain requirements at resort access roads
- [ ] `[P3]` AI itinerary generator — "Plan me a surf + trail day near Big Sur" → morning surf at Pfeiffer Beach, afternoon hike on Ewoldsen Trail, conditions aligned

### 1.4 AskTERRAIN (Natural Language Intelligence)
- [ ] `[P0]` Wire AskStoke NLQ to actual Ollama endpoint — currently UI exists, backend may be disconnected
- [ ] `[P1]` Expand NLQ beyond surf to snow and trail: "Is Mammoth going to have fresh snow this weekend?", "Is the Enchantments doable in April?"
- [ ] `[P1]` Streaming response (SSE already exists in backend — connect to frontend)
- [ ] `[P2]` Session-context queries: "How does this Saturday compare to when I surfed OB last March?"
- [ ] `[P2]` Tool-use pattern — LLM can call internal APIs (get_forecast, get_snow_conditions, get_trail_status) to answer complex questions
- [ ] `[P2]` Voice input (Web Speech API) — "Hey TERRAIN, is it worth driving to Mavericks tomorrow?"
- [ ] `[P3]` Conversational memory across sessions — "You asked about Mavericks last week. The swell you were waiting for just arrived."

### 1.5 Condition Intelligence Cards
- [ ] `[P1]` "Why is it good/bad today" explanations on every spot — LLM-generated 2-sentence reason using actual forecast components
- [ ] `[P1]` Historical benchmark card: "This is the best surf OB has seen in 3 weeks" or "Below average for this time of year"
- [ ] `[P2]` Confidence indicators — "Model agreement: HIGH — 3 of 3 models agree on Saturday swell"
- [ ] `[P2]` Anomaly detection alerts — "Unusually large south swell incoming — this only happens 4x per year at Trestles"
- [ ] `[P3]` Seasonal pattern overlay: compare current forecast to same week in 2023, 2024

---

## 2. USER EXPERIENCE — The Product

*Everything between opening the app and getting in the water.*

### 2.1 Personalized Home Dashboard
- [ ] `[P0]` Replace root `/` map redirect with a smart home screen that adapts to the user
- [ ] `[P1]` "My Spots" widget — swipeable cards for saved surf spots, resorts, trails with live condition pills
- [ ] `[P1]` "Today's Best" section — top 3 recommendations across all sport types based on user's preferences
- [ ] `[P1]` "Recent Sessions" quick log — one-tap to log a session for a recent spot
- [ ] `[P1]` Live condition ticker — small scrolling strip of active conditions across saved spots
- [ ] `[P2]` Adaptive layout — if user is primarily a surfer, surf spots dominate; skier → snow resorts
- [ ] `[P2]` "Upcoming" calendar view — week ahead, best windows marked by sport
- [ ] `[P3]` Widget-style cards user can reorder and configure (drag-to-rearrange)

### 2.2 Search & Discovery
- [ ] `[P0]` Global search bar — single input that searches across surf spots, ski resorts, trails (fuzzy match on name, region, state)
- [ ] `[P1]` "Near me" button — GPS-based nearest spots/resorts/trails with current conditions
- [ ] `[P1]` Search results show live condition badges inline
- [ ] `[P2]` Filter-as-you-type: filter by condition, region, difficulty, pass type (ski)
- [ ] `[P2]` Trending spots — "Most viewed today" based on aggregate activity
- [ ] `[P3]` Semantic search: "Find me a beach break with offshore winds right now" → LLM parses → filtered results

### 2.3 Saved Spots & Favorites
- [ ] `[P0]` Save/unsave spots, resorts, trails (heart/bookmark icon on every card)
- [ ] `[P0]` Saved items appear in home dashboard and alert builder
- [ ] `[P1]` Categorize saves: "My Regular Spots", "Bucket List", "Travel Wishlist"
- [ ] `[P1]` Quick access sidebar tray — pin up to 5 spots for instant one-tap access
- [ ] `[P2]` Smart suggestions — "You've surfed OB 12x, add it to My Regular Spots?"

### 2.4 Spot / Resort / Trail Detail Pages
- [ ] `[P0]` Snow resort detail page — wire to real SNOTEL + HRRR forecast data (currently static)
- [ ] `[P0]` Trail detail page — connect to Open-Meteo for weather at trailhead elevation
- [ ] `[P1]` Webcam embeds — live surf cams (Surfline public, county beach cams), ski resort cams (resort-provided), trail entry cams (NPS/USFS)
- [ ] `[P1]` Parking / access info — trailhead parking status, resort parking levels (crowdsourced)
- [ ] `[P1]` User-submitted condition reports (see section 3.1)
- [ ] `[P2]` Spot "Report Card" — averaged user quality ratings vs. algorithmic score over last 30 days
- [ ] `[P2]` Multi-model forecast comparison on snow pages (HRRR vs. NAM vs. GFS for snowfall)
- [ ] `[P2]` Avalanche danger integration on snow pages — pulls from CAIC/NWAC/UAC/AIARE centers by region
- [ ] `[P2]` Water temperature on surf pages — sourced from NDBC + satellite SST composites
- [ ] `[P3]` Street-level photography — pull Wikimedia Commons geotagged photos for spot hero images

### 2.5 Onboarding Flow
- [ ] `[P0]` Actually functional onboarding — currently a page exists but likely a stub
- [ ] `[P0]` Sport selection (Surf / Snow / Trail / All) — drives default dashboard layout
- [ ] `[P0]` Home location / radius — "How far will you drive for surf?" (50mi / 100mi / 200mi)
- [ ] `[P0]` Skill level per sport — beginner/intermediate/advanced/expert
- [ ] `[P0]` Board type (surf) / riding style (ski: groomer / off-piste / park) / hike style (trail: day hike / backpacker)
- [ ] `[P1]` Condition preference quick-set: 3-question slider quiz that initializes Stoke Score™ prefs
- [ ] `[P1]` Save 3 "home spots" during onboarding — unlocks dashboard personalization immediately
- [ ] `[P2]` "Import from Surfline" shortcut — fetch public Surfline favorites list (if user provides username)

---

## 3. COMMUNITY & SOCIAL — The Network

*Every user who reports conditions makes the app better for every other user.*

### 3.1 Real-Time Condition Reports
- [ ] `[P1]` "I'm here now" report button on every spot/resort/trail detail page
- [ ] `[P1]` Report form: wave height estimate, crowd level (1–5), overall vibe (1–5), free-text note (140 chars)
- [ ] `[P1]` Reports appear as a feed on the spot page (most recent first, auto-expire after 4h)
- [ ] `[P1]` Report map pins — small colored dots on the main map showing spots with recent reports (green = good, yellow = ok, red = crowded/bad)
- [ ] `[P2]` Crowd confidence score — algorithmic blend of user reports + ML crowd model
- [ ] `[P2]` Report karma — frequent/accurate reporters get a "Local" badge, their reports weighted higher
- [ ] `[P2]` Photo attachments on reports (resized/compressed, stored in Supabase Storage)
- [ ] `[P3]` Report AI validation — LLM cross-references report against forecast data ("User reports 8ft but buoy shows 2ft — flagged as unlikely")

### 3.2 Session Logging (Complete the Loop)
- [ ] `[P0]` Actually wire sessions POST endpoint — currently returns mock response; needs real Supabase write
- [ ] `[P0]` Session list GET endpoint — currently stub; needs to query user_sessions table with RLS
- [ ] `[P1]` Auto-fill conditions at session time — when logging a past session, pull the forecast/buoy data for that time window and pre-populate conditions fields
- [ ] `[P1]` Session tagging — "barreled", "shoulder-hopped", "went with crew", "first time here"
- [ ] `[P1]` Photo per session — one hero photo per session log (Supabase Storage)
- [ ] `[P2]` Session streak tracker — "🔥 12-week streak — you've surfed every week since January"
- [ ] `[P2]` "Rate this session" prompt 2h after an alert fires at a spot the user visits ("Did you end up going? How was it?") — closes the prediction loop
- [ ] `[P3]` GPX track upload for trail sessions — hike route shown on mini-map in session detail

### 3.3 Progress & Analytics
- [ ] `[P1]` Sessions dashboard — total sessions, avg quality, total hours, sessions per month chart
- [ ] `[P1]` "Best session ever" highlight — highest-rated session with full conditions snapshot
- [ ] `[P1]` Spot affinity breakdown — which spots you visit most, avg quality at each
- [ ] `[P2]` Condition pattern insights — "You surf best at OB when period is 14s+ and tide is rising. 78% of your 4+ star sessions match this pattern."
- [ ] `[P2]` Year-over-year comparison — "You've logged 23 sessions so far this year vs. 18 last year at this point. You're 28% ahead of pace."
- [ ] `[P2]` Seasonal heatmap — GitHub-style contributions graph but for surf/snow/trail sessions
- [ ] `[P3]` Bucket list tracker — "I want to surf Mavericks at 20ft+" — app alerts you when it happens and if you're logged as having been there
- [ ] `[P3]` Year-in-review (Dec 31) — Spotify Wrapped style: "2026: You surfed 47 sessions, 14 different spots, best condition was 8.7/10 at Rincon on March 3rd"

### 3.4 Social Layer
- [ ] `[P2]` User profiles — public page at `/u/{username}` showing session count, home spots, sports
- [ ] `[P2]` Follow other users — see their public condition reports in a "following" feed
- [ ] `[P2]` Crew / friend groups — private groups for coordinating sessions ("Saturday OB crew")
- [ ] `[P3]` Spot leaderboards — most sessions logged at a spot this season, highest rated session
- [ ] `[P3]` "Who's going?" — optional public check-in when logging a future session ("Going Saturday 7am — anyone else?")

---

## 4. DATA & FORECASTING — The Engine

*Better data → better decisions → more trust → more users.*

### 4.1 Snow Backend (Currently Zero — Critical Gap)
- [ ] `[P0]` SNOTEL real-time pipeline — `services/snow/snotel.py` pulling new snow, SWE, base depth per station every 6h
- [ ] `[P0]` HRRR snowfall forecast — National Weather Service HRRR model, 48h hourly precipitation + temperature per resort
- [ ] `[P0]` Resort conditions endpoint `GET /api/v1/snow/conditions/{resort_id}` — aggregates SNOTEL + HRRR + resort static data
- [ ] `[P0]` Wire snow resort detail page to real backend data
- [ ] `[P1]` Per-resort Powder Quality Score™ — LightGBM model: SNOTEL 24h/48h snow + wind speed + temperature → snow quality label
- [ ] `[P1]` Avalanche bulletin integration — CAIC, NWAC, GNFAC, UAC, ESAC, CBAC APIs (most publish JSON/GeoJSON)
- [ ] `[P1]` 7-day snow forecast widget — daily bar chart (expected snowfall) + temperature range
- [ ] `[P2]` Multi-resort snowfall comparison — for Epic/Ikon pass holders: "Where did it snow most this week?"
- [ ] `[P2]` Historical snow depth charting — this season vs. last season vs. 10-year average (SNOTEL historical)
- [ ] `[P2]` Lift/terrain status — scrape resort open/closed status pages or use resort-provided APIs (Vail has one)
- [ ] `[P3]` SNODAS gridded analysis — 1km resolution snow water equivalent, detect which resorts have best coverage spatially

### 4.2 Trail Backend
- [ ] `[P0]` Open-Meteo forecast at trail GPS coordinates — temperature, precip, wind at summit elevation
- [ ] `[P1]` Trail status scraper — USFS and NPS trail condition pages (many have RSS feeds or structured HTML)
- [ ] `[P1]` Sunrise/sunset times — critical for trail planning (summit by sunrise, off ridge before afternoon thunderstorms)
- [ ] `[P1]` Lightning risk scoring — NOAA atmospheric sounding data → probability of afternoon convection at altitude
- [ ] `[P2]` Snow coverage estimation for trails — use SNOTEL + elevation gradient to estimate snow on trail above treeline
- [ ] `[P2]` Water crossing alerts — USGS stream gauge integration for trails with river crossings
- [ ] `[P2]` Air quality / smoke index — EPA AirNow API, critical during western US wildfire season
- [ ] `[P3]` AllTrails-style GPX route display — import/display user-submitted or USFS published route data on map

### 4.3 Surf Data Upgrades (V2 Data Layer)
- [ ] `[P1]` CDIP directional buoy integration — `services/cdip.py`, full 64-band directional spectrum for 8 key CA/HI stations (free, better than anything Surfline shows publicly)
- [ ] `[P1]` WAVEWATCH III swell train tracking — `services/ww3.py`, parse NOAA GRIB2 swell partitions → named swell events with origin + ETA
- [ ] `[P1]` Water temperature — NDBC wtmp field + NOAA CoastWatch SST satellite composites (weekly)
- [ ] `[P2]` NOAA NWS marine zone forecast scraper — plain-text coastal forecasts, parse into structured data (buoy advisories, high surf)
- [ ] `[P2]` Surfline public data layer — where Surfline publishes free cam thumbnails or condition summaries, ingest as validation signal
- [ ] `[P2]` Real WW3 16-day extended forecast — stitch WW3 7-day + extended GFS runs → honest 16-day with confidence bands
- [ ] `[P3]` Surf cam computer vision — pull public beach cam snapshots, run wave height estimation model (YOLO fine-tuned on surf footage)
- [ ] `[P3]` Ship AIS / storm track integration — visualize distant generating storms on an animated globe (show where swell originates)

### 4.4 Cross-Sport Data
- [ ] `[P1]` Shared weather layer — one weather service call covers all sports at the same location; don't duplicate API calls
- [ ] `[P2]` "Post-rain window" intelligence — rain stopped, how many days until surf pumps? Trails dry out? Snow stabilizes?
- [ ] `[P2]` Wildfire / air quality impact — alerts when AQI > 150 at trail or surf destination, recommend indoor alternatives
- [ ] `[P3]` Tidal river data — USGS streamflow gauges for kayaking/fishing module (foundation for expansion)

---

## 5. MOBILE & PLATFORM — The Device

*Most users will open TERRAIN on their phone, standing at the water's edge.*

### 5.1 Progressive Web App (PWA)
- [ ] `[P0]` PWA manifest complete — app name, icons (192px, 512px), theme color per sport
- [ ] `[P0]` Service worker — cache last-fetched forecasts for offline access (navigator.serviceWorker)
- [ ] `[P0]` "Add to Home Screen" prompt shown after 3rd visit or after first alert set
- [ ] `[P1]` Offline mode UI — show cached data with "last updated X ago" banner, disable write actions
- [ ] `[P1]` Background sync — when device reconnects, immediately refresh cached spots and send queued session logs
- [ ] `[P2]` iOS standalone mode detection — hide Safari address bar, safe-area insets for notch/dynamic island
- [ ] `[P2]` Share sheet integration — "Share this forecast" generates a beautiful card image (og:image with conditions data, not just a URL)

### 5.2 Mobile UX Patterns
- [ ] `[P1]` Swipeable spot cards on mobile — swipe left/right between saved spots like a surf deck
- [ ] `[P1]` Pull-to-refresh on all live data pages
- [ ] `[P1]` Bottom sheet detail panels instead of full-page navigation on mobile (matches how maps work natively)
- [ ] `[P2]` Haptic feedback on key interactions (condition alert threshold crossed, session logged)
- [ ] `[P2]` Landscape mode for map pages — full-screen map with overlay controls
- [ ] `[P3]` Apple Watch complication — current conditions for top saved spot (temperature, wave height or snow depth, quality score)

### 5.3 Performance
- [ ] `[P1]` Map tile caching — cache viewed map tiles in IndexedDB for offline map browsing
- [ ] `[P1]` Skeleton loading states on all data-fetching components (already exists for some — standardize)
- [ ] `[P2]` Streaming SSR — use Next.js Suspense streaming for parallel data fetches (spot + forecast + conditions in parallel, render as each resolves)
- [ ] `[P2]` Image optimization — all webcam thumbnails through next/image with proper sizing

---

## 6. MONETIZATION — The Business

*Charge for the features users can't live without.*

### 6.1 TERRAIN Free
- [ ] `[P0]` Define and enforce what's free: 5-day forecast, 3 saved spots, basic map, condition reports (read), sessions (up to 10/year)
- [ ] `[P0]` Free tier gate UI — clean "Upgrade to unlock" prompts that explain value, not just block
- [ ] `[P0]` Free users can still receive 1 alert per week (teaser)

### 6.2 TERRAIN Pro ($8/mo or $64/yr)
- [ ] `[P0]` 16-day extended forecast (surf + snow)
- [ ] `[P0]` Unlimited alerts (all sports, all thresholds)
- [ ] `[P0]` Full session history + analytics dashboard
- [ ] `[P0]` AskTERRAIN NLQ (10 queries/day)
- [ ] `[P1]` Multi-model ensemble comparison (ECMWF vs. GFS vs. ICON for surf; HRRR vs. NAM vs. GFS for snow)
- [ ] `[P1]` CDIP spectral data visualization
- [ ] `[P1]` Optimal windows tool (top 10 sessions per week)
- [ ] `[P1]` Morning brief digest (email + push)
- [ ] `[P1]` Stoke Score™ / Powder Quality Score™ full breakdown

### 6.3 TERRAIN Explorer ($24/mo or $199/yr — Team / Power User)
- [ ] `[P2]` API access (10,000 calls/month) — documented REST API with API key management
- [ ] `[P2]` CSV/JSON data export — session history, forecast history
- [ ] `[P2]` Unlimited AskTERRAIN queries
- [ ] `[P2]` Webcam archive — last 24h of cam snapshots per spot
- [ ] `[P2]` Early access to new sport modules

### 6.4 Gear & Affiliate Revenue
- [ ] `[P2]` Board/wetsuit recommendation cards with affiliate links (Cleanline Surf, Evo, REI, Patagonia)
- [ ] `[P2]` Gear condition recommendations contextual to forecast: "Water temp: 54°F → 4/3mm wetsuit recommended" → [Shop Wetsuits]
- [ ] `[P3]` Surf/snow school partner listings — promoted spots for surf lessons near top spots
- [ ] `[P3]` Travel package partnerships — "Planning a surf trip to Costa Rica?" → curated partner links

---

## 7. NEW SPORT MODULES — The Platform

*Each new sport is a new market. Shared infrastructure means marginal cost of adding each is low.*

### 7.1 Kitesurfing / Windsurfing (Next up after Trails)
- [ ] `[P3]` Wind-specific map layer with launch spot database
- [ ] `[P3]` Wind forecast cards: speed, direction, gust delta, on/offshore at each launch
- [ ] `[P3]` Tidal window overlay — ideal tide height per launch
- [ ] `[P3]` Wind quality scoring (0–100: gusty/steady, direction purity, sea state)

### 7.2 Mountain Biking
- [ ] `[P3]` Trail moisture model — rain + days-since-rain + soil type → muddy / tacky / hero dirt
- [ ] `[P3]` Trail database (Trailforks API or MTB Project API)
- [ ] `[P3]` "Is it rideable?" one-tap answer per trail after rain
- [ ] `[P3]` Flow condition score — temperature + moisture + wind → how fast/fun the trail is

### 7.3 Fishing
- [ ] `[P3]` Solunar table + major/minor feed times
- [ ] `[P3]` Water temperature + thermocline estimates per fishing zone
- [ ] `[P3]` Tide + current integration for saltwater spots
- [ ] `[P3]` Species-specific filters — "Show me conditions good for salmon this week"

### 7.4 Climbing
- [ ] `[P4]` Crag weather — micro-forecast at crag GPS coords
- [ ] `[P4]` Rock dryness scoring — hours since rain + temperature + sun exposure
- [ ] `[P4]` Seepage risk for wet-weather crags
- [ ] `[P4]` Mountain Project API integration for route database

### 7.5 Paragliding / Free Flight
- [ ] `[P4]` Thermal forecasting — RASP (Regional Atmospheric Soaring Prediction) integration
- [ ] `[P4]` XC window scoring — thermal strength + cloud base + wind shear
- [ ] `[P4]` Airspace check — Class B/C/D airspace overlay on launch sites

---

## 8. BACKEND & INFRASTRUCTURE — The Foundation

*The boring stuff that makes everything else work.*

### 8.1 Sessions Router (Blocking P1+ Features)
- [ ] `[P0]` Implement `POST /api/v1/sessions` — real Supabase insert into user_sessions table with RLS
- [ ] `[P0]` Implement `GET /api/v1/sessions` — paginated user session history (user_id from JWT)
- [ ] `[P0]` Implement `DELETE /api/v1/sessions/{id}` — soft delete
- [ ] `[P1]` Auto-attach forecast snapshot to session — when session is logged, store the forecast conditions at that time in the session record

### 8.2 Authentication (Make it Real)
- [ ] `[P0]` Supabase Auth fully integrated — magic link + Google OAuth working end-to-end
- [ ] `[P0]` Auth state in Next.js app — server-side session check, redirect to login when accessing protected routes
- [ ] `[P0]` JWT passed to FastAPI backend — validate on every authenticated endpoint
- [ ] `[P1]` User profile CRUD — save board type, preferences, home spots to Supabase user_profiles table

### 8.3 ML Models (Differentiation)
- [ ] `[P1]` Download NDBC historical parquet files — already have data in `/data/ndbc_historical/` but need training script run
- [ ] `[P1]` Train per-spot bias correction models — `ml/train_bias_correction.py` → one LightGBM `.pkl` per spot
- [ ] `[P1]` Train stoke model — `ml/train_stoke_model.py` — once 100+ sessions are logged
- [ ] `[P2]` Per-resort snow density predictor — LightGBM: SNOTEL observation → actual powder quality (needs SNOTEL history)
- [ ] `[P2]` Crowd prediction per-spot baseline — replace hardcoded 0.4 with actual per-spot popularity weights from session data
- [ ] `[P3]` Forecast accuracy tracker — every prediction stored, compare to eventual buoy observation → continuous model improvement loop

### 8.4 API & Developer Platform
- [ ] `[P2]` OpenAPI docs — auto-generated from FastAPI + custom descriptions, served at `/api/v1/docs`
- [ ] `[P2]` API key rotation — allow Explorer tier users to rotate keys via UI without contacting support
- [ ] `[P2]` Rate limiting per tier — Redis-backed rate limiter (middleware already exists in middleware/api_key.py)
- [ ] `[P2]` Webhook support — subscribe to condition changes at a spot via webhook (B2B use case: surf school gets webhook when it hits 4ft+ for lesson booking)
- [ ] `[P3]` GraphQL endpoint — single query for "give me conditions + forecast + user alerts for my dashboard"

### 8.5 Observability & Reliability
- [ ] `[P1]` Structured logging with correlation IDs — every forecast request traces through NDBC → Open-Meteo → bias correction → response
- [ ] `[P1]` Health dashboard — internal `/admin/health` page showing: NUC API status, last NDBC fetch timestamp, last forecast update, SNOTEL fetch status
- [ ] `[P1]` Alerting for pipeline failures — if NDBC fetch fails 3x in a row, send admin email
- [ ] `[P2]` Uptime monitoring — UptimeRobot or similar for NUC API + Vercel frontend
- [ ] `[P2]` Forecast freshness indicator — if data is >6h old, show staleness warning in UI
- [ ] `[P3]` Error budget tracking — SLO: 99% of spot forecast requests respond < 2s

---

## 9. DESIGN & UI SYSTEM — The Feel

*The app should feel like it belongs on a pro athlete's phone.*

### 9.1 Design System Completion
- [ ] `[P1]` Dark/light mode toggle — light mode for outdoor use in bright sun (many surfers use apps outdoors)
- [ ] `[P1]` Consistent loading states — every async component has a skeleton that matches final layout exactly
- [ ] `[P1]` Empty states — every list/feed has a designed empty state (not just blank space)
- [ ] `[P1]` Error states — every API call has a graceful error UI with retry button
- [ ] `[P2]` Micro-animations — wave height number counts up on page load, tide chart draws in from left, stoke ring fills up
- [ ] `[P2]` Haptic design spec — define which interactions get haptic feedback on iOS/Android PWA

### 9.2 Data Visualization Upgrades
- [ ] `[P1]` 16-day quality timeline — scrollable horizontal calendar strip, each day color-coded by quality, click to expand
- [ ] `[P1]` Swell period heat map — X: time, Y: period bands, color: energy — shows swell window at a glance
- [ ] `[P2]` Animated swell rose — D3 polar chart showing directional energy over 24h, animates through time steps
- [ ] `[P2]` Snow depth history chart — sparkline of base depth this season vs. last season vs. 10yr average
- [ ] `[P2]` Trail elevation profile card — SVG elevation chart with color coding (green = snow-free, white = snow-covered)
- [ ] `[P3]` Global swell map — animated globe showing active swell systems + their propagation direction (like Magic Seaweed's forecast map)
- [ ] `[P3]` Crowd heatmap overlay on map — density visualization of predicted crowd levels across spots at selected time

### 9.3 Map Enhancements
- [ ] `[P1]` Cluster markers at low zoom — when zoomed out, group nearby spots into a count badge
- [ ] `[P1]` My location dot — blue pulsing dot for user's GPS position on the map
- [ ] `[P2]` Draw mode — user can draw a region on the map to filter spots to just that area
- [ ] `[P2]` Layer toggles — toggle: Spots / Resorts / Trails / Weather radar / Buoys / Webcams all on one unified map
- [ ] `[P3]` Multi-sport unified map — one map, all sport types toggleable — the "god view" for multi-sport athletes

---

## 10. CONTENT & SEO — The Growth Channel

*Every surf/snow/trail spot is a landing page. There are 10,000 of them.*

- [ ] `[P1]` Public spot pages at `/surf/{slug}` — already started; make them fully indexed with rich metadata
- [ ] `[P1]` Public resort pages at `/snow/{slug}` — structured data for Google (schema.org/TouristAttraction)
- [ ] `[P1]` Public trail pages at `/trails/{slug}` — Google snippet optimization
- [ ] `[P2]` Dynamic OG images — each spot/resort/trail generates a social preview card with current conditions using `@vercel/og`
- [ ] `[P2]` Sitemap.xml — auto-generated from spots/resorts/trails JSON files, submitted to Search Console
- [ ] `[P2]` Blog / conditions archive — "Best surf days of 2026: the data behind every epic session" — content that ranks
- [ ] `[P3]` Regional forecast digests — weekly auto-generated "Pacific Northwest Surf Report" articles using LLM + real forecast data
- [ ] `[P3]` Embed widget — `<terrain-widget spot="steamer-lane-ca" />` web component surf shops and local news sites can embed

---

## SUCCESS METRICS (Track These)

| Metric | Target (6 months) | Why It Matters |
|--------|-----------------|----------------|
| DAU / MAU ratio | > 35% | Daily habit, not weekly check-in |
| Alert set rate | > 60% of registered users | Strongest retention signal |
| Session log rate | > 1 session/month per active user | Closes prediction loop, trains models |
| 7-day forecast accuracy (RMSE) | < 0.18m face height | Core product quality |
| P99 forecast response time | < 1.5s | App feels instant |
| Pro conversion rate | > 8% of registered users | Sustainable business |
| Churn rate (Pro) | < 4%/month | Seasonal sport: churn in off-season is expected |
| NPS | > 45 | "Would you recommend TERRAIN to a surf/ski/trail friend?" |

---

## QUICK WINS (Ship in < 1 Week Each)

These have massive UX impact and minimal implementation cost:

- [ ] Global search bar (Fuse.js fuzzy search over spots.json + resorts.json + trails.json — no backend needed)
- [ ] Save/favorite spots (localStorage initially, sync to Supabase when auth exists)
- [ ] Light mode toggle (CSS variable swap — already have the variable system)
- [ ] Share forecast card (Canvas API → PNG download of current conditions)
- [ ] My Location button on all maps (navigator.geolocation → fly to user position)
- [ ] "Near me" spot filter on map (haversine distance sort)
- [ ] Webcam links on surf spot pages (link to existing public cam URLs — no hosting needed)
- [ ] Water temperature badge on surf spot cards (NDBC wtmp field — already fetched, just not displayed)
- [ ] Swell period on spot map sidebar pills (data exists, just not shown)
- [ ] Offline banner when NUC unreachable (already detected — just add a prettier banner)
