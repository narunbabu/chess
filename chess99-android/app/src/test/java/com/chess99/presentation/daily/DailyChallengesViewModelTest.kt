package com.chess99.presentation.daily

import android.content.Context
import com.chess99.R
import com.chess99.data.api.TutorialApi
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
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * The Daily hub used to fill its leaderboard from the general all-time rating
 * endpoint, which has nothing to do with today's challenge (the P0 "Daily
 * Challenges" gap in docs/android-web-parity-gap-analysis.md). It now reads
 * `tutorial/daily-challenge/leaderboard`, which ranks today's completions by
 * fastest solve.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DailyChallengesViewModelTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var context: Context
    private lateinit var api: TutorialApi

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        context = mockk(relaxed = true)
        // getString(resId, vararg) — MockK may hand the format args either
        // expanded or as a single array, so flatten before formatting.
        every { context.getString(any<Int>(), *anyVararg()) } answers {
            val formatArgs = args.drop(1).flatMap { arg ->
                if (arg is Array<*>) arg.toList() else listOf(arg)
            }
            when (firstArg<Int>()) {
                R.string.daily_leader_time_seconds -> "${formatArgs[0]}s"
                R.string.daily_leader_time_min_sec ->
                    String.format("%dm %02ds", formatArgs[0], formatArgs[1])
                else -> ""
            }
        }
        every { context.getString(R.string.player_generic) } returns "Player"
        api = mockk(relaxed = true)
        coEvery { api.getDailyChallenge(any()) } returns Response.success(
            JsonParser.parseString(
                """
                {"success":true,"data":{
                  "id":77,
                  "track_slug":"daily-starter",
                  "skill_tier":"beginner",
                  "xp_reward":50,
                  "streak":4,
                  "challenge_type_display":"Puzzle",
                  "user_completion":{"completed":false},
                  "access":{"is_locked":false,"required_tier":"free"},
                  "track":{"slug":"daily-starter","label":"Daily Starter","required_tier":"free"},
                  "available_tracks":[
                    {"slug":"daily-starter","label":"Daily Starter","required_tier":"free","challenge_type":"puzzle","xp_reward":50,"is_locked":false},
                    {"slug":"endgame-drill","label":"Endgame Drill","required_tier":"silver","challenge_type":"endgame","xp_reward":80,"is_locked":true}
                  ]
                }}
                """.trimIndent(),
            ).asJsonObject,
        )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun leaderboard(): Response<JsonObject> = Response.success(
        JsonParser.parseString(
            """
            {"success":true,"data":[
              {"rank":1,"name":"Arun","time_spent_seconds":42,"attempts":1},
              {"rank":2,"name":"Riya","time_spent_seconds":65,"attempts":2},
              {"rank":3,"time_spent_seconds":90,"attempts":1}
            ]}
            """.trimIndent(),
        ).asJsonObject,
    )

    @Test
    fun `the leaderboard comes from the daily-challenge endpoint and ranks by solve time`() {
        coEvery { api.getDailyChallengeLeaderboard(any(), any()) } returns leaderboard()

        val vm = DailyChallengesViewModel(api, context)
        scheduler.runCurrent()

        // The view model no longer takes TacticalApi at all, so the all-time
        // rating leaderboard is not reachable from here.
        coVerify { api.getDailyChallengeLeaderboard(any(), any()) }

        val leaders = vm.uiState.value.leaders
        assertEquals(3, leaders.size)
        assertEquals(1, leaders[0].rank)
        assertEquals("Arun", leaders[0].name)
        assertEquals("42s", leaders[0].score)
        assertEquals("1m 05s", leaders[1].score)
        // A completion whose user row did not load still ranks, named generically.
        assertEquals("Player", leaders[2].name)
    }

    @Test
    fun `the challenge, tracks and lock state are read from the challenge payload`() {
        coEvery { api.getDailyChallengeLeaderboard(any(), any()) } returns leaderboard()

        val vm = DailyChallengesViewModel(api, context)
        scheduler.runCurrent()

        val state = vm.uiState.value
        assertEquals(4, state.streak)
        assertEquals("daily-starter", state.selectedTrack)
        assertEquals(2, state.tracks.size)
        assertTrue(state.tracks.first { it.slug == "endgame-drill" }.isLocked)
        assertEquals(77, state.challenge?.challengeId)
        assertEquals("daily-starter", state.challenge?.trackSlug)
        assertEquals(50, state.challenge?.xpReward)
    }

    @Test
    fun `selecting a track reloads both the challenge and its leaderboard for that track`() {
        coEvery { api.getDailyChallengeLeaderboard(any(), any()) } returns leaderboard()

        val vm = DailyChallengesViewModel(api, context)
        scheduler.runCurrent()

        vm.selectTrack("endgame-drill")
        scheduler.runCurrent()

        coVerify { api.getDailyChallenge("endgame-drill") }
        coVerify { api.getDailyChallengeLeaderboard(any(), "endgame-drill") }
    }
}
