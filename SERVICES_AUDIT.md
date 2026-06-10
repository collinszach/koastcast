# KoastCast — Services Audit, Accuracy Roadmap & Claim to Fame

> A grounded audit of what's actually implemented (read from source, not docs),
> what to improve, and a defensible niche that makes KoastCast unbeatable in one
> thing — then extends it into "the adventure platform for all people."

**Date:** 2026-06-09 · **Scope:** `apps/api/services`, `apps/api/routers`, `scheduler`

---

## 0. Verdict up front

KoastCast's backend is **already more scientifically honest than Surfline's
public product.** You have:

- A real **multi-model ensemble** (ECMWF/GFS/ICON) with lead-time-varying skill
  weights, **circular math** for directions, and a per-hour **agreement score**
  — `services/ensemble.py`.
- **Physics-based bias correction** (linear-wave shoaling, Snell's-law
  refraction, Miche breaking limit) as a fallback under per-spot **LightGBM**
  models — `services/bias_correction.py`.
- **Data assimilation** — live buoy readings blended into the model for the
  first 6 hours (`services/nowcast.py`), flagged per-hour with `is_nowcast`.
- A **personalized scoring engine** with asymmetric-Gaussian height, log-period
  with groundswell step, raised-cosine direction, speed-aware wind, steepness,
  break-type-aware tide, and crowd tolerance — `services/stoke_score.py`.
- A **forecast-verification job** already running nightly
  (`scheduler/jobs.py::validate_forecast_accuracy`).

**That last point is the whole game.** You are already measuring your own error
against buoys. Surfline does not show users that. **Almost nobody in consumer
weather does.** That is the niche — see §4.

The weakness is not the science. It's that **the accuracy work is invisible to
users, the verification loop doesn't yet feed back into the models, and the ML
coverage is thin (10 of 140 spots).** Fix those three and you have a category
of one.

---

## 1. Service-by-service audit

Legend: 💪 strength · ⚠️ gap/risk · 🔧 improvement

### `ensemble.py` — multi-model blend
- 💪 Lead-time weight schedule, circular means/std for angles, CV-based
  agreement. Genuinely good.
- ⚠️ Skill weights are **hard-coded constants** (`_get_weights`, lines 100–114).
  The docstring claims they're "derived from historical RMSE vs NDBC buoys" but
  nothing in the repo computes them. They're guesses.
- ⚠️ Agreement is computed on `wave_height` only (line 375) — direction and
  period disagreement (which wreck a forecast) aren't surfaced.
- 🔧 **Learn the weights per-spot, per-lead-bin** from the verification log
  (§3.1). This is the single highest-leverage accuracy change.
- 🔧 Add `swell_wave_*_2` support once Open-Meteo exposes it; you already
  carry the fields through.

### `bias_correction.py` — buoy → local face height
- 💪 Real physics fallback; clean ML/physics dispatch; graceful degradation.
- ⚠️ Only **10 spots** have trained models; the other ~130 silently fall back to
  physics with **≤0.45 confidence** capped (line 213). Most of the map is
  running the weak path.
- ⚠️ ML confidence is a heuristic (`1 - deviation*0.5`, line 266), not a real
  predictive interval.
- ⚠️ Hardcoded 15 m / 3 m depths for every spot — ignores actual bathymetry you
  already store in `data/bathymetry/`.
- 🔧 **Quantile LightGBM** (predict p10/p50/p90) → real confidence bands, not a
  fudge factor (§3.2).
- 🔧 **Spot clustering / transfer learning**: group the 140 spots by break type +
  exposure + buoy geometry; a cluster model covers spots with no local history.
- 🔧 Feed per-spot depth from bathymetry into the physics path.

### `nowcast.py` — short-lead assimilation
- 💪 Smart, simple, tested. Linear buoy→model blend over 0–6 h.
- ⚠️ Only blends **wave height and period** (forecast.py lines 148–153). Wind and
  direction — which decide whether it's clean — are not nowcast.
- 🔧 Extend assimilation to wind (from nearest station/METAR) and swell direction.
- 🔧 Blend window should scale with **buoy distance** and swell travel time, not a
  fixed 6 h for all spots.

### `stoke_score.py` — the Peak Score engine
- 💪 The best-designed file in the repo. Component breakdown is UI-ready.
- ⚠️ Production weights live in a **proprietary `scoring/weights.py` that isn't
  in the repo** — if missing, scoring silently falls back to **uniform untuned
  placeholders** (lines 25–39). A fresh deploy without that file ships a
  visibly worse product with only a `warnings.warn`. Operational landmine.
- ⚠️ `SKILL_MULTIPLIERS` placeholder is all `1.0` — skill personalization is a
  no-op without the proprietary file.
- 🔧 **Learn weights from logged sessions** (§3.3): users tell you their quality
  rating + the conditions; that's labeled data to fit the weights per user and
  per spot. This is the flywheel Surfline can't easily copy.
- 🔧 Promote the placeholder fallback from `warn` to a startup health check that
  surfaces in `/health` so a misconfigured deploy is loud, not silent.

### `forecast.py` — assembly
- 💪 Clean orchestration: ensemble/single → nowcast → bias → stoke → crowd → tide.
- ⚠️ Tide stations are **hardcoded for ~10 spots** (lines 277–289); everything
  else falls to 3 regional defaults — a Maine spot gets San Francisco tides via
  the `America/New_York`→Providence fallback. Wrong tide = wrong score.
- ⚠️ No caching: every request recomputes the full pipeline and re-hits
  Open-Meteo/NOAA. Under load or offline-NUC this is fragile.
- 🔧 Generalize tide-station selection: nearest CO-OPS station by lat/lon from
  the full station list (it's a static file you can ship).
- 🔧 Cache assembled forecasts in TimescaleDB `spot_forecasts` (the table
  exists) and serve from there; the scheduler already writes forecasts every 3 h.

### `crowd_model.py`
- ⚠️ Pure heuristic (time-of-day × day-of-week × quality). Not trained on
  anything real. Presented to users as if it's a model.
- 🔧 Train on logged-session `crowd_rating` + quality + weekday once you have
  volume. Until then, label it clearly as "estimated."

### `safety.py`
- 💪 Live NWS rip-current risk + water quality.
- ⚠️ Hazard notes are **hand-authored for ~10 spots** (lines 43–96). 130 spots
  have no hazard data.
- 🔧 Generate baseline hazards from spot metadata (break_type=reef → "shallow
  reef," rivermouth → "current/water-quality after rain") + crowd-source
  confirmations from sessions.

### `llm.py` — NLQ
- 💪 Clean OpenAI-compatible client, good forecast-context formatting, graceful
  offline fallback. On-device phi4-mini = $0 cost.
- ⚠️ phi4-mini is weak for multi-spot reasoning ("best spot within 2 hrs this
  weekend"). Today it answers single-spot questions adequately, not planning
  questions.
- 🔧 **Tier the model**: phi4-mini local for free/simple; **Claude API** for
  pro planning queries and the daily briefing (you're adding a key). Route by
  query complexity. Keep the $100/yr ethos for the common case.

### `snow/snotel.py`, `tides.py`, `open_meteo.py`, `gear_recommender.py`, `swell_tracker.py`, `surf_insights.py`
- 💪 Solid free-data clients; multi-sport foundation is real.
- 🔧 These are the breadth play (§5). They're good enough to extend the Peak
  Score engine across sports rather than treating each as a silo.

### Cross-cutting risks
- ⚠️ **Single NUC = single point of failure.** No edge cache; if the NUC blips,
  the apps go dark. Mitigate with cached-forecast serving + a cheap CDN/edge.
- ⚠️ **ML model artifacts aren't versioned** (empty in this checkout, live only
  on the NUC). No model registry / rollback.
- ⚠️ Verification job runs but (from `jobs.py`) **doesn't close the loop** into
  weights — measured error is recorded, not acted on.

---

## 2. What Surfline does that we don't (and whether we should care)

| Surfline has | Should we match? |
|---|---|
| Live spot **cams** (their real moat) | Not at $100/yr. **Don't compete here** — counter-position (§4). |
| Huge crowd-sourced spot DB + brand | Grow organically; our spot quality > quantity. |
| LOLA proprietary model | We use ECMWF/GFS/ICON ensemble — arguably more transparent. |
| Sessions/cams social | We have sessions; lean into the **data flywheel**, not social. |

The takeaway: **stop trying to be Surfline-with-fewer-cams.** Win a dimension
they structurally *won't* compete on.

---

## 3. "Super accurate models" — the accuracy roadmap

Three flywheels, in priority order.

### 3.1 Close the verification loop → self-tuning ensemble weights  ★ highest leverage
`validate_forecast_accuracy` already logs forecast-vs-buoy error nightly. Today
it's a dead-end log. Turn it into a controller:
- Store per-`(spot, model, lead_bin, variable)` rolling RMSE/bias.
- Replace the hardcoded `_get_weights` with **inverse-error weighting** computed
  from that table (weights ∝ 1/RMSE², per spot, per lead). Re-fit weekly.
- Net effect: the ensemble gets measurably better at *your* spots over time,
  automatically, and you can **prove** it. This is what makes "super accurate"
  a verifiable claim instead of a slogan.

### 3.2 Probabilistic face height (quantile LightGBM)
- Train each bias model to output **p10 / p50 / p90** (LightGBM quantile
  objective). Replace the heuristic `confidence` with a true interval width.
- Powers the UI confidence bands (§6) directly — uncertainty becomes data, not a
  fudge.

### 3.3 Session-as-ground-truth flywheel  ★ unique, uncopyable
Every logged session has: spot, time, **observed face height**, **user quality
rating**, conditions. That is labeled training data Surfline-style — and it's
proprietary to you.
- Use logged sessions to (a) extend bias models to spots with no NDBC history,
  (b) fit per-user Peak Score weights, (c) train the crowd model for real.
- The more people use KoastCast, the more accurate it gets **per spot and per
  person**. A competitor starting today cannot buy this.

### 3.4 Coverage fixes (table stakes)
- Per-spot tide stations (nearest CO-OPS by lat/lon) — kills a real error source.
- Bathymetry-driven depths in the physics path.
- Nowcast wind + direction, distance-scaled blend window.
- Spot-cluster transfer models so all 140 spots run better-than-physics.

---

## 4. The Niche — our Claim to Fame

> ## **"KoastCast is the forecast that tells you how much to trust it."**
> ### Confidence-native, self-verifying outdoor forecasting.

Every other surf/outdoor app gives you a number and hides the error bars.
KoastCast makes **uncertainty a first-class feature**:

1. **The Trust Score™** — a 0–100 badge next to every forecast answering the
   one question every other app dodges: *how sure are you?* Computed from model
   agreement (`ensemble.py`), prediction-interval width (§3.2), data freshness
   (`is_nowcast`, buoy age), and the spot's historical skill score (§3.1).
2. **We publish our accuracy.** A per-spot, public **"Forecast Report Card"**:
   "Mavericks 72-hr wave-height MAE: 0.3 m. We were within 1 ft 84% of the time
   last 90 days." Backed by the verification job. **No consumer surf forecaster
   does this.** It's radical honesty as a moat.
3. **We show our work.** Tap any Peak Score → the physics (shoaling/refraction),
   which models agree, and why. Surfline is a black box; KoastCast is glass.

**Why this is defensible:**
- It's built on infrastructure you already have (ensemble agreement, confidence,
  nightly verification). You're 70% there in the backend, 0% in the UI.
- It **compounds**: more sessions → tighter intervals → higher Trust → more
  users → more sessions. §3.3 is the moat.
- Surfline **structurally won't follow** — publishing your error rate is
  terrifying for an incumbent with a black-box premium model. Their business
  depends on *not* doing this.
- It's honest. The brand becomes "the one that doesn't lie to you about the
  weekend." That's word-of-mouth gold in a community burned by blown forecasts.

**Tagline candidates:** *"Forecasts with receipts."* · *"Know before you go —
and know how sure."* · *"The honest forecast."*

---

## 5. "The adventure platform for all people" — the breadth play

The Trust-Score niche is the *depth*. Breadth comes from running **one
personalized quality engine across every sport**, geospatially unified.

You already have the services: surf (`stoke_score`), snow (`snotel`,
Open-Meteo), wind, weather, trails. Generalize the Peak Score into a
**universal "Conditions Score"** with sport-specific scoring modules but one
personalization layer (skill, preferences, gear, risk tolerance):

| Sport | Score driver | Status |
|---|---|---|
| Surf | swell/wind/tide/period | ✅ built |
| Snow / ski | snowfall, base, temp, wind-loading, avalanche | ✅ data, score TODO |
| Wind (kite/wing/foil) | wind speed/steadiness/direction | 🔧 layer exists |
| Hike / trail | precip history, mud, snow line, heat/UV | 🔧 trails data |
| **Add:** SUP/flatwater, freedive/spearfish (viz/swell), fishing (tide/baro), trail-run, climb (precip/temp/dry-time) | reuse the same engine | 📋 |

**"For all people"** = one app where a surfer, a skier, and a hiker each open to
*their* personalized, Trust-Scored conditions on **one geospatial home** — a map
colored by **your** score across whatever you do. That's the platform Surfline
(surf-only) and the weather apps (no personalization, no trust) can't be.

The unifying promise: **"One score, every adventure, and we'll tell you how much
to trust it."**

---

## 6. The unique UI — uncertainty made visible

The UI must *be* the niche. Most apps draw a confident line into a future they
can't see. KoastCast draws **the fog.**

**Signature concept — "The Horizon timeline":**
- The forecast ribbon renders the near term sharp and high-contrast; as Trust
  drops with lead time, the timeline literally **gets hazier / softer / wider**.
  You can *see* the model losing confidence. Uncertainty is the aesthetic.
- Every chart shows a **confidence band (p10–p90)**, not a single line. The band
  narrows when models agree, fans out when they don't (data from §3.2).

**Signature components:**
- **Trust Ring** — a second ring around the Peak Score showing confidence;
  green-solid when sure, dashed/faded when not. Glanceable "should I trust this?"
- **"Why" sheet** — tap any score → physics + model-agreement bars + data age.
  Progressive disclosure: one answer up top, full glass-box underneath.
- **Report Card screen** — per-spot accuracy history. A flex no competitor has.
- **Unified Conditions Map** — single dark geospatial home; pins/heat colored by
  *your* personalized score; a sport switcher swaps the scoring layer, not the
  map. Wind as animated particles, swell as directional arrows.
- **Agreement weather** — when models disagree badly, the spot card shows a
  subtle "forecasters split" state instead of a falsely-precise number.

Visual language stays the existing ocean theme (`#060D1A`, cyan, glass, Syne +
JetBrains Mono) but adds an **uncertainty design system**: haze, band fills,
dashed confidence strokes, and the Trust palette. Motion respects reduce-motion.

This is a genuinely novel forecast UI. It's not a Surfline reskin — it's the
visual argument for *why KoastCast is more honest.*

---

## 7. Prioritized roadmap

**Epic 1 — Make accuracy visible (the niche, mostly backend-light)**
- Surface existing `model_agreement` + `confidence` + buoy age as a **Trust
  Score** in the API response and UI. Ship the Trust Ring.
- Build the **Report Card** endpoint from the verification log.
- *Exit: every forecast shows a Trust Score and a public accuracy page.*

**Epic 2 — Close the verification loop (super accurate, for real)**
- Persist per-(spot, model, lead) error; replace hardcoded ensemble weights with
  learned inverse-error weights; weekly re-fit.
- *Exit: ensemble weights are data-driven and improving measurably.*

**Epic 3 — Probabilistic models + the flywheel**
- Quantile LightGBM → real confidence bands. Begin training bias/crowd/weight
  models on logged sessions.
- *Exit: confidence bands are model-derived; sessions feed model training.*

**Epic 4 — Coverage fixes (table stakes)**
- Per-spot tide stations, bathymetry depths, nowcast wind/direction, spot-cluster
  transfer models for the ~130 model-less spots.
- *Exit: all 140 spots run better-than-physics with correct tides.*

**Epic 5 — Breadth: universal Conditions Score**
- Generalize the scoring engine; ship snow/wind/trail scores + the unified map.
- *Exit: one personalized, Trust-Scored experience across ≥4 sports.*

**Epic 6 — AI layer**
- Tier the LLM (phi4-mini local + Claude for planning/briefings); AI daily
  briefing that *speaks the Trust Score* ("clean at Steamer, and we're 80% sure").
- *Exit: AI that explains conditions AND their confidence.*

**Hardening (parallel):** promote the silent `weights.py` fallback to a loud
health check; add forecast caching + edge resilience; version ML artifacts.

---

## 8. The one-sentence pitch

> **KoastCast is the only outdoor forecast that's personalized to you, spans
> every adventure, and tells you exactly how much to trust it — and publishes
> its accuracy to prove it.**
