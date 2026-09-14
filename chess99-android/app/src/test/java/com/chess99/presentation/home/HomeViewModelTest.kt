package com.chess99.presentation.home

import com.chess99.data.api.GameApi
import com.chess99.data.api.MatchmakingApi
import com.chess99.data.local.TokenManager
import com.chess99.domain.model.User
import com.chess99.domain.repository.AuthRepository
import com.chess99.presentation.navigation.PendingDeepLinkStore
import com.google.gson.JsonElement
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.every
import io.mockk.mockk
import io.mockk.verifyOrder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * Home's recovery contract (experience spec item 9): resume/nearby loading
 * distinguishes failure from empty; failures preserve the last known state and
 * expose Retry; a failed nearby discovery never blocks anything else on Home.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class HomeViewModelTest {

    private lateinit var gameApi: GameApi
    private lateinit var matchmakingApi: MatchmakingApi
    private lateinit var tokenManager: TokenManager
    private lateinit var authRepository: AuthRepository
    private lateinit var pendingDeepLinkStore: PendingDeepLinkStore
    private lateinit var viewModel: HomeViewModel

    private val adultUser = User(
        id = 5,
        name = "Arun",
        email = "arun@example.com",
        rating = 1050,
        isMinor = false,
        needsBirthday = false,
    )

    /** Shared scheduler so virtual-time tests can advance the Main dispatcher. */
    private val mainScheduler = kotlinx.coroutines.test.TestCoroutineScheduler()

    @Before
    fun setUp() {
        Dispatchers.setMain(UnconfinedTestDispatcher(mainScheduler))
        gameApi = mockk()
        matchmakingApi = mockk()
        tokenManager = mockk()
        authRepository = mockk()
        pendingDeepLinkStore = mockk()
        every { tokenManager.getUserId() } returns 5
        every { authRepository.isLoggedIn() } returns true
        coEvery { authRepository.getCurrentUser() } returns Result.success(adultUser)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    private fun ok(json: String): Response<JsonObject> =
        Response.success(JsonParser.parseString(json).asJsonObject)

    private fun okElement(json: String): Response<JsonElement> =
        Response.success(JsonParser.parseString(json))

    private fun <T> error(code: Int = 500): Response<T> =
        Response.error(code, "".toResponseBody("application/json".toMediaType()))

    private fun stubSuccessfulLoad(
        activeJson: String = """{"data": []}""",
        unfinishedJson: String = "[]",
        lobbyJson: String = """{"real_players": [], "synthetic_players": []}""",
    ) {
        coEvery { gameApi.getActiveGames() } returns ok(activeJson)
        coEvery { gameApi.getUnfinishedGames() } returns okElement(unfinishedJson)
        coEvery { matchmakingApi.getLobbyPlayers(any(), any()) } returns ok(lobbyJson)
    }

    private fun createViewModel(): HomeViewModel = HomeViewModel(
        gameApi,
        matchmakingApi,
        tokenManager,
        authRepository,
        pendingDeepLinkStore,
    )

    @Test
    fun `successful load lists real nearby players before synthetic ones`() = runTest {
        stubSuccessfulLoad(
            activeJson = """{"data": [{
                "id": 9, "status": "active", "white_player_id": 5,
                "white_player": {"id": 5, "name": "Arun"},
                "black_player": {"id": 8, "name": "Ravi"}, "last_move_at": null
            }]}""",
            lobbyJson = """{
                "real_players": [{"id": 8, "name": "Ravi", "rating": 1020, "in_game": false}],
                "synthetic_players": [{"id": 91, "name": "Rookie Rita", "rating": 900, "computer_level": 2}]
            }""",
        )

        viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(listOf(9), state.continuePlayingGames.map { it.id })
        assertEquals(listOf(8, 91), state.nearbyOpponents.map { it.id })
        assertEquals(listOf(false, true), state.nearbyOpponents.map { it.isSynthetic })
        assertFalse(state.resumeLoadFailed)
        assertFalse(state.isResumeLoading)
        assertFalse(state.hideAmbassadorEntry)
    }

    @Test
    fun `unfinished games served as a bare JSON array load without the resume error`() = runTest {
        // Real GameController::unfinishedGames shape: a top-level array. Typed
        // as a JsonObject it failed conversion and showed "Couldn't check for
        // games to resume" on every Home load (seen after leaving a game).
        stubSuccessfulLoad(
            activeJson = """{"data": [{
                "id": 9, "status": "active", "white_player_id": 5,
                "white_player": {"id": 5, "name": "Arun"},
                "black_player": {"id": 8, "name": "Ravi"}, "last_move_at": null
            }]}""",
            unfinishedJson = """[
                {"id": 9, "white_player_id": 5, "current_user_id": 5, "opponent_name": "Ravi"},
                {"id": 12, "white_player_id": 7, "current_user_id": 5, "opponent_name": "Riya",
                 "paused_at": "2026-09-14T17:51:00.000000Z"}
            ]""",
        )

        viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertFalse(state.resumeLoadFailed)
        assertFalse(state.isResumeLoading)
        assertEquals(listOf(9, 12), state.continuePlayingGames.map { it.id })
        assertEquals(listOf(true, false), state.continuePlayingGames.map { it.playingAsWhite })
    }

    @Test
    fun `empty lobby response is an empty list, never a failure`() = runTest {
        stubSuccessfulLoad(lobbyJson = """{"real_players": [], "synthetic_players": []}""")

        viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.nearbyOpponents.isEmpty())
        assertFalse(state.resumeLoadFailed)
        assertFalse(state.isResumeLoading)
    }

    @Test
    fun `nearby failure preserves the last known list while resume keeps its own error state`() = runTest {
        stubSuccessfulLoad(
            lobbyJson = """{"real_players": [], "synthetic_players": [{"id": 91, "name": "Rookie Rita", "rating": 900}]}""",
        )
        viewModel = createViewModel()
        advanceUntilIdle()
        val knownNearby = viewModel.uiState.value.nearbyOpponents
        assertEquals(listOf(91), knownNearby.map { it.id })

        // Next refresh: everything fails (offline). Resume must report a
        // recoverable failure while nearby keeps showing the last known list.
        coEvery { gameApi.getActiveGames() } returns error(503)
        coEvery { gameApi.getUnfinishedGames() } returns error(503)
        coEvery { matchmakingApi.getLobbyPlayers(any(), any()) } returns error(503)

        viewModel.refresh()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.resumeLoadFailed)
        assertEquals(knownNearby, state.nearbyOpponents)
        assertFalse(state.isResumeLoading)
    }

    @Test
    fun `failed resume fetch with no cached games keeps nearby and hides the ambassador entry fail-closed`() = runTest {
        stubSuccessfulLoad(activeJson = """{"data": []}""")
        coEvery { gameApi.getActiveGames() } returns error(500)
        coEvery { gameApi.getUnfinishedGames() } returns error(500)
        coEvery { authRepository.getCurrentUser() } returns Result.failure(IllegalStateException("offline"))

        viewModel = createViewModel()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.resumeLoadFailed)
        assertTrue(state.continuePlayingGames.isEmpty())
        assertTrue(state.nearbyOpponents.isEmpty())
        // Age gate fails closed when the current user cannot be verified…
        assertTrue(state.hideAmbassadorEntry)

        // …and a Retry that succeeds recovers every section together.
        stubSuccessfulLoad(lobbyJson = """{"real_players": [], "synthetic_players": []}""")
        coEvery { authRepository.getCurrentUser() } returns Result.success(adultUser)
        viewModel.refresh()
        advanceUntilIdle()
        assertFalse(viewModel.uiState.value.resumeLoadFailed)
        assertFalse(viewModel.uiState.value.hideAmbassadorEntry)
    }

    // ── Logout (experience spec: real session clearing from Home/Drawer) ──

    private fun stubLogoutSession() {
        every { authRepository.getToken() } returns "token-123"
        every { authRepository.clearSession() } returns Unit
        every { pendingDeepLinkStore.clear() } returns Unit
    }

    @Test
    fun `drawer logout clears the session and pending deep links before navigating, then still navigates when the server revoke fails offline`() = runTest {
        stubSuccessfulLoad(
            activeJson = """{"data": [{
                "id": 9, "status": "active", "white_player_id": 5,
                "white_player": {"id": 5, "name": "Arun"},
                "black_player": {"id": 8, "name": "Ravi"}, "last_move_at": null
            }]}""",
            lobbyJson = """{"real_players": [], "synthetic_players": []}""",
        )
        stubLogoutSession()
        coEvery { authRepository.logout("token-123") } returns Result.failure(java.io.IOException("offline"))

        viewModel = createViewModel()
        advanceUntilIdle()
        assertTrue(viewModel.uiState.value.continuePlayingGames.isNotEmpty())

        var navigated = 0
        viewModel.logout { navigated++ }
        advanceUntilIdle()

        assertEquals(1, navigated)
        verifyOrder {
            authRepository.clearSession()
            pendingDeepLinkStore.clear()
        }
        // Local state is wiped — the next (Login) screen never sees the
        // previous account's games, even though the server was unreachable.
        val state = viewModel.uiState.value
        assertTrue(state.continuePlayingGames.isEmpty())
        assertTrue(state.nearbyOpponents.isEmpty())
        assertFalse(state.isResumeLoading)
        assertFalse(state.resumeLoadFailed)
    }

    @Test
    fun `an in-flight refresh from the logged-out account never repaints Home after logout`() = runTest {
        // The refresh hangs on the network; logout must cancel/generation-guard
        // it so the delayed response cannot restore the previous account's data.
        coEvery { gameApi.getActiveGames() } coAnswers { delay(10_000); error(503) }
        coEvery { gameApi.getUnfinishedGames() } coAnswers { delay(10_000); error(503) }
        coEvery { authRepository.getCurrentUser() } coAnswers { delay(10_000); Result.failure(IllegalStateException()) }
        stubLogoutSession()
        coEvery { authRepository.logout("token-123") } returns Result.success(Unit)

        viewModel = createViewModel()
        assertTrue(viewModel.uiState.value.isResumeLoading)

        viewModel.logout { }
        mainScheduler.advanceTimeBy(10_001)
        mainScheduler.runCurrent()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state.continuePlayingGames.isEmpty())
        assertFalse(state.isResumeLoading)
        assertFalse(state.resumeLoadFailed)
    }
}
