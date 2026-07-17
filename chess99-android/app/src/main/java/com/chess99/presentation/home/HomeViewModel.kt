package com.chess99.presentation.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.RatingWindow
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.bool
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.data.local.TokenManager
import com.chess99.domain.repository.AuthRepository
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.async
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel backing the Home screen's "Continue playing" section.
 * Merges `GET games/active` (waiting|active|paused) with
 * `GET games/unfinished` (paused, recently abandoned via navigation) so a
 * returning player always sees a single, de-duplicated resume list.
 *
 * Errors never surface as a spinner or error card here — the section is
 * simply absent on failure (see HomeScreen.kt PlayTab), matching the rest of
 * Home which is otherwise static.
 */
@HiltViewModel
class HomeViewModel @Inject constructor(
    private val gameApi: GameApi,
    private val matchmakingApi: MatchmakingApi,
    private val tokenManager: TokenManager,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _uiState = MutableStateFlow(HomeUiState())
    val uiState: StateFlow<HomeUiState> = _uiState.asStateFlow()

    init {
        refresh()
    }

    /**
     * Reload the continue-playing list. Safe to call repeatedly (e.g. on
     * screen resume) — failures are swallowed and simply leave the section
     * as it was (or empty, on first load).
     */
    fun refresh() {
        viewModelScope.launch {
            val currentUserId = tokenManager.getUserId()

            val activeDeferred = async { loadActiveGames(currentUserId) }
            val unfinishedDeferred = async { loadUnfinishedGames() }
            // Single current-user fetch shared by both the ambassador gate
            // and T2's rating-windowed Nearby Opponents load below — avoids
            // firing `getCurrentUser()` twice per refresh.
            val currentUserResultDeferred = async { authRepository.getCurrentUser() }

            val active = activeDeferred.await()
            val unfinished = unfinishedDeferred.await()
            val currentUserResult = currentUserResultDeferred.await()

            val hideAmbassador = currentUserResult.fold(
                onSuccess = { user -> user.isMinor || user.needsBirthday },
                onFailure = { true },
            )
            val userRating = currentUserResult.getOrNull()?.rating

            val nearbyOpponents = loadNearbyOpponents(userRating)

            // Merge rule: active games first, then unfinished games not
            // already present (dedupe by id).
            val activeIds = active.map { it.id }.toSet()
            val merged = active + unfinished.filter { it.id !in activeIds }

            _uiState.value = _uiState.value.copy(
                continuePlayingGames = merged,
                hideAmbassadorEntry = hideAmbassador,
                nearbyOpponents = nearbyOpponents,
            )
        }
    }

    /** Remove a game from local state once it has been discarded/abandoned server-side. */
    private fun removeGame(gameId: Int) {
        _uiState.value = _uiState.value.copy(
            continuePlayingGames = _uiState.value.continuePlayingGames.filter { it.id != gameId },
        )
    }

    /**
     * Discard a paused game (server only allows deleting games in `paused`
     * status — see GameController::deleteUnfinished). Games in `waiting`
     * status are not discardable from Home in this version: the web
     * equivalent (`POST games/{id}/abandon`) is registered only on the
     * legacy, non-versioned API group and is unreachable from this app's
     * `/api/v1/` base, so no client action is offered for it (see
     * ContinuePlayingGame.canDiscard).
     */
    fun discardGame(gameId: Int) {
        viewModelScope.launch {
            try {
                val response = gameApi.deleteUnfinished(gameId)
                if (response.isSuccessful) {
                    removeGame(gameId)
                } else {
                    _uiState.value = _uiState.value.copy(
                        snackbarMessage = "Couldn't discard that game. Please try again.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to discard game $gameId")
                _uiState.value = _uiState.value.copy(
                    snackbarMessage = "Couldn't discard that game. Please try again.",
                )
            }
        }
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    // ── Nearby Opponents (T2) ───────────────────────────────────────────

    fun toggleNearbyOpponentsExpanded() {
        _uiState.value = _uiState.value.copy(nearbyOpponentsExpanded = !_uiState.value.nearbyOpponentsExpanded)
    }

    /**
     * Tapping a synthetic card (T2) starts a real, server-recorded game vs
     * that bot — same request shape as [com.chess99.presentation.game.PlayComputerViewModel.startPersonaGame]
     * (T5): casual, 10+0, random color (web's Dashboard.js nearby-opponent
     * defaults). On success, [HomeUiState.startedGameId] carries the new game
     * id for the screen to navigate into PlayMultiplayer; on failure a
     * snackbar explains it rather than silently doing nothing, since (unlike
     * T5) there's no local-Stockfish fallback screen to drop into from Home.
     */
    fun startGameVsSynthetic(opponent: NearbyOpponent) {
        if (!opponent.isSynthetic) return
        viewModelScope.launch {
            try {
                val body = JsonObject().apply {
                    addProperty("player_color", if ((0..1).random() == 0) "white" else "black")
                    addProperty("computer_level", opponent.computerLevel ?: 2)
                    addProperty("time_control", 10)
                    addProperty("increment", 0)
                    addProperty("synthetic_player_id", opponent.id)
                    addProperty("game_mode", "casual")
                }
                val response = gameApi.createComputerGame(body)
                val gameId = response.body()?.getAsJsonObject("game")?.get("id")?.asInt
                if (response.isSuccessful && gameId != null) {
                    _uiState.value = _uiState.value.copy(startedGameId = gameId)
                } else {
                    _uiState.value = _uiState.value.copy(
                        snackbarMessage = "Couldn't start that game. Please try again.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to start game vs synthetic player ${opponent.id}")
                _uiState.value = _uiState.value.copy(
                    snackbarMessage = "Couldn't start that game. Please try again.",
                )
            }
        }
    }

    fun consumeStartedGameId() {
        _uiState.value = _uiState.value.copy(startedGameId = null)
    }

    // ── Loaders ─────────────────────────────────────────────────────────

    private suspend fun loadActiveGames(currentUserId: Int): List<ContinuePlayingGame> {
        return try {
            val response = gameApi.getActiveGames()
            if (!response.isSuccessful) return emptyList()
            val body = response.body() ?: return emptyList()
            // GameController::activeGames returns {"data": [...raw Game models...], "pagination": {...}}
            val gamesArray = body.get("data")?.arrOrNull() ?: return emptyList()
            gamesArray.mapNotNull { el -> parseActiveGame(el.objOrNull(), currentUserId) }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load active games for Home")
            emptyList()
        }
    }

    private suspend fun loadUnfinishedGames(): List<ContinuePlayingGame> {
        return try {
            val response = gameApi.getUnfinishedGames()
            if (!response.isSuccessful) return emptyList()
            val body = response.body() ?: return emptyList()
            // GameController::unfinishedGames returns convenience fields
            // (opponent_name, current_user_id) spread onto each raw game.
            val gamesArray = body.get("games")?.arrOrNull()
                ?: body.get("data")?.arrOrNull()
                ?: emptyList()
            gamesArray.mapNotNull { el -> parseUnfinishedGame(el.objOrNull()) }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load unfinished games for Home")
            emptyList()
        }
    }

    private fun parseActiveGame(json: JsonObject?, currentUserId: Int): ContinuePlayingGame? {
        if (json == null) return null
        val id = json.int("id") ?: return null
        val whitePlayerId = json.int("white_player_id")
        val isWhite = whitePlayerId == currentUserId
        val opponent = if (isWhite) json.get("black_player")?.objOrNull() else json.get("white_player")?.objOrNull()
        val opponentName = opponent.str("name") ?: "Opponent"
        val status = json.str("status") ?: "active"
        return ContinuePlayingGame(
            id = id,
            opponentName = opponentName,
            status = status,
            playingAsWhite = isWhite,
            lastMoveAtIso = json.str("last_move_at"),
            // Server only allows deleting `paused` games; `waiting` games
            // have no reachable client action from this app (see discardGame kdoc).
            canDiscard = status == "paused",
        )
    }

    private fun parseUnfinishedGame(json: JsonObject?): ContinuePlayingGame? {
        if (json == null) return null
        val id = json.int("id") ?: return null
        val currentUserId = json.int("current_user_id")
        val whitePlayerId = json.int("white_player_id")
        val isWhite = whitePlayerId != null && whitePlayerId == currentUserId
        val opponentName = json.str("opponent_name") ?: "Opponent"
        return ContinuePlayingGame(
            id = id,
            opponentName = opponentName,
            status = "paused",
            playingAsWhite = isWhite,
            lastMoveAtIso = json.str("paused_at") ?: json.str("last_move_at") ?: json.str("updated_at"),
            canDiscard = true,
        )
    }

    /**
     * T2: `GET v1/lobby/players` — real players first (server order, already
     * rating-proximity sorted), synthetics appended, so a beginner with no
     * nearby humans naturally still sees ≥3 cards (up to 40 bots fill the
     * window server-side). Any failure (offline, 4xx/5xx) returns an empty
     * list so the section is simply absent — see PlayTab in HomeScreen.kt.
     */
    private suspend fun loadNearbyOpponents(userRating: Int?): List<NearbyOpponent> {
        return try {
            val (minRating, maxRating) = RatingWindow.defaultWindow(userRating)
            val response = matchmakingApi.getLobbyPlayers(minRating, maxRating)
            if (!response.isSuccessful) return emptyList()
            val body = response.body() ?: return emptyList()

            val real = body.get("real_players")?.arrOrNull()?.mapNotNull { el ->
                parseNearbyOpponent(el.objOrNull(), isSynthetic = false)
            } ?: emptyList()
            val synthetic = body.get("synthetic_players")?.arrOrNull()?.mapNotNull { el ->
                parseNearbyOpponent(el.objOrNull(), isSynthetic = true)
            } ?: emptyList()

            // Real players first (spec T2) — beginners with no nearby humans
            // naturally see bots fill the rest of the list.
            real + synthetic
        } catch (e: Exception) {
            Timber.e(e, "Failed to load nearby opponents for Home")
            emptyList()
        }
    }

    private fun parseNearbyOpponent(json: JsonObject?, isSynthetic: Boolean): NearbyOpponent? {
        if (json == null) return null
        val id = json.int("id") ?: return null
        return NearbyOpponent(
            id = id,
            name = json.str("name") ?: "Player",
            rating = json.int("rating") ?: 1200,
            avatarUrl = json.str("avatar_url"),
            isSynthetic = isSynthetic,
            inGame = json.bool("in_game") ?: false,
            computerLevel = json.int("computer_level"),
        )
    }
}

data class HomeUiState(
    val continuePlayingGames: List<ContinuePlayingGame> = emptyList(),
    val snackbarMessage: String? = null,
    /** Fail-closed: true (hidden) until the current user's age gate is confirmed. */
    val hideAmbassadorEntry: Boolean = true,
    /** T2 — real players first, then synthetic; empty (never a spinner/error card) on failure. */
    val nearbyOpponents: List<NearbyOpponent> = emptyList(),
    val nearbyOpponentsExpanded: Boolean = false,
    /** Set once a synthetic-opponent game is created (T2 tap) — screen navigates and consumes it. */
    val startedGameId: Int? = null,
)

/** A single card in Home's "Nearby Opponents" section (T2). */
data class NearbyOpponent(
    val id: Int,
    val name: String,
    val rating: Int,
    val avatarUrl: String?,
    val isSynthetic: Boolean,
    /** Real players only — true when the player is in an active human game (not tappable to challenge). */
    val inGame: Boolean,
    /** Synthetic players only — engine level for starting a game vs this bot. */
    val computerLevel: Int?,
)

/** A single resumable game shown in Home's "Continue playing" section. */
data class ContinuePlayingGame(
    val id: Int,
    val opponentName: String,
    /** Raw backend status code: "waiting" | "active" | "paused". */
    val status: String,
    val playingAsWhite: Boolean,
    /** ISO-8601 timestamp string from the server, or null if no moves yet. */
    val lastMoveAtIso: String?,
    val canDiscard: Boolean,
)
