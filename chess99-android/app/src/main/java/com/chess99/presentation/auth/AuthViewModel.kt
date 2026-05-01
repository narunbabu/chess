package com.chess99.presentation.auth

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.domain.model.User
import com.chess99.domain.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

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
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Login failed",
                        )
                    }
                }
        }
    }

    fun register(name: String, email: String, password: String, passwordConfirmation: String) {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }

            authRepository.register(name, email, password, passwordConfirmation)
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
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Registration failed",
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
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    error = error.message ?: "Google sign-in failed",
                                )
                            }
                        }
                }
                is GoogleSignInResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.exception.message ?: "Google sign-in failed",
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
                            _uiState.update {
                                it.copy(
                                    isLoading = false,
                                    error = error.message ?: "Facebook sign-in failed",
                                )
                            }
                        }
                }
                is FacebookSignInResult.Failure -> {
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.exception.message ?: "Facebook sign-in failed",
                        )
                    }
                }
                FacebookSignInResult.Cancelled -> {
                    _uiState.update { it.copy(isLoading = false) }
                }
            }
        }
    }

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
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Google sign-in failed",
                        )
                    }
                }
        }
    }

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
                    _uiState.update {
                        it.copy(
                            isLoading = false,
                            error = error.message ?: "Facebook sign-in failed",
                        )
                    }
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
