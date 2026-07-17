package com.chess99.data.api

import com.google.gson.JsonArray
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

    // NOTE: was `matchmaking/lobby-players` (404 — no such backend route,
    // confirmed via grep of routes/api.php + routes/api_v1.php). Repointed
    // (S10) to the real endpoint: LobbyController::players, which returns
    // `{ real_players: [], synthetic_players: [], rating_window: {...} }`.
    // API_BASE_URL already ends in `/api/v1/` (see BuildConfig) — no `v1/`
    // prefix here, or the resolved URL 404s as `/api/v1/v1/lobby/players`.
    @GET("lobby/players")
    suspend fun getLobbyPlayers(
        @Query("min_rating") minRating: Int,
        @Query("max_rating") maxRating: Int,
    ): Response<JsonObject>

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

    // ── Synthetic Players (Companion Mode) ──────────────────────────────

    // Same base-URL pitfall as getLobbyPlayers above — no `v1/` prefix.
    @GET("synthetic-players")
    suspend fun getSyntheticPlayers(): Response<JsonObject>

    // ── Presence ────────────────────────────────────────────────────────

    @POST("presence/heartbeat")
    suspend fun presenceHeartbeat(@Body body: JsonObject): Response<JsonObject>

    @GET("presence/online-count")
    suspend fun getOnlineCount(): Response<JsonObject>

    // ── Friends ─────────────────────────────────────────────────────────

    // NOTE: FriendController@index and @pending (chess-backend) both return a
    // bare JSON array, not `{"friends": [...]}` — declaring these as
    // Response<JsonObject> would throw on every real call (Gson can't parse a
    // top-level array as an object), silently caught by callers' try/catch.
    @GET("friends")
    suspend fun getFriends(): Response<JsonArray>

    @POST("friends/request")
    suspend fun sendFriendRequest(@Body body: JsonObject): Response<JsonObject>

    @GET("friends/pending")
    suspend fun getPendingFriendRequests(): Response<JsonArray>

    @POST("friends/{id}/accept")
    suspend fun acceptFriendRequest(@Path("id") id: Int): Response<JsonObject>

    @POST("friends/{id}/decline")
    suspend fun declineFriendRequest(@Path("id") id: Int): Response<JsonObject>

    @DELETE("friends/{id}")
    suspend fun removeFriend(@Path("id") id: Int): Response<JsonObject>
}
