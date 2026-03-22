package com.chess99.presentation.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.AuthApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

enum class ResetPasswordStatus { IDLE, LOADING, SUCCESS }

data class ResetPasswordUiState(
    val status: ResetPasswordStatus = ResetPasswordStatus.IDLE,
    val error: String? = null,
)

@HiltViewModel
class ResetPasswordViewModel @Inject constructor(
    private val authApi: AuthApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ResetPasswordUiState())
    val uiState: StateFlow<ResetPasswordUiState> = _uiState.asStateFlow()

    fun resetPassword(token: String, email: String, password: String, passwordConfirmation: String) {
        if (password != passwordConfirmation) {
            _uiState.value = ResetPasswordUiState(error = "Passwords do not match.")
            return
        }
        if (password.length < 8) {
            _uiState.value = ResetPasswordUiState(error = "Password must be at least 8 characters.")
            return
        }

        viewModelScope.launch {
            _uiState.value = ResetPasswordUiState(status = ResetPasswordStatus.LOADING)
            try {
                val body = JsonObject().apply {
                    addProperty("token", token)
                    addProperty("email", email)
                    addProperty("password", password)
                    addProperty("password_confirmation", passwordConfirmation)
                }
                val response = authApi.resetPassword(body)
                if (response.isSuccessful) {
                    _uiState.value = ResetPasswordUiState(status = ResetPasswordStatus.SUCCESS)
                } else {
                    val msg = try {
                        response.errorBody()?.string()?.let {
                            com.google.gson.JsonParser.parseString(it).asJsonObject
                                .get("message")?.asString
                        }
                    } catch (_: Exception) { null }
                    _uiState.value = ResetPasswordUiState(
                        error = msg ?: "Something went wrong. Please try again.",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Reset password error")
                _uiState.value = ResetPasswordUiState(
                    error = "Network error: ${e.message}",
                )
            }
        }
    }
}
