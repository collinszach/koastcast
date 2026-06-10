# KoastCast iOS — Product & Engineering Spec

> Native SwiftUI app for KoastCast. Companion to the web app (koastcast.com) and the
> NUC FastAPI backend. Goal: a **better Surfline** for the all-around outdoor
> adventurer — surf, snow, trails, wind, weather — with AI woven through.

**Status:** Spec / pre-build
**Platform target:** iOS 17.0+ (iPhone first, iPad later), SwiftUI, Swift 6
**Last updated:** 2026-06-09

---

## 0. Design North Star

KoastCast is **geospatial-first, glanceable, and opinionated**. Where Surfline
dumps numbers and makes you interpret them, KoastCast leads with a single
answer ("**It's firing at your home break — go now**") and lets you drill into
the physics if you want.

Three design pillars:

1. **One answer, then depth.** Every screen opens with a verdict (Peak Score™,
   "good/bad", an AI sentence). Charts and spectral data are progressive
   disclosure underneath.
2. **Map is the home base.** Conditions are inherently spatial. The map is a
   first-class tab, not a buried feature, with swappable sport layers.
3. **AI is ambient, not a gimmick.** A morning briefing, natural-language spot
   queries, session insights, and smart alerts — all powered by Claude via the
   NUC `/nlq` router and a new briefing endpoint.

### Visual language (port from web brand)
- Dark ocean base `#060D1A`, cyan accents, "glass" cards (`.ultraThinMaterial`).
- Typography: **Syne** (display/headings), **JetBrains Mono** (data/numbers),
  **Inter** (body). Bundle as custom fonts; register in `Info.plist`.
- Motion: spring physics on cards, animated Peak Score ring, swell-spectrum
  shimmer. Reduce-motion aware.
- Haptics on key moments (Peak Score reveal, alert fire, session save).

---

## 1. Tech Stack & Architecture

| Concern | Choice | Notes |
|---|---|---|
| UI | SwiftUI + Swift Concurrency (`async/await`) | iOS 17 `Observation` (`@Observable`) for view models |
| Architecture | MVVM + lightweight feature modules | Optionally TCA later; don't over-engineer v1 |
| Maps | **MapKit** (v1) → evaluate **Mapbox** for custom raster/wind overlays | MapKit gets us free, native, offline-cached base; Mapbox if we need vector wind particles |
| Charts | **Swift Charts** (native) | Tide, timeline, swell bars, wind rose (custom `Canvas`) |
| Networking | `URLSession` + a thin `APIClient` actor | Hits NUC API; typed `Codable` models mirroring `apps/api/models/schemas.py` |
| Auth | **Supabase Swift SDK** + **Sign in with Apple** | Magic link + Google OAuth + Apple. Apple sign-in is **required** by App Store if other social logins exist |
| Persistence / offline | **SwiftData** | Cache spots, last forecast, sessions; offline-read of saved spots |
| Payments | **StoreKit 2** (NOT Stripe) | App Store IAP is mandatory for digital subscriptions on iOS. Mirror tiers to Supabase via App Store Server Notifications → a new NUC webhook |
| Push | **APNs** via Supabase Edge Function or NUC | Surf/snow alerts, "it's firing" pushes |
| AI | **Claude API** (user-supplied key, server-side on NUC) | iOS never holds the key; calls go through NUC `/nlq` + new `/briefing` |
| Images/cams | `AsyncImage` + Nuke (caching) | Spot cams, hero imagery |
| Animation | Lottie (sparingly) + native springs | Onboarding, empty states |

### 1.1 Backend connectivity (work alongside the NUC, don't override)

The NUC already runs multiple Docker stacks. **The iOS app adds zero new
server containers** — it consumes the existing FastAPI backend exactly like the
web app does.

- **Prod base URL:** `https://api.koastcast.com` (Cloudflare/Tailscale Funnel →
  nginx `:8443` → FastAPI `:8000`). The app talks to the existing reverse proxy;
  no new ports, no displacing `hive-nginx-1` or other tenants.
- **Auth header:** reuse `NUC_API_SECRET` as the shared proxy secret, plus the
  Supabase JWT for per-user calls — identical contract to the Next.js proxy.
- **New backend work is additive only** (see Epic E): one `/briefing` router and
  one StoreKit webhook router added to `apps/api/routers/`. No schema-breaking
  changes; new columns are nullable/additive.
- **CORS:** add the app's bundle scheme / no-origin native calls are allowed via
  the secret header path; web CORS list is untouched.

### 1.2 Project structure

```
KoastCast/
├── App/                      ← KoastCastApp, AppDelegate (APNs), DI container
├── Core/
│   ├── Networking/           ← APIClient actor, Endpoints, AuthInterceptor
│   ├── Auth/                 ← SupabaseAuth, AppleSignIn, session store
│   ├── Persistence/          ← SwiftData models + store
│   ├── Location/             ← CLLocationManager wrapper, permission flow
│   ├── Push/                 ← APNs registration, deep-link router
│   └── DesignSystem/         ← Colors, Typography, GlassCard, PeakRing, Haptics
├── Features/
│   ├── Onboarding/
│   ├── Home/                 ← "Today" dashboard + AI briefing
│   ├── Explore/              ← Map + layers + search
│   ├── SpotDetail/           ← the deep-dive forecast
│   ├── Snow/  Trails/  Wind/  Weather/
│   ├── Sessions/             ← log, history, analytics
│   ├── AskKoast/             ← NLQ chat
│   ├── Quiver/               ← boards + wetsuits
│   ├── Alerts/
│   ├── Profile/
│   └── Paywall/              ← StoreKit
├── Models/                   ← Codable mirrors of API schemas
└── Resources/                ← Fonts, Lottie, Assets, Localizable
```

---

## 2. Tab Structure (the 5-tab spine)

iOS tab bars top out at 5 before "More" collapses things. KoastCast uses
exactly 5, with secondary sports reached via the **Map layer switcher** and the
Home "sport chips" rather than eating tab slots.

| # | Tab | Icon (SF Symbol) | Purpose |
|---|---|---|---|
| 1 | **Today** | `sun.max` / `sunrise` | Personalized dashboard: AI briefing, home-spot verdicts, alerts, "go now" |
| 2 | **Explore** | `map` | Geospatial map, multi-sport layers, search, discovery |
| 3 | **Forecast** | `chart.line.uptrend.xyaxis` / `water.waves` | Saved spots list → spot detail deep-dive (the meat) |
| 4 | **Sessions** | `figure.surfing` | Log sessions, history, analytics, AI insights |
| 5 | **Ask Koast** | `sparkles` | AI assistant — natural-language queries across all data |

Profile / settings / quiver / subscription live behind the avatar in the
**Today** nav bar (top-right), not a tab.

> **Why "Ask Koast" gets a tab:** it's the headline differentiator vs Surfline
> and the clearest place to surface the AI investment. It doubles as universal
> search ("where's it offshore and 4ft this weekend within 2 hours of me?").

---

## 3. Screen-by-Screen Spec

Each screen lists: **purpose · key components · data source · AI usage · gating**.

### 3.1 Onboarding & Auth

#### S1 — Splash / Auth gate
- **Purpose:** route to onboarding or app.
- **Components:** brand animation (Lottie wave), `Sign in with Apple`,
  "Continue with Google", "Email magic link", "Skip / browse as guest".
- **Data:** Supabase Auth.
- **Notes:** guest mode allowed (free-tier features, no save). Apple sign-in
  mandatory if Google is present.

#### S2 — Onboarding flow (6 steps, mirrors web)
1. **Welcome** — value prop, sport selection chips (Surf / Snow / Trails /
   Wind / Weather) → tailors default tab content.
2. **Location** — `CLLocationManager` "When in Use" request with a custom
   pre-prompt screen (explain *why* before the system dialog).
3. **Skill level** — beginner → pro (feeds Peak Score weighting).
4. **Board / quiver** — quick-add primary board (full quiver later).
5. **Wave preferences** — height/period sliders (feeds personalization).
6. **Preferences & notifications** — units (ft/m, mph/kt), APNs permission,
   alert defaults.
- **AI usage:** none (deterministic), but final screen previews an AI briefing
  using their inputs as a "wow" moment.
- **Writes:** `user_profiles`, `boards` via API; APNs token registration.

---

### 3.2 Tab 1 — Today (Home dashboard)

#### S3 — Today
- **Purpose:** the "should I go?" screen. Opens to a verdict, not a menu.
- **Components (top→bottom):**
  - **AI Morning Briefing card** — 2–3 sentence natural-language summary of the
    day across the user's home spots + sports. Tap to expand to a longer
    briefing. ("Clean 3–4ft at Steamer Lane, offshore til 10am. Snow's stale —
    skip the mountains. Trails dry.")
  - **Home-spot verdict cards** — horizontally scrolling Peak Score rings for
    saved/home spots; color-coded; tap → Spot Detail.
  - **"Go now" strip** — best window in the next 12h across saved spots.
  - **Active alerts** — any fired/upcoming alert conditions.
  - **Sport chips** — quick filter to switch dashboard between Surf / Snow /
    Trails / Wind / Weather context.
  - **Conditions-now tiles** — current buoy/wind/tide at nearest spot.
- **Data:** `/forecast`, `/stoke`, `/optimal`, `/buoys/{id}/live`, `/snow`,
  new `/briefing`.
- **AI usage:** **Briefing endpoint** (new) — Claude summarizes the user's
  multi-spot, multi-sport forecast JSON into prose, personalized to skill +
  preferences. Cached per-user per-6h to control cost.
- **Gating:** briefing = pro/explorer; free users see verdict cards only.

---

### 3.3 Tab 2 — Explore (Map)

#### S4 — Explore map
- **Purpose:** geospatial discovery across all sports.
- **Components:**
  - Full-bleed MapKit map, dark style, user-location puck.
  - **Layer switcher** (segmented / floating control): Surf spots · Ski resorts
    · Trails · Wind field · Weather radar.
  - **Spot pins** colored by current Peak Score (heat-style).
  - **Wind layer** — animated particle/arrow overlay (Mapbox or a `Canvas`
    overlay if MapKit) from forecast wind grid.
  - **Bottom sheet** (`.presentationDetents([.height(120), .medium, .large])`)
    — peek shows nearest/selected spot card; expand shows ranked nearby spots.
  - **Search pill** (top) → S5.
  - "Recenter on me" + "Search this area" buttons.
- **Data:** `/spots` (list + current conditions), `/snow`, trails data, wind
  grid from forecast service.
- **AI usage:** optional "Ask about this area" button feeds map viewport bounds
  to Ask Koast ("best spot in view this weekend").
- **Coding constraints (from CLAUDE.md, port to iOS):** debounce
  drag-deselect; default sheet collapsed; don't auto-open on every pin tap.

#### S5 — Global search
- **Purpose:** find spots/resorts/trails fast.
- **Components:** search field, recent searches, fuzzy results grouped by sport,
  "near me" suggestions.
- **Data:** local SwiftData index of spots/resorts + server fallback.
- **AI usage:** natural-language fallback — if query isn't a name match, route
  to Ask Koast.

---

### 3.4 Tab 3 — Forecast (Spots list → Spot Detail)

#### S6 — Saved spots list
- **Purpose:** the user's followed breaks/resorts, ranked.
- **Components:** sortable list (by Peak Score, distance, name), pull-to-refresh,
  swipe to remove, current mini-verdict per row, "+ add spot" → search.
- **Gating:** free = 3 saved, pro = 20, explorer = 50 (`FEATURE_GATES`).

#### S7 — **Spot Detail** (flagship screen)
The deepest screen — Surfline's whole app condensed into one scroll, plus our
differentiators. Sectioned vertical scroll with a sticky mini-header.

- **Hero:** spot name, region, **animated Peak Score™ ring** (0–10, personalized,
  with component breakdown on tap: height/period/direction/wind/crowd),
  one-line AI verdict, current conditions row.
- **Spot cams** (`AsyncImage` carousel) if available.
- **7/16-day forecast timeline** — Swift Charts; scrub to see hourly; color
  bands for quality. Free = 7d, pro/explorer = 16d.
- **Swell spectrum** — full spectral waterfall (our key differentiator vs
  Surfline's Hs/Tp summary). Custom `Canvas`/`Chart`. **Gated: pro+.**
- **Tide chart** — Swift Charts area chart with now-line, hi/lo markers.
- **Wind rose** — custom `Canvas` polar plot; offshore/onshore shading.
- **Optimal windows** — ranked time slots ("Best: tomorrow 6:40–9:10am").
  **Gated: pro+.**
- **Crowd prediction** — expected crowd by day/time. **Gated: pro+.**
- **Buoy readings** — live NDBC Hs/Tp/dir/wind/water temp; "last updated" + age.
- **Safety / hazards** — rip, rocks, localism, sharks-as-available banners.
- **Gear recommendation** — board + wetsuit suggestion from quiver matched to
  conditions.
- **Ask about this spot** — pre-seeds Ask Koast with spot context.
- **Actions:** save/follow, set alert (→ S14), log session here, share.
- **Data:** `/spots/{slug}`, `/forecast/{id}`, `/forecast/{id}/ensemble`,
  `/buoys/{id}/live` + `/spectrum`, `/optimal/{id}`, `/crowd/{id}`,
  `/stoke`, `/safety/{id}`, `/gear/{id}`.
- **AI usage:** the one-line verdict + the optional contextual chat.
- **Offline:** last-fetched forecast cached in SwiftData for offline read.

#### S8 — Model comparison (ensemble)
- **Purpose:** power-user transparency — show ECMWF vs GFS vs blend.
- **Components:** overlaid line charts per model, spread/confidence band.
- **Data:** `/forecast/{id}/ensemble`. **Gated: pro+.**

---

### 3.5 Secondary sports (reached via Map layer / sport chips)

#### S9 — Snow resort detail
- **Components:** 10-day Open-Meteo forecast, snowfall bars, base/summit temps,
  freezing line, optimal-days highlight, avalanche-center deep link, lifts/terrain
  status if available, "powder alert" toggle.
- **Data:** `/snow/{resort_id}` (Open-Meteo proxy + SNOTEL).
- **AI usage:** "powder verdict" sentence; AI optimal-day pick.

#### S10 — Trails view
- **Components:** trail map, conditions (mud/snow/dry from weather model),
  difficulty, length/elevation, recent-weather impact note.
- **Data:** trails dataset + weather model.
- **AI usage:** "trail conditions" summary from recent precip/temp.

#### S11 — Wind view
- **Components:** animated wind field over map, forecast wind timeline at a
  point, kite/wing/sail suitability readout, gust profile.
- **Data:** forecast wind grid.
- **AI usage:** suitability verdict per discipline.

#### S12 — Weather view
- **Components:** standard hyper-local weather (temp, precip, UV, sunrise/sunset,
  marine layer), tied to selected location; radar overlay.
- **Data:** Open-Meteo atmosphere.

---

### 3.6 Tab 4 — Sessions

#### S13 — Sessions home
- **Purpose:** surf journal + analytics.
- **Components:**
  - **History list** — past sessions with spot, date, rating, conditions chip.
  - **Quick log FAB** → session logger.
  - **Analytics dashboard** — sessions/month, avg rating, favorite spots,
    skill-progress, conditions you score best in (Swift Charts).
  - **AI Insights card** — patterns from session history.
- **Logger sheet:** spot picker (auto-suggest nearest), date/time, auto-fill
  conditions from forecast at that time, quality 1–10, crowd 1–5, board used
  (from quiver), notes (voice-to-text), skill tags.
- **Data:** `/sessions` CRUD, `/insights/{user_id}`.
- **AI usage:** **Session insights** — Claude analyzes session history +
  conditions to surface patterns ("You rate 8+ on SW swell at mid-tide; you
  under-score crowded dawn patrols"). Embeds notes (pgvector) for semantic
  recall. **Gated: pro+** for AI insights; logging is free.

---

### 3.7 Tab 5 — Ask Koast (AI assistant)

#### S14 — Ask Koast chat
- **Purpose:** natural-language interface over all KoastCast data — the headline
  AI feature.
- **Components:**
  - Chat UI (streaming tokens), suggested prompt chips ("Where's it offshore
    this weekend within 2 hrs?", "Is my home break worth it tomorrow dawn?",
    "Best snow this week?").
  - Streaming responses (SSE) with inline **rich cards** — when the model
    references a spot, render a tappable mini Peak-Score card → Spot Detail.
  - Context awareness: knows user location, saved spots, quiver, skill,
    current map viewport.
  - Voice input.
- **Data:** `/nlq` and `/api/nlq/stream` (SSE). On-device Ollama/phi4-mini on
  the NUC today; **Claude API** for higher-quality answers once the key is set
  (server picks model by query complexity / user tier).
- **Gating:** free = 0 queries, pro = 10/day, explorer = 50/day
  (`nlq_queries_per_day`). Show remaining-quota chip.

---

### 3.8 Profile, gear, alerts, paywall

#### S15 — Profile & settings
- Avatar, display name, skill level, subscription tier badge, units, theme,
  notification settings, location settings, sign-out, legal/privacy, manage
  subscription (deep-link to App Store), API portal (explorer; likely web-only).
- **Data:** `/user_profiles`.

#### S16 — Quiver management
- **Boards** list (add/edit: length, width, thickness, volume, type, fin setup,
  ideal wave range, primary toggle) and **Wetsuits** (thickness, temp range,
  booties/gloves/hood).
- **Data:** `boards`, `wetsuits` tables via API.
- **AI usage:** "which board today" recommendation surfaces here and in Spot
  Detail gear section.

#### S17 — Alerts
- **Purpose:** "tell me when it's firing."
- **Components:** per-spot alert rules — min Peak Score, swell direction window,
  wind condition, size range, days/times, lead time. Powder alerts for resorts.
  List of active alerts; toggle; delivery = push.
- **Data:** new `alerts` table + scheduler check (NUC APScheduler already runs
  hourly — add an alert-eval job, additive). APNs delivery.
- **AI usage:** optional "natural language alert" — type "tell me when Ocean
  Beach is clean and overhead" → parsed into rule via Claude.
- **Gating:** alert count by tier.

#### S18 — Paywall / subscription (StoreKit 2)
- **Purpose:** convert free → pro/explorer.
- **Components:** tier comparison (Free / Pro / Explorer) mapped to
  `FEATURE_GATES`, monthly/annual toggle, StoreKit products, restore purchases,
  "best value" badge. Triggered contextually when a free user hits a gate
  (spectral, optimal windows, NLQ, 16-day).
- **Payments:** **StoreKit 2 only** (App Store rule). On purchase →
  transaction verification → App Store Server Notification → new NUC webhook →
  update `user_profiles.subscription_tier`. **Do not use the Stripe flow on
  iOS.** (Stripe stays for web.)
- **Gating logic:** central `Gates` Swift mirror of `lib/gates.ts`.

---

## 4. Cross-cutting concerns

- **Offline:** SwiftData caches saved spots + last forecast + sessions; map base
  tiles cached by MapKit. Graceful "stale since HH:MM" badges.
- **Units:** global ft/m, mph/kt/m·s⁻¹, °F/°C — formatter layer, never hardcode.
- **Accessibility:** Dynamic Type, VoiceOver labels on Peak ring/charts,
  reduce-motion, sufficient contrast on glass cards.
- **Privacy:** location "When in Use"; clear purpose strings; no key on device.
  App Privacy nutrition label (location, identifiers).
- **Error handling:** never silent; typed `APIError`; retry + offline fallback;
  log to console with context (mirror web standard).
- **Deep links / Universal Links:** `koastcast.com/surf/{slug}` opens Spot
  Detail; push payloads deep-link to spot/alert.
- **Widgets (v2):** Home Screen + Lock Screen widget = home-spot Peak Score;
  Live Activity for "session in progress" / "swell arriving."
- **Watch (v3):** glanceable Peak Score + tide complication.

---

## 5. GitHub UI/UX & SDK references

Concrete, real packages to lean on (modern, geospatial, simple):

**UI / design system**
- `pointfreeco/swift-composable-architecture` — optional state mgmt (v2 if scale demands).
- `siteline/swiftui-introspect` — reach into UIKit for fine control.
- `exyte/Chat` — production chat UI scaffold for Ask Koast.
- `airbnb/lottie-ios` — onboarding/empty-state motion.
- `kean/Nuke` — image loading/caching for cams.
- `aheze/Popovers` or native `.popover` — Peak Score breakdown.
- `SwiftUIX/SwiftUIX` — gap-filling components.
- Apple **Swift Charts** (first-party) — all charts; custom `Canvas` for wind rose & spectrum.

**Maps / geospatial**
- Apple **MapKit for SwiftUI** (`Map`, `Annotation`, `MapPolyline`) — v1 base.
- `mapbox/mapbox-maps-ios` — if we need vector wind particles / custom raster swell overlays.
- `maplibre/maplibre-gl-native-distribution` — OSS Mapbox-GL alternative (web already uses MapLibre).

**Backend / platform**
- `supabase/supabase-swift` — auth + Postgres + realtime.
- Apple **StoreKit 2** — subscriptions.
- `firebase/firebase-ios-sdk` (Messaging only) *or* APNs direct — push.

**AI**
- `anthropics/anthropic-sdk-typescript` (used server-side on NUC) — the Swift
  app calls NUC, not Claude directly. Reference Anthropic streaming/tool-use docs
  for the `/briefing` and `/nlq` server implementation.

---

## 6. New / additive backend work (Epic E — no NUC disruption)

All additive to the existing FastAPI app; **no port changes, no new containers,
no breaking schema edits.**

1. `routers/briefing.py` — `GET /api/v1/briefing` → Claude-generated personalized
   daily summary across a user's spots/sports. Cached per-user/6h.
2. `routers/billing.py` — `POST /api/v1/appstore/notifications` → App Store
   Server Notification handler → updates `user_profiles.subscription_tier`.
3. `routers/alerts.py` + `alerts` table (migration `006_alerts.sql`, additive) +
   an APScheduler job (added to existing `scheduler/jobs.py`) that evaluates
   rules hourly and enqueues APNs pushes.
4. `nlq.py` upgrade — route complex/pro queries to Claude API (key from env),
   keep on-device Ollama for free/simple — tier- and complexity-aware.
5. Push: APNs via a Supabase Edge Function or a small NUC sender (reuse existing
   secrets; no new public port — outbound only).

---

## 7. Development Epics & Roadmap

Sequenced for a vertical-slice-first build (ship something real early).

### Epic A — Foundation (Weeks 1–2)
- Xcode project, SwiftUI app shell, 5-tab scaffold, design system
  (colors/typography/GlassCard/PeakRing/Haptics), font bundling.
- `APIClient` actor + Codable models mirroring `schemas.py`.
- Supabase auth + Sign in with Apple + guest mode.
- Location permission flow.
- **Exit:** can sign in and hit `/spots` showing a live list.

### Epic B — Core forecast vertical slice (Weeks 3–5)
- Saved spots list (S6) + **Spot Detail (S7)** with Peak ring, timeline, tide,
  wind rose, buoy readings, AI verdict line.
- SwiftData offline cache.
- **Exit:** a user can follow a spot and read a full forecast offline.

### Epic C — Map & discovery (Weeks 5–7)
- Explore map (S4) with surf pins + bottom sheet, search (S5), recenter/search-area.
- Wind layer overlay (basic).
- **Exit:** discover and open any spot from the map.

### Epic D — Sessions (Weeks 7–8)
- Logger + history + analytics (S13), quiver (S16).
- **Exit:** log a session with auto-filled conditions and board.

### Epic E — AI layer (Weeks 8–10)  *(needs Claude key)*
- Backend additive routers: `/briefing`, NLQ→Claude upgrade.
- Today AI briefing card (S3), Ask Koast chat with streaming + rich cards (S14),
  session insights, gear recommendation.
- **Exit:** morning briefing + working NL spot queries.

### Epic F — Secondary sports (Weeks 10–12)
- Snow (S9), Wind (S11), Weather (S12), Trails (S10) layers + detail screens.
- **Exit:** full multi-sport adventurer experience.

### Epic G — Monetization (Weeks 12–13)
- StoreKit 2 paywall (S18), gate enforcement (`Gates`), App Store webhook,
  tier sync to Supabase.
- **Exit:** purchase upgrades tier end-to-end.

### Epic H — Alerts & notifications (Weeks 13–14)
- Alerts (S17), APNs, alert-eval scheduler job, deep links.
- **Exit:** "it's firing" push lands and opens the spot.

### Epic I — Polish & ship (Weeks 14–16)
- Spectral waterfall, ensemble comparison, crowd prediction, safety, accessibility
  pass, empty/error states, App Privacy label, TestFlight → App Store submission.
- **Exit:** App Store review-ready build.

### Future (post-launch)
- Home/Lock-Screen widgets, Live Activities, Apple Watch app, iPad layout,
  CarPlay (drive-to-spot), Vision Pro spatial swell viz.

---

## 8. Open questions / decisions to confirm

1. **Map SDK:** MapKit (free, native) vs Mapbox (richer wind/swell overlays)?
   Recommend MapKit v1, Mapbox only if wind particles demand it.
2. **AI model routing:** keep on-device phi4-mini for free tier and Claude for
   pro? (Recommended — controls cost, honors the "$100/yr infra" ethos.)
3. **Backend exposure for mobile:** confirm Tailscale Funnel vs Cloudflare Tunnel
   for `api.koastcast.com` public reachability from cellular.
4. **Subscription parity:** App Store pricing must roughly match web Stripe
   pricing; reconcile tiers.
5. **Cams:** do we have a cam source/licensing, or defer cams to v2?
