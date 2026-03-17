package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Social features REST API endpoints.
 * Handles game sharing, referrals, leaderboards, and friend activity.
 *
 * Backend routes: chess-backend/routes/api_v1.php
 *   GET  /social/share-data/{gameId}  -> SocialController@getShareData
 *   POST /social/track-share          -> SocialController@trackShare
 *   GET  /social/referral-code        -> SocialController@getReferralCode
 *   POST /social/referral/validate    -> SocialController@validateReferral
 *   GET  /social/leaderboard          -> SocialController@getLeaderboard
 *   GET  /social/friends/activity     -> SocialController@getFriendActivity
 */
interface SocialApi {

    // -- Sharing ──────────────────────────────────────────────────────────────

    /**
     * Get shareable data for a completed game.
     * Returns: { game_id, white_player, black_player, result, rating_change,
     *            total_moves, time_control, pgn, share_url }
     */
    @GET("social/share-data/{gameId}")
    suspend fun getShareData(@Path("gameId") gameId: Int): Response<JsonObject>

    /**
     * Track a share event for analytics.
     * Body: { game_id, platform } where platform is "whatsapp"|"twitter"|"facebook"|"copy"|"other"
     */
    @POST("social/track-share")
    suspend fun trackShare(@Body request: JsonObject): Response<JsonObject>

    // -- Referrals ────────────────────────────────────────────────────────────

    /**
     * Get the current user's referral code.
     * Returns: { referral_code, total_referrals, referral_url }
     */
    @GET("social/referral-code")
    suspend fun getReferralCode(): Response<JsonObject>

    /**
     * Validate and apply a referral code.
     * Body: { referral_code }
     * Returns: { valid, message, bonus_applied }
     */
    @POST("social/referral/validate")
    suspend fun validateReferral(@Body request: JsonObject): Response<JsonObject>

    // -- Leaderboard ──────────────────────────────────────────────────────────

    /**
     * Get the public leaderboard (new endpoint).
     * Query: period = "today"|"7d"|"30d"|"all"
     * Returns all 4 categories in one response:
     * { most_games: [...], most_wins: [...], highest_points: [...], by_rating: [...], period }
     * Each entry: { rank, user_id, name, avatar_url, rating, value }
     */
    @GET("leaderboard")
    suspend fun getPublicLeaderboard(
        @Query("period") period: String = "7d",
    ): Response<JsonObject>

    /**
     * Legacy leaderboard endpoint (kept for backward compatibility).
     */
    @GET("social/leaderboard")
    suspend fun getLeaderboard(
        @Query("type") type: String = "rating",
        @Query("limit") limit: Int = 50,
        @Query("period") period: String = "all",
    ): Response<JsonObject>

    // -- Friend Activity ──────────────────────────────────────────────────────

    /**
     * Get recent activity from friends.
     * Returns: { activities: [{ user_id, user_name, avatar_url, type, description,
     *            game_id, created_at }] }
     */
    @GET("social/friends/activity")
    suspend fun getFriendActivity(): Response<JsonObject>

    // -- Shared Results ─────────────────────────────────────────────────────

    /**
     * Get a shared game result by unique ID.
     */
    @GET("shared-results/{uniqueId}")
    suspend fun getSharedResult(@Path("uniqueId") uniqueId: String): Response<JsonObject>

    /**
     * Get OG metadata for a shared result.
     */
    @GET("shared-results/{uniqueId}/og-data")
    suspend fun getSharedResultOgData(@Path("uniqueId") uniqueId: String): Response<JsonObject>

    /**
     * Upload a shared game result.
     */
    @POST("shared-results")
    suspend fun uploadSharedResult(@Body body: JsonObject): Response<JsonObject>
}
