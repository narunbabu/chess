package com.chess99.data.api

import com.chess99.data.dto.DeviceTokenRequest
import com.chess99.data.dto.MessageResponse
import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

interface DeviceApi {
    @POST("devices/register")
    suspend fun registerDevice(@Body request: DeviceTokenRequest): Response<JsonObject>

    @DELETE("devices/{token}")
    suspend fun removeDevice(@Path("token") token: String): Response<MessageResponse>

    @GET("devices")
    suspend fun getDevices(): Response<JsonObject>
}
