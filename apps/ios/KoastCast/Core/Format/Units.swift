import Foundation

/// Unit formatting. Global preference (imperial default for US surf).
enum Units {
    static func waveHeight(_ meters: Double?, imperial: Bool = true) -> String {
        guard let m = meters else { return "—" }
        return imperial ? String(format: "%.1f ft", m * 3.28084)
                        : String(format: "%.1f m", m)
    }

    static func waveHeightShort(_ meters: Double?, imperial: Bool = true) -> String {
        guard let m = meters else { return "—" }
        return imperial ? String(format: "%.0f", (m * 3.28084).rounded())
                        : String(format: "%.1f", m)
    }

    static func period(_ seconds: Double?) -> String {
        guard let s = seconds else { return "—" }
        return String(format: "%.0fs", s)
    }

    static func windSpeed(_ ms: Double?, imperial: Bool = true) -> String {
        guard let v = ms else { return "—" }
        return imperial ? String(format: "%.0f kt", v * 1.94384)
                        : String(format: "%.0f m/s", v)
    }

    static func direction(_ degrees: Double?) -> String {
        guard let d = degrees else { return "—" }
        let dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"]
        let idx = Int((d / 22.5).rounded()) % 16
        return dirs[(idx + 16) % 16]
    }

    static func temp(_ celsius: Double?, imperial: Bool = true) -> String {
        guard let c = celsius else { return "—" }
        return imperial ? String(format: "%.0f°F", c * 9/5 + 32)
                        : String(format: "%.0f°C", c)
    }
}
