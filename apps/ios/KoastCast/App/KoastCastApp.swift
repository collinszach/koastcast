import SwiftUI

@main
struct KoastCastApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(appState)
                .preferredColorScheme(.dark)
                .tint(Theme.accent)
                .task { await appState.loadSpots() }
        }
    }
}
