import SwiftUI

/// Global spot catalog (1000+). Lazy `List` + search + country filter.
/// Rows are lightweight (no per-row network) — full forecast + Trust load on tap.
struct SpotListView: View {
    @Environment(AppState.self) private var app
    @State private var scope: Scope = .all
    @State private var query = ""

    enum Scope: String, CaseIterable { case saved = "Saved", all = "All" }

    private var results: [Spot] {
        let base: [Spot] = scope == .saved ? app.savedSpots : app.spots
        let filtered: [Spot]
        if query.isEmpty {
            filtered = base
        } else {
            let q = query.lowercased()
            filtered = base.filter {
                $0.name.lowercased().contains(q)
                || ($0.region?.lowercased().contains(q) ?? false)
                || ($0.slug.lowercased().contains(q))
            }
        }
        return filtered.sorted { ($0.qualityScore ?? -1) > ($1.qualityScore ?? -1) }
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    Picker("", selection: $scope) {
                        ForEach(Scope.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                    }
                    .pickerStyle(.segmented)
                    .listRowBackground(Color.clear)
                    .listRowInsets(EdgeInsets(top: 4, leading: 0, bottom: 8, trailing: 0))
                }

                if scope == .all {
                    Text("\(app.spots.count) spots · \(countryCount) countries")
                        .font(Theme.body(12))
                        .foregroundStyle(Theme.textTertiary)
                        .listRowBackground(Color.clear)
                }

                ForEach(results) { spot in
                    NavigationLink(value: spot) {
                        SpotRow(spot: spot, saved: app.isSaved(spot))
                    }
                    .listRowBackground(Theme.bgElevated)
                }

                if results.isEmpty {
                    Text(scope == .saved ? "No saved spots yet — open any spot and tap the heart."
                                         : "No spots match “\(query)”.")
                        .font(Theme.body(14))
                        .foregroundStyle(Theme.textTertiary)
                        .listRowBackground(Color.clear)
                }
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.oceanGradient.ignoresSafeArea())
            .refreshable {
                Haptics.tap()
                await app.refreshSpots()
            }
            .navigationTitle("Forecast")
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                        prompt: "Search 1000+ spots")
            .navigationDestination(for: Spot.self) { SpotDetailView(spot: $0) }
            .toolbarBackground(Theme.bg, for: .navigationBar)
        }
    }

    private var countryCount: Int {
        Set(app.spots.compactMap { $0.country?.uppercased() }.filter { !$0.isEmpty && $0 != "INT" }).count
    }
}

/// Lightweight catalog row — metadata only, no network.
private struct SpotRow: View {
    let spot: Spot
    let saved: Bool

    var body: some View {
        HStack(spacing: 12) {
            qualityDot
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Text(spot.name).font(Theme.display(15, weight: .semibold)).foregroundStyle(.white)
                    if saved { Image(systemName: "heart.fill").font(.system(size: 9)).foregroundStyle(Theme.accent) }
                }
                Text([spot.region, spot.breakType?.capitalized].compactMap { $0 }.joined(separator: " · "))
                    .font(Theme.body(11)).foregroundStyle(Theme.textTertiary)
            }
            Spacer()
            if let q = spot.qualityScore {
                Text(String(format: "%.1f", q))
                    .font(Theme.data(13, weight: .bold))
                    .foregroundStyle(Theme.qualityColor(q * 10))
            }
        }
        .padding(.vertical, 2)
    }

    private var qualityDot: some View {
        Circle()
            .fill(spot.qualityScore.map { Theme.qualityColor($0 * 10) } ?? Color.white.opacity(0.18))
            .frame(width: 10, height: 10)
    }
}
