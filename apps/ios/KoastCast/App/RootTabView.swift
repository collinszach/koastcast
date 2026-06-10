import SwiftUI

struct RootTabView: View {
    @Environment(AppState.self) private var app
    @State private var selectedTab: Int = {
        switch ProcessInfo.processInfo.environment["KOAST_DEMO_TAB"] {
        case "explore": return 1
        case "forecast": return 2
        case "sessions": return 3
        case "ask": return 4
        default: return 0
        }
    }()

    /// Optional demo deep-link: launch straight into a spot's detail.
    /// Set env `KOAST_DEMO_SPOT=<slug>` (used for screenshots / QA).
    private var demoSpotSlug: String? {
        ProcessInfo.processInfo.environment["KOAST_DEMO_SPOT"]
    }

    var body: some View {
        if let slug = demoSpotSlug, let spot = app.spots.first(where: { $0.slug == slug || $0.id == slug }) {
            NavigationStack { SpotDetailView(spot: spot) }
        } else {
            tabs
        }
    }

    private var tabs: some View {
        TabView(selection: $selectedTab) {
            TodayView()
                .tag(0)
                .tabItem { Label("Today", systemImage: "sunrise.fill") }
            ExploreView()
                .tag(1)
                .tabItem { Label("Explore", systemImage: "map.fill") }
            SpotListView()
                .tag(2)
                .tabItem { Label("Forecast", systemImage: "water.waves") }
            SessionsView()
                .tabItem { Label("Sessions", systemImage: "figure.surfing") }
            AskKoastView()
                .tabItem { Label("Ask Koast", systemImage: "sparkles") }
        }
        .tint(Theme.accent)
        .onAppear {
            let appearance = UITabBarAppearance()
            appearance.configureWithOpaqueBackground()
            appearance.backgroundColor = UIColor(Theme.bg)
            UITabBar.appearance().standardAppearance = appearance
            UITabBar.appearance().scrollEdgeAppearance = appearance
        }
    }
}
