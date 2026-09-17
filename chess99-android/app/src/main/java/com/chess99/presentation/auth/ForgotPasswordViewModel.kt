package com.chess99.presentation.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.AuthApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

enum class ForgotPasswordStatus { IDLE, LOADING, SUCCESS, OAUTH }

data class ForgotPasswordUiState(
    val status: ForgotPasswordStatus = ForgotPasswordStatus.IDLE,
    val error: String? = null,
)

@HiltViewModel
class ForgotPasswordViewModel @Inject constructor(
    private val authApi: AuthApi,
    // Injected so the validation copy below can come from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ForgotPasswordUiState())
    val uiState: StateFlow<ForgotPasswordUiState> = _uiState.asStateFlow()

    fun sendResetLink(email: String) {
        viewModelScope.launch {
            _uiState.value = ForgotPasswordUiState(status = ForgotPasswordStatus.LOADING)
            try {
                val body = JsonObject().apply { addProperty("email", email) }
                val response = authApi.forgotPassword(body)
                if (response.isSuccessful) {
                    val data = response.body()
                    if (data?.get("oauth")?.asBoolean == true) {
                        _uiState.value = ForgotPasswordUiState(status = ForgotPasswordStatus.OAUTH)
                    } else {
                        _uiState.value = ForgotPasswordUiState(status = ForgotPasswordStatus.SUCCESS)
                    }
                } else {
                    val code = response.code()
                    if (code == 422) {
                        _uiState.value = ForgotPasswordUiState(
                            status = ForgotPasswordStatus.IDLE,
                            error = context.getString(R.string.auth_invalid_email),
                        )
                    } else {
                        // Never leak user existence — show success even on server error
                        _uiState.value = ForgotPasswordUiState(status = ForgotPasswordStatus.SUCCESS)
                    }
                }
            } catch (e: Exception) {
                Timber.e(e, "Forgot password error")
                // Show success to avoid leaking user existence
                _uiState.value = ForgotPasswordUiState(status = ForgotPasswordStatus.SUCCESS)
            }
        }
    }
}
