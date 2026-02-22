import Foundation

struct AuthResponse: Codable {
    let status: String
    let token: String?
    let user: User?
    let message: String?
}

struct AuthResult {
    let token: String
    let user: User
}

struct MessageResponse: Codable {
    let status: String
    let message: String
}

struct RevokeAllResponse: Codable {
    let status: String
    let message: String
    let tokensRevoked: Int

    enum CodingKeys: String, CodingKey {
        case status, message
        case tokensRevoked = "tokens_revoked"
    }
}

struct HealthResponse: Codable {
    let status: String
    let apiVersion: String
    let minSupportedAppVersion: [String: String]
    let features: [String: Bool]
    let serverTime: String

    enum CodingKeys: String, CodingKey {
        case status, features
        case apiVersion = "api_version"
        case minSupportedAppVersion = "min_supported_app_version"
        case serverTime = "server_time"
    }
}
