package com.chess99.presentation.payment

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.PaymentApi
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

/**
 * ViewModel for the Subscription feature.
 *
 * Manages current subscription status, cancellation, and restore.
 *
 * NOTE: purchase flows (plan listing, Razorpay order creation/verification)
 * are intentionally absent — the Android app ships without in-app purchases
 * for Play policy compliance. Subscriptions bought on the web are reflected
 * here automatically via the account.
 */
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val paymentApi: PaymentApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaymentUiState())
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()

    init {
        loadSubscription()
    }

    // ── Current Subscription ─────────────────────────────────────────────

    fun loadSubscription() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingSubscription = true)
            try {
                val response = paymentApi.getSubscription()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val sub = if (body.has("subscription")) {
                        body.getAsJsonObject("subscription")
                    } else {
                        body
                    }

                    // The backend may return a null subscription for free users
                    val subscription = if (sub.has("plan_name") || sub.has("tier")) {
                        Subscription(
                            id = sub.get("id")?.asInt ?: 0,
                            planName = sub.get("plan_name")?.asString
                                ?: sub.get("tier")?.asString ?: context.getString(R.string.payment_tier_free),
                            tier = sub.get("tier")?.asString ?: "free",
                            status = sub.get("status")?.asString ?: "active",
                            expiresAt = sub.get("expires_at")?.asString
                                ?: sub.get("subscription_expires_at")?.asString ?: "",
                            autoRenew = sub.get("auto_renew")?.asBoolean ?: false,
                            startedAt = sub.get("started_at")?.asString
                                ?: sub.get("subscription_started_at")?.asString ?: "",
                        )
                    } else {
                        null
                    }

                    _uiState.value = _uiState.value.copy(
                        currentSubscription = subscription,
                        isLoadingSubscription = false,
                        planCheckNotice = null,
                    )
                } else {
                    // Non-2xx without a thrown exception — same graceful
                    // degradation as the network-failure path below.
                    _uiState.value = _uiState.value.copy(
                        currentSubscription = null,
                        isLoadingSubscription = false,
                        planCheckNotice = context.getString(R.string.payment_plan_check_failed),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load subscription")
                // Graceful degradation (S3 T6): a failed plan check must never
                // block the screen with an obfuscated-text dialog. Treat the
                // user as Free-tier for this session and show a soft, inline
                // notice instead of an error dialog.
                _uiState.value = _uiState.value.copy(
                    currentSubscription = null,
                    isLoadingSubscription = false,
                    planCheckNotice = context.getString(R.string.payment_plan_check_failed),
                )
            }
        }
    }

    // ── Cancel Subscription ──────────────────────────────────────────────

    fun cancelSubscription() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true, error = null)
            try {
                val response = paymentApi.cancelSubscription()
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isProcessing = false,
                        showCancelDialog = false,
                        snackbarMessage = context.getString(R.string.payment_cancelled),
                    )
                    loadSubscription()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Cancel subscription failed: $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isProcessing = false,
                        error = context.getString(R.string.payment_cancel_failed),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Cancel subscription error")
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    error = friendlyError(context, e, R.string.error_subject_your_subscription),
                )
            }
        }
    }

    // ── Restore Purchases ────────────────────────────────────────────────

    fun restorePurchases() {
        // Re-fetch current subscription from the server
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessing = true, error = null)
            try {
                val response = paymentApi.getSubscription()
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isProcessing = false,
                        snackbarMessage = context.getString(R.string.payment_restored),
                    )
                    loadSubscription()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isProcessing = false,
                        error = context.getString(R.string.payment_nothing_to_restore),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Restore purchases error")
                _uiState.value = _uiState.value.copy(
                    isProcessing = false,
                    error = friendlyError(context, e, R.string.error_subject_your_purchases),
                )
            }
        }
    }

    // ── UI Helpers ────────────────────────────────────────────────────────

    fun showCancelDialog() {
        _uiState.value = _uiState.value.copy(showCancelDialog = true)
    }

    fun dismissCancelDialog() {
        _uiState.value = _uiState.value.copy(showCancelDialog = false)
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }
}

// ── UI State ─────────────────────────────────────────────────────────────

data class PaymentUiState(
    // Subscription
    val currentSubscription: Subscription? = null,
    val isLoadingSubscription: Boolean = false,

    // Non-blocking, inline notice shown when the plan check itself fails
    // (S3 T6) — never rendered as a dialog.
    val planCheckNotice: String? = null,

    // Cancel / restore in flight
    val isProcessing: Boolean = false,

    // UI controls
    val showCancelDialog: Boolean = false,

    // Messaging
    val error: String? = null,
    val snackbarMessage: String? = null,
)

// ── Data Models ──────────────────────────────────────────────────────────

data class Subscription(
    val id: Int,
    val planName: String,
    val tier: String,
    val status: String,
    val expiresAt: String,
    val autoRenew: Boolean,
    val startedAt: String = "",
) {
    val isActive: Boolean get() = status == "active"
    val isCancelled: Boolean get() = status == "cancelled"
    val isExpired: Boolean get() = status == "expired"
}
