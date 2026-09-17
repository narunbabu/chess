package com.chess99.presentation.referral

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.ReferralApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.objOrNull
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonObject
import com.google.gson.JsonParser
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import retrofit2.Response
import timber.log.Timber

@HiltViewModel
class ReferralViewModel @Inject constructor(
    private val referralApi: ReferralApi,
    // Injected so failure copy can be read from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ReferralUiState())
    val uiState: StateFlow<ReferralUiState> = _uiState.asStateFlow()

    init {
        loadAll()
    }

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            val jobs = listOf(
                launch { loadStats() },
                launch { loadReferredUsers() },
                launch { loadEarnings() },
                launch { loadPayouts() },
                launch { loadApplication() },
            )
            jobs.joinAll()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadStats() {
        try {
            val response = referralApi.getStats()
            if (response.isSuccessful) {
                val body = response.body()
                val code = body?.get("user_referral_code")?.asString
                _uiState.value = _uiState.value.copy(
                    stats = ReferralStats(
                        totalReferrals = body?.get("total_referrals")?.asInt ?: 0,
                        activeReferrals = body?.get("active_referrals")?.asInt ?: 0,
                        totalEarnings = body?.get("total_earnings")?.asDouble ?: 0.0,
                        currency = body?.get("currency")?.asString ?: "INR",
                    ),
                    referralLink = if (code != null) "https://chess99.com/join/$code" else null,
                    error = null,
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    error = context.getString(R.string.referral_stats_failed),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load stats")
            // Stats are the essential section — without them the screen is
            // useless, so surface a top-level error card with Retry.
            _uiState.value = _uiState.value.copy(
                error = friendlyError(context, e, R.string.error_subject_your_referral_stats),
            )
        }
    }

    private suspend fun loadReferredUsers() {
        try {
            val response = referralApi.getReferredUsers()
            if (response.isSuccessful) {
                val body = response.body()
                val users = body?.get("referred_users")?.arrOrNull()?.mapNotNull { el ->
                    val u = el.objOrNull() ?: return@mapNotNull null
                    ReferredUser(
                        name = u.get("name")?.asString ?: context.getString(R.string.player_unknown),
                        joinedAt = u.get("created_at")?.asString ?: "",
                        isSubscribed = u.get("is_subscribed")?.asBoolean ?: false,
                    )
                } ?: emptyList()
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
                val body = response.body()
                val earnings = body?.get("data")?.arrOrNull()?.mapNotNull { el ->
                    val e = el.objOrNull() ?: return@mapNotNull null
                    ReferralEarning(
                        description = e.get("description")?.asString ?: "",
                        amount = e.get("amount")?.asDouble ?: 0.0,
                        currency = e.get("currency")?.asString ?: "INR",
                        date = e.get("created_at")?.asString ?: "",
                    )
                } ?: emptyList()
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
                val body = response.body()
                val payouts = body?.get("payouts")?.arrOrNull()?.mapNotNull { el ->
                    val p = el.objOrNull() ?: return@mapNotNull null
                    ReferralPayout(
                        method = p.get("method")?.asString ?: context.getString(R.string.referral_payout_bank_transfer),
                        amount = p.get("amount")?.asDouble ?: 0.0,
                        currency = p.get("currency")?.asString ?: "INR",
                        status = p.get("status")?.asString ?: "pending",
                        date = p.get("created_at")?.asString ?: "",
                    )
                } ?: emptyList()
                _uiState.value = _uiState.value.copy(payouts = payouts)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load payouts")
        }
    }

    /** Load the user's ambassador application status (null = not applied). */
    private suspend fun loadApplication() {
        try {
            val response = referralApi.getAmbassadorApplication()
            if (response.isSuccessful) {
                val body = response.body()
                val app = body?.get("application")?.objOrNull()
                _uiState.value = _uiState.value.copy(
                    ambassadorStatus = app?.get("status")?.asString,
                )
            } else if (response.isAdultOnly()) {
                _uiState.value = _uiState.value.copy(isAdultOnly = true)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load ambassador application")
        }
    }

    /** Submit an ambassador application (name, mobile, UPI id, optional reason). */
    fun applyAmbassador(name: String, mobile: String, upiId: String, reason: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmittingApplication = true, applicationError = null)
            try {
                val body = JsonObject().apply {
                    addProperty("name", name.trim())
                    addProperty("mobile", mobile.trim())
                    addProperty("upi_id", upiId.trim())
                    if (reason.isNotBlank()) addProperty("reason", reason.trim())
                }
                val response = referralApi.applyAmbassador(body)
                if (response.isSuccessful) {
                    val status = response.body()
                        ?.getAsJsonObject("application")?.get("status")?.asString ?: "pending"
                    _uiState.value = _uiState.value.copy(
                        isSubmittingApplication = false,
                        applicationSubmitted = true,
                        ambassadorStatus = status,
                        snackbarMessage = context.getString(R.string.referral_application_submitted),
                    )
                } else if (response.isAdultOnly()) {
                    _uiState.value = _uiState.value.copy(
                        isSubmittingApplication = false,
                        isAdultOnly = true,
                    )
                } else {
                    val msg = when (response.code()) {
                        422 -> context.getString(R.string.referral_application_invalid)
                        409 -> context.getString(R.string.referral_application_duplicate)
                        else -> context.getString(R.string.referral_application_failed)
                    }
                    _uiState.value = _uiState.value.copy(
                        isSubmittingApplication = false,
                        applicationError = msg,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Ambassador application error")
                _uiState.value = _uiState.value.copy(
                    isSubmittingApplication = false,
                    applicationError = friendlyError(context, e, R.string.error_subject_your_application),
                )
            }
        }
    }

    fun clearApplicationSubmitted() {
        _uiState.value = _uiState.value.copy(applicationSubmitted = false)
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
                        snackbarMessage = context.getString(R.string.referral_code_generated),
                    )
                    loadStats()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isGenerating = false,
                        snackbarMessage = context.getString(R.string.referral_code_failed),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Generate code error")
                _uiState.value = _uiState.value.copy(
                    isGenerating = false,
                    snackbarMessage = friendlyError(context, e, R.string.error_subject_a_new_code),
                )
            }
        }
    }

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        viewModelScope.launch {
            try {
                val jobs = listOf(
                    launch { loadStats() },
                    launch { loadReferredUsers() },
                    launch { loadEarnings() },
                    launch { loadPayouts() },
                )
                jobs.joinAll()
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

/**
 * True when this failed response is the `EnsureAdult` middleware's 403
 * (`{ "error": "adult_only", ... }`) — see
 * chess-backend/app/Http/Middleware/EnsureAdult.php. Used to branch to a
 * friendly full-screen notice instead of the generic error path.
 */
private fun Response<*>.isAdultOnly(): Boolean {
    if (code() != 403) return false
    return try {
        val errorBody = errorBody()?.string() ?: return false
        JsonParser.parseString(errorBody).asJsonObject.get("error")?.asString == "adult_only"
    } catch (_: Exception) {
        false
    }
}

// ── UI State & Data Models ──────────────────────────────────────────────

data class ReferralUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val isGenerating: Boolean = false,
    val error: String? = null,
    val stats: ReferralStats? = null,
    val referralLink: String? = null,
    val referredUsers: List<ReferredUser> = emptyList(),
    val earnings: List<ReferralEarning> = emptyList(),
    val payouts: List<ReferralPayout> = emptyList(),
    val snackbarMessage: String? = null,
    // Ambassador application
    val ambassadorStatus: String? = null,
    val isSubmittingApplication: Boolean = false,
    val applicationSubmitted: Boolean = false,
    val applicationError: String? = null,
    // True when the backend's EnsureAdult gate (S15) rejected an
    // ambassador-only call with 403 adult_only — the whole Ambassador
    // dashboard/apply flow should show a friendly full-screen notice
    // instead of its normal content.
    val isAdultOnly: Boolean = false,
)

data class ReferralStats(
    val totalReferrals: Int,
    val activeReferrals: Int,
    val totalEarnings: Double,
    val currency: String = "INR",
) {
    val formattedEarnings: String
        get() = if (totalEarnings > 0) "$currency ${String.format(Locale.getDefault(), "%.0f", totalEarnings)}" else "$currency 0"
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
    val formattedAmount: String get() = "+$currency ${String.format(Locale.getDefault(), "%.0f", amount)}"
}

data class ReferralPayout(
    val method: String,
    val amount: Double,
    val currency: String,
    val status: String,
    val date: String,
) {
    val formattedAmount: String get() = "$currency ${String.format(Locale.getDefault(), "%.0f", amount)}"
}
