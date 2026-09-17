package com.chess99.presentation.game

import android.content.Context
import com.chess99.R
import com.chess99.data.api.GameApi
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.TestCoroutineScheduler
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runCurrent
import kotlinx.coroutines.test.setMain
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * A shared game link can be opened while logged out, so the viewer must load
 * through the unauthenticated `public/games/{id}` route (routes/api.php:68)
 * and never through `games/{id}`, which sits behind `auth:sanctum` and 401s.
 * This was the P0 "Public game viewer" gap in
 * docs/android-web-parity-gap-analysis.md.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class PublicGameViewerLoadTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var context: Context
    private lateinit var gameApi: GameApi

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        context = mockk(relaxed = true)
        every { context.getString(R.string.player_white) } returns "White"
        every { context.getString(R.string.player_black) } returns "Black"
        every { context.getString(R.string.public_game_not_shared) } returns "Game not found or not publicly shared."
        gameApi = mockk(relaxed = true)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun publicGame(): Response<JsonObject> = Response.success(
        JsonParser.parseString(
            """
            {"success":true,"data":{
              "id":463,
              "result":"1-0",
              "player_color":"black",
              "white_player":{"name":"Arun"},
              "black_player":{"name":"Riya"},
              "moves":[{"san":"e4"},{"san":"e5"},{"san":"Nf3"}]
            }}
            """.trimIndent(),
        ).asJsonObject,
    )

    @Test
    fun `the viewer loads through the public endpoint, not the authenticated one`() {
        coEvery { gameApi.getPublicGame(463) } returns publicGame()

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(463)
        scheduler.runCurrent()

        coVerify(exactly = 1) { gameApi.getPublicGame(463) }
        coVerify(exactly = 0) { gameApi.getGame(any()) }

        val state = vm.state.value
        assertFalse(state.isLoading)
        assertEquals(null, state.error)
        assertEquals(3, state.totalMoves)
        assertEquals("Arun", state.whiteName)
        assertEquals("Riya", state.blackName)
        assertEquals("1-0", state.result)
        assertEquals("black", state.playerColor)
    }

    @Test
    fun `replay controls walk the parsed moves`() {
        coEvery { gameApi.getPublicGame(463) } returns publicGame()

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(463)
        scheduler.runCurrent()

        vm.goToEnd()
        assertEquals(3, vm.state.value.currentMoveIndex)
        // Position 3 is White's Nf3 — the highlight belongs to the ply that
        // produced the position on screen.
        assertEquals("g1", squareName(vm.state.value.lastMoveFrom))
        assertEquals("f3", squareName(vm.state.value.lastMoveTo))

        vm.stepBackward()
        assertEquals(2, vm.state.value.currentMoveIndex)
        assertEquals("e7", squareName(vm.state.value.lastMoveFrom))

        vm.goToStart()
        assertEquals(0, vm.state.value.currentMoveIndex)
        assertEquals(-1, vm.state.value.lastMoveFrom)
    }

    @Test
    fun `an unshared game shows the not-shared message instead of an auth failure`() {
        coEvery { gameApi.getPublicGame(999) } returns Response.error(
            404,
            "".toResponseBody("application/json".toMediaType()),
        )

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(999)
        scheduler.runCurrent()

        assertFalse(vm.state.value.isLoading)
        assertNotNull(vm.state.value.error)
        assertEquals("Game not found or not publicly shared.", vm.state.value.error)
    }

    @Test
    fun `the detail rows come from the public payload`() {
        coEvery { gameApi.getPublicGame(463) } returns Response.success(
            JsonParser.parseString(
                """
                {"id":463,"result":"0-1","player_color":"black",
                 "played_at":"2026-09-16T10:15:00.000000Z","end_reason":"resignation",
                 "opening_name":"King's Pawn Game","time_control":{"minutes":10,"increment":5},
                 "white_player":{"name":"Arun"},"black_player":{"name":"Riya"},
                 "moves":[{"san":"e4"}]}
                """.trimIndent(),
            ).asJsonObject,
        )

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(463)
        scheduler.runCurrent()

        val state = vm.state.value
        assertEquals("2026-09-16T10:15:00.000000Z", state.playedAt)
        assertEquals("resignation", state.endReason)
        assertEquals("King's Pawn Game", state.openingName)
        assertEquals("10+5", state.timeControl)
        assertEquals("https://chess99.com/games/463/replay", vm.shareUrl(463))
    }

    @Test
    fun `null or missing detail fields stay null instead of crashing the load`() {
        coEvery { gameApi.getPublicGame(463) } returns Response.success(
            JsonParser.parseString(
                """{"id":463,"result":null,"played_at":null,"end_reason":null,
                   "opening_name":null,"time_control":{"minutes":null,"increment":null},"moves":[]}""",
            ).asJsonObject,
        )

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(463)
        scheduler.runCurrent()

        val state = vm.state.value
        assertEquals(null, state.error)
        assertEquals(null, state.result)
        assertEquals(null, state.playedAt)
        assertEquals(null, state.endReason)
        assertEquals(null, state.timeControl)
        assertEquals("white", state.playerColor)
    }

    @Test
    fun `the board starts from the served perspective and the flip toggles it`() {
        coEvery { gameApi.getPublicGame(463) } returns publicGame()

        val vm = PublicGameViewerViewModel(gameApi, context)
        vm.loadGame(463)
        scheduler.runCurrent()

        assertEquals("black", vm.state.value.bottomColor)
        vm.flipBoard()
        assertEquals("white", vm.state.value.bottomColor)
        vm.flipBoard()
        assertEquals("black", vm.state.value.bottomColor)

        // The flip is applied on top of whatever perspective was served.
        assertEquals("black", PublicGameViewerViewModel.State(playerColor = "black").bottomColor)
        assertEquals("white", PublicGameViewerViewModel.State(playerColor = "black", isFlipped = true).bottomColor)
    }

    @Test
    fun `played_at renders as a date and bad input renders nothing`() {
        val formatted = formatPlayedDate("2026-09-16T10:15:00.000000Z", java.time.ZoneOffset.UTC)
        assertNotNull(formatted)
        assert(formatted!!.contains("2026")) { formatted }
        assertEquals(null, formatPlayedDate(null))
        assertEquals(null, formatPlayedDate("not a date"))
    }

    private fun squareName(index: Int): String =
        com.chess99.engine.Square.toAlgebraic(index)
}
