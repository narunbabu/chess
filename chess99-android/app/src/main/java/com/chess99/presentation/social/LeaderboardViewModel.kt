package com.chess99.presentation.social

import android.content.Context
import android.content.Intent
import androidx.annotation.ArrayRes
import androidx.annotation.StringRes
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.SocialApi
import com.chess99.data.local.TokenManager
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import java.util.Locale
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

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
                        error = context.getString(R.string.leaderboard_load_failed_code, response.code()),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Error loading leaderboard")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = friendlyError(context, e, R.string.error_subject_the_leaderboard),
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
        val templates = context.resources.getStringArray(shareTemplatesRes(category))
        if (templates.isEmpty()) return
        val text = templates.random()
            .replace("{name}", entry.name)
            .replace("{value}", formatValue(entry.value, category))

        val shareText = context.getString(R.string.leaderboard_share_suffix, text)

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, shareText)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(intent, context.getString(R.string.share_via)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }

    fun shareInvite() {
        val text = context.getString(R.string.leaderboard_invite_text)

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, text)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        val chooser = Intent.createChooser(
            intent,
            context.getString(R.string.leaderboard_invite_chooser),
        ).apply {
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
                name = e.get("name")?.asString ?: context.getString(R.string.unknown_player),
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
        /** Share copy lives in `res/values/strings.xml` as one array per category. */
        @ArrayRes
        private fun shareTemplatesRes(category: LeaderboardCategory): Int = when (category) {
            LeaderboardCategory.MOST_GAMES -> R.array.leaderboard_share_most_games
            LeaderboardCategory.MOST_WINS -> R.array.leaderboard_share_most_wins
            LeaderboardCategory.HIGHEST_POINTS -> R.array.leaderboard_share_highest_points
            LeaderboardCategory.BY_RATING -> R.array.leaderboard_share_by_rating
        }

        fun formatValue(value: Double, category: LeaderboardCategory): String {
            return if (value == value.toLong().toDouble()) {
                value.toLong().toString()
            } else {
                String.format(Locale.getDefault(), "%.1f", value)
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

enum class LeaderboardCategory(
    @StringRes val displayNameRes: Int,
    @StringRes val valueLabelRes: Int,
) {
    MOST_GAMES(R.string.leaderboard_category_most_games, R.string.leaderboard_value_games),
    MOST_WINS(R.string.leaderboard_category_most_wins, R.string.leaderboard_value_wins),
    HIGHEST_POINTS(R.string.leaderboard_category_highest_points, R.string.leaderboard_value_points),
    BY_RATING(R.string.leaderboard_category_by_rating, R.string.leaderboard_value_rating),
}

enum class LeaderboardPeriod(@StringRes val displayNameRes: Int, val apiValue: String) {
    TODAY(R.string.leaderboard_period_today, "today"),
    SEVEN_DAYS(R.string.leaderboard_period_7_days, "7d"),
    THIRTY_DAYS(R.string.leaderboard_period_30_days, "30d"),
    ALL_TIME(R.string.leaderboard_period_all_time, "all"),
}

data class LeaderboardEntry(
    val rank: Int,
    val userId: Int,
    val name: String,
    val avatarUrl: String? = null,
    val rating: Int,
    val value: Double = 0.0,
)
