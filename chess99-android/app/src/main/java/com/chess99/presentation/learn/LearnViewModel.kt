package com.chess99.presentation.learn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the Learn screen (Tutorial Hub + Training).
 * Mirrors chess-frontend/src/pages/LearnPage.js
 */
@HiltViewModel
class LearnViewModel @Inject constructor(
    private val tutorialApi: TutorialApi,
) : ViewModel() {

    private val _uiState = MutableStateFlow(LearnUiState())
    val uiState: StateFlow<LearnUiState> = _uiState.asStateFlow()

    init {
        loadAll()
    }

    // ── Load Data ──────────────────────────────────────────────────────

    private fun loadAll() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, error = null)
            try {
                launch { loadModules() }
                launch { loadStats() }
                launch { loadDailyChallenge() }
                launch { loadAchievements() }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load learn data")
            } finally {
                _uiState.value = _uiState.value.copy(isLoading = false)
            }
        }
    }

    private suspend fun loadModules() {
        try {
            val response = tutorialApi.getModules()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val modules = parseModules(body)
                val grouped = modules.groupBy { it.tier }
                _uiState.value = _uiState.value.copy(
                    modules = modules,
                    beginnerModules = grouped["beginner"] ?: emptyList(),
                    intermediateModules = grouped["intermediate"] ?: emptyList(),
                    advancedModules = grouped["advanced"] ?: emptyList(),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load tutorial modules")
        }
    }

    private suspend fun loadStats() {
        try {
            val response = tutorialApi.getStats()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                _uiState.value = _uiState.value.copy(
                    stats = TutorialStats(
                        completedLessons = body.get("completed_lessons")?.asInt ?: 0,
                        totalLessons = body.get("total_lessons")?.asInt ?: 0,
                        xp = body.get("xp")?.asInt ?: body.get("total_xp")?.asInt ?: 0,
                        level = body.get("level")?.asInt ?: 1,
                        streak = body.get("streak")?.asInt ?: body.get("current_streak")?.asInt ?: 0,
                    ),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load tutorial stats")
        }
    }

    private suspend fun loadDailyChallenge() {
        try {
            val response = tutorialApi.getDailyChallenge()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val challenge = body.getAsJsonObject("challenge") ?: body
                _uiState.value = _uiState.value.copy(
                    dailyChallenge = DailyChallenge(
                        id = challenge.get("id")?.asInt ?: 0,
                        title = challenge.get("title")?.asString ?: "Daily Challenge",
                        description = challenge.get("description")?.asString ?: "",
                        difficulty = challenge.get("difficulty")?.asString ?: "medium",
                        isCompleted = challenge.get("is_completed")?.asBoolean ?: false,
                        xpReward = challenge.get("xp_reward")?.asInt ?: 50,
                    ),
                )
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily challenge")
        }
    }

    private suspend fun loadAchievements() {
        try {
            val response = tutorialApi.getUserAchievements()
            if (response.isSuccessful) {
                val body = response.body() ?: return
                val achievementsArray = body.getAsJsonArray("achievements") ?: return
                val achievements = achievementsArray.mapNotNull { el ->
                    try {
                        val a = el.asJsonObject
                        Achievement(
                            id = a.get("id")?.asInt ?: return@mapNotNull null,
                            name = a.get("name")?.asString ?: "",
                            description = a.get("description")?.asString ?: "",
                            icon = a.get("icon")?.asString,
                            isUnlocked = a.get("is_unlocked")?.asBoolean
                                ?: a.get("unlocked_at") != null,
                        )
                    } catch (_: Exception) { null }
                }
                _uiState.value = _uiState.value.copy(achievements = achievements)
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to load achievements")
        }
    }

    // ── Module Detail ──────────────────────────────────────────────────

    fun loadModuleDetail(slug: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(
                isLoadingModule = true,
                selectedModuleSlug = slug,
            )
            try {
                val response = tutorialApi.getModule(slug)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val module = body.getAsJsonObject("module") ?: body
                    val lessonsArray = module.getAsJsonArray("lessons")
                        ?: body.getAsJsonArray("lessons")
                    val lessons = lessonsArray?.mapNotNull { el ->
                        try {
                            val l = el.asJsonObject
                            Lesson(
                                id = l.get("id")?.asInt ?: return@mapNotNull null,
                                title = l.get("title")?.asString ?: "",
                                description = l.get("description")?.asString ?: "",
                                order = l.get("order")?.asInt ?: l.get("sort_order")?.asInt ?: 0,
                                isCompleted = l.get("is_completed")?.asBoolean ?: false,
                                xpReward = l.get("xp_reward")?.asInt ?: 10,
                                type = l.get("type")?.asString ?: "standard",
                            )
                        } catch (_: Exception) { null }
                    }?.sortedBy { it.order } ?: emptyList()

                    _uiState.value = _uiState.value.copy(
                        isLoadingModule = false,
                        selectedModuleLessons = lessons,
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoadingModule = false,
                        error = "Failed to load module",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load module detail: $slug")
                _uiState.value = _uiState.value.copy(
                    isLoadingModule = false,
                    error = "Error: ${e.message}",
                )
            }
        }
    }

    fun clearModuleDetail() {
        _uiState.value = _uiState.value.copy(
            selectedModuleSlug = null,
            selectedModuleLessons = emptyList(),
        )
    }

    // ── Lesson Completion ──────────────────────────────────────────────

    fun completeLesson(lessonId: Int) {
        viewModelScope.launch {
            try {
                val response = tutorialApi.completeLesson(lessonId)
                if (response.isSuccessful) {
                    // Refresh stats and module detail
                    loadStats()
                    _uiState.value.selectedModuleSlug?.let { loadModuleDetail(it) }
                    _uiState.value = _uiState.value.copy(
                        snackbarMessage = "Lesson completed!",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to complete lesson $lessonId")
                _uiState.value = _uiState.value.copy(error = "Error: ${e.message}")
            }
        }
    }

    // ── Tab Selection ──────────────────────────────────────────────────

    fun selectTab(tab: LearnTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
    }

    // ── Refresh ────────────────────────────────────────────────────────

    fun refresh() {
        loadAll()
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    private fun parseModules(body: JsonObject): List<TutorialModule> {
        val modulesArray = body.getAsJsonArray("modules")
            ?: body.getAsJsonArray("data")
            ?: return emptyList()

        return modulesArray.mapNotNull { el ->
            try {
                val m = el.asJsonObject
                TutorialModule(
                    id = m.get("id")?.asInt ?: return@mapNotNull null,
                    slug = m.get("slug")?.asString ?: "",
                    title = m.get("title")?.asString ?: "",
                    description = m.get("description")?.asString ?: "",
                    tier = m.get("tier")?.asString
                        ?: m.get("difficulty")?.asString ?: "beginner",
                    icon = m.get("icon")?.asString,
                    lessonsCount = m.get("lessons_count")?.asInt
                        ?: m.get("total_lessons")?.asInt ?: 0,
                    completedLessons = m.get("completed_lessons")?.asInt
                        ?: m.get("completed_count")?.asInt ?: 0,
                    order = m.get("order")?.asInt ?: m.get("sort_order")?.asInt ?: 0,
                )
            } catch (e: Exception) {
                Timber.w(e, "Failed to parse module")
                null
            }
        }.sortedBy { it.order }
    }
}

// ── UI State ────────────────────────────────────────────────────────────

data class LearnUiState(
    val isLoading: Boolean = false,
    val selectedTab: LearnTab = LearnTab.TUTORIALS,
    val modules: List<TutorialModule> = emptyList(),
    val beginnerModules: List<TutorialModule> = emptyList(),
    val intermediateModules: List<TutorialModule> = emptyList(),
    val advancedModules: List<TutorialModule> = emptyList(),
    val stats: TutorialStats = TutorialStats(),
    val dailyChallenge: DailyChallenge? = null,
    val achievements: List<Achievement> = emptyList(),
    val selectedModuleSlug: String? = null,
    val selectedModuleLessons: List<Lesson> = emptyList(),
    val isLoadingModule: Boolean = false,
    val error: String? = null,
    val snackbarMessage: String? = null,
)

enum class LearnTab { TUTORIALS, TRAINING }

data class TutorialModule(
    val id: Int,
    val slug: String,
    val title: String,
    val description: String,
    val tier: String,
    val icon: String?,
    val lessonsCount: Int,
    val completedLessons: Int,
    val order: Int,
) {
    val progress: Float
        get() = if (lessonsCount > 0) completedLessons.toFloat() / lessonsCount else 0f

    val isComplete: Boolean
        get() = lessonsCount > 0 && completedLessons >= lessonsCount
}

data class TutorialStats(
    val completedLessons: Int = 0,
    val totalLessons: Int = 0,
    val xp: Int = 0,
    val level: Int = 1,
    val streak: Int = 0,
)

data class Lesson(
    val id: Int,
    val title: String,
    val description: String,
    val order: Int,
    val isCompleted: Boolean,
    val xpReward: Int,
    val type: String,
)

data class DailyChallenge(
    val id: Int,
    val title: String,
    val description: String,
    val difficulty: String,
    val isCompleted: Boolean,
    val xpReward: Int,
)

data class Achievement(
    val id: Int,
    val name: String,
    val description: String,
    val icon: String?,
    val isUnlocked: Boolean,
)
