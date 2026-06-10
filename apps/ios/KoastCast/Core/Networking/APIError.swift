import Foundation

enum APIError: LocalizedError {
    case badURL
    case http(status: Int)
    case decoding(Error)
    case transport(Error)
    case offline

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid request."
        case .http(let status): return "Server error (\(status))."
        case .decoding: return "Could not read the forecast data."
        case .transport: return "Network problem — check your connection."
        case .offline: return "KoastCast is offline. The forecast server may be sleeping."
        }
    }
}
