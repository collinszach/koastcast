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

    // MARK: Fonts — bundled brand type: Syne (display), JetBrains Mono (data), Inter (body).
    // Falls back to the nearest system font automatically if a name isn't registered
    // (e.g. Info.plist UIAppFonts entry missing), so the app never renders blank text.
    static func display(_ size: CGFloat, weight: Font.Weight = .heavy) -> Font {
        let name: String
        switch weight {
        case .black, .heavy:      name = "SyneExtraBold"
        case .bold:                name = "SyneBold"
        case .semibold, .medium:  name = "SyneSemiBold"
        default:                   name = "Syne-Regular"
        }
        return .custom(name, size: size, relativeTo: .largeTitle)
    }
    static func data(_ size: CGFloat, weight: Font.Weight = .semibold) -> Font {
        let name: String
        switch weight {
        case .black, .heavy:      name = "JetBrainsMonoExtraBold"
        case .bold, .semibold:    name = "JetBrainsMonoBold"
        case .medium:              name = "JetBrainsMonoMedium"
        default:                   name = "JetBrainsMono-Regular"
        }
        return .custom(name, size: size, relativeTo: .body)
    }
    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        let name: String
        switch weight {
        case .black, .heavy, .bold: name = "InterBold"
        case .semibold:              name = "InterSemiBold"
        case .medium:                 name = "InterMedium"
        default:                      name = "Inter-Regular"
        }
        return .custom(name, size: size, relativeTo: .body)
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

/// Consistent spacing rhythm across every screen — reformat pass uses this
/// instead of ad hoc padding values so the app reads as one system.
enum Spacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 8
    static let md: CGFloat = 12
    static let lg: CGFloat = 16
    static let xl: CGFloat = 20
    static let xxl: CGFloat = 28
}

extension View {
    /// Standard glass card surface used across the app. Pass `accent` to add
    /// the cyan top-edge highlight used on hero/flagship cards (mirrors the
    /// web app's `.glass-card` treatment).
    func glassCard(padding: CGFloat = 16, accent: Color? = nil) -> some View {
        self
            .padding(padding)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(alignment: .top) {
                if let accent {
                    LinearGradient(colors: [accent, accent.opacity(0)], startPoint: .leading, endPoint: .trailing)
                        .frame(height: 2)
                        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                        .padding(.horizontal, 1)
                }
            }
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(accent?.opacity(0.25) ?? Theme.hairline, lineWidth: 1)
            )
    }

    /// Small-caps section label with a cyan left rule — the reformat pass's
    /// standard way to introduce a section, used in place of bespoke headers.
    func sectionLabel() -> some View {
        self
            .font(Theme.data(10, weight: .bold))
            .tracking(1.6)
            .foregroundStyle(Theme.accent)
            .textCase(.uppercase)
            .padding(.leading, 10)
            .overlay(alignment: .leading) {
                Capsule().fill(Theme.accent).frame(width: 3, height: 12)
            }
    }
}
