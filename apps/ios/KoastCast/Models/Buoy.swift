import Foundation

struct BuoyObservation: Decodable {
    let stationId: String?
    let observedAt: Date?
    let wvht: Double?   // significant wave height (m)
    let dpd: Double?    // dominant period (s)
    let mwd: Double?    // mean wave direction (deg)
    let wspd: Double?   // wind speed (m/s)
    let wdir: Double?   // wind direction (deg)
    let wtmp: Double?   // water temp (C)
    let atmp: Double?   // air temp (C)
}
