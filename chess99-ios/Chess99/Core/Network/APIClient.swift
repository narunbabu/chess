import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case unauthorized
    case forbidden
    case notFound
    case validationError(String)
    case rateLimited
    case serverError(String)
    case networkError(Error)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL: return "Invalid URL"
        case .unauthorized: return "Authentication required"
        case .forbidden: return "Access denied"
        case .notFound: return "Resource not found"
        case .validationError(let msg): return msg
        case .rateLimited: return "Too many requests. Please wait."
        case .serverError(let msg): return msg
        case .networkError(let error): return error.localizedDescription
        case .decodingError(let error): return "Data format error: \(error.localizedDescription)"
        }
    }
}

final class APIClient {
    static let shared = APIClient()

    private let session: URLSession
    private let decoder: JSONDecoder
    private let encoder: JSONEncoder

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = 30
        config.timeoutIntervalForResource = 60
        session = URLSession(configuration: config)

        decoder = JSONDecoder()
        encoder = JSONEncoder()
    }

    // MARK: - Generic Request

    func request<T: Decodable>(
        path: String,
        method: String = "GET",
        body: (any Encodable)? = nil,
        requiresAuth: Bool = true
    ) async throws -> T {
        guard let url = URL(string: AppConfiguration.apiBaseURL + path) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if requiresAuth, let token = TokenManager.shared.getToken() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body = body {
            request.httpBody = try encoder.encode(AnyEncodable(body))
        }

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.networkError(URLError(.badServerResponse))
        }

        switch httpResponse.statusCode {
        case 200...299:
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        case 401:
            throw APIError.unauthorized
        case 403:
            throw APIError.forbidden
        case 404:
            throw APIError.notFound
        case 422:
            let errorBody = String(data: data, encoding: .utf8) ?? "Validation error"
            throw APIError.validationError(errorBody)
        case 429:
            throw APIError.rateLimited
        default:
            let errorBody = String(data: data, encoding: .utf8) ?? "Server error"
            throw APIError.serverError(errorBody)
        }
    }

    // MARK: - Convenience Methods

    func get<T: Decodable>(path: String, requiresAuth: Bool = true) async throws -> T {
        try await request(path: path, method: "GET", requiresAuth: requiresAuth)
    }

    func post<T: Decodable>(path: String, body: (any Encodable)? = nil, requiresAuth: Bool = true) async throws -> T {
        try await request(path: path, method: "POST", body: body, requiresAuth: requiresAuth)
    }

    func put<T: Decodable>(path: String, body: (any Encodable)? = nil) async throws -> T {
        try await request(path: path, method: "PUT", body: body)
    }

    func delete<T: Decodable>(path: String) async throws -> T {
        try await request(path: path, method: "DELETE")
    }
}

// MARK: - Type-erased Encodable wrapper

private struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void

    init(_ value: any Encodable) {
        encodeClosure = { encoder in
            try value.encode(to: encoder)
        }
    }

    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}
