import SwiftUI

/// "Today" — the should-I-go dashboard. Leads with an AI briefing + Trust,
/// then home-spot verdicts.
struct TodayView: View {
    @Environment(AppState.self) private var app
    @State private var showSettings = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.oceanGradient.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 18) {
                        header
                        BriefingCard(spots: app.savedSpots.isEmpty ? Array(app.spots.prefix(3)) : app.savedSpots)
                        Text("Your spots")
                            .sectionLabel()
                            .padding(.top, Spacing.xs)
                        let list = app.savedSpots.isEmpty ? Array(app.spots.prefix(3)) : app.savedSpots
                        if list.isEmpty {
                            ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 40)
                        } else {
                            ForEach(list) { spot in
                                NavigationLink(value: spot) {
                                    SpotVerdictCard(spot: spot, metrics: app.todayMetrics)
                                }
                                .pressable()
                            }
                        }
                    }
                    .padding(20)
                }
                .refreshable {
                    Haptics.tap()
                    await app.refreshSpots()
                }
            }
            .navigationDestination(for: Spot.self) { SpotDetailView(spot: $0) }
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        Haptics.tap()
                        showSettings = true
                    } label: {
                        Image(systemName: "slider.horizontal.3")
                            .font(.title3)
                            .foregroundStyle(Theme.accent)
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                TodaySettingsView()
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(greeting)
                .font(Theme.body(13))
                .foregroundStyle(Theme.textSecondary)
            Text("KoastCast")
                .font(Theme.display(30, weight: .black))
                .foregroundStyle(Theme.textPrimary)
        }
    }

    private var greeting: String {
        let h = Calendar.current.component(.hour, from: Date())
        let part = h < 12 ? "morning" : (h < 18 ? "afternoon" : "evening")
        return "Good \(part) — here's your water."
    }
}
