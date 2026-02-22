package com.chess99.data.api

import com.chess99.data.local.TokenManager
import okhttp3.Interceptor
import okhttp3.Response
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * OkHttp interceptor that injects Bearer token into all API requests
 * and handles 401 unauthorized responses.
 */
@Singleton
class AuthInterceptor @Inject constructor(
    private val tokenManager: TokenManager,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalRequest = chain.request()

        // Skip auth header for public endpoints
        val isPublicEndpoint = PUBLIC_PATHS.any { originalRequest.url.encodedPath.contains(it) }

        val request = if (!isPublicEndpoint && tokenManager.isLoggedIn()) {
            originalRequest.newBuilder()
                .header("Authorization", "Bearer ${tokenManager.getToken()}")
                .header("Accept", "application/json")
                .build()
        } else {
            originalRequest.newBuilder()
                .header("Accept", "application/json")
                .build()
        }

        val response = chain.proceed(request)

        if (response.code == 401 && !isPublicEndpoint) {
            Timber.w("Received 401 - token may be expired")
            // Token refresh is handled at the repository level to avoid circular dependencies
        }

        return response
    }

    companion object {
        private val PUBLIC_PATHS = listOf(
            "auth/login",
            "auth/register",
            "auth/google/mobile",
            "auth/apple/mobile",
            "health",
            "championships",
            "shared-results",
        )
    }
}
