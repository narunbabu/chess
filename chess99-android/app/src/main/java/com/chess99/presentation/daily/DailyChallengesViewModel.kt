package com.chess99.presentation.daily

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.R
import com.chess99.data.api.TutorialApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber

data class DailyChallengeInfo(
    val title: String,
    val description: String,
    val difficulty: String,
    val isCompleted: Boolean,
    val xpReward: Int,
    // Server row of today's challenge for the selected track — the submit
    // call needs both so a solved puzzle is persisted against the right row.
    val challengeId: Int? = null,
    val trackSlug: String? = null,
)

/** One selectable daily-challenge track (mirrors web daily-starter/improvement/endgame/master). */
data class DailyTrack(
    val slug: String,
    val label: String,
    val requiredTier: String,
    val challengeType: String,
    val xpReward: Int,
    val isLocked: Boolean,
)

data class DailyLeader(
    val rank: Int,
    val name: String,
    // Formatted solve time, e.g. "42s" or "1m 05s" — the daily leaderboard
    // ranks fastest time first, not by rating.
    val score: String,
)

data class DailyChallengesUiState(
    val isLoading: Boolean = false,
    val challenge: DailyChallengeInfo? = null,
    val streak: Int = 0,
    val leaders: List<DailyLeader> = emptyList(),
    val tracks: List<DailyTrack> = emptyList(),
    val selectedTrack: String? = null,
    val isLocked: Boolean = false,
    val requiredTier: String? = null,
    val error: String? = null,
)

@HiltViewModel
class DailyChallengesViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
    // Injected so the track-label fallback below can come from strings.xml.
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(DailyChallengesUiState())
    val uiState: StateFlow<DailyChallengesUiState> = _uiState.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            launch { loadChallenge(_uiState.value.selectedTrack) }
            launch { loadLeaderboard(_uiState.value.selectedTrack) }
        }
    }

    /** Switch to a different daily track and reload just the challenge. */
    fun selectTrack(slug: String) {
        if (slug == _uiState.value.selectedTrack) return
        _uiState.value = _uiState.value.copy(selectedTrack = slug, isLoading = true)
        viewModelScope.launch {
            launch { loadChallenge(slug) }
            launch { loadLeaderboard(slug) }
        }
    }

    private suspend fun loadChallenge(track: String?) {
        try {
            val response = tutorialApi.getDailyChallenge(track)
            if (!response.isSuccessful) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return
            }
            // Backend wraps the payload as { success, data: { ... } }; fall back to root.
            val data = response.body()?.getAsJsonObject("data") ?: response.body()
            if (data == null) {
                _uiState.value = _uiState.value.copy(isLoading = false)
                return
            }

            val tracks = data.getAsJsonArray("available_tracks")?.mapNotNull { el ->
                val o = el.asJsonObject
                DailyTrack(
                    slug = o.get("slug")?.asString ?: return@mapNotNull null,
                    label = o.get("label")?.asString ?: context.getString(R.string.daily_track_fallback),
                    requiredTier = o.get("required_tier")?.asString ?: "free",
                    challengeType = o.get("challenge_type")?.asString ?: "puzzle",
                    xpReward = o.get("xp_reward")?.asInt ?: 0,
                    isLocked = o.get("is_locked")?.asBoolean ?: false,
                )
            } ?: emptyList()

            val currentTrack = data.getAsJsonObject("track")
            val selected = track
                ?: currentTrack?.get("slug")?.asString
                ?: tracks.firstOrNull()?.slug
            val access = data.getAsJsonObject("access")
            val locked = access?.get("is_locked")?.asBoolean ?: false
            val requiredTier = access?.get("required_tier")?.asString
                ?: currentTrack?.get("required_tier")?.asString
            val completion = data.getAsJsonObject("user_completion")
            val typeDisplay = data.get("challenge_type_display")?.asString
                ?: currentTrack?.get("challenge_type")?.asString
                ?: "puzzle"

            _uiState.value = _uiState.value.copy(
                isLoading = false,
                tracks = tracks,
                selectedTrack = selected,
                isLocked = locked,
                requiredTier = requiredTier,
                streak = data.get("streak")?.asInt ?: _uiState.value.streak,
                challenge = if (locked) {
                    null
                } else {
                    DailyChallengeInfo(
                        title = currentTrack?.get("label")?.asString
                            ?: data.get("track_label")?.asString
                            ?: context.getString(R.string.learn_daily_challenge_default),
                        description = context.getString(R.string.daily_challenge_description, typeDisplay.lowercase()),
                        difficulty = data.get("skill_tier")?.asString ?: "medium",
                        isCompleted = completion?.get("completed")?.asBoolean ?: false,
                        xpReward = data.get("xp_reward")?.asInt
                            ?: currentTrack?.get("xp_reward")?.asInt
                            ?: 50,
                        challengeId = data.str("id")?.toIntOrNull(),
                        trackSlug = data.str("track_slug") ?: selected,
                    )
                },
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily challenge")
            _uiState.value = _uiState.value.copy(isLoading = false, error = friendlyError(context, e, R.string.error_subject_today_s_challenge))
        }
    }

    /**
     * The daily leaderboard (tutorial/daily-challenge/leaderboard): today's
     * fastest correct solves for the selected track. The general
     * leaderboard/rating endpoint this list used before ranks all-time Elo
     * and has nothing to do with the daily challenge.
     */
    private suspend fun loadLeaderboard(track: String?) {
        try {
            val response = tutorialApi.getDailyChallengeLeaderboard(track = track)
            if (!response.isSuccessful) return
            val arr = response.body()?.get("data").arrOrNull() ?: return
            val leaders = arr.mapIndexedNotNull { index, el ->
                val o = el.objOrNull() ?: return@mapIndexedNotNull null
                val seconds = o.get("time_spent_seconds")?.takeIf { it.isJsonPrimitive }?.runCatching { asInt }?.getOrNull()
                    ?: return@mapIndexedNotNull null
                DailyLeader(
                    rank = o.get("rank")?.takeIf { it.isJsonPrimitive }?.runCatching { asInt }?.getOrNull()
                        ?: (index + 1),
                    name = o.str("name") ?: context.getString(R.string.player_generic),
                    score = formatSolveTime(seconds),
                )
            }
            _uiState.value = _uiState.value.copy(leaders = leaders.take(10))
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily challenge leaderboard")
        }
    }

    private fun formatSolveTime(seconds: Int): String = when {
        seconds < 60 -> context.getString(R.string.daily_leader_time_seconds, seconds)
        else -> context.getString(
            R.string.daily_leader_time_min_sec,
            seconds / 60,
            seconds % 60,
        )
    }
}
