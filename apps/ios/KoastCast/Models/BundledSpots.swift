import Foundation

/// Loads the bundled global spot catalog (data/spots.json copied into the app).
/// Used as the offline fallback so every spot is available even without the NUC.
enum BundledSpots {
    static let all: [Spot] = load()

    private static func load() -> [Spot] {
        guard let url = Bundle.main.url(forResource: "spots", withExtension: "json"),
              let data = try? Data(contentsOf: url) else {
            return SampleData.spots
        }
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        let spots = (try? decoder.decode([Spot].self, from: data)) ?? []
        return spots.isEmpty ? SampleData.spots : spots
    }
}
