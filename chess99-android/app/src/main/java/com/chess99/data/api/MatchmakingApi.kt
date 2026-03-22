package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Matchmaking & lobby REST API endpoints.
 * Mirrors chess-frontend/src/services/matchmakingService.js
 */
interface MatchmakingApi {

    // ── Matchmaking Queue ───────────────────────────────────────────────

    @POST("matchmaking/join")
    suspend fun joinQueue(@Body body: JsonObject): Response<JsonObject>

    @GET("matchmaking/status/{entryId}")
    suspend fun checkStatus(@Path("entryId") entryId: Int): Response<JsonObject>

    @POST("matchmaking/cancel/{entryId}")
    suspend fun cancelQueue(@Path("entryId") entryId: Int): Response<JsonObject>

    // ── Smart Match (Find Players) ──────────────────────────────────────

    @POST("matchmaking/find-players")
    suspend fun findPlayers(@Body body: JsonObject): Response<JsonObject>

    @POST("matchmaking/accept-match-request")
    suspend fun acceptMatchRequest(@Body body: JsonObject): Response<JsonObject>

    @POST("matchmaking/decline-match-request")
    suspend fun declineMatchRequest(@Body body: JsonObject): Response<JsonObject>

    @POST("matchmaking/cancel-find-players")
    suspend fun cancelFindPlayers(@Body body: JsonObject): Response<JsonObject>

    // ── Lobby Players ───────────────────────────────────────────────────

    @GET("matchmaking/lobby-players")
    suspend fun getLobbyPlayers(): Response<JsonObject>

    @GET("matchmaking/search-users")
    suspend fun searchUsers(@Query("q") query: String): Response<JsonObject>

    // ── Invitations ─────────────────────────────────────────────────────

    @POST("invitations")
    suspend fun sendInvitation(@Body body: JsonObject): Response<JsonObject>

    @GET("invitations/pending")
    suspend fun getPendingInvitations(): Response<JsonObject>

    @GET("invitations/sent")
    suspend fun getSentInvitations(): Response<JsonObject>

    @GET("invitations/accepted")
    suspend fun getAcceptedInvitations(): Response<JsonObject>

    @POST("invitations/{id}/accept")
    suspend fun acceptInvitation(@Path("id") id: Int): Response<JsonObject>

    @POST("invitations/{id}/decline")
    suspend fun declineInvitation(@Path("id") id: Int): Response<JsonObject>

    @POST("invitations/{id}/cancel")
    suspend fun cancelInvitation(@Path("id") id: Int): Response<JsonObject>

    // ── Presence ────────────────────────────────────────────────────────

    @POST("presence/heartbeat")
    suspend fun presenceHeartbeat(@Body body: JsonObject): Response<JsonObject>

    @GET("presence/online-count")
    suspend fun getOnlineCount(): Response<JsonObject>

    // ── Friends ─────────────────────────────────────────────────────────

    @GET("friends")
    suspend fun getFriends(): Response<JsonObject>

    @POST("friends/request")
    suspend fun sendFriendRequest(@Body body: JsonObject): Response<JsonObject>

    @GET("friends/pending")
    suspend fun getPendingFriendRequests(): Response<JsonObject>

    @POST("friends/{id}/accept")
    suspend fun acceptFriendRequest(@Path("id") id: Int): Response<JsonObject>

    @POST("friends/{id}/decline")
    suspend fun declineFriendRequest(@Path("id") id: Int): Response<JsonObject>

    @DELETE("friends/{id}")
    suspend fun removeFriend(@Path("id") id: Int): Response<JsonObject>
}
