package com.chess99.presentation.championship

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ChampionshipApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the championship list screen.
 * Mirrors chess-frontend/src/pages/TournamentsPage.js
 */
@HiltViewModel
class ChampionshipListViewModel @Inject constructor(
    private val championshipApi: ChampionshipApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ChampionshipListUiState())
    val uiState: StateFlow<ChampionshipListUiState> = _uiState.asStateFlow()

    init {
        loadChampionships()
    }

    // ── Load Data ──────────────────────────────────────────────────────

    fun loadChampionships() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                val state = _uiState.value
                val response = championshipApi.getChampionships(
                    status = state.statusFilter,
                    format = state.formatFilter,
                    search = state.searchQuery.ifBlank { null },
                )
                if (response.isSuccessful) {
                    val body = response.body() ?: JsonObject()
                    val championships = parseChampionshipList(body)
                    _uiState.value = _uiState.value.copy(
                        championships = championships,
                        isLoading = false,
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to load tournaments (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load championships")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    // ── Filters ────────────────────────────────────────────────────────

    fun setStatusFilter(status: String?) {
        _uiState.value = _uiState.value.copy(statusFilter = status)
        loadChampionships()
    }

    fun setFormatFilter(format: String?) {
        _uiState.value = _uiState.value.copy(formatFilter = format)
        loadChampionships()
    }

    fun setSearchQuery(query: String) {
        _uiState.value = _uiState.value.copy(searchQuery = query)
        if (query.length >= 2 || query.isEmpty()) {
            loadChampionships()
        }
    }

    // ── Registration ───────────────────────────────────────────────────

    fun registerForChampionship(championshipId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(registeringId = championshipId)
            try {
                val response = championshipApi.register(championshipId)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        registeringId = null,
                        snackbarMessage = "Successfully registered!",
                    )
                    loadChampionships()
                } else {
                    val errorBody = response.errorBody()?.string()
                    val message = try {
                        com.google.gson.JsonParser.parseString(errorBody)
                            .asJsonObject.get("message")?.asString
                    } catch (_: Exception) { null }
                    _uiState.value = _uiState.value.copy(
                        registeringId = null,
                        error = message ?: "Registration failed (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to register for championship $championshipId")
                _uiState.value = _uiState.value.copy(
                    registeringId = null,
                    error = "Registration error: ${e.message}",
                )
            }
        }
    }

    // ── Create Championship ────────────────────────────────────────────

    fun createChampionship(
        name: String,
        format: String,
        maxParticipants: Int,
        timeControl: String,
        entryFee: Int,
        description: String,
    ) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCreating = true)
            try {
                val body = JsonObject().apply {
                    addProperty("name", name)
                    addProperty("format", format)
                    addProperty("max_participants", maxParticipants)
                    addProperty("time_control", timeControl)
                    addProperty("entry_fee", entryFee)
                    addProperty("description", description)
                }
                val response = championshipApi.createChampionship(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isCreating = false,
                        showCreateDialog = false,
                        snackbarMessage = "Tournament created!",
                    )
                    loadChampionships()
                } else {
                    _uiState.value = _uiState.value.copy(
                        isCreating = false,
                        error = "Failed to create tournament (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to create championship")
                _uiState.value = _uiState.value.copy(
                    isCreating = false,
                    error = "Error: ${e.message}",
                )
            }
        }
    }

    // ── Dialog Control ─────────────────────────────────────────────────

    fun showCreateDialog() {
        _uiState.value = _uiState.value.copy(showCreateDialog = true)
    }

    fun dismissCreateDialog() {
        _uiState.value = _uiState.value.copy(showCreateDialog = false)
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    private fun parseChampionshipList(body: JsonObject): List<Championship> {
        val dataArray = body.getAsJsonArray("data")
            ?: body.getAsJsonArray("championships")
            ?: return emptyList()

        return dataArray.mapNotNull { el ->
            try {
                val c = el.asJsonObject
                Championship(
                    id = c.get("id")?.asInt ?: return@mapNotNull null,
                    name = c.get("name")?.asString ?: "",
                    description = c.get("description")?.asString,
                    format = c.get("format")?.asString ?: "swiss",
                    status = c.get("status")?.asString ?: "upcoming",
                    timeControl = c.get("time_control")?.asString ?: "10|0",
                    maxParticipants = c.get("max_participants")?.asInt ?: 0,
                    currentParticipants = c.get("current_participants")?.asInt
                        ?: c.get("participants_count")?.asInt ?: 0,
                    entryFee = c.get("entry_fee")?.asInt ?: 0,
                    prizePool = c.get("prize_pool")?.asInt ?: 0,
                    startDate = c.get("start_date")?.asString,
                    endDate = c.get("end_date")?.asString,
                    creatorName = c.get("creator_name")?.asString
                        ?: c.getAsJsonObject("creator")?.get("name")?.asString,
                    isRegistered = c.get("is_registered")?.asBoolean ?: false,
                )
            } catch (e: Exception) {
                Timber.w(e, "Failed to parse championship entry")
                null
            }
        }
    }
}

// ── UI State ────────────────────────────────────────────────────────────

data class ChampionshipListUiState(
    val isLoading: Boolean = false,
    val championships: List<Championship> = emptyList(),
    val statusFilter: String? = null,
    val formatFilter: String? = null,
    val searchQuery: String = "",
    val registeringId: Int? = null,
    val isCreating: Boolean = false,
    val showCreateDialog: Boolean = false,
    val error: String? = null,
    val snackbarMessage: String? = null,
)

data class Championship(
    val id: Int,
    val name: String,
    val description: String?,
    val format: String,
    val status: String,
    val timeControl: String,
    val maxParticipants: Int,
    val currentParticipants: Int,
    val entryFee: Int,
    val prizePool: Int,
    val startDate: String?,
    val endDate: String?,
    val creatorName: String?,
    val isRegistered: Boolean,
)
