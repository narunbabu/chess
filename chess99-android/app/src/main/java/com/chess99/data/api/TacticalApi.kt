package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Tactical Trainer REST API endpoints.
 * Mirrors chess-backend/routes/api_v1.php tactical routes.
 *
 * All endpoints require authentication (Sanctum).
 * Prefix: tactical/
 */
interface TacticalApi {

    @GET("tactical/progress")
    suspend fun getProgress(): Response<JsonObject>

    @POST("tactical/attempts")
    suspend fun submitAttempt(@Body body: JsonObject): Response<JsonObject>

    @POST("tactical/sync")
    suspend fun syncLocalData(@Body snapshot: JsonObject): Response<JsonObject>

    @GET("tactical/leaderboard")
    suspend fun getLeaderboard(
        @Query("scope") scope: String = "rating",
        @Query("period") period: String = "all",
        @Query("page") page: Int = 1,
    ): Response<JsonObject>
}
