package com.chess99.presentation.parent

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ParentApi
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * Parent dashboard / "My Kids" ViewModel.
 * Mirrors chess-frontend/src/pages/MyKidsPage.js — loads the guardian dashboard
 * (children report cards + pending links), and handles link/accept/revoke/email/manage.
 */
@HiltViewModel
class MyKidsViewModel @Inject constructor(
    private val parentApi: ParentApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(MyKidsUiState())
    val uiState: StateFlow<MyKidsUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
    }

    fun loadDashboard(refresh: Boolean = false) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoading = !refresh && _uiState.value.children.isEmpty(),
                isRefreshing = refresh,
            )
            try {
                val response = parentApi.getDashboard()
                if (response.isSuccessful) {
                    val data = response.body()?.obj("data")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        isRefreshing = false,
                        children = data?.arr("children")?.mapNotNull { it.parseChildReport() } ?: emptyList(),
                        pendingChildren = data?.arr("pending_children")
                            ?.mapNotNull { it.parsePending(useGuardianName = false) } ?: emptyList(),
                        guardianRequests = data?.arr("pending_guardian_requests")
                            ?.mapNotNull { it.parsePending(useGuardianName = true) } ?: emptyList(),
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isLoading = false, isRefreshing = false)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load parent dashboard")
                _uiState.value = _uiState.value.copy(isLoading = false, isRefreshing = false)
            }
        }
    }

    fun linkChild(email: String, label: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLinking = true, linkError = null, linkNotice = null)
            try {
                val body = JsonObject().apply {
                    addProperty("child_email", email.trim())
                    if (label.isNotBlank()) addProperty("relationship_label", label.trim())
                }
                val response = parentApi.requestLink(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isLinking = false,
                        linkNotice = "Invitation sent. Your child confirms it from their own account.",
                    )
                    loadDashboard(refresh = true)
                } else {
                    val msg = when (response.code()) {
                        422 -> "No Chess99 child account was found for that email."
                        else -> "Could not send the invitation."
                    }
                    _uiState.value = _uiState.value.copy(isLinking = false, linkError = msg)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to link child")
                _uiState.value = _uiState.value.copy(isLinking = false, linkError = e.message ?: "Network error.")
            }
        }
    }

    fun acceptGuardian(relationshipId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(busyRelationshipId = relationshipId)
            try {
                val response = parentApi.acceptLink(relationshipId)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Guardian link accepted.")
                    loadDashboard(refresh = true)
                } else {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Could not accept the link.")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to accept guardian link")
                _uiState.value = _uiState.value.copy(snackbarMessage = "Error: ${e.message}")
            } finally {
                _uiState.value = _uiState.value.copy(busyRelationshipId = null)
            }
        }
    }

    fun revokeLink(relationshipId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(busyRelationshipId = relationshipId)
            try {
                val response = parentApi.revokeLink(relationshipId)
                if (response.isSuccessful) {
                    loadDashboard(refresh = true)
                } else {
                    _uiState.value = _uiState.value.copy(snackbarMessage = "Could not remove the link.")
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to revoke link")
                _uiState.value = _uiState.value.copy(snackbarMessage = "Error: ${e.message}")
            } finally {
                _uiState.value = _uiState.value.copy(busyRelationshipId = null)
            }
        }
    }

    fun emailReport(relationshipId: Int) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(emailingRelationshipId = relationshipId)
            try {
                val response = parentApi.sendWeeklyReport(relationshipId)
                _uiState.value = _uiState.value.copy(
                    snackbarMessage = if (response.isSuccessful) {
                        "Weekly report card emailed."
                    } else {
                        "Could not send the report email."
                    },
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to email report")
                _uiState.value = _uiState.value.copy(snackbarMessage = "Error: ${e.message}")
            } finally {
                _uiState.value = _uiState.value.copy(emailingRelationshipId = null)
            }
        }
    }

    fun updateChildProfile(relationshipId: Int, name: String?, password: String?) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isManaging = true, manageError = null, manageSuccess = false)
            try {
                val body = JsonObject().apply {
                    if (!name.isNullOrBlank()) addProperty("name", name.trim())
                    if (!password.isNullOrBlank()) {
                        addProperty("password", password)
                        addProperty("password_confirmation", password)
                    }
                }
                val response = parentApi.updateChildProfile(relationshipId, body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isManaging = false,
                        manageSuccess = true,
                        snackbarMessage = "Account updated.",
                    )
                    loadDashboard(refresh = true)
                } else {
                    val msg = if (response.code() == 422) {
                        "Please check the details and try again."
                    } else {
                        "Could not update the account."
                    }
                    _uiState.value = _uiState.value.copy(isManaging = false, manageError = msg)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to update child profile")
                _uiState.value = _uiState.value.copy(isManaging = false, manageError = e.message ?: "Network error.")
            }
        }
    }

    fun clearManageState() {
        _uiState.value = _uiState.value.copy(manageError = null, manageSuccess = false, isManaging = false)
    }

    fun clearLinkNotice() {
        _uiState.value = _uiState.value.copy(linkNotice = null, linkError = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }
}

// ── JSON parsing helpers (Gson, null-safe) ──────────────────────────────────

private fun JsonObject.int(key: String, default: Int = 0): Int =
    get(key)?.takeIf { !it.isJsonNull }?.asInt ?: default

private fun JsonObject.str(key: String): String? =
    get(key)?.takeIf { !it.isJsonNull }?.asString

private fun JsonObject.obj(key: String): JsonObject? =
    get(key)?.takeIf { it.isJsonObject }?.asJsonObject

private fun JsonObject.arr(key: String): JsonArray? =
    get(key)?.takeIf { it.isJsonArray }?.asJsonArray

private fun com.google.gson.JsonElement.parseChildReport(): ChildReport? {
    val report = takeIf { it.isJsonObject }?.asJsonObject ?: return null
    val child = report.obj("child") ?: return null
    val week = report.obj("week")
    val totals = report.obj("totals")
    val relationshipId = report.obj("relationship")?.int("id") ?: return null

    val games = report.arr("recent_games")?.mapNotNull { el ->
        val g = el.takeIf { it.isJsonObject }?.asJsonObject ?: return@mapNotNull null
        RecentGame(
            gameId = g.get("game_id")?.takeIf { !it.isJsonNull }?.asInt,
            opponentName = g.str("opponent_name") ?: "Opponent",
            opponentRating = g.get("opponent_rating")?.takeIf { !it.isJsonNull }?.asInt,
            result = g.str("result") ?: "unknown",
        )
    } ?: emptyList()

    return ChildReport(
        relationshipId = relationshipId,
        childId = child.int("id"),
        name = child.str("name") ?: "Player",
        email = child.str("email") ?: "",
        avatarUrl = child.str("avatar_url"),
        rating = child.int("rating", 400),
        subscriptionTier = child.str("subscription_tier") ?: "free",
        weekGames = week?.int("games_played") ?: 0,
        weekWins = week?.int("wins") ?: 0,
        weekLosses = week?.int("losses") ?: 0,
        weekDraws = week?.int("draws") ?: 0,
        weekPuzzlesSolved = week?.int("puzzles_solved") ?: 0,
        weekLessons = week?.int("lessons_completed") ?: 0,
        weekRatingChange = week?.int("rating_change") ?: 0,
        weekTimeSeconds = week?.int("time_played_seconds") ?: 0,
        lifetimeLessons = totals?.int("lessons_completed") ?: 0,
        lifetimePuzzles = totals?.int("puzzles_solved") ?: 0,
        tacticalRating = totals?.int("tactical_rating", 1000) ?: 1000,
        recentGames = games,
    )
}

private fun com.google.gson.JsonElement.parsePending(useGuardianName: Boolean): PendingLink? {
    val rel = takeIf { it.isJsonObject }?.asJsonObject ?: return null
    val person = if (useGuardianName) rel.obj("guardian") else rel.obj("child")
    return PendingLink(
        id = rel.int("id"),
        displayName = person?.str("name")
            ?: rel.str("invite_email")
            ?: if (useGuardianName) "A guardian" else "Child",
        inviteEmail = rel.str("invite_email"),
    )
}

// ── UI State & Data Models ──────────────────────────────────────────────────

data class MyKidsUiState(
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val children: List<ChildReport> = emptyList(),
    val pendingChildren: List<PendingLink> = emptyList(),
    val guardianRequests: List<PendingLink> = emptyList(),
    val isLinking: Boolean = false,
    val linkError: String? = null,
    val linkNotice: String? = null,
    val busyRelationshipId: Int? = null,
    val emailingRelationshipId: Int? = null,
    val isManaging: Boolean = false,
    val manageError: String? = null,
    val manageSuccess: Boolean = false,
    val snackbarMessage: String? = null,
)

data class ChildReport(
    val relationshipId: Int,
    val childId: Int,
    val name: String,
    val email: String,
    val avatarUrl: String?,
    val rating: Int,
    val subscriptionTier: String,
    val weekGames: Int,
    val weekWins: Int,
    val weekLosses: Int,
    val weekDraws: Int,
    val weekPuzzlesSolved: Int,
    val weekLessons: Int,
    val weekRatingChange: Int,
    val weekTimeSeconds: Int,
    val lifetimeLessons: Int,
    val lifetimePuzzles: Int,
    val tacticalRating: Int,
    val recentGames: List<RecentGame>,
) {
    val weekResults: String get() = "$weekWins/$weekLosses/$weekDraws"
    val ratingChangeLabel: String get() = if (weekRatingChange >= 0) "+$weekRatingChange" else "$weekRatingChange"
    val learningTimeLabel: String
        get() {
            val mins = weekTimeSeconds / 60
            return if (mins < 60) "${mins}m" else "${mins / 60}h ${mins % 60}m"
        }
}

data class RecentGame(
    val gameId: Int?,
    val opponentName: String,
    val opponentRating: Int?,
    val result: String,
)

data class PendingLink(
    val id: Int,
    val displayName: String,
    val inviteEmail: String?,
)
