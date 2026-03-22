package com.chess99.presentation.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.PusherManager
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the lobby screen.
 * Mirrors chess-frontend/src/pages/LobbyPage.js +
 *         chess-frontend/src/components/lobby/MatchmakingQueue.jsx
 */
@HiltViewModel
class LobbyViewModel @Inject constructor(
    private val matchmakingApi: MatchmakingApi,
    private val gameApi: GameApi,
    private val tokenManager: TokenManager,
    private val pusherManager: PusherManager,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null
    private var matchmakingPollJob: Job? = null
    private var matchmakingEntryId: Int? = null
    private var findPlayersToken: String? = null

    init {
        loadLobbyData()
        startPolling()
        ensureWebSocketConnected()
    }

    // ── Load Data ───────────────────────────────────────────────────────

    private fun loadLobbyData() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // Load in parallel
                launch { loadOnlinePlayers() }
                launch { loadPendingInvitations() }
                launch { loadSentInvitations() }
                launch { loadActiveGames() }
                launch { loadFriends() }
                launch { loadOnlineCount() }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load lobby data")
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    private suspend fun loadOnlinePlayers() {
        try {
            val response = matchmakingApi.getLobbyPlayers()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val players = body.getAsJsonArray("players")?.map { el ->
                    val p = el.asJsonObject
                    LobbyPlayer(
                        id = p.get("id")?.asInt ?: 0,
                        name = p.get("name")?.asString ?: "",
                        rating = p.get("rating")?.asInt ?: 1200,
                        isOnline = true,
                        avatarUrl = p.get("avatar_url")?.asString,
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(onlinePlayers = players)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load online players")
        }
    }

    private suspend fun loadPendingInvitations() {
        try {
            val response = matchmakingApi.getPendingInvitations()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val invitations = body.getAsJsonArray("invitations")?.map { el ->
                    parseInvitation(el.asJsonObject)
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(pendingInvitations = invitations)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load pending invitations")
        }
    }

    private suspend fun loadSentInvitations() {
        try {
            val response = matchmakingApi.getSentInvitations()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val invitations = body.getAsJsonArray("invitations")?.map { el ->
                    parseInvitation(el.asJsonObject)
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(sentInvitations = invitations)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load sent invitations")
        }
    }

    private suspend fun loadActiveGames() {
        try {
            val response = gameApi.getActiveGames()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val games = body.getAsJsonArray("games")?.map { el ->
                    val g = el.asJsonObject
                    ActiveGame(
                        id = g.get("id")?.asInt ?: 0,
                        opponentName = g.get("opponent_name")?.asString ?: "Unknown",
                        status = g.get("status")?.asString ?: "active",
                        timeControl = g.get("time_control")?.asString ?: "10|0",
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(activeGames = games)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load active games")
        }
    }

    private suspend fun loadFriends() {
        try {
            val response = matchmakingApi.getFriends()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val friends = body.getAsJsonArray("friends")?.map { el ->
                    val f = el.asJsonObject
                    LobbyPlayer(
                        id = f.get("id")?.asInt ?: 0,
                        name = f.get("name")?.asString ?: "",
                        rating = f.get("rating")?.asInt ?: 1200,
                        isOnline = f.get("is_online")?.asBoolean ?: false,
                        avatarUrl = f.get("avatar_url")?.asString,
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(friends = friends)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load friends")
        }
    }

    private suspend fun loadOnlineCount() {
        try {
            val response = matchmakingApi.getOnlineCount()
            if (response.isSuccessful) {
                val count = response.body()?.get("count")?.asInt ?: 0
                _uiState.value = _uiState.value.copy(onlineCount = count)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load online count")
        }
    }

    // ── Polling ─────────────────────────────────────────────────────────

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = viewModelScope.launch {
            while (isActive) {
                delay(10_000) // 10 second interval
                loadLobbyData()
            }
        }
    }

    // ── WebSocket ───────────────────────────────────────────────────────

    private fun ensureWebSocketConnected() {
        if (!pusherManager.isConnected()) {
            pusherManager.connect()
        }
    }

    // ── Tab Selection ───────────────────────────────────────────────────

    fun selectTab(tab: LobbyTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    // ── Matchmaking ─────────────────────────────────────────────────────

    fun startMatchmaking(timeControl: String, colorPref: String, gameMode: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                matchmakingState = MatchmakingState.SEARCHING,
                matchmakingTimeControl = timeControl,
            )

            try {
                // Phase 1: Smart Match (15s)
                val findBody = JsonObject().apply {
                    addProperty("time_control", timeControl)
                    addProperty("color_preference", colorPref)
                    addProperty("game_mode", gameMode)
                }
                val findResponse = matchmakingApi.findPlayers(findBody)
                if (findResponse.isSuccessful) {
                    val data = findResponse.body()
                    findPlayersToken = data?.get("token")?.asString

                    // Poll for match
                    startMatchmakingPoll(timeControl, colorPref, gameMode)
                } else {
                    // Fall back to queue
                    joinMatchmakingQueue(timeControl, colorPref, gameMode)
                }
            } catch (e: Exception) {
                Timber.e(e, "Matchmaking error")
                joinMatchmakingQueue(timeControl, colorPref, gameMode)
            }
        }
    }

    private suspend fun joinMatchmakingQueue(timeControl: String, colorPref: String, gameMode: String) {
        try {
            val body = JsonObject().apply {
                addProperty("time_control", timeControl)
                addProperty("color_preference", colorPref)
                addProperty("game_mode", gameMode)
            }
            val response = matchmakingApi.joinQueue(body)
            if (response.isSuccessful) {
                val data = response.body()
                matchmakingEntryId = data?.get("entry_id")?.asInt
                    ?: data?.get("id")?.asInt
                startMatchmakingPoll(timeControl, colorPref, gameMode)
            } else {
                _uiState.value = _uiState.value.copy(
                    matchmakingState = MatchmakingState.IDLE,
                    error = "Failed to join queue",
                )
            }
        } catch (e: Exception) {
            _uiState.value = _uiState.value.copy(
                matchmakingState = MatchmakingState.IDLE,
                error = "Queue error: ${e.message}",
            )
        }
    }

    private fun startMatchmakingPoll(timeControl: String, colorPref: String, gameMode: String) {
        matchmakingPollJob?.cancel()
        matchmakingPollJob = viewModelScope.launch {
            val startTime = System.currentTimeMillis()
            val timeout = 30_000L // 30 second total timeout

            while (isActive && (System.currentTimeMillis() - startTime) < timeout) {
                delay(2000)

                // Check find-players status
                val token = findPlayersToken
                if (token != null) {
                    // Not a direct poll endpoint - we check accepted invitations
                    try {
                        val acceptedResponse = matchmakingApi.getAcceptedInvitations()
                        if (acceptedResponse.isSuccessful) {
                            val accepted = acceptedResponse.body()?.getAsJsonArray("invitations")
                            if (accepted != null && accepted.size() > 0) {
                                val inv = accepted[0].asJsonObject
                                val gameId = inv.get("game_id")?.asInt
                                if (gameId != null && gameId > 0) {
                                    _uiState.value = _uiState.value.copy(
                                        matchmakingState = MatchmakingState.MATCHED,
                                        matchedGameId = gameId,
                                    )
                                    return@launch
                                }
                            }
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "Error checking accepted invitations")
                    }
                }

                // Check queue status
                val entryId = matchmakingEntryId
                if (entryId != null) {
                    try {
                        val statusResponse = matchmakingApi.checkStatus(entryId)
                        if (statusResponse.isSuccessful) {
                            val data = statusResponse.body()
                            val status = data?.get("status")?.asString
                            val gameId = data?.get("game_id")?.asInt

                            if (status == "matched" && gameId != null) {
                                _uiState.value = _uiState.value.copy(
                                    matchmakingState = MatchmakingState.MATCHED,
                                    matchedGameId = gameId,
                                )
                                return@launch
                            }
                        }
                    } catch (e: Exception) {
                        Timber.e(e, "Error checking queue status")
                    }
                }
            }

            // Timeout - no match found
            _uiState.value = _uiState.value.copy(
                matchmakingState = MatchmakingState.IDLE,
                snackbarMessage = "No opponents found. Try again later.",
            )
        }
    }

    fun cancelMatchmaking() {
        matchmakingPollJob?.cancel()
        viewModelScope.launch {
            findPlayersToken?.let { token ->
                try {
                    val body = JsonObject().apply { addProperty("token", token) }
                    matchmakingApi.cancelFindPlayers(body)
                } catch (_: Exception) {}
                findPlayersToken = null
            }
            matchmakingEntryId?.let { id ->
                try {
                    matchmakingApi.cancelQueue(id)
                } catch (_: Exception) {}
                matchmakingEntryId = null
            }
            _uiState.value = _uiState.value.copy(matchmakingState = MatchmakingState.IDLE)
        }
    }

    fun clearMatchedGame() {
        _uiState.value = _uiState.value.copy(
            matchmakingState = MatchmakingState.IDLE,
            matchedGameId = null,
        )
    }

    // ── Invitations ─────────────────────────────────────────────────────

    fun sendInvitation(opponentId: Int, timeControl: String, colorPref: String, gameMode: String) {
        viewModelScope.launch {
            try {
                val body = JsonObject().apply {
                    addProperty("opponent_id", opponentId)
                    addProperty("time_control", timeControl)
                    addProperty("color_preference", colorPref)
                    addProperty("game_mode", gameMode)
                }
                val response = matchmakingApi.sendInvitation(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Challenge sent!")
                    loadSentInvitations()
                } else {
                    _uiState.value = _uiState.value.copy(error = "Failed to send challenge")
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Error: ${e.message}")
            }
        }
    }

    fun acceptInvitation(invitationId: Int) {
        viewModelScope.launch {
            try {
                val response = matchmakingApi.acceptInvitation(invitationId)
                if (response.isSuccessful) {
                    val data = response.body()
                    val gameId = data?.get("game_id")?.asInt
                    if (gameId != null) {
                        _uiState.value = _uiState.value.copy(
                            matchedGameId = gameId,
                            matchmakingState = MatchmakingState.MATCHED,
                        )
                    }
                    loadPendingInvitations()
                }
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to accept: ${e.message}")
            }
        }
    }

    fun declineInvitation(invitationId: Int) {
        viewModelScope.launch {
            try {
                matchmakingApi.declineInvitation(invitationId)
                loadPendingInvitations()
            } catch (e: Exception) {
                Timber.e(e, "Failed to decline invitation")
            }
        }
    }

    fun cancelInvitation(invitationId: Int) {
        viewModelScope.launch {
            try {
                matchmakingApi.cancelInvitation(invitationId)
                loadSentInvitations()
            } catch (e: Exception) {
                Timber.e(e, "Failed to cancel invitation")
            }
        }
    }

    // ── Friends ─────────────────────────────────────────────────────────

    fun searchUsers(query: String) {
        viewModelScope.launch {
            if (query.length < 2) {
                _uiState.value = _uiState.value.copy(searchResults = emptyList())
                return@launch
            }
            try {
                val response = matchmakingApi.searchUsers(query)
                if (response.isSuccessful) {
                    val users = response.body()?.getAsJsonArray("users")?.map { el ->
                        val u = el.asJsonObject
                        LobbyPlayer(
                            id = u.get("id")?.asInt ?: 0,
                            name = u.get("name")?.asString ?: "",
                            rating = u.get("rating")?.asInt ?: 1200,
                            isOnline = u.get("is_online")?.asBoolean ?: false,
                            avatarUrl = u.get("avatar_url")?.asString,
                        )
                    } ?: emptyList()
                    _uiState.value = _uiState.value.copy(searchResults = users)
                }
            } catch (e: Exception) {
                Timber.e(e, "Search failed")
            }
        }
    }

    fun sendFriendRequest(userId: Int) {
        viewModelScope.launch {
            try {
                val body = JsonObject().apply { addProperty("user_id", userId) }
                matchmakingApi.sendFriendRequest(body)
                _uiState.value = _uiState.value.copy(snackbarMessage = "Friend request sent!")
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed: ${e.message}")
            }
        }
    }

    fun acceptFriendRequest(requestId: Int) {
        viewModelScope.launch {
            try {
                matchmakingApi.acceptFriendRequest(requestId)
                loadFriends()
            } catch (e: Exception) {
                Timber.e(e, "Failed to accept friend request")
            }
        }
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private fun parseInvitation(json: JsonObject): Invitation {
        return Invitation(
            id = json.get("id")?.asInt ?: 0,
            senderId = json.get("sender_id")?.asInt ?: 0,
            senderName = json.get("sender_name")?.asString
                ?: json.getAsJsonObject("sender")?.get("name")?.asString ?: "Unknown",
            receiverId = json.get("receiver_id")?.asInt ?: 0,
            receiverName = json.get("receiver_name")?.asString
                ?: json.getAsJsonObject("receiver")?.get("name")?.asString ?: "Unknown",
            timeControl = json.get("time_control")?.asString ?: "10|0",
            gameMode = json.get("game_mode")?.asString ?: "casual",
            status = json.get("status")?.asString ?: "pending",
            gameId = json.get("game_id")?.asInt,
        )
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    override fun onCleared() {
        super.onCleared()
        pollingJob?.cancel()
        matchmakingPollJob?.cancel()
    }
}

// ── UI State ────────────────────────────────────────────────────────────

data class LobbyUiState(
    val isLoading: Boolean = false,
    val selectedTab: LobbyTab = LobbyTab.PLAYERS,
    val onlinePlayers: List<LobbyPlayer> = emptyList(),
    val friends: List<LobbyPlayer> = emptyList(),
    val pendingInvitations: List<Invitation> = emptyList(),
    val sentInvitations: List<Invitation> = emptyList(),
    val activeGames: List<ActiveGame> = emptyList(),
    val searchResults: List<LobbyPlayer> = emptyList(),
    val onlineCount: Int = 0,
    val matchmakingState: MatchmakingState = MatchmakingState.IDLE,
    val matchmakingTimeControl: String = "10|0",
    val matchedGameId: Int? = null,
    val error: String? = null,
    val snackbarMessage: String? = null,
)

enum class LobbyTab { PLAYERS, FRIENDS, MATCHMAKING }
enum class MatchmakingState { IDLE, SEARCHING, MATCHED }

data class LobbyPlayer(
    val id: Int,
    val name: String,
    val rating: Int,
    val isOnline: Boolean,
    val avatarUrl: String? = null,
)

data class Invitation(
    val id: Int,
    val senderId: Int,
    val senderName: String,
    val receiverId: Int,
    val receiverName: String,
    val timeControl: String,
    val gameMode: String,
    val status: String,
    val gameId: Int? = null,
)

data class ActiveGame(
    val id: Int,
    val opponentName: String,
    val status: String,
    val timeControl: String,
)
