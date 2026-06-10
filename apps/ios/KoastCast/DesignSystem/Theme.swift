import SwiftUI

/// KoastCast brand: dark ocean base, cyan accents, glass surfaces.
/// Mirrors the web brand (#060D1A bg, cyan accents, Syne/JetBrains Mono → approximated
/// with SF Pro Rounded for display and SF Mono for data until custom fonts are bundled).
enum Theme {
    // MARK: Colors
    static let bg = Color(red: 0.024, green: 0.051, blue: 0.102)        // #060D1A
    static let bgElevated = Color(red: 0.043, green: 0.078, blue: 0.149)
    static let accent = Color(red: 0.133, green: 0.824, blue: 0.929)    // cyan
    static let accentSoft = Color(red: 0.133, green: 0.824, blue: 0.929).opacity(0.15)
    static let textPrimary = Color.white
    static let textSecondary = Color.white.opacity(0.62)
    static let textTertiary = Color.white.opacity(0.38)
    static let hairline = Color.white.opacity(0.08)

    static let oceanGradient = LinearGradient(
        colors: [Color(red: 0.024, green: 0.051, blue: 0.102),
                 Color(red: 0.03, green: 0.09, blue: 0.16)],
        startPoint: .top, endPoint: .bottom
    )

    // MARK: Fonts (approximations of Syne / JetBrains Mono)
    static func display(_ size: CGFloat, weight: Font.Weight = .heavy) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
    static func data(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        .system(size: size, weight: weight, design: .monospaced)
    }
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        .system(size: size, weight: weight)
    }

    // MARK: Quality palette (Peak Score)
    static func qualityColor(_ score: Double) -> Color {
        switch score {
        case 80...: return Color(red: 0.94, green: 0.27, blue: 0.27) // FIRING red
        case 65..<80: return Color(red: 0.98, green: 0.45, blue: 0.09) // PUMPING orange
        case 50..<65: return Color(red: 0.13, green: 0.77, blue: 0.37) // FUN green
        case 35..<50: return Color(red: 0.23, green: 0.51, blue: 0.96) // WORTH IT blue
        default: return Color(red: 0.42, green: 0.45, blue: 0.50)       // FLAT gray
        }
    }

    // MARK: Trust palette
    static func trustColor(_ score: Double) -> Color {
        switch score {
        case 80...: return Color(red: 0.13, green: 0.83, blue: 0.93)  // cyan, high trust
        case 60..<80: return Color(red: 0.20, green: 0.83, blue: 0.60) // emerald
        case 40..<60: return Color(red: 0.98, green: 0.75, blue: 0.14) // amber
        case 20..<40: return Color(red: 0.98, green: 0.57, blue: 0.24) // orange
        default: return Color(red: 0.97, green: 0.44, blue: 0.44)       // red, speculative
        }
    }
}

extension View {
    /// Standard glass card surface used across the app.
    func glassCard(padding: CGFloat = 16) -> some View {
        self
            .padding(padding)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(Theme.hairline, lineWidth: 1)
            )
    }
}
