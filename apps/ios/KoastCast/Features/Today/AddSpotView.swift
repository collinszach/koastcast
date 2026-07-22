import SwiftUI

/// Search the full catalog and add spots to your favorites — launched from
/// the Today tab's "Your spots" section. Tap toggles save state; stays open
/// so you can add several in a row.
struct AddSpotView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app
    @State private var query = ""

    private var results: [Spot] {
        guard !query.isEmpty else { return Array(app.spots.prefix(50)) }
        let q = query.lowercased()
        return app.spots.filter {
            $0.name.lowercased().contains(q)
                || ($0.region?.lowercased().contains(q) ?? false)
                || $0.slug.lowercased().contains(q)
        }
    }

    var body: some View {
        NavigationStack {
            List(results) { spot in
                Button {
                    Haptics.tap()
                    app.toggleSaved(spot)
                } label: {
                    HStack(spacing: 12) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(spot.name)
                                .font(Theme.body(15, weight: .semibold))
                                .foregroundStyle(Theme.textPrimary)
                            if let region = spot.region {
                                Text(region).font(Theme.body(11)).foregroundStyle(Theme.textTertiary)
                            }
                        }
                        Spacer()
                        Image(systemName: app.isSaved(spot) ? "checkmark.circle.fill" : "plus.circle")
                            .font(.title3)
                            .foregroundStyle(app.isSaved(spot) ? Theme.accent : Theme.textTertiary)
                    }
                }
                .listRowBackground(Theme.bgElevated)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
            .background(Theme.oceanGradient.ignoresSafeArea())
            .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always), prompt: "Search spots")
            .navigationTitle("Add spots")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.light)
    }
}
