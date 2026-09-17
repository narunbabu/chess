package com.chess99.presentation.game

import android.content.Context
import androidx.lifecycle.SavedStateHandle
import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.GameEvent
import com.chess99.data.websocket.GameWebSocketService
import com.chess99.engine.StockfishEngine
import com.chess99.presentation.common.ActiveGameType
import com.chess99.presentation.common.FeatureFlagManager
import com.chess99.presentation.social.ShareManager
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * Leave game from the navigation warning (2026-09-14 20:24): rated resigns
 * server-side (waiting at most LEAVE_REQUEST_TIMEOUT_MS), any casual leave
 * (human or bot) fire-and-forgets `pause-navigation`, and navigation always
 * follows without waiting on the pause.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlayMultiplayerLeaveTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var socketService: GameWebSocketService
    private lateinit var gameApi: GameApi

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        socketService = mockk(relaxed = true)
        every { socketService.events } returns MutableSharedFlow<GameEvent>()
        coEvery { socketService.initialize(42) } returns true
        coEvery { socketService.getChatMessages() } returns Result.success(JsonObject())
        coEvery { socketService.resignGame() } returns Result.success(JsonObject())
        coEvery { socketService.pauseGame(any(), any()) } returns Result.success(JsonObject())
        gameApi = mockk(relaxed = true)
        coEvery { gameApi.getGameMoves(42) } returns jsonResponse("""{"moves":[]}""")
        coEvery { gameApi.completeGame(42, any()) } returns jsonResponse("{}")
        coEvery { gameApi.pauseNavigation(any(), any()) } returns jsonResponse("{}")
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `leave type follows rated first, then bot, then human`() {
        assertEquals(ActiveGameType.RATED_MULTIPLAYER, leaveGameType(isRated = true, isSyntheticGame = true))
        assertEquals(ActiveGameType.RATED_MULTIPLAYER, leaveGameType(isRated = true, isSyntheticGame = false))
        assertEquals(ActiveGameType.CASUAL_BOT, leaveGameType(isRated = false, isSyntheticGame = true))
        assertEquals(ActiveGameType.CASUAL_MULTIPLAYER, leaveGameType(isRated = false, isSyntheticGame = false))
    }

    @Test
    fun `casual bot leave fire-and-forgets pause-navigation and navigates`() {
        val viewModel = createViewModel(gameMode = "casual", bot = true)
        var left = 0

        viewModel.leaveGame { left++ }
        scheduler.runCurrent()

        assertEquals(1, left)
        coVerify(exactly = 1) {
            gameApi.pauseNavigation(42, match {
                it.get("white_time_remaining_ms").asLong == 600_000L &&
                    it.get("black_time_remaining_ms").asLong == 600_000L &&
                    it.get("paused_reason").asString == "navigation"
            })
        }
        coVerify(exactly = 0) { gameApi.completeGame(any(), any()) }
        coVerify(exactly = 0) { socketService.resignGame() }
        coVerify(exactly = 0) { socketService.pauseGame(any(), any()) }
    }

    @Test
    fun `rated bot leave resigns through completeGame before navigating`() {
        val viewModel = createViewModel(gameMode = "rated", bot = true)
        var left = 0

        viewModel.leaveGame { left++ }
        scheduler.runCurrent()

        assertEquals(1, left)
        coVerify(exactly = 1) {
            gameApi.completeGame(42, match { it.get("end_reason").asString == "resignation" && it.get("result").asString == "0-1" })
        }
        coVerify(exactly = 0) { socketService.resignGame() }
    }

    @Test
    fun `rated human leave resigns and casual human leave pause-navigates`() {
        val rated = createViewModel(gameMode = "rated", bot = false)
        rated.leaveGame {}
        scheduler.runCurrent()
        coVerify(exactly = 1) { socketService.resignGame() }
        coVerify(exactly = 0) { gameApi.pauseNavigation(any(), any()) }
        coVerify(exactly = 0) { socketService.pauseGame(any(), any()) }

        val casual = createViewModel(gameMode = "casual", bot = false)
        casual.leaveGame {}
        scheduler.runCurrent()
        coVerify(exactly = 1) { gameApi.pauseNavigation(42, any()) }
        coVerify(exactly = 0) { socketService.pauseGame(any(), any()) }
        coVerify(exactly = 1) { socketService.resignGame() }
    }

    @Test
    fun `a slow pause-navigation does not delay Leave`() {
        coEvery { gameApi.pauseNavigation(42, any()) } coAnswers {
            delay(60_000)
            jsonResponse("{}")
        }
        val viewModel = createViewModel(gameMode = "casual", bot = false)
        var left = 0

        viewModel.leaveGame { left++ }
        scheduler.runCurrent()

        // The pause request was started but Leave did not wait for it: even
        // advancing no virtual time past the request, navigation already ran.
        assertEquals(1, left)
        coVerify(atLeast = 1) { gameApi.pauseNavigation(42, any()) }
    }

    @Test
    fun `a hung resign still navigates after the timeout, and only once`() {
        coEvery { socketService.resignGame() } coAnswers {
            delay(60_000)
            Result.success(JsonObject())
        }
        val viewModel = createViewModel(gameMode = "rated", bot = false)
        var left = 0

        viewModel.leaveGame { left++ }
        viewModel.leaveGame { left++ }
        scheduler.advanceTimeBy(PlayMultiplayerViewModel.LEAVE_REQUEST_TIMEOUT_MS - 1)
        scheduler.runCurrent()
        assertEquals(0, left)

        scheduler.advanceTimeBy(1)
        scheduler.runCurrent()
        assertEquals(1, left)
    }

    private fun createViewModel(gameMode: String, bot: Boolean): PlayMultiplayerViewModel {
        val opponent = if (bot) {
            """"black_player_id":null,"black_player":null,"computer_level":2,"synthetic_player_id":45,
               "synthetic_player":{"id":45,"name":"Riya First Moves","rating":800}"""
        } else {
            """"black_player_id":8,"black_player":{"id":8,"name":"Opponent","rating":1200}"""
        }
        coEvery { gameApi.getGame(42) } returns jsonResponse(
            """{
                "game":{
                    "id":42,
                    "fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                    "status":"active",
                    "white_player_id":7,
                    "game_mode":"$gameMode",
                    "time_control_minutes":10,
                    "increment_seconds":0,
                    "white_player":{"id":7,"name":"Me","rating":1200},
                    $opponent
                }
            }""".trimIndent(),
        )

        val tokenManager = mockk<TokenManager>(relaxed = true)
        every { tokenManager.getUserId() } returns 7
        every { tokenManager.getUserName() } returns "Me"
        every { tokenManager.isMinor() } returns false

        val flags = mockk<FeatureFlagManager>(relaxed = true)
        every { flags.flags } returns MutableStateFlow(emptyMap())
        every { flags.isEnabled(any()) } returns false

        val viewModel = PlayMultiplayerViewModel(
            savedStateHandle = SavedStateHandle(mapOf("gameId" to 42)),
            gameWebSocketService = socketService,
            gameApi = gameApi,
            matchmakingApi = mockk<MatchmakingApi>(relaxed = true),
            webSocketApi = mockk<WebSocketApi>(relaxed = true),
            tokenManager = tokenManager,
            featureFlagManager = flags,
            stockfishEngine = mockk<StockfishEngine>(relaxed = true),
            shareManager = mockk<ShareManager>(relaxed = true),
            context = mockk<Context>(relaxed = true),
        )
        scheduler.runCurrent()
        assertEquals(MultiplayerPhase.PLAYING, viewModel.uiState.value.gamePhase)
        return viewModel
    }

    private fun jsonResponse(json: String): Response<JsonObject> =
        Response.success(JsonParser.parseString(json).asJsonObject)
}
