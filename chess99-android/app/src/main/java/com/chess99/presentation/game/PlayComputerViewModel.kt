package com.chess99.presentation.game

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.domain.model.SyntheticPlayer
import com.chess99.engine.*
import com.chess99.presentation.history.LocalGameReviewRecord
import com.chess99.presentation.history.LocalGameReviewStore
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber

/**
 * ViewModel for PlayComputer screen.
 * Manages the full game loop: setup, moves, engine integration,
 * undo system, timer, game completion.
 *
 * Matches web frontend PlayComputer.js behavior.
 */
@HiltViewModel
class PlayComputerViewModel @Inject constructor(
    private val stockfishEngine: StockfishEngine,
    private val matchmakingApi: MatchmakingApi,
    private val gameApi: GameApi,
    val shareManager: com.chess99.presentation.social.ShareManager,
    private val localGameReviewStore: LocalGameReviewStore,
    // Injected so the game-end and failure copy below can come from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    companion object {
        const val DEFAULT_TIME_SECONDS = 600 // 10 minutes

        /** Default helpline pool size for Learning mode — mirrors web's
         *  DEFAULT_LEARNING_HELP_LIMIT (LEARNING_HELP_OPTIONS = [1,3,5,7], default 5).
         *  In Learning mode the undo budget == this helpline pool. */
        const val DEFAULT_LEARNING_HELP_LIMIT = 5
    }

    // ── Game State ───────────────────────────────────────────────────

    private val _uiState = MutableStateFlow(PlayComputerUiState())
    val uiState: StateFlow<PlayComputerUiState> = _uiState.asStateFlow()

    // ── Bot Personas (T5) ───────────────────────────────────────────────
    // Chip row above the difficulty slider. Cached for the VM's lifetime;
    // offline/error leaves the list empty so the row hides (slider still works).

    private val _personaState = MutableStateFlow(PersonaUiState())
    val personaState: StateFlow<PersonaUiState> = _personaState.asStateFlow()

    private var game = ChessGame()
    private var gameGeneration = 0L
    private var startGameJob: Job? = null
    private var computerMoveJob: Job? = null
    private var bestMoveJob: Job? = null
    private var timerJob: Job? = null

    // ── Setup ────────────────────────────────────────────────────────

    fun setupGame(
        playerColor: Color = Color.WHITE,
        difficulty: Int = StockfishEngine.DEFAULT_DEPTH,
        mode: GameMode = GameMode.CASUAL,
        learningHelpLimit: Int = DEFAULT_LEARNING_HELP_LIMIT,
    ) {
        startGameJob?.cancel()
        computerMoveJob?.cancel()
        bestMoveJob?.cancel()
        timerJob?.cancel()
        gameGeneration += 1
        game = ChessGame()
        val isRated = mode == GameMode.RATED
        // Learning mode: undo budget == the helpline pool (default 5), mirroring
        // web's `undoChancesRemaining = learningHelpLimit`. Casual keeps its
        // per-difficulty budget; rated has none.
        val undoChances = when (mode) {
            GameMode.LEARNING -> learningHelpLimit
            else -> StockfishEngine.undoChances(difficulty, isRated)
        }

        _uiState.value = PlayComputerUiState(
            fen = game.fen(),
            playerColor = playerColor,
            computerColor = playerColor.opposite(),
            difficulty = difficulty,
            gameMode = mode,
            isRated = isRated,
            learningMode = mode == GameMode.LEARNING,
            gamePhase = GamePhase.SETUP,
            undoChancesRemaining = undoChances,
            maxUndoChances = undoChances,
            playerTimeSeconds = DEFAULT_TIME_SECONDS,
            computerTimeSeconds = DEFAULT_TIME_SECONDS,
        )
    }

    /** Applies a persona's [SyntheticPlayer.computerLevel] to the setup slider (T5). */
    fun selectPersona(persona: SyntheticPlayer) {
        _personaState.value = _personaState.value.copy(selectedPersona = persona)
        setupGame(
            playerColor = _uiState.value.playerColor,
            difficulty = persona.computerLevel,
            mode = GameMode.CASUAL, // Persona games are casual only (spec T3 defaults).
        )
        _uiState.value = _uiState.value.copy(opponentDisplayName = persona.name)
    }

    /** Deselects the persona — slider reverts to a plain "Custom" computer game. */
    fun clearPersonaSelection() {
        _personaState.value = _personaState.value.copy(selectedPersona = null)
        _uiState.value = _uiState.value.copy(opponentDisplayName = null)
    }

    // ── Bot Personas (T5) ────────────────────────────────────────────

    /** Loads persona chips; cached for this VM's lifetime. Offline/error → empty list (row hides). */
    fun loadPersonas() {
        if (_personaState.value.personas.isNotEmpty() || _personaState.value.isLoading) return
        viewModelScope.launch {
            _personaState.value = _personaState.value.copy(isLoading = true)
            try {
                val response = matchmakingApi.getSyntheticPlayers()
                if (!response.isSuccessful) {
                    _personaState.value = _personaState.value.copy(isLoading = false)
                    return@launch
                }
                val dataArray = response.body()?.getAsJsonArray("data")
                val players = dataArray?.map { el ->
                    val obj = el.asJsonObject
                    SyntheticPlayer(
                        id = obj.get("id")?.asInt ?: 0,
                        name = obj.get("name")?.asString ?: context.getString(R.string.companion_default_name),
                        rating = obj.get("rating")?.asInt ?: 1200,
                        computerLevel = obj.get("computer_level")?.asInt ?: StockfishEngine.DEFAULT_DEPTH,
                        personality = obj.get("personality")?.asString ?: "Balanced",
                        bio = obj.get("bio")?.asString ?: "",
                        avatarUrl = obj.get("avatar_url")?.asString ?: "",
                        gamesPlayed = obj.get("games_played")?.asInt ?: 0,
                        winRate = obj.get("win_rate")?.asDouble ?: 50.0,
                    )
                } ?: emptyList()
                _personaState.value = _personaState.value.copy(isLoading = false, personas = players)
            } catch (e: Exception) {
                // Kid-safe: no error surfaced, no spinner left behind — the row
                // simply doesn't appear (spec T5 "offline → hide row").
                Timber.e(e, "Failed to load bot personas")
                _personaState.value = _personaState.value.copy(isLoading = false)
            }
        }
    }

    /**
     * Starts a server-recorded game vs the selected persona (T3 flow): 10+0,
     * random color, casual by default or rated when [rated] is set (a rated bot
     * game applies Elo server-side). Mirrors web's Dashboard.js nearby-opponent
     * tap defaults. On success emits the new game id via [PersonaUiState.startedGameId]
     * for the screen to navigate into [com.chess99.presentation.navigation.Screen.PlayMultiplayer].
     * On failure (offline, server error) leaves [PersonaUiState.startedGameId] null
     * and the screen falls back to the plain local Stockfish flow already wired
     * to the slider (persona's level is already applied via [selectPersona]).
     */
    fun startPersonaGame(persona: SyntheticPlayer, mode: GameMode = GameMode.CASUAL) {
        // The screen calls setupGame() immediately before this (to apply
        // color/difficulty/rated), which rebuilds PlayComputerUiState from
        // scratch and would otherwise wipe opponentDisplayName back to null —
        // re-apply it here so the top bar/opponent label never regress to
        // "Play vs Computer" / "Computer (Lv.N)" for a persona game (T4/T5:
        // never show the generic computer label for a named bot).
        _uiState.value = _uiState.value.copy(opponentDisplayName = persona.name)
        viewModelScope.launch {
            _personaState.value = _personaState.value.copy(isStartingGame = true, startGameError = null)
            try {
                val body = JsonObject().apply {
                    addProperty("player_color", if (_uiState.value.playerColor == Color.WHITE) "white" else "black")
                    addProperty("computer_level", persona.computerLevel)
                    addProperty("time_control", 10)
                    addProperty("increment", 0)
                    addProperty("synthetic_player_id", persona.id)
                    // Rated bot games are server-supported: game_mode=rated makes
                    // GameController::completeGame apply Elo (applyRatedSyntheticElo).
                    // Learning is not rated → game_mode=casual, plus learning_mode=true
                    // (mirrors web PlayComputer.js: backendRatedMode='casual' for learning).
                    addProperty("game_mode", if (mode == GameMode.RATED) "rated" else "casual")
                    if (mode == GameMode.LEARNING) addProperty("learning_mode", true)
                }
                val response = gameApi.createComputerGame(body)
                if (response.isSuccessful) {
                    val gameId = response.body()?.getAsJsonObject("game")?.get("id")?.asInt
                        ?: response.body()?.get("id")?.asInt
                    if (gameId != null) {
                        _personaState.value = _personaState.value.copy(
                            isStartingGame = false,
                            startedGameId = gameId,
                        )
                        return@launch
                    }
                }
                _personaState.value = _personaState.value.copy(
                    isStartingGame = false,
                    startGameError = "fallback_local",
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to start persona game, falling back to local play")
                _personaState.value = _personaState.value.copy(
                    isStartingGame = false,
                    startGameError = "fallback_local",
                )
            }
        }
    }

    fun consumeStartedGameId() {
        _personaState.value = _personaState.value.copy(startedGameId = null)
    }

    fun consumeStartGameError() {
        _personaState.value = _personaState.value.copy(startGameError = null)
    }

    fun startGame() {
        if (_uiState.value.gamePhase != GamePhase.SETUP || startGameJob?.isActive == true) return
        // Elo requires a successfully created server game; never silently play
        // a rated game locally after a failed persona request.
        if (_uiState.value.isRated) {
            _uiState.value = _uiState.value.copy(
                error = context.getString(R.string.pc_rated_needs_online),
            )
            return
        }
        val expectedGeneration = gameGeneration
        startGameJob = viewModelScope.launch {
            // Initialize engine
            try {
                stockfishEngine.initialize()
                stockfishEngine.newGame()
            } catch (e: CancellationException) {
                throw e
            } catch (e: EngineInitException) {
                if (expectedGeneration == gameGeneration && _uiState.value.gamePhase == GamePhase.SETUP) {
                    _uiState.value = _uiState.value.copy(
                        error = context.getString(EngineFailureCopy.MESSAGE),
                        engineInitFailed = true,
                    )
                }
                return@launch
            } catch (e: Exception) {
                // Non-init failure (e.g. newGame()'s UCI handshake) — same honest
                // copy; still offer the puzzle redirect since the engine is
                // unusable for this session either way.
                if (expectedGeneration == gameGeneration && _uiState.value.gamePhase == GamePhase.SETUP) {
                    _uiState.value = _uiState.value.copy(
                        error = context.getString(EngineFailureCopy.MESSAGE),
                        engineInitFailed = true,
                    )
                }
                return@launch
            }

            // Engine setup can outlive a setup change or a rapid leave/restart.
            // Never let that stale callback start a clock or make a black move.
            if (expectedGeneration != gameGeneration || _uiState.value.gamePhase != GamePhase.SETUP) {
                return@launch
            }

            _uiState.value = _uiState.value.copy(
                gamePhase = GamePhase.PLAYING,
                activeTimer = Color.WHITE,
                isTimerRunning = true,
            )

            startTimer()

            // If player is black, computer moves first
            if (_uiState.value.playerColor == Color.BLACK) {
                performComputerMove()
            }
        }
    }

    // ── Player Move ──────────────────────────────────────────────────

    fun onPlayerMove(from: String, to: String, promotion: Char?) {
        val state = _uiState.value
        if (state.gamePhase != GamePhase.PLAYING) return
        if (state.computerMoveInProgress) return
        if (game.turn != state.playerColor) return

        val move = game.move(from, to, promotion) ?: return

        // Determine sound
        val sound = when {
            game.isCheck() -> MoveSound.CHECK
            move.captured != Piece.NONE || move.isEnPassant -> MoveSound.CAPTURE
            else -> MoveSound.MOVE
        }

        // Update UI state
        val moveRecord = GameMoveRecord(
            moveNumber = game.historyVerbose().size,
            from = from,
            to = to,
            san = move.san(game),
            fen = game.fen(),
            playerColor = state.playerColor,
            captured = move.captured != Piece.NONE,
            lifelines = if (state.bestMoveUci != null) listOf("best-move") else emptyList(),
            promotion = promotion?.toString(),
        )

        _uiState.value = state.copy(
            fen = game.fen(),
            lastMoveFrom = move.from,
            lastMoveTo = move.to,
            moveHistory = state.moveHistory + moveRecord,
            activeTimer = state.computerColor,
            bestMoveFrom = -1,
            bestMoveTo = -1,
            bestMoveUci = null,
            soundToPlay = sound,
        )

        // Check for game over
        if (game.isGameOver()) {
            handleGameOver()
            return
        }

        // Computer's turn
        performComputerMove()
    }

    // ── Computer Move ────────────────────────────────────────────────

    private fun performComputerMove() {
        computerMoveJob?.cancel()
        computerMoveJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(computerMoveInProgress = true)
            val expectedGeneration = gameGeneration
            val expectedFen = game.fen()

            try {
                val result = stockfishEngine.getBestMove(
                    fen = expectedFen,
                    depth = _uiState.value.difficulty,
                    // Persona games play at the bot's ELO; plain difficulty games
                    // pass null (ELO derived from the difficulty level).
                    opponentElo = _personaState.value.selectedPersona?.rating,
                )

                // A cancelled native-engine request may still return. Applying it
                // to a replayed/undone/new position would corrupt the local game.
                if (expectedGeneration != gameGeneration ||
                    _uiState.value.gamePhase != GamePhase.PLAYING ||
                    game.fen() != expectedFen
                ) {
                    return@launch
                }

                val move = game.moveUci(result.bestMove) ?: run {
                    // Engine returned invalid move, try any legal move
                    val legal = game.legalMoves().firstOrNull()
                        ?: return@launch
                    game.moveSan(legal.san(game))
                } ?: return@launch

                val sound = when {
                    game.isCheck() -> MoveSound.CHECK
                    move.captured != Piece.NONE || move.isEnPassant -> MoveSound.CAPTURE
                    else -> MoveSound.MOVE
                }

                val state = _uiState.value
                val moveRecord = GameMoveRecord(
                    moveNumber = game.historyVerbose().size,
                    from = move.fromAlgebraic,
                    to = move.toAlgebraic,
                    san = move.san(game),
                    fen = game.fen(),
                    playerColor = state.computerColor,
                    captured = move.captured != Piece.NONE,
                )

                _uiState.value = state.copy(
                    fen = game.fen(),
                    lastMoveFrom = move.from,
                    lastMoveTo = move.to,
                    moveHistory = state.moveHistory + moveRecord,
                    activeTimer = state.playerColor,
                    computerMoveInProgress = false,
                    soundToPlay = sound,
                )

                if (game.isGameOver()) {
                    handleGameOver()
                }
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                // Never surface e.message — kid-safe copy (master plan rule 6).
                _uiState.value = _uiState.value.copy(
                    computerMoveInProgress = false,
                    error = context.getString(R.string.pc_engine_move_failed),
                )
            }
        }
    }

    // ── Best move ───────────────────────────────────────────────────

    /**
     * Reveals, but does not play, Stockfish's best legal move. Owner policy
     * (docs/specs/2026-07-18-undo-bestmove-parity/00-MASTER-PLAN.md): casual
     * games get unlimited reveals, Learning mode shares one budget between Best
     * and Undo, and rated games never get engine assistance. A Learning chance
     * is charged only after a current-position, legal result is ready, so
     * retries/failures cost nothing.
     */
    fun requestBestMove() {
        val state = _uiState.value
        if (state.isRated) return
        if (state.gamePhase != GamePhase.PLAYING || state.computerMoveInProgress) return
        if (state.bestMoveInProgress) return
        if (state.learningMode && state.undoChancesRemaining <= 0) return
        if (state.bestMoveUci != null) return // same-position reveal is already visible
        if (game.turn != state.playerColor) return

        val expectedGeneration = gameGeneration
        val expectedFen = game.fen()
        bestMoveJob?.cancel()
        bestMoveJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(bestMoveInProgress = true)
            try {
                val result = stockfishEngine.getBestMove(
                    fen = expectedFen,
                    depth = _uiState.value.difficulty,
                    opponentElo = null,
                )
                if (expectedGeneration != gameGeneration ||
                    game.fen() != expectedFen ||
                    _uiState.value.gamePhase != GamePhase.PLAYING ||
                    game.turn != _uiState.value.playerColor
                ) {
                    return@launch
                }

                val uci = result.bestMove.lowercase()
                if (uci.length !in 4..5) throw IllegalStateException("Invalid engine move")
                val from = uci.substring(0, 2)
                val to = uci.substring(2, 4)
                val promotion = uci.getOrNull(4)
                val legal = game.legalMovesFrom(from).any {
                    it.toAlgebraic == to &&
                        (promotion == null || it.uci().getOrNull(4) == promotion)
                }
                if (!legal) throw IllegalStateException("Engine move is not legal")

                val current = _uiState.value
                _uiState.value = current.copy(
                    bestMoveInProgress = false,
                    bestMoveFrom = Square.fromAlgebraic(from),
                    bestMoveTo = Square.fromAlgebraic(to),
                    bestMoveUci = uci,
                    undoChancesRemaining = if (current.learningMode) {
                        current.undoChancesRemaining - 1
                    } else {
                        current.undoChancesRemaining
                    },
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                if (expectedGeneration == gameGeneration && game.fen() == expectedFen) {
                    _uiState.value = _uiState.value.copy(
                        bestMoveInProgress = false,
                        error = if (_uiState.value.learningMode) {
                            context.getString(R.string.pc_best_move_unavailable_free)
                        } else {
                            context.getString(R.string.pc_best_move_unavailable)
                        },
                    )
                }
            } finally {
                if (expectedGeneration == gameGeneration && _uiState.value.bestMoveInProgress) {
                    _uiState.value = _uiState.value.copy(bestMoveInProgress = false)
                }
            }
        }
    }

    // ── Undo ─────────────────────────────────────────────────────────

    fun undoMove() {
        val state = _uiState.value
        if (state.isRated) return
        if (state.undoChancesRemaining <= 0) return
        if (state.computerMoveInProgress) return
        if (state.gamePhase != GamePhase.PLAYING) return
        if (game.turn != state.playerColor) return
        if (game.historyVerbose().size < 2) return

        // Undo computer's last move + player's last move
        game.undo() // Computer's move
        game.undo() // Player's move

        _uiState.value = state.copy(
            fen = game.fen(),
            lastMoveFrom = -1,
            lastMoveTo = -1,
            moveHistory = state.moveHistory.dropLast(2),
            undoChancesRemaining = state.undoChancesRemaining - 1,
            bestMoveFrom = -1,
            bestMoveTo = -1,
            bestMoveUci = null,
        )
    }

    // ── Resign ───────────────────────────────────────────────────────

    fun resign() {
        if (_uiState.value.gamePhase != GamePhase.PLAYING) return
        computerMoveJob?.cancel()

        completeGame(
            GameResultState(
                status = ResultStatus.LOST,
                endReason = EndReason.RESIGNATION,
                winner = Winner.OPPONENT,
                details = context.getString(R.string.end_resign_you),
            ),
        )
    }

    // ── Game Over ────────────────────────────────────────────────────

    private fun handleGameOver() {
        computerMoveJob?.cancel()
        stopTimer()

        val state = _uiState.value
        val result = when {
            game.isCheckmate() -> {
                val winnerColor = game.turn.opposite()
                if (winnerColor == state.playerColor) {
                    GameResultState(
                        status = ResultStatus.WON,
                        endReason = EndReason.CHECKMATE,
                        winner = Winner.PLAYER,
                        details = context.getString(R.string.end_checkmate_win),
                    )
                } else {
                    GameResultState(
                        status = ResultStatus.LOST,
                        endReason = EndReason.CHECKMATE,
                        winner = Winner.OPPONENT,
                        details = context.getString(R.string.end_checkmate_computer_wins),
                    )
                }
            }
            game.isStalemate() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.STALEMATE,
                winner = Winner.NONE,
                details = context.getString(R.string.end_draw_stalemate),
            )
            game.isInsufficientMaterial() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.INSUFFICIENT_MATERIAL,
                winner = Winner.NONE,
                details = context.getString(R.string.end_draw_insufficient),
            )
            game.isThreefoldRepetition() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.THREEFOLD_REPETITION,
                winner = Winner.NONE,
                details = context.getString(R.string.end_draw_threefold),
            )
            game.isFiftyMoveRule() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.FIFTY_MOVE_RULE,
                winner = Winner.NONE,
                details = context.getString(R.string.end_draw_fifty_move),
            )
            else -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.UNKNOWN,
                winner = Winner.NONE,
                details = context.getString(R.string.end_game_over),
            )
        }

        completeGame(result)
    }

    private fun completeGame(result: GameResultState) {
        startGameJob?.cancel()
        computerMoveJob?.cancel()
        bestMoveJob?.cancel()
        stopTimer()
        _uiState.value = _uiState.value.copy(
            gamePhase = GamePhase.COMPLETED,
            gameResult = result,
            isTimerRunning = false,
            computerMoveInProgress = false,
            bestMoveInProgress = false,
            soundToPlay = MoveSound.GAME_END,
        )
        persistCompletedReview()
    }

    private fun persistCompletedReview() {
        val state = _uiState.value
        val result = state.gameResult ?: return
        localGameReviewStore.save(
            LocalGameReviewRecord(
                startingFen = ChessGame.STARTING_FEN,
                moves = state.moveHistory,
                result = result,
                playerColor = state.playerColor,
                opponentName = state.opponentDisplayName ?: context.getString(R.string.pc_opponent_computer),
                difficulty = state.difficulty,
                gameMode = state.gameMode,
                completedAtEpochMillis = System.currentTimeMillis(),
            )
        )
    }

    // ── Timer ────────────────────────────────────────────────────────

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (isActive) {
                delay(1000)
                val state = _uiState.value
                if (!state.isTimerRunning || state.gamePhase != GamePhase.PLAYING) continue

                if (state.activeTimer == state.playerColor) {
                    val newTime = state.playerTimeSeconds - 1
                    if (newTime <= 0) {
                        _uiState.value = state.copy(playerTimeSeconds = 0)
                        completeGame(
                            GameResultState(
                                status = ResultStatus.LOST,
                                endReason = EndReason.TIMEOUT,
                                winner = Winner.OPPONENT,
                                details = context.getString(R.string.end_timeout_you),
                            )
                        )
                        return@launch
                    }
                    _uiState.value = state.copy(playerTimeSeconds = newTime)
                } else {
                    val newTime = state.computerTimeSeconds - 1
                    if (newTime <= 0) {
                        _uiState.value = state.copy(computerTimeSeconds = 0)
                        completeGame(
                            GameResultState(
                                status = ResultStatus.WON,
                                endReason = EndReason.TIMEOUT,
                                winner = Winner.PLAYER,
                                details = context.getString(R.string.end_timeout_computer),
                            )
                        )
                        return@launch
                    }
                    _uiState.value = state.copy(computerTimeSeconds = newTime)
                }
            }
        }
    }

    private fun stopTimer() {
        timerJob?.cancel()
    }

    // ── Sound Consumed ───────────────────────────────────────────────

    fun soundPlayed() {
        _uiState.value = _uiState.value.copy(soundToPlay = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null, engineInitFailed = false)
    }

    /** Starts another local game with the exact colour, difficulty and mode. */
    fun playAgain() {
        val previous = _uiState.value
        if (previous.gamePhase != GamePhase.COMPLETED) return
        setupGame(
            playerColor = previous.playerColor,
            difficulty = previous.difficulty,
            mode = previous.gameMode,
            learningHelpLimit = previous.maxUndoChances,
        )
        _uiState.value = _uiState.value.copy(opponentDisplayName = previous.opponentDisplayName)
        startGame()
    }

    // ── Share (victory image) ────────────────────────────────────────────

    /**
     * Build a [ShareManager.ShareableGame] from the current computer-game state.
     * gameId is 0 for a purely-local game — that's fine, the victory image share
     * doesn't need a valid gameId. The player is always "You"; the opponent is
     * the persona name if a persona was selected, else a plain computer label.
     */
    fun buildShareableGame(): com.chess99.presentation.social.ShareManager.ShareableGame {
        val state = _uiState.value
        val opponentLabel = state.opponentDisplayName ?: context.getString(R.string.pc_opponent_computer)
        val playerIsWhite = state.playerColor == Color.WHITE
        val you = context.getString(R.string.player_you)
        val whiteName = if (playerIsWhite) you else opponentLabel
        val blackName = if (playerIsWhite) opponentLabel else you

        // Map result to white/black/draw from the player's perspective.
        val result = when (state.gameResult?.status) {
            ResultStatus.WON -> if (playerIsWhite) "white" else "black"
            ResultStatus.LOST -> if (playerIsWhite) "black" else "white"
            else -> "draw"
        }

        return com.chess99.presentation.social.ShareManager.ShareableGame(
            gameId = 0,
            whitePlayer = whiteName,
            blackPlayer = blackName,
            result = result,
            ratingChange = 0,
            totalMoves = state.moveHistory.size,
            timeControl = "${DEFAULT_TIME_SECONDS / 60}|0",
        )
    }

    // ── Cleanup ──────────────────────────────────────────────────────

    override fun onCleared() {
        super.onCleared()
        startGameJob?.cancel()
        computerMoveJob?.cancel()
        bestMoveJob?.cancel()
        timerJob?.cancel()
        viewModelScope.launch { stockfishEngine.shutdown() }
    }
}

// ── UI State ─────────────────────────────────────────────────────────

data class PlayComputerUiState(
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    val computerColor: Color = Color.BLACK,
    val difficulty: Int = StockfishEngine.DEFAULT_DEPTH,
    /** Selected play mode (Casual / Learning / Rated) — mirrors web's `ratedMode`. */
    val gameMode: GameMode = GameMode.CASUAL,
    val isRated: Boolean = false,
    /** True for Learning mode — undo pool is the helpline budget; game is NOT rated. */
    val learningMode: Boolean = false,
    val gamePhase: GamePhase = GamePhase.SETUP,
    val lastMoveFrom: Int = -1,
    val lastMoveTo: Int = -1,
    val moveHistory: List<GameMoveRecord> = emptyList(),
    val undoChancesRemaining: Int = 0,
    val maxUndoChances: Int = 0,
    val playerTimeSeconds: Int = 600,
    val computerTimeSeconds: Int = 600,
    val activeTimer: Color = Color.WHITE,
    val isTimerRunning: Boolean = false,
    val computerMoveInProgress: Boolean = false,
    val bestMoveInProgress: Boolean = false,
    val bestMoveFrom: Int = -1,
    val bestMoveTo: Int = -1,
    val bestMoveUci: String? = null,
    val gameResult: GameResultState? = null,
    val soundToPlay: MoveSound? = null,
    val error: String? = null,
    /** True when [error] is an engine-init failure — UI offers a puzzle redirect (S2 T4). */
    val engineInitFailed: Boolean = false,
    /** Set when a persona chip is selected (T5) — top bar shows "Playing {name}" instead of "Computer (Lv.N)". */
    val opponentDisplayName: String? = null,
)

/** Bot persona chip row state (T5) — separate from [PlayComputerUiState] so a
 *  persona load failure never touches the board/game state. */
data class PersonaUiState(
    val personas: List<SyntheticPlayer> = emptyList(),
    val isLoading: Boolean = false,
    val selectedPersona: SyntheticPlayer? = null,
    val isStartingGame: Boolean = false,
    /** Set once `POST v1/games/computer` succeeds — screen navigates to PlayMultiplayer and consumes it. */
    val startedGameId: Int? = null,
    /** Non-null (currently only "fallback_local") when the real-game start failed and the
     *  screen should silently continue with the already-configured local Stockfish game
     *  instead (spec T5: "local when offline"). Never shown to the user as raw text. */
    val startGameError: String? = null,
)

/**
 * Play-vs-Computer mode, matching web's three modes (GameModeSelector.jsx):
 *  - CASUAL: per-difficulty undo budget, not rated.
 *  - LEARNING: a small helpline pool for undo + best-move/CCT help, not rated.
 *  - RATED: no undo, affects your rating (server bot game applies Elo).
 * (Companion is a separate existing Android feature, not part of this selector.)
 */
enum class GameMode { CASUAL, LEARNING, RATED }

enum class GamePhase { SETUP, PLAYING, COMPLETED, REPLAY }

data class GameMoveRecord(
    val moveNumber: Int,
    val from: String,
    val to: String,
    val san: String,
    val fen: String,
    val playerColor: Color,
    val captured: Boolean,
    /** Lifelines shown or used for this move (for example best-move/review). */
    val lifelines: List<String> = emptyList(),
    val promotion: String? = null,
)

data class GameResultState(
    val status: ResultStatus,
    val endReason: EndReason,
    val winner: Winner,
    val details: String,
    /**
     * Server-authoritative Elo delta for a rated game, once fetched from
     * `GET /games/{id}/rating-change`. null while pending or for casual games
     * (no rating movement to show). Mirrors web's RatingChangeDisplay input.
     */
    val ratingChange: RatingChangeInfo? = null,
)

/** Elo delta shown on the game-over card for a rated game. */
data class RatingChangeInfo(
    val change: Int,
    val oldRating: Int,
    val newRating: Int,
)

enum class ResultStatus { WON, LOST, DRAW }
enum class EndReason { CHECKMATE, STALEMATE, TIMEOUT, RESIGNATION, INSUFFICIENT_MATERIAL, THREEFOLD_REPETITION, FIFTY_MOVE_RULE, UNKNOWN }
enum class Winner { PLAYER, OPPONENT, NONE }
enum class MoveSound { MOVE, CAPTURE, CHECK, GAME_END }
