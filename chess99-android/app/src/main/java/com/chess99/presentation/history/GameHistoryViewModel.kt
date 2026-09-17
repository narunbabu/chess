package com.chess99.presentation.history

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.GameApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.domain.model.*
import com.chess99.engine.ChessGame
import com.chess99.engine.EngineFailureCopy
import com.chess99.engine.PositionAnalysis
import com.chess99.engine.StockfishEngine
import com.chess99.engine.detectOpening
import com.chess99.presentation.common.MoveReplay
import com.chess99.presentation.common.ReplayPly
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber

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
    private val stockfishEngine: StockfishEngine,
    private val shareManager: com.chess99.presentation.social.ShareManager,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    companion object {
        private const val PAGE_SIZE = 20
        private const val AUTOPLAY_DEFAULT_SPEED_MS = 1500L
        private const val AUTOPLAY_MIN_SPEED_MS = 500L
        private const val AUTOPLAY_MAX_SPEED_MS = 3000L
        private const val ANALYSIS_DEPTH = 18
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
                    val gamesArray = body.get("games")?.arrOrNull()
                        ?: body.get("data")?.arrOrNull()
                        ?: run {
                            // Try unwrapping from paginated response
                            body.get("games")?.objOrNull()?.get("data")?.arrOrNull()
                        }

                    // Null-safe parse: a single junk/JsonNull entry from prod
                    // must not crash the whole list (was a ClassCastException
                    // via el.asJsonObject before this fix).
                    val parsedGames = gamesArray
                        ?.mapNotNull { el -> el.objOrNull()?.let { runCatching { parseGameSummary(it) }.getOrNull() } }
                        ?: emptyList()

                    val totalPages = body.get("last_page")?.asInt
                        ?: body.get("games")?.objOrNull()?.get("last_page")?.asInt
                        ?: body.get("meta")?.objOrNull()?.get("last_page")?.asInt
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
                        error = context.getString(R.string.history_load_failed),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading games")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    isLoadingMore = false,
                    error = friendlyError(context, e, R.string.error_subject_your_games),
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
                    val gameData = body.get("game")?.objOrNull() ?: body
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
                        error = context.getString(R.string.history_load_game_failed_code, response.code()),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading game $gameId")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = friendlyError(context, e, R.string.error_subject_this_game),
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
                    val movesElement = body.get("moves") ?: body.get("data")
                    val moves = when {
                        movesElement?.isJsonArray == true -> movesElement.asJsonArray.mapNotNull { el ->
                            val m = el.objOrNull() ?: return@mapNotNull null
                            ReplayMove(
                                moveNumber = m.int("move_number") ?: 0,
                                from = m.str("from") ?: "",
                                to = m.str("to") ?: "",
                                san = m.str("san") ?: m.str("notation") ?: "",
                                fen = m.str("fen") ?: "",
                                promotion = m.str("promotion"),
                                lifelines = LifelineMarkers.fromMoveJson(m),
                            )
                        }
                        movesElement?.isJsonPrimitive == true -> parseCompactMoves(movesElement.asString)
                        else -> emptyList()
                    }

                    // Build FEN positions for navigation, plus the squares
                    // each ply touched so the board can highlight and animate it.
                    val (fenPositions, plies) = buildReplay(moves)

                    _uiState.value = _uiState.value.copy(
                        replayState = ReplayState(
                            moves = moves,
                            fenPositions = fenPositions,
                            plies = plies,
                            currentMoveIndex = -1, // Start at initial position
                            currentFen = ChessGame.STARTING_FEN,
                            isLoadingMoves = false,
                        ),
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        replayState = _uiState.value.replayState?.copy(
                            isLoadingMoves = false,
                            error = context.getString(R.string.history_load_moves_failed),
                        ),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading moves for game $gameId")
                _uiState.value = _uiState.value.copy(
                    replayState = _uiState.value.replayState?.copy(
                        isLoadingMoves = false,
                        error = friendlyError(context, e, R.string.error_subject_the_moves),
                    ),
                )
            }
        }
    }

    /**
     * Replay the move list through the engine, producing both the FEN of every
     * position (index 0 = start, index N = after move N) and the ply that
     * produced it (index N = move N), so the review board can highlight and
     * animate the move it is showing.
     *
     * The server's own FEN still wins for the position when it sends one — the
     * ply is resolved against the pre-move board either way, so a move the
     * engine cannot reproduce simply gets no highlight rather than a wrong one.
     */
    private fun buildReplay(moves: List<ReplayMove>): Pair<List<String>, List<ReplayPly?>> {
        val positions = mutableListOf<String>()
        val plies = mutableListOf<ReplayPly?>()
        val game = ChessGame()
        positions.add(game.fen()) // Starting position

        for (move in moves) {
            // Identify the move without playing it, so `captured` is read off
            // the board as it stood before the piece landed.
            val found = move.san.takeIf { it.isNotBlank() }
                ?.let { MoveReplay.findLegal(game, it) }
                ?: coordinateToken(move)?.let { MoveReplay.findLegal(game, it) }

            val san = found?.san(game)
            val effects = found?.let { MoveReplay.effectsOf(it) }

            val fen = when {
                move.fen.isNotBlank() -> {
                    game.load(move.fen)
                    move.fen
                }
                found != null && game.moveUci(found.uci()) != null -> game.fen()
                // Unplayable move: hold the position so later indices still line up.
                else -> game.fen()
            }
            positions.add(fen)

            plies.add(
                if (found != null && san != null && effects != null) {
                    ReplayPly(
                        token = move.san.ifBlank { coordinateToken(move) ?: "" },
                        san = san,
                        from = found.from,
                        to = found.to,
                        effects = effects,
                        fenAfter = fen,
                    )
                } else {
                    null
                },
            )
        }

        return positions to plies
    }

    /** "e2e4" / "e7e8q" from a move that only carries from/to, else null. */
    private fun coordinateToken(move: ReplayMove): String? {
        if (move.from.isBlank() || move.to.isBlank()) return null
        return move.from + move.to + (move.promotion ?: "")
    }

    private fun parseCompactMoves(compact: String): List<ReplayMove> = compact
        .split(';')
        .mapIndexedNotNull { index, part ->
            val fields = part.split(',')
            val san = fields.firstOrNull()?.trim().orEmpty()
            if (san.isBlank()) return@mapIndexedNotNull null
            ReplayMove(
                moveNumber = index + 1,
                from = "",
                to = "",
                san = san,
                lifelines = LifelineMarkers.fromCompactToken(fields.getOrNull(4)),
            )
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
        // Opening header
        state.analysisReport?.openingName?.let { opening ->
            sb.appendLine("[Opening \"$opening\"]")
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

    /**
     * Fetch PGN from the backend API. Falls back to local generation on failure.
     */
    suspend fun fetchPgnFromServer(): String {
        val gameId = _uiState.value.expandedGameId ?: return generatePgn()
        return try {
            val response = gameApi.getPgn(gameId)
            if (response.isSuccessful) {
                response.body()?.string() ?: generatePgn()
            } else {
                Timber.w("PGN API returned ${response.code()}, using local generation")
                generatePgn()
            }
        } catch (e: Exception) {
            Timber.w(e, "Failed to fetch PGN from server, using local generation")
            generatePgn()
        }
    }

    /**
     * Fetch PGN from server and share as file via Android share sheet.
     */
    fun exportPgn(context: android.content.Context) {
        viewModelScope.launch {
            val gameId = _uiState.value.expandedGameId ?: return@launch
            val pgn = fetchPgnFromServer()
            if (pgn.isNotBlank()) {
                shareManager.sharePgnFile(context, pgn, gameId)
            }
        }
    }

    // ── Parsing ───────────────────────────────────────────────────────

    private fun parseGameSummary(json: JsonObject): GameSummary {
        val id = json.int("id") ?: 0

        // Determine opponent — API may structure this differently
        val opponentName = json.str("opponent_name")
            ?: json.get("opponent")?.objOrNull().str("name")
            ?: json.str("white_player_name")
            ?: context.getString(R.string.player_unknown)

        val playerColor = json.str("player_color")
            ?: json.str("color")
            ?: "white"

        // Result
        val resultStr = json.str("result")
            ?: json.str("winner")
            ?: json.str("status")
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
                val winnerId = json.int("winner_id")
                val userId = json.int("user_id")
                when {
                    winnerId == null || winnerId == 0 -> GameResult.DRAW
                    winnerId == userId -> GameResult.WON
                    else -> GameResult.LOST
                }
            }
        }

        val timeControl = json.str("time_control")
            ?: json.str("time_setting")
            ?: ""

        val gameMode = json.str("game_mode")
            ?: json.str("mode")
            ?: "casual"

        val ratingChange = json.int("rating_change")
            ?: json.int("rating_diff")
            ?: 0

        val playedAt = json.str("played_at")
            ?: json.str("created_at")
            ?: json.str("completed_at")
            ?: ""

        val totalMoves = json.int("total_moves")
            ?: json.int("moves_count")
            ?: 0

        val endReason = json.str("end_reason")
            ?: json.str("termination")
            ?: ""

        val opponentRating = json.int("opponent_rating")
            ?: json.get("opponent")?.objOrNull().int("rating")
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

    // ── Game Analysis ──────────────────────────────────────────────────

    fun triggerAnalysis(gameId: Int) {
        val state = _uiState.value
        if (state.analysisReport?.status == AnalysisStatus.LOADING) return

        _uiState.value = state.copy(
            analysisReport = GameAnalysisReport(status = AnalysisStatus.LOADING),
        )

        viewModelScope.launch {
            // First, try to fetch existing analysis from backend
            try {
                val existingResponse = gameApi.getGameAnalysis(gameId)
                if (existingResponse.isSuccessful) {
                    val body = existingResponse.body()
                    if (body != null && body.has("moves") && body.getAsJsonArray("moves").size() > 0) {
                        val report = parseExistingAnalysis(body)
                        _uiState.value = _uiState.value.copy(
                            analysisReport = report.copy(status = AnalysisStatus.DONE),
                        )
                        return@launch
                    }
                }
            } catch (e: Exception) {
                Timber.d(e, "No existing analysis found, proceeding to generate")
            }

            // Try to trigger new backend analysis
            try {
                val response = gameApi.analyzeGame(gameId)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val analysisJson = body.getAsJsonObject("analysis") ?: body
                    val report = parseAnalysisReport(analysisJson)
                    _uiState.value = _uiState.value.copy(
                        analysisReport = report.copy(status = AnalysisStatus.DONE),
                    )
                } else {
                    Timber.w("Backend analysis failed (${response.code()}), falling back to local analysis")
                    runLocalAnalysis()
                }
            } catch (e: Exception) {
                Timber.w(e, "Network error during analysis, falling back to local analysis")
                runLocalAnalysis()
            }
        }
    }

    /**
     * Run Stockfish analysis locally on device.
     * Evaluates each position, classifies moves, computes accuracy.
     *
     * Accuracy uses exponential decay formula matching Lichess:
     *   accuracy = 103.1668 * exp(-0.0272 * acpl) - 3.1668
     *
     * Brilliant move detection: the player's move is within 0.1 pawns of the
     * best move AND there was a significant gap (>= 0.5 pawns) between the
     * best move and the second-best alternative.
     */
    private suspend fun runLocalAnalysis() {
        val replay = _uiState.value.replayState ?: run {
            _uiState.value = _uiState.value.copy(
                analysisReport = GameAnalysisReport(
                    status = AnalysisStatus.ERROR,
                    error = context.getString(R.string.history_no_moves_loaded),
                ),
            )
            return
        }
        if (replay.moves.isEmpty()) {
            _uiState.value = _uiState.value.copy(
                analysisReport = GameAnalysisReport(
                    status = AnalysisStatus.ERROR,
                    error = context.getString(R.string.history_no_moves_to_analyze),
                ),
            )
            return
        }

        // Isolate engine startup so a "couldn't start" failure gets the honest,
        // kid-safe copy (S2 T4) instead of being caught by the broader analysis
        // try/catch below, which reports genuine mid-analysis bugs. Both clauses
        // show the same friendly copy — newGame()'s UCI handshake (non-init) can
        // also fail, and the engine is equally unusable for this session either way.
        try {
            stockfishEngine.initialize()
            stockfishEngine.newGame()
        } catch (e: Exception) {
            Timber.e(e, "Stockfish failed to start for game review analysis")
            _uiState.value = _uiState.value.copy(
                analysisReport = GameAnalysisReport(
                    status = AnalysisStatus.ERROR,
                    error = context.getString(EngineFailureCopy.MESSAGE),
                ),
            )
            return
        }

        try {
            val fenPositions = replay.fenPositions
            val totalPositions = fenPositions.size

            // Cache full position analyses (eval + bestMove + rankedMoves)
            val positionAnalyses = mutableListOf<PositionAnalysis>()
            for ((idx, fen) in fenPositions.withIndex()) {
                // Update progress
                val progress = ((idx + 1).toFloat() / totalPositions * 100).toInt()
                _uiState.value = _uiState.value.copy(
                    analysisReport = GameAnalysisReport(
                        status = AnalysisStatus.LOADING,
                        progress = progress,
                    ),
                )
                positionAnalyses.add(stockfishEngine.analyzePosition(fen, ANALYSIS_DEPTH))
            }

            // Detect opening from SAN moves
            val sanMoves = replay.moves.map { it.san }
            val openingName = detectOpening(sanMoves)

            // Convert mate scores to large centipawn values for consistent handling
            fun evalToCp(analysis: PositionAnalysis): Int {
                if (analysis.isMate) {
                    return if (analysis.evalCp > 0) 100000 - kotlin.math.abs(analysis.evalCp)
                    else -100000 + kotlin.math.abs(analysis.evalCp)
                }
                return analysis.evalCp
            }

            // Classify each move using cached analyses
            val analyzedMoves = mutableListOf<AnalyzedMove>()
            var whiteCpLoss = 0
            var blackCpLoss = 0
            var whiteMoveCount = 0
            var blackMoveCount = 0

            for (i in replay.moves.indices) {
                val move = replay.moves[i]
                val before = positionAnalyses.getOrElse(i) { PositionAnalysis(0, false, 0, "", emptyList()) }
                val after = positionAnalyses.getOrElse(i + 1) { before }

                val evalBeforeCp = evalToCp(before)
                val evalAfterCp = evalToCp(after)

                val isWhite = (i % 2 == 0)
                // CP loss from the moving player's perspective
                val cpLoss = if (isWhite) {
                    (evalBeforeCp - evalAfterCp).coerceAtLeast(0)
                } else {
                    (evalAfterCp - evalBeforeCp).coerceAtLeast(0)
                }

                val playerMoveUci = move.from + move.to
                val isPlayerMove = playerMoveUci.equals(before.bestMove, ignoreCase = true)
                val classification = classifyMoveDetailed(
                    cpLoss = cpLoss,
                    isPlayerMove = isPlayerMove,
                    rankedMoves = before.rankedMoves,
                )

                analyzedMoves.add(AnalyzedMove(
                    moveNumber = move.moveNumber,
                    color = if (isWhite) "white" else "black",
                    san = move.san,
                    from = move.from,
                    to = move.to,
                    evalBeforeCp = evalBeforeCp,
                    evalAfterCp = evalAfterCp,
                    cpLoss = cpLoss,
                    bestMove = before.bestMove,
                    classification = classification,
                    isMateBefore = before.isMate,
                    isMateAfter = after.isMate,
                ))

                if (isWhite) {
                    whiteCpLoss += cpLoss
                    whiteMoveCount++
                } else {
                    blackCpLoss += cpLoss
                    blackMoveCount++
                }
            }

            // Accuracy using exponential decay (Lichess-style formula)
            val acplWhite = if (whiteMoveCount > 0) whiteCpLoss.toFloat() / whiteMoveCount else 0f
            val acplBlack = if (blackMoveCount > 0) blackCpLoss.toFloat() / blackMoveCount else 0f
            val accuracyWhite = computeAccuracy(acplWhite)
            val accuracyBlack = computeAccuracy(acplBlack)

            // Count quality per side
            val whiteCounts = mutableMapOf<String, Int>()
            val blackCounts = mutableMapOf<String, Int>()
            for (am in analyzedMoves) {
                val key = am.classification.name.lowercase()
                val counts = if (am.color == "white") whiteCounts else blackCounts
                counts[key] = (counts[key] ?: 0) + 1
            }

            _uiState.value = _uiState.value.copy(
                analysisReport = GameAnalysisReport(
                    status = AnalysisStatus.DONE,
                    moveAnalyses = analyzedMoves,
                    accuracyWhite = accuracyWhite,
                    accuracyBlack = accuracyBlack,
                    acplWhite = acplWhite,
                    acplBlack = acplBlack,
                    qualityCounts = QualityCounts(white = whiteCounts, black = blackCounts),
                    openingName = openingName,
                ),
            )
        } catch (e: Exception) {
            Timber.e(e, "Local Stockfish analysis failed")
            // Never surface e.message — kid-safe copy (master plan rule 6).
            _uiState.value = _uiState.value.copy(
                analysisReport = GameAnalysisReport(
                    status = AnalysisStatus.ERROR,
                    error = context.getString(R.string.history_analysis_failed),
                ),
            )
        }
    }

    /**
     * Compute accuracy percentage from ACPL using exponential decay.
     * Formula: accuracy = 103.1668 * e^(-0.0272 * acpl) - 3.1668
     * Matches Lichess accuracy calculation.
     */
    private fun computeAccuracy(acpl: Float): Float {
        return (103.1668 * kotlin.math.exp(-0.0272 * acpl) - 3.1668)
            .toFloat().coerceIn(0f, 100f)
    }

    /**
     * Classify a move with Brilliant detection.
     *
     * Brilliant: player found the best (or near-best) move AND the gap between
     * the best and second-best was >= 50cp (0.5 pawns), indicating it was a
     * non-obvious strong move.
     *
     * Other classifications based on centipawn loss thresholds matching
     * chess-frontend MoveAnalysisService:
     *   Excellent: <= 10cp loss
     *   Good:      <= 30cp loss
     *   Inaccuracy: 30-70cp loss
     *   Mistake:    70-200cp loss
     *   Blunder:    > 200cp loss
     */
    private fun classifyMoveDetailed(
        cpLoss: Int,
        isPlayerMove: Boolean,
        rankedMoves: List<com.chess99.engine.RankedMove>,
    ): MoveClassification {
        // Check for Brilliant: played the best move AND it was significantly
        // better than alternatives (>= 50cp gap between rank 1 and rank 2)
        if (cpLoss <= 10 && isPlayerMove && rankedMoves.size >= 2) {
            val sorted = rankedMoves.sortedBy { it.rank }
            if (sorted.size >= 2) {
                val best = sorted[0]
                val second = sorted[1]
                val gap = kotlin.math.abs(best.score - second.score)
                if (gap >= 50) {
                    return MoveClassification.BRILLIANT
                }
            }
        }
        return classifyMove(cpLoss)
    }

    /**
     * Classify a move based on centipawn loss.
     * Thresholds match chess-frontend MoveAnalysisService.
     */
    private fun classifyMove(cpLoss: Int): MoveClassification = when {
        cpLoss <= 10 -> MoveClassification.EXCELLENT
        cpLoss <= 30 -> MoveClassification.GOOD
        cpLoss <= 70 -> MoveClassification.INACCURACY
        cpLoss <= 200 -> MoveClassification.MISTAKE
        else -> MoveClassification.BLUNDER
    }

    /**
     * Parse existing analysis from GET /api/v1/games/{id}/analysis endpoint.
     * Response format: { moves: [...], move_count: N }
     */
    private fun parseExistingAnalysis(json: JsonObject): GameAnalysisReport {
        val movesArray = json.getAsJsonArray("moves") ?: JsonArray()
        val moveAnalyses = mutableListOf<AnalyzedMove>()
        var whiteCpLossTotal = 0
        var blackCpLossTotal = 0
        var whiteMoveCount = 0
        var blackMoveCount = 0

        for (el in movesArray) {
            val m = el.asJsonObject
            val classificationStr = m.get("classification")?.asString ?: "good"
            val color = m.get("player_color")?.asString ?: "white"
            val cpLoss = m.get("cp_loss")?.asInt ?: 0

            moveAnalyses.add(AnalyzedMove(
                moveNumber = m.get("move_number")?.asInt ?: 0,
                color = color,
                san = m.get("move_san")?.asString ?: "",
                from = m.get("from_square")?.asString ?: "",
                to = m.get("to_square")?.asString ?: "",
                evalBeforeCp = m.get("eval_before_cp")?.asInt ?: 0,
                evalAfterCp = m.get("eval_after_cp")?.asInt ?: 0,
                cpLoss = cpLoss,
                bestMove = m.get("best_move")?.asString,
                classification = parseClassification(classificationStr),
            ))

            if (color == "white") {
                whiteCpLossTotal += cpLoss
                whiteMoveCount++
            } else {
                blackCpLossTotal += cpLoss
                blackMoveCount++
            }
        }

        val acplWhite = if (whiteMoveCount > 0) whiteCpLossTotal.toFloat() / whiteMoveCount else 0f
        val acplBlack = if (blackMoveCount > 0) blackCpLossTotal.toFloat() / blackMoveCount else 0f

        // Count quality per side
        val whiteCounts = mutableMapOf<String, Int>()
        val blackCounts = mutableMapOf<String, Int>()
        for (am in moveAnalyses) {
            val key = am.classification.name.lowercase()
            val counts = if (am.color == "white") whiteCounts else blackCounts
            counts[key] = (counts[key] ?: 0) + 1
        }

        return GameAnalysisReport(
            moveAnalyses = moveAnalyses,
            accuracyWhite = computeAccuracy(acplWhite),
            accuracyBlack = computeAccuracy(acplBlack),
            acplWhite = acplWhite,
            acplBlack = acplBlack,
            qualityCounts = QualityCounts(white = whiteCounts, black = blackCounts),
            openingName = json.get("opening_name")?.asString,
        )
    }

    private fun parseAnalysisReport(json: JsonObject): GameAnalysisReport {
        val moveAnalysesJson = json.getAsJsonArray("move_analyses") ?: JsonArray()
        val moveAnalyses = mutableListOf<AnalyzedMove>()
        for (el in moveAnalysesJson) {
            val m = el.asJsonObject
            val classificationStr = m.get("classification")?.asString ?: "good"
            moveAnalyses.add(AnalyzedMove(
                moveNumber = m.get("move_number")?.asInt ?: 0,
                color = m.get("color")?.asString ?: "white",
                san = m.get("san")?.asString ?: "",
                from = m.get("from")?.asString ?: "",
                to = m.get("to")?.asString ?: "",
                evalBeforeCp = m.get("eval_before_cp")?.asInt ?: 0,
                evalAfterCp = m.get("eval_after_cp")?.asInt ?: 0,
                cpLoss = m.get("cp_loss")?.asInt ?: 0,
                bestMove = m.get("best_move")?.asString,
                classification = parseClassification(classificationStr),
            ))
        }

        val qualityCountsJson = json.getAsJsonObject("quality_counts")
        val whiteCounts = mutableMapOf<String, Int>()
        val blackCounts = mutableMapOf<String, Int>()
        if (qualityCountsJson != null) {
            val wObj = qualityCountsJson.getAsJsonObject("white")
            val bObj = qualityCountsJson.getAsJsonObject("black")
            wObj?.entrySet()?.forEach { e -> whiteCounts[e.key] = e.value.asInt }
            bObj?.entrySet()?.forEach { e -> blackCounts[e.key] = e.value.asInt }
        }

        return GameAnalysisReport(
            moveAnalyses = moveAnalyses,
            accuracyWhite = json.get("accuracy_white")?.asFloat?.let { it / 1f } ?: 0f,
            accuracyBlack = json.get("accuracy_black")?.asFloat?.let { it / 1f } ?: 0f,
            acplWhite = json.get("acpl_white")?.asFloat ?: 0f,
            acplBlack = json.get("acpl_black")?.asFloat ?: 0f,
            qualityCounts = QualityCounts(white = whiteCounts, black = blackCounts),
        )
    }

    private fun parseClassification(str: String): MoveClassification {
        return when (str.lowercase()) {
            "brilliant" -> MoveClassification.BRILLIANT
            "excellent" -> MoveClassification.EXCELLENT
            "good" -> MoveClassification.GOOD
            "inaccuracy" -> MoveClassification.INACCURACY
            "mistake" -> MoveClassification.MISTAKE
            "blunder" -> MoveClassification.BLUNDER
            "book" -> MoveClassification.BOOK
            else -> MoveClassification.GOOD
        }
    }

    // ── Cleanup ───────────────────────────────────────────────────────

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    override fun onCleared() {
        super.onCleared()
        autoPlayJob?.cancel()
        stockfishEngine.shutdown()
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

    // Analysis
    val analysisReport: GameAnalysisReport? = null,
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
    /** Squares touched by each move, aligned with [moves]; null where unresolvable. */
    val plies: List<ReplayPly?> = emptyList(),
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
    val lifelines: List<String> = emptyList(),
)

enum class GameResult { WON, LOST, DRAW }
enum class ResultFilter { ALL, WON, LOST, DRAW }
enum class ColorFilter { ALL, WHITE, BLACK }
enum class ModeFilter { ALL, CASUAL, RATED }
