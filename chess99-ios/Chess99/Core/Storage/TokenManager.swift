import Foundation
import Security

final class TokenManager {
    static let shared = TokenManager()

    private init() {}

    // MARK: - Keychain Operations

    var isLoggedIn: Bool {
        getToken() != nil
    }

    func saveToken(_ token: String) {
        save(key: Keys.authToken, value: token)
    }

    func getToken() -> String? {
        load(key: Keys.authToken)
    }

    func saveUserId(_ id: Int) {
        save(key: Keys.userId, value: String(id))
    }

    func getUserId() -> Int? {
        guard let value = load(key: Keys.userId) else { return nil }
        return Int(value)
    }

    func saveUserName(_ name: String) {
        save(key: Keys.userName, value: name)
    }

    func getUserName() -> String? {
        load(key: Keys.userName)
    }

    func saveUserEmail(_ email: String) {
        save(key: Keys.userEmail, value: email)
    }

    func getUserEmail() -> String? {
        load(key: Keys.userEmail)
    }

    func clearAll() {
        delete(key: Keys.authToken)
        delete(key: Keys.userId)
        delete(key: Keys.userName)
        delete(key: Keys.userEmail)
    }

    // MARK: - Keychain Helpers

    private func save(key: String, value: String) {
        guard let data = value.data(using: .utf8) else { return }

        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Keys.service,
        ]

        // Delete existing item first
        SecItemDelete(query as CFDictionary)

        var newItem = query
        newItem[kSecValueData as String] = data
        newItem[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly

        SecItemAdd(newItem as CFDictionary, nil)
    }

    private func load(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Keys.service,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrAccount as String: key,
            kSecAttrService as String: Keys.service,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private enum Keys {
        static let service = "com.chess99.app"
        static let authToken = "auth_token"
        static let userId = "user_id"
        static let userName = "user_name"
        static let userEmail = "user_email"
    }
}
