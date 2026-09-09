package com.chess99.data.repository

import com.chess99.data.api.AuthApi
import com.chess99.data.dto.*
import com.chess99.data.local.TokenManager
import com.chess99.data.websocket.PusherManager
import com.chess99.domain.model.AuthResult
import com.chess99.domain.model.User
import com.chess99.domain.repository.AuthRepository
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.NonCancellable
import kotlinx.coroutines.withContext
import kotlinx.coroutines.withTimeoutOrNull
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenManager: TokenManager,
    private val pusherManager: PusherManager,
) : AuthRepository {

    override suspend fun login(email: String, password: String): Result<AuthResult> {
        return executeAuth { authApi.login(LoginRequest(email, password)) }
    }

    override suspend fun register(
        name: String,
        email: String,
        password: String,
        passwordConfirmation: String,
        birthday: String,
        guardianEmail: String?,
        referralCode: String?,
    ): Result<AuthResult> {
        return executeAuth {
            authApi.register(
                RegisterRequest(
                    name = name,
                    email = email,
                    password = password,
                    passwordConfirmation = passwordConfirmation,
                    birthday = birthday,
                    guardianEmail = guardianEmail,
                    referralCode = referralCode,
                )
            )
        }
    }

    override suspend fun googleMobileLogin(idToken: String, referralCode: String?): Result<AuthResult> {
        return executeAuth {
            authApi.googleMobileLogin(GoogleMobileLoginRequest(idToken, referralCode))
        }
    }

    override suspend fun facebookMobileLogin(accessToken: String): Result<AuthResult> {
        return executeAuth { authApi.facebookMobileLogin(FacebookMobileLoginRequest(accessToken)) }
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

    override suspend fun logout(sessionToken: String?): Result<Unit> {
        // Local account isolation is the source of truth for logout. Do this
        // before the first suspension so offline/slow server revocation can
        // never retain the account on device.
        clearSession()

        if (sessionToken.isNullOrBlank()) return Result.success(Unit)

        val completed = withContext(NonCancellable + Dispatchers.IO) {
            withTimeoutOrNull(LOGOUT_REVOKE_TIMEOUT_MS) {
                try {
                    val response = authApi.logout("Bearer $sessionToken")
                    if (!response.isSuccessful) {
                        Timber.w("Server logout returned ${response.code()}; local session is already clear")
                    }
                } catch (error: Exception) {
                    if (error is CancellationException) throw error
                    Timber.w(error, "Server logout failed; local session is already clear")
                }
                true
            }
        }
        if (completed == null) {
            Timber.w("Server logout timed out; local session is already clear")
        }
        return Result.success(Unit)
    }

    override suspend fun getCurrentUser(): Result<User> {
        val requestedWithToken = tokenManager.getToken()
        return try {
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val userDto = response.body()
                    ?: return Result.failure(Exception("Empty response"))
                val user = userDto.toDomain()
                // A response that began under an account which has since
                // logged out must not repopulate account-scoped metadata.
                if (requestedWithToken != null && tokenManager.getToken() == requestedWithToken) {
                    tokenManager.saveIsMinor(user.isMinor)
                }
                Result.success(user)
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

    override fun clearSession() {
        tokenManager.clearAll()
        pusherManager.disconnect()
    }

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
                tokenManager.saveIsMinor(authResult.user.isMinor)
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

    private companion object {
        const val LOGOUT_REVOKE_TIMEOUT_MS = 2_000L
    }
}
