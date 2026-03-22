package com.chess99.presentation.referral

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ReferralApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val referralApi: ReferralApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReferralUiState())
    val uiState: StateFlow<ReferralUiState> = _uiState.asStateFlow()

    init {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                launch { loadStats() }
                launch { loadReferredUsers() }
                launch { loadEarnings() }
                launch { loadPayouts() }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load referral data")
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    private suspend fun loadStats() {
        try {
            val response = referralApi.getStats()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val code = body.get("user_referral_code")?.asString
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    stats = ReferralStats(
                        totalReferrals = body.get("total_referrals")?.asInt ?: 0,
                        activeReferrals = body.get("active_referrals")?.asInt ?: 0,
                        totalEarnings = body.get("total_earnings")?.asDouble ?: 0.0,
                        currency = body.get("currency")?.asString ?: "INR",
                    ),
                    referralLink = if (code != null) "https://chess99.com/join/$code" else null,
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load stats")
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadReferredUsers() {
        try {
            val response = referralApi.getReferredUsers()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val users = (body.getAsJsonArray("referred_users") ?: return).map { el ->
                    val u = el.asJsonObject
                    ReferredUser(
                        name = u.get("name")?.asString ?: "Unknown",
                        joinedAt = u.get("created_at")?.asString ?: "",
                        isSubscribed = u.get("is_subscribed")?.asBoolean ?: false,
                    )
                }
                _uiState.value = _uiState.value.copy(referredUsers = users)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load referred users")
        }
    }

    private suspend fun loadEarnings() {
        try {
            val response = referralApi.getEarnings()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val earnings = (body.getAsJsonArray("data") ?: return).map { el ->
                    val e = el.asJsonObject
                    ReferralEarning(
                        description = e.get("description")?.asString ?: "",
                        amount = e.get("amount")?.asDouble ?: 0.0,
                        currency = e.get("currency")?.asString ?: "INR",
                        date = e.get("created_at")?.asString ?: "",
                    )
                }
                _uiState.value = _uiState.value.copy(earnings = earnings)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load earnings")
        }
    }

    private suspend fun loadPayouts() {
        try {
            val response = referralApi.getPayouts()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val payouts = (body.getAsJsonArray("payouts") ?: return).map { el ->
                    val p = el.asJsonObject
                    ReferralPayout(
                        method = p.get("method")?.asString ?: "Bank Transfer",
                        amount = p.get("amount")?.asDouble ?: 0.0,
                        currency = p.get("currency")?.asString ?: "INR",
                        status = p.get("status")?.asString ?: "pending",
                        date = p.get("created_at")?.asString ?: "",
                    )
                }
                _uiState.value = _uiState.value.copy(payouts = payouts)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load payouts")
        }
    }

    fun generateCode(label: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isGenerating = true)
            try {
                val body = JsonObject().apply {
                    label?.let { addProperty("label", it) }
                }
                val response = referralApi.generateCode(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isGenerating = false,
                        snackbarMessage = "New referral code generated!",
                    )
                    loadStats()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isGenerating = false,
                        snackbarMessage = "Failed to generate code.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Generate code error")
                _uiState.value = _uiState.value.copy(
                    isGenerating = false,
                    snackbarMessage = "Error: ${e.message}",
                )
            }
        }
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        viewModelScope.launch {
            try {
                loadStats()
                loadReferredUsers()
                loadEarnings()
                loadPayouts()
            } finally {
                _uiState.value = _uiState.value.copy(isRefreshing = false)
            }
        }
    }

    fun showSnackbar(msg: String) {
        _uiState.value = _uiState.value.copy(snackbarMessage = msg)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }
}

// ── UI State & Data Models ──────────────────────────────────────────────

data class ReferralUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isGenerating: Boolean = false,
    val stats: ReferralStats? = null,
    val referralLink: String? = null,
    val referredUsers: List<ReferredUser> = emptyList(),
    val earnings: List<ReferralEarning> = emptyList(),
    val payouts: List<ReferralPayout> = emptyList(),
    val snackbarMessage: String? = null,
)

data class ReferralStats(
    val totalReferrals: Int,
    val activeReferrals: Int,
    val totalEarnings: Double,
    val currency: String = "INR",
) {
    val formattedEarnings: String
        get() = if (totalEarnings > 0) "$currency ${String.format("%.0f", totalEarnings)}" else "$currency 0"
}

data class ReferredUser(
    val name: String,
    val joinedAt: String,
    val isSubscribed: Boolean,
)

data class ReferralEarning(
    val description: String,
    val amount: Double,
    val currency: String,
    val date: String,
) {
    val formattedAmount: String get() = "+$currency ${String.format("%.0f", amount)}"
}

data class ReferralPayout(
    val method: String,
    val amount: Double,
    val currency: String,
    val status: String,
    val date: String,
) {
    val formattedAmount: String get() = "$currency ${String.format("%.0f", amount)}"
}
