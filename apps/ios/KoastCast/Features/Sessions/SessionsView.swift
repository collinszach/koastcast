import SwiftUI

struct SessionsView: View {
    @Environment(AppState.self) private var app
    @State private var showLogger = false

    var body: some View {
        NavigationStack {
            ZStack {
                Theme.oceanGradient.ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        statsRow
                        Text("History")
                            .font(Theme.display(18, weight: .bold))
                            .foregroundStyle(.white)
                        if app.sessions.isEmpty {
                            Text("No sessions yet. Tap + to log your first.")
                                .font(Theme.body(14)).foregroundStyle(Theme.textTertiary)
                                .padding(.top, 30)
                        }
                        ForEach(app.sessions) { session in
                            sessionRow(session)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Sessions")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showLogger = true } label: { Image(systemName: "plus") }
                }
            }
            .sheet(isPresented: $showLogger) {
                SessionLoggerView { app.addSession($0) }
            }
        }
    }

    private var statsRow: some View {
        HStack(spacing: 12) {
            statCard("\(app.sessions.count)", "sessions")
            statCard(avgRating, "avg rating")
            statCard("\(uniqueSpots)", "spots")
        }
    }

    private func statCard(_ value: String, _ label: String) -> some View {
        VStack(spacing: 4) {
            Text(value).font(Theme.display(24, weight: .black)).foregroundStyle(Theme.accent)
            Text(label).font(Theme.body(11)).foregroundStyle(Theme.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .glassCard(padding: 14)
    }

    private func sessionRow(_ s: LoggedSession) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(s.spotName).font(Theme.display(16, weight: .bold)).foregroundStyle(.white)
                Spacer()
                Text(s.date, format: .dateTime.month().day())
                    .font(Theme.body(12)).foregroundStyle(Theme.textTertiary)
            }
            HStack(spacing: 12) {
                tag("\(Int(s.waveHeightFt))ft")
                tag("★ \(s.qualityRating)/10")
                if let board = s.boardUsed { tag(board) }
            }
            if let notes = s.notes {
                Text(notes).font(Theme.body(13)).foregroundStyle(Theme.textSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .glassCard(padding: 14)
    }

    private func tag(_ s: String) -> some View {
        Text(s).font(Theme.data(11))
            .foregroundStyle(Theme.textSecondary)
            .padding(.horizontal, 8).padding(.vertical, 3)
            .background(Color.white.opacity(0.05), in: Capsule())
    }

    private var avgRating: String {
        guard !app.sessions.isEmpty else { return "—" }
        let avg = Double(app.sessions.map(\.qualityRating).reduce(0, +)) / Double(app.sessions.count)
        return String(format: "%.1f", avg)
    }
    private var uniqueSpots: Int { Set(app.sessions.map(\.spotName)).count }
}
