import SwiftUI

struct SpotDetailView: View {
    let spot: Spot
    @Environment(AppState.self) private var app
    @State private var loader = ForecastLoader()
    @State private var days = 7

    private var hour: ForecastHour? { loader.currentHour }
    private var quality100: Double { (hour?.qualityScore ?? spot.qualityScore ?? 0) * 10 }

    var body: some View {
        ZStack {
            Theme.oceanGradient.ignoresSafeArea()
            ScrollView {
                if loader.isLoading && loader.forecast == nil {
                    SpotDetailSkeleton()
                        .padding(20)
                } else {
                    VStack(spacing: 20) {
                        hero
                        if loader.isOffline { offlineBanner }
                        conditionsRow
                        trustSection
                        if let hours = loader.forecast?.hours, !hours.isEmpty {
                            ForecastTimelineView(hours: Array(hours.prefix(days * 24)))
                            TideChartView(hours: Array(hours.prefix(72)))
                        }
                        buoySection
                        aiAsk
                    }
                    .padding(20)
                }
            }
            .refreshable {
                Haptics.tap()
                await loader.reload(spot: spot, days: 7)
            }
        }
        .navigationTitle(spot.name)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    Haptics.tap()
                    app.toggleSaved(spot)
                } label: {
                    Image(systemName: app.isSaved(spot) ? "heart.fill" : "heart")
                        .foregroundStyle(app.isSaved(spot) ? Theme.accent : .white)
                        .symbolEffect(.bounce, value: app.isSaved(spot))
                }
            }
        }
        .task { if loader.forecast == nil { await loader.load(spot: spot, days: 7) } }
    }

    // MARK: Hero — Peak Score ring + label

    private var hero: some View {
        VStack(spacing: 6) {
            ScoreRing(score: quality100,
                      label: qualityLabel.0, emoji: qualityLabel.1,
                      isPersonalized: false)
            if let region = spot.region {
                Text(region.uppercased())
                    .font(Theme.body(11, weight: .semibold))
                    .tracking(2)
                    .foregroundStyle(Theme.textTertiary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    private var offlineBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "wifi.slash").font(.caption)
            Text("Offline estimate — couldn't reach the forecast server.")
                .font(Theme.body(11))
            Spacer()
            Button("Retry") {
                Haptics.tap()
                Task { await loader.reload(spot: spot, days: 7) }
            }
            .font(Theme.body(11, weight: .semibold))
            .foregroundStyle(Theme.accent)
        }
        .foregroundStyle(Theme.textTertiary)
        .frame(maxWidth: .infinity)
        .padding(10)
        .background(Color.orange.opacity(0.10), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.orange.opacity(0.25), lineWidth: 1))
    }

    // MARK: Conditions snapshot

    private var conditionsRow: some View {
        HStack(spacing: 0) {
            condition("Face", Units.waveHeight(hour?.waveHeightFaceM ?? hour?.waveHeightM))
            divider
            condition("Period", Units.period(hour?.wavePeriodS))
            divider
            condition("Wind", Units.windSpeed(hour?.windSpeedMs))
            divider
            condition("Swell", Units.direction(hour?.swellDirection ?? hour?.waveDirection))
        }
        .glassCard(padding: 16)
    }

    private func condition(_ label: String, _ value: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(Theme.data(16, weight: .bold)).foregroundStyle(.white)
            Text(label).font(Theme.body(10)).foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
    }

    private var divider: some View {
        Rectangle().fill(Theme.hairline).frame(width: 1, height: 28)
    }

    // MARK: Trust — the differentiator

    private var trustSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("How much to trust this")
                    .font(Theme.display(15, weight: .bold))
                    .foregroundStyle(.white)
                Spacer()
            }
            if let h = hour {
                TrustRing(score: h.trustScore ?? 0,
                          trustLabel: h.trustLabel ?? SampleData.trustLabel(h.trustScore ?? 0),
                          factors: h.trustFactors ?? [:],
                          limitingFactor: h.trustLimitingFactor)
            }
            if let summary = loader.forecast?.trustSummary, let s = summary.score {
                Text("Next 24h: \(Int(s))% confidence on average. We publish our accuracy — tap Why above to see what's driving it.")
                    .font(Theme.body(12))
                    .foregroundStyle(Theme.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .glassCard()
    }

    // MARK: Buoy

    private var buoySection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Live buoy", systemImage: "dot.radiowaves.left.and.right")
                .font(Theme.display(14, weight: .bold))
                .foregroundStyle(.white)
            Text(spot.nearestBuoyId.map { "Station \($0) · blended into the next 6 hours of forecast." }
                 ?? "No nearby buoy mapped.")
                .font(Theme.body(12))
                .foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard()
    }

    private var aiAsk: some View {
        HStack(spacing: 10) {
            Image(systemName: "sparkles").foregroundStyle(Theme.accent)
            Text("Ask Koast about \(spot.name)")
                .font(Theme.body(14, weight: .medium))
                .foregroundStyle(.white)
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(Theme.textTertiary)
        }
        .glassCard(padding: 14)
    }

    private var qualityLabel: (String, String) {
        switch quality100 {
        case 80...: return ("FIRING", "🔥")
        case 65..<80: return ("PUMPING", "🤙")
        case 50..<65: return ("FUN", "😎")
        case 35..<50: return ("WORTH IT", "🏄")
        default: return ("FLAT SPELL", "😴")
        }
    }
}

// MARK: - Loading skeleton

private struct SpotDetailSkeleton: View {
    private func block(_ h: CGFloat) -> some View {
        RoundedRectangle(cornerRadius: 20, style: .continuous)
            .fill(Color.white.opacity(0.06))
            .frame(height: h)
            .shimmer()
    }
    var body: some View {
        VStack(spacing: 20) {
            Circle().fill(Color.white.opacity(0.07))
                .frame(width: 132, height: 132).shimmer()
            RoundedRectangle(cornerRadius: 6).fill(Color.white.opacity(0.06))
                .frame(width: 140, height: 14).shimmer()
            block(70)
            block(170)
            block(200)
        }
        .frame(maxWidth: .infinity)
    }
}
