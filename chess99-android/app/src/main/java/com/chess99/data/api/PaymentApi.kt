package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

/**
 * Retrofit API interface for subscription & payment operations.
 *
 * Backend routes live under /api/subscriptions/ (not /api/v1/),
 * so paths use "../subscriptions/" to resolve correctly against
 * the v1 base URL configured in BuildConfig.API_BASE_URL.
 */
interface PaymentApi {

    /** GET /api/subscriptions/plans — list all active plans (public) */
    @GET("../subscriptions/plans")
    suspend fun getPlans(): Response<JsonObject>

    /** POST /api/subscriptions/create-order — create Razorpay order */
    @POST("../subscriptions/create-order")
    suspend fun createOrder(@Body request: JsonObject): Response<JsonObject>

    /** POST /api/subscriptions/verify-payment — verify Razorpay signature & activate */
    @POST("../subscriptions/verify-payment")
    suspend fun verifyPayment(@Body request: JsonObject): Response<JsonObject>

    /** GET /api/subscriptions/current — get user's current subscription */
    @GET("../subscriptions/current")
    suspend fun getSubscription(): Response<JsonObject>

    /** POST /api/subscriptions/cancel — cancel subscription at cycle end */
    @POST("../subscriptions/cancel")
    suspend fun cancelSubscription(): Response<JsonObject>

    /** POST /api/subscriptions/checkout — legacy checkout flow */
    @POST("../subscriptions/checkout")
    suspend fun checkout(@Body request: JsonObject): Response<JsonObject>
}
