import SwiftUI

@main
struct Chess99App: App {
    @StateObject private var appState = AppState()

    init() {
        // Configure push notifications on launch
        PushNotificationManager.shared.requestPermission()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
        }
    }
}

@MainActor
class AppState: ObservableObject {
    @Published var isAuthenticated: Bool = false
    @Published var currentUser: User?

    init() {
        isAuthenticated = TokenManager.shared.isLoggedIn
    }

    func logout() {
        TokenManager.shared.clearAll()
        isAuthenticated = false
        currentUser = nil
    }
}
