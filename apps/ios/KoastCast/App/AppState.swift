import SwiftUI

/// Global app state shared across tabs.
@Observable
final class AppState {
    var spots: [Spot] = []
    var savedSpotIDs: Set<String> = ["mavericks-ca", "steamer-lane-ca", "ocean-beach-sf-ca"]
    var sessions: [LoggedSession] = SampleData.sessions
    var imperialUnits = true
    var isLoadingSpots = false
    var loadFailed = false

    let location = LocationManager()

    var savedSpots: [Spot] {
        spots.filter { savedSpotIDs.contains($0.id) }
    }

    func isSaved(_ spot: Spot) -> Bool { savedSpotIDs.contains(spot.id) }

    func toggleSaved(_ spot: Spot) {
        if savedSpotIDs.contains(spot.id) { savedSpotIDs.remove(spot.id) }
        else { savedSpotIDs.insert(spot.id) }
    }

    @MainActor
    func loadSpots() async {
        guard spots.isEmpty else { return }
        isLoadingSpots = true
        loadFailed = false
        do {
            let fetched = try await APIClient.shared.spots()
            // Fall back to the bundled global catalog if the API returns nothing.
            spots = fetched.isEmpty ? BundledSpots.all : fetched
        } catch {
            // Graceful fallback: the full global catalog ships in the app bundle.
            spots = BundledSpots.all
            loadFailed = true
        }
        isLoadingSpots = false
    }

    func addSession(_ session: LoggedSession) {
        sessions.insert(session, at: 0)
    }

    /// Pull-to-refresh: re-fetch the catalog without flashing an empty list.
    @MainActor
    func refreshSpots() async {
        do {
            let fetched = try await APIClient.shared.spots()
            if !fetched.isEmpty { spots = fetched; loadFailed = false }
        } catch {
            loadFailed = true
        }
    }
}
