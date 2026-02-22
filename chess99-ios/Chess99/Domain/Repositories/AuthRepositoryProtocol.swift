import Foundation

protocol AuthRepositoryProtocol {
    func login(email: String, password: String) async throws -> AuthResult
    func register(name: String, email: String, password: String, passwordConfirmation: String) async throws -> AuthResult
    func googleMobileLogin(idToken: String) async throws -> AuthResult
    func appleMobileLogin(identityToken: String, authorizationCode: String?, userName: String?, userEmail: String?) async throws -> AuthResult
    func refreshToken(deviceName: String?) async throws -> AuthResult
    func revokeAllTokens() async throws -> Int
    func logout() async throws
    func getCurrentUser() async throws -> User
    var isLoggedIn: Bool { get }
    func clearSession()
}
