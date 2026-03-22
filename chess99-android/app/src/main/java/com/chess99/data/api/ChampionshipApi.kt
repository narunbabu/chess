package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Championship / tournament REST API endpoints.
 * Mirrors chess-backend/routes/api_v1.php championship routes.
 *
 * Public endpoints (no auth required):
 *   GET  championships          -> index (list with filters)
 *   GET  championships/{id}     -> show (detail)
 *
 * Authenticated endpoints:
 *   POST championships          -> store (create)
 *   POST championships/{id}/register -> register
 *   GET  championships/{id}/standings -> standings
 *   GET  championships/{id}/matches   -> matches (via ChampionshipMatchController)
 *   GET  championships/{id}/participants -> participants
 *
 * Admin endpoints:
 *   POST admin/tournaments/{id}/start -> startChampionship
 */
interface ChampionshipApi {

    // ── Public ─────────────────────────────────────────────────────────

    @GET("championships")
    suspend fun getChampionships(
        @Query("status") status: String? = null,
        @Query("format") format: String? = null,
        @Query("search") search: String? = null,
        @Query("page") page: Int = 1,
        @Query("per_page") perPage: Int = 20,
    ): Response<JsonObject>

    @GET("championships/{id}")
    suspend fun getChampionship(@Path("id") id: Int): Response<JsonObject>

    // ── Authenticated ──────────────────────────────────────────────────

    @POST("championships")
    suspend fun createChampionship(@Body body: JsonObject): Response<JsonObject>

    @POST("championships/{id}/register")
    suspend fun register(@Path("id") id: Int): Response<JsonObject>

    @POST("championships/{id}/register-with-payment")
    suspend fun registerWithPayment(
        @Path("id") id: Int,
        @Body body: JsonObject,
    ): Response<JsonObject>

    @GET("championships/{id}/standings")
    suspend fun getStandings(@Path("id") id: Int): Response<JsonObject>

    @GET("championships/{id}/matches")
    suspend fun getMatches(
        @Path("id") id: Int,
        @Query("round") round: Int? = null,
    ): Response<JsonObject>

    @GET("championships/{id}/participants")
    suspend fun getParticipants(@Path("id") id: Int): Response<JsonObject>

    @GET("championships/{id}/stats")
    suspend fun getStats(@Path("id") id: Int): Response<JsonObject>

    @GET("championships/{id}/my-matches")
    suspend fun getMyMatches(@Path("id") id: Int): Response<JsonObject>

    @GET("championships/{id}/instructions")
    suspend fun getInstructions(@Path("id") id: Int): Response<JsonObject>

    // ── Admin ──────────────────────────────────────────────────────────

    @POST("admin/tournaments/{id}/start")
    suspend fun startChampionship(@Path("id") id: Int): Response<JsonObject>
}
