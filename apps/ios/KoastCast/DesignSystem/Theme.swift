import SwiftUI

/// KoastCast brand: "surf-report utility" — warm paper base, cyan accents, flat tiles.
/// Mirrors the web brand (#F7F5F0 bg, cyan accents, Archivo/JetBrains Mono/Inter).
enum Theme {
    // MARK: Colors
    static let bg = Color(red: 0.969, green: 0.961, blue: 0.941)        // #F7F5F0 paper
    static let bgElevated = Color(red: 1.0, green: 1.0, blue: 1.0)       // #FFFFFF raised
    static let bgSunken = Color(red: 0.937, green: 0.922, blue: 0.886)   // #EFEBE2 sunken
    static let accent = Color(red: 0.055, green: 0.647, blue: 0.914)    // #0EA5E9 cyan
    static let accentBright = Color(red: 0.008, green: 0.518, blue: 0.780) // #0284C7
    static let accentSoft = Color(red: 0.878, green: 0.949, blue: 0.992)   // #E0F2FE cyan-muted
    static let textPrimary = Color(red: 0.071, green: 0.094, blue: 0.122)   // #12181F ink
    static let textSecondary = Color(red: 0.227, green: 0.267, blue: 0.314) // #3A4450
    static let textTertiary = Color(red: 0.420, green: 0.463, blue: 0.525)  // #6B7686
    static let hairline = Color(red: 0.071, green: 0.094, blue: 0.122).opacity(0.10)

    static let oceanGradient = LinearGradient(
        colors: [Color(red: 0.969, green: 0.961, blue: 0.941),
                 Color(red: 0.969, green: 0.961, blue: 0.941)],
        startPoint: .top, endPoint: .bottom
    )

    // MARK: Fonts — bundled brand type: Archivo (display), JetBrains Mono (data), Inter (body).
    // Falls back to the nearest system font automatically if a name isn't registered
    // (e.g. Info.plist UIAppFonts entry missing), so the app never renders blank text.
    static func display(_ size: CGFloat, weight: Font.Weight = .heavy) -> Font {
        let name: String
        switch weight {
        case .black, .heavy:      name = "ArchivoBlack"
        case .bold:                name = "ArchivoBold"
        case .semibold, .medium:  name = "ArchivoSemiBold"
        default:                   name = "Archivo-Regular"
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

    // MARK: Quality palette (Peak Score) — matches web --q-* tokens
    static func qualityColor(_ score: Double) -> Color {
        switch score {
        case 80...: return Color(red: 0.918, green: 0.345, blue: 0.047)  // #EA580C firing
        case 65..<80: return Color(red: 0.035, green: 0.569, blue: 0.698) // #0891B2 pumping
        case 50..<65: return Color(red: 0.145, green: 0.388, blue: 0.922) // #2563EB good/fun
        case 35..<50: return Color(red: 0.310, green: 0.275, blue: 0.898) // #4F46E5 worth it
        default: return Color(red: 0.392, green: 0.455, blue: 0.545)       // #64748B flat
        }
    }

    // MARK: Trust palette
    static func trustColor(_ score: Double) -> Color {
        switch score {
        case 80...: return Color(red: 0.008, green: 0.518, blue: 0.780)  // cyan-bright, high trust
        case 60..<80: return Color(red: 0.020, green: 0.588, blue: 0.412) // #059669 emerald
        case 40..<60: return Color(red: 0.851, green: 0.467, blue: 0.024) // #D97706 amber
        case 20..<40: return Color(red: 0.918, green: 0.345, blue: 0.047) // #EA580C orange
        default: return Color(red: 0.851, green: 0.180, blue: 0.180)       // #D92E2E red, speculative
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
    /// Standard flat tile surface used across the app — a solid raised surface
    /// with a hairline border and a soft shadow, no blur. Pass `accent` to add
    /// the cyan top-edge rule used on hero/flagship cards (mirrors the
    /// web app's `.tile`/`.tile-accent` treatment).
    func glassCard(padding: CGFloat = 16, accent: Color? = nil) -> some View {
        self
            .padding(padding)
            .background(Theme.bgElevated)
            .overlay(alignment: .top) {
                if let accent {
                    accent.frame(height: 2)
                }
            }
            // Clip content + accent bar to the card shape so nothing (bars, text,
            // backgrounds) can ever render past the rounded edges.
            .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .stroke(accent?.opacity(0.3) ?? Theme.hairline, lineWidth: 1)
            )
            .shadow(color: Theme.textPrimary.opacity(0.04), radius: 2, x: 0, y: 1)
            .shadow(color: Theme.textPrimary.opacity(0.05), radius: 10, x: 0, y: 4)
    }

    /// Small-caps section label with a cyan left rule — the reformat pass's
    /// standard way to introduce a section, used in place of bespoke headers.
    func sectionLabel() -> some View {
        self
            .font(Theme.data(10, weight: .bold))
            .tracking(1.6)
            .foregroundStyle(Theme.accentBright)
            .textCase(.uppercase)
            .padding(.leading, 10)
            .overlay(alignment: .leading) {
                Capsule().fill(Theme.accent).frame(width: 3, height: 12)
            }
    }
}
