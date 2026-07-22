import SwiftUI

@main
struct KoastCastApp: App {
    @State private var appState = AppState()

    var body: some Scene {
        WindowGroup {
            RootTabView()
                .environment(appState)
                .preferredColorScheme(.light)
                .tint(Theme.accent)
                .task { await appState.loadSpots() }
        }
    }
}
