import Foundation
import AuthenticationServices

@MainActor
class AuthViewModel: ObservableObject {
    @Published var isLoading = false
    @Published var error: String?

    private let authRepository: AuthRepositoryProtocol

    init(authRepository: AuthRepositoryProtocol = AuthRepository()) {
        self.authRepository = authRepository
    }

    func login(email: String, password: String) async -> AuthResult? {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let result = try await authRepository.login(email: email, password: password)
            return result
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func register(name: String, email: String, password: String, passwordConfirmation: String) async -> AuthResult? {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let result = try await authRepository.register(
                name: name,
                email: email,
                password: password,
                passwordConfirmation: passwordConfirmation
            )
            return result
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func googleSignIn(idToken: String) async -> AuthResult? {
        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let result = try await authRepository.googleMobileLogin(idToken: idToken)
            return result
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func appleSignIn(authorization: ASAuthorization) async -> AuthResult? {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let identityTokenData = credential.identityToken,
              let identityToken = String(data: identityTokenData, encoding: .utf8) else {
            error = "Invalid Apple credential"
            return nil
        }

        let authCode = credential.authorizationCode.flatMap { String(data: $0, encoding: .utf8) }
        let fullName = [credential.fullName?.givenName, credential.fullName?.familyName]
            .compactMap { $0 }
            .joined(separator: " ")
        let userName = fullName.isEmpty ? nil : fullName

        isLoading = true
        error = nil
        defer { isLoading = false }

        do {
            let result = try await authRepository.appleMobileLogin(
                identityToken: identityToken,
                authorizationCode: authCode,
                userName: userName,
                userEmail: credential.email
            )
            return result
        } catch {
            self.error = error.localizedDescription
            return nil
        }
    }

    func logout() async {
        try? await authRepository.logout()
    }

    func clearError() {
        error = nil
    }
}
