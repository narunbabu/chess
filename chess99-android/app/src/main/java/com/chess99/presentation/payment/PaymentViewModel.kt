package com.chess99.presentation.payment

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.PaymentApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the Payments & Subscription feature.
 *
 * Manages subscription plans, Razorpay order creation / verification,
 * current subscription status, and cancellation.
 *
 * Mirrors chess-frontend Pricing + Subscription components.
 */
@HiltViewModel
class PaymentViewModel @Inject constructor(
    private val paymentApi: PaymentApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(PaymentUiState())
    val uiState: StateFlow<PaymentUiState> = _uiState.asStateFlow()

    init {
        loadPlans()
        loadSubscription()
    }

    // ── Plans ────────────────────────────────────────────────────────────

    fun loadPlans() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoadingPlans = true)
            try {
                val response = paymentApi.getPlans()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val plansArray = body.getAsJsonArray("plans") ?: return@launch

                    val plans = plansArray.map { el ->
                        val plan = el.asJsonObject
                        val featuresArray = plan.getAsJsonArray("features")
                        val features = featuresArray?.map { it.asString } ?: emptyList()

                        SubscriptionPlan(
                            id = plan.get("id")?.asInt ?: 0,
                            name = plan.get("name")?.asString ?: "",
                            tier = plan.get("tier")?.asString ?: "free",
                            price = plan.get("price")?.asInt ?: 0,
                            currency = plan.get("currency")?.asString ?: "INR",
                            duration = plan.get("duration_label")?.asString
                                ?: plan.get("duration_days")?.let { "${it.asInt} days" }
                                ?: "Monthly",
                            features = features,
                            isPopular = plan.get("is_popular")?.asBoolean ?: false,
                            isActive = plan.get("is_active")?.asBoolean ?: true,
                        )
                    }

                    _uiState.value = _uiState.value.copy(
                        plans = plans,
                        isLoadingPlans = false,
                        isMockMode = body.get("mock_mode")?.asBoolean ?: false,
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoadingPlans = false,
                        error = "Failed to load plans",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load plans")
                _uiState.value = _uiState.value.copy(
                    isLoadingPlans = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    // ── Plan Selection ───────────────────────────────────────────────────

    fun selectPlan(plan: SubscriptionPlan) {
        _uiState.value = _uiState.value.copy(selectedPlan = plan)
    }

    // ── Create Order (Step 1 of Razorpay flow) ──────────────────────────

    fun createOrder(planId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessingPayment = true, error = null)
            try {
                val body = JsonObject().apply {
                    addProperty("plan_id", planId)
                }
                val response = paymentApi.createOrder(body)
                if (response.isSuccessful) {
                    val data = response.body() ?: return@launch
                    val orderData = RazorpayOrderData(
                        orderId = data.get("razorpay_order_id")?.asString
                            ?: data.get("order_id")?.asString ?: "",
                        amount = data.get("amount")?.asInt ?: 0,
                        currency = data.get("currency")?.asString ?: "INR",
                        description = data.get("description")?.asString ?: "Chess99 Subscription",
                        razorpayKey = data.get("razorpay_key")?.asString ?: "",
                        planId = planId,
                    )
                    _uiState.value = _uiState.value.copy(
                        pendingOrder = orderData,
                        isProcessingPayment = false,
                    )
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Create order failed: $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        error = "Could not create order. Please try again.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Create order error")
                _uiState.value = _uiState.value.copy(
                    isProcessingPayment = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    // ── Verify Payment (Step 2 — after Razorpay checkout succeeds) ──────

    fun verifyPayment(
        razorpayPaymentId: String,
        razorpayOrderId: String,
        razorpaySignature: String,
        planId: Int,
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessingPayment = true, error = null)
            try {
                val body = JsonObject().apply {
                    addProperty("razorpay_payment_id", razorpayPaymentId)
                    addProperty("razorpay_order_id", razorpayOrderId)
                    addProperty("razorpay_signature", razorpaySignature)
                    addProperty("plan_id", planId)
                }
                val response = paymentApi.verifyPayment(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        pendingOrder = null,
                        snackbarMessage = "Subscription activated!",
                    )
                    // Refresh subscription & plans
                    loadSubscription()
                    loadPlans()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Verify payment failed: $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        error = "Payment verification failed. Please contact support.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Verify payment error")
                _uiState.value = _uiState.value.copy(
                    isProcessingPayment = false,
                    error = "Verification error: ${e.message}",
                )
            }
        }
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
                                ?: sub.get("tier")?.asString ?: "Free",
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
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoadingSubscription = false,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load subscription")
                _uiState.value = _uiState.value.copy(
                    isLoadingSubscription = false,
                    error = "Failed to load subscription: ${e.message}",
                )
            }
        }
    }

    // ── Cancel Subscription ──────────────────────────────────────────────

    fun cancelSubscription() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessingPayment = true, error = null)
            try {
                val response = paymentApi.cancelSubscription()
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        showCancelDialog = false,
                        snackbarMessage = "Subscription cancelled. It remains active until the end of the billing period.",
                    )
                    loadSubscription()
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Cancel subscription failed: $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        error = "Failed to cancel subscription.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Cancel subscription error")
                _uiState.value = _uiState.value.copy(
                    isProcessingPayment = false,
                    error = "Error: ${e.message}",
                )
            }
        }
    }

    // ── Restore Purchases ────────────────────────────────────────────────

    fun restorePurchases() {
        // Re-fetch current subscription from the server
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isProcessingPayment = true, error = null)
            try {
                val response = paymentApi.getSubscription()
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        snackbarMessage = "Purchases restored successfully.",
                    )
                    loadSubscription()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isProcessingPayment = false,
                        error = "No purchases found to restore.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Restore purchases error")
                _uiState.value = _uiState.value.copy(
                    isProcessingPayment = false,
                    error = "Restore error: ${e.message}",
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

    fun clearPendingOrder() {
        _uiState.value = _uiState.value.copy(pendingOrder = null)
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
    // Plans
    val plans: List<SubscriptionPlan> = emptyList(),
    val selectedPlan: SubscriptionPlan? = null,
    val isLoadingPlans: Boolean = false,

    // Subscription
    val currentSubscription: Subscription? = null,
    val isLoadingSubscription: Boolean = false,

    // Payment processing
    val isProcessingPayment: Boolean = false,
    val pendingOrder: RazorpayOrderData? = null,

    // UI controls
    val showCancelDialog: Boolean = false,
    val isMockMode: Boolean = false,

    // Messaging
    val error: String? = null,
    val snackbarMessage: String? = null,
)

// ── Data Models ──────────────────────────────────────────────────────────

data class SubscriptionPlan(
    val id: Int,
    val name: String,
    val tier: String,
    val price: Int,
    val currency: String,
    val duration: String,
    val features: List<String>,
    val isPopular: Boolean,
    val isActive: Boolean = true,
) {
    val isFree: Boolean get() = price == 0 || tier == "free"
    val formattedPrice: String
        get() = if (isFree) "Free" else "$currency $price"
}

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

data class RazorpayOrderData(
    val orderId: String,
    val amount: Int,
    val currency: String,
    val description: String,
    val razorpayKey: String,
    val planId: Int,
)
