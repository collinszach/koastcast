import Foundation
import CoreLocation

/// A surf spot. Tolerant decoding — backend fields vary; everything optional but id/name/slug.
struct Spot: Identifiable, Decodable, Hashable {
    let id: String
    let name: String
    let slug: String
    let region: String?
    let country: String?
    let breakType: String?
    let lat: Double?
    let lng: Double?
    let nearestBuoyId: String?

    // Current snapshot (when the list endpoint includes it)
    let qualityScore: Double?
    let waveHeightM: Double?
    let wavePeriodS: Double?

    var coordinate: CLLocationCoordinate2D? {
        guard let lat, let lng else { return nil }
        return CLLocationCoordinate2D(latitude: lat, longitude: lng)
    }

    // NOTE: decoder uses .convertFromSnakeCase, so keys are already camelCase here.
    enum CodingKeys: String, CodingKey {
        case id, name, slug, region, country
        case breakType
        case lat, lng, latitude, longitude
        case nearestBuoyId
        case qualityScore
        case waveHeightM
        case wavePeriodS
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // id may be int or string
        if let s = try? c.decode(String.self, forKey: .id) {
            id = s
        } else if let i = try? c.decode(Int.self, forKey: .id) {
            id = String(i)
        } else {
            id = (try? c.decode(String.self, forKey: .slug)) ?? UUID().uuidString
        }
        name = (try? c.decode(String.self, forKey: .name)) ?? "Unknown"
        slug = (try? c.decode(String.self, forKey: .slug)) ?? name.lowercased()
        region = try? c.decode(String.self, forKey: .region)
        country = try? c.decode(String.self, forKey: .country)
        breakType = try? c.decode(String.self, forKey: .breakType)
        lat = (try? c.decode(Double.self, forKey: .lat)) ?? (try? c.decode(Double.self, forKey: .latitude))
        lng = (try? c.decode(Double.self, forKey: .lng)) ?? (try? c.decode(Double.self, forKey: .longitude))
        nearestBuoyId = try? c.decode(String.self, forKey: .nearestBuoyId)
        qualityScore = try? c.decode(Double.self, forKey: .qualityScore)
        waveHeightM = try? c.decode(Double.self, forKey: .waveHeightM)
        wavePeriodS = try? c.decode(Double.self, forKey: .wavePeriodS)
    }

    // Memberwise init for samples
    init(id: String, name: String, slug: String, region: String?, breakType: String?,
         lat: Double?, lng: Double?, nearestBuoyId: String?,
         qualityScore: Double?, waveHeightM: Double?, wavePeriodS: Double?,
         country: String? = "US") {
        self.id = id; self.name = name; self.slug = slug; self.region = region
        self.country = country
        self.breakType = breakType; self.lat = lat; self.lng = lng
        self.nearestBuoyId = nearestBuoyId; self.qualityScore = qualityScore
        self.waveHeightM = waveHeightM; self.wavePeriodS = wavePeriodS
    }
}
