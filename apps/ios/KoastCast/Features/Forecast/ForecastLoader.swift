import SwiftUI

/// Loads a spot forecast with graceful sample fallback. Reused by Today + Spot Detail.
@Observable
final class ForecastLoader {
    var forecast: ForecastResponse?
    var isLoading = false
    var usingSample = false

    @MainActor
    func load(spot: Spot, days: Int = 7) async {
        isLoading = true
        usingSample = false
        do {
            forecast = try await APIClient.shared.forecast(spotID: spot.slug, days: days)
            if forecast?.hours.isEmpty ?? true {
                forecast = SampleData.forecast(for: spot)
                usingSample = true
            }
        } catch {
            forecast = SampleData.forecast(for: spot)
            usingSample = true
        }
        isLoading = false
    }

    /// The hour closest to now (current conditions).
    var currentHour: ForecastHour? {
        guard let hours = forecast?.hours else { return nil }
        let now = Date()
        return hours.min(by: { abs($0.forecastTime.timeIntervalSince(now)) < abs($1.forecastTime.timeIntervalSince(now)) })
    }
}
