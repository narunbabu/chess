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

        // SECURITY (L8): match public endpoints on path-segment boundaries rather
        // than a loose substring. The old `contains()` matched any URL that
        // merely included the fragment (e.g. "championships" matched
        // /championships/{id}/register, wrongly stripping the token → 401).
        val path = originalRequest.url.encodedPath
        val isPublicEndpoint =
            EXACT_PUBLIC_PATHS.any { path == "/$it" || path.endsWith("/$it") } ||
            PREFIX_PUBLIC_PATHS.any { path.endsWith("/$it") || path.contains("/$it/") }

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
        // Endpoints that are public only at their exact path. Notably the
        // championships *listing* is public, but sub-paths such as
        // /championships/{id}/register require the bearer token.
        private val EXACT_PUBLIC_PATHS = listOf(
            "auth/login",
            "auth/register",
            "auth/google/mobile",
            "auth/apple/mobile",
            "health",
            "championships",
        )

        // Endpoints whose sub-paths are also public (e.g. a shared result token).
        private val PREFIX_PUBLIC_PATHS = listOf(
            "shared-results",
        )
    }
}
