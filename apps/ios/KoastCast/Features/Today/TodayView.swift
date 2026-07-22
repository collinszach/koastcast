import SwiftUI

/// "Today" — the should-I-go dashboard. Leads with an AI briefing + Trust,
/// then home-spot verdicts.
struct TodayView: View {
    @Environment(AppState.self) private var app
    @State private var showSettings = false
    @State private var showAddSpot = false

    private var list: [Spot] { app.savedSpots.isEmpty ? Array(app.spots.prefix(3)) : app.savedSpots }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    header
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 8, leading: 20, bottom: 0, trailing: 20))

                Section {
                    BriefingCard(spots: app.savedSpots.isEmpty ? Array(app.spots.prefix(3)) : app.savedSpots)
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 18, leading: 20, bottom: 0, trailing: 20))

                Section {
                    HStack {
                        Text("Your spots").sectionLabel()
                        Spacer()
                        Button {
                            Haptics.tap()
                            showAddSpot = true
                        } label: {
                            Image(systemName: "plus.circle.fill")
                                .font(.body)
                                .foregroundStyle(Theme.accent)
                        }
                    }
                    if list.isEmpty {
                        ProgressView().tint(Theme.accent).frame(maxWidth: .infinity).padding(.vertical, 40)
                            .listRowSeparator(.hidden)
                    }
                }
                .listRowBackground(Color.clear)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 18, leading: 20, bottom: 0, trailing: 20))

                ForEach(list) { spot in
                    NavigationLink(value: spot) {
                        SpotVerdictCard(spot: spot, metrics: app.todayMetrics)
                    }
                    .listRowBackground(Color.clear)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 10, leading: 20, bottom: 0, trailing: 20))
                    .swipeActions(edge: .trailing, allowsFullSwipe: true) {
                        if app.isSaved(spot) {
                            Button(role: .destructive) {
                                Haptics.tap()
                                app.toggleSaved(spot)
                            } label: {
                                Label("Remove", systemImage: "heart.slash.fill")
                            }
                        }
                    }
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.oceanGradient.ignoresSafeArea())
            .refreshable {
                Haptics.tap()
                await app.refreshSpots()
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
            .sheet(isPresented: $showAddSpot) {
                AddSpotView()
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
