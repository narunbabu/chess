package com.chess99.data.repository

import com.chess99.data.api.AuthApi
import com.chess99.data.dto.*
import com.chess99.data.local.TokenManager
import com.chess99.domain.model.AuthResult
import com.chess99.domain.model.User
import com.chess99.domain.repository.AuthRepository
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<AuthResult> {
        return executeAuth { authApi.login(LoginRequest(email, password)) }
    }

    override suspend fun register(
        name: String,
        email: String,
        password: String,
        passwordConfirmation: String,
    ): Result<AuthResult> {
        return executeAuth {
            authApi.register(RegisterRequest(name, email, password, passwordConfirmation))
        }
    }

    override suspend fun googleMobileLogin(idToken: String): Result<AuthResult> {
        return executeAuth { authApi.googleMobileLogin(GoogleMobileLoginRequest(idToken)) }
    }

    override suspend fun refreshToken(deviceName: String?): Result<AuthResult> {
        return executeAuth { authApi.refreshToken(RefreshTokenRequest(deviceName)) }
    }

    override suspend fun revokeAllTokens(): Result<Int> {
        return try {
            val response = authApi.revokeAllTokens()
            if (response.isSuccessful) {
                tokenManager.clearAll()
                Result.success(response.body()?.tokensRevoked ?: 0)
            } else {
                Result.failure(Exception("Failed to revoke tokens: ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to revoke all tokens")
            Result.failure(e)
        }
    }

    override suspend fun logout(): Result<Unit> {
        return try {
            val response = authApi.logout()
            tokenManager.clearAll()
            if (response.isSuccessful) {
                Result.success(Unit)
            } else {
                // Still clear local session even if server logout fails
                Result.success(Unit)
            }
        } catch (e: Exception) {
            Timber.e(e, "Logout failed")
            // Clear local session regardless
            tokenManager.clearAll()
            Result.success(Unit)
        }
    }

    override suspend fun getCurrentUser(): Result<User> {
        return try {
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val userDto = response.body()
                    ?: return Result.failure(Exception("Empty response"))
                Result.success(userDto.toDomain())
            } else {
                Result.failure(Exception("Failed to get user: ${response.code()}"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to get current user")
            Result.failure(e)
        }
    }

    override fun isLoggedIn(): Boolean = tokenManager.isLoggedIn()

    override fun getToken(): String? = tokenManager.getToken()

    override fun clearSession() = tokenManager.clearAll()

    private suspend fun executeAuth(
        call: suspend () -> retrofit2.Response<AuthResponse>,
    ): Result<AuthResult> {
        return try {
            val response = call()
            if (response.isSuccessful) {
                val authResult = response.body()?.toAuthResult()
                    ?: return Result.failure(Exception("Invalid auth response"))
                // Persist token and user info
                tokenManager.saveToken(authResult.token)
                tokenManager.saveUserId(authResult.user.id)
                tokenManager.saveUserName(authResult.user.name)
                tokenManager.saveUserEmail(authResult.user.email)
                Result.success(authResult)
            } else {
                val errorBody = response.errorBody()?.string()
                Timber.w("Auth failed: ${response.code()} - $errorBody")
                Result.failure(Exception(errorBody ?: "Authentication failed"))
            }
        } catch (e: Exception) {
            Timber.e(e, "Auth request failed")
            Result.failure(e)
        }
    }
}
