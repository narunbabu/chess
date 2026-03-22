package com.chess99.presentation.common

import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.WebSocketApi
import com.chess99.data.websocket.PusherManager
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import com.pusher.client.channel.PrivateChannelEventListener
import com.pusher.client.channel.PusherEvent
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class InvitationData(
    val id: String,
    val type: String, // "invitation", "new_game_request", "resume_request", "match_request", "championship_resume"
    val inviterName: String,
    val inviterRating: Int?,
    val inviterAvatarUrl: String?,
    val gameId: Int?,
    val matchId: Int?,
    val championshipId: Int?,
    val colorPreference: String?,
    val timeControlMinutes: Int?,
    val incrementSeconds: Int?,
    val gameMode: String?,
    val message: String?,
    val expiresAt: String?,
    val token: String?,
)

@HiltViewModel
class GlobalInvitationViewModel @Inject constructor(
    private val matchmakingApi: MatchmakingApi,
    private val webSocketApi: WebSocketApi,
    private val pusherManager: PusherManager,
) : ViewModel() {

    private val _currentInvitation = MutableStateFlow<InvitationData?>(null)
    val currentInvitation: StateFlow<InvitationData?> = _currentInvitation.asStateFlow()

    private val _isProcessing = MutableStateFlow(false)
    val isProcessing: StateFlow<Boolean> = _isProcessing.asStateFlow()

    private val _isInActiveGame = MutableStateFlow(false)

    fun setInActiveGame(inGame: Boolean) {
        _isInActiveGame.value = inGame
    }

    fun setupListeners(userId: Int) {
        val channelName = "private-App.Models.User.$userId"
        val channel = pusherManager.subscribeToPrivateChannel(channelName) ?: run {
            Timber.w("Failed to subscribe to $channelName for invitations")
            return
        }

        val listener = object : PrivateChannelEventListener {
            override fun onEvent(event: PusherEvent) {
                if (_isInActiveGame.value) return
                val eventName = event.eventName ?: return
                val data = try {
                    JsonParser.parseString(event.data).asJsonObject
                } catch (e: Exception) {
                    Timber.w(e, "Failed to parse invitation event data")
                    return
                }
                handleEvent(eventName, data)
            }

            override fun onAuthenticationFailure(message: String?, e: Exception?) {
                Timber.e(e, "Auth failure on invitation channel: $message")
            }

            override fun onSubscriptionSucceeded(channelName: String?) {
                Timber.d("Subscribed to invitation channel: $channelName")
            }
        }

        // Bind invitation events
        val events = listOf(
            "invitation.sent",
            "new_game.request",
            "resume.request.sent",
            "match.request.received",
            "championship.game.resume.request",
            // Cleanup events
            "invitation.accepted", "invitation.declined", "invitation.cancelled",
            "resume.request.expired", "resume.request.response",
            "match.request.cancelled",
            "championship.game.resume.accepted", "championship.game.resume.declined",
        )
        for (event in events) {
            channel.bind(event, listener)
        }
    }

    private fun handleEvent(eventName: String, data: JsonObject) {
        when (eventName) {
            "invitation.sent" -> {
                val invitation = data.getAsJsonObject("invitation") ?: return
                _currentInvitation.value = InvitationData(
                    id = invitation.get("id")?.asString ?: return,
                    type = "invitation",
                    inviterName = invitation.getAsJsonObject("inviter")?.get("name")?.asString ?: "Unknown",
                    inviterRating = invitation.getAsJsonObject("inviter")?.get("rating")?.asInt,
                    inviterAvatarUrl = invitation.getAsJsonObject("inviter")?.get("avatar_url")?.asString,
                    gameId = null,
                    matchId = null,
                    championshipId = null,
                    colorPreference = invitation.get("inviter_preferred_color")?.asString,
                    timeControlMinutes = invitation.getAsJsonObject("metadata")?.get("time_control_minutes")?.asInt,
                    incrementSeconds = invitation.getAsJsonObject("metadata")?.get("increment_seconds")?.asInt,
                    gameMode = invitation.getAsJsonObject("metadata")?.get("game_mode")?.asString,
                    message = null,
                    expiresAt = null,
                    token = null,
                )
            }

            "new_game.request" -> {
                val requestingUser = data.getAsJsonObject("requesting_user")
                val newGameId = data.get("new_game_id")?.asInt ?: return
                _currentInvitation.value = InvitationData(
                    id = "new_game_$newGameId",
                    type = "new_game_request",
                    inviterName = requestingUser?.get("name")?.asString ?: "Unknown",
                    inviterRating = requestingUser?.get("rating")?.asInt,
                    inviterAvatarUrl = requestingUser?.get("avatar_url")?.asString,
                    gameId = newGameId,
                    matchId = null,
                    championshipId = null,
                    colorPreference = data.get("color_preference")?.asString,
                    timeControlMinutes = null,
                    incrementSeconds = null,
                    gameMode = null,
                    message = data.get("message")?.asString,
                    expiresAt = null,
                    token = null,
                )
            }

            "resume.request.sent" -> {
                val gameId = data.get("game_id")?.asInt ?: return
                val requestingUser = data.getAsJsonObject("requesting_user")
                _currentInvitation.value = InvitationData(
                    id = "resume_$gameId",
                    type = "resume_request",
                    inviterName = requestingUser?.get("name")?.asString ?: "Unknown",
                    inviterRating = null,
                    inviterAvatarUrl = null,
                    gameId = gameId,
                    matchId = null,
                    championshipId = null,
                    colorPreference = null,
                    timeControlMinutes = null,
                    incrementSeconds = null,
                    gameMode = null,
                    message = null,
                    expiresAt = data.get("expires_at")?.asString,
                    token = null,
                )
            }

            "match.request.received" -> {
                val matchRequest = data.getAsJsonObject("match_request") ?: return
                val requester = matchRequest.getAsJsonObject("requester")
                _currentInvitation.value = InvitationData(
                    id = "match_${matchRequest.get("token")?.asString}",
                    type = "match_request",
                    inviterName = requester?.get("name")?.asString ?: "Unknown",
                    inviterRating = requester?.get("rating")?.asInt,
                    inviterAvatarUrl = requester?.get("avatar_url")?.asString,
                    gameId = null,
                    matchId = null,
                    championshipId = null,
                    colorPreference = null,
                    timeControlMinutes = matchRequest.get("time_control_minutes")?.asInt,
                    incrementSeconds = matchRequest.get("increment_seconds")?.asInt,
                    gameMode = matchRequest.get("game_mode")?.asString,
                    message = null,
                    expiresAt = matchRequest.get("expires_at")?.asString,
                    token = matchRequest.get("token")?.asString,
                )
            }

            "championship.game.resume.request" -> {
                val matchId = data.get("match_id")?.asInt ?: return
                val requester = data.getAsJsonObject("requester")
                _currentInvitation.value = InvitationData(
                    id = "champ_resume_$matchId",
                    type = "championship_resume",
                    inviterName = requester?.get("name")?.asString ?: "Unknown",
                    inviterRating = null,
                    inviterAvatarUrl = requester?.get("avatar_url")?.asString,
                    gameId = data.get("game_id")?.asInt,
                    matchId = matchId,
                    championshipId = data.get("championship_id")?.asInt,
                    colorPreference = null,
                    timeControlMinutes = null,
                    incrementSeconds = null,
                    gameMode = null,
                    message = null,
                    expiresAt = data.get("expires_at")?.asString,
                    token = null,
                )
            }

            // Cleanup events
            "invitation.accepted", "invitation.declined", "invitation.cancelled",
            "resume.request.expired", "resume.request.response",
            "match.request.cancelled",
            "championship.game.resume.accepted", "championship.game.resume.declined" -> {
                _currentInvitation.value = null
            }
        }
    }

    fun acceptInvitation(onNavigateToGame: (Int) -> Unit) {
        val invitation = _currentInvitation.value ?: return
        if (_isProcessing.value) return
        _isProcessing.value = true

        viewModelScope.launch {
            try {
                when (invitation.type) {
                    "new_game_request" -> {
                        val gameId = invitation.gameId ?: return@launch
                        _currentInvitation.value = null
                        onNavigateToGame(gameId)
                    }

                    "invitation" -> {
                        val id = invitation.id.toIntOrNull() ?: return@launch
                        val response = matchmakingApi.acceptInvitation(id)
                        if (response.isSuccessful) {
                            val gameId = response.body()?.getAsJsonObject("game")?.get("id")?.asInt
                            _currentInvitation.value = null
                            if (gameId != null) onNavigateToGame(gameId)
                        }
                    }

                    "resume_request" -> {
                        val gameId = invitation.gameId ?: return@launch
                        val body = JsonObject().apply { addProperty("response", true) }
                        webSocketApi.respondToResume(gameId, body)
                        _currentInvitation.value = null
                        onNavigateToGame(gameId)
                    }

                    "match_request" -> {
                        val token = invitation.token ?: return@launch
                        val body = JsonObject().apply { addProperty("token", token) }
                        val response = matchmakingApi.acceptMatchRequest(body)
                        if (response.isSuccessful) {
                            val gameId = response.body()?.getAsJsonObject("game")?.get("id")?.asInt
                            _currentInvitation.value = null
                            if (gameId != null) onNavigateToGame(gameId)
                        }
                    }

                    "championship_resume" -> {
                        val gameId = invitation.gameId ?: return@launch
                        val body = JsonObject().apply { addProperty("response", true) }
                        webSocketApi.respondToResume(gameId, body)
                        _currentInvitation.value = null
                        onNavigateToGame(gameId)
                    }
                }
            } catch (e: Exception) {
                // Silently handle - user can retry
            } finally {
                _isProcessing.value = false
            }
        }
    }

    fun declineInvitation() {
        val invitation = _currentInvitation.value ?: return
        if (_isProcessing.value) return
        _isProcessing.value = true

        viewModelScope.launch {
            try {
                when (invitation.type) {
                    "new_game_request" -> {
                        // No API call needed - just dismiss
                    }

                    "invitation" -> {
                        val id = invitation.id.toIntOrNull() ?: return@launch
                        matchmakingApi.declineInvitation(id)
                    }

                    "resume_request" -> {
                        val gameId = invitation.gameId ?: return@launch
                        val body = JsonObject().apply { addProperty("response", false) }
                        webSocketApi.respondToResume(gameId, body)
                    }

                    "match_request" -> {
                        val token = invitation.token ?: return@launch
                        val body = JsonObject().apply { addProperty("token", token) }
                        matchmakingApi.declineMatchRequest(body)
                    }

                    "championship_resume" -> {
                        val gameId = invitation.gameId ?: return@launch
                        val body = JsonObject().apply { addProperty("response", false) }
                        webSocketApi.respondToResume(gameId, body)
                    }
                }
            } catch (_: Exception) {
                // Silently handle
            } finally {
                _currentInvitation.value = null
                _isProcessing.value = false
            }
        }
    }
}

/**
 * Composable that renders the global invitation dialog overlay.
 * Place this in MainActivity's root composable so it appears above all screens.
 */
@Composable
fun GlobalInvitationOverlay(
    viewModel: GlobalInvitationViewModel,
    onNavigateToGame: (Int) -> Unit,
) {
    val invitation by viewModel.currentInvitation.collectAsState()
    val isProcessing by viewModel.isProcessing.collectAsState()

    val inv = invitation ?: return

    GlobalInvitationDialog(
        invitation = inv,
        isProcessing = isProcessing,
        onAccept = { viewModel.acceptInvitation(onNavigateToGame) },
        onDecline = { viewModel.declineInvitation() },
    )
}
