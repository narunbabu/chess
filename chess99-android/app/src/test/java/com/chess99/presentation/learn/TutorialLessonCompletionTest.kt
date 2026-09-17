package com.chess99.presentation.learn

import android.content.Context
import com.chess99.R
import com.chess99.data.api.TutorialApi
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import retrofit2.Response

/**
 * Learn lessons used to validate against a placeholder `lessonId = 0` and to
 * mark themselves complete locally only — the P0 "Learn" gap in
 * docs/android-web-parity-gap-analysis.md. Validation now names the real
 * lesson and stage rows, and finishing posts
 * `tutorial/lessons/{id}/complete`, which the backend refuses without a
 * progress row (TutorialController::completeLesson 404) — hence the start
 * call on load.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class TutorialLessonCompletionTest {

    private val scheduler = TestCoroutineScheduler()
    private val dispatcher = StandardTestDispatcher(scheduler)

    private lateinit var context: Context
    private lateinit var api: TutorialApi

    private val lessonId = 12
    private val stageId = 345

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
        context = mockk(relaxed = true)
        every { context.getString(R.string.lesson_feedback_correct) } returns "Correct!"
        every { context.getString(R.string.lesson_feedback_complete) } returns "Lesson complete!"
        api = mockk(relaxed = true)

        coEvery { api.startLesson(lessonId) } returns Response.success(
            JsonParser.parseString("""{"success":true,"data":{"status":"in_progress"}}""").asJsonObject,
        )
        coEvery { api.getLesson(lessonId) } returns Response.success(
            JsonParser.parseString(
                """
                {"success":true,"data":{
                  "id":$lessonId,
                  "title":"Back rank basics",
                  "description":"Mate on the back rank.",
                  "lesson_type":"interactive",
                  "estimated_duration_minutes":5
                }}
                """.trimIndent(),
            ).asJsonObject,
        )
        coEvery { api.getInteractiveLesson(lessonId) } returns Response.success(
            JsonParser.parseString(
                """
                {"success":true,"data":{"interactive_stages":[
                  {"id":$stageId,"title":"Deliver mate","instruction_text":"Mate in one.",
                   "initial_fen":"6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1","hints":["Back rank."]}
                ]}}
                """.trimIndent(),
            ).asJsonObject,
        )
    }

    @After
    fun tearDown() = Dispatchers.resetMain()

    private fun loadedViewModel(): TutorialLessonViewModel {
        val vm = TutorialLessonViewModel(api, context)
        vm.loadLesson(lessonId)
        scheduler.runCurrent()
        return vm
    }

    @Test
    fun `loading a lesson starts it server-side so completion is accepted`() {
        val vm = loadedViewModel()

        coVerify(exactly = 1) { api.startLesson(lessonId) }
        assertEquals("Back rank basics", vm.state.value.lessonTitle)
        assertEquals(1, vm.state.value.stages.size)
        assertEquals(stageId, vm.state.value.stages[0].stageId)
    }

    @Test
    fun `a move is validated against the real lesson and stage, not a placeholder`() {
        val body = slot<JsonObject>()
        coEvery { api.validateInteractiveMove(lessonId, capture(body)) } returns Response.success(
            JsonParser.parseString(
                """{"success":true,"data":{"validation_result":{"success":true}}}""",
            ).asJsonObject,
        )

        val vm = loadedViewModel()
        vm.onMove("a1", "a8", null)
        scheduler.runCurrent()

        coVerify(exactly = 1) { api.validateInteractiveMove(lessonId, any()) }
        coVerify(exactly = 0) { api.validateInteractiveMove(0, any()) }
        assertEquals(stageId, body.captured.get("stage_id").asInt)
        assertEquals("a1a8", body.captured.get("move").asString)
        assertTrue(body.captured.get("fen_after").asString.isNotBlank())
    }

    @Test
    fun `finishing the last stage persists the completion with a score payload`() {
        val body = slot<JsonObject>()
        coEvery { api.completeLesson(lessonId, capture(body)) } returns Response.success(
            JsonParser.parseString("""{"success":true,"data":{"xp_awarded":25}}""").asJsonObject,
        )

        val vm = loadedViewModel()
        vm.onMove("a1", "a8", null)
        scheduler.runCurrent()

        assertTrue(vm.state.value.isComplete)
        coVerify(exactly = 1) { api.completeLesson(lessonId, any()) }
        // A clean single-stage run scores 100; the backend validates 0..100.
        assertEquals(100, body.captured.get("score").asInt)
        assertTrue(body.captured.get("time_spent_seconds").asInt >= 0)
        assertEquals(1, body.captured.get("attempts").asInt)
        assertEquals(true, vm.state.value.completionPersisted)
        assertEquals(25, vm.state.value.xpAwarded)
    }

    @Test
    fun `a failed completion is surfaced and can be retried`() {
        coEvery { api.completeLesson(lessonId, any()) } returns Response.error(
            500,
            "".toResponseBody("application/json".toMediaType()),
        )

        val vm = loadedViewModel()
        vm.onMove("a1", "a8", null)
        scheduler.runCurrent()

        assertEquals(false, vm.state.value.completionPersisted)

        coEvery { api.completeLesson(lessonId, any()) } returns Response.success(
            JsonParser.parseString("""{"success":true,"data":{"xp_awarded":25}}""").asJsonObject,
        )
        vm.retryCompletion()
        scheduler.runCurrent()

        assertEquals(true, vm.state.value.completionPersisted)
        coVerify(exactly = 2) { api.completeLesson(lessonId, any()) }
    }
}
