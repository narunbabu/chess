package com.chess99.data.api

import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.GET

/**
 * Feature entitlement endpoints.
 * Mirrors chess-backend EntitlementController.
 */
interface EntitlementApi {
    @GET("entitlements/me")
    suspend fun getMyEntitlements(): Response<JsonObject>
}

