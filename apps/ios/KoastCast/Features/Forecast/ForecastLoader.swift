import SwiftUI

/// Loads a spot forecast. Exposes an explicit phase so the UI shows a real
/// loading skeleton (never a fake "0/FLAT") and an honest offline state
/// (never disguises an estimate as live data).
@Observable
final class ForecastLoader {
    enum Phase { case idle, loading, live, offline }

    var forecast: ForecastResponse?
    private(set) var phase: Phase = .idle

    var isLoading: Bool { phase == .loading }
    var isOffline: Bool { phase == .offline }

    @MainActor
    func load(spot: Spot, days: Int = 7, force: Bool = false) async {
        if phase == .live && !force { return }
        // keep any existing forecast visible while refreshing
        phase = forecast == nil ? .loading : phase
        do {
            let fc = try await APIClient.shared.forecast(spotID: spot.slug, days: days)
            if fc.hours.isEmpty {
                forecast = SampleData.forecast(for: spot)
                phase = .offline
            } else {
                forecast = fc
                phase = .live
            }
        } catch {
            if forecast == nil { forecast = SampleData.forecast(for: spot) }
            phase = .offline
        }
    }

    @MainActor
    func reload(spot: Spot, days: Int = 7) async {
        await load(spot: spot, days: days, force: true)
    }

    /// The hour closest to now (current conditions).
    var currentHour: ForecastHour? {
        guard let hours = forecast?.hours else { return nil }
        let now = Date()
        return hours.min(by: { abs($0.forecastTime.timeIntervalSince(now)) < abs($1.forecastTime.timeIntervalSince(now)) })
    }
}
