package com.chess99.presentation.game

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.GameEvent
import com.chess99.data.websocket.GameWebSocketService
import com.chess99.domain.model.SyntheticPlayer
import com.chess99.engine.CCTAnalyzer
import com.chess99.engine.CCTArrow
import com.chess99.engine.CCTResult
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.EngineFailureCopy
import com.chess99.engine.EngineInitException
import com.chess99.engine.Piece
import com.chess99.engine.Square
import com.chess99.engine.StockfishEngine
import com.chess99.presentation.common.BoardArrow
import com.chess99.presentation.common.FeatureFlagManager
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Dispatchers
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
    private val matchmakingApi: MatchmakingApi,
    private val webSocketApi: WebSocketApi,
    private val tokenManager: TokenManager,
    private val featureFlagManager: FeatureFlagManager,
    private val stockfishEngine: StockfishEngine,
    val shareManager: com.chess99.presentation.social.ShareManager,
) : ViewModel() {

    val gameId: Int = savedStateHandle.get<Int>("gameId") ?: 0

    private val _uiState = MutableStateFlow(MultiplayerUiState())
    val uiState: StateFlow<MultiplayerUiState> = _uiState.asStateFlow()

    private val _companionState = MutableStateFlow(CompanionState())
    val companionState: StateFlow<CompanionState> = _companionState.asStateFlow()

    private val _cctState = MutableStateFlow(CCTPanelState())
    val cctState: StateFlow<CCTPanelState> = _cctState.asStateFlow()

    private var game = ChessGame()
    private var timerJob: Job? = null
    private var undoRequestExpiryJob: Job? = null
    private var incomingUndoExpiryJob: Job? = null
    private var myUserId: Int = 0
    private var hasSeenWebSocketConnection = false
    private var lastAppliedUndoSnapshot: AuthoritativeUndoSnapshot? = null
    private var companionContinuousJob: Job? = null
    private var syntheticOpponentJob: Job? = null

    /** Engine level for the synthetic opponent (T3), null for human-vs-human games. */
    private var _syntheticOpponentLevel: Int? = null
    /** Synthetic opponent's ELO (SyntheticPlayer.rating) — drives ELO-faithful move strength. */
    private var _syntheticOpponentElo: Int? = null

    init {
        myUserId = tokenManager.getUserId()
        viewModelScope.launch {
            featureFlagManager.flags.collect { flags ->
                val enabled = flags[FeatureFlagManager.FLAG_CHAT_ENABLED] ?: false
                _uiState.value = _uiState.value.copy(
                    isChatFeatureEnabled = enabled,
                    isChatOpen = _uiState.value.isChatOpen && enabled,
                    unreadChatCount = if (enabled) _uiState.value.unreadChatCount else 0,
                )
            }
        }
        if (gameId > 0) {
            loadGame()
        }
    }

    companion object {
        /**
         * [GameEvent.Error] messages known to already be static, fully
         * human-authored, kid-safe copy — safe to show verbatim. NOTE:
         * [GameWebSocketService] also emits `"Authentication failed: $message"`
         * where `$message` is a raw Pusher/Reverb SDK callback string of
         * unknown origin — that one is deliberately NOT whitelisted here and
         * falls through to the generic retry copy below.
         */
        private val KNOWN_WEBSOCKET_ERROR_MESSAGES = setOf(
            "Connection lost. Please rejoin the game.",
        )

        internal const val UNDO_REQUEST_TIMEOUT_MS = 30_000L
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

                val fen = gameObj.get("fen")?.takeIf { it.isJsonPrimitive }?.asString ?: ChessGame.STARTING_FEN
                val status = gameObj.get("status")?.takeIf { it.isJsonPrimitive }?.asString ?: "waiting"
                // A synthetic/computer game has no User on the bot's side, so
                // that player-id field is JSON null — `?.asInt` guards a missing
                // key but still throws UnsupportedOperationException on JsonNull,
                // so filter JsonNull out (else loadGame fails for every bot game).
                val whitePlayerId = gameObj.get("white_player_id")?.takeIf { !it.isJsonNull }?.asInt
                val blackPlayerId = gameObj.get("black_player_id")?.takeIf { !it.isJsonNull }?.asInt
                // `time_control` in the response is an OBJECT ({minutes, ...});
                // the scalar values live in the time_control_minutes /
                // increment_seconds columns. Build the "min|inc" string from
                // those — reading `time_control` as a string throws (JsonObject).
                val tcMinutes = gameObj.get("time_control_minutes")?.takeIf { it.isJsonPrimitive }?.asInt ?: 10
                val tcIncrement = gameObj.get("increment_seconds")?.takeIf { it.isJsonPrimitive }?.asInt ?: 0
                val timeControl = "$tcMinutes|$tcIncrement"
                val gameMode = gameObj.get("game_mode")?.takeIf { it.isJsonPrimitive }?.asString ?: "casual"
                // Learning is stored as a casual game plus a flag — the server
                // validates game_mode as rated|casual only, so "learning" never
                // appears in game_mode and the header must read the flag.
                val isLearningMode = gameObj.get("learning_mode")
                    ?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false

                // Determine player color
                val playerColor = when (myUserId) {
                    whitePlayerId -> Color.WHITE
                    blackPlayerId -> Color.BLACK
                    else -> Color.WHITE
                }

                // Parse opponent info. A synthetic/computer opponent has no User
                // row, so `black_player`/`white_player` is JSON null — guard the
                // cast (getAsJsonObject throws casting JsonNull to JsonObject) and
                // fall back to the bot's synthetic_player name so a bot game shows
                // "Aarav Beginner" rather than a generic "Opponent".
                val opponentObj = (if (playerColor == Color.WHITE) {
                    gameObj.get("black_player")
                } else {
                    gameObj.get("white_player")
                })?.takeIf { it.isJsonObject }?.asJsonObject
                val syntheticObj = gameObj.get("synthetic_player")?.takeIf { it.isJsonObject }?.asJsonObject

                val opponentName = opponentObj?.get("name")?.takeIf { it.isJsonPrimitive }?.asString
                    ?: syntheticObj?.get("name")?.takeIf { it.isJsonPrimitive }?.asString
                    ?: "Opponent"
                val opponentRating = opponentObj?.get("rating")?.takeIf { it.isJsonPrimitive }?.asInt
                    ?: syntheticObj?.get("rating")?.takeIf { it.isJsonPrimitive }?.asInt
                    ?: 1200
                val opponentUserId = if (playerColor == Color.WHITE) blackPlayerId else whitePlayerId

                // T3: `GameController::createComputerGame`/`show` spread every
                // Game column onto the response root (`...$game->toArray()`),
                // so `computer_level`/`synthetic_player_id` are already here —
                // no extra request needed to detect a bot game.
                val computerLevel = gameObj.get("computer_level")?.takeIf { !it.isJsonNull }?.asInt
                val isSyntheticGame = computerLevel != null

                // Parse time control
                val parts = timeControl.split("|")
                val baseMinutes = parts.getOrNull(0)?.toIntOrNull() ?: 10
                val incrementSeconds = parts.getOrNull(1)?.toIntOrNull() ?: 0

                val whiteTime = gameObj.get("white_time")?.takeIf { !it.isJsonNull }?.asInt ?: (baseMinutes * 60)
                val blackTime = gameObj.get("black_time")?.takeIf { !it.isJsonNull }?.asInt ?: (baseMinutes * 60)

                // Load board state
                game = ChessGame(fen)

                // Load existing moves
                val movesResponse = gameApi.getGameMoves(gameId)
                val moveHistory = mutableListOf<GameMoveRecord>()
                if (movesResponse.isSuccessful) {
                    val movesData = movesResponse.body()
                    // `moves` may come back as a JSON array, or (for some game
                    // shapes) as a JSON-encoded string / absent — getAsJsonArray
                    // throws (ClassCastException) on a primitive, so guard it and
                    // treat anything non-array as an empty history.
                    val movesArray = movesData?.get("moves")?.takeIf { it.isJsonArray }?.asJsonArray
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
                    isLearningMode = isLearningMode,
                    // Web parity (PlayMultiplayer.js:960-967): rated games get no
                    // undos; otherwise take this colour's server-side remaining
                    // count, falling back to DEFAULT_UNDO_CHANCES when the payload
                    // predates the column.
                    undoChancesRemaining = if (gameMode == "rated") {
                        0
                    } else {
                        val key = if (playerColor == Color.WHITE) {
                            "undo_white_remaining"
                        } else {
                            "undo_black_remaining"
                        }
                        gameObj.get(key)?.takeIf { it.isJsonPrimitive }?.asInt
                            ?.coerceAtLeast(0)
                            ?: DEFAULT_UNDO_CHANCES
                    },
                    moveHistory = moveHistory,
                    timeControl = timeControl,
                    isSyntheticGame = isSyntheticGame,
                    opponentUserId = opponentUserId,
                    isMinor = tokenManager.isMinor(),
                    isChatFeatureEnabled = featureFlagManager.isEnabled(
                        FeatureFlagManager.FLAG_CHAT_ENABLED
                    ),
                )

                // Connect WebSocket
                connectWebSocket()
                if (!isSyntheticGame) loadChatHistory()

                // Start timer if game is active
                if (status == "active") {
                    startTimer()
                }

                // T3: a game created via T2/T5's synthetic flow needs no user
                // interaction to drive the bot's side — this is deliberately
                // NOT Companion Mode (which plays on the human's behalf,
                // gated on `game.turn == state.playerColor`); the synthetic
                // opponent plays the *other* color, so it gets its own
                // auto-play loop below rather than reusing
                // startContinuousCompanionPlay/companionPlayOneMove.
                if (isSyntheticGame) {
                    _syntheticOpponentLevel = computerLevel
                    _syntheticOpponentElo = opponentRating
                    try {
                        stockfishEngine.initialize()
                    } catch (e: Exception) {
                        Timber.e(e, "Failed to initialize Stockfish for synthetic opponent")
                        _uiState.value = _uiState.value.copy(error = EngineFailureCopy.MESSAGE)
                        return@launch
                    }
                    startSyntheticOpponentAutoPlay()
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load game")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = friendlyError(e, "this game"),
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
                hasSeenWebSocketConnection = true
            }

            // Collect game events
            gameWebSocketService.events.collect { event ->
                handleGameEvent(event)
            }
        }
    }

    internal fun handleGameEvent(event: GameEvent) {
        when (event) {
            is GameEvent.Connected -> {
                val state = _uiState.value
                val recoveredPendingRequest = hasSeenWebSocketConnection && state.undoRequestPending
                if (recoveredPendingRequest) {
                    undoRequestExpiryJob?.cancel()
                }
                _uiState.value = state.copy(
                    isWebSocketConnected = true,
                    undoRequestPending = if (recoveredPendingRequest) false else state.undoRequestPending,
                    snackbarMessage = if (recoveredPendingRequest) {
                        "Connection restored — ask for a takeback again if you still need it."
                    } else {
                        state.snackbarMessage
                    },
                )
                hasSeenWebSocketConnection = true
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
                onGameCompleted()
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
                    startIncomingUndoExpiry()
                }
            }

            is GameEvent.UndoAccepted -> {
                applyAuthoritativeUndo(
                    fen = event.fen,
                    moveCount = event.moveCount,
                    undoWhiteRemaining = event.undoWhiteRemaining,
                    undoBlackRemaining = event.undoBlackRemaining,
                )
            }

            is GameEvent.UndoDeclined -> {
                cancelUndoExpiryJobs()
                _uiState.value = _uiState.value.copy(
                    undoRequestedByOpponent = false,
                    undoRequestPending = false,
                    snackbarMessage = "Undo request declined",
                )
            }

            is GameEvent.ChatMessage -> {
                if (!_uiState.value.isChatFeatureEnabled) return
                val messages = _uiState.value.chatMessages + ChatMessageData(
                    id = event.messageId,
                    userId = event.userId,
                    userName = event.userName,
                    message = event.message,
                    timestamp = event.timestamp,
                    isMe = event.userId == myUserId,
                    filtered = event.filtered,
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
                onGameCompleted()
            }

            is GameEvent.OpponentPinged -> {
                _uiState.value = _uiState.value.copy(snackbarMessage = "Your opponent wants you to move!")
            }

            is GameEvent.PlayerConnected -> {
                Timber.d("Player connected: ${event.userId}")
            }

            is GameEvent.Error -> {
                _uiState.value = _uiState.value.copy(error = sanitizeWebSocketErrorMessage(event.message))
            }
        }
    }

    /**
     * Kid-safe copy for [GameEvent.Error] payloads. WebSocket error events can
     * carry the server's raw text verbatim, which may include internal detail
     * unsuitable for a kids app — only an exact-match whitelist of known,
     * already human-authored phrases passes through unchanged; anything else
     * (including any interpolated/SDK-sourced text) collapses to one generic
     * retry message. The raw text is always logged via Timber for debugging.
     */
    private fun sanitizeWebSocketErrorMessage(rawMessage: String): String {
        if (rawMessage !in KNOWN_WEBSOCKET_ERROR_MESSAGES) {
            Timber.w("Unrecognized WebSocket error event: $rawMessage")
            return "Connection hiccup — trying to reconnect."
        }
        return rawMessage
    }

    // ── Player Move ─────────────────────────────────────────────────────

    fun onPlayerMove(from: String, to: String, promotion: Char?) {
        val state = _uiState.value
        if (state.gamePhase != MultiplayerPhase.PLAYING) return
        if (game.turn != state.playerColor) return

        val move = game.move(from, to, promotion) ?: return

        // Snapshot the post-move position once. These feed both the local move
        // record and the payload the server validates, and the request goes out
        // from a coroutine that may run after further state changes.
        val san = move.san(game)
        val isCheck = game.isCheck()
        val isCheckmate = game.isCheckmate()
        val isStalemate = game.isStalemate()

        val sound = when {
            isCheck -> MoveSound.CHECK
            move.captured != Piece.NONE || move.isEnPassant -> MoveSound.CAPTURE
            else -> MoveSound.MOVE
        }

        val moveRecord = GameMoveRecord(
            moveNumber = game.historyVerbose().size,
            from = from,
            to = to,
            san = san,
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
                // broadcastMove validates san/uci/is_check/is_mate_hint/
                // is_stalemate as REQUIRED. They are display metadata the server
                // does not need to apply a move (validateAndApplyMove recomputes
                // fen/turn from from/to) and a backend commit relaxes them to
                // nullable — but that commit is not on the deployed branch, so
                // omitting them 422s every move of a synthetic-opponent game.
                // The web client has always sent the full set; sending it here
                // keeps the native client working against the deployed
                // validation *and* the relaxed one, instead of the app being
                // broken until a backend rollout happens.
                addProperty("san", san)
                addProperty("uci", from + to + (promotion?.toString() ?: ""))
                addProperty("is_check", isCheck)
                addProperty("is_mate_hint", isCheckmate)
                addProperty("is_stalemate", isStalemate)
                // Persist remaining clocks so the server stays in sync (web
                // parity) — reduces clock drift/desync on reconnect. The backend
                // accepts these under move.* as nullable.
                addProperty("white_time_remaining_ms", _uiState.value.whiteTimeSeconds * 1000L)
                addProperty("black_time_remaining_ms", _uiState.value.blackTimeSeconds * 1000L)
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
            val state = _uiState.value
            // A synthetic/bot game must finalize via completeGame — that applies
            // the bot's Elo (rated games) while the game is still active. The
            // human resign endpoint would finalize WITHOUT synthetic Elo, and the
            // follow-up completeGame would then 422 ("game is not active").
            val ok: Boolean = if (state.isSyntheticGame) {
                val body = JsonObject().apply {
                    addProperty("result", if (state.playerColor == Color.WHITE) "0-1" else "1-0")
                    addProperty("end_reason", "resignation")
                    addProperty("move_count", state.moveHistory.size)
                    addProperty("fen", game.fen())
                }
                runCatching { gameApi.completeGame(gameId, body).isSuccessful }.getOrDefault(false)
            } else {
                gameWebSocketService.resignGame().isSuccess
            }

            if (ok) {
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
                onGameCompleted()
            } else {
                _uiState.value = _uiState.value.copy(
                    error = "Couldn't record your resignation. Please try again.",
                )
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "your draw offer"))
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

    /**
     * Ask the opponent for a takeback. Mirrors web's handleUndo
     * (PlayMultiplayer.js:2636): blocked in rated games, only on your own turn,
     * only with a chance left and at least one full move pair on the board.
     * The move is not rolled back here — that happens when the opponent accepts
     * and the authoritative accepted event (or bot response) supplies the position.
     */
    fun requestUndo() {
        val state = _uiState.value
        if (!state.canRequestUndo) return

        _uiState.value = state.copy(undoRequestPending = true)
        startUndoRequestExpiry()
        viewModelScope.launch {
            gameWebSocketService.requestUndo()
                .onSuccess(::applySyntheticUndoResponse)
                .onFailure { e ->
                    Timber.w(e, "Failed to request undo")
                    undoRequestExpiryJob?.cancel()
                    _uiState.value = _uiState.value.copy(
                        undoRequestPending = false,
                        snackbarMessage = "Couldn't ask for a takeback. Please try again.",
                    )
                }
        }
    }

    fun acceptUndo() {
        viewModelScope.launch {
            gameWebSocketService.acceptUndo()
                .onFailure { e ->
                    Timber.w(e, "Failed to accept undo")
                    incomingUndoExpiryJob?.cancel()
                    _uiState.value = _uiState.value.copy(
                        undoRequestedByOpponent = false,
                        snackbarMessage = "That takeback request is no longer available.",
                    )
                }
        }
    }

    fun declineUndo() {
        viewModelScope.launch {
            val result = gameWebSocketService.declineUndo()
            result.onSuccess {
                incomingUndoExpiryJob?.cancel()
                _uiState.value = _uiState.value.copy(undoRequestedByOpponent = false)
            }
            result.onFailure { e ->
                Timber.w(e, "Failed to decline undo")
                incomingUndoExpiryJob?.cancel()
                _uiState.value = _uiState.value.copy(
                    undoRequestedByOpponent = false,
                    snackbarMessage = "That takeback request is no longer available.",
                )
            }
        }
    }

    private fun startUndoRequestExpiry() {
        undoRequestExpiryJob?.cancel()
        undoRequestExpiryJob = viewModelScope.launch {
            delay(UNDO_REQUEST_TIMEOUT_MS)
            if (_uiState.value.undoRequestPending) {
                _uiState.value = _uiState.value.copy(
                    undoRequestPending = false,
                    snackbarMessage = "No response — takeback request expired.",
                )
            }
        }
    }

    private fun startIncomingUndoExpiry() {
        incomingUndoExpiryJob?.cancel()
        incomingUndoExpiryJob = viewModelScope.launch {
            delay(UNDO_REQUEST_TIMEOUT_MS)
            if (_uiState.value.undoRequestedByOpponent) {
                _uiState.value = _uiState.value.copy(undoRequestedByOpponent = false)
            }
        }
    }

    private fun cancelUndoExpiryJobs() {
        undoRequestExpiryJob?.cancel()
        incomingUndoExpiryJob?.cancel()
        undoRequestExpiryJob = null
        incomingUndoExpiryJob = null
    }

    /**
     * A bot takeback is accepted during the request POST. Apply that response as
     * a fallback as well as listening for the broadcast, so a brief socket gap
     * cannot leave the native board ahead of the server.
     */
    private fun applySyntheticUndoResponse(response: JsonObject) {
        if (response.get("auto_accepted")?.takeIf { it.isJsonPrimitive }?.asBoolean != true) return

        val gameObj = response.get("game")?.takeIf { it.isJsonObject }?.asJsonObject ?: return
        val fen = gameObj.get("fen")?.takeIf { it.isJsonPrimitive }?.asString ?: return
        val moveCount = gameObj.get("move_count")?.takeIf { it.isJsonPrimitive }?.asInt ?: return
        val whiteRemaining = gameObj.get("undo_white_remaining")
            ?.takeIf { it.isJsonPrimitive }?.asInt ?: return
        val blackRemaining = gameObj.get("undo_black_remaining")
            ?.takeIf { it.isJsonPrimitive }?.asInt ?: return

        applyAuthoritativeUndo(fen, moveCount, whiteRemaining, blackRemaining)
    }

    private fun applyAuthoritativeUndo(
        fen: String,
        moveCount: Int,
        undoWhiteRemaining: Int,
        undoBlackRemaining: Int,
    ) {
        val state = _uiState.value
        val snapshot = AuthoritativeUndoSnapshot(
            fen = fen,
            moveCount = moveCount.coerceAtLeast(0),
            undoWhiteRemaining = undoWhiteRemaining.coerceAtLeast(0),
            undoBlackRemaining = undoBlackRemaining.coerceAtLeast(0),
        )

        cancelUndoExpiryJobs()

        // A synthetic acceptance arrives both by broadcast and in the request
        // response. Deduplicate the snapshot so budget-related side effects remain
        // one-shot even if delivery order changes.
        if (snapshot == lastAppliedUndoSnapshot) {
            _uiState.value = state.copy(
                undoRequestedByOpponent = false,
                undoRequestPending = false,
            )
            return
        }

        // An accepted takeback always removes exactly two plies. Without a
        // protocol revision/request id, this shape check is the strongest safe
        // protection against an older accepted frame arriving after newer moves.
        if (state.moveHistory.size != snapshot.moveCount + 2) {
            Timber.w(
                "Ignoring out-of-order takeback snapshot: local=%d server=%d",
                state.moveHistory.size,
                snapshot.moveCount,
            )
            _uiState.value = state.copy(
                undoRequestedByOpponent = false,
                undoRequestPending = false,
                snackbarMessage = "Game changed while the takeback was arriving. Re-syncing…",
            )
            reloadGameState()
            return
        }

        val authoritativeGame = try {
            ChessGame(snapshot.fen)
        } catch (e: Exception) {
            Timber.e(e, "Ignoring invalid authoritative takeback FEN")
            _uiState.value = state.copy(
                undoRequestedByOpponent = false,
                undoRequestPending = false,
                snackbarMessage = "Couldn't restore the takeback position. Reopen the game.",
            )
            return
        }

        game = authoritativeGame
        val history = state.moveHistory.take(snapshot.moveCount)
        val lastMove = history.lastOrNull()
        lastAppliedUndoSnapshot = snapshot

        _uiState.value = state.copy(
            fen = snapshot.fen,
            moveHistory = history,
            lastMoveFrom = lastMove?.from?.let(Square::fromAlgebraic) ?: -1,
            lastMoveTo = lastMove?.to?.let(Square::fromAlgebraic) ?: -1,
            undoChancesRemaining = if (state.playerColor == Color.WHITE) {
                snapshot.undoWhiteRemaining
            } else {
                snapshot.undoBlackRemaining
            },
            undoRequestedByOpponent = false,
            undoRequestPending = false,
        )
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "pausing the game"))
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "resuming the game"))
            }
        }
    }

    fun sendChat(message: String) {
        val state = _uiState.value
        if (!state.isChatFeatureEnabled ||
            !ChatSafetyRules.canSend(message, state.isMinor, state.chatPolicy)
        ) return

        viewModelScope.launch {
            gameWebSocketService.sendChatMessage(message.trim())
                .onSuccess { body ->
                    val sent = body.toChatMessageData(myUserId)
                    val policy = body.getAsJsonObject("chat_policy")?.toChatPolicy()
                        ?: _uiState.value.chatPolicy
                    _uiState.value = _uiState.value.copy(
                        chatMessages = if (
                            sent != null &&
                            _uiState.value.chatMessages.none { it.id == sent.id }
                        ) {
                            _uiState.value.chatMessages + sent
                        } else {
                            _uiState.value.chatMessages
                        },
                        chatPolicy = policy,
                        chatNotice = if (body.get("filtered")?.asBoolean == true) {
                            "Message was filtered before sending."
                        } else null,
                    )
                }
                .onFailure { error ->
                    Timber.w(error, "Failed to send chat message")
                    _uiState.value = _uiState.value.copy(
                        chatNotice = "Message could not be sent. Please try again."
                    )
                }
        }
    }

    fun toggleChat() {
        if (!_uiState.value.isChatFeatureEnabled || _uiState.value.isSyntheticGame) return
        val isOpen = !_uiState.value.isChatOpen
        _uiState.value = _uiState.value.copy(
            isChatOpen = isOpen,
            unreadChatCount = if (isOpen) 0 else _uiState.value.unreadChatCount,
        )
    }

    fun reportChatMessage(messageId: Int) {
        val message = _uiState.value.chatMessages.firstOrNull { it.id == messageId } ?: return
        if (message.isMe || message.id <= 0) return
        val reason = _uiState.value.chatPolicy.reportReasons.firstOrNull()
            ?: ChatSafetyRules.REPORT_REASONS.first()
        viewModelScope.launch {
            gameWebSocketService.reportChatMessage(messageId, reason)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        reportedMessageIds = _uiState.value.reportedMessageIds + messageId,
                        chatNotice = "Message reported for review.",
                    )
                }
                .onFailure { error ->
                    Timber.w(error, "Failed to report chat message")
                    _uiState.value = _uiState.value.copy(
                        chatNotice = "Report could not be sent. Please try again."
                    )
                }
        }
    }

    fun blockChatUser(userId: Int) {
        if (userId <= 0 || userId == myUserId) return
        viewModelScope.launch {
            gameWebSocketService.blockUser(userId)
                .onSuccess {
                    _uiState.value = _uiState.value.copy(
                        chatPolicy = _uiState.value.chatPolicy.copy(
                            enabled = false,
                            reason = "blocked",
                        ),
                        chatNotice = "Chat blocked with this player.",
                    )
                }
                .onFailure { error ->
                    Timber.w(error, "Failed to block chat user")
                    _uiState.value = _uiState.value.copy(
                        chatNotice = "Player could not be blocked. Please try again."
                    )
                }
        }
    }

    private fun loadChatHistory() {
        viewModelScope.launch {
            gameWebSocketService.getChatMessages()
                .onSuccess { body ->
                    val messages = body.getAsJsonArray("messages")
                        ?.mapNotNull { it.takeIf { value -> value.isJsonObject }
                            ?.asJsonObject
                            ?.toChatMessageData(myUserId) }
                        ?: emptyList()
                    val policy = body.getAsJsonObject("chat_policy")?.toChatPolicy()
                        ?: ChatPolicy()
                    _uiState.value = _uiState.value.copy(
                        chatMessages = messages,
                        chatPolicy = policy,
                    )
                }
                .onFailure { error ->
                    Timber.d(error, "Chat history unavailable")
                }
        }
    }

    private fun JsonObject.toChatMessageData(currentUserId: Int): ChatMessageData? {
        val id = get("id")?.takeIf { it.isJsonPrimitive }?.asInt ?: return null
        val senderId = get("sender_id")?.takeIf { it.isJsonPrimitive }?.asInt
            ?: get("user_id")?.takeIf { it.isJsonPrimitive }?.asInt
            ?: return null
        return ChatMessageData(
            id = id,
            userId = senderId,
            userName = get("sender_name")?.takeIf { it.isJsonPrimitive }?.asString
                ?: get("user_name")?.takeIf { it.isJsonPrimitive }?.asString
                ?: "Player",
            message = get("message")?.takeIf { it.isJsonPrimitive }?.asString ?: "",
            timestamp = get("created_at")?.takeIf { it.isJsonPrimitive }?.asString ?: "",
            isMe = senderId == currentUserId,
            filtered = get("filtered")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false,
        )
    }

    private fun JsonObject.toChatPolicy(): ChatPolicy = ChatPolicy(
        enabled = get("enabled")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true,
        presetOnly = get("preset_only")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: false,
        reason = get("reason")?.takeIf { !it.isJsonNull && it.isJsonPrimitive }?.asString,
        presetMessages = getAsJsonArray("preset_messages")?.map { it.asString }
            ?: ChatSafetyRules.PRESET_MESSAGES,
        emojiMessages = getAsJsonArray("emoji_messages")?.map { it.asString }
            ?: ChatSafetyRules.EMOJI_MESSAGES,
        reportReasons = getAsJsonArray("report_reasons")?.map { it.asString }
            ?: ChatSafetyRules.REPORT_REASONS,
        maxLength = get("max_length")?.takeIf { it.isJsonPrimitive }?.asInt ?: 500,
    )

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
        onGameCompleted()
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

    // ── Companion Mode ──────────────────────────────────────────────────

    fun loadCompanions() {
        viewModelScope.launch {
            _companionState.value = _companionState.value.copy(isLoading = true, error = null)
            try {
                val response = matchmakingApi.getSyntheticPlayers()
                if (!response.isSuccessful) {
                    _companionState.value = _companionState.value.copy(
                        isLoading = false,
                        error = "Failed to load companions",
                    )
                    return@launch
                }
                val body = response.body() ?: return@launch
                val dataArray = body.getAsJsonArray("data") ?: return@launch
                val players = dataArray.map { el ->
                    val obj = el.asJsonObject
                    SyntheticPlayer(
                        id = obj.get("id")?.asInt ?: 0,
                        name = obj.get("name")?.asString ?: "Companion",
                        rating = obj.get("rating")?.asInt ?: 1200,
                        computerLevel = obj.get("computer_level")?.asInt ?: 2,
                        personality = obj.get("personality")?.asString ?: "Balanced",
                        bio = obj.get("bio")?.asString ?: "",
                        avatarUrl = obj.get("avatar_url")?.asString ?: "",
                        gamesPlayed = obj.get("games_played")?.asInt ?: 0,
                        winRate = obj.get("win_rate")?.asDouble ?: 50.0,
                    )
                }
                _companionState.value = _companionState.value.copy(
                    isLoading = false,
                    companions = players,
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to load companions")
                _companionState.value = _companionState.value.copy(
                    isLoading = false,
                    error = friendlyError(e, "companion players"),
                )
            }
        }
    }

    fun selectCompanion(companion: SyntheticPlayer) {
        _companionState.value = _companionState.value.copy(selectedCompanion = companion, error = null)
        viewModelScope.launch {
            try {
                stockfishEngine.initialize()
            } catch (e: EngineInitException) {
                Timber.e(e, "Failed to initialize Stockfish for companion")
                // Never surface e.message — honest, kid-safe copy (S2 T4).
                _companionState.value = _companionState.value.copy(error = EngineFailureCopy.MESSAGE)
            } catch (e: Exception) {
                Timber.e(e, "Failed to initialize Stockfish for companion")
                _companionState.value = _companionState.value.copy(error = EngineFailureCopy.MESSAGE)
            }
        }
    }

    fun releaseCompanion() {
        companionContinuousJob?.cancel()
        _companionState.value = CompanionState(companions = _companionState.value.companions)
    }

    fun companionPlayOneMove() {
        val state = _uiState.value
        val companionState = _companionState.value
        val companion = companionState.selectedCompanion ?: return
        if (state.gamePhase != MultiplayerPhase.PLAYING) return
        if (game.turn != state.playerColor) return

        viewModelScope.launch {
            _companionState.value = _companionState.value.copy(isThinking = true)
            try {
                val fen = game.fen()
                val result = stockfishEngine.getBestMove(fen, companion.computerLevel)
                // Companion plays on the user's behalf — it should suggest the
                // engine's BEST move (web parity: getStockfishTopMoves(fen, 1)),
                // not an ELO-weakened one. rankedMoves rank-1 is the true best.
                val uci = result.rankedMoves.minByOrNull { it.rank }?.uci
                    ?: result.bestMove
                if (uci.length < 4) {
                    _companionState.value = _companionState.value.copy(
                        isThinking = false,
                        error = "Companion could not find a move",
                    )
                    return@launch
                }
                val from = uci.substring(0, 2)
                val to = uci.substring(2, 4)
                val promotion = uci.substring(4).ifEmpty { null }?.firstOrNull()

                // Apply locally
                val move = game.move(from, to, promotion)
                if (move == null) {
                    _companionState.value = _companionState.value.copy(
                        isThinking = false,
                        error = "Companion move was invalid",
                    )
                    return@launch
                }

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

                // Send to server as synthetic move
                val moveJson = JsonObject().apply {
                    addProperty("from", from)
                    addProperty("to", to)
                    promotion?.let { addProperty("promotion", it.toString()) }
                    addProperty("san", move.san(game))
                    addProperty("uci", uci)
                    addProperty("is_check", game.isCheck())
                    // Was hardcoded false, so a companion move that delivered
                    // mate told the server the game was still running.
                    addProperty("is_mate_hint", game.isCheckmate())
                    addProperty("is_stalemate", game.isStalemate())
                }
                val body = JsonObject().apply {
                    add("move", moveJson)
                }
                val response = webSocketApi.sendSyntheticMove(gameId, body)
                if (!response.isSuccessful) {
                    Timber.w("Synthetic move API failed, falling back to regular move API")
                    // Carry the same metadata across: broadcastMove requires it,
                    // so a bare from/to/promotion fallback 422s and the companion
                    // move is silently lost. See the note in onPlayerMove.
                    val fallbackJson = JsonObject().apply {
                        addProperty("from", from)
                        addProperty("to", to)
                        promotion?.let { addProperty("promotion", it.toString()) }
                        addProperty("san", move.san(game))
                        addProperty("uci", uci)
                        addProperty("is_check", game.isCheck())
                        addProperty("is_mate_hint", game.isCheckmate())
                        addProperty("is_stalemate", game.isStalemate())
                    }
                    val fallbackBody = JsonObject().apply {
                        add("move", fallbackJson)
                    }
                    gameWebSocketService.sendMove(fallbackBody)
                }

                _companionState.value = _companionState.value.copy(
                    isThinking = false,
                    moveCount = _companionState.value.moveCount + 1,
                )
            } catch (e: Exception) {
                Timber.e(e, "Companion move failed")
                // Never surface e.message — kid-safe copy (master plan rule 6).
                _companionState.value = _companionState.value.copy(
                    isThinking = false,
                    error = "Your companion couldn't make a move. Please try again.",
                )
            }
        }
    }

    fun toggleCompanionContinuousPlay() {
        val isContinuous = _companionState.value.isContinuousPlay
        if (isContinuous) {
            companionContinuousJob?.cancel()
            _companionState.value = _companionState.value.copy(isContinuousPlay = false)
        } else {
            _companionState.value = _companionState.value.copy(isContinuousPlay = true)
            startContinuousCompanionPlay()
        }
    }

    private fun startContinuousCompanionPlay() {
        companionContinuousJob?.cancel()
        companionContinuousJob = viewModelScope.launch {
            while (isActive) {
                val state = _uiState.value
                val companionStateVal = _companionState.value
                if (!companionStateVal.isContinuousPlay) break
                if (state.gamePhase != MultiplayerPhase.PLAYING) break
                if (game.turn == state.playerColor && !companionStateVal.isThinking) {
                    companionPlayOneMove()
                }
                delay(600)
            }
        }
    }

    // ── Synthetic Opponent Auto-Play (T3) ───────────────────────────────
    // Drives the *opponent's* side of a real, server-recorded synthetic game
    // (created via T2's Nearby Opponents or T5's persona row) — distinct from
    // Companion Mode above, which plays on the *player's* behalf instead.

    private fun startSyntheticOpponentAutoPlay() {
        syntheticOpponentJob?.cancel()
        syntheticOpponentJob = viewModelScope.launch {
            while (isActive) {
                val state = _uiState.value
                if (state.gamePhase != MultiplayerPhase.PLAYING) {
                    delay(600)
                    continue
                }
                if (game.turn != state.playerColor && !_companionState.value.isThinking) {
                    playSyntheticOpponentMove()
                }
                delay(600)
            }
        }
    }

    private suspend fun playSyntheticOpponentMove() {
        val level = _syntheticOpponentLevel ?: return
        val state = _uiState.value
        if (state.gamePhase != MultiplayerPhase.PLAYING) return
        if (game.turn == state.playerColor) return

        _companionState.value = _companionState.value.copy(isThinking = true)
        try {
            val fen = game.fen()
            val result = stockfishEngine.getBestMove(fen, level, opponentElo = _syntheticOpponentElo)
            val uci = result.bestMove
            if (uci.length < 4) {
                _companionState.value = _companionState.value.copy(isThinking = false)
                return
            }
            val from = uci.substring(0, 2)
            val to = uci.substring(2, 4)
            val promotion = uci.substring(4).ifEmpty { null }?.firstOrNull()
            val opponentColor = state.playerColor.opposite()

            val move = game.move(from, to, promotion) ?: run {
                _companionState.value = _companionState.value.copy(isThinking = false)
                return
            }

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
                playerColor = opponentColor,
                captured = move.captured != Piece.NONE,
            )

            val newWhiteTime = if (opponentColor == Color.WHITE) {
                state.whiteTimeSeconds + state.incrementSeconds
            } else state.whiteTimeSeconds
            val newBlackTime = if (opponentColor == Color.BLACK) {
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

            // Server-record the move so it appears in Game History (spec T3
            // AC 2) — same endpoint Companion Mode already uses successfully.
            val moveJson = JsonObject().apply {
                addProperty("from", from)
                addProperty("to", to)
                promotion?.let { addProperty("promotion", it.toString()) }
                addProperty("san", move.san(game))
                addProperty("uci", uci)
                addProperty("is_check", game.isCheck())
                addProperty("is_mate_hint", false)
                addProperty("is_stalemate", game.isStalemate())
            }
            val body = JsonObject().apply { add("move", moveJson) }
            val response = webSocketApi.sendSyntheticMove(gameId, body)
            if (!response.isSuccessful) {
                Timber.w("Synthetic opponent move API failed (game $gameId), board already updated locally")
            }

            _companionState.value = _companionState.value.copy(isThinking = false)
        } catch (e: Exception) {
            Timber.e(e, "Synthetic opponent move failed")
            _companionState.value = _companionState.value.copy(isThinking = false)
        }
    }

    // ── CCT Analysis ────────────────────────────────────────────────────

    private var cctAnalysisJob: Job? = null
    private var bestMovesJob: Job? = null
    private var lastCctFenKey: String = ""

    fun updateCCTAnalysis() {
        val state = _uiState.value
        if (state.gamePhase != MultiplayerPhase.PLAYING && state.gamePhase != MultiplayerPhase.PAUSED) {
            _cctState.value = CCTPanelState()
            return
        }

        val fen = game.fen()
        val cctStateVal = _cctState.value
        val key = "${fen}::${cctStateVal.perspective}"
        if (key == lastCctFenKey) return
        lastCctFenKey = key

        viewModelScope.launch(Dispatchers.Default) {
            val cct = CCTAnalyzer.analyze(game, cctStateVal.perspective)
            val opponentCct = CCTAnalyzer.analyze(game, "opponent")
            val warning = CCTAnalyzer.getWarning(opponentCct, fen)

            // Convert to board arrows
            val arrows = when {
                state.isRated -> emptyList()
                cctStateVal.hintLevel == 1 -> CCTAnalyzer.cctToArrows(cct)
                cctStateVal.hintLevel == 2 && cctStateVal.bestMoves != null -> {
                    cctStateVal.bestMoves!!.take(3).mapIndexed { i, m ->
                        CCTArrow(m.from, m.to, CCTAnalyzer.BEST_COLORS.getOrElse(i) { 0xE6C0C0C0L })
                    }
                }
                else -> emptyList()
            }

            val boardArrows = arrows.map { BoardArrow(it.from, it.to, it.color) }

            _cctState.value = cctStateVal.copy(
                cct = cct,
                opponentCct = opponentCct,
                warning = warning,
            )

            // Push arrows to UI state
            _uiState.value = _uiState.value.copy(cctArrows = boardArrows)

            // Trigger best moves analysis if in Best mode
            if (cctStateVal.hintLevel == 2 && !state.isRated) {
                loadBestMoves(fen, cct)
            }
        }
    }

    fun setCctHintLevel(requestedLevel: Int) {
        // Rated games never get move hints or best moves; the sheet shows counts
        // only. Guarded here as well so no UI path can switch arrows on.
        val level = if (_uiState.value.isRated) 0 else requestedLevel
        val current = _cctState.value
        _cctState.value = current.copy(
            hintLevel = level,
            bestMoves = if (level != 2) null else current.bestMoves,
            loadingBest = false,
        )
        lastCctFenKey = "" // force recompute
        updateCCTArrowsOnBoard()

        if (level == 2 && current.cct != null) {
            loadBestMoves(game.fen(), current.cct)
        }
    }

    fun setCctPerspective(perspective: String) {
        _cctState.value = _cctState.value.copy(perspective = perspective)
        lastCctFenKey = "" // force recompute
        updateCCTAnalysis()
    }

    private fun updateCCTArrowsOnBoard() {
        val cctStateVal = _cctState.value
        val arrows = when {
            cctStateVal.hintLevel == 0 || _uiState.value.isRated -> emptyList()
            cctStateVal.hintLevel == 1 && cctStateVal.cct != null -> {
                CCTAnalyzer.cctToArrows(cctStateVal.cct).map { BoardArrow(it.from, it.to, it.color) }
            }
            cctStateVal.hintLevel == 2 && cctStateVal.bestMoves != null -> {
                cctStateVal.bestMoves!!.take(3).mapIndexed { i, m ->
                    BoardArrow(m.from, m.to, CCTAnalyzer.BEST_COLORS.getOrElse(i) { 0xE6C0C0C0L })
                }
            }
            else -> emptyList()
        }
        _uiState.value = _uiState.value.copy(cctArrows = arrows)
    }

    private fun loadBestMoves(fen: String, cct: CCTResult) {
        bestMovesJob?.cancel()
        bestMovesJob = viewModelScope.launch(Dispatchers.Default) {
            _cctState.value = _cctState.value.copy(loadingBest = true, bestMoves = null)
            try {
                stockfishEngine.initialize()
                val result = stockfishEngine.getBestMove(fen, 12)

                val topMoves = result.rankedMoves
                    .sortedBy { it.rank }
                    .take(3)
                    .map { rm ->
                        val from = Square.fromAlgebraic(rm.uci.substring(0, 2))
                        val to = Square.fromAlgebraic(rm.uci.substring(2, 4))
                        val san = try {
                            val g = ChessGame(fen)
                            val m = g.moveUci(rm.uci)
                            m?.san(g) ?: rm.uci
                        } catch (_: Exception) { rm.uci }
                        val tag = CCTAnalyzer.classifyMoveAgainstCCT(rm.uci, cct)

                        BestMoveData(
                            uci = rm.uci,
                            from = from,
                            to = to,
                            san = san,
                            cp = rm.score,
                            isMate = rm.isMate,
                            tag = tag,
                        )
                    }

                _cctState.value = _cctState.value.copy(
                    loadingBest = false,
                    bestMoves = topMoves,
                )
                updateCCTArrowsOnBoard()
            } catch (e: Exception) {
                Timber.e(e, "CCT best moves analysis failed")
                _cctState.value = _cctState.value.copy(
                    loadingBest = false,
                    bestMoves = emptyList(),
                )
            }
        }
    }


    // ── Share (victory image) ────────────────────────────────────────────

    /**
     * Build a [ShareManager.ShareableGame] from the current multiplayer state,
     * from the local player's perspective. The player is "You"; the opponent is
     * their display name.
     */
    fun buildShareableGame(): com.chess99.presentation.social.ShareManager.ShareableGame {
        val state = _uiState.value
        val playerIsWhite = state.playerColor == Color.WHITE
        val whiteName = if (playerIsWhite) "You" else state.opponentName
        val blackName = if (playerIsWhite) state.opponentName else "You"

        val result = when (state.gameResult?.status) {
            ResultStatus.WON -> if (playerIsWhite) "white" else "black"
            ResultStatus.LOST -> if (playerIsWhite) "black" else "white"
            else -> "draw"
        }

        return com.chess99.presentation.social.ShareManager.ShareableGame(
            gameId = state.gameId,
            whitePlayer = whiteName,
            blackPlayer = blackName,
            result = result,
            ratingChange = 0,
            totalMoves = state.moveHistory.size,
            timeControl = state.timeControl,
        )
    }

    // ── Rating change (rated games) ─────────────────────────────────────
    // At game end, show the server-authoritative Elo delta (web parity: the
    // RatingChangeDisplay via getRatingChange). Two backend realities:
    //   • Rated human-vs-human: Elo is applied automatically server-side when
    //     the game finalizes (GameRoomService::applyRatedGameElo). We just read
    //     it back via GET /games/{id}/rating-change.
    //   • Rated synthetic (bot): the finalize path skips synthetic Elo, so we
    //     must POST /games/{id}/complete first (applies applyRatedSyntheticElo),
    //     then read the delta back. completeGame is idempotent server-side.
    // Casual games have no ratings_history row → rating-change returns 404 → we
    // leave ratingChange null and the card shows the neutral "Casual game" line.
    private var ratingFetchStarted = false

    private fun onGameCompleted() {
        if (ratingFetchStarted) return
        ratingFetchStarted = true
        val state = _uiState.value
        if (!state.isRated || state.gameId <= 0) return
        val result = state.gameResult ?: return

        viewModelScope.launch {
            try {
                // Rated bot games need an explicit complete call to trigger Elo.
                if (state.isSyntheticGame) {
                    val body = JsonObject().apply {
                        addProperty("result", resultStringFor(result))
                        addProperty("end_reason", endReasonStringFor(result.endReason))
                        addProperty("move_count", state.moveHistory.size)
                        addProperty("fen", game.fen())
                    }
                    // Fire-and-forget; ignore failures (rating fetch below still
                    // works for the human-vs-human case, and a bot game with no
                    // Elo simply shows the casual line).
                    runCatching { gameApi.completeGame(gameId, body) }
                }

                val response = gameApi.getRatingChange(gameId)
                if (!response.isSuccessful) return@launch
                val rc = response.body()
                    ?.getAsJsonObject("rating_change") ?: return@launch
                val change = rc.get("rating_change")?.takeIf { it.isJsonPrimitive }?.asInt ?: return@launch
                val oldRating = rc.get("old_rating")?.takeIf { it.isJsonPrimitive }?.asInt ?: state.myRating
                val newRating = rc.get("new_rating")?.takeIf { it.isJsonPrimitive }?.asInt ?: (oldRating + change)

                // Only overlay onto the still-current completed result.
                val current = _uiState.value
                if (current.gamePhase == MultiplayerPhase.COMPLETED && current.gameResult != null) {
                    _uiState.value = current.copy(
                        gameResult = current.gameResult.copy(
                            ratingChange = RatingChangeInfo(change, oldRating, newRating),
                        ),
                        myRating = newRating,
                    )
                }
            } catch (e: Exception) {
                // Kid-safe: never surface raw errors; the card just omits the delta.
                Timber.e(e, "Failed to fetch rating change for game $gameId")
            }
        }
    }

    /** Map a completed result to the backend result string from the player's POV. */
    private fun resultStringFor(result: GameResultState): String = when (result.status) {
        ResultStatus.DRAW -> "1/2-1/2"
        ResultStatus.WON -> if (_uiState.value.playerColor == Color.WHITE) "1-0" else "0-1"
        ResultStatus.LOST -> if (_uiState.value.playerColor == Color.WHITE) "0-1" else "1-0"
    }

    private fun endReasonStringFor(endReason: EndReason): String = when (endReason) {
        EndReason.CHECKMATE -> "checkmate"
        EndReason.STALEMATE -> "stalemate"
        EndReason.TIMEOUT -> "timeout"
        EndReason.RESIGNATION -> "resignation"
        EndReason.INSUFFICIENT_MATERIAL -> "insufficient_material"
        EndReason.THREEFOLD_REPETITION -> "threefold"
        EndReason.FIFTY_MOVE_RULE -> "fifty_move"
        EndReason.UNKNOWN -> "other"
    }

    override fun onCleared() {
        super.onCleared()
        timerJob?.cancel()
        cancelUndoExpiryJobs()
        companionContinuousJob?.cancel()
        syntheticOpponentJob?.cancel()
        cctAnalysisJob?.cancel()
        bestMovesJob?.cancel()
        stockfishEngine.shutdown()
        gameWebSocketService.disconnect()
    }
}

private data class AuthoritativeUndoSnapshot(
    val fen: String,
    val moveCount: Int,
    val undoWhiteRemaining: Int,
    val undoBlackRemaining: Int,
)

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
    /** True once we have asked and are waiting on the opponent. */
    val undoRequestPending: Boolean = false,
    /** Takebacks this player has left. Rated games get none. */
    val undoChancesRemaining: Int = 0,
    /** Learning game — shown in the header and unlocks the help controls. */
    val isLearningMode: Boolean = false,
    val chatMessages: List<ChatMessageData> = emptyList(),
    val isChatOpen: Boolean = false,
    val unreadChatCount: Int = 0,
    val isChatFeatureEnabled: Boolean = false,
    val chatPolicy: ChatPolicy = ChatPolicy(),
    val isMinor: Boolean = true,
    val opponentUserId: Int? = null,
    val reportedMessageIds: Set<Int> = emptySet(),
    val chatNotice: String? = null,
    val gameResult: GameResultState? = null,
    val soundToPlay: MoveSound? = null,
    val error: String? = null,
    val snackbarMessage: String? = null,
    val cctArrows: List<BoardArrow> = emptyList(),
    /** True for a T3 real-synthetic-opponent game — Companion Mode (plays on
     *  the player's own behalf) is hidden for these, since the opponent side
     *  is already bot-driven by [PlayMultiplayerViewModel]'s dedicated
     *  synthetic-opponent auto-play loop. */
    val isSyntheticGame: Boolean = false,
) {
    /** Whose turn it is, derived from the position rather than tracked separately. */
    val isMyTurn: Boolean
        get() = (fen.split(" ").getOrNull(1) == "w") == (playerColor == Color.WHITE)

    /**
     * Web parity (PlayMultiplayer.js:2957): a takeback needs a completed turn
     * pair to roll back, a remaining chance, your own turn, a live game, and no
     * request already in flight. Rated games never qualify.
     */
    val canRequestUndo: Boolean
        get() = !isRated &&
            undoChancesRemaining > 0 &&
            !undoRequestPending &&
            isMyTurn &&
            gamePhase == MultiplayerPhase.PLAYING &&
            moveHistory.size >= 2
}

enum class MultiplayerPhase { CONNECTING, PLAYING, PAUSED, COMPLETED }

/** Web's useGameState.js:71 seeds multiplayer games with 9 takebacks. */
const val DEFAULT_UNDO_CHANCES = 9

data class ChatMessageData(
    val id: Int,
    val userId: Int,
    val userName: String,
    val message: String,
    val timestamp: String,
    val isMe: Boolean,
    val filtered: Boolean = false,
)

data class CompanionState(
    val companions: List<SyntheticPlayer> = emptyList(),
    val selectedCompanion: SyntheticPlayer? = null,
    val isLoading: Boolean = false,
    val error: String? = null,
    val isThinking: Boolean = false,
    val isContinuousPlay: Boolean = false,
    val moveCount: Int = 0,
)
