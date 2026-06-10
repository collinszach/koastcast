import Foundation

/// A logged surf session (local model; syncs to backend /sessions when authed).
struct LoggedSession: Identifiable, Codable, Hashable {
    var id: UUID = UUID()
    var spotName: String
    var date: Date
    var waveHeightFt: Double
    var qualityRating: Int      // 1-10
    var crowdRating: Int        // 1-5
    var boardUsed: String?
    var notes: String?
}
