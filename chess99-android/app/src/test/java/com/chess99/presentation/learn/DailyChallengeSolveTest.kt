package com.chess99.presentation.learn

import android.content.Context
import android.content.res.AssetManager
import com.chess99.R
import com.chess99.data.api.TutorialApi
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import java.io.IOException
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
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * The daily challenge is the one puzzle on this screen whose solve is
 * persisted server-side (`tutorial/daily-challenge/submit`). These cover the
 * P0 gap from docs/android-web-parity-gap-analysis.md: solving a daily puzzle
 * used to change nothing on the server.
 *
 * Solution entries are SAN and are all the *player's* moves, exactly as the
 * web solver reads them (DailyChallengePage.js:126-140).
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DailyChallengeSolveTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var context: Context
    private lateinit var api: TutorialApi

    // Back-rank mate in one — the backend's own fallback challenge.
    private val mateInOneFen = "6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1"

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        context = mockk(relaxed = true)
        val assets = mockk<AssetManager>()
        // Bundled puzzles are not the subject here; a failing asset read also
        // proves the daily challenge survives one.
        every { assets.open(any()) } throws IOException("no assets in unit tests")
        every { context.assets } returns assets
        every { context.getString(R.string.puzzle_difficulty_medium) } returns "Medium"
        every { context.getString(R.string.puzzle_instruction_default) } returns "Find the best move"
        api = mockk(relaxed = true)
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun challengeResponse(
        solution: String,
        completed: Boolean = false,
        hints: String = """["The king is trapped on the back rank."]""",
    ): Response<JsonObject> = Response.success(
        JsonParser.parseString(
            """
            {"success":true,"data":{
              "id":77,
              "track_slug":"daily-starter",
              "skill_tier":"beginner",
              "user_completion":{"completed":$completed,"attempts":0},
              "challenge_data":{
                "fen":"$mateInOneFen",
                "solution":$solution,
                "hints":$hints,
                "difficulty":"easy",
                "category":"tactics"
              }
            }}
            """.trimIndent(),
        ).asJsonObject,
    )

    private fun viewModel(track: String? = "daily-starter"): PuzzleViewModel {
        val vm = PuzzleViewModel(context, api)
        vm.loadPuzzles(track)
        scheduler.runCurrent()
        return vm
    }

    @Test
    fun `solving the daily challenge posts the SAN line to the submit endpoint`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""")
        val body = slot<JsonObject>()
        coEvery { api.submitDailyChallenge(capture(body)) } returns Response.success(
            JsonParser.parseString("""{"success":true,"data":{"correct":true,"xp_awarded":50}}""").asJsonObject,
        )

        val vm = viewModel()
        vm.attemptMove("a1", "a8", null)
        scheduler.runCurrent()

        assertTrue("puzzle should be solved", vm.uiState.value.isSolved)
        coVerify(exactly = 1) { api.submitDailyChallenge(any()) }
        assertEquals(77, body.captured.get("challenge_id").asInt)
        assertEquals("daily-starter", body.captured.get("track").asString)
        // The server compares this array move-by-move with challenge_data.solution.
        assertEquals("Ra8", body.captured.getAsJsonArray("solution").single().asString)
        assertTrue(body.captured.get("time_spent_seconds").asInt >= 0)

        val review = vm.uiState.value.dailyReview
        assertEquals(true, review?.persisted)
        assertEquals(50, review?.xpAwarded)
    }

    @Test
    fun `a wrong move is refused and nothing is submitted`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""")

        val vm = viewModel()
        vm.attemptMove("a1", "a7", null) // legal, but not the solution
        scheduler.runCurrent()

        assertTrue(vm.uiState.value.isWrongMove)
        assertFalse(vm.uiState.value.isSolved)
        assertEquals(mateInOneFen, vm.uiState.value.fen)
        coVerify(exactly = 0) { api.submitDailyChallenge(any()) }
    }

    @Test
    fun `a multi-move solution is played out in full, with no auto-reply`() {
        // Every entry is a move the player makes — on the web too, which is why
        // the list may change side. The old UCI solver auto-played entry 1 as
        // the opponent's answer and would have submitted a one-move line.
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra7","g6"]""")
        val body = slot<JsonObject>()
        coEvery { api.submitDailyChallenge(capture(body)) } returns Response.success(
            JsonParser.parseString("""{"success":true,"data":{"correct":true,"xp_awarded":50}}""").asJsonObject,
        )

        val vm = viewModel()
        vm.attemptMove("a1", "a7", null)
        scheduler.runCurrent()
        assertFalse("first of two moves must not finish the puzzle", vm.uiState.value.isSolved)
        assertFalse(vm.uiState.value.isWrongMove)
        coVerify(exactly = 0) { api.submitDailyChallenge(any()) }

        vm.attemptMove("g7", "g6", null)
        scheduler.runCurrent()

        assertTrue(vm.uiState.value.isSolved)
        val played = body.captured.getAsJsonArray("solution").map { it.asString }
        assertEquals(listOf("Ra7", "g6"), played)
    }

    @Test
    fun `an already completed challenge is reviewable and is not resubmitted`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""", completed = true)

        val vm = viewModel()
        vm.attemptMove("a1", "a8", null)
        scheduler.runCurrent()

        assertTrue(vm.uiState.value.isSolved)
        coVerify(exactly = 0) { api.submitDailyChallenge(any()) }
        assertEquals(true, vm.uiState.value.dailyReview?.alreadyCompleted)
        assertEquals(true, vm.uiState.value.dailyReview?.persisted)
    }

    @Test
    fun `a failed submit is reported rather than silently claimed as saved`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""")
        coEvery { api.submitDailyChallenge(any()) } returns Response.error(
            500,
            "".toResponseBody("application/json".toMediaType()),
        )

        val vm = viewModel()
        vm.attemptMove("a1", "a8", null)
        scheduler.runCurrent()

        assertEquals(false, vm.uiState.value.dailyReview?.persisted)
    }

    @Test
    fun `the written hint from the challenge is preferred over a from-square`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""")

        val vm = viewModel()
        assertNull(vm.uiState.value.hint)
        vm.requestHint()

        assertEquals("The king is trapped on the back rank.", vm.uiState.value.hint)
    }

    @Test
    fun `the requested track is forwarded to the challenge endpoint`() {
        coEvery { api.getDailyChallenge(any()) } returns challengeResponse("""["Ra8#"]""")

        viewModel(track = "endgame-drill")

        coVerify { api.getDailyChallenge("endgame-drill") }
    }
}
