import Foundation

/// Thin async networking layer over the NUC FastAPI backend.
/// Decodes snake_case JSON into camelCase Swift models.
actor APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder

    init() {
        let cfg = URLSessionConfiguration.default
        cfg.timeoutIntervalForRequest = APIConfig.requestTimeout
        cfg.waitsForConnectivity = false
        session = URLSession(configuration: cfg)

        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        decoder.dateDecodingStrategy = .custom { d in
            let c = try d.singleValueContainer()
            let s = try c.decode(String.self)
            if let date = ISO8601DateFormatter.koast.date(from: s) { return date }
            // Fallback: fractional seconds
            let alt = ISO8601DateFormatter()
            alt.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
            if let date = alt.date(from: s) { return date }
            throw DecodingError.dataCorruptedError(in: c, debugDescription: "Bad date: \(s)")
        }
    }

    // MARK: Endpoints

    func spots() async throws -> [Spot] {
        try await get("/spots", as: SpotsEnvelope.self).spots
    }

    func forecast(spotID: String, days: Int = 7, ensemble: Bool = false) async throws -> ForecastResponse {
        try await get("/forecast/\(spotID)", query: [
            "days": String(days),
            "ensemble": ensemble ? "true" : "false",
        ], as: ForecastResponse.self)
    }

    func buoyLive(stationID: String) async throws -> BuoyObservation {
        try await get("/buoys/\(stationID)/live", as: BuoyObservation.self)
    }

    // MARK: Core request

    private func get<T: Decodable>(_ path: String,
                                   query: [String: String] = [:],
                                   as type: T.Type) async throws -> T {
        var comps = URLComponents(
            url: APIConfig.baseURL.appendingPathComponent(APIConfig.apiPrefix + path),
            resolvingAgainstBaseURL: false
        )
        if !query.isEmpty {
            comps?.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = comps?.url else { throw APIError.badURL }

        var req = URLRequest(url: url)
        req.httpMethod = "GET"
        if let secret = APIConfig.apiSecret {
            req.setValue(secret, forHTTPHeaderField: "x-api-secret")
        }

        do {
            let (data, response) = try await session.data(for: req)
            guard let http = response as? HTTPURLResponse else { throw APIError.offline }
            guard (200..<300).contains(http.statusCode) else {
                throw APIError.http(status: http.statusCode)
            }
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.transport(error)
        }
    }
}

private struct SpotsEnvelope: Decodable {
    let spots: [Spot]

    init(from decoder: Decoder) throws {
        // Tolerate either {"spots": [...]} or a bare [...] top-level array.
        if let single = try? decoder.singleValueContainer(),
           let arr = try? single.decode([Spot].self) {
            spots = arr
            return
        }
        let c = try decoder.container(keyedBy: CodingKeys.self)
        spots = (try? c.decode([Spot].self, forKey: .spots)) ?? []
    }
    enum CodingKeys: String, CodingKey { case spots }
}

extension ISO8601DateFormatter {
    static let koast: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime]
        return f
    }()
}
