import Foundation

struct ForecastResponse: Decodable {
    let spotId: String
    let spotSlug: String
    let generatedAt: Date?
    let hours: [ForecastHour]
    let daysAvailable: Int?
    let ensembleMode: Bool?
    let trustSummary: TrustSummary?
}

struct ForecastHour: Decodable, Identifiable {
    var id: Date { forecastTime }

    let forecastTime: Date
    let modelSource: String?

    let waveHeightM: Double?
    let waveHeightFaceM: Double?
    let wavePeriodS: Double?
    let waveDirection: Double?
    let swellDirection: Double?

    let windSpeedMs: Double?
    let windDirection: Double?
    let windGustMs: Double?

    let tideHeightM: Double?
    let tideState: String?

    let qualityScore: Double?
    let confidence: Double?
    let crowdScore: Double?
    let crowdLabel: String?

    let modelAgreement: Double?
    let isNowcast: Bool?

    // Trust Score
    let trustScore: Double?
    let trustLabel: String?
    let trustFactors: [String: Double]?
    let trustLimitingFactor: String?
}

struct TrustSummary: Decodable {
    let score: Double?
    let label: String?
    let limitingFactor: String?
}
