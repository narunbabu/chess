package com.chess99.presentation.learn

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.TutorialApi
import com.chess99.data.api.arrOrNull
import com.chess99.data.api.bool
import com.chess99.data.api.int
import com.chess99.data.api.objOrNull
import com.chess99.data.api.str
import com.chess99.presentation.common.friendlyError
import com.google.gson.JsonArray
import com.google.gson.JsonObject
import com.google.gson.JsonParser
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
 *
 * CONTRACT (verified live against api.chess99.com on 2026-07-14 — see
 * docs/specs/2026-07-14-quality-fix-program/S5-learn-tutorials-contract.md).
 * Every `tutorial/` endpoint wraps its payload in `{ success, data }`. The
 * previous implementation read keys from the top-level body with `?: 0` /
 * `?: emptyList()` fallbacks, which silently degraded every miss to a
 * fake-working empty UI ("0/0 Lessons") instead of surfacing an error —
 * that was the root cause of the empty Learn tab on production.
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

    // ── Envelope unwrapping ───────────────────────────────────────────────
    // Every tutorial/* response is `{ success: bool, data: <object|array> }`.
    // `getProgress()`/`getStats()` additionally nest the stats block under
    // `data.stats`. Unwrap here so every loader below reads real keys.
    // (Keyed obj/arr lookups are local to this file — data/api/JsonSafe.kt
    // only exposes no-arg objOrNull()/arrOrNull() on a resolved JsonElement.)

    private fun JsonObject.dataObj(): JsonObject? = get("data").objOrNull()
    private fun JsonObject.dataArr(): JsonArray? = get("data").arrOrNull()
    private fun JsonObject.succeeded(): Boolean = get("success")?.takeIf { it.isJsonPrimitive }?.asBoolean ?: true
    private fun JsonObject?.objOrNull(key: String): JsonObject? = this?.get(key).objOrNull()
    private fun JsonObject?.arrOrNull(key: String): JsonArray? = this?.get(key).arrOrNull()

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
            if (!response.isSuccessful) {
                _uiState.value = _uiState.value.copy(
                    error = friendlyError(java.io.IOException("HTTP ${response.code()}"), "lessons"),
                )
                return
            }
            val body = response.body()
            val modulesArray = body?.dataArr()
            if (body == null || !body.succeeded() || modulesArray == null) {
                Timber.w("tutorial contract miss (modules): keys=${body?.keySet()}")
                _uiState.value = _uiState.value.copy(
                    error = "Couldn't load lessons. Pull to retry.",
                )
                return
            }
            val modules = parseModules(modulesArray)
            val grouped = modules.groupBy { it.tier }
            _uiState.value = _uiState.value.copy(
                modules = modules,
                beginnerModules = grouped["beginner"] ?: emptyList(),
                intermediateModules = grouped["intermediate"] ?: emptyList(),
                advancedModules = grouped["advanced"] ?: emptyList(),
                error = null,
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to load tutorial modules")
            _uiState.value = _uiState.value.copy(error = friendlyError(e, "lessons"))
        }
    }

    private suspend fun loadStats() {
        try {
            val response = tutorialApi.getStats()
            if (!response.isSuccessful) {
                Timber.w("tutorial contract miss (stats): HTTP ${response.code()}")
                return
            }
            val body = response.body()
            val statsObj = body?.dataObj()?.objOrNull("stats")
            if (body == null || !body.succeeded() || statsObj == null) {
                Timber.w("tutorial contract miss (stats): keys=${body?.keySet()}")
                return
            }
            _uiState.value = _uiState.value.copy(
                stats = TutorialStats(
                    completedLessons = statsObj.int("completed_lessons") ?: 0,
                    totalLessons = statsObj.int("total_lessons") ?: 0,
                    xp = statsObj.int("xp_progress") ?: statsObj.int("xp") ?: 0,
                    level = statsObj.int("level") ?: 1,
                    streak = statsObj.int("current_streak") ?: statsObj.int("streak") ?: 0,
                ),
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to load tutorial stats")
        }
    }

    private suspend fun loadDailyChallenge() {
        try {
            val response = tutorialApi.getDailyChallenge()
            if (!response.isSuccessful) {
                Timber.w("tutorial contract miss (daily-challenge): HTTP ${response.code()}")
                return
            }
            val body = response.body()
            val challenge = body?.dataObj()
            if (body == null || !body.succeeded() || challenge == null) {
                // Locked tracks return success:false with a message — not a
                // parse error, just "no challenge for this user right now".
                Timber.w("tutorial contract miss (daily-challenge): keys=${body?.keySet()}")
                return
            }
            _uiState.value = _uiState.value.copy(
                dailyChallenge = DailyChallenge(
                    id = challenge.int("id") ?: 0,
                    title = challenge.str("challenge_type_display") ?: challenge.str("title") ?: "Daily Challenge",
                    description = challenge.objOrNull("track").str("focus") ?: challenge.str("description") ?: "",
                    difficulty = challenge.objOrNull("track").str("skill_tier") ?: challenge.str("difficulty") ?: "medium",
                    isCompleted = challenge.objOrNull("user_completion").bool("completed") ?: false,
                    xpReward = challenge.int("xp_reward") ?: 20,
                ),
            )
        } catch (e: Exception) {
            Timber.e(e, "Failed to load daily challenge")
        }
    }

    private suspend fun loadAchievements() {
        try {
            val response = tutorialApi.getUserAchievements()
            if (!response.isSuccessful) {
                Timber.w("tutorial contract miss (achievements): HTTP ${response.code()}")
                return
            }
            val body = response.body()
            val achievementsArray = body?.dataArr()
            if (body == null || !body.succeeded() || achievementsArray == null) {
                Timber.w("tutorial contract miss (achievements): keys=${body?.keySet()}")
                return
            }
            val achievements = achievementsArray.mapNotNull { el ->
                val a = el.objOrNull() ?: return@mapNotNull null
                Achievement(
                    id = a.int("id") ?: return@mapNotNull null,
                    name = a.str("name") ?: "",
                    description = a.str("description") ?: "",
                    icon = a.str("icon"),
                    isUnlocked = a.bool("is_earned") ?: a.bool("is_unlocked") ?: false,
                )
            }
            _uiState.value = _uiState.value.copy(achievements = achievements)
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
                error = null,
            )
            try {
                val response = tutorialApi.getModule(slug)
                if (!response.isSuccessful) {
                    // 403 (tier-locked) and 404 (unknown slug) both come back
                    // with `{success:false, message}` and no `data` node —
                    // surface the server's own message rather than a generic one.
                    val body = response.errorBody()?.charStream()?.let {
                        runCatching { JsonParser.parseReader(it).asJsonObject }.getOrNull()
                    }
                    _uiState.value = _uiState.value.copy(
                        isLoadingModule = false,
                        error = body?.str("message") ?: "Couldn't load this module. Pull to retry.",
                    )
                    return@launch
                }
                val body = response.body()
                val module = body?.dataObj()
                val lessonsArray = module?.get("lessons").arrOrNull()
                if (body == null || !body.succeeded() || module == null || lessonsArray == null) {
                    Timber.w("tutorial contract miss (module detail): keys=${body?.keySet()}")
                    _uiState.value = _uiState.value.copy(
                        isLoadingModule = false,
                        error = "Couldn't load this module. Pull to retry.",
                    )
                    return@launch
                }
                val lessons = lessonsArray.mapNotNull { el ->
                    val l = el.objOrNull() ?: return@mapNotNull null
                    val status = l.objOrNull("user_progress").str("status")
                    Lesson(
                        id = l.int("id") ?: return@mapNotNull null,
                        title = l.str("title") ?: "",
                        description = l.str("description") ?: "",
                        order = l.int("sort_order") ?: l.int("order") ?: 0,
                        isCompleted = status == "completed" || status == "mastered",
                        xpReward = l.int("xp_reward") ?: 10,
                        type = l.str("lesson_type") ?: l.str("type") ?: "standard",
                    )
                }.sortedBy { it.order }

                _uiState.value = _uiState.value.copy(
                    isLoadingModule = false,
                    // Genuine emptiness (HTTP ok, `data.lessons` present but
                    // `[]`) keeps the existing empty-state copy in LearnScreen —
                    // this is not a contract miss, `lessonsArray` unwrapped fine.
                    selectedModuleLessons = lessons,
                )
            } catch (e: Exception) {
                Timber.e(e, "Failed to load module detail: $slug")
                _uiState.value = _uiState.value.copy(
                    isLoadingModule = false,
                    error = friendlyError(e, "this module"),
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
                _uiState.value = _uiState.value.copy(error = friendlyError(e, "your progress"))
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

    /**
     * @param modulesArray the already-unwrapped `data` array from `tutorial/modules`.
     * Real field names (verified live, see class doc): module title is
     * `name` (NOT `title` — modules and lessons use different fillable
     * fields on the backend), tier is `skill_tier` (NOT `tier`), ordering is
     * `sort_order` (NOT `order`), and per-module lesson counts live under the
     * nested `user_progress.{total_lessons,completed_lessons}` object rather
     * than flat `lessons_count`/`completed_lessons` keys.
     */
    private fun parseModules(modulesArray: JsonArray): List<TutorialModule> {
        return modulesArray.mapNotNull { el ->
            try {
                val m = el.objOrNull() ?: return@mapNotNull null
                val progress = m.objOrNull("user_progress")
                TutorialModule(
                    id = m.int("id") ?: return@mapNotNull null,
                    slug = m.str("slug") ?: "",
                    title = m.str("name") ?: m.str("title") ?: "",
                    description = m.str("description") ?: "",
                    tier = m.str("skill_tier") ?: m.str("tier") ?: "beginner",
                    icon = m.str("icon"),
                    lessonsCount = progress.int("total_lessons")
                        ?: m.int("lessons_count") ?: 0,
                    completedLessons = progress.int("completed_lessons")
                        ?: m.int("completed_lessons") ?: 0,
                    order = m.int("sort_order") ?: m.int("order") ?: 0,
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
