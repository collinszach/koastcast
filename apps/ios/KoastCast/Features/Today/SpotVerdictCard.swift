import SwiftUI

/// Compact home-spot card: mini Peak Score + Trust chip + current conditions.
struct SpotVerdictCard: View {
    let spot: Spot
    @State private var loader = ForecastLoader()

    var body: some View {
        HStack(spacing: 14) {
            miniRing
            VStack(alignment: .leading, spacing: 4) {
                Text(spot.name)
                    .font(Theme.display(17, weight: .bold))
                    .foregroundStyle(.white)
                if let region = spot.region {
                    Text(region).font(Theme.body(12)).foregroundStyle(Theme.textTertiary)
                }
                HStack(spacing: 10) {
                    stat(Units.waveHeight(hour?.waveHeightFaceM ?? hour?.waveHeightM ?? spot.waveHeightM))
                    stat(Units.period(hour?.wavePeriodS ?? spot.wavePeriodS))
                    stat(Units.windSpeed(hour?.windSpeedMs))
                }
            }
            Spacer()
            trustChip
        }
        .glassCard(padding: 14)
        .task {
            if loader.forecast == nil { await loader.load(spot: spot, days: 2) }
        }
    }

    private var hour: ForecastHour? { loader.currentHour }

    private var quality: Double {
        (hour?.qualityScore ?? spot.qualityScore ?? 0) * 10  // 0-10 → 0-100
    }

    private var miniRing: some View {
        ZStack {
            Circle().stroke(Color.white.opacity(0.08), lineWidth: 6)
            Circle()
                .trim(from: 0, to: min(1, quality / 100))
                .stroke(Theme.qualityColor(quality), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((quality / 10).rounded()))")
                .font(Theme.display(18))
                .foregroundStyle(.white)
        }
        .frame(width: 52, height: 52)
    }

    @ViewBuilder private var trustChip: some View {
        if let t = hour?.trustScore {
            VStack(spacing: 2) {
                Text("\(Int(t))")
                    .font(Theme.data(15, weight: .bold))
                    .foregroundStyle(Theme.trustColor(t))
                Text("trust")
                    .font(Theme.body(8))
                    .foregroundStyle(Theme.textTertiary)
            }
            .padding(.horizontal, 10).padding(.vertical, 6)
            .background(Theme.trustColor(t).opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
        }
    }

    private func stat(_ s: String) -> some View {
        Text(s).font(Theme.data(12)).foregroundStyle(Theme.textSecondary)
    }
}
