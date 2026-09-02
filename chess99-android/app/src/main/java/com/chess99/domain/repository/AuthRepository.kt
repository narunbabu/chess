package com.chess99.domain.repository

import com.chess99.domain.model.AuthResult
import com.chess99.domain.model.User

interface AuthRepository {
    suspend fun login(email: String, password: String): Result<AuthResult>
    suspend fun register(
        name: String,
        email: String,
        password: String,
        passwordConfirmation: String,
        birthday: String,
        guardianEmail: String? = null,
        referralCode: String? = null,
    ): Result<AuthResult>
    suspend fun googleMobileLogin(idToken: String, referralCode: String? = null): Result<AuthResult>
    suspend fun facebookMobileLogin(accessToken: String): Result<AuthResult>
    suspend fun refreshToken(deviceName: String? = null): Result<AuthResult>
    suspend fun revokeAllTokens(): Result<Int>
    suspend fun logout(): Result<Unit>
    suspend fun getCurrentUser(): Result<User>
    fun isLoggedIn(): Boolean
    fun getToken(): String?
    fun clearSession()
}
