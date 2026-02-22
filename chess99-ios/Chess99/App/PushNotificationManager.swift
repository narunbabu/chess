import Foundation
import UserNotifications

final class PushNotificationManager: NSObject, UNUserNotificationCenterDelegate {
    static let shared = PushNotificationManager()

    private override init() {
        super.init()
        UNUserNotificationCenter.current().delegate = self
    }

    func requestPermission() {
        UNUserNotificationCenter.current().requestAuthorization(
            options: [.alert, .badge, .sound]
        ) { granted, error in
            if granted {
                DispatchQueue.main.async {
                    // UIApplication.shared.registerForRemoteNotifications()
                    // Uncomment when FCM is configured
                }
            }
            if let error = error {
                print("Push notification permission error: \(error)")
            }
        }
    }

    func registerDeviceToken(_ deviceToken: Data) {
        let token = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()

        guard TokenManager.shared.isLoggedIn else { return }

        Task {
            let body: [String: String] = [
                "device_token": token,
                "platform": "ios",
                "device_name": await UIDevice.current.name,
            ]

            do {
                let _: [String: Any] = try await APIClient.shared.post(
                    path: "devices/register",
                    body: body
                )
            } catch {
                print("Failed to register device token: \(error)")
            }
        }
    }

    // MARK: - UNUserNotificationCenterDelegate

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // Show notifications even when app is in foreground
        completionHandler([.banner, .badge, .sound])
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        let userInfo = response.notification.request.content.userInfo

        if let type = userInfo["type"] as? String {
            switch type {
            case "game_move":
                // TODO: Deep link to game
                break
            case "invitation":
                // TODO: Deep link to invitation
                break
            case "tournament":
                // TODO: Deep link to tournament
                break
            default:
                break
            }
        }

        completionHandler()
    }
}

// Make Dictionary conform to Decodable for generic API responses
extension Dictionary: @retroactive Decodable where Key == String, Value == Any {
    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        let data = try container.decode([String: AnyCodable].self)
        self = data.mapValues { $0.value }
    }
}

private struct AnyCodable: Decodable {
    let value: Any

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let string = try? container.decode(String.self) {
            value = string
        } else if let int = try? container.decode(Int.self) {
            value = int
        } else if let bool = try? container.decode(Bool.self) {
            value = bool
        } else if let double = try? container.decode(Double.self) {
            value = double
        } else {
            value = ""
        }
    }
}
