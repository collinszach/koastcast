import SwiftUI

/// KoastCast's signature component, made native.
/// The ring stroke goes **dashed and faded as trust drops** — you can see the
/// forecast losing certainty. Tap "Why?" to reveal the contributing factors.
struct TrustRing: View {
    let score: Double                    // 0-100
    var trustLabel: String = ""
    var factors: [String: Double] = [:]  // normalized 0-1
    var limitingFactor: String? = nil
    var size: CGFloat = 104
    var showWhy: Bool = true

    @State private var expanded = false
    @State private var animatedProgress: Double = 0

    private var color: Color { Theme.trustColor(score) }
    private var isDashed: Bool { score < 80 }

    /// Dash pattern shrinks (more broken) as trust drops.
    private var dash: [CGFloat] {
        guard isDashed else { return [] }
        let t = max(0, min(1, score / 80))
        return [4 + 14 * t, 10 - 7 * t]
    }
    private var strokeOpacity: Double { 0.5 + 0.5 * (score / 100) }

    var body: some View {
        VStack(spacing: 10) {
            ZStack {
                Circle().stroke(Theme.hairline, lineWidth: 8)
                // Faded underlay so fill level reads even when dashed.
                if isDashed {
                    Circle()
                        .trim(from: 0, to: animatedProgress)
                        .stroke(color.opacity(0.12), style: StrokeStyle(lineWidth: 8, lineCap: .round))
                        .rotationEffect(.degrees(-90))
                }
                Circle()
                    .trim(from: 0, to: animatedProgress)
                    .stroke(color.opacity(strokeOpacity),
                            style: StrokeStyle(lineWidth: 8, lineCap: .round, dash: dash))
                    .rotationEffect(.degrees(-90))
                VStack(spacing: 0) {
                    Text("\(Int(score.rounded()))")
                        .font(Theme.display(28))
                        .foregroundStyle(Theme.textPrimary)
                    Text("TRUST")
                        .font(Theme.body(8, weight: .semibold))
                        .tracking(2)
                        .foregroundStyle(Theme.textTertiary)
                }
            }
            .frame(width: size, height: size)

            VStack(spacing: 2) {
                Text("\(trustLabel) confidence")
                    .font(Theme.display(12, weight: .bold))
                    .foregroundStyle(color)
                if let lim = limitingFactor, score < 80 {
                    Text("Limited by \(TrustFactor.label(lim).lowercased())")
                        .font(Theme.body(10))
                        .foregroundStyle(Theme.textTertiary)
                }
            }

            if showWhy && !factors.isEmpty {
                Button(expanded ? "Hide" : "Why?") {
                    withAnimation(.snappy) { expanded.toggle() }
                }
                .font(Theme.body(11, weight: .semibold))
                .foregroundStyle(Theme.accent)

                if expanded {
                    VStack(spacing: 6) {
                        ForEach(factors.sorted(by: { $0.value < $1.value }), id: \.key) { key, value in
                            FactorBar(name: key, value: value)
                        }
                    }
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
        }
        .onAppear {
            withAnimation(.easeOut(duration: 0.9)) {
                animatedProgress = min(1, max(0, score / 100))
            }
        }
    }
}

private struct FactorBar: View {
    let name: String
    let value: Double

    var body: some View {
        HStack(spacing: 8) {
            Text(TrustFactor.label(name))
                .font(Theme.body(11))
                .foregroundStyle(Theme.textSecondary)
                .frame(width: 110, alignment: .leading)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule().fill(Theme.hairline)
                    Capsule()
                        .fill(Theme.trustColor(value * 100))
                        .frame(width: max(0, geo.size.width * value))
                }
            }
            .frame(height: 6)
            Text("\(Int((value * 100).rounded()))")
                .font(Theme.data(11))
                .foregroundStyle(Theme.textTertiary)
                .frame(width: 28, alignment: .trailing)
        }
    }
}

enum TrustFactor {
    static func label(_ key: String) -> String {
        switch key {
        case "agreement": return "Model agreement"
        case "confidence": return "Local confidence"
        case "freshness": return "Data freshness"
        case "lead": return "Lead time"
        case "historical_skill", "historicalSkill": return "Track record"
        default: return key.capitalized
        }
    }
}

#Preview {
    ZStack {
        Theme.bg.ignoresSafeArea()
        TrustRing(score: 58, trustLabel: "Moderate",
                  factors: ["agreement": 0.4, "confidence": 0.7, "freshness": 0.9, "lead": 0.6],
                  limitingFactor: "agreement")
    }
}
