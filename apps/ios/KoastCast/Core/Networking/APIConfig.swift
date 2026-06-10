import Foundation

/// Central API configuration. Points at the NUC FastAPI backend (behind nginx /
/// Tailscale Funnel in production). The app consumes the same endpoints the web
/// app does — no new server infrastructure.
enum APIConfig {
    /// Override at launch via the `KOAST_API_BASE` environment variable / scheme arg.
    static var baseURL: URL {
        if let raw = ProcessInfo.processInfo.environment["KOAST_API_BASE"],
           let url = URL(string: raw) {
            return url
        }
        return URL(string: defaultBase)!
    }

    /// The NUC backend — used for ALL builds (debug + release). Everything runs
    /// through the NUC over the koastcast.com domain (Cloudflare Tunnel → nginx →
    /// FastAPI). No Tailscale. Override for one-off testing via `KOAST_API_BASE`.
    static let defaultBase = "https://api.koastcast.com"

    static let apiPrefix = "/api/v1"

    /// Shared proxy secret (same contract as the Next.js proxy). Injected at build/runtime.
    static var apiSecret: String? {
        ProcessInfo.processInfo.environment["KOAST_API_SECRET"]
    }

    static let requestTimeout: TimeInterval = 20
}
