package com.chess99.presentation.social

import android.content.Context
import android.content.Intent
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.SocialApi
import com.chess99.data.local.TokenManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the Leaderboard screen.
 * Uses the new public leaderboard endpoint that returns 4 categories
 * (most_games, most_wins, highest_points, by_rating) in a single response.
 *
 * Mirrors chess-frontend/src/pages/LeaderboardPage.js behavior.
 */
@HiltViewModel
class LeaderboardViewModel @Inject constructor(
    private val socialApi: SocialApi,
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LeaderboardUiState())
    val uiState: StateFlow<LeaderboardUiState> = _uiState.asStateFlow()

    init {
        loadLeaderboard()
    }

    // ── Category Selection ───────────────────────────────────────────────

    fun selectCategory(category: LeaderboardCategory) {
        _uiState.value = _uiState.value.copy(selectedCategory = category)
        // Data is already loaded for all categories — just switch the view.
        // If "by_rating" is selected, period doesn't matter (always current).
    }

    // ── Time Period ──────────────────────────────────────────────────────

    fun selectPeriod(period: LeaderboardPeriod) {
        if (_uiState.value.selectedPeriod == period) return
        _uiState.value = _uiState.value.copy(selectedPeriod = period)
        loadLeaderboard()
    }

    // ── Load Data ────────────────────────────────────────────────────────

    fun loadLeaderboard() {
        val state = _uiState.value
        viewModelScope.launch {
            _uiState.value = state.copy(isLoading = true, error = null)

            val period = state.selectedPeriod.apiValue

            try {
                val response = socialApi.getPublicLeaderboard(period = period)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch

                    val mostGames = parseEntries(body.getAsJsonArray("most_games"))
                    val mostWins = parseEntries(body.getAsJsonArray("most_wins"))
                    val highestPoints = parseEntries(body.getAsJsonArray("highest_points"))
                    val byRating = parseEntries(body.getAsJsonArray("by_rating"))

                    _uiState.value = _uiState.value.copy(
                        mostGames = mostGames,
                        mostWins = mostWins,
                        highestPoints = highestPoints,
                        byRating = byRating,
                        isLoading = false,
                    )
                } else {
                    val errorBody = response.errorBody()?.string()
                    Timber.e("Failed to load leaderboard: ${response.code()} $errorBody")
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to load leaderboard (${response.code()})",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading leaderboard")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    // ── Pull to Refresh ──────────────────────────────────────────────────

    fun refresh() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        viewModelScope.launch {
            val period = _uiState.value.selectedPeriod.apiValue
            try {
                val response = socialApi.getPublicLeaderboard(period = period)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    _uiState.value = _uiState.value.copy(
                        mostGames = parseEntries(body.getAsJsonArray("most_games")),
                        mostWins = parseEntries(body.getAsJsonArray("most_wins")),
                        highestPoints = parseEntries(body.getAsJsonArray("highest_points")),
                        byRating = parseEntries(body.getAsJsonArray("by_rating")),
                        isRefreshing = false,
                    )
                } else {
                    _uiState.value = _uiState.value.copy(isRefreshing = false)
                }
            } catch (e: Exception) {
                Timber.e(e, "Error refreshing leaderboard")
                _uiState.value = _uiState.value.copy(isRefreshing = false)
            }
        }
    }

    // ── Share ─────────────────────────────────────────────────────────────

    fun sharePlayer(entry: LeaderboardEntry, category: LeaderboardCategory) {
        val templates = SHARE_TEMPLATES[category] ?: return
        val template = templates.random()
        val text = template
            .replace("{name}", entry.name)
            .replace("{value}", formatValue(entry.value, category))

        val shareText = "$text\n\nhttps://chess99.com/leaderboard"

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(intent, "Share via").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    fun shareInvite() {
        val text = "Join me on Chess99 — play chess online with players worldwide! " +
            "Climb the leaderboard and prove your skills.\n\nhttps://chess99.com/leaderboard"

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(intent, "Invite friends").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    // ── Helpers ───────────────────────────────────────────────────────────

    private fun parseEntries(
        array: com.google.gson.JsonArray?,
    ): List<LeaderboardEntry> {
        return array?.mapIndexed { index, el ->
            val e = el.asJsonObject
            LeaderboardEntry(
                rank = e.get("rank")?.asInt ?: (index + 1),
                userId = e.get("user_id")?.asInt ?: e.get("id")?.asInt ?: 0,
                name = e.get("name")?.asString ?: "Unknown",
                avatarUrl = e.get("avatar_url")?.asString,
                rating = e.get("rating")?.asInt ?: 1200,
                value = e.get("value")?.asDouble ?: 0.0,
            )
        } ?: emptyList()
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    companion object {
        private val SHARE_TEMPLATES = mapOf(
            LeaderboardCategory.MOST_GAMES to listOf(
                "{value} games strong! Can you match {name}'s dedication on Chess99?",
                "{name} has played {value} games on Chess99! That's commitment. Join the battle!",
                "Legend alert: {name} with {value} games on Chess99. Think you can keep up?",
            ),
            LeaderboardCategory.MOST_WINS to listOf(
                "Checkmate! {name} has {value} victories on Chess99. Challenge them!",
                "{value} wins! {name} is dominating Chess99. Dare to take them on?",
                "Victory machine: {name} with {value} wins on Chess99. Can you stop them?",
            ),
            LeaderboardCategory.HIGHEST_POINTS to listOf(
                "{name} scored {value} points on Chess99! Can you beat that?",
                "{value} points! {name} is a scoring machine on Chess99.",
                "Point monster: {name} racked up {value} points. Join Chess99 and compete!",
            ),
            LeaderboardCategory.BY_RATING to listOf(
                "Rated {value}! {name} is a force on Chess99. Dare to challenge?",
                "{name} hit a {value} rating on Chess99! Think you can climb higher?",
                "Rating royalty: {name} at {value} on Chess99. The board awaits your challenge!",
            ),
        )

        fun formatValue(value: Double, category: LeaderboardCategory): String {
            return if (value == value.toLong().toDouble()) {
                value.toLong().toString()
            } else {
                String.format("%.1f", value)
            }
        }
    }
}

// ── UI State ─────────────────────────────────────────────────────────────

data class LeaderboardUiState(
    val mostGames: List<LeaderboardEntry> = emptyList(),
    val mostWins: List<LeaderboardEntry> = emptyList(),
    val highestPoints: List<LeaderboardEntry> = emptyList(),
    val byRating: List<LeaderboardEntry> = emptyList(),
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,
    val selectedCategory: LeaderboardCategory = LeaderboardCategory.MOST_GAMES,
    val selectedPeriod: LeaderboardPeriod = LeaderboardPeriod.SEVEN_DAYS,
) {
    /** Returns the entries for the currently selected category. */
    val currentEntries: List<LeaderboardEntry>
        get() = when (selectedCategory) {
            LeaderboardCategory.MOST_GAMES -> mostGames
            LeaderboardCategory.MOST_WINS -> mostWins
            LeaderboardCategory.HIGHEST_POINTS -> highestPoints
            LeaderboardCategory.BY_RATING -> byRating
        }
}

enum class LeaderboardCategory(val displayName: String, val valueLabel: String) {
    MOST_GAMES("Most Games", "Games"),
    MOST_WINS("Most Wins", "Wins"),
    HIGHEST_POINTS("Highest Points", "Points"),
    BY_RATING("By Rating", "Rating"),
}

enum class LeaderboardPeriod(val displayName: String, val apiValue: String) {
    TODAY("Today", "today"),
    SEVEN_DAYS("7 Days", "7d"),
    THIRTY_DAYS("30 Days", "30d"),
    ALL_TIME("All Time", "all"),
}

data class LeaderboardEntry(
    val rank: Int,
    val userId: Int,
    val name: String,
    val avatarUrl: String? = null,
    val rating: Int,
    val value: Double = 0.0,
)
