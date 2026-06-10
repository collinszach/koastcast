import Foundation

/// Offline / preview fallback so the UI is always populated even if the NUC is asleep.
enum SampleData {
    static let spots: [Spot] = [
        Spot(id: "mavericks-ca", name: "Mavericks", slug: "mavericks-ca", region: "NorCal",
             breakType: "reef", lat: 37.4956, lng: -122.4997, nearestBuoyId: "46012",
             qualityScore: 8.4, waveHeightM: 3.6, wavePeriodS: 16),
        Spot(id: "steamer-lane-ca", name: "Steamer Lane", slug: "steamer-lane-ca", region: "Santa Cruz",
             breakType: "point", lat: 36.9513, lng: -122.0265, nearestBuoyId: "46042",
             qualityScore: 7.1, waveHeightM: 1.8, wavePeriodS: 13),
        Spot(id: "ocean-beach-sf-ca", name: "Ocean Beach SF", slug: "ocean-beach-sf-ca", region: "San Francisco",
             breakType: "beach", lat: 37.7594, lng: -122.5107, nearestBuoyId: "46026",
             qualityScore: 5.2, waveHeightM: 1.5, wavePeriodS: 11),
        Spot(id: "rincon-ca", name: "Rincon", slug: "rincon-ca", region: "Santa Barbara",
             breakType: "point", lat: 34.3742, lng: -119.4762, nearestBuoyId: "46053",
             qualityScore: 6.8, waveHeightM: 1.4, wavePeriodS: 14),
        Spot(id: "lower-trestles-ca", name: "Lower Trestles", slug: "lower-trestles-ca", region: "San Clemente",
             breakType: "point", lat: 33.3850, lng: -117.5930, nearestBuoyId: "46086",
             qualityScore: 6.3, waveHeightM: 1.2, wavePeriodS: 13),
        Spot(id: "pipeline-oahu-hi", name: "Pipeline", slug: "pipeline-oahu-hi", region: "Oahu, HI",
             breakType: "reef", lat: 21.6648, lng: -158.0533, nearestBuoyId: "51201",
             qualityScore: 9.1, waveHeightM: 3.0, wavePeriodS: 15),
        Spot(id: "montauk-ny", name: "Montauk", slug: "montauk-ny", region: "New York",
             breakType: "point", lat: 41.0717, lng: -71.8567, nearestBuoyId: "44017",
             qualityScore: 4.6, waveHeightM: 1.0, wavePeriodS: 9),
        Spot(id: "cape-hatteras-nc", name: "Cape Hatteras", slug: "cape-hatteras-nc", region: "Outer Banks",
             breakType: "beach", lat: 35.2210, lng: -75.6920, nearestBuoyId: "44095",
             qualityScore: 5.9, waveHeightM: 1.3, wavePeriodS: 10),
    ]

    /// A synthetic 7-day hourly forecast with a realistic Trust arc (high near term, decaying out).
    static func forecast(for spot: Spot) -> ForecastResponse {
        let now = Date()
        var hours: [ForecastHour] = []
        for i in 0..<(24 * 7) {
            let t = now.addingTimeInterval(Double(i) * 3600)
            let lead = Double(i)
            let phase = sin(Double(i) / 14.0)
            let face = max(0.4, (spot.waveHeightM ?? 1.5) + phase * 0.6)
            let quality = max(0, min(10, (spot.qualityScore ?? 5) + phase * 1.5))
            let agreement = max(0.2, 0.95 - lead / 250.0)
            let confidence = max(0.3, 0.85 - lead / 400.0)
            let leadFactor = max(0.1, exp(-lead / 240.0))
            let fresh = i < 6 ? 1.0 : max(0.3, 1.0 - Double(i) / 24.0)
            let trust = min(100, max(0, (agreement * 0.3 + confidence * 0.3 + leadFactor * 0.25 + fresh * 0.15) /
                                     (0.3 + 0.3 + 0.25 + 0.15) * 100))
            hours.append(ForecastHour(
                forecastTime: t,
                modelSource: "sample",
                waveHeightM: face,
                waveHeightFaceM: face * 1.3,
                wavePeriodS: spot.wavePeriodS ?? 12,
                waveDirection: 285,
                swellDirection: 285,
                windSpeedMs: 3 + abs(phase) * 4,
                windDirection: 60,
                windGustMs: 6,
                tideHeightM: 1.0 + sin(Double(i) / 6.2) * 0.8,
                tideState: phase > 0 ? "rising" : "falling",
                qualityScore: quality,
                confidence: confidence,
                crowdScore: 0.5,
                crowdLabel: "moderate",
                modelAgreement: agreement,
                isNowcast: i < 6,
                trustScore: trust,
                trustLabel: trustLabel(trust),
                trustFactors: ["agreement": agreement, "confidence": confidence,
                               "lead": leadFactor, "freshness": fresh],
                trustLimitingFactor: [("agreement", agreement), ("confidence", confidence),
                                      ("lead", leadFactor), ("freshness", fresh)]
                    .min(by: { $0.1 < $1.1 })?.0
            ))
        }
        let next24 = Array(hours.prefix(24))
        let avgTrust = next24.compactMap { $0.trustScore }.reduce(0, +) / Double(max(1, next24.count))
        return ForecastResponse(
            spotId: spot.id, spotSlug: spot.slug, generatedAt: now,
            hours: hours, daysAvailable: 7, ensembleMode: false,
            trustSummary: TrustSummary(score: avgTrust, label: trustLabel(avgTrust), limitingFactor: "lead")
        )
    }

    static func trustLabel(_ s: Double) -> String {
        switch s {
        case 80...: return "High"
        case 60..<80: return "Good"
        case 40..<60: return "Moderate"
        case 20..<40: return "Low"
        default: return "Speculative"
        }
    }

    static let sessions: [LoggedSession] = [
        LoggedSession(spotName: "Steamer Lane", date: Date().addingTimeInterval(-86400 * 2),
                      waveHeightFt: 4, qualityRating: 8, crowdRating: 3, boardUsed: "5'10 shortboard",
                      notes: "Clean SW lines, offshore til 10."),
        LoggedSession(spotName: "Ocean Beach SF", date: Date().addingTimeInterval(-86400 * 6),
                      waveHeightFt: 6, qualityRating: 5, crowdRating: 1, boardUsed: "6'2 step-up",
                      notes: "Heavy paddle, worth it on the bigger sets."),
    ]
}
