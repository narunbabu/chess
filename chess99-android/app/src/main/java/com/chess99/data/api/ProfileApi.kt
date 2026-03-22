package com.chess99.data.api

import com.google.gson.JsonObject
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.*

/**
 * Profile & user settings REST API endpoints.
 * Mirrors chess-frontend/src/components/Profile.js +
 *         chess-frontend/src/services/api.js profile calls
 *
 * Backend routes: chess-backend/routes/api_v1.php
 *   POST /profile          -> UserController@updateProfile
 *   GET  /user              -> current user
 *   GET  /rating/history    -> RatingController@getRatingHistory
 *   GET  /performance/stats -> PerformanceController@getPerformanceStats
 *   GET  /organizations     -> OrganizationController@index (search via query)
 *   GET  /friends           -> UserController@getFriends
 *   GET  /friends/pending   -> UserController@getPendingRequests
 */
interface ProfileApi {

    // ── Profile ───────────────────────────────────────────────────────────

    /**
     * Get the current authenticated user's profile.
     * Returns: { id, name, email, avatar_url, rating, birthday, class_of_study, board_theme, ... }
     */
    @GET("user")
    suspend fun getProfile(): Response<JsonObject>

    /**
     * Update profile fields (name, birthday, class_of_study, board_theme, avatar_url).
     * The backend accepts all fields as optional; only provided fields are updated.
     */
    @POST("profile")
    suspend fun updateProfile(@Body body: JsonObject): Response<JsonObject>

    // ── Avatar ────────────────────────────────────────────────────────────

    /**
     * Upload a custom avatar image.
     * Backend expects multipart: field name "avatar", MIME jpeg/png/jpg/gif, max 2MB.
     */
    @Multipart
    @POST("profile")
    suspend fun uploadAvatar(
        @Part avatar: MultipartBody.Part,
    ): Response<JsonObject>

    /**
     * Set a DiceBear avatar by passing the full DiceBear URL.
     * The backend validates the URL starts with "https://api.dicebear.com/".
     * Sent as JSON body: { "avatar_url": "https://api.dicebear.com/7.x/{style}/svg?seed={seed}" }
     */
    @POST("profile")
    suspend fun setDiceBearAvatar(@Body body: JsonObject): Response<JsonObject>

    // ── Rating History ────────────────────────────────────────────────────

    /**
     * Get the user's rating history over time.
     * Returns: { history: [{ rating, created_at, game_id, ... }] }
     */
    @GET("rating/history")
    suspend fun getRatingHistory(): Response<JsonObject>

    // ── Game Statistics ───────────────────────────────────────────────────

    /**
     * Get aggregated performance stats (win/loss/draw counts, streaks, etc.).
     * Returns: { stats: { total_games, wins, losses, draws, win_rate, ... } }
     */
    @GET("performance/stats")
    suspend fun getPerformanceStats(): Response<JsonObject>

    // ── Organizations ─────────────────────────────────────────────────────

    /**
     * List / search organizations.
     * Query param filters by name (server-side search).
     * Returns: { data: [{ id, name, type, member_count, ... }] }
     */
    @GET("organizations")
    suspend fun searchOrganizations(
        @Query("search") query: String? = null,
    ): Response<JsonObject>

    // ── Friends ───────────────────────────────────────────────────────────

    /**
     * Get the authenticated user's friends list.
     * Returns: { friends: [{ id, name, rating, is_online, avatar_url, ... }] }
     */
    @GET("friends")
    suspend fun getFriends(): Response<JsonObject>

    /**
     * Get pending incoming friend requests.
     * Returns: { requests: [{ id, name, rating, ... }] }
     */
    @GET("friends/pending")
    suspend fun getPendingFriendRequests(): Response<JsonObject>

    /**
     * Search users by name/query.
     * Returns: { users: [{ id, name, rating, is_online, avatar_url }] }
     */
    @GET("matchmaking/search-users")
    suspend fun searchUsers(@Query("q") query: String): Response<JsonObject>
}
