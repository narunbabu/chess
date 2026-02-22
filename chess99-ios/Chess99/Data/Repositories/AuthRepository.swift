import Foundation

final class AuthRepository: AuthRepositoryProtocol {
    private let api = APIClient.shared
    private let tokenManager = TokenManager.shared

    var isLoggedIn: Bool {
        tokenManager.isLoggedIn
    }

    func login(email: String, password: String) async throws -> AuthResult {
        let body = LoginRequest(email: email, password: password)
        let response: AuthResponse = try await api.post(path: "auth/login", body: body, requiresAuth: false)
        return try processAuthResponse(response)
    }

    func register(name: String, email: String, password: String, passwordConfirmation: String) async throws -> AuthResult {
        let body = RegisterRequest(name: name, email: email, password: password, passwordConfirmation: passwordConfirmation)
        let response: AuthResponse = try await api.post(path: "auth/register", body: body, requiresAuth: false)
        return try processAuthResponse(response)
    }

    func googleMobileLogin(idToken: String) async throws -> AuthResult {
        let body = GoogleLoginRequest(idToken: idToken)
        let response: AuthResponse = try await api.post(path: "auth/google/mobile", body: body, requiresAuth: false)
        return try processAuthResponse(response)
    }

    func appleMobileLogin(identityToken: String, authorizationCode: String?, userName: String?, userEmail: String?) async throws -> AuthResult {
        let body = AppleLoginRequest(
            identityToken: identityToken,
            authorizationCode: authorizationCode,
            userName: userName,
            userEmail: userEmail
        )
        let response: AuthResponse = try await api.post(path: "auth/apple/mobile", body: body, requiresAuth: false)
        return try processAuthResponse(response)
    }

    func refreshToken(deviceName: String? = nil) async throws -> AuthResult {
        let body = RefreshRequest(deviceName: deviceName)
        let response: AuthResponse = try await api.post(path: "auth/refresh", body: body)
        return try processAuthResponse(response)
    }

    func revokeAllTokens() async throws -> Int {
        let response: RevokeAllResponse = try await api.post(path: "auth/revoke-all")
        tokenManager.clearAll()
        return response.tokensRevoked
    }

    func logout() async throws {
        do {
            let _: MessageResponse = try await api.post(path: "auth/logout")
        } catch {
            // Clear local session regardless of server response
        }
        tokenManager.clearAll()
    }

    func getCurrentUser() async throws -> User {
        try await api.get(path: "user")
    }

    func clearSession() {
        tokenManager.clearAll()
    }

    // MARK: - Private

    private func processAuthResponse(_ response: AuthResponse) throws -> AuthResult {
        guard let token = response.token, let user = response.user else {
            throw APIError.serverError(response.message ?? "Invalid auth response")
        }

        tokenManager.saveToken(token)
        tokenManager.saveUserId(user.id)
        tokenManager.saveUserName(user.name)
        tokenManager.saveUserEmail(user.email)

        return AuthResult(token: token, user: user)
    }
}

// MARK: - Request DTOs

private struct LoginRequest: Encodable {
    let email: String
    let password: String
}

private struct RegisterRequest: Encodable {
    let name: String
    let email: String
    let password: String
    let passwordConfirmation: String

    enum CodingKeys: String, CodingKey {
        case name, email, password
        case passwordConfirmation = "password_confirmation"
    }
}

private struct GoogleLoginRequest: Encodable {
    let idToken: String
}

private struct AppleLoginRequest: Encodable {
    let identityToken: String
    let authorizationCode: String?
    let userName: String?
    let userEmail: String?

    enum CodingKeys: String, CodingKey {
        case identityToken = "identity_token"
        case authorizationCode = "authorization_code"
        case userName = "user_name"
        case userEmail = "user_email"
    }
}

private struct RefreshRequest: Encodable {
    let deviceName: String?

    enum CodingKeys: String, CodingKey {
        case deviceName = "device_name"
    }
}
