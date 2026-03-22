package com.chess99.data.repository

import com.chess99.data.api.PaymentApi
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Global subscription state holder.
 * Provides app-wide access to the current subscription tier for feature gating.
 * Mirrors chess-frontend/src/contexts/SubscriptionContext.js
 */
@Singleton
class SubscriptionRepository @Inject constructor(
    private val paymentApi: PaymentApi,
) {
    private val _currentTier = MutableStateFlow("free")
    val currentTier: StateFlow<String> = _currentTier.asStateFlow()

    private val _expiresAt = MutableStateFlow<String?>(null)
    val expiresAt: StateFlow<String?> = _expiresAt.asStateFlow()

    val isFree: Boolean get() = _currentTier.value == "free"
    val isPremium: Boolean get() = _currentTier.value in listOf("premium", "studio", "enterprise")

    suspend fun refreshSubscription() {
        try {
            val response = paymentApi.getSubscription()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val sub = if (body.has("subscription")) {
                    body.getAsJsonObject("subscription")
                } else {
                    body
                }
                val tier = sub.get("tier")?.asString ?: "free"
                val expires = sub.get("expires_at")?.asString
                    ?: sub.get("subscription_expires_at")?.asString
                _currentTier.value = tier
                _expiresAt.value = expires
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to refresh subscription")
        }
    }

    fun updateTier(tier: String) {
        _currentTier.value = tier
    }

    fun reset() {
        _currentTier.value = "free"
        _expiresAt.value = null
    }
}
