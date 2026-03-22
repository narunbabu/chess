package com.chess99.presentation.game

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.GameEvent
import com.chess99.data.websocket.GameWebSocketService
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.Piece
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
 * ViewModel for real-time multiplayer game.
 * Mirrors chess-frontend/src/components/play/PlayMultiplayer.js
 */
@HiltViewModel
class PlayMultiplayerViewModel @Inject constructor(
    savedStateHandle: SavedStateHandle,
    private val gameWebSocketService: GameWebSocketService,
    private val gameApi: GameApi,
    private val tokenManager: TokenManager,
) : ViewModel() {

    val gameId: Int = savedStateHandle.get<Int>("gameId") ?: 0

    private val _uiState = MutableStateFlow(MultiplayerUiState())
    val uiState: StateFlow<MultiplayerUiState> = _uiState.asStateFlow()

    private var game = ChessGame()
    private var timerJob: Job? = null
    private var myUserId: Int = 0

    init {
        myUserId = tokenManager.getUserId()
        if (gameId > 0) {
            loadGame()
        }
    }

    // ── Load Game ───────────────────────────────────────────────────────

    private fun loadGame() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)

            try {
                // Fetch game data
                val response = gameApi.getGame(gameId)
                if (!response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to load game",
                    )
                    return@launch
                }

                val gameData = response.body() ?: return@launch
                val gameObj = gameData.getAsJsonObject("game") ?: gameData

                val fen = gameObj.get("fen")?.asString ?: ChessGame.STARTING_FEN
                val status = gameObj.get("status")?.asString ?: "waiting"
                val whitePlayerId = gameObj.get("white_player_id")?.asInt
                val blackPlayerId = gameObj.get("black_player_id")?.asInt
                val timeControl = gameObj.get("time_control")?.asString ?: "10|0"
                val gameMode = gameObj.get("game_mode")?.asString ?: "casual"

                // Determine player color
                val playerColor = when (myUserId) {
                    whitePlayerId -> Color.WHITE
                    blackPlayerId -> Color.BLACK
                    else -> Color.WHITE
                }

                // Parse opponent info
                val opponentObj = if (playerColor == Color.WHITE) {
                    gameObj.getAsJsonObject("black_player")
                } else {
                    gameObj.getAsJsonObject("white_player")
                }

                val opponentName = opponentObj?.get("name")?.asString ?: "Opponent"
                val opponentRating = opponentObj?.get("rating")?.asInt ?: 1200

                // Parse time control
                val parts = timeControl.split("|")
                val baseMinutes = parts.getOrNull(0)?.toIntOrNull() ?: 10
                val incrementSeconds = parts.getOrNull(1)?.toIntOrNull() ?: 0

                val whiteTime = gameObj.get("white_time")?.asInt ?: (baseMinutes * 60)
                val blackTime = gameObj.get("black_time")?.asInt ?: (baseMinutes * 60)

                // Load board state
                game = ChessGame(fen)

                // Load existing moves
                val movesResponse = gameApi.getGameMoves(gameId)
                val moveHistory = mutableListOf<GameMoveRecord>()
                if (movesResponse.isSuccessful) {
                    val movesData = movesResponse.body()
                    val movesArray = movesData?.getAsJsonArray("moves")
                    movesArray?.forEach { moveEl ->
                        val m = moveEl.asJsonObject
                        moveHistory.add(
                            GameMoveRecord(
                                moveNumber = m.get("move_number")?.asInt ?: moveHistory.size + 1,
                                from = m.get("from")?.asString ?: "",
                                to = m.get("to")?.asString ?: "",
                                san = m.get("san")?.asString ?: "",
                                fen = m.get("fen")?.asString ?: "",
                                playerColor = if (m.get("color")?.asString == "w") Color.WHITE else Color.BLACK,
                                captured = m.get("captured")?.asBoolean ?: false,
                            )
                        )
                    }
                }

                _uiState.value = MultiplayerUiState(
                    isLoading = false,
                    gameId = gameId,
                    fen = fen,
                    playerColor = playerColor,
                    opponentName = opponentName,
                    opponentRating = opponentRating,
                    myRating = tokenManager.getUserName()?.let { 1200 } ?: 1200, // Will load actual
                    gamePhase = when (status) {
                        "active" -> MultiplayerPhase.PLAYING
                        "paused" -> MultiplayerPhase.PAUSED
                        "completed" -> MultiplayerPhase.COMPLETED
                        else -> MultiplayerPhase.CONNECTING
                    },
                    whiteTimeSeconds = whiteTime,
                    blackTimeSeconds = blackTime,
                    incrementSeconds = incrementSeconds,
                    isRated = gameMode == "rated",
                    moveHistory = moveHistory,
                    timeControl = timeControl,
                )

                // Connect WebSocket
                connectWebSocket()

                // Start timer if game is active
                if (status == "active") {
                    startTimer()
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load game")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to load game: ${e.message}",
                )
            }
        }
    }

    // ── WebSocket ───────────────────────────────────────────────────────

    private fun connectWebSocket() {
        viewModelScope.launch {
            val connected = gameWebSocketService.initialize(gameId)
            if (connected) {
                _uiState.value = _uiState.value.copy(
                    gamePhase = if (_uiState.value.gamePhase == MultiplayerPhase.CONNECTING) {
                        MultiplayerPhase.PLAYING
                    } else {
                        _uiState.value.gamePhase
                    },
                    isWebSocketConnected = true,
                )
            }

            // Collect game events
            gameWebSocketService.events.collect { event ->
                handleGameEvent(event)
            }
        }
    }

    private fun handleGameEvent(event: GameEvent) {
        when (event) {
            is GameEvent.Connected -> {
                _uiState.value = _uiState.value.copy(isWebSocketConnected = true)
            }

            is GameEvent.MoveMade -> handleOpponentMove(event)

            is GameEvent.GameEnded -> {
                stopTimer()
                val myColor = _uiState.value.playerColor
                val iWon = event.winnerUserId == myUserId

                _uiState.value = _uiState.value.copy(
                    gamePhase = MultiplayerPhase.COMPLETED,
                    gameResult = GameResultState(
                        status = when {
                            event.result == "draw" -> ResultStatus.DRAW
                            iWon -> ResultStatus.WON
                            else -> ResultStatus.LOST
                        },
                        endReason = EndReason.entries.firstOrNull {
                            it.name.equals(event.endReason.uppercase().replace(" ", "_"), ignoreCase = true)
                        } ?: EndReason.UNKNOWN,
                        winner = when {
                            event.result == "draw" -> Winner.NONE
                            iWon -> Winner.PLAYER
                            else -> Winner.OPPONENT
                        },
                        details = formatEndReason(event.endReason, iWon),
                    ),
                    soundToPlay = MoveSound.GAME_END,
                )
            }

            is GameEvent.GamePaused -> {
                stopTimer()
                _uiState.value = _uiState.value.copy(gamePhase = MultiplayerPhase.PAUSED)
            }

            is GameEvent.GameResumed -> {
                _uiState.value = _uiState.value.copy(
                    gamePhase = MultiplayerPhase.PLAYING,
                    whiteTimeSeconds = event.whiteTime ?: _uiState.value.whiteTimeSeconds,
                    blackTimeSeconds = event.blackTime ?: _uiState.value.blackTimeSeconds,
                )
                startTimer()
            }

            is GameEvent.GameActivated -> {
                _uiState.value = _uiState.value.copy(gamePhase = MultiplayerPhase.PLAYING)
                startTimer()
            }

            is GameEvent.DrawOffered -> {
                if (event.offeredBy != myUserId) {
                    _uiState.value = _uiState.value.copy(drawOfferedByOpponent = true)
                }
            }

            is GameEvent.DrawAccepted -> {
                _uiState.value = _uiState.value.copy(
                    drawOfferedByOpponent = false,
                    drawOfferedByMe = false,
                )
            }

            is GameEvent.DrawDeclined -> {
                _uiState.value = _uiState.value.copy(
                    drawOfferedByOpponent = false,
                    drawOfferedByMe = false,
                    snackbarMessage = "Draw offer declined",
                )
            }

            is GameEvent.UndoRequested -> {
                if (event.requestedBy != myUserId) {
                    _uiState.value = _uiState.value.copy(undoRequestedByOpponent = true)
                }
            }

            is GameEvent.UndoAccepted -> {
                _uiState.value = _uiState.value.copy(undoRequestedByOpponent = false)
                // Reload game state to get updated FEN
                reloadGameState()
            }

            is GameEvent.UndoDeclined -> {
                _uiState.value = _uiState.value.copy(
                    undoRequestedByOpponent = false,
                    snackbarMessage = "Undo request declined",
                )
            }

            is GameEvent.ChatMessage -> {
                val messages = _uiState.value.chatMessages + ChatMessageData(
                    userId = event.userId,
                    userName = event.userName,
                    message = event.message,
                    timestamp = event.timestamp,
                    isMe = event.userId == myUserId,
                )
                _uiState.value = _uiState.value.copy(
                    chatMessages = messages,
                    unreadChatCount = if (_uiState.value.isChatOpen) 0
                    else _uiState.value.unreadChatCount + 1,
                )
            }

            is GameEvent.OpponentResigned -> {
                stopTimer()
                _uiState.value = _uiState.value.copy(
                    gamePhase = MultiplayerPhase.COMPLETED,
                    gameResult = GameResultState(
                        status = ResultStatus.WON,
                        endReason = EndReason.RESIGNATION,
                        winner = Winner.PLAYER,
                        details = "Opponent resigned",
                    ),
                    soundToPlay = MoveSound.GAME_END,
                )
            }

            is GameEvent.OpponentPinged -> {
                _uiState.value = _uiState.value.copy(snackbarMessage = "Your opponent wants you to move!")
            }

            is GameEvent.PlayerConnected -> {
                Timber.d("Player connected: ${event.userId}")
            }

            is GameEvent.Error -> {
                _uiState.value = _uiState.value.copy(error = event.message)
            }
        }
    }

    // ── Player Move ─────────────────────────────────────────────────────

    fun onPlayerMove(from: String, to: String, promotion: Char?) {
        val state = _uiState.value
        if (state.gamePhase != MultiplayerPhase.PLAYING) return
        if (game.turn != state.playerColor) return

        val move = game.move(from, to, promotion) ?: return

        val sound = when {
            game.isCheck() -> MoveSound.CHECK
            move.captured != Piece.NONE || move.isEnPassant -> MoveSound.CAPTURE
            else -> MoveSound.MOVE
        }

        val moveRecord = GameMoveRecord(
            moveNumber = game.historyVerbose().size,
            from = from,
            to = to,
            san = move.san(game),
            fen = game.fen(),
            playerColor = state.playerColor,
            captured = move.captured != Piece.NONE,
        )

        // Apply increment to player's clock
        val newWhiteTime = if (state.playerColor == Color.WHITE) {
            state.whiteTimeSeconds + state.incrementSeconds
        } else state.whiteTimeSeconds

        val newBlackTime = if (state.playerColor == Color.BLACK) {
            state.blackTimeSeconds + state.incrementSeconds
        } else state.blackTimeSeconds

        _uiState.value = state.copy(
            fen = game.fen(),
            lastMoveFrom = move.from,
            lastMoveTo = move.to,
            moveHistory = state.moveHistory + moveRecord,
            whiteTimeSeconds = newWhiteTime,
            blackTimeSeconds = newBlackTime,
            soundToPlay = sound,
        )

        // Send move to server
        viewModelScope.launch {
            val moveJson = JsonObject().apply {
                addProperty("from", from)
                addProperty("to", to)
                promotion?.let { addProperty("promotion", it.toString()) }
            }
            val result = gameWebSocketService.sendMove(moveJson)
            result.onFailure { e ->
                Timber.e(e, "Failed to send move")
                // Rollback local move
                game.undo()
                _uiState.value = _uiState.value.copy(
                    fen = game.fen(),
                    moveHistory = state.moveHistory,
                    error = "Failed to send move. Please try again.",
                )
            }
        }
    }

    // ── Opponent Move ───────────────────────────────────────────────────

    private fun handleOpponentMove(event: GameEvent.MoveMade) {
        // Skip if this is our own move echoed back
        if (event.userId == myUserId) return

        val moveData = event.move
        val from = moveData.get("from")?.asString ?: return
        val to = moveData.get("to")?.asString ?: return
        val promotion = moveData.get("promotion")?.asString?.firstOrNull()

        val move = game.move(from, to, promotion) ?: run {
            // If move doesn't apply, sync from server FEN
            if (event.fen.isNotEmpty()) {
                game = ChessGame(event.fen)
            }
            _uiState.value = _uiState.value.copy(fen = event.fen)
            return
        }

        val sound = when {
            game.isCheck() -> MoveSound.CHECK
            move.captured != Piece.NONE || move.isEnPassant -> MoveSound.CAPTURE
            else -> MoveSound.MOVE
        }

        val state = _uiState.value
        val moveRecord = GameMoveRecord(
            moveNumber = game.historyVerbose().size,
            from = from,
            to = to,
            san = move.san(game),
            fen = game.fen(),
            playerColor = state.playerColor.opposite(),
            captured = move.captured != Piece.NONE,
        )

        // Sync clocks from server if available
        val newWhiteTime = event.whiteTime ?: state.whiteTimeSeconds
        val newBlackTime = event.blackTime ?: state.blackTimeSeconds

        _uiState.value = state.copy(
            fen = game.fen(),
            lastMoveFrom = move.from,
            lastMoveTo = move.to,
            moveHistory = state.moveHistory + moveRecord,
            whiteTimeSeconds = newWhiteTime,
            blackTimeSeconds = newBlackTime,
            soundToPlay = sound,
        )
    }

    // ── Actions ─────────────────────────────────────────────────────────

    fun resign() {
        viewModelScope.launch {
            val result = gameWebSocketService.resignGame()
            result.onSuccess {
                stopTimer()
                _uiState.value = _uiState.value.copy(
                    gamePhase = MultiplayerPhase.COMPLETED,
                    gameResult = GameResultState(
                        status = ResultStatus.LOST,
                        endReason = EndReason.RESIGNATION,
                        winner = Winner.OPPONENT,
                        details = "You resigned",
                    ),
                    soundToPlay = MoveSound.GAME_END,
                )
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(error = "Failed to resign: ${e.message}")
            }
        }
    }

    fun offerDraw() {
        viewModelScope.launch {
            val result = gameWebSocketService.offerDraw()
            result.onSuccess {
                _uiState.value = _uiState.value.copy(drawOfferedByMe = true)
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(error = "Failed to offer draw: ${e.message}")
            }
        }
    }

    fun acceptDraw() {
        viewModelScope.launch {
            gameWebSocketService.acceptDraw()
        }
    }

    fun declineDraw() {
        viewModelScope.launch {
            val result = gameWebSocketService.declineDraw()
            result.onSuccess {
                _uiState.value = _uiState.value.copy(drawOfferedByOpponent = false)
            }
        }
    }

    fun acceptUndo() {
        viewModelScope.launch {
            gameWebSocketService.acceptUndo()
        }
    }

    fun declineUndo() {
        viewModelScope.launch {
            val result = gameWebSocketService.declineUndo()
            result.onSuccess {
                _uiState.value = _uiState.value.copy(undoRequestedByOpponent = false)
            }
        }
    }

    fun pauseGame() {
        viewModelScope.launch {
            val state = _uiState.value
            val result = gameWebSocketService.pauseGame(state.whiteTimeSeconds, state.blackTimeSeconds)
            result.onSuccess {
                stopTimer()
                _uiState.value = _uiState.value.copy(gamePhase = MultiplayerPhase.PAUSED)
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(error = "Failed to pause: ${e.message}")
            }
        }
    }

    fun requestResumeGame() {
        viewModelScope.launch {
            val result = gameWebSocketService.requestResume()
            result.onSuccess {
                _uiState.value = _uiState.value.copy(snackbarMessage = "Resume request sent")
            }
            result.onFailure { e ->
                _uiState.value = _uiState.value.copy(error = "Failed to request resume: ${e.message}")
            }
        }
    }

    fun sendChat(message: String) {
        if (message.isBlank() || message.length > 500) return
        viewModelScope.launch {
            gameWebSocketService.sendChatMessage(message.trim())
        }
    }

    fun toggleChat() {
        val isOpen = !_uiState.value.isChatOpen
        _uiState.value = _uiState.value.copy(
            isChatOpen = isOpen,
            unreadChatCount = if (isOpen) 0 else _uiState.value.unreadChatCount,
        )
    }

    // ── Timer ───────────────────────────────────────────────────────────

    private fun startTimer() {
        timerJob?.cancel()
        timerJob = viewModelScope.launch {
            while (isActive) {
                delay(1000)
                val state = _uiState.value
                if (state.gamePhase != MultiplayerPhase.PLAYING) continue

                val isWhiteTurn = game.turn == Color.WHITE

                if (isWhiteTurn) {
                    val newTime = state.whiteTimeSeconds - 1
                    if (newTime <= 0) {
                        handleTimeout(Color.WHITE)
                        return@launch
                    }
                    _uiState.value = state.copy(whiteTimeSeconds = newTime)
                } else {
                    val newTime = state.blackTimeSeconds - 1
                    if (newTime <= 0) {
                        handleTimeout(Color.BLACK)
                        return@launch
                    }
                    _uiState.value = state.copy(blackTimeSeconds = newTime)
                }
            }
        }
    }

    private fun handleTimeout(timedOutColor: Color) {
        stopTimer()
        val state = _uiState.value
        val iWon = timedOutColor != state.playerColor

        viewModelScope.launch {
            gameWebSocketService.claimTimeout(
                if (timedOutColor == Color.WHITE) "white" else "black"
            )
        }

        _uiState.value = state.copy(
            whiteTimeSeconds = if (timedOutColor == Color.WHITE) 0 else state.whiteTimeSeconds,
            blackTimeSeconds = if (timedOutColor == Color.BLACK) 0 else state.blackTimeSeconds,
            gamePhase = MultiplayerPhase.COMPLETED,
            gameResult = GameResultState(
                status = if (iWon) ResultStatus.WON else ResultStatus.LOST,
                endReason = EndReason.TIMEOUT,
                winner = if (iWon) Winner.PLAYER else Winner.OPPONENT,
                details = if (iWon) "Opponent ran out of time" else "You ran out of time",
            ),
            soundToPlay = MoveSound.GAME_END,
        )
    }

    private fun stopTimer() {
        timerJob?.cancel()
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private fun reloadGameState() {
        viewModelScope.launch {
            try {
                val response = gameApi.getGame(gameId)
                if (response.isSuccessful) {
                    val gameObj = response.body()?.getAsJsonObject("game") ?: return@launch
                    val fen = gameObj.get("fen")?.asString ?: return@launch
                    game = ChessGame(fen)
                    _uiState.value = _uiState.value.copy(fen = fen)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to reload game state")
            }
        }
    }

    private fun formatEndReason(reason: String, iWon: Boolean): String = when {
        reason.contains("checkmate", ignoreCase = true) -> if (iWon) "Checkmate! You win!" else "Checkmate! You lose."
        reason.contains("resign", ignoreCase = true) -> if (iWon) "Opponent resigned" else "You resigned"
        reason.contains("timeout", ignoreCase = true) -> if (iWon) "Opponent ran out of time" else "You ran out of time"
        reason.contains("stalemate", ignoreCase = true) -> "Draw by stalemate"
        reason.contains("agreement", ignoreCase = true) -> "Draw by agreement"
        reason.contains("repetition", ignoreCase = true) -> "Draw by repetition"
        reason.contains("insufficient", ignoreCase = true) -> "Draw by insufficient material"
        reason.contains("50", ignoreCase = true) || reason.contains("fifty", ignoreCase = true) -> "Draw by 50-move rule"
        else -> reason.replaceFirstChar { it.uppercase() }
    }

    fun soundPlayed() {
        _uiState.value = _uiState.value.copy(soundToPlay = null)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
        gameWebSocketService.disconnect()
    }
}

// ── UI State ────────────────────────────────────────────────────────────

data class MultiplayerUiState(
    val isLoading: Boolean = true,
    val gameId: Int = 0,
    val fen: String = ChessGame.STARTING_FEN,
    val playerColor: Color = Color.WHITE,
    val opponentName: String = "Opponent",
    val opponentRating: Int = 1200,
    val myRating: Int = 1200,
    val gamePhase: MultiplayerPhase = MultiplayerPhase.CONNECTING,
    val lastMoveFrom: Int = -1,
    val lastMoveTo: Int = -1,
    val moveHistory: List<GameMoveRecord> = emptyList(),
    val whiteTimeSeconds: Int = 600,
    val blackTimeSeconds: Int = 600,
    val incrementSeconds: Int = 0,
    val isRated: Boolean = false,
    val timeControl: String = "10|0",
    val isWebSocketConnected: Boolean = false,
    val drawOfferedByOpponent: Boolean = false,
    val drawOfferedByMe: Boolean = false,
    val undoRequestedByOpponent: Boolean = false,
    val chatMessages: List<ChatMessageData> = emptyList(),
    val isChatOpen: Boolean = false,
    val unreadChatCount: Int = 0,
    val gameResult: GameResultState? = null,
    val soundToPlay: MoveSound? = null,
    val error: String? = null,
    val snackbarMessage: String? = null,
)

enum class MultiplayerPhase { CONNECTING, PLAYING, PAUSED, COMPLETED }

data class ChatMessageData(
    val userId: Int,
    val userName: String,
    val message: String,
    val timestamp: String,
    val isMe: Boolean,
)
