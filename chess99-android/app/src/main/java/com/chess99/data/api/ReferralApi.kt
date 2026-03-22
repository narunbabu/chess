package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Referral system REST API endpoints.
 * Handles referral codes, earnings, payouts, and referred user tracking.
 *
 * Backend routes: chess-backend/routes/api.php
 *   GET  /referrals/stats          -> ReferralController@stats
 *   GET  /referrals/my-codes       -> ReferralController@myCodes
 *   POST /referrals/generate       -> ReferralController@generate
 *   GET  /referrals/referred-users -> ReferralController@referredUsers
 *   GET  /referrals/earnings       -> ReferralController@earnings
 *   GET  /referrals/payouts        -> ReferralController@payouts
 *   GET  /referrals/validate/{code}-> ReferralController@validate
 */
interface ReferralApi {

    /** Get referral stats (total referrals, active codes, earnings summary). */
    @GET("referrals/stats")
    suspend fun getStats(): Response<JsonObject>

    /** Get user's referral codes. */
    @GET("referrals/my-codes")
    suspend fun getMyCodes(): Response<JsonObject>

    /** Generate a new referral code. Body: { label? } */
    @POST("referrals/generate")
    suspend fun generateCode(@Body request: JsonObject): Response<JsonObject>

    /** Get list of referred users. */
    @GET("referrals/referred-users")
    suspend fun getReferredUsers(): Response<JsonObject>

    /** Get earnings history. */
    @GET("referrals/earnings")
    suspend fun getEarnings(): Response<JsonObject>

    /** Get payout history. */
    @GET("referrals/payouts")
    suspend fun getPayouts(): Response<JsonObject>

    /** Validate a referral code. */
    @GET("referrals/validate/{code}")
    suspend fun validateCode(@Path("code") code: String): Response<JsonObject>
}
