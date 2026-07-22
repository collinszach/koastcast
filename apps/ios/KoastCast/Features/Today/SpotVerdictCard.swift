import SwiftUI

/// Compact home-spot card: mini Peak Score + Trust chip + current conditions.
struct SpotVerdictCard: View {
    let spot: Spot
    var metrics: [TodayMetric] = [.waveHeight, .period, .wind]
    @State private var loader = ForecastLoader()

    var body: some View {
        HStack(spacing: 14) {
            miniRing
            VStack(alignment: .leading, spacing: 4) {
                Text(spot.name)
                    .font(Theme.display(17, weight: .bold))
                    .foregroundStyle(Theme.textPrimary)
                if let region = spot.region {
                    Text(region).font(Theme.body(12)).foregroundStyle(Theme.textTertiary)
                }
                HStack(spacing: 10) {
                    ForEach(metrics.prefix(4)) { metric in
                        if let value = metric.value(hour: hour, spot: spot) {
                            stat(value)
                        }
                    }
                }
            }
            Spacer()
            trustChip
        }
        .glassCard(padding: 14, accent: Theme.qualityColor(quality))
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
            Circle().stroke(Theme.hairline, lineWidth: 6)
            Circle()
                .trim(from: 0, to: min(1, quality / 100))
                .stroke(Theme.qualityColor(quality), style: StrokeStyle(lineWidth: 6, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int((quality / 10).rounded()))")
                .font(Theme.display(18))
                .foregroundStyle(Theme.textPrimary)
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
