package com.chess99.presentation.game

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import com.chess99.R
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.GameEvent
import com.chess99.data.websocket.GameWebSocketService
import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.SimulatedOpponent
import com.chess99.engine.StockfishEngine
import com.chess99.engine.StockfishResult
import com.chess99.presentation.common.FeatureFlagManager
import com.chess99.presentation.social.ShareManager
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
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

/**
 * Budget accounting for the casual/learning multiplayer Best toggle.
 *
 * Best draws from the same pool as takebacks (`undoChancesRemaining`), a
 * charged reveal is persisted as a `best-move` marker on the move played at
 * that position, and a reload rebuilds the budget as
 * `server remaining − persisted markers` so the pool is neither refunded nor
 * double-charged.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlayMultiplayerBestBudgetTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)
    private val socketEvents = MutableSharedFlow<GameEvent>(extraBufferCapacity = 8)

    private lateinit var socketService: GameWebSocketService
    private lateinit var context: Context

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        context = mockk(relaxed = true)
        every { context.getString(R.string.mp_best_no_chances) } returns "No help chances left."
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun buildViewModel(
        gameJson: String = casualGameJson(),
        movesJson: String = emptyMovesJson(),
    ): PlayMultiplayerViewModel {
        socketService = mockk(relaxed = true)
        every { socketService.events } returns socketEvents
        coEvery { socketService.initialize(42) } returns true
        coEvery { socketService.requestUndo() } returns Result.success(JsonObject())
        // Stubbed explicitly: a relaxed placeholder reaches loadChatHistory's
        // onSuccess as a non-JsonObject and the leaked ClassCastException fails
        // an unrelated later test class (order-dependent).
        coEvery { socketService.getChatMessages() } returns Result.success(JsonObject())
        coEvery { socketService.sendMove(any()) } returns Result.success(JsonObject())

        val gameApi = mockk<GameApi>(relaxed = true)
        coEvery { gameApi.getGame(42) } returns jsonResponse(gameJson)
        coEvery { gameApi.getGameMoves(42) } returns jsonResponse(movesJson)

        val tokenManager = mockk<TokenManager>(relaxed = true)
        every { tokenManager.getUserId() } returns 7
        every { tokenManager.getUserName() } returns "Me"
        every { tokenManager.isMinor() } returns false

        val flags = mockk<FeatureFlagManager>(relaxed = true)
        every { flags.flags } returns MutableStateFlow(emptyMap())
        every { flags.isEnabled(any()) } returns false

        val stockfishEngine = mockk<StockfishEngine>(relaxed = true)
        coEvery { stockfishEngine.getBestMove(any(), any()) } answers {
            val ranked = SimulatedOpponent.rankedMoves(ChessGame(firstArg()))
            StockfishResult(ranked.first().uci, ranked, thinkTimeMs = 12)
        }

        return PlayMultiplayerViewModel(
            savedStateHandle = SavedStateHandle(mapOf("gameId" to 42)),
            gameWebSocketService = socketService,
            gameApi = gameApi,
            matchmakingApi = mockk(relaxed = true),
            webSocketApi = mockk(relaxed = true),
            tokenManager = tokenManager,
            featureFlagManager = flags,
            stockfishEngine = stockfishEngine,
            shareManager = mockk(relaxed = true),
            context = context,
        ).also { scheduler.runCurrent() }
    }

    @Test
    fun `toggling best on charges one shared chance`() {
        val viewModel = buildViewModel()
        assertEquals(9, viewModel.uiState.value.undoChancesRemaining)

        viewModel.setCctHintLevel(2)

        assertEquals(2, viewModel.cctState.value.hintLevel)
        assertEquals(8, viewModel.uiState.value.undoChancesRemaining)
    }

    @Test
    fun `same-position retoggle does not double charge`() {
        val viewModel = buildViewModel()

        viewModel.setCctHintLevel(2)
        viewModel.setCctHintLevel(0)
        viewModel.setCctHintLevel(2)

        assertEquals(2, viewModel.cctState.value.hintLevel)
        assertEquals("same position, one charge only", 8, viewModel.uiState.value.undoChancesRemaining)
    }

    @Test
    fun `empty pool refuses best and explains why`() {
        val viewModel = buildViewModel(gameJson = casualGameJson(undoWhiteRemaining = 0))
        assertEquals(0, viewModel.uiState.value.undoChancesRemaining)

        viewModel.setCctHintLevel(2)

        assertEquals(0, viewModel.cctState.value.hintLevel)
        assertEquals("No help chances left.", viewModel.uiState.value.snackbarMessage)
    }

    @Test
    fun `rated games never enable best`() {
        val viewModel = buildViewModel(gameJson = ratedGameJson())

        viewModel.setCctHintLevel(2)

        assertEquals(0, viewModel.cctState.value.hintLevel)
        assertEquals(0, viewModel.uiState.value.undoChancesRemaining)
    }

    @Test
    fun `move made with best showing carries the marker without a second charge`() {
        val viewModel = buildViewModel()
        viewModel.setCctHintLevel(2)
        assertEquals(8, viewModel.uiState.value.undoChancesRemaining)

        val payload = slot<JsonObject>()
        coEvery { socketService.sendMove(capture(payload)) } returns Result.success(JsonObject())
        viewModel.onPlayerMove("e2", "e4", null)
        scheduler.runCurrent()

        val markers = payload.captured.getAsJsonArray("learning_help")
            ?.map { it.asString }
            ?: emptyList()
        assertTrue("the paid reveal must be persisted", markers.contains("best-move"))

        assertEquals("the move itself must not charge again", 8, viewModel.uiState.value.undoChancesRemaining)
        assertEquals("the position changed, so Best clears", 0, viewModel.cctState.value.hintLevel)
        val lastMove = viewModel.uiState.value.moveHistory.last()
        assertTrue(lastMove.lifelines.contains("best-move"))
    }

    @Test
    fun `opponent move clears best without charging`() {
        val viewModel = buildViewModel()
        viewModel.setCctHintLevel(2)
        assertEquals(8, viewModel.uiState.value.undoChancesRemaining)

        val afterBlackReply = "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2"
        viewModel.handleGameEvent(
            GameEvent.MoveMade(
                move = JsonParser.parseString("""{"from":"e7","to":"e5"}""").asJsonObject,
                fen = afterBlackReply,
                turn = "w",
                userId = 8,
                whiteTime = null,
                blackTime = null,
            ),
        )

        assertEquals(0, viewModel.cctState.value.hintLevel)
        assertEquals("the opponent's move must not cost me a chance", 8, viewModel.uiState.value.undoChancesRemaining)
    }

    @Test
    fun `reload subtracts persisted best markers from the server count`() {
        val moves = """
            {"moves":[
                {"move_number":1,"from":"e2","to":"e4","san":"e4","fen":"","color":"w","captured":false,"learning_help":["best-move","review"]},
                {"move_number":2,"from":"e7","to":"e5","san":"e5","fen":"","color":"b","captured":false},
                {"move_number":3,"from":"g1","to":"f3","san":"Nf3","fen":"","color":"w","captured":false,"learning_help":["review"]},
                {"move_number":4,"from":"b8","to":"c6","san":"Nc6","fen":"","color":"b","captured":false}
            ]}
        """.trimIndent()
        val viewModel = buildViewModel(movesJson = moves)

        val state = viewModel.uiState.value
        assertEquals(
            "server says 9; one of my moves carries a best-move marker",
            8,
            state.undoChancesRemaining,
        )
    }

    @Test
    fun `takeback resync keeps subtracting the kept best spend`() {
        val moves = """
            {"moves":[
                {"move_number":1,"from":"e2","to":"e4","san":"e4","fen":"","color":"w","captured":false,"learning_help":["best-move"]},
                {"move_number":2,"from":"e7","to":"e5","san":"e5","fen":"","color":"b","captured":false},
                {"move_number":3,"from":"g1","to":"f3","san":"Nf3","fen":"","color":"w","captured":false},
                {"move_number":4,"from":"b8","to":"c6","san":"Nc6","fen":"","color":"b","captured":false}
            ]}
        """.trimIndent()
        val viewModel = buildViewModel(movesJson = moves)
        assertEquals(8, viewModel.uiState.value.undoChancesRemaining)

        viewModel.handleGameEvent(
            GameEvent.UndoAccepted(
                fen = ChessGame.STARTING_FEN,
                moveCount = 2,
                undoWhiteRemaining = 8,
                undoBlackRemaining = 9,
                acceptedByUserId = 8,
                acceptedBySynthetic = false,
            ),
        )

        val state = viewModel.uiState.value
        assertEquals(2, state.moveHistory.size)
        assertEquals(
            "server dropped to 8 and the kept e4 still carries its best-move marker",
            7,
            state.undoChancesRemaining,
        )
    }

    @Test
    fun `bestMoveSpend counts only my marked moves`() {
        val myMove = GameMoveRecord(
            moveNumber = 1, from = "e2", to = "e4", san = "e4", fen = "",
            playerColor = Color.WHITE, captured = false, lifelines = listOf("best-move", "review"),
        )
        val opponentMove = GameMoveRecord(
            moveNumber = 2, from = "e7", to = "e5", san = "e5", fen = "",
            playerColor = Color.BLACK, captured = false, lifelines = listOf("best-move"),
        )
        val plainMove = GameMoveRecord(
            moveNumber = 3, from = "g1", to = "f3", san = "Nf3", fen = "",
            playerColor = Color.WHITE, captured = false,
        )

        assertEquals(1, bestMoveSpend(listOf(myMove, opponentMove, plainMove), Color.WHITE))
        assertEquals(1, bestMoveSpend(listOf(myMove, opponentMove, plainMove), Color.BLACK))
        assertEquals(0, bestMoveSpend(emptyList(), Color.WHITE))
    }

    private fun casualGameJson(undoWhiteRemaining: Int = 9) = """
        {
            "game":{
                "id":42,
                "fen":"${ChessGame.STARTING_FEN}",
                "status":"active",
                "white_player_id":7,
                "black_player_id":8,
                "game_mode":"casual",
                "time_control_minutes":10,
                "increment_seconds":0,
                "undo_white_remaining":$undoWhiteRemaining,
                "undo_black_remaining":$undoWhiteRemaining,
                "white_player":{"id":7,"name":"Me","rating":1200},
                "black_player":{"id":8,"name":"Opponent","rating":1200}
            }
        }
    """.trimIndent()

    private fun ratedGameJson() = casualGameJson().replace("\"game_mode\":\"casual\"", "\"game_mode\":\"rated\"")

    private fun emptyMovesJson() = """{"moves":[]}"""

    private fun jsonResponse(json: String): Response<JsonObject> =
        Response.success(JsonParser.parseString(json).asJsonObject)
}
