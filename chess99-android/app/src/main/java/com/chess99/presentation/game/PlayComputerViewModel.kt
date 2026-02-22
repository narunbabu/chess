package com.chess99.presentation.game

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.engine.*
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

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
) : ViewModel() {

    companion object {
        const val DEFAULT_TIME_SECONDS = 600 // 10 minutes
    }

    // ── Game State ───────────────────────────────────────────────────

    private val _uiState = MutableStateFlow(PlayComputerUiState())
    val uiState: StateFlow<PlayComputerUiState> = _uiState.asStateFlow()

    private var game = ChessGame()
    private var computerMoveJob: Job? = null
    private var timerJob: Job? = null

    // ── Setup ────────────────────────────────────────────────────────

    fun setupGame(
        playerColor: Color = Color.WHITE,
        difficulty: Int = StockfishEngine.DEFAULT_DEPTH,
        isRated: Boolean = false,
    ) {
        game = ChessGame()
        val undoChances = StockfishEngine.undoChances(difficulty, isRated)

        _uiState.value = PlayComputerUiState(
            fen = game.fen(),
            playerColor = playerColor,
            computerColor = playerColor.opposite(),
            difficulty = difficulty,
            isRated = isRated,
            gamePhase = GamePhase.SETUP,
            undoChancesRemaining = undoChances,
            maxUndoChances = undoChances,
            playerTimeSeconds = DEFAULT_TIME_SECONDS,
            computerTimeSeconds = DEFAULT_TIME_SECONDS,
        )
    }

    fun startGame() {
        viewModelScope.launch {
            // Initialize engine
            try {
                stockfishEngine.initialize()
                stockfishEngine.newGame()
            } catch (e: Exception) {
                _uiState.value = _uiState.value.copy(error = "Failed to start engine: ${e.message}")
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
        )

        _uiState.value = state.copy(
            fen = game.fen(),
            lastMoveFrom = move.from,
            lastMoveTo = move.to,
            moveHistory = state.moveHistory + moveRecord,
            activeTimer = state.computerColor,
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

            try {
                val result = stockfishEngine.getBestMove(
                    fen = game.fen(),
                    depth = _uiState.value.difficulty,
                )

                val move = game.moveUci(result.bestMove)
                if (move == null) {
                    // Engine returned invalid move, try any legal move
                    val legal = game.legalMoves().firstOrNull()
                    if (legal != null) game.moveSan(legal.san(game))
                    else return@launch
                }

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
                _uiState.value = _uiState.value.copy(
                    computerMoveInProgress = false,
                    error = "Engine error: ${e.message}",
                )
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
        )
    }

    // ── Resign ───────────────────────────────────────────────────────

    fun resign() {
        if (_uiState.value.gamePhase != GamePhase.PLAYING) return
        computerMoveJob?.cancel()

        _uiState.value = _uiState.value.copy(
            gamePhase = GamePhase.COMPLETED,
            gameResult = GameResultState(
                status = ResultStatus.LOST,
                endReason = EndReason.RESIGNATION,
                winner = Winner.OPPONENT,
                details = "You resigned",
            ),
            isTimerRunning = false,
            soundToPlay = MoveSound.GAME_END,
        )
        stopTimer()
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
                        details = "Checkmate! You win!",
                    )
                } else {
                    GameResultState(
                        status = ResultStatus.LOST,
                        endReason = EndReason.CHECKMATE,
                        winner = Winner.OPPONENT,
                        details = "Checkmate! Computer wins.",
                    )
                }
            }
            game.isStalemate() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.STALEMATE,
                winner = Winner.NONE,
                details = "Draw by stalemate",
            )
            game.isInsufficientMaterial() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.INSUFFICIENT_MATERIAL,
                winner = Winner.NONE,
                details = "Draw by insufficient material",
            )
            game.isThreefoldRepetition() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.THREEFOLD_REPETITION,
                winner = Winner.NONE,
                details = "Draw by threefold repetition",
            )
            game.isFiftyMoveRule() -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.FIFTY_MOVE_RULE,
                winner = Winner.NONE,
                details = "Draw by 50-move rule",
            )
            else -> GameResultState(
                status = ResultStatus.DRAW,
                endReason = EndReason.UNKNOWN,
                winner = Winner.NONE,
                details = "Game over",
            )
        }

        _uiState.value = state.copy(
            gamePhase = GamePhase.COMPLETED,
            gameResult = result,
            isTimerRunning = false,
            soundToPlay = MoveSound.GAME_END,
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
                        _uiState.value = state.copy(
                            playerTimeSeconds = 0,
                            gamePhase = GamePhase.COMPLETED,
                            gameResult = GameResultState(
                                status = ResultStatus.LOST,
                                endReason = EndReason.TIMEOUT,
                                winner = Winner.OPPONENT,
                                details = "You ran out of time",
                            ),
                            isTimerRunning = false,
                            soundToPlay = MoveSound.GAME_END,
                        )
                        return@launch
                    }
                    _uiState.value = state.copy(playerTimeSeconds = newTime)
                } else {
                    val newTime = state.computerTimeSeconds - 1
                    if (newTime <= 0) {
                        _uiState.value = state.copy(
                            computerTimeSeconds = 0,
                            gamePhase = GamePhase.COMPLETED,
                            gameResult = GameResultState(
                                status = ResultStatus.WON,
                                endReason = EndReason.TIMEOUT,
                                winner = Winner.PLAYER,
                                details = "Computer ran out of time",
                            ),
                            isTimerRunning = false,
                            soundToPlay = MoveSound.GAME_END,
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
        _uiState.value = _uiState.value.copy(error = null)
    }

    // ── Cleanup ──────────────────────────────────────────────────────

    override fun onCleared() {
        super.onCleared()
        computerMoveJob?.cancel()
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
    val isRated: Boolean = false,
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
    val gameResult: GameResultState? = null,
    val soundToPlay: MoveSound? = null,
    val error: String? = null,
)

enum class GamePhase { SETUP, PLAYING, COMPLETED, REPLAY }

data class GameMoveRecord(
    val moveNumber: Int,
    val from: String,
    val to: String,
    val san: String,
    val fen: String,
    val playerColor: Color,
    val captured: Boolean,
)

data class GameResultState(
    val status: ResultStatus,
    val endReason: EndReason,
    val winner: Winner,
    val details: String,
)

enum class ResultStatus { WON, LOST, DRAW }
enum class EndReason { CHECKMATE, STALEMATE, TIMEOUT, RESIGNATION, INSUFFICIENT_MATERIAL, THREEFOLD_REPETITION, FIFTY_MOVE_RULE, UNKNOWN }
enum class Winner { PLAYER, OPPONENT, NONE }
enum class MoveSound { MOVE, CAPTURE, CHECK, GAME_END }
