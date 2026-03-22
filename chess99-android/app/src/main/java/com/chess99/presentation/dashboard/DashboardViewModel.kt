package com.chess99.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.AuthApi
import com.chess99.data.api.ChampionshipApi
import com.chess99.data.api.GameApi
import com.chess99.data.api.ProfileApi
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the Dashboard screen.
 * Aggregates user profile, stats, recent games, active tournaments,
 * and notifications into a single overview.
 *
 * Data sources:
 *   - AuthApi.getCurrentUser()        -> user info
 *   - ProfileApi.getPerformanceStats() -> rating, win/loss, streaks
 *   - GameApi.getUserGames()           -> recent games
 *   - ChampionshipApi.getChampionships() -> active tournaments
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authApi: AuthApi,
    private val profileApi: ProfileApi,
    private val gameApi: GameApi,
    private val championshipApi: ChampionshipApi,
) : ViewModel() {

    // Unfinished games state
    private val _unfinishedGames = MutableStateFlow<List<UnfinishedGame>>(emptyList())
    val unfinishedGames: StateFlow<List<UnfinishedGame>> = _unfinishedGames.asStateFlow()

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        loadDashboard()
    }

    // ── Load All Dashboard Data ──────────────────────────────────────────

    private fun loadDashboard() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                // Load all sections in parallel
                launch { loadUserInfo() }
                launch { loadStats() }
                launch { loadRecentGames() }
                launch { loadActiveTournaments() }
                launch { loadUnfinishedGames() }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load dashboard data")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Failed to load dashboard: ${e.message}",
                )
            }
        }
    }

    private suspend fun loadUserInfo() {
        try {
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val user = response.body()
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    userName = user?.name ?: "",
                    userEmail = user?.email ?: "",
                    userAvatarUrl = user?.avatarUrl,
                    userRating = user?.rating ?: 1200,
                    userPeakRating = user?.peakRating ?: user?.rating ?: 1200,
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load user info")
        }
    }

    private suspend fun loadStats() {
        try {
            val response = profileApi.getPerformanceStats()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val statsObj = if (body.has("stats")) body.getAsJsonObject("stats") else body

                _uiState.value = _uiState.value.copy(
                    stats = DashboardStats(
                        rating = statsObj.get("rating")?.asInt
                            ?: _uiState.value.userRating,
                        peakRating = statsObj.get("peak_rating")?.asInt
                            ?: _uiState.value.userPeakRating,
                        gamesPlayed = statsObj.get("total_games")?.asInt ?: 0,
                        wins = statsObj.get("wins")?.asInt ?: 0,
                        losses = statsObj.get("losses")?.asInt ?: 0,
                        draws = statsObj.get("draws")?.asInt ?: 0,
                        winRate = statsObj.get("win_rate")?.asFloat ?: 0f,
                        currentStreak = statsObj.get("current_streak")?.asInt ?: 0,
                        bestStreak = statsObj.get("best_streak")?.asInt ?: 0,
                    ),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load stats")
        }
    }

    private suspend fun loadRecentGames() {
        try {
            val response = gameApi.getUserGames(page = 1, perPage = 5)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val gamesArray = body.getAsJsonArray("data")
                    ?: body.getAsJsonArray("games")
                    ?: return

                val games = gamesArray.map { el ->
                    val g = el.asJsonObject
                    RecentGame(
                        id = g.get("id")?.asInt ?: 0,
                        opponent = g.get("opponent_name")?.asString
                            ?: g.get("opponent")?.asString
                            ?: "Unknown",
                        result = g.get("result")?.asString
                            ?: g.get("status")?.asString
                            ?: "unknown",
                        ratingChange = g.get("rating_change")?.asInt ?: 0,
                        timeControl = g.get("time_control")?.asString ?: "10|0",
                        date = g.get("completed_at")?.asString
                            ?: g.get("created_at")?.asString
                            ?: "",
                    )
                }
                _uiState.value = _uiState.value.copy(recentGames = games)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load recent games")
        }
    }

    private suspend fun loadActiveTournaments() {
        try {
            val response = championshipApi.getChampionships(
                status = "active",
                page = 1,
                perPage = 5,
            )
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val tournamentsArray = body.getAsJsonArray("data")
                    ?: body.getAsJsonArray("championships")
                    ?: return

                val tournaments = tournamentsArray.map { el ->
                    val t = el.asJsonObject
                    ActiveTournament(
                        id = t.get("id")?.asInt ?: 0,
                        name = t.get("name")?.asString ?: "",
                        format = t.get("format")?.asString ?: "swiss",
                        currentRound = t.get("current_round")?.asInt ?: 0,
                        totalRounds = t.get("total_rounds")?.asInt
                            ?: t.get("rounds")?.asInt ?: 0,
                        playerCount = t.get("player_count")?.asInt
                            ?: t.get("participants_count")?.asInt ?: 0,
                        status = t.get("status")?.asString ?: "active",
                    )
                }
                _uiState.value = _uiState.value.copy(activeTournaments = tournaments)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load active tournaments")
        }
    }

    private suspend fun loadUnfinishedGames() {
        try {
            val response = gameApi.getUnfinishedGames()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val gamesArray = body.getAsJsonArray("games")
                    ?: body.getAsJsonArray("data")
                    ?: return
                val games = gamesArray.map { el ->
                    val g = el.asJsonObject
                    UnfinishedGame(
                        gameId = g.get("id")?.asInt ?: 0,
                        opponentName = g.get("opponent_name")?.asString ?: "Unknown",
                        timeControl = g.get("time_control")?.asString ?: "10|0",
                    )
                }
                _unfinishedGames.value = games
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load unfinished games")
        }
    }

    fun dismissUnfinishedGame(gameId: Int) {
        viewModelScope.launch {
            try {
                gameApi.deleteUnfinished(gameId)
                _unfinishedGames.value = _unfinishedGames.value.filter { it.gameId != gameId }
            } catch (e: Exception) {
                Timber.e(e, "Failed to discard unfinished game")
            }
        }
    }

    // ── Notification Actions ─────────────────────────────────────────────

    fun markNotificationRead(id: String) {
        _uiState.value = _uiState.value.copy(
            notifications = _uiState.value.notifications.map { notification ->
                if (notification.id == id) notification.copy(isRead = true)
                else notification
            },
        )
    }

    fun dismissNotification(id: String) {
        _uiState.value = _uiState.value.copy(
            notifications = _uiState.value.notifications.filter { it.id != id },
        )
    }

    // ── Refresh ──────────────────────────────────────────────────────────

    fun refreshDashboard() {
        _uiState.value = _uiState.value.copy(isRefreshing = true)
        viewModelScope.launch {
            try {
                loadUserInfo()
                loadStats()
                loadRecentGames()
                loadActiveTournaments()
                loadUnfinishedGames()
            } catch (e: Exception) {
                Timber.e(e, "Failed to refresh dashboard")
                _uiState.value = _uiState.value.copy(
                    error = "Refresh failed: ${e.message}",
                )
            } finally {
                _uiState.value = _uiState.value.copy(isRefreshing = false)
            }
        }
    }

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }
}

// ── UI State ─────────────────────────────────────────────────────────────────

data class DashboardUiState(
    // Loading
    val isLoading: Boolean = false,
    val isRefreshing: Boolean = false,
    val error: String? = null,

    // User info
    val userName: String = "",
    val userEmail: String = "",
    val userAvatarUrl: String? = null,
    val userRating: Int = 1200,
    val userPeakRating: Int = 1200,

    // Stats
    val stats: DashboardStats? = null,

    // Recent games
    val recentGames: List<RecentGame> = emptyList(),

    // Active tournaments
    val activeTournaments: List<ActiveTournament> = emptyList(),

    // Notifications
    val notifications: List<DashboardNotification> = emptyList(),
)

data class DashboardStats(
    val rating: Int = 1200,
    val peakRating: Int = 1200,
    val gamesPlayed: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val draws: Int = 0,
    val winRate: Float = 0f,
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
)

data class RecentGame(
    val id: Int,
    val opponent: String,
    val result: String,
    val ratingChange: Int,
    val timeControl: String,
    val date: String,
)

data class ActiveTournament(
    val id: Int,
    val name: String,
    val format: String,
    val currentRound: Int,
    val totalRounds: Int,
    val playerCount: Int,
    val status: String,
)

data class DashboardNotification(
    val id: String,
    val type: String,
    val title: String,
    val message: String,
    val timestamp: String,
    val isRead: Boolean = false,
    val actionData: Map<String, String> = emptyMap(),
)

data class UnfinishedGame(
    val gameId: Int,
    val opponentName: String,
    val timeControl: String,
)
