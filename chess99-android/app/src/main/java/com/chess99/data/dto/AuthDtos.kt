package com.chess99.data.dto

import com.google.gson.annotations.SerializedName

// ── Request DTOs ──────────────────────────────────────────────────────────────

data class LoginRequest(
    val email: String,
    val password: String,
)

data class RegisterRequest(
    val name: String,
    val email: String,
    val password: String,
    @SerializedName("password_confirmation")
    val passwordConfirmation: String,
    // yyyy-MM-dd; required by the backend for age-gating (kid-safe chat + guardian).
    val birthday: String? = null,
    @SerializedName("guardian_email")
    val guardianEmail: String? = null,
)

data class GoogleMobileLoginRequest(
    val idToken: String,
)

data class AppleMobileLoginRequest(
    @SerializedName("identity_token")
    val identityToken: String,
    @SerializedName("authorization_code")
    val authorizationCode: String? = null,
    @SerializedName("user_name")
    val userName: String? = null,
    @SerializedName("user_email")
    val userEmail: String? = null,
)

data class FacebookMobileLoginRequest(
    @SerializedName("access_token")
    val accessToken: String,
)

data class RefreshTokenRequest(
    @SerializedName("device_name")
    val deviceName: String? = null,
)

data class DeviceTokenRequest(
    @SerializedName("device_token")
    val deviceToken: String,
    val platform: String = "android",
    @SerializedName("device_name")
    val deviceName: String? = null,
)

// ── Response DTOs ─────────────────────────────────────────────────────────────

data class AuthResponse(
    val status: String,
    val token: String? = null,
    val user: UserDto? = null,
    val message: String? = null,
)

data class UserDto(
    val id: Int,
    val name: String,
    val email: String,
    @SerializedName("avatar_url")
    val avatarUrl: String? = null,
    val rating: Int? = null,
    @SerializedName("is_provisional")
    val isProvisional: Boolean? = null,
    @SerializedName("games_played")
    val gamesPlayed: Int? = null,
    @SerializedName("peak_rating")
    val peakRating: Int? = null,
    @SerializedName("tutorial_xp")
    val tutorialXp: Int? = null,
    @SerializedName("tutorial_level")
    val tutorialLevel: Int? = null,
    // Age-gating flags appended to every serialized user by the backend (see
    // User::appends in app/Models/User.php) so clients can hide adult-only
    // features (e.g. the Ambassador program) without a birthday round-trip.
    @SerializedName("is_minor")
    val isMinor: Boolean? = null,
    @SerializedName("needs_birthday")
    val needsBirthday: Boolean? = null,
    @SerializedName("created_at")
    val createdAt: String? = null,
    @SerializedName("updated_at")
    val updatedAt: String? = null,
)

data class RevokeAllResponse(
    val status: String,
    val message: String,
    @SerializedName("tokens_revoked")
    val tokensRevoked: Int,
)

data class MessageResponse(
    val status: String,
    val message: String,
)

data class HealthResponse(
    val status: String,
    @SerializedName("api_version")
    val apiVersion: String,
    @SerializedName("min_supported_app_version")
    val minSupportedAppVersion: Map<String, String>,
    val features: Map<String, Boolean>,
    @SerializedName("server_time")
    val serverTime: String,
)
