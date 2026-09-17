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
import com.chess99.engine.StockfishEngine
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
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * Resume request refusals (2026-09-15): the backend blocks a same-user retry
 * from 10 s until the 30 s expiry and answers HTTP 200 `success: false`,
 * `is_same_user: true`, `expires_in_seconds`. That must read as "still
 * pending" with the server's countdown, never "Resume request sent".
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PlayMultiplayerResumeRequestTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var socketService: GameWebSocketService
    private lateinit var gameApi: GameApi
    private lateinit var webSocketApi: WebSocketApi
    private lateinit var context: Context

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        socketService = mockk(relaxed = true)
        every { socketService.events } returns MutableSharedFlow<GameEvent>()
        coEvery { socketService.initialize(42) } returns true
        coEvery { socketService.getChatMessages() } returns Result.success(JsonObject())
        gameApi = mockk(relaxed = true)
        coEvery { gameApi.getGameMoves(42) } returns jsonResponse("""{"moves":[]}""")
        webSocketApi = mockk(relaxed = true)
        context = mockk(relaxed = true)
        every { context.getString(R.string.mp_resume_request_sent) } returns "Resume request sent"
        every { context.getString(R.string.mp_resume_pending_mine) } returns
            "Your resume request is still pending. Waiting for your opponent."
        every { context.getString(R.string.mp_resume_pending_theirs) } returns
            "Your opponent already asked to resume. Accept their request to continue."
        every { context.getString(R.string.mp_resume_failed) } returns
            "Couldn't send the resume request. Please try again."
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `same-user retry refused at 10-30 s waits on the server countdown`() {
        coEvery { socketService.requestResume() } returns Result.success(
            json(
                """{"success":false,"message":"Your resume request is still pending. Please wait for opponent response.",
                   "expires_in_seconds":17,"requested_by":7,"is_same_user":true}"""
            )
        )
        val viewModel = pausedViewModel()

        viewModel.requestResumeGame()
        scheduler.runCurrent()

        val state = viewModel.uiState.value
        assertEquals("Your resume request is still pending. Waiting for your opponent.", state.snackbarMessage)
        assertEquals(17, state.resumeRequestSecondsLeft)
        assertNull(state.error)
        assertEquals(MultiplayerPhase.PAUSED, state.gamePhase)

        // Taps during the countdown do not hit the server again.
        viewModel.requestResumeGame()
        scheduler.runCurrent()
        coVerify(exactly = 1) { socketService.requestResume() }

        scheduler.advanceTimeBy(16_000)
        scheduler.runCurrent()
        assertEquals(1, viewModel.uiState.value.resumeRequestSecondsLeft)

        scheduler.advanceTimeBy(1_000)
        scheduler.runCurrent()
        assertEquals(0, viewModel.uiState.value.resumeRequestSecondsLeft)

        viewModel.requestResumeGame()
        scheduler.runCurrent()
        coVerify(exactly = 2) { socketService.requestResume() }
    }

    @Test
    fun `a sent request waits the 30 s window`() {
        coEvery { socketService.requestResume() } returns Result.success(
            json("""{"success":true,"message":"Resume request sent successfully"}""")
        )
        val viewModel = pausedViewModel()

        viewModel.requestResumeGame()
        scheduler.runCurrent()

        assertEquals("Resume request sent", viewModel.uiState.value.snackbarMessage)
        assertEquals(
            PlayMultiplayerViewModel.RESUME_REQUEST_WINDOW_SECONDS,
            viewModel.uiState.value.resumeRequestSecondsLeft,
        )
    }

    @Test
    fun `opponent pending and other refusals are not reported as sent`() {
        coEvery { socketService.requestResume() } returns Result.success(
            json("""{"success":false,"expires_in_seconds":20,"requested_by":8,"is_same_user":false}""")
        )
        val viewModel = pausedViewModel()

        viewModel.requestResumeGame()
        scheduler.runCurrent()
        assertEquals(
            "Your opponent already asked to resume. Accept their request to continue.",
            viewModel.uiState.value.snackbarMessage,
        )
        assertEquals(0, viewModel.uiState.value.resumeRequestSecondsLeft)

        coEvery { socketService.requestResume() } returns Result.success(
            json("""{"success":false,"message":"Game is not paused (current status: active)"}""")
        )
        viewModel.requestResumeGame()
        scheduler.runCurrent()
        assertEquals("Couldn't send the resume request. Please try again.", viewModel.uiState.value.snackbarMessage)
        assertEquals(0, viewModel.uiState.value.resumeRequestSecondsLeft)
    }

    @Test
    fun `game resumed clears the pending countdown`() {
        coEvery { socketService.requestResume() } returns Result.success(
            json("""{"success":false,"expires_in_seconds":17,"is_same_user":true}""")
        )
        val viewModel = pausedViewModel()
        viewModel.requestResumeGame()
        scheduler.runCurrent()
        assertEquals(17, viewModel.uiState.value.resumeRequestSecondsLeft)

        viewModel.handleGameEvent(GameEvent.GameResumed(whiteTime = 600, blackTime = 600))
        scheduler.runCurrent()

        assertEquals(MultiplayerPhase.PLAYING, viewModel.uiState.value.gamePhase)
        assertEquals(0, viewModel.uiState.value.resumeRequestSecondsLeft)
    }

    @Test
    fun `casual synthetic game auto-resumes while opening from Home`() {
        coEvery { webSocketApi.requestResume(42, any()) } returns jsonResponse(
            """{"success":true,"auto_accepted":true,"status":"active"}"""
        )
        coEvery { gameApi.getGame(42) } returns jsonResponse(
            """{
                "game":{
                    "id":42,
                    "fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                    "status":"paused",
                    "white_player_id":7,
                    "black_player_id":null,
                    "game_mode":"casual",
                    "computer_level":1,
                    "synthetic_player_id":45,
                    "time_control_minutes":10,
                    "increment_seconds":0,
                    "white_player":{"id":7,"name":"Me","rating":1200},
                    "black_player":null
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
            webSocketApi = webSocketApi,
            tokenManager = tokenManager,
            featureFlagManager = flags,
            stockfishEngine = mockk<StockfishEngine>(relaxed = true),
            shareManager = mockk<ShareManager>(relaxed = true),
            context = context,
        )
        scheduler.runCurrent()

        assertEquals(MultiplayerPhase.PLAYING, viewModel.uiState.value.gamePhase)
        coVerify(exactly = 1) { webSocketApi.requestResume(42, any()) }
    }

    private fun pausedViewModel(): PlayMultiplayerViewModel {
        coEvery { gameApi.getGame(42) } returns jsonResponse(
            """{
                "game":{
                    "id":42,
                    "fen":"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
                    "status":"active",
                    "white_player_id":7,
                    "black_player_id":8,
                    "game_mode":"casual",
                    "time_control_minutes":10,
                    "increment_seconds":0,
                    "white_player":{"id":7,"name":"Me","rating":1200},
                    "black_player":{"id":8,"name":"Opponent","rating":1200}
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
            webSocketApi = webSocketApi,
            tokenManager = tokenManager,
            featureFlagManager = flags,
            stockfishEngine = mockk<StockfishEngine>(relaxed = true),
            shareManager = mockk<ShareManager>(relaxed = true),
            context = context,
        )
        scheduler.runCurrent()
        viewModel.handleGameEvent(GameEvent.GamePaused)
        scheduler.runCurrent()
        assertEquals(MultiplayerPhase.PAUSED, viewModel.uiState.value.gamePhase)
        return viewModel
    }

    private fun json(text: String): JsonObject = JsonParser.parseString(text).asJsonObject

    private fun jsonResponse(text: String): Response<JsonObject> = Response.success(json(text))
}
