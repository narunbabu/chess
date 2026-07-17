package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface for subscription status operations.
 *
 * Backend routes live under /api/subscriptions/ (not /api/v1/),
 * so paths use "../subscriptions/" to resolve correctly against
 * the v1 base URL configured in BuildConfig.API_BASE_URL.
 *
 * NOTE: purchase endpoints (create-order / verify-payment) are intentionally
 * absent — the Android app ships without in-app purchases for Play policy
 * compliance. Subscriptions bought on the web are reflected here.
 */
interface PaymentApi {

    /** GET /api/subscriptions/current — get user's current subscription */
    @GET("../subscriptions/current")
    suspend fun getSubscription(): Response<JsonObject>

    /** POST /api/subscriptions/cancel — cancel subscription at cycle end */
    @POST("../subscriptions/cancel")
    suspend fun cancelSubscription(): Response<JsonObject>
}
