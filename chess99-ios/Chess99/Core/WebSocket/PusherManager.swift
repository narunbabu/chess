import Foundation

/// WebSocket connection manager using native URLSession WebSocket.
/// For production, replace with PusherSwift library for full Pusher protocol compatibility.
///
/// Connection config (matching web frontend echoSingleton.js):
/// - Auth endpoint: {BACKEND_URL}/api/v1/websocket/broadcasting/auth
/// - Auth header: Authorization: Bearer {sanctum_token}
/// - Activity timeout: 120s
/// - Pong timeout: 30s
///
/// Channels:
/// - private-game.{gameId} — game events
/// - private-App.Models.User.{userId} — user events (draw, invitation)
/// - presence-presence.lobby — lobby presence
/// - presence-presence.online — online users
actor PusherManager {
    static let shared = PusherManager()

    enum ConnectionState {
        case disconnected
        case connecting
        case connected
        case reconnecting
    }

    private(set) var state: ConnectionState = .disconnected
    private var subscribedChannels: Set<String> = []
    private var reconnectAttempts = 0
    private let maxReconnectAttempts = 5

    /// Event handler closures keyed by "channel:event"
    private var eventHandlers: [String: [(Any) -> Void]] = [:]

    func connect() {
        guard state == .disconnected || state == .reconnecting else { return }
        state = .connecting

        // NOTE: Full Pusher protocol implementation requires PusherSwift library.
        // This is a placeholder for the architecture. In the real app:
        // 1. Add PusherSwift via SPM
        // 2. Configure with AppConfiguration.wsHost, wsPort, wsKey
        // 3. Set authorizer to call /api/v1/websocket/broadcasting/auth with Bearer token
        // 4. Handle connection lifecycle events

        print("[PusherManager] Connecting to \(AppConfiguration.wsHost):\(AppConfiguration.wsPort)")
        state = .connected
        reconnectAttempts = 0
    }

    func disconnect() {
        subscribedChannels.removeAll()
        eventHandlers.removeAll()
        state = .disconnected
        reconnectAttempts = 0
    }

    func subscribeToGameChannel(gameId: Int) {
        let channel = "private-game.\(gameId)"
        guard !subscribedChannels.contains(channel) else { return }
        subscribedChannels.insert(channel)
        print("[PusherManager] Subscribed to \(channel)")
    }

    func subscribeToUserChannel(userId: Int) {
        let channel = "private-App.Models.User.\(userId)"
        guard !subscribedChannels.contains(channel) else { return }
        subscribedChannels.insert(channel)
        print("[PusherManager] Subscribed to \(channel)")
    }

    func subscribeToLobby() {
        let channel = "presence-presence.lobby"
        guard !subscribedChannels.contains(channel) else { return }
        subscribedChannels.insert(channel)
        print("[PusherManager] Subscribed to \(channel)")
    }

    func unsubscribe(channel: String) {
        subscribedChannels.remove(channel)
        eventHandlers = eventHandlers.filter { !$0.key.hasPrefix("\(channel):") }
        print("[PusherManager] Unsubscribed from \(channel)")
    }

    func on(channel: String, event: String, handler: @escaping (Any) -> Void) {
        let key = "\(channel):\(event)"
        eventHandlers[key, default: []].append(handler)
    }

    /// Reconnect with exponential backoff
    func reconnect() async {
        guard reconnectAttempts < maxReconnectAttempts else {
            print("[PusherManager] Max reconnection attempts reached, switching to HTTP polling")
            state = .disconnected
            return
        }

        state = .reconnecting
        let delay = pow(2.0, Double(reconnectAttempts))
        reconnectAttempts += 1

        print("[PusherManager] Reconnecting in \(delay)s (attempt \(reconnectAttempts)/\(maxReconnectAttempts))")
        try? await Task.sleep(nanoseconds: UInt64(delay * 1_000_000_000))
        connect()
    }

    var isConnected: Bool {
        state == .connected
    }
}
