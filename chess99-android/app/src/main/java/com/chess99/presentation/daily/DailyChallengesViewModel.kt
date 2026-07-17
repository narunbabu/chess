package com.chess99.presentation.daily

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TacticalApi
import com.chess99.data.api.TutorialApi
import com.chess99.presentation.common.friendlyError
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

data class DailyChallengeInfo(
    val title: String,
    val description: String,
    val difficulty: String,
    val isCompleted: Boolean,
    val xpReward: Int,
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
    private val tacticalApi: TacticalApi,
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
            launch { loadLeaderboard() }
        }
    }

    /** Switch to a different daily track and reload just the challenge. */
    fun selectTrack(slug: String) {
        if (slug == _uiState.value.selectedTrack) return
        _uiState.value = _uiState.value.copy(selectedTrack = slug, isLoading = true)
        viewModelScope.launch { loadChallenge(slug) }
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
                    label = o.get("label")?.asString ?: "Track",
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
                            ?: "Daily Challenge",
                        description = "Solve today's ${typeDisplay.lowercase()} to keep your streak alive.",
                        difficulty = data.get("skill_tier")?.asString ?: "medium",
                        isCompleted = completion?.get("completed")?.asBoolean ?: false,
                        xpReward = data.get("xp_reward")?.asInt
                            ?: currentTrack?.get("xp_reward")?.asInt
                            ?: 50,
                    )
                },
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily challenge")
            _uiState.value = _uiState.value.copy(isLoading = false, error = friendlyError(e, "today's challenge"))
        }
    }

    private suspend fun loadLeaderboard() {
        try {
            val response = tacticalApi.getLeaderboard(scope = "rating", period = "all", page = 1)
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val arr = body.getAsJsonArray("data") ?: body.getAsJsonArray("leaders")
                val leaders = buildList {
                    arr?.forEachIndexed { index, el ->
                        val o = el.asJsonObject
                        add(
                            DailyLeader(
                                rank = o.get("rank")?.asInt ?: (index + 1),
                                name = o.get("name")?.asString ?: o.get("username")?.asString ?: "Player",
                                score = (o.get("rating")?.asInt ?: o.get("score")?.asInt ?: 0).toString(),
                            ),
                        )
                    }
                }
                _uiState.value = _uiState.value.copy(leaders = leaders.take(10))
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load tactical leaderboard")
        }
    }
}
