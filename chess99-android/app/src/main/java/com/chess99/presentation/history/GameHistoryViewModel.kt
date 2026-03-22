package com.chess99.presentation.history

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.engine.ChessGame
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
 * ViewModel for Game History screen.
 * Handles paginated game list loading, filtering, search, and game replay.
 *
 * Mirrors chess-frontend/src/pages/HistoryPage.js behavior.
 */
@HiltViewModel
class GameHistoryViewModel @Inject constructor(
    private val gameApi: GameApi,
    private val savedStateHandle: SavedStateHandle,
) : ViewModel() {

    companion object {
        private const val PAGE_SIZE = 20
        private const val AUTOPLAY_DEFAULT_SPEED_MS = 1500L
        private const val AUTOPLAY_MIN_SPEED_MS = 500L
        private const val AUTOPLAY_MAX_SPEED_MS = 3000L
    }

    private val _uiState = MutableStateFlow(GameHistoryUiState())
    val uiState: StateFlow<GameHistoryUiState> = _uiState.asStateFlow()

    private var autoPlayJob: Job? = null

    init {
        loadGames(reset = true)
    }

    // ── Game List Loading ─────────────────────────────────────────────

    fun loadGames(reset: Boolean = false) {
        val state = _uiState.value
        if (state.isLoadingMore && !reset) return

        viewModelScope.launch {
            val page = if (reset) 1 else state.currentPage + 1

            _uiState.value = state.copy(
                isLoading = reset && state.games.isEmpty(),
                isLoadingMore = !reset,
                error = null,
            )

            try {
                val response = gameApi.getUserGames(page = page, perPage = PAGE_SIZE)
                if (response.isSuccessful) {
                    val body = response.body() ?: JsonObject()
                    val gamesArray = body.getAsJsonArray("games")
                        ?: body.getAsJsonObject("data")?.let { null }
                        ?: body.getAsJsonArray("data")
                        ?: run {
                            // Try unwrapping from paginated response
                            body.getAsJsonObject("games")?.getAsJsonArray("data")
                        }

                    val parsedGames = gamesArray?.map { el ->
                        parseGameSummary(el.asJsonObject)
                    } ?: emptyList()

                    val totalPages = body.get("last_page")?.asInt
                        ?: body.getAsJsonObject("games")?.get("last_page")?.asInt
                        ?: body.getAsJsonObject("meta")?.get("last_page")?.asInt
                        ?: if (parsedGames.size < PAGE_SIZE) page else page + 1

                    val allGames = if (reset) parsedGames else state.games + parsedGames

                    _uiState.value = _uiState.value.copy(
                        games = allGames,
                        filteredGames = applyFilters(allGames, _uiState.value),
                        currentPage = page,
                        hasMorePages = page < totalPages,
                        isLoading = false,
                        isLoadingMore = false,
                    )
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Failed to load games: ${response.code()} $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isLoadingMore = false,
                        error = "Failed to load games (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading games")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    fun loadMore() {
        if (_uiState.value.hasMorePages) {
            loadGames(reset = false)
        }
    }

    // ── Filters ───────────────────────────────────────────────────────

    fun setResultFilter(filter: ResultFilter) {
        val state = _uiState.value.copy(resultFilter = filter)
        _uiState.value = state.copy(filteredGames = applyFilters(state.games, state))
    }

    fun setColorFilter(filter: ColorFilter) {
        val state = _uiState.value.copy(colorFilter = filter)
        _uiState.value = state.copy(filteredGames = applyFilters(state.games, state))
    }

    fun setModeFilter(filter: ModeFilter) {
        val state = _uiState.value.copy(modeFilter = filter)
        _uiState.value = state.copy(filteredGames = applyFilters(state.games, state))
    }

    fun setSearchQuery(query: String) {
        val state = _uiState.value.copy(searchQuery = query)
        _uiState.value = state.copy(filteredGames = applyFilters(state.games, state))
    }

    private fun applyFilters(
        games: List<GameSummary>,
        state: GameHistoryUiState,
    ): List<GameSummary> {
        return games.filter { game ->
            // Result filter
            val matchesResult = when (state.resultFilter) {
                ResultFilter.ALL -> true
                ResultFilter.WON -> game.result == GameResult.WON
                ResultFilter.LOST -> game.result == GameResult.LOST
                ResultFilter.DRAW -> game.result == GameResult.DRAW
            }

            // Color filter
            val matchesColor = when (state.colorFilter) {
                ColorFilter.ALL -> true
                ColorFilter.WHITE -> game.playerColor == "white"
                ColorFilter.BLACK -> game.playerColor == "black"
            }

            // Mode filter
            val matchesMode = when (state.modeFilter) {
                ModeFilter.ALL -> true
                ModeFilter.CASUAL -> game.gameMode == "casual"
                ModeFilter.RATED -> game.gameMode == "rated"
            }

            // Search by opponent name
            val matchesSearch = state.searchQuery.isBlank() ||
                    game.opponentName.contains(state.searchQuery, ignoreCase = true)

            matchesResult && matchesColor && matchesMode && matchesSearch
        }
    }

    // ── Game Replay ───────────────────────────────────────────────────

    fun selectGame(gameId: Int) {
        val state = _uiState.value
        if (state.expandedGameId == gameId) {
            // Collapse if already expanded
            stopAutoPlay()
            _uiState.value = state.copy(expandedGameId = null, replayState = null)
            return
        }

        // Expand and load moves
        _uiState.value = state.copy(
            expandedGameId = gameId,
            replayState = ReplayState(isLoadingMoves = true),
        )
        loadGameMoves(gameId)
    }

    fun loadSingleGame(gameId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val response = gameApi.getGame(gameId)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val gameData = body.getAsJsonObject("game") ?: body
                    val game = parseGameSummary(gameData)
                    _uiState.value = _uiState.value.copy(
                        games = listOf(game),
                        filteredGames = listOf(game),
                        expandedGameId = gameId,
                        replayState = ReplayState(isLoadingMoves = true),
                        isLoading = false,
                    )
                    loadGameMoves(gameId)
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to load game (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading game $gameId")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    private fun loadGameMoves(gameId: Int) {
        viewModelScope.launch {
            try {
                val response = gameApi.getGameMoves(gameId)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val movesArray = body.getAsJsonArray("moves")
                        ?: body.getAsJsonArray("data")

                    val moves = movesArray?.map { el ->
                        val m = el.asJsonObject
                        ReplayMove(
                            moveNumber = m.get("move_number")?.asInt ?: 0,
                            from = m.get("from")?.asString ?: "",
                            to = m.get("to")?.asString ?: "",
                            san = m.get("san")?.asString ?: m.get("notation")?.asString ?: "",
                            fen = m.get("fen")?.asString ?: "",
                            promotion = m.get("promotion")?.asString,
                        )
                    } ?: emptyList()

                    // Build FEN positions for navigation
                    val fenPositions = buildFenPositions(moves)

                    _uiState.value = _uiState.value.copy(
                        replayState = ReplayState(
                            moves = moves,
                            fenPositions = fenPositions,
                            currentMoveIndex = -1, // Start at initial position
                            currentFen = ChessGame.STARTING_FEN,
                            isLoadingMoves = false,
                        ),
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        replayState = _uiState.value.replayState?.copy(
                            isLoadingMoves = false,
                            error = "Failed to load moves",
                        ),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading moves for game $gameId")
                _uiState.value = _uiState.value.copy(
                    replayState = _uiState.value.replayState?.copy(
                        isLoadingMoves = false,
                        error = "Error: ${e.message}",
                    ),
                )
            }
        }
    }

    /**
     * Build FEN positions by replaying moves through ChessGame engine.
     * Index 0 = starting position, index N = position after move N.
     */
    private fun buildFenPositions(moves: List<ReplayMove>): List<String> {
        val positions = mutableListOf<String>()
        val game = ChessGame()
        positions.add(game.fen()) // Starting position

        for (move in moves) {
            if (move.fen.isNotBlank()) {
                // If FEN is provided by the server, use it directly
                game.load(move.fen)
                positions.add(move.fen)
            } else if (move.san.isNotBlank()) {
                // Apply SAN move
                val result = game.moveSan(move.san)
                if (result != null) {
                    positions.add(game.fen())
                } else if (move.from.isNotBlank() && move.to.isNotBlank()) {
                    // Fallback: try algebraic from/to
                    val promo = move.promotion?.firstOrNull()
                    val altResult = game.move(move.from, move.to, promo)
                    if (altResult != null) {
                        positions.add(game.fen())
                    } else {
                        positions.add(game.fen()) // Keep current position on failure
                    }
                } else {
                    positions.add(game.fen())
                }
            } else if (move.from.isNotBlank() && move.to.isNotBlank()) {
                val promo = move.promotion?.firstOrNull()
                val result = game.move(move.from, move.to, promo)
                if (result != null) {
                    positions.add(game.fen())
                } else {
                    positions.add(game.fen())
                }
            }
        }

        return positions
    }

    // ── Replay Navigation ─────────────────────────────────────────────

    fun goToFirstMove() {
        stopAutoPlay()
        navigateToMove(-1)
    }

    fun goToPreviousMove() {
        stopAutoPlay()
        val replay = _uiState.value.replayState ?: return
        if (replay.currentMoveIndex > -1) {
            navigateToMove(replay.currentMoveIndex - 1)
        }
    }

    fun goToNextMove() {
        val replay = _uiState.value.replayState ?: return
        if (replay.currentMoveIndex < replay.moves.size - 1) {
            navigateToMove(replay.currentMoveIndex + 1)
        } else {
            stopAutoPlay()
        }
    }

    fun goToLastMove() {
        stopAutoPlay()
        val replay = _uiState.value.replayState ?: return
        navigateToMove(replay.moves.size - 1)
    }

    fun goToMove(index: Int) {
        stopAutoPlay()
        navigateToMove(index)
    }

    private fun navigateToMove(index: Int) {
        val replay = _uiState.value.replayState ?: return
        val clampedIndex = index.coerceIn(-1, replay.moves.size - 1)
        // fenPositions[0] = initial, fenPositions[i+1] = after move i
        val fenIndex = (clampedIndex + 1).coerceIn(0, replay.fenPositions.size - 1)
        val fen = replay.fenPositions.getOrElse(fenIndex) { ChessGame.STARTING_FEN }

        _uiState.value = _uiState.value.copy(
            replayState = replay.copy(
                currentMoveIndex = clampedIndex,
                currentFen = fen,
            ),
        )
    }

    // ── Auto-Play ─────────────────────────────────────────────────────

    fun toggleAutoPlay() {
        val replay = _uiState.value.replayState ?: return
        if (replay.isPlaying) {
            stopAutoPlay()
        } else {
            startAutoPlay()
        }
    }

    private fun startAutoPlay() {
        val replay = _uiState.value.replayState ?: return
        if (replay.currentMoveIndex >= replay.moves.size - 1) {
            // If at the end, restart from beginning
            navigateToMove(-1)
        }

        _uiState.value = _uiState.value.copy(
            replayState = _uiState.value.replayState?.copy(isPlaying = true),
        )

        autoPlayJob?.cancel()
        autoPlayJob = viewModelScope.launch {
            while (isActive) {
                val currentReplay = _uiState.value.replayState ?: break
                if (!currentReplay.isPlaying) break
                if (currentReplay.currentMoveIndex >= currentReplay.moves.size - 1) {
                    stopAutoPlay()
                    break
                }

                delay(currentReplay.playbackSpeedMs)
                goToNextMove()
            }
        }
    }

    private fun stopAutoPlay() {
        autoPlayJob?.cancel()
        autoPlayJob = null
        _uiState.value = _uiState.value.copy(
            replayState = _uiState.value.replayState?.copy(isPlaying = false),
        )
    }

    fun setPlaybackSpeed(speedMs: Long) {
        val clamped = speedMs.coerceIn(AUTOPLAY_MIN_SPEED_MS, AUTOPLAY_MAX_SPEED_MS)
        _uiState.value = _uiState.value.copy(
            replayState = _uiState.value.replayState?.copy(playbackSpeedMs = clamped),
        )
    }

    // ── PGN Generation ────────────────────────────────────────────────

    fun generatePgn(): String {
        val state = _uiState.value
        val replay = state.replayState ?: return ""
        val game = state.games.find { it.id == state.expandedGameId }

        val sb = StringBuilder()

        // PGN headers
        sb.appendLine("[Event \"Chess99 Game\"]")
        sb.appendLine("[Site \"chess99.com\"]")
        game?.let { g ->
            sb.appendLine("[Date \"${g.playedAt.take(10).replace("-", ".")}\"]")
            sb.appendLine("[White \"${if (g.playerColor == "white") "Player" else g.opponentName}\"]")
            sb.appendLine("[Black \"${if (g.playerColor == "black") "Player" else g.opponentName}\"]")
            val resultStr = when (g.result) {
                GameResult.WON -> if (g.playerColor == "white") "1-0" else "0-1"
                GameResult.LOST -> if (g.playerColor == "white") "0-1" else "1-0"
                GameResult.DRAW -> "1/2-1/2"
            }
            sb.appendLine("[Result \"$resultStr\"]")
            if (g.timeControl.isNotBlank()) {
                sb.appendLine("[TimeControl \"${g.timeControl}\"]")
            }
        }
        sb.appendLine()

        // Moves
        for ((i, move) in replay.moves.withIndex()) {
            if (i % 2 == 0) {
                if (i > 0) sb.append(' ')
                sb.append("${i / 2 + 1}.")
            }
            sb.append(' ')
            sb.append(move.san)
        }

        // Result
        game?.let { g ->
            val resultStr = when (g.result) {
                GameResult.WON -> if (g.playerColor == "white") "1-0" else "0-1"
                GameResult.LOST -> if (g.playerColor == "white") "0-1" else "1-0"
                GameResult.DRAW -> "1/2-1/2"
            }
            sb.append(" $resultStr")
        }

        return sb.toString().trim()
    }

    // ── Parsing ───────────────────────────────────────────────────────

    private fun parseGameSummary(json: JsonObject): GameSummary {
        val id = json.get("id")?.asInt ?: 0

        // Determine opponent — API may structure this differently
        val opponentName = json.get("opponent_name")?.asString
            ?: json.getAsJsonObject("opponent")?.get("name")?.asString
            ?: json.get("white_player_name")?.asString
            ?: "Unknown"

        val playerColor = json.get("player_color")?.asString
            ?: json.get("color")?.asString
            ?: "white"

        // Result
        val resultStr = json.get("result")?.asString
            ?: json.get("winner")?.asString
            ?: json.get("status")?.asString
            ?: ""
        val result = when {
            resultStr.equals("won", ignoreCase = true) ||
                    resultStr.equals("win", ignoreCase = true) -> GameResult.WON
            resultStr.equals("lost", ignoreCase = true) ||
                    resultStr.equals("loss", ignoreCase = true) -> GameResult.LOST
            resultStr.equals("draw", ignoreCase = true) ||
                    resultStr.equals("1/2-1/2", ignoreCase = true) -> GameResult.DRAW
            else -> {
                // Try to infer from winner field
                val winnerId = json.get("winner_id")?.asInt
                val userId = json.get("user_id")?.asInt
                when {
                    winnerId == null || winnerId == 0 -> GameResult.DRAW
                    winnerId == userId -> GameResult.WON
                    else -> GameResult.LOST
                }
            }
        }

        val timeControl = json.get("time_control")?.asString
            ?: json.get("time_setting")?.asString
            ?: ""

        val gameMode = json.get("game_mode")?.asString
            ?: json.get("mode")?.asString
            ?: "casual"

        val ratingChange = json.get("rating_change")?.asInt
            ?: json.get("rating_diff")?.asInt
            ?: 0

        val playedAt = json.get("played_at")?.asString
            ?: json.get("created_at")?.asString
            ?: json.get("completed_at")?.asString
            ?: ""

        val totalMoves = json.get("total_moves")?.asInt
            ?: json.get("moves_count")?.asInt
            ?: 0

        val endReason = json.get("end_reason")?.asString
            ?: json.get("termination")?.asString
            ?: ""

        val opponentRating = json.get("opponent_rating")?.asInt
            ?: json.getAsJsonObject("opponent")?.get("rating")?.asInt
            ?: 0

        return GameSummary(
            id = id,
            opponentName = opponentName,
            opponentRating = opponentRating,
            playerColor = playerColor,
            result = result,
            timeControl = timeControl,
            gameMode = gameMode,
            ratingChange = ratingChange,
            playedAt = playedAt,
            totalMoves = totalMoves,
            endReason = endReason,
        )
    }

    // ── Cleanup ───────────────────────────────────────────────────────

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    override fun onCleared() {
        super.onCleared()
        autoPlayJob?.cancel()
    }
}

// ── UI State ─────────────────────────────────────────────────────────

data class GameHistoryUiState(
    val games: List<GameSummary> = emptyList(),
    val filteredGames: List<GameSummary> = emptyList(),
    val isLoading: Boolean = false,
    val isLoadingMore: Boolean = false,
    val error: String? = null,
    val currentPage: Int = 0,
    val hasMorePages: Boolean = true,

    // Filters
    val resultFilter: ResultFilter = ResultFilter.ALL,
    val colorFilter: ColorFilter = ColorFilter.ALL,
    val modeFilter: ModeFilter = ModeFilter.ALL,
    val searchQuery: String = "",

    // Replay
    val expandedGameId: Int? = null,
    val replayState: ReplayState? = null,
)

data class GameSummary(
    val id: Int,
    val opponentName: String,
    val opponentRating: Int = 0,
    val playerColor: String, // "white" or "black"
    val result: GameResult,
    val timeControl: String,
    val gameMode: String, // "casual" or "rated"
    val ratingChange: Int = 0,
    val playedAt: String,
    val totalMoves: Int = 0,
    val endReason: String = "",
)

data class ReplayState(
    val moves: List<ReplayMove> = emptyList(),
    val fenPositions: List<String> = listOf(ChessGame.STARTING_FEN),
    val currentMoveIndex: Int = -1, // -1 = initial position
    val currentFen: String = ChessGame.STARTING_FEN,
    val isPlaying: Boolean = false,
    val playbackSpeedMs: Long = 1500L,
    val isLoadingMoves: Boolean = false,
    val error: String? = null,
)

data class ReplayMove(
    val moveNumber: Int,
    val from: String,
    val to: String,
    val san: String,
    val fen: String = "",
    val promotion: String? = null,
)

enum class GameResult { WON, LOST, DRAW }
enum class ResultFilter { ALL, WON, LOST, DRAW }
enum class ColorFilter { ALL, WHITE, BLACK }
enum class ModeFilter { ALL, CASUAL, RATED }
