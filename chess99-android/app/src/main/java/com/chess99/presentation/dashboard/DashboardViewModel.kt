package com.chess99.presentation.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.AuthApi
import com.chess99.data.api.ChampionshipApi
import com.chess99.data.api.GameApi
import com.chess99.data.api.ProfileApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.bool
import com.chess99.data.api.dbl
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.joinAll
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
            val jobs = listOf(
                launch { loadUserInfo() },
                launch { loadStats() },
                launch { loadRecentGames() },
                launch { loadActiveTournaments() },
                launch { loadUnfinishedGames() },
                launch { loadActiveGames() },
                launch { loadDailyQuota() },
            )
            jobs.joinAll()
            _uiState.value = _uiState.value.copy(isLoading = false)
        }
    }

    private suspend fun loadUserInfo() {
        try {
            val response = authApi.getCurrentUser()
            if (response.isSuccessful) {
                val user = response.body()
                _uiState.value = _uiState.value.copy(
                    userId = user?.id,
                    userName = user?.name ?: "",
                    userEmail = user?.email ?: "",
                    userAvatarUrl = user?.avatarUrl,
                    userRating = user?.rating ?: 1200,
                    userPeakRating = user?.peakRating ?: user?.rating ?: 1200,
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    error = "Couldn't load your dashboard. Please try again.",
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load user info")
            // User info is essential — without it the screen is useless, so
            // surface a top-level error card with Retry.
            _uiState.value = _uiState.value.copy(
                error = friendlyError(e, "your dashboard"),
            )
        }
    }

    private suspend fun loadStats() {
        try {
            val response = profileApi.getPerformanceStats()
            if (response.isSuccessful) {
                val body = response.body()
                val statsObj = if (body != null && body.has("stats")) body.get("stats").objOrNull() else body

                _uiState.value = _uiState.value.copy(
                    stats = DashboardStats(
                        rating = statsObj.int("rating") ?: _uiState.value.userRating,
                        peakRating = statsObj.int("peak_rating") ?: _uiState.value.userPeakRating,
                        gamesPlayed = statsObj.int("total_games") ?: 0,
                        wins = statsObj.int("wins") ?: 0,
                        losses = statsObj.int("losses") ?: 0,
                        draws = statsObj.int("draws") ?: 0,
                        winRate = statsObj.dbl("win_rate")?.toFloat() ?: 0f,
                        currentStreak = statsObj.int("current_streak") ?: 0,
                        bestStreak = statsObj.int("best_streak") ?: 0,
                    ),
                    statsError = null,
                )
            } else {
                _uiState.value = _uiState.value.copy(
                    statsError = "Couldn't load your stats.",
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load stats")
            _uiState.value = _uiState.value.copy(
                statsError = friendlyError(e, "your stats"),
            )
        }
    }

    private suspend fun loadRecentGames() {
        try {
            val response = gameApi.getUserGames(page = 1, perPage = 5)
            if (response.isSuccessful) {
                val body = response.body()
                val gamesArray = body?.get("data")?.arrOrNull()
                    ?: body?.get("games")?.arrOrNull()

                val games = gamesArray?.mapNotNull { el ->
                    val g = el.objOrNull() ?: return@mapNotNull null
                    RecentGame(
                        id = g.int("id") ?: 0,
                        opponent = g.str("opponent_name")
                            ?: g.str("opponent")
                            ?: "Unknown",
                        result = g.str("result")
                            ?: g.str("status")
                            ?: "unknown",
                        ratingChange = g.int("rating_change") ?: 0,
                        timeControl = g.str("time_control") ?: "10|0",
                        date = g.str("completed_at")
                            ?: g.str("created_at")
                            ?: "",
                    )
                } ?: emptyList()
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
                val body = response.body()
                val tournamentsArray = body?.get("data")?.arrOrNull()
                    ?: body?.get("championships")?.arrOrNull()

                val tournaments = tournamentsArray?.mapNotNull { el ->
                    val t = el.objOrNull() ?: return@mapNotNull null
                    ActiveTournament(
                        id = t.int("id") ?: 0,
                        name = t.str("name") ?: "",
                        format = t.str("format") ?: "swiss",
                        currentRound = t.int("current_round") ?: 0,
                        totalRounds = t.int("total_rounds")
                            ?: t.int("rounds") ?: 0,
                        playerCount = t.int("player_count")
                            ?: t.int("participants_count") ?: 0,
                        status = t.str("status") ?: "active",
                    )
                } ?: emptyList()
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
                val body = response.body()
                val gamesArray = body?.get("games")?.arrOrNull()
                    ?: body?.get("data")?.arrOrNull()
                val games = gamesArray?.mapNotNull { el ->
                    val g = el.objOrNull() ?: return@mapNotNull null
                    UnfinishedGame(
                        gameId = g.int("id") ?: 0,
                        opponentName = g.str("opponent_name") ?: "Unknown",
                        timeControl = g.str("time_control") ?: "10|0",
                    )
                } ?: emptyList()
                _unfinishedGames.value = games
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load unfinished games")
        }
    }

    private suspend fun loadActiveGames() {
        try {
            val response = gameApi.getActiveGames()
            if (response.isSuccessful) {
                val body = response.body()
                val currentUserId = _uiState.value.userId
                val gamesArray = body?.get("data")?.arrOrNull()
                    ?: body?.get("games")?.arrOrNull()
                val games = gamesArray?.mapNotNull { el ->
                    val g = el.objOrNull() ?: return@mapNotNull null
                    val whiteId = g.int("white_player_id")
                    val playerIsWhite = currentUserId != null && whiteId == currentUserId
                    val opponent = if (playerIsWhite) g.get("black_player").objOrNull()
                        else g.get("white_player").objOrNull()
                    ActiveGame(
                        id = g.int("id") ?: 0,
                        opponentName = opponent.str("name") ?: "Opponent",
                        playerColor = if (playerIsWhite) "White" else "Black",
                        status = g.str("status") ?: "active",
                        lastMoveAt = g.str("last_move_at"),
                    )
                }?.filter { it.id != 0 } ?: emptyList()
                _uiState.value = _uiState.value.copy(activeGames = games)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load active games")
        }
    }

    private suspend fun loadDailyQuota() {
        try {
            val response = gameApi.getDailyQuota()
            if (response.isSuccessful) {
                val body = response.body()
                if (body != null) {
                    val unlimited = body.bool("unlimited") ?: false
                    _uiState.value = _uiState.value.copy(
                        dailyQuota = DailyQuota(
                            tier = body.str("tier") ?: "free",
                            unlimited = unlimited,
                            dailyLimit = body.int("daily_limit") ?: 5,
                            gamesToday = body.int("games_today") ?: 0,
                            remaining = body.int("remaining")
                                ?: ((body.int("daily_limit") ?: 5) - (body.int("games_today") ?: 0)).coerceAtLeast(0),
                        ),
                    )
                }
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily quota")
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
                val jobs = listOf(
                    launch { loadUserInfo() },
                    launch { loadStats() },
                    launch { loadRecentGames() },
                    launch { loadActiveTournaments() },
                    launch { loadUnfinishedGames() },
                    launch { loadActiveGames() },
                    launch { loadDailyQuota() },
                )
                jobs.joinAll()
            } catch (e: Exception) {
                // Each child loader already catches its own failures; this
                // guards against anything unexpected escaping joinAll().
                Timber.e(e, "Failed to refresh dashboard")
                _uiState.value = _uiState.value.copy(
                    error = friendlyError(e, "your dashboard"),
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
    val userId: Int? = null,
    val userName: String = "",
    val userEmail: String = "",
    val userAvatarUrl: String? = null,
    val userRating: Int = 1200,
    val userPeakRating: Int = 1200,

    // Stats
    val stats: DashboardStats? = null,
    val statsError: String? = null,

    // Recent games
    val recentGames: List<RecentGame> = emptyList(),

    // Active tournaments
    val activeTournaments: List<ActiveTournament> = emptyList(),

    // Active (in-progress) games — resumable
    val activeGames: List<ActiveGame> = emptyList(),

    // Daily online-game quota (free/silver tier usage strip)
    val dailyQuota: DailyQuota? = null,

    // Notifications
    val notifications: List<DashboardNotification> = emptyList(),
)

data class ActiveGame(
    val id: Int,
    val opponentName: String,
    val playerColor: String,
    val status: String,
    val lastMoveAt: String?,
)

data class DailyQuota(
    val tier: String,
    val unlimited: Boolean,
    val dailyLimit: Int,
    val gamesToday: Int,
    val remaining: Int,
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
