package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Tutorial & learning system REST API endpoints.
 * Mirrors chess-backend/routes/api_v1.php tutorial routes.
 *
 * All endpoints require authentication (Sanctum).
 * Prefix: tutorial/
 */
interface TutorialApi {

    // ── Modules & Lessons ──────────────────────────────────────────────

    @GET("tutorial/modules")
    suspend fun getModules(): Response<JsonObject>

    @GET("tutorial/modules/{slug}")
    suspend fun getModule(@Path("slug") slug: String): Response<JsonObject>

    @GET("tutorial/lessons/{id}")
    suspend fun getLesson(@Path("id") id: Int): Response<JsonObject>

    @GET("tutorial/lessons/{id}/interactive")
    suspend fun getInteractiveLesson(@Path("id") id: Int): Response<JsonObject>

    // ── Lesson Progress ────────────────────────────────────────────────

    @POST("tutorial/lessons/{id}/start")
    suspend fun startLesson(@Path("id") id: Int): Response<JsonObject>

    @POST("tutorial/lessons/{id}/complete")
    suspend fun completeLesson(@Path("id") id: Int): Response<JsonObject>

    @POST("tutorial/lessons/{id}/validate-move")
    suspend fun validateInteractiveMove(
        @Path("id") id: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @POST("tutorial/lessons/{id}/hint")
    suspend fun getInteractiveHint(@Path("id") id: Int): Response<JsonObject>

    @POST("tutorial/lessons/{id}/reset-stage")
    suspend fun resetInteractiveStage(@Path("id") id: Int): Response<JsonObject>

    @GET("tutorial/lessons/{id}/interactive-progress")
    suspend fun getInteractiveProgress(@Path("id") id: Int): Response<JsonObject>

    // ── Progress & Stats ───────────────────────────────────────────────

    @GET("tutorial/progress")
    suspend fun getProgress(): Response<JsonObject>

    @GET("tutorial/progress/stats")
    suspend fun getStats(): Response<JsonObject>

    // ── Achievements ───────────────────────────────────────────────────

    @GET("tutorial/achievements")
    suspend fun getAchievements(): Response<JsonObject>

    @GET("tutorial/achievements/user")
    suspend fun getUserAchievements(): Response<JsonObject>

    // ── Daily Challenge ────────────────────────────────────────────────

    @GET("tutorial/daily-challenge")
    suspend fun getDailyChallenge(): Response<JsonObject>

    @POST("tutorial/daily-challenge/submit")
    suspend fun submitDailyChallenge(@Body body: JsonObject): Response<JsonObject>

    // ── Practice Games ─────────────────────────────────────────────────

    @POST("tutorial/practice-game/create")
    suspend fun createPracticeGame(@Body body: JsonObject): Response<JsonObject>

    @POST("tutorial/practice-game/{id}/complete")
    suspend fun completePracticeGame(
        @Path("id") id: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    // ── Skill Assessment ───────────────────────────────────────────────

    @POST("tutorial/skill-assessment")
    suspend fun createSkillAssessment(@Body body: JsonObject): Response<JsonObject>
}
