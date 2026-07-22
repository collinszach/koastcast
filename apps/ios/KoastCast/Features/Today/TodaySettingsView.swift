import SwiftUI

/// Lets the user choose which metrics show on Today's spot cards, and in
/// what order (drag to reorder). Backed by `AppState.todayMetrics`.
struct TodaySettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var app

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(app.todayMetrics) { metric in
                        Label(metric.title, systemImage: "checkmark.circle.fill")
                            .foregroundStyle(Theme.textPrimary)
                            .listRowBackground(Theme.bgElevated)
                    }
                    .onMove { app.todayMetrics.move(fromOffsets: $0, toOffset: $1) }
                    .onDelete { app.todayMetrics.remove(atOffsets: $0) }
                } header: {
                    Text("Shown on Today, in order")
                } footer: {
                    Text("Drag to reorder. Swipe to remove. Up to 4 shown per card.")
                }

                let hidden = TodayMetric.allCases.filter { !app.todayMetrics.contains($0) }
                if !hidden.isEmpty {
                    Section("Not shown") {
                        ForEach(hidden) { metric in
                            Button {
                                Haptics.tap()
                                app.todayMetrics.append(metric)
                            } label: {
                                Label(metric.title, systemImage: "plus.circle")
                            }
                            .foregroundStyle(Theme.textPrimary)
                            .listRowBackground(Theme.bgElevated)
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Theme.bg)
            .navigationTitle("Today metrics")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { EditButton() }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .preferredColorScheme(.light)
    }
}
