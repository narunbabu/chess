package com.chess99.data.api

import com.chess99.data.dto.*
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST

interface AuthApi {
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>

    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>

    @POST("auth/google/mobile")
    suspend fun googleMobileLogin(@Body request: GoogleMobileLoginRequest): Response<AuthResponse>

    @POST("auth/apple/mobile")
    suspend fun appleMobileLogin(@Body request: AppleMobileLoginRequest): Response<AuthResponse>

    @POST("auth/refresh")
    suspend fun refreshToken(@Body request: RefreshTokenRequest): Response<AuthResponse>

    @POST("auth/revoke-all")
    suspend fun revokeAllTokens(): Response<RevokeAllResponse>

    @POST("auth/logout")
    suspend fun logout(): Response<MessageResponse>

    @GET("user")
    suspend fun getCurrentUser(): Response<UserDto>

    @GET("health")
    suspend fun getHealth(): Response<HealthResponse>
}
