import SwiftUI

/// AI morning briefing. Generates a Trust-aware natural-language summary.
/// v1 uses a local templated generator that *speaks the Trust Score* — the same
/// prose shape the Claude-backed `/briefing` endpoint will return once wired.
struct BriefingCard: View {
    let spots: [Spot]
    @State private var loaders: [String: ForecastLoader] = [:]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack(spacing: 8) {
                Image(systemName: "sparkles").foregroundStyle(Theme.accent)
                Text("Morning Briefing")
                    .font(Theme.display(15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
                Text("AI").font(Theme.data(10)).foregroundStyle(Theme.accent)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(Theme.accentSoft, in: Capsule())
            }
            Text(briefing)
                .font(Theme.body(15))
                .foregroundStyle(Theme.textPrimary.opacity(0.92))
                .fixedSize(horizontal: false, vertical: true)
                .lineSpacing(3)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(accent: Theme.accent)
        .task(id: spots.map(\.id).joined()) {
            for spot in spots.prefix(3) where loaders[spot.id] == nil {
                let loader = ForecastLoader()
                loaders[spot.id] = loader
                await loader.load(spot: spot, days: 2)
            }
        }
    }

    private var briefing: String {
        let ranked = spots.prefix(3).compactMap { spot -> (Spot, ForecastHour)? in
            guard let h = loaders[spot.id]?.currentHour else { return nil }
            return (spot, h)
        }.sorted { ($0.1.qualityScore ?? 0) > ($1.1.qualityScore ?? 0) }

        guard let (best, hour) = ranked.first else {
            return "Pulling the latest models for your spots…"
        }
        let q = hour.qualityScore ?? 0
        let face = Units.waveHeight(hour.waveHeightFaceM ?? hour.waveHeightM, imperial: true)
        let trust = hour.trustScore ?? 0
        let trustWord = SampleData.trustLabel(trust).lowercased()

        let verdict: String
        switch q {
        case 7...: verdict = "\(best.name) is firing — \(face) and clean."
        case 5..<7: verdict = "\(best.name) looks fun at \(face)."
        case 3..<5: verdict = "\(best.name) is marginal at \(face) — worth a look."
        default: verdict = "It's flat across your spots. \(best.name) is the least-bad at \(face)."
        }
        let trustSentence = trust >= 70
            ? "We're \(Int(trust))% confident (\(trustWord))."
            : "Heads up — only \(Int(trust))% confidence this far out (\(trustWord)); check back closer to go-time."
        return "\(verdict) \(trustSentence)"
    }
}
