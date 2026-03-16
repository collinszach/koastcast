# Surfer Research: What Surfers Actually Want From a Forecast App
## (That Surfline Does NOT Deliver)

Research conducted March 2026. Sources: Trustpilot, App Store reviews, surf forum threads (Swellinfo, surfing-waves.com, Jamboards, YBW Forum), surf media (Surfer, The Inertia, BeachGrit, Wavelength), and surf camp educational resources.

---

## PART 1: THE SURFLINE FAILURE MODES (Documented Complaints)

### 1.1 The Paywall Problem Is the #1 Complaint

Surfline has systematically moved features behind its $99/year paywall over the past three years, and surfers are furious about it. Specific documented issues:

- **Free users limited to 5 surf checks per week.** This is unworkable for anyone who scouts multiple spots or checks conditions multiple times a day. One reviewer noted: "seeing good conditions on the horizon is enough to completely turn their day around" — but you can't do that on 5 checks a week.
- **Free forecast window reduced to yesterday's conditions.** Full 7-day forecasts now require a subscription.
- **Password sharing crackdown.** Multiple reviewers stated "password sharing was the only way to justify their service."
- **Ads for premium subscribers.** Paying $99/year and still being shown ads and upgrade prompts. One G2 review: "premium subscribers still see ads, and receive messages to go Premium even when already signed in."
- **Aggressive pre-roll ads on webcam footage.** "Webcams stop ad countdowns if you scroll away, forcing viewers to watch 15-second premium ads before seeing brief 20-second video clips."
- **Monopoly via acquisition.** Surfline acquired Magic Seaweed in 2017, then killed it in 2023. The MSW community specifically praised MSW for being free and more accurate for non-US spots. Closing MSW was widely seen as eliminating the best free alternative to Surfline.

**SwellStack opportunity:** A genuinely free tier with 7-day forecasts and no artificial check limits would immediately differentiate.

---

### 1.2 Forecast Accuracy: The Core Trust Problem

Inaccurate forecasts are the second-most cited complaint, and they erode trust in the entire product:

- "Wave reports are grossly exaggerated — ankle-deep ripples while Surfline claimed 3-5 feet."
- "Horribly inaccurate for certain regions — learned to double the predicted range, with predictions of 3-5ft when actual conditions were 6-10ft."
- "Forecasts are nearly useless — wasting sick days on the promise of head-high waves with good conditions, only to find knee-high conditions."
- Surfline itself acknowledges: "model forecasts often have a difficult time resolving windswell events that happen within the Southern California bight."
- Even their own support docs say: "there's no substitute for local knowledge" — admitting the system can't handle hyper-local variation.

**Root cause:** Surfline's models generate forecasts from offshore buoy data and regional numerical weather models. They cannot account for local bathymetry, sandbar position, headland shadowing, or refraction at individual breaks. This is especially bad for beach breaks where sandbars shift seasonally.

**SwellStack opportunity:** ML bias correction per spot trained on NDBC historical data + user session feedback = measurably more accurate local predictions over time. BUIO App already does a version of this ("personalized forecasts become more accurate as users log more sessions"). We can go further with spectral analysis.

---

### 1.3 The Hyper-Local Gap

Surfline operates at the "surf spot" level, but surfers operate at the "peak within a spot" level:

- A beach break like Ocean Beach SF may have 5 different peaks working on any given day, each responding differently to the same swell/wind/tide combination.
- Sandbars shift. What worked last month may be washed out now.
- Surfline explicitly disclaims: "Always consider your local knowledge of tides, banks, sandbars, and seasonal factors."
- One forum post: "The surf report is generic, late and inaccurate."

**What surfers need but can't get from Surfline:**
- Which peak within a spot is currently working
- Current sandbar conditions (updated via community reports)
- Seasonal pattern overlays ("this break works best in winter NW swells, tends to close out in S swells")
- How a specific spot responds to specific conditions (the "break bible")

---

### 1.4 The Camera Controversy: Surfline Is Overcrowding the Spots It Shows

This is a deep cultural wound:

- Surfers have blamed Surfline live surf cams for overcrowding previously uncrowded breaks.
- **The Windansea Camera Incident (April 2025):** Surfline installed a 24-hour HD camera at Windansea, San Diego. Community petition to remove it cited: "draws large crowds of inexperienced surfers to an already impacted lineup, creating hazards." Residents also cited "gross community privacy violation."
- **Rincon Camera Petition:** A Change.org petition asked Surfline to remove the Rincon camera specifically because of crowd impacts.
- **Australia:** Similar backlash when cameras appeared at lesser-known breaks like Winkipop.
- BeachGrit documented "ruthless censorship of any opposition to unseemly voyeurism" by camera operators.

**Cultural insight:** The surfing community has a deep value around "earning" local knowledge through time spent in the water. Apps that shortcut this process are resented. The ideal product should feel like it's giving you the knowledge a local would share with a trusted friend — not broadcasting conditions to the masses.

---

### 1.5 UI/UX and Data Complexity Problems

- "Data is complicated to understand, comes with a significant learning curve, and there is no help for new users."
- "The site is packed with ads and locks up, taking a long time to load."
- "A terrifying jumble of arrows and numbers."
- Beginners and intermediate surfers especially struggle with raw numerical data (Hs, Tp, MWD, DPD) and have no context for what it means at their specific break.

---

## PART 2: WHAT SURFERS ACTUALLY WANT (Category by Category)

### 2.1 Session Planning: The Real Pre-Paddle Checklist

Research from surf coaching sites, safety guides, and forecasting tutorials reveals that what surfers actually evaluate before paddling out is much richer than what any app currently surfaces:

**The mental checklist experienced surfers run:**
1. **Swell height AND period together** — a 3ft @ 18s swell and a 3ft @ 7s swell are completely different experiences. Apps show both, but rarely explain the compound effect.
2. **Swell direction vs. spot orientation** — does this swell "light up" this particular break or does it wrap poorly? This requires per-spot knowledge that no app currently encodes well.
3. **Wind: direction AND speed AND trend** — offshore is king, but how far offshore is the wind source? Is it going to go onshore by noon? Apps show current wind but rarely show the daily trend overlaid on the session window.
4. **Tide: state AND rate of change** — some breaks work best on a pushing tide (incoming), others on a draining low. The rate of change matters as much as the level. A fast-dropping tide can create dangerous conditions even at a technically favorable height.
5. **Crowd expectations** — experienced surfers already know that a Surfline "good" forecast on a Saturday morning means one thing: chaos. They want to know crowd levels, not just wave quality.
6. **Water temperature** — drives wetsuit selection, which is a real logistical decision.
7. **Hazards** — rip currents, rocks exposed at low tide, jellyfish, shark activity (region-dependent).
8. **Access and logistics** — parking, walk distance, time of sunrise/sunset (especially for dawn patrol).

**Key insight from surf coaching community:** "Observe ocean conditions for at least 15 minutes prior to paddling out" — surfers want the forecast to help them decide whether to make that drive in the first place, not just look at it at the beach.

---

### 2.2 The "Just Tell Me When to Go" Problem

This is possibly the single biggest unmet need: **time-poor surfers who need a decisive recommendation, not a data dump.**

- Modern adult surfers have jobs, families, limited windows. They need the app to say: "Your best window this week is Thursday 6–9am. Here's why."
- Current apps force users to mentally synthesize swell direction + wind direction + tide height + period + their spot's known preferences. This is a 10-step calculation that takes experience.
- The da Surf Engine offers a 7-day overview of all favorite spots on one page — described as "a game-changer for professionals with packed schedules."
- BreakFinder sends email digests when upcoming conditions match your preferences within the next 48 hours.
- SurfSignal "automatically notifies you when conditions are perfect for you."

**What's still missing:** A ranked list of "best 3-hour windows for you this week across all your saved spots" with plain-English explanation of why each window is good — and honest acknowledgment of uncertainty (e.g., "this is a 3-day forecast so confidence is moderate").

---

### 2.3 Plain English + Natural Language: The "Explain It To Me" Gap

Surfers are not oceanographers. The raw numbers are alienating, especially for intermediates:

- "Most surfers glance at the star rating and grab their board, but surf conditions are way more nuanced than star, number or colour ratings."
- "The best surfers tell you that simply glancing the ratings for a particular day or relying solely on swell height is not enough to make an informed decision."
- "At first glance the forecast page can look like a terrifying jumble of arrows and numbers."

**What surfers want:** An explanation like "This swell is coming from 280° which is slightly south of optimal for your spot at Steamer Lane. Combined with the predicted NW wind going offshore by 7am, the first two hours after dawn should be clean. The 14-second period means the sets will be well-organized but the 6-foot face height may be challenging — check the tide chart since this break closes out on a dropping tide above 3ft."

Multiple GPT-based surf report tools have emerged precisely because of this gap:
- SurfReportGPT: "pure shredder speak" AI summaries
- SecretSwell: AI-powered natural language forecasts
- Medium post on creating "a surf report buddy using AI"

Surfline has begun adding AI summaries in their Premium Plus tier — but at $99/year, most surfers can't access it.

---

### 2.4 Travel Surfing: The Blank Slate Problem

Traveling surfers — one of the highest-value user segments — face a completely different set of needs:

**What they need that no app provides well:**
- **Break personality description.** Not just "reef break" but: "This spot rewards experienced surfers comfortable on shallow reef. Best on incoming tide, closes out above 6ft. Locals take the peak; visitors typically paddle to the shoulder."
- **Optimal swell direction + season combination.** "This spot fires on N/NW swells in winter. The S-facing aspect means summer swells miss it almost entirely."
- **Localism warnings.** Some breaks have aggressive locals. No app will say this because it's legally and commercially risky, but it's critical safety information for traveling surfers.
- **Hazard specifics.** Reef shallowness at low tide, rip current channels, rocks at the channel, sea urchins in the lineup. These are documented nowhere in forecast apps.
- **Nearby alternatives.** "If this spot is blown out, what's the closest backup that works in these conditions?"
- **Best time of day at this specific spot.** Some spots are morning-only due to thermal winds. Some get glassy at sunset. Apps don't encode this.
- **Water quality.** Especially post-rain. Surfrider Foundation's 2024 Clean Water Report highlights ongoing bacterial contamination at many popular breaks. Surfers who get sick after surfing after rain events are a real problem — yet no surf forecast app integrates water quality data.

**Documented source:** Wavecation maps thousands of breaks globally and includes local insider tips, accommodation near breaks, hazard information, and reef cut warnings. This is closer to what travelers want, but still lacks forecast integration.

---

### 2.5 Gear Selection: Board and Wetsuit Recommendations

This is an underserved but high-intent use case:

**Wetsuit:** Surf Captain already recommends wetsuit thickness based on ocean temperature. This is a solved problem, but most apps don't include it. The decision tree is: water temp → wetsuit thickness → boots/gloves/hood. This is a real decision surfers make every session.

**Board selection:** BoardLine app lets surfers log how boards perform in different conditions. The insight: experienced surfers know their 6'2" shortboard doesn't work in 2ft slop and their fish doesn't work in overhead hollow reef. They want the app to cross-reference forecast conditions with their quiver and say "today is a fish/longboard day."

**What's currently missing:**
- Integration of user's quiver into the forecast view
- "Conditions favor a high-volume board today" type nudge
- "The 12-second period and 4ft faces at your break usually produce 2-turn waves — good day for your step-up"

---

### 2.6 Safety: The Life-or-Death Informational Gap

Safety information is scattered across multiple apps and agencies, and no single surf app unifies it:

**Rip currents:** The NWS provides Surf Zone Forecasts with rip current risk levels, but this data is not integrated into Surfline or most surf apps.

**Shark activity:**
- SharkSafe app: combines shark activity data with beach safety features and weather forecast; customizable alerts by time, region, alert type, or beach.
- BiteMetrix (Australia): maps areas with increased shark-human interaction risk using oceanographic factors like upwelling events.
- Currently zero integration between shark data and mainstream surf forecast apps.

**Jellyfish:** Some beach condition apps include jellyfish alerts. No mainstream surf app does.

**Water quality:**
- California's Safe to Swim maps, LA County DPH, SD Beach Info all maintain real-time water quality data.
- Surfrider Foundation publishes annual Clean Water Reports.
- After heavy rain events, bacterial counts spike at many popular breaks (particularly those near river mouths or storm drains).
- No surf forecast app surfaces this data alongside wave forecasts.

**High surf warnings:** NWS issues these, but surfers have to know to check a separate government site.

**SwellStack opportunity:** A unified safety layer — rip current risk level (from NWS Surf Zone data), post-rain water quality warning, regional shark activity flag, high surf advisory — presented as a simple color-coded bar on each spot card would be genuinely novel and high-value.

---

### 2.7 Progression Tracking: Logging Sessions That Actually Teach You Something

Session logging exists (Surfline Sessions, Dawn Patrol, Surf Log, BreakFinder, Flowstate, Lazy Surfer, SwellChaser) but most are disconnected from forecast data:

**What exists:**
- Apple Watch auto-detection of wave rides (Surfline Sessions, Dawn Patrol)
- GPS tracking: waves ridden, top speed, longest ride, paddle distance
- Manual session journals with condition fields

**What's missing:**
- **Forecast-to-actual comparison.** The app said 4ft @ 12s, you logged it as "3ft @ 10s, messy, wind-affected by 8am." Over time, this builds a picture of how accurate the forecast is for this spot.
- **Pattern recognition.** "Your last 10 sessions rated 8+/10 all had these three things in common: NW swell above 8 seconds, offshore wind, incoming tide above 2ft."
- **Board performance by conditions.** "You've caught twice as many waves per session on your fish when height is under 3ft."
- **Skill-appropriate recommendations.** A beginner doesn't want the same "quality" forecast as a pro. BUIO App does a version of this but its model is opaque.
- **Wave count vs. conditions correlation.** Did you catch more waves when it was less crowded? Less windy? Different tide?

**The BUIO model:** BUIO App is the closest competitor to what SwellStack wants to build. It learns user preferences from logged sessions and generates truly personalized forecasts. Key differentiator: "personalized forecasts become more accurate as users log more sessions." Currently free, available on iOS/Android.

**The Lazy Surfer model:** Uses a "Similarity Score" — when the score is close to 10, current conditions are similar to your best sessions. This is a simpler, more communicable version of the same idea.

---

### 2.8 Notifications: The Alert That Gets You Out of Bed

**What exists:** Surf Captain, BreakFinder, SurfSignal, and Swell Magnet all offer custom alerts based on threshold conditions (wave height, wind direction, tide).

**What's missing:**
- **Compound condition alerts.** Not just "waves above 4ft" but "waves above 4ft AND offshore wind AND incoming tide AND your spot's optimal swell direction." Single-parameter alerts generate too many false positives.
- **Personalized scoring threshold alerts.** "Your Stoke Score for Steamer Lane crossed 75 — conditions are in your personal sweet spot."
- **"Go now" vs. "window opening in 4 hours" distinction.** Time-critical vs. plan-ahead alerts.
- **Forecast confidence flag.** "High confidence alert: 3-day model agreement is strong" vs. "Speculative alert: 7-day forecast, high uncertainty."
- **Crowd-adjusted alerts.** "Conditions are firing BUT it's going to be 3x normal crowd levels due to it being a holiday weekend."
- **Post-session reflection prompt.** After conditions expire, the app nudges: "Were conditions what we predicted? Rate your session."

---

### 2.9 Offline Use: What Surfers Need When There's No Signal

Surfline does have offline mode — but it requires pre-loading before you lose signal. Many surfers don't remember to do this.

**What matters offline at the beach:**
- Tide chart (current height, direction, rate of change for next 6 hours)
- Wind direction and forecast (is it going to stay offshore?)
- Downloaded swell forecast
- Saved spot hazard notes
- Emergency contacts / local lifeguard number

**What surfers actually want:** Automatic background sync of all saved spots whenever on WiFi, so the app is always ready for offline use without any user action.

---

### 2.10 Community: What Social Features Surfers Would Actually Use

The surfing community has tried social apps multiple times (Surfersconnect, Wavve, Surfr) with limited success. The core tension: surfers want community but not the exposure of secret spots.

**Features with actual demand:**
- **Crowd reports at saved spots.** Real-time "how crowded is it right now" from people currently in the water. Simple 1-5 crowd tap on check-in.
- **Condition confirmation.** "2 people checked in at your spot — both rated conditions 8/10" is more useful than any forecast.
- **Local knowledge contributions.** Community-sourced notes about how a break responds to conditions ("this spot needs at least 12s to not be choppy"), with notes attributed to experience level of contributor.
- **Trusted friends network.** See when friends are surfing or what they rated conditions — small trusted circle, not public broadcast.

**Features surfers DON'T want:**
- Instagram-style broadcasting of session locations (exposes secret spots)
- Leaderboards and gamification (performative, not useful)
- Public check-ins visible to all users (brings crowds)

**The secret spot tension:** BreakFinder explicitly advertises "private surf spots — protect your secret spots with private forecasts visible only to you." This is a real concern: the Windansea and Rincon camera controversies show that surfers actively resist visibility tools that bring crowds. SwellStack should design community features with privacy-first defaults.

---

## PART 3: THE DAILY HABIT LOOP — WHY SURFERS OPEN AN APP EVERY DAY

Research finding: dedicated surfers check forecast apps 10-20 times per day, even when not planning to surf. This is not just functional — it's part of surf culture identity.

**Why they open the app:**
1. **Morning first look** (5-6am): Is it worth getting up? Dawn patrol decision.
2. **Commute check**: Planning ahead for the week. Looking for that window.
3. **Lunch check**: Has the wind shifted? Is it worth leaving work early?
4. **After work**: Did conditions improve? Can I squeeze in a sunset session?
5. **Before bed / evening**: Checking tomorrow's dawn patrol odds.
6. **"Swell watching"**: A significant swell is building. Obsessive checking of each model update as it refines.
7. **Post-session**: Logging the session, checking if conditions matched forecast.
8. **Vicarious enjoyment**: Looking at cam footage of distant breaks, dreaming about travel.

**What keeps them coming back even on flat days:**
- Upcoming swell alerts ("10 days out, there's a potential XXL event forming")
- Tide charts (useful for fishing, beach walks, not just surfing)
- Community activity (who's out, what are they saying)
- Travel planning (checking conditions at future destination)

**The competitive intelligence:** The most sticky forecast products generate daily habits around **swell anticipation**, not just same-day planning. A surfer who's watching a North Pacific storm generate a potential 15ft swell event 10 days out will check the app multiple times per day for a week. This is a huge engagement driver that Surfline monetizes through Premium and that SwellStack should design around.

---

## PART 4: FEATURE OPPORTUNITIES RANKED BY IMPACT

### Tier 1: Competitive Necessity (Must Have at Launch)

| Feature | Why | Surfline Gap |
|---|---|---|
| Truly free 7-day forecast | #1 complaint about Surfline | 5 checks/week free limit |
| Per-spot accuracy that's actually right | Core trust | Generic models, admits local knowledge gap |
| Plain-English condition summary | Accessibility | Numbers-heavy, no explanation |
| Compound condition alerts | Smart notifications | Single-parameter thresholds only |
| Mobile-first, fast, no bloat | UX | Site "packs with ads and locks up" |
| Tide + wind + swell interaction explained | Education | Raw numbers only |

### Tier 2: Strong Differentiators (Build in Phase 2)

| Feature | Why | Surfline Gap |
|---|---|---|
| Personalized Stoke Score | ML-driven personal relevance | Generic star ratings |
| Natural language queries ("will it be good Saturday at Mavericks?") | On-device LLM | Non-existent |
| Session logging tied to forecast data | Feedback loop, accuracy improvement | Disconnected or requires $95/year Apple Watch |
| Forecast-to-actual comparison over time | Trust building, ML improvement | Not done |
| Gear recommendations (board, wetsuit) | High-intent, practical | Wetsuit only in Surf Captain; boards nowhere |
| Water quality integration | Safety, differentiator | Completely missing from all surf apps |
| Rip current risk from NWS data | Safety layer | Missing from surf apps |

### Tier 3: Community Moats (Phase 3+)

| Feature | Why | Surfline Gap |
|---|---|---|
| Crowd reports from check-ins | Local intel | Camera-based, not community-sourced |
| Condition confirmation tap | Social proof | Not in any major app |
| "Break Bible" per spot | Local knowledge repository | "No substitute for local knowledge" disclaimer |
| Privacy-first community (trusted circle) | Secret spot tension | No privacy controls |
| Optimal window calendar (work/family schedule integration) | Time-poor surfers | Not built |
| Shark/jellyfish/advisory unified safety layer | Safety | Requires separate apps |

---

## PART 5: VERBATIM COMMUNITY VOICE

The following quotes represent the authentic voice of the surfer community and should inform product messaging and feature prioritization:

**On Surfline's accuracy:**
> "Horribly inaccurate for our region — I've learned to just double whatever range they say."

> "I wasted a sick day on the promise of head-high waves with good conditions, only to find knee-high conditions."

> "Ankle-deep ripples while Surfline claimed 3-5 feet observed."

**On paywalls:**
> "Password sharing was the only way to justify having their service."

> "A bottomless pit for money and subscriptions with virtually zero support despite a faulty app."

> "All the best spots are behind a paywall."

**On the overcrowding problem:**
> "Surfline is ruining surfing by exposing every break to the masses."

> "The camera draws large crowds of inexperienced surfers to an already impacted lineup and creates hazards."

**On what surfers really want from a forecast:**
> "Simply glancing the ratings for a particular day or relying solely on swell height is not enough to make an informed decision."

> "At first glance the forecast page can look like a terrifying jumble of arrows and numbers."

> "Checking the forecast at least 10-20 times per day, even when not planning on surfing."

> "I prefer simpler interfaces with a go/no-go decision based on a few key parameters."

**On Magic Seaweed's death:**
> "MSW was free and more accurate for my favorite spots."

> "Unhappy that Surfline acquired MSW — MSW was useful for all sorts of people, Surfline is very niche."

---

## PART 6: KEY DESIGN PRINCIPLES DERIVED FROM RESEARCH

1. **Decision over data.** Surfers want to know "should I go" not "here are 47 parameters." Lead with the answer, offer the data as supporting detail.

2. **Earn trust through accuracy.** Every inaccurate forecast is an exit event. The ML bias correction approach is not just a differentiator — it's table stakes for building a product surfers will trust.

3. **Privacy is a cultural value.** The surf community resents tools that expose breaks. Design community features with privacy as a default, not an afterthought. Give users control over what they share and with whom.

4. **The daily habit is about anticipation, not just planning.** The most engaging forecast interaction is watching a swell build from 10 days out. Design the experience around the arc of swell anticipation, not just same-day conditions.

5. **Respect the knowledge hierarchy.** Experienced surfers have local knowledge built over years. The app should feel like it's augmenting that knowledge, not replacing it or broadcasting it. The ideal metaphor is "a knowledgeable friend who surfs the same spots you do," not "a mass-market conditions bulletin."

6. **Explain the compound effect.** The single biggest educational gap: surfers know the individual parameters but don't know how they interact at their specific break. A good forecast app teaches through explanation, not just numbers.

7. **Free has to be genuinely useful.** The Surfline free-tier failure is a cautionary tale. SwellStack's free tier must be the product that converts surfers into believers. The premium features should be about depth and personalization, not access to basic information.

8. **Safety is a feature, not a legal disclaimer.** Water quality, rip current risk, jellyfish, shark activity — these are practical needs that no mainstream surf app addresses. Being the "safe" app is a real differentiator, especially for surfers with families.

---

## SOURCES

- [Surfline Trustpilot Reviews](https://www.trustpilot.com/review/surfline.com)
- [Surfline App Store Reviews - JustUseApp](https://justuseapp.com/en/app/393782096/surfline/reviews)
- [Surfline G2 Reviews](https://www.g2.com/products/surfline-media/reviews)
- [SwellInfo Forum: "Surfline Is Crap"](https://www.swellinfo.com/forum/threads/surfline-is-crap.12469/)
- [Surfing-waves.com Forum: "How Accurate Is Surfline"](https://surfing-waves.com/forum/viewtopic.php?f=6&t=14679)
- [Jamboards Forum: "Magic Seaweed Is Going Away"](https://jamboards.com/threads/magic-seaweed-is-going-away.15601/)
- [Jamboards Forum: "Best Forecast Site Nowadays"](https://jamboards.com/threads/best-forecast-site-nowadays.20348/)
- [YBW Forum: "Magic Seaweed Is No More"](https://forums.ybw.com/threads/magic-seaweed-is-no-more-what-alternatives-are-there.598169/)
- [The Surf Tribe: Star Rating Isn't Enough](https://www.thesurftribe.com/surf-blog/how-to-read-a-surf-forecast-and-why-the-star-rating-isnt-enough)
- [Surfer Magazine: How To Read A Surf Forecast](https://www.surfer.com/how-to/how-to-read-a-surf-forecast)
- [BeachGrit: Surfline Camera Controversy](https://beachgrit.com/2022/06/australias-answer-to-surfline-erects-intrusive-cameras-over-hush-hush-waves-ruthlessly-censors-any-opposition-to-unseemly-voyeurism/)
- [Change.org: Windansea Camera Petition](https://www.change.org/p/petition-to-oppose-the-new-windansea-cam)
- [Change.org: Rincon Camera Petition](https://www.change.org/p/surfline-we-surfers-both-local-and-worldwide-request-that-surfline-remove-the-rincon-camera)
- [The Inertia: Secret Spots Ethics](https://www.theinertia.com/surf/navigating-the-ethics-of-secret-spots/)
- [BUIO App](https://buioapp.com/)
- [BreakFinder: Private Forecasts](https://breakfinder.surf/en/blog/private-surf-spots-forecasts)
- [BreakFinder: Custom Forecast Alerts](https://breakfinder.surf/en/blog/personalized-surf-forecast-scores)
- [SurfSignal](https://surf-signal.com/)
- [Lazy Surfer App](https://www.lazysurfer.app/)
- [Surfline Sessions Review - Gear Patrol](https://www.gearpatrol.com/outdoors/a616678/surfline-sessions-review/)
- [Dawn Patrol App](https://www.dawnpatrol.cloud/)
- [Surf Log App](https://www.swellsolutions.app/surflog)
- [Wavelength: Tracking Your Surf Sessions](https://wavelengthmag.com/tracking-your-surf-sessions-just-got-easier/)
- [Surfer Anecdotes: High Surf Warnings](https://www.surferanecdotes.com/high-surf-warnings/)
- [Windy.app: Surfing Dangers](https://windy.app/blog/surfing-dangers-safety-rules.html)
- [Surfrider Foundation 2024 Clean Water Report](https://www.surfrider.org/media/press-releases/surfrider-foundations-2024-clean-water-report)
- [Gather and Glide: Things You Need To Know Before Paddling Out](https://www.gatherandglide.com/post/things-you-need-to-know-before-paddling-out)
- [Bodhi Surf + Yoga: Generating A Surf Report](https://www.bodhisurfyoga.com/generating-a-surf-report-4-things-to-know-before-paddling-out)
- [Surf Captain FAQs](https://surfcaptain.com/faq)
- [Medium: Machine Learning for Surf Forecasting (Surfline Labs)](https://medium.com/surfline-labs/machine-learning-for-surf-forecasting-4a007f13b3e3)
- [Medium: Creating A Surf Report Buddy Using AI](https://medium.com/@felipecembranelli/creating-a-surf-report-buddy-using-ai-d99d0527e5f1)
- [Surfer: Surfline Embraces AI](https://www.surfer.com/news/surfline-artificial-intelligence-premium-plus)
- [Surfline: Accuracy of Ocean Beach Surf Reports](https://www.surfline.com/surf-science/accuracy-of-ocean-beach-surf-reports_11382/)
- [Rapture Surfcamps: Best Apps For Surfers 2025](https://www.rapturecamps.com/best-apps-for-surfers/)
- [Surf Hub: Apps For Surfers Complete List](https://surf-hub.com/surfing-apps/)
- [da Surf Engine: Top 10 Apps for Surfers](https://www.dasurfengine.com/blog/top-10-apps-for-surfers/)
- [Surfers Survival Guide: Best Surf Forecast App](https://surfers-survival-guide.com/discover-the-best-surf-forecast-app-top-picks-features-explained/)
- [Swim Living: Beach Conditions Apps](https://www.swimmerliving.com/35670/7-best-apps-for-beach-water-conditions/)