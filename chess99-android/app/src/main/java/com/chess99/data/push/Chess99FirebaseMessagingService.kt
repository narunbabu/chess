package com.chess99.data.push

import com.chess99.data.api.DeviceApi
import com.chess99.data.dto.DeviceTokenRequest
import com.chess99.data.local.TokenManager
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class Chess99FirebaseMessagingService : FirebaseMessagingService() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var deviceApi: DeviceApi

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onNewToken(token: String) {
        super.onNewToken(token)
        Timber.d("FCM token refreshed: ${token.take(20)}...")

        // Register the new token with the backend if user is logged in
        if (tokenManager.isLoggedIn()) {
            scope.launch {
                try {
                    deviceApi.registerDevice(
                        DeviceTokenRequest(
                            deviceToken = token,
                            platform = "android",
                            deviceName = android.os.Build.MODEL,
                        )
                    )
                    Timber.d("FCM token registered with backend")
                } catch (e: Exception) {
                    Timber.e(e, "Failed to register FCM token with backend")
                }
            }
        }
    }

    override fun onMessageReceived(remoteMessage: RemoteMessage) {
        super.onMessageReceived(remoteMessage)
        Timber.d("FCM message received from: ${remoteMessage.from}")

        val data = remoteMessage.data
        val type = data["type"]

        when (type) {
            "game_move" -> handleGameMoveNotification(data)
            "invitation" -> handleInvitationNotification(data)
            "tournament" -> handleTournamentNotification(data)
            else -> handleGenericNotification(remoteMessage)
        }
    }

    private fun handleGameMoveNotification(data: Map<String, String>) {
        val gameId = data["game_id"]
        Timber.d("Your turn notification for game: $gameId")
        // TODO: Show notification with deep link to game
    }

    private fun handleInvitationNotification(data: Map<String, String>) {
        val invitationId = data["invitation_id"]
        Timber.d("Game invitation notification: $invitationId")
        // TODO: Show notification with accept/decline actions
    }

    private fun handleTournamentNotification(data: Map<String, String>) {
        val championshipId = data["championship_id"]
        Timber.d("Tournament notification for: $championshipId")
        // TODO: Show notification with deep link to tournament
    }

    private fun handleGenericNotification(message: RemoteMessage) {
        message.notification?.let { notification ->
            Timber.d("Generic notification: ${notification.title} - ${notification.body}")
            // TODO: Show system notification
        }
    }
}
