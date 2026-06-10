# KoastCast iOS

Native SwiftUI app for KoastCast — a "better Surfline" centered on the
**Trust Score** (how much to trust each forecast). Apple frameworks only
(SwiftUI, MapKit, Swift Charts, CoreLocation) — zero third-party packages, so it
builds with no dependency resolution.

## Requirements
- Xcode 16+ (built/verified on Xcode 26, Swift 5 language mode)
- iOS 17.0+ deployment target
- [XcodeGen](https://github.com/yonyz/XcodeGen) (`brew install xcodegen`) — the
  `.xcodeproj` is generated, not committed.

## Build & run
```bash
cd apps/ios
xcodegen generate                # produces KoastCast.xcodeproj
open KoastCast.xcodeproj          # ⌘R in Xcode, or:
xcodebuild -project KoastCast.xcodeproj -scheme KoastCast \
  -destination 'generic/platform=iOS Simulator' build CODE_SIGNING_ALLOWED=NO
```

## Backend connection
The app consumes the **same NUC FastAPI backend** as the web app — no new server
infrastructure. Configure via environment variables (Scheme → Run → Arguments →
Environment Variables):

| Var | Purpose | Default |
|---|---|---|
| `KOAST_API_BASE` | Backend base URL | `http://localhost:8002` (DEBUG) / `https://api.koastcast.com` (release) |
| `KOAST_API_SECRET` | Shared proxy secret (`x-api-secret` header) | none |

If the backend is unreachable, every screen **falls back to bundled sample
data** so the app is always demoable.

## What's implemented (v1 vertical slice)
- **5-tab shell:** Today · Explore · Forecast · Sessions · Ask Koast
- **Today** — AI morning briefing that *speaks the Trust Score* + home-spot verdict cards
- **Explore** — dark MapKit map, spot pins colored by quality, detail sheet
- **Forecast** — spot list → **flagship Spot Detail**: animated Peak Score ring,
  **Trust Ring** (dashed/faded as confidence drops, with "Why?" factor breakdown),
  7-day Swift Charts timeline with a trust overlay, tide chart, conditions, buoy, save
- **Sessions** — logger + history + quick stats
- **Ask Koast** — chat UI with Trust-aware answers (wired for `/nlq` + Claude next)

## Architecture
MVVM with iOS 17 `@Observable`. `APIClient` actor decodes snake_case →
camelCase. See `IOS_SPEC.md` (repo root) for the full screen-by-screen spec and
epic roadmap.

## Not yet wired (next epics)
- Supabase auth + Sign in with Apple (currently guest)
- StoreKit 2 paywall (App Store IAP — **not** Stripe)
- Live `/briefing` + streaming `/nlq` (Claude)
- APNs alerts, offline SwiftData cache, custom fonts (Syne / JetBrains Mono)
