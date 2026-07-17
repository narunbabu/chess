package com.chess99.presentation.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.domain.model.User
import com.chess99.domain.repository.AuthRepository
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import timber.log.Timber
import java.io.IOException
import javax.inject.Inject

/** Actions covered by [authErrorCopy] — each gets its own kid-safe fallback text. */
private enum class AuthAction { LOGIN, REGISTER, GOOGLE, FACEBOOK }

/**
 * Kid-safe auth failure copy. Never surface [Throwable.message] — on non-2xx
 * responses that string is the raw server error body, and on parse/network
 * failures it can be a class name or internal detail. This is the only
 * sanctioned way to turn an auth [Throwable] into user-facing text; the real
 * exception is always logged via Timber separately for debugging.
 *
 * IOException (thrown by OkHttp before any HTTP response exists) reliably
 * means "no network" and reuses [friendlyError]'s copy. Everything else is a
 * server-side rejection (bad credentials, validation failure, or unexpected
 * error) — [AuthRepository]'s `Result<AuthResult>` contract does not carry
 * the HTTP status code that far, so login/register/social failures collapse
 * to one honest, action-specific fallback rather than guessing at a status
 * code from message text.
 */
private fun authErrorCopy(e: Throwable, action: AuthAction): String {
    if (e is IOException) return friendlyError(e, "your request")
    return when (action) {
        AuthAction.LOGIN -> "That email or password doesn't match. Try again."
        AuthAction.REGISTER -> "Please check your details and try again."
        AuthAction.GOOGLE -> "Google sign-in didn't work. Please try again."
        AuthAction.FACEBOOK -> "Facebook sign-in didn't work. Please try again."
    }
}

data class AuthUiState(
    val isLoading: Boolean = false,
    val isAuthenticated: Boolean = false,
    val user: User? = null,
    val error: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val googleSignInHelper: GoogleSignInHelper,
    private val facebookSignInHelper: FacebookSignInHelper,
) : ViewModel() {

    private val _uiState = MutableStateFlow(AuthUiState())
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    init {
        _uiState.update { it.copy(isAuthenticated = authRepository.isLoggedIn()) }
    }

    fun login(email: String, password: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            authRepository.login(email, password)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            user = result.user,
                        )
                    }
                }
                .onFailure { error ->
                    Timber.w(error, "Login failed")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = authErrorCopy(error, AuthAction.LOGIN),
                        )
                    }
                }
        }
    }

    fun register(
        name: String,
        email: String,
        password: String,
        passwordConfirmation: String,
        birthday: String,
        guardianEmail: String? = null,
    ) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            authRepository.register(name, email, password, passwordConfirmation, birthday, guardianEmail)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            user = result.user,
                        )
                    }
                }
                .onFailure { error ->
                    Timber.w(error, "Registration failed")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = authErrorCopy(error, AuthAction.REGISTER),
                        )
                    }
                }
        }
    }

    fun initiateGoogleSignIn(activityContext: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = googleSignInHelper.signIn(activityContext)) {
                is GoogleSignInResult.Success -> {
                    authRepository.googleMobileLogin(result.idToken)
                        .onSuccess { authResult ->
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    isAuthenticated = true,
                                    user = authResult.user,
                                )
                            }
                        }
                        .onFailure { error ->
                            Timber.w(error, "Google mobile login failed")
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    error = authErrorCopy(error, AuthAction.GOOGLE),
                                )
                            }
                        }
                }
                is GoogleSignInResult.Failure -> {
                    Timber.w(result.exception, "Google sign-in failed")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = authErrorCopy(result.exception, AuthAction.GOOGLE),
                        )
                    }
                }
                GoogleSignInResult.Cancelled -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    fun initiateFacebookSignIn(activityContext: Context) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            when (val result = facebookSignInHelper.signIn(activityContext as android.app.Activity)) {
                is FacebookSignInResult.Success -> {
                    authRepository.facebookMobileLogin(result.accessToken)
                        .onSuccess { authResult ->
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    isAuthenticated = true,
                                    user = authResult.user,
                                )
                            }
                        }
                        .onFailure { error ->
                            Timber.w(error, "Facebook mobile login failed")
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    error = authErrorCopy(error, AuthAction.FACEBOOK),
                                )
                            }
                        }
                }
                is FacebookSignInResult.Failure -> {
                    Timber.w(result.exception, "Facebook sign-in failed")
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = authErrorCopy(result.exception, AuthAction.FACEBOOK),
                        )
                    }
                }
                FacebookSignInResult.Cancelled -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

    /**
     * Silent/background Google sign-in (e.g. a stored token replay outside the
     * explicit [initiateGoogleSignIn] button flow). Failure must NOT surface a
     * user-visible error — it falls through quietly to the normal login screen,
     * same as any other unauthenticated launch.
     */
    fun googleSignIn(idToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            authRepository.googleMobileLogin(idToken)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            user = result.user,
                        )
                    }
                }
                .onFailure { error ->
                    Timber.w(error, "Silent Google sign-in failed")
                    _uiState.update { it.copy(isLoading = false) }
                }
        }
    }

    /**
     * Silent/background Facebook sign-in (e.g. a stored token replay outside
     * the explicit [initiateFacebookSignIn] button flow). Failure must NOT
     * surface a user-visible error — it falls through quietly to the normal
     * login screen, same as any other unauthenticated launch.
     */
    fun facebookSignIn(accessToken: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            authRepository.facebookMobileLogin(accessToken)
                .onSuccess { result ->
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            isAuthenticated = true,
                            user = result.user,
                        )
                    }
                }
                .onFailure { error ->
                    Timber.w(error, "Silent Facebook sign-in failed")
                    _uiState.update { it.copy(isLoading = false) }
                }
        }
    }

    /** Get the Facebook CallbackManager for forwarding Activity results. */
    fun getFacebookCallbackManager() = facebookSignInHelper.callbackManager

    fun logout() {
        viewModelScope.launch {
            authRepository.logout()
            _uiState.update {
                AuthUiState(isAuthenticated = false)
            }
        }
    }

    fun clearError() {
        _uiState.update { it.copy(error = null) }
    }
}
