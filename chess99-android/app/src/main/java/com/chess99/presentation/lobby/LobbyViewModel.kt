package com.chess99.presentation.lobby

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.RatingWindow
import com.chess99.data.local.LobbyPreferences
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.PusherManager
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.bool
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.presentation.common.friendlyError
import com.chess99.presentation.game.PlayComputerViewModel
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
    private val lobbyPreferences: LobbyPreferences,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LobbyUiState())
    val uiState: StateFlow<LobbyUiState> = _uiState.asStateFlow()

    private var pollingJob: Job? = null
    private var matchmakingPollJob: Job? = null
    private var matchmakingEntryId: Int? = null
    private var findPlayersToken: String? = null

    init {
        // Restore the Elo range and the mode / time control the player last chose,
        // so the lobby comes back the way they left it (web parity: LobbyPage.js
        // seeds from getModeAwareDefaultRatingWindow + stored prefs).
        val storedWindow = lobbyPreferences.getRatingWindow() ?: RatingWindow.full()
        _uiState.value = _uiState.value.copy(
            ratingWindow = storedWindow,
            ratingWindowDraftMin = storedWindow.minRating.toString(),
            ratingWindowDraftMax = storedWindow.maxRating.toString(),
            hasStoredRatingWindow = lobbyPreferences.getRatingWindow() != null,
            selectedGameMode = lobbyPreferences.getGameMode(),
            selectedTimeControlMinutes = lobbyPreferences.getTimeControlMinutes(),
            selectedIncrementSeconds = lobbyPreferences.getIncrementSeconds(),
        )
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
                launch { loadPendingFriendRequests() }
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
            // The Players tab is a full lobby, not "nearby opponents": show bots
            // across ALL ELOs (the user's ask) rather than a narrow window around
            // an unknown rating — a default 200–750 window hid every seeded bot
            // (they start ~800). Full span => backend returns a varied-ELO set.
            val (minRating, maxRating) = RatingWindow.full()
            val response = matchmakingApi.getLobbyPlayers(minRating, maxRating)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                // `GET v1/lobby/players` returns { real_players, synthetic_players }.
                // Surface BOTH so the Players tab always has opponents of varying
                // ELO (matches web's PlayersList.jsx) — real humans first, then
                // synthetic bots fill in, so an empty online list is never a dead end.
                val realPlayers = body.get("real_players")?.arrOrNull()?.mapNotNull { el ->
                    val p = el.objOrNull() ?: return@mapNotNull null
                    LobbyPlayer(
                        id = p.int("id") ?: return@mapNotNull null,
                        name = p.str("name") ?: "Player",
                        rating = p.int("rating") ?: 1200,
                        isOnline = true,
                        avatarUrl = p.str("avatar_url"),
                    )
                } ?: emptyList()
                val syntheticPlayers = body.get("synthetic_players")?.arrOrNull()?.mapNotNull { el ->
                    val p = el.objOrNull() ?: return@mapNotNull null
                    LobbyPlayer(
                        id = p.int("id") ?: return@mapNotNull null,
                        name = p.str("name") ?: "Player",
                        rating = p.int("rating") ?: 1200,
                        isOnline = true,
                        avatarUrl = p.str("avatar_url"),
                        isSynthetic = true,
                        computerLevel = p.int("computer_level"),
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(onlinePlayers = realPlayers + syntheticPlayers)
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
                val friends = body.map { el ->
                    val f = el.asJsonObject
                    LobbyPlayer(
                        id = f.int("id") ?: 0,
                        name = f.str("name") ?: "",
                        rating = f.int("rating") ?: 1200,
                        isOnline = f.bool("is_online") ?: false,
                        avatarUrl = f.str("avatar_url"),
                    )
                }
                _uiState.value = _uiState.value.copy(friends = friends)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load friends")
        }
    }

    private suspend fun loadPendingFriendRequests() {
        try {
            val response = matchmakingApi.getPendingFriendRequests()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val requests = body.map { el ->
                    val f = el.asJsonObject
                    LobbyPlayer(
                        id = f.int("id") ?: 0,
                        name = f.str("name") ?: "",
                        rating = f.int("rating") ?: 1200,
                        isOnline = f.bool("is_online") ?: false,
                        avatarUrl = f.str("avatar_url"),
                    )
                }
                _uiState.value = _uiState.value.copy(pendingFriendRequests = requests)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load pending friend requests")
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
                error = friendlyError(e, "matchmaking"),
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

    // ── Elo filter (Players tab) ────────────────────────────────────────

    /** Type into the From box. Kept as text until [applyRatingWindow]. */
    fun setRatingWindowDraftMin(value: String) {
        _uiState.value = _uiState.value.copy(ratingWindowDraftMin = value.filter { it.isDigit() }.take(4))
    }

    /** Type into the To box. */
    fun setRatingWindowDraftMax(value: String) {
        _uiState.value = _uiState.value.copy(ratingWindowDraftMax = value.filter { it.isDigit() }.take(4))
    }

    /**
     * Commit the typed range: normalize it (clamping and swapping if reversed),
     * persist it, and re-render the list. No refetch — the full span is already
     * loaded, so filtering is instant.
     */
    fun applyRatingWindow() {
        val state = _uiState.value
        val window = RatingWindow(
            minRating = state.ratingWindowDraftMin.toIntOrNull() ?: RatingWindow.MIN_OPPONENT_RATING,
            maxRating = state.ratingWindowDraftMax.toIntOrNull() ?: RatingWindow.MAX_OPPONENT_RATING,
        ).normalize()

        lobbyPreferences.saveRatingWindow(window)
        _uiState.value = state.copy(
            ratingWindow = window,
            // Reflect the normalized values back so the boxes show what was applied.
            ratingWindowDraftMin = window.minRating.toString(),
            ratingWindowDraftMax = window.maxRating.toString(),
            hasStoredRatingWindow = true,
        )
    }

    /** Drop the saved range and show every opponent again. */
    fun resetRatingWindow() {
        lobbyPreferences.clearRatingWindow()
        val window = RatingWindow.full()
        _uiState.value = _uiState.value.copy(
            ratingWindow = window,
            ratingWindowDraftMin = window.minRating.toString(),
            ratingWindowDraftMax = window.maxRating.toString(),
            hasStoredRatingWindow = false,
        )
    }

    // ── Start-a-game options (Players tab) ──────────────────────────────

    /** "casual" | "rated" | "learning" — web parity: PlayOnlineButton sends prefs.game_mode. */
    fun setSelectedGameMode(mode: String) {
        lobbyPreferences.saveGameMode(mode)
        _uiState.value = _uiState.value.copy(selectedGameMode = mode)
    }

    fun setSelectedTimeControl(minutes: Int, incrementSeconds: Int) {
        lobbyPreferences.saveTimeControlMinutes(minutes)
        lobbyPreferences.saveIncrementSeconds(incrementSeconds)
        _uiState.value = _uiState.value.copy(
            selectedTimeControlMinutes = minutes,
            selectedIncrementSeconds = incrementSeconds,
        )
    }

    /**
     * Tapping "Play" on a synthetic (bot) player in the Players tab starts a
     * real, server-recorded game vs that bot — same request shape as
     * [com.chess99.presentation.home.HomeViewModel.startGameVsSynthetic] and
     * PlayComputerViewModel.startPersonaGame: casual, 10+0, random color. On
     * success the new game id flows through the existing [LobbyUiState.matchedGameId]
     * navigation path; on failure a snackbar explains it (you cannot invite a
     * bot the way you challenge a human, so this must not fall through to
     * sendInvitation).
     */
    fun startGameVsSynthetic(player: LobbyPlayer) {
        if (!player.isSynthetic) return
        val state = _uiState.value
        viewModelScope.launch {
            try {
                val body = JsonObject().apply {
                    addProperty("player_color", if ((0..1).random() == 0) "white" else "black")
                    addProperty("computer_level", player.computerLevel ?: 2)
                    // Was hardcoded 10|0 casual, so the Players tab could only
                    // ever start one kind of game. Web sends the player's stored
                    // preferences here (PlayOnlineButton.js:51-55), including
                    // learning mode and its help budget.
                    addProperty("time_control", state.selectedTimeControlMinutes)
                    addProperty("increment", state.selectedIncrementSeconds)
                    addProperty("synthetic_player_id", player.id)
                    // The server validates game_mode as rated|casual only —
                    // "learning" is expressed as a casual game with the
                    // learning_mode flag, same convention as
                    // PlayComputerViewModel. Sending game_mode="learning"
                    // straight through 422s.
                    addProperty(
                        "game_mode",
                        if (state.selectedGameMode == "rated") "rated" else "casual",
                    )
                    if (state.selectedGameMode == "learning") {
                        addProperty("learning_mode", true)
                        addProperty(
                            "learning_help_limit",
                            PlayComputerViewModel.DEFAULT_LEARNING_HELP_LIMIT,
                        )
                    }
                }
                val response = gameApi.createComputerGame(body)
                val gameId = response.body()?.getAsJsonObject("game")?.get("id")?.asInt
                if (response.isSuccessful && gameId != null) {
                    _uiState.value = _uiState.value.copy(matchedGameId = gameId)
                } else {
                    _uiState.value = _uiState.value.copy(
                        snackbarMessage = "Couldn't start that game. Please try again.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to start game vs synthetic player ${player.id}")
                _uiState.value = _uiState.value.copy(
                    snackbarMessage = "Couldn't start that game. Please try again.",
                )
            }
        }
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "the lobby"))
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "accepting the invite"))
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "this action"))
            }
        }
    }

    fun acceptFriendRequest(requestId: Int) {
        viewModelScope.launch {
            try {
                val response = matchmakingApi.acceptFriendRequest(requestId)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Friend request accepted!")
                    loadFriends()
                    loadPendingFriendRequests()
                } else {
                    _uiState.value = _uiState.value.copy(error = "Couldn't accept this request. Please try again.")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to accept friend request")
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "this request"))
            }
        }
    }

    fun declineFriendRequest(requestId: Int) {
        viewModelScope.launch {
            try {
                val response = matchmakingApi.declineFriendRequest(requestId)
                if (response.isSuccessful) {
                    loadPendingFriendRequests()
                } else {
                    _uiState.value = _uiState.value.copy(error = "Couldn't decline this request. Please try again.")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to decline friend request")
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "this request"))
            }
        }
    }

    fun removeFriend(friendId: Int) {
        viewModelScope.launch {
            try {
                val response = matchmakingApi.removeFriend(friendId)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Friend removed")
                    loadFriends()
                } else {
                    _uiState.value = _uiState.value.copy(error = "Couldn't remove this friend. Please try again.")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to remove friend")
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "this action"))
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
    val pendingFriendRequests: List<LobbyPlayer> = emptyList(),
    val pendingInvitations: List<Invitation> = emptyList(),
    val sentInvitations: List<Invitation> = emptyList(),
    val activeGames: List<ActiveGame> = emptyList(),
    val searchResults: List<LobbyPlayer> = emptyList(),
    val onlineCount: Int = 0,
    /** Applied Elo filter for the Players tab. */
    val ratingWindow: RatingWindow = RatingWindow.full(),
    /** Raw text in the From/To boxes — kept as strings so a half-typed value is not clobbered. */
    val ratingWindowDraftMin: String = RatingWindow.MIN_OPPONENT_RATING.toString(),
    val ratingWindowDraftMax: String = RatingWindow.MAX_OPPONENT_RATING.toString(),
    /** True once the player has explicitly saved a range — enables "Reset". */
    val hasStoredRatingWindow: Boolean = false,
    /** Mode / time control used when starting a game from the Players list. */
    val selectedGameMode: String = LobbyPreferences.DEFAULT_GAME_MODE,
    val selectedTimeControlMinutes: Int = LobbyPreferences.DEFAULT_TIME_CONTROL,
    val selectedIncrementSeconds: Int = LobbyPreferences.DEFAULT_INCREMENT,
    val matchmakingState: MatchmakingState = MatchmakingState.IDLE,
    val matchmakingTimeControl: String = "10|0",
    val matchedGameId: Int? = null,
    val error: String? = null,
    val snackbarMessage: String? = null,
) {
    /**
     * Players tab contents after the Elo filter. The full list stays in
     * [onlinePlayers] so widening the range never needs a refetch — the server
     * is queried with the full span (see RatingWindow.full).
     */
    val visiblePlayers: List<LobbyPlayer>
        get() = onlinePlayers.filter { ratingWindow.contains(it.rating) }
}

enum class LobbyTab { PLAYERS, FRIENDS, MATCHMAKING }
enum class MatchmakingState { IDLE, SEARCHING, MATCHED }

data class LobbyPlayer(
    val id: Int,
    val name: String,
    val rating: Int,
    val isOnline: Boolean,
    val avatarUrl: String? = null,
    /** True for a synthetic (bot) player — tapping "Play" starts a bot game rather than sending an invitation. */
    val isSynthetic: Boolean = false,
    /** Synthetic players only — engine level used when starting a game vs this bot. */
    val computerLevel: Int? = null,
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
