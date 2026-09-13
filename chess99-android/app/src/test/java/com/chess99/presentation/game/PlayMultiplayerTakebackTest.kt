package com.chess99.presentation.game

import androidx.lifecycle.SavedStateHandle
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.GameEvent
import com.chess99.data.websocket.GameWebSocketService
import com.chess99.engine.ChessGame
import com.chess99.engine.StockfishEngine
import com.chess99.presentation.common.FeatureFlagManager
import com.chess99.presentation.social.ShareManager
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.advanceTimeBy
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

@OptIn(ExperimentalCoroutinesApi::class)
class PlayMultiplayerTakebackTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)
    private val socketEvents = MutableSharedFlow<GameEvent>(extraBufferCapacity = 8)

    private lateinit var socketService: GameWebSocketService
    private lateinit var viewModel: PlayMultiplayerViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)

        socketService = mockk(relaxed = true)
        every { socketService.events } returns socketEvents
        coEvery { socketService.initialize(42) } returns true
        coEvery { socketService.requestUndo() } returns Result.success(JsonObject())
        // Stubbed explicitly: a relaxed placeholder here reaches
        // loadChatHistory's onSuccess as a non-JsonObject and the leaked
        // ClassCastException fails an unrelated later runTest class
        // (order-dependent, --max-workers=2).
        coEvery { socketService.getChatMessages() } returns Result.success(JsonObject())

        val gameApi = mockk<GameApi>(relaxed = true)
        coEvery { gameApi.getGame(42) } returns jsonResponse(
            """{
                "game":{
                    "id":42,
                    "fen":"rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
                    "status":"waiting",
                    "white_player_id":7,
                    "black_player_id":8,
                    "game_mode":"casual",
                    "time_control_minutes":10,
                    "increment_seconds":0,
                    "undo_white_remaining":9,
                    "undo_black_remaining":9,
                    "white_player":{"id":7,"name":"Me","rating":1200},
                    "black_player":{"id":8,"name":"Opponent","rating":1200}
                }
            }""".trimIndent(),
        )
        coEvery { gameApi.getGameMoves(42) } returns jsonResponse(
            """{
                "moves":[
                    {"move_number":1,"from":"e2","to":"e4","san":"e4","fen":"","color":"w","captured":false},
                    {"move_number":2,"from":"e7","to":"e5","san":"e5","fen":"","color":"b","captured":false}
                ]
            }""".trimIndent(),
        )

        val tokenManager = mockk<TokenManager>(relaxed = true)
        every { tokenManager.getUserId() } returns 7
        every { tokenManager.getUserName() } returns "Me"
        every { tokenManager.isMinor() } returns false

        val flags = mockk<FeatureFlagManager>(relaxed = true)
        every { flags.flags } returns MutableStateFlow(emptyMap())
        every { flags.isEnabled(any()) } returns false

        viewModel = PlayMultiplayerViewModel(
            savedStateHandle = SavedStateHandle(mapOf("gameId" to 42)),
            gameWebSocketService = socketService,
            gameApi = gameApi,
            matchmakingApi = mockk<MatchmakingApi>(relaxed = true),
            webSocketApi = mockk<WebSocketApi>(relaxed = true),
            tokenManager = tokenManager,
            featureFlagManager = flags,
            stockfishEngine = mockk<StockfishEngine>(relaxed = true),
            shareManager = mockk<ShareManager>(relaxed = true),
        )
        scheduler.runCurrent()
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `unanswered request expires without spending the budget`() {
        viewModel.requestUndo()
        scheduler.runCurrent()

        assertTrue(viewModel.uiState.value.undoRequestPending)
        assertEquals(9, viewModel.uiState.value.undoChancesRemaining)

        scheduler.advanceTimeBy(PlayMultiplayerViewModel.UNDO_REQUEST_TIMEOUT_MS - 1)
        scheduler.runCurrent()
        assertTrue(viewModel.uiState.value.undoRequestPending)

        scheduler.advanceTimeBy(1)
        scheduler.runCurrent()

        assertFalse(viewModel.uiState.value.undoRequestPending)
        assertEquals(9, viewModel.uiState.value.undoChancesRemaining)
        assertEquals("No response — takeback request expired.", viewModel.uiState.value.snackbarMessage)
    }

    @Test
    fun `own undo echo is ignored and opponent request expires`() {
        viewModel.handleGameEvent(GameEvent.UndoRequested(7, "Me", null))
        assertFalse(viewModel.uiState.value.undoRequestedByOpponent)

        viewModel.handleGameEvent(GameEvent.UndoRequested(8, "Opponent", null))
        assertTrue(viewModel.uiState.value.undoRequestedByOpponent)

        scheduler.advanceTimeBy(PlayMultiplayerViewModel.UNDO_REQUEST_TIMEOUT_MS)
        scheduler.runCurrent()
        assertFalse(viewModel.uiState.value.undoRequestedByOpponent)
    }

    @Test
    fun `accepted event replaces board history and own budget from server`() {
        viewModel.handleGameEvent(authoritativeAccepted())

        val state = viewModel.uiState.value
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertTrue(state.moveHistory.isEmpty())
        assertEquals(8, state.undoChancesRemaining)
        assertFalse(state.undoRequestPending)
    }

    @Test
    fun `synthetic response is authoritative and duplicate broadcast is idempotent`() {
        coEvery { socketService.requestUndo() } returns Result.success(
            JsonParser.parseString(
                """{
                    "success":true,
                    "auto_accepted":true,
                    "game":{
                        "fen":"${ChessGame.STARTING_FEN}",
                        "move_count":0,
                        "undo_white_remaining":8,
                        "undo_black_remaining":9
                    }
                }""".trimIndent(),
            ).asJsonObject,
        )

        viewModel.requestUndo()
        scheduler.runCurrent()
        viewModel.handleGameEvent(authoritativeAccepted())

        val state = viewModel.uiState.value
        assertEquals(ChessGame.STARTING_FEN, state.fen)
        assertTrue(state.moveHistory.isEmpty())
        assertEquals(8, state.undoChancesRemaining)
        assertFalse(state.undoRequestPending)
    }

    @Test
    fun `reconnection releases a pending request instead of leaving the button stuck`() {
        viewModel.handleGameEvent(GameEvent.Connected("first"))
        viewModel.requestUndo()
        scheduler.runCurrent()
        assertTrue(viewModel.uiState.value.undoRequestPending)

        viewModel.handleGameEvent(GameEvent.Connected("reconnected"))

        assertFalse(viewModel.uiState.value.undoRequestPending)
        assertEquals(
            "Connection restored — ask for a takeback again if you still need it.",
            viewModel.uiState.value.snackbarMessage,
        )
    }

    private fun authoritativeAccepted() = GameEvent.UndoAccepted(
        fen = ChessGame.STARTING_FEN,
        moveCount = 0,
        undoWhiteRemaining = 8,
        undoBlackRemaining = 9,
        acceptedByUserId = null,
        acceptedBySynthetic = true,
    )

    private fun jsonResponse(json: String): Response<JsonObject> =
        Response.success(JsonParser.parseString(json).asJsonObject)
}
