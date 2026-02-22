import Foundation

enum AppConfiguration {
    #if DEBUG
    static let apiBaseURL = "http://localhost:8000/api/v1/"
    static let wsHost = "localhost"
    static let wsPort = 8080
    static let wsKey = "anrdh24nppf3obfupvqw"
    static let wsUseTLS = false
    #else
    static let apiBaseURL = "https://chess99.com/api/v1/"
    static let wsHost = "chess99.com"
    static let wsPort = 443
    static let wsKey = "" // Set from environment
    static let wsUseTLS = true
    #endif

    static let appVersion = Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0.0"
    static let buildNumber = Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "1"
    static let minApiVersion = "v1"
}
