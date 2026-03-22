package com.chess99.data.websocket

import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import com.google.gson.JsonObject
import com.pusher.client.channel.PrivateChannel
import com.pusher.client.channel.PrivateChannelEventListener
import com.pusher.client.channel.PusherEvent
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Manages real-time WebSocket game events for multiplayer.
 * Mirrors chess-frontend/src/services/WebSocketGameService.js
 *
 * Handles: channel subscription, event listening, handshake,
 * reconnection, and polling fallback.
 */
@Singleton
class GameWebSocketService @Inject constructor(
    private val pusherManager: PusherManager,
    private val webSocketApi: WebSocketApi,
    private val tokenManager: TokenManager,
) {
    private var gameId: Int? = null
    private var gameChannel: PrivateChannel? = null
    private var isConnected = false
    private var reconnectAttempts = 0
    private var reconnectJob: Job? = null
    private var pollingJob: Job? = null
    private var lastMoveCount = 0

    companion object {
        private const val MAX_RECONNECT_ATTEMPTS = 5
        private const val POLLING_INTERVAL_MS = 3000L
    }

    // ── Event Streams ───────────────────────────────────────────────────

    private val _events = MutableSharedFlow<GameEvent>(extraBufferCapacity = 64)
    val events: SharedFlow<GameEvent> = _events.asSharedFlow()

    // ── Initialize ──────────────────────────────────────────────────────

    suspend fun initialize(gameId: Int): Boolean {
        this.gameId = gameId
        this.lastMoveCount = 0

        // Ensure Pusher is connected
        if (!pusherManager.isConnected()) {
            pusherManager.connect()
            // Brief wait for connection
            delay(2000)
        }

        if (!pusherManager.isConnected()) {
            Timber.w("WebSocket not connected, falling back to polling")
            startPolling()
            return false
        }

        return try {
            subscribeToGameChannel(gameId)
            completeHandshake(gameId)
            isConnected = true
            reconnectAttempts = 0
            _events.emit(GameEvent.Connected(pusherManager.getSocketId() ?: ""))
            true
        } catch (e: Exception) {
            Timber.e(e, "Failed to initialize game WebSocket")
            startPolling()
            false
        }
    }

    // ── Channel Subscription ────────────────────────────────────────────

    private fun subscribeToGameChannel(gameId: Int) {
        val channel = pusherManager.subscribeToPrivateChannel("game.$gameId")
            ?: throw IllegalStateException("Failed to subscribe to game channel")

        gameChannel = channel

        val listener = object : PrivateChannelEventListener {
            override fun onEvent(event: PusherEvent) {
                val eventName = event.eventName
                val data = event.data
                Timber.d("Game event: $eventName -> $data")

                val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
                scope.launch {
                    handleGameEvent(eventName, data)
                }
            }

            override fun onSubscriptionSucceeded(channelName: String) {
                Timber.d("Subscribed to game channel: $channelName")
            }

            override fun onAuthenticationFailure(message: String, e: Exception?) {
                Timber.e(e, "Game channel auth failed: $message")
                val scope = CoroutineScope(Dispatchers.Main + SupervisorJob())
                scope.launch {
                    _events.emit(GameEvent.Error("Authentication failed: $message"))
                }
            }
        }

        // Bind to all game events
        channel.bind("game.move", listener)
        channel.bind("game.timer", listener)
        channel.bind("game.ended", listener)
        channel.bind("game.paused", listener)
        channel.bind("game.resumed", listener)
        channel.bind("game.activated", listener)
        channel.bind("game.chat", listener)
        channel.bind("game.resigned", listener)
        channel.bind("draw.offered", listener)
        channel.bind("draw.accepted", listener)
        channel.bind("draw.declined", listener)
        channel.bind("undo.request", listener)
        channel.bind("undo.accepted", listener)
        channel.bind("undo.declined", listener)
        channel.bind("opponent.pinged", listener)
        channel.bind("GameConnectionEvent", listener)
        channel.bind("GameEndedEvent", listener)
    }

    private suspend fun handleGameEvent(eventName: String, jsonData: String) {
        try {
            val data = com.google.gson.JsonParser.parseString(jsonData).asJsonObject

            val event = when {
                eventName.contains("game.move") -> {
                    GameEvent.MoveMade(
                        move = data.getAsJsonObject("move"),
                        fen = data.get("fen")?.asString ?: "",
                        turn = data.get("turn")?.asString ?: "",
                        userId = data.get("user_id")?.asInt,
                        whiteTime = data.get("white_time")?.asInt,
                        blackTime = data.get("black_time")?.asInt,
                    )
                }
                eventName.contains("game.ended") || eventName == "GameEndedEvent" -> {
                    GameEvent.GameEnded(
                        result = data.get("result")?.asString ?: "",
                        endReason = data.get("end_reason")?.asString ?: "",
                        winnerUserId = data.get("winner_user_id")?.asInt,
                    )
                }
                eventName.contains("game.paused") -> GameEvent.GamePaused
                eventName.contains("game.resumed") -> {
                    GameEvent.GameResumed(
                        whiteTime = data.get("white_time")?.asInt,
                        blackTime = data.get("black_time")?.asInt,
                    )
                }
                eventName.contains("game.activated") -> GameEvent.GameActivated
                eventName.contains("game.chat") -> {
                    GameEvent.ChatMessage(
                        userId = data.get("user_id")?.asInt ?: 0,
                        userName = data.get("user_name")?.asString ?: "",
                        message = data.get("message")?.asString ?: "",
                        timestamp = data.get("created_at")?.asString ?: "",
                    )
                }
                eventName.contains("draw.offered") -> {
                    GameEvent.DrawOffered(data.get("offered_by")?.asInt ?: 0)
                }
                eventName.contains("draw.accepted") -> GameEvent.DrawAccepted
                eventName.contains("draw.declined") -> GameEvent.DrawDeclined
                eventName.contains("undo.request") -> {
                    GameEvent.UndoRequested(data.get("requested_by")?.asInt ?: 0)
                }
                eventName.contains("undo.accepted") -> GameEvent.UndoAccepted
                eventName.contains("undo.declined") -> GameEvent.UndoDeclined
                eventName.contains("opponent.pinged") -> GameEvent.OpponentPinged
                eventName.contains("game.resigned") -> {
                    GameEvent.OpponentResigned(data.get("resigned_by")?.asInt ?: 0)
                }
                eventName == "GameConnectionEvent" -> {
                    GameEvent.PlayerConnected(data.get("user_id")?.asInt ?: 0)
                }
                else -> {
                    Timber.d("Unhandled game event: $eventName")
                    null
                }
            }

            event?.let { _events.emit(it) }
        } catch (e: Exception) {
            Timber.e(e, "Error handling game event: $eventName")
        }
    }

    // ── Handshake ───────────────────────────────────────────────────────

    private suspend fun completeHandshake(gameId: Int) {
        val socketId = pusherManager.getSocketId()
            ?: throw IllegalStateException("No socket ID for handshake")

        val body = JsonObject().apply {
            addProperty("game_id", gameId)
            addProperty("socket_id", socketId)
            add("client_info", JsonObject().apply {
                addProperty("platform", "android")
                addProperty("timestamp", System.currentTimeMillis().toString())
            })
        }

        val response = webSocketApi.handshake(body)
        if (!response.isSuccessful) {
            val errorBody = response.errorBody()?.string() ?: "Unknown error"
            throw IllegalStateException("Handshake failed: $errorBody")
        }

        val data = response.body()
        Timber.d("Handshake complete: $data")
    }

    // ── Game Actions ────────────────────────────────────────────────────

    suspend fun sendMove(move: JsonObject): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            add("move", move)
            pusherManager.getSocketId()?.let { addProperty("socket_id", it) }
        }
        webSocketApi.sendMove(gameId!!, body)
    }

    suspend fun resignGame(): Result<JsonObject> = apiCall {
        webSocketApi.resign(gameId!!)
    }

    suspend fun offerDraw(): Result<JsonObject> = apiCall {
        webSocketApi.offerDraw(gameId!!)
    }

    suspend fun acceptDraw(): Result<JsonObject> = apiCall {
        webSocketApi.acceptDraw(gameId!!)
    }

    suspend fun declineDraw(): Result<JsonObject> = apiCall {
        webSocketApi.declineDraw(gameId!!)
    }

    suspend fun requestUndo(): Result<JsonObject> = apiCall {
        webSocketApi.requestUndo(gameId!!)
    }

    suspend fun acceptUndo(): Result<JsonObject> = apiCall {
        webSocketApi.acceptUndo(gameId!!)
    }

    suspend fun declineUndo(): Result<JsonObject> = apiCall {
        webSocketApi.declineUndo(gameId!!)
    }

    suspend fun pauseGame(whiteTime: Int, blackTime: Int): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            addProperty("white_time", whiteTime)
            addProperty("black_time", blackTime)
            pusherManager.getSocketId()?.let { addProperty("socket_id", it) }
        }
        webSocketApi.pauseGame(gameId!!, body)
    }

    suspend fun resumeGame(): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            addProperty("accept_resume", true)
            pusherManager.getSocketId()?.let { addProperty("socket_id", it) }
        }
        webSocketApi.resumeGame(gameId!!, body)
    }

    suspend fun requestResume(): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            pusherManager.getSocketId()?.let { addProperty("socket_id", it) }
        }
        webSocketApi.requestResume(gameId!!, body)
    }

    suspend fun claimTimeout(timedOutColor: String): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            addProperty("timed_out_color", timedOutColor)
        }
        webSocketApi.claimTimeout(gameId!!, body)
    }

    suspend fun sendChatMessage(message: String): Result<JsonObject> = apiCall {
        val body = JsonObject().apply {
            addProperty("message", message)
            pusherManager.getSocketId()?.let { addProperty("socket_id", it) }
        }
        webSocketApi.sendChatMessage(gameId!!, body)
    }

    suspend fun getChatMessages(): Result<JsonObject> = apiCall {
        webSocketApi.getChatMessages(gameId!!)
    }

    // ── Polling Fallback ────────────────────────────────────────────────

    private fun startPolling() {
        pollingJob?.cancel()
        pollingJob = CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
            while (isActive) {
                try {
                    pollGameState()
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Timber.e(e, "Polling error")
                }
                delay(POLLING_INTERVAL_MS)
            }
        }
    }

    private suspend fun pollGameState() {
        val gId = gameId ?: return
        val response = webSocketApi.getRoomState(gId, compact = 1, sinceMoveCount = lastMoveCount)

        if (response.isSuccessful) {
            val body = response.body() ?: return
            val success = body.get("success")?.asBoolean ?: false
            if (!success) return

            val noChange = body.get("no_change")?.asBoolean ?: false
            if (noChange) return

            val data = body.getAsJsonObject("data") ?: return

            // Check game over
            if (data.get("game_over")?.asBoolean == true) {
                _events.emit(
                    GameEvent.GameEnded(
                        result = data.get("result")?.asString ?: "",
                        endReason = data.get("end_reason")?.asString ?: "",
                        winnerUserId = data.get("winner_user_id")?.asInt,
                    )
                )
                pollingJob?.cancel()
                return
            }

            val moveCount = data.get("move_count")?.asInt ?: 0
            val lastMove = data.getAsJsonObject("last_move")

            if (moveCount > lastMoveCount && lastMove != null) {
                _events.emit(
                    GameEvent.MoveMade(
                        move = lastMove,
                        fen = data.get("fen")?.asString ?: "",
                        turn = data.get("turn")?.asString ?: "",
                        userId = data.get("last_move_by")?.asInt,
                        whiteTime = null,
                        blackTime = null,
                    )
                )
                lastMoveCount = moveCount
            }
        }
    }

    // ── Reconnection ────────────────────────────────────────────────────

    fun handleReconnection() {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            Timber.w("Max reconnection attempts reached")
            CoroutineScope(Dispatchers.Main).launch {
                _events.emit(GameEvent.Error("Connection lost. Please rejoin the game."))
            }
            return
        }

        val delay = minOf(1000L * (1 shl reconnectAttempts), 30000L)
        reconnectAttempts++

        Timber.d("Reconnecting in ${delay}ms (attempt $reconnectAttempts)")

        reconnectJob?.cancel()
        reconnectJob = CoroutineScope(Dispatchers.IO + SupervisorJob()).launch {
            delay(delay)
            val gId = gameId ?: return@launch
            try {
                initialize(gId)
                Timber.d("Reconnection successful")
            } catch (e: Exception) {
                Timber.e(e, "Reconnection failed")
                handleReconnection()
            }
        }
    }

    // ── Disconnect ──────────────────────────────────────────────────────

    fun disconnect() {
        pollingJob?.cancel()
        reconnectJob?.cancel()
        pollingJob = null
        reconnectJob = null

        gameId?.let { pusherManager.unsubscribe("game.$it") }
        gameChannel = null
        isConnected = false
        reconnectAttempts = 0
        lastMoveCount = 0
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private suspend fun apiCall(
        call: suspend () -> retrofit2.Response<JsonObject>,
    ): Result<JsonObject> {
        return try {
            val response = call()
            if (response.isSuccessful) {
                Result.success(response.body() ?: JsonObject())
            } else {
                val error = response.errorBody()?.string() ?: "Request failed"
                Result.failure(Exception(error))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
}

// ── Game Events ─────────────────────────────────────────────────────────

sealed class GameEvent {
    data class Connected(val socketId: String) : GameEvent()
    data class MoveMade(
        val move: JsonObject,
        val fen: String,
        val turn: String,
        val userId: Int?,
        val whiteTime: Int?,
        val blackTime: Int?,
    ) : GameEvent()
    data class GameEnded(
        val result: String,
        val endReason: String,
        val winnerUserId: Int?,
    ) : GameEvent()
    data object GamePaused : GameEvent()
    data class GameResumed(val whiteTime: Int?, val blackTime: Int?) : GameEvent()
    data object GameActivated : GameEvent()
    data class ChatMessage(
        val userId: Int,
        val userName: String,
        val message: String,
        val timestamp: String,
    ) : GameEvent()
    data class DrawOffered(val offeredBy: Int) : GameEvent()
    data object DrawAccepted : GameEvent()
    data object DrawDeclined : GameEvent()
    data class UndoRequested(val requestedBy: Int) : GameEvent()
    data object UndoAccepted : GameEvent()
    data object UndoDeclined : GameEvent()
    data object OpponentPinged : GameEvent()
    data class OpponentResigned(val resignedBy: Int) : GameEvent()
    data class PlayerConnected(val userId: Int) : GameEvent()
    data class Error(val message: String) : GameEvent()
}
