import SwiftUI

/// A metric that can be shown in a Today spot card's condition row.
/// Order here is the default display order.
enum TodayMetric: String, CaseIterable, Identifiable {
    case waveHeight, period, wind, swell, tide, trust

    var id: String { rawValue }

    var title: String {
        switch self {
        case .waveHeight: "Wave height"
        case .period: "Period"
        case .wind: "Wind"
        case .swell: "Swell direction"
        case .tide: "Tide"
        case .trust: "Trust score"
        }
    }

    /// Formatted value for this metric, or nil if there's nothing to show
    /// (e.g. no forecast loaded yet, or the field is genuinely absent).
    func value(hour: ForecastHour?, spot: Spot) -> String? {
        switch self {
        case .waveHeight:
            return Units.waveHeight(hour?.waveHeightFaceM ?? hour?.waveHeightM ?? spot.waveHeightM)
        case .period:
            return Units.period(hour?.wavePeriodS ?? spot.wavePeriodS)
        case .wind:
            guard let ms = hour?.windSpeedMs else { return nil }
            return Units.windSpeed(ms)
        case .swell:
            guard let deg = hour?.swellDirection ?? hour?.waveDirection else { return nil }
            return Units.direction(deg)
        case .tide:
            guard let m = hour?.tideHeightM else { return nil }
            return Units.waveHeight(m) + (hour?.tideState.map { " \($0)" } ?? "")
        case .trust:
            guard let t = hour?.trustScore else { return nil }
            return "\(Int(t)) trust"
        }
    }
}

/// Global app state shared across tabs.
@Observable
final class AppState {
    var spots: [Spot] = []
    var savedSpotIDs: Set<String> = ["mavericks-ca", "steamer-lane-ca", "ocean-beach-sf-ca"]
    var sessions: [LoggedSession] = SampleData.sessions
    var imperialUnits = true
    var isLoadingSpots = false
    var loadFailed = false

    /// Which metrics show in the Today tab's spot cards, and in what order.
    /// Customizable via the Today tab's settings sheet.
    var todayMetrics: [TodayMetric] = [.waveHeight, .period, .wind]

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
