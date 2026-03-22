package com.chess99.presentation.championship

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ChampionshipApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class ChampionshipInvitation(
    val id: Int,
    val championshipId: Int,
    val championshipName: String,
    val format: String,
    val playerCount: Int,
    val invitedBy: String,
)

data class ChampionshipInvitationsUiState(
    val isLoading: Boolean = false,
    val invitations: List<ChampionshipInvitation> = emptyList(),
    val snackbarMessage: String? = null,
)

@HiltViewModel
class ChampionshipInvitationsViewModel @Inject constructor(
    private val championshipApi: ChampionshipApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChampionshipInvitationsUiState())
    val uiState: StateFlow<ChampionshipInvitationsUiState> = _uiState.asStateFlow()

    init {
        loadInvitations()
    }

    private fun loadInvitations() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                // Use championships list filtered for pending invitations
                val response = championshipApi.getChampionships(
                    status = "invited",
                    page = 1,
                    perPage = 50,
                )
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val arr = body.getAsJsonArray("data")
                        ?: body.getAsJsonArray("championships")
                        ?: return@launch

                    val invitations = arr.map { el ->
                        val c = el.asJsonObject
                        ChampionshipInvitation(
                            id = c.get("invitation_id")?.asInt ?: c.get("id")?.asInt ?: 0,
                            championshipId = c.get("championship_id")?.asInt ?: c.get("id")?.asInt ?: 0,
                            championshipName = c.get("name")?.asString ?: "",
                            format = c.get("format")?.asString ?: "swiss",
                            playerCount = c.get("player_count")?.asInt
                                ?: c.get("participants_count")?.asInt ?: 0,
                            invitedBy = c.get("invited_by")?.asString
                                ?: c.get("organizer_name")?.asString ?: "",
                        )
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        invitations = invitations,
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load championship invitations")
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    fun acceptInvitation(invitationId: Int) {
        viewModelScope.launch {
            try {
                val response = championshipApi.register(invitationId)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        invitations = _uiState.value.invitations.filter { it.id != invitationId },
                        snackbarMessage = "Invitation accepted!",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to accept invitation")
            }
        }
    }

    fun declineInvitation(invitationId: Int) {
        _uiState.value = _uiState.value.copy(
            invitations = _uiState.value.invitations.filter { it.id != invitationId },
            snackbarMessage = "Invitation declined.",
        )
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }
}
