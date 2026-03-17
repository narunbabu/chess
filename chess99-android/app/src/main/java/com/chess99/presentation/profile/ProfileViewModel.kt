package com.chess99.presentation.profile

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.chess99.data.api.ProfileApi
import com.chess99.data.local.TokenManager
import com.google.gson.JsonObject
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import timber.log.Timber
import javax.inject.Inject

/**
 * ViewModel for the Profile screen.
 * Mirrors chess-frontend/src/components/Profile.js:
 *   - 3 tabs (Settings, Friends, Stats)
 *   - Profile editing (name, birthday, class)
 *   - Avatar management (file upload + DiceBear)
 *   - Board theme / piece style / sound preferences
 *   - Rating history, game stats, friends list
 */
@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val profileApi: ProfileApi,
    private val tokenManager: TokenManager,
    @ApplicationContext private val context: Context,
) : ViewModel() {

    private val _uiState = MutableStateFlow(ProfileUiState())
    val uiState: StateFlow<ProfileUiState> = _uiState.asStateFlow()

    private val prefs by lazy {
        context.getSharedPreferences("chess99_settings", Context.MODE_PRIVATE)
    }

    init {
        loadProfile()
        loadLocalPreferences()
    }

    // ── Tab Selection ──────────────────────────────────────────────────

    fun selectTab(tab: ProfileTab) {
        _uiState.value = _uiState.value.copy(selectedTab = tab)
        // Lazy-load tab data on first visit
        when (tab) {
            ProfileTab.STATS -> if (_uiState.value.stats == null) loadStats()
            ProfileTab.FRIENDS -> if (!_uiState.value.friendsLoaded) loadFriends()
            ProfileTab.SETTINGS -> { /* Settings uses profile data already loaded */ }
        }
    }

    // ── Load Profile ───────────────────────────────────────────────────

    private fun loadProfile() {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true)
            try {
                val response = profileApi.getProfile()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    // The /user endpoint returns user object directly (or nested in "data")
                    val user = if (body.has("data")) body.getAsJsonObject("data") else body

                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        userId = user.get("id")?.asInt ?: 0,
                        name = user.get("name")?.asString ?: "",
                        email = user.get("email")?.asString ?: "",
                        avatarUrl = user.get("avatar_url")?.asString,
                        rating = user.get("rating")?.asInt ?: 1200,
                        birthday = user.get("birthday")?.asString ?: "",
                        classOfStudy = user.get("class_of_study")?.asString ?: "",
                        boardTheme = user.get("board_theme")?.asString ?: "classic",
                        organizationName = user.get("organization_name")?.asString,
                    )

                    // Sync board theme to local prefs if server has one
                    user.get("board_theme")?.asString?.let { theme ->
                        prefs.edit().putString(KEY_BOARD_THEME, theme).apply()
                    }
                } else {
                    _uiState.value = _uiState.value.copy(
                        isLoading = false,
                        error = "Failed to load profile",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load profile")
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    error = "Network error: ${e.message}",
                )
            }
        }
    }

    // ── Load Rating History ────────────────────────────────────────────

    fun loadRatingHistory() {
        viewModelScope.launch {
            try {
                val response = profileApi.getRatingHistory()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val history = body.getAsJsonArray("history")?.map { el ->
                        val entry = el.asJsonObject
                        RatingHistoryEntry(
                            rating = entry.get("rating")?.asInt ?: entry.get("new_rating")?.asInt ?: 1200,
                            date = entry.get("created_at")?.asString ?: "",
                            gameId = entry.get("game_id")?.asInt,
                            change = entry.get("rating_change")?.asInt ?: 0,
                        )
                    } ?: emptyList()
                    _uiState.value = _uiState.value.copy(ratingHistory = history)
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load rating history")
            }
        }
    }

    // ── Load Stats ─────────────────────────────────────────────────────

    private fun loadStats() {
        viewModelScope.launch {
            try {
                val response = profileApi.getPerformanceStats()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val statsObj = if (body.has("stats")) body.getAsJsonObject("stats") else body

                    _uiState.value = _uiState.value.copy(
                        stats = GameStats(
                            totalGames = statsObj.get("total_games")?.asInt ?: 0,
                            wins = statsObj.get("wins")?.asInt ?: 0,
                            losses = statsObj.get("losses")?.asInt ?: 0,
                            draws = statsObj.get("draws")?.asInt ?: 0,
                            winRate = statsObj.get("win_rate")?.asFloat ?: 0f,
                            currentStreak = statsObj.get("current_streak")?.asInt ?: 0,
                            bestStreak = statsObj.get("best_streak")?.asInt ?: 0,
                            averageGameDuration = statsObj.get("average_game_duration")?.asInt ?: 0,
                        ),
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load stats")
            }
        }
    }

    // ── Load Friends ───────────────────────────────────────────────────

    private fun loadFriends() {
        viewModelScope.launch {
            try {
                val response = profileApi.getFriends()
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val friends = body.getAsJsonArray("friends")?.map { el ->
                        val f = el.asJsonObject
                        FriendInfo(
                            id = f.get("id")?.asInt ?: 0,
                            name = f.get("name")?.asString ?: "",
                            rating = f.get("rating")?.asInt ?: 1200,
                            isOnline = f.get("is_online")?.asBoolean ?: false,
                            avatarUrl = f.get("avatar_url")?.asString,
                        )
                    } ?: emptyList()
                    _uiState.value = _uiState.value.copy(
                        friends = friends,
                        friendsLoaded = true,
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to load friends")
            }
        }
    }

    fun searchFriends(query: String) {
        _uiState.value = _uiState.value.copy(friendSearchQuery = query)
        if (query.length < 2) {
            _uiState.value = _uiState.value.copy(friendSearchResults = emptyList())
            return
        }
        viewModelScope.launch {
            try {
                val response = profileApi.searchUsers(query)
                if (response.isSuccessful) {
                    val body = response.body() ?: return@launch
                    val users = body.getAsJsonArray("users")?.map { el ->
                        val u = el.asJsonObject
                        FriendInfo(
                            id = u.get("id")?.asInt ?: 0,
                            name = u.get("name")?.asString ?: "",
                            rating = u.get("rating")?.asInt ?: 1200,
                            isOnline = u.get("is_online")?.asBoolean ?: false,
                            avatarUrl = u.get("avatar_url")?.asString,
                        )
                    } ?: emptyList()
                    _uiState.value = _uiState.value.copy(friendSearchResults = users)
                }
            } catch (e: Exception) {
                Timber.e(e, "Friend search failed")
            }
        }
    }

    // ── Update Profile Fields ──────────────────────────────────────────

    fun updateName(name: String) {
        _uiState.value = _uiState.value.copy(name = name)
    }

    fun updateBirthday(birthday: String) {
        _uiState.value = _uiState.value.copy(birthday = birthday)
    }

    fun updateClassOfStudy(classOfStudy: String) {
        _uiState.value = _uiState.value.copy(classOfStudy = classOfStudy)
    }

    fun saveProfile() {
        viewModelScope.launch {
            val state = _uiState.value
            _uiState.value = state.copy(isSaving = true)
            try {
                val body = JsonObject().apply {
                    addProperty("name", state.name)
                    if (state.birthday.isNotBlank()) {
                        addProperty("birthday", state.birthday)
                    }
                    if (state.classOfStudy.isNotBlank()) {
                        addProperty("class_of_study", state.classOfStudy.toIntOrNull())
                    }
                }
                val response = profileApi.updateProfile(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        snackbarMessage = "Profile updated",
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isSaving = false,
                        error = "Failed to save profile",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Failed to save profile")
                _uiState.value = _uiState.value.copy(
                    isSaving = false,
                    error = "Save error: ${e.message}",
                )
            }
        }
    }

    // ── Avatar Management ──────────────────────────────────────────────

    fun uploadAvatar(uri: Uri) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isUploadingAvatar = true)
            try {
                val inputStream = context.contentResolver.openInputStream(uri) ?: run {
                    _uiState.value = _uiState.value.copy(
                        isUploadingAvatar = false,
                        error = "Could not read file",
                    )
                    return@launch
                }

                val bytes = inputStream.readBytes()
                inputStream.close()

                // Determine MIME type
                val mimeType = context.contentResolver.getType(uri) ?: "image/jpeg"
                val extension = when {
                    mimeType.contains("png") -> "png"
                    mimeType.contains("gif") -> "gif"
                    else -> "jpg"
                }

                val requestBody = bytes.toRequestBody(mimeType.toMediaType())
                val part = MultipartBody.Part.createFormData(
                    "avatar",
                    "avatar.$extension",
                    requestBody,
                )

                val response = profileApi.uploadAvatar(part)
                if (response.isSuccessful) {
                    // Reload profile to get updated avatar URL
                    loadProfile()
                    _uiState.value = _uiState.value.copy(
                        isUploadingAvatar = false,
                        snackbarMessage = "Avatar updated",
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isUploadingAvatar = false,
                        error = "Upload failed",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "Avatar upload failed")
                _uiState.value = _uiState.value.copy(
                    isUploadingAvatar = false,
                    error = "Upload error: ${e.message}",
                )
            }
        }
    }

    fun selectDiceBearAvatar(style: String, seed: String) {
        val url = "https://api.dicebear.com/7.x/$style/svg?seed=$seed"
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isUploadingAvatar = true)
            try {
                val body = JsonObject().apply {
                    addProperty("avatar_url", url)
                }
                val response = profileApi.setDiceBearAvatar(body)
                if (response.isSuccessful) {
                    _uiState.value = _uiState.value.copy(
                        avatarUrl = url,
                        isUploadingAvatar = false,
                        showAvatarPicker = false,
                        snackbarMessage = "Avatar updated",
                    )
                } else {
                    _uiState.value = _uiState.value.copy(
                        isUploadingAvatar = false,
                        error = "Failed to set avatar",
                    )
                }
            } catch (e: Exception) {
                Timber.e(e, "DiceBear avatar set failed")
                _uiState.value = _uiState.value.copy(
                    isUploadingAvatar = false,
                    error = "Error: ${e.message}",
                )
            }
        }
    }

    fun toggleAvatarPicker() {
        _uiState.value = _uiState.value.copy(
            showAvatarPicker = !_uiState.value.showAvatarPicker,
        )
    }

    fun regenerateDiceBearSeeds() {
        val newSeeds = DICEBEAR_STYLES.flatMap { style ->
            (0 until 3).map { _ ->
                val seed = "${style}-${(1..6).map { ('a'..'z').random() }.joinToString("")}"
                DiceBearOption(style = style, seed = seed)
            }
        }
        _uiState.value = _uiState.value.copy(diceBearOptions = newSeeds)
    }

    // ── Board Theme ────────────────────────────────────────────────────

    fun selectBoardTheme(themeKey: String) {
        _uiState.value = _uiState.value.copy(boardTheme = themeKey)
        prefs.edit().putString(KEY_BOARD_THEME, themeKey).apply()

        // Persist to server
        viewModelScope.launch {
            try {
                val body = JsonObject().apply {
                    addProperty("board_theme", themeKey)
                }
                profileApi.updateProfile(body)
            } catch (e: Exception) {
                Timber.e(e, "Failed to save board theme")
            }
        }
    }

    // ── Piece Style ────────────────────────────────────────────────────

    fun selectPieceStyle(style: String) {
        _uiState.value = _uiState.value.copy(pieceStyle = style)
        prefs.edit().putString(KEY_PIECE_STYLE, style).apply()
    }

    // ── Sound ──────────────────────────────────────────────────────────

    fun toggleSoundMuted() {
        val newMuted = !_uiState.value.isSoundMuted
        _uiState.value = _uiState.value.copy(isSoundMuted = newMuted)
        prefs.edit().putBoolean(KEY_SOUND_MUTED, newMuted).apply()
    }

    // ── Local Preferences ──────────────────────────────────────────────

    private fun loadLocalPreferences() {
        _uiState.value = _uiState.value.copy(
            boardTheme = prefs.getString(KEY_BOARD_THEME, "classic") ?: "classic",
            pieceStyle = prefs.getString(KEY_PIECE_STYLE, "standard") ?: "standard",
            isSoundMuted = prefs.getBoolean(KEY_SOUND_MUTED, false),
        )
    }

    // ── Helpers ─────────────────────────────────────────────────────────

    fun clearError() {
        _uiState.value = _uiState.value.copy(error = null)
    }

    fun clearSnackbar() {
        _uiState.value = _uiState.value.copy(snackbarMessage = null)
    }

    companion object {
        private const val KEY_BOARD_THEME = "chess99_board_theme"
        private const val KEY_PIECE_STYLE = "chess99_piece_style"
        private const val KEY_SOUND_MUTED = "chess99_sound_muted"

        /**
         * DiceBear avatar styles available in the picker.
         * Matches chess-frontend/src/components/Profile.js DICEBEAR_STYLES
         * plus additional styles for variety.
         */
        val DICEBEAR_STYLES = listOf(
            "adventurer", "avataaars", "bottts", "fun-emoji",
            "lorelei", "micah", "miniavs", "open-peeps",
            "personas", "pixel-art", "thumbs", "big-smile",
        )

        /**
         * Board themes matching chess-frontend/src/config/boardThemes.js BOARD_THEMES.
         * Each entry: key -> BoardThemeInfo(name, darkColor, lightColor, tier).
         */
        val BOARD_THEMES = linkedMapOf(
            // Free themes
            "classic" to BoardThemeInfo("Classic", 0xFF769656, 0xFFEEEED2, "free"),
            "blue" to BoardThemeInfo("Blue", 0xFF4B7399, 0xFFEAE9D2, "free"),
            // Standard+ themes
            "brown" to BoardThemeInfo("Walnut", 0xFFB58863, 0xFFF0D9B5, "standard"),
            "purple" to BoardThemeInfo("Royal", 0xFF7B61A6, 0xFFE8D0FF, "standard"),
            "coral" to BoardThemeInfo("Coral", 0xFFC76E6E, 0xFFFCE4E4, "standard"),
            "midnight" to BoardThemeInfo("Midnight", 0xFF4A4A6A, 0xFFC8C8D4, "standard"),
            "forest" to BoardThemeInfo("Forest", 0xFF5A8A4A, 0xFFD4E8C4, "standard"),
            "marble" to BoardThemeInfo("Marble", 0xFF888888, 0xFFF5F5F0, "standard"),
            "ocean" to BoardThemeInfo("Ocean", 0xFF2C5F8A, 0xFFD4E8F2, "standard"),
            "autumn" to BoardThemeInfo("Autumn", 0xFFA0522D, 0xFFF5E6D3, "standard"),
            // Gold-exclusive themes
            "neon" to BoardThemeInfo("Neon", 0xFF6B1F9E, 0xFF1A1A2E, "gold"),
            "obsidian" to BoardThemeInfo("Obsidian", 0xFF2D2D2D, 0xFF404040, "gold"),
        )

        /**
         * Piece style options matching chess-frontend/src/components/play/BoardCustomizer.js.
         */
        val PIECE_STYLES = listOf(
            PieceStyleInfo("standard", "Standard"),
            PieceStyleInfo("3d", "3D Classic"),
        )
    }
}

// ── UI State ─────────────────────────────────────────────────────────────

data class ProfileUiState(
    // Loading states
    val isLoading: Boolean = false,
    val isSaving: Boolean = false,
    val isUploadingAvatar: Boolean = false,

    // Navigation
    val selectedTab: ProfileTab = ProfileTab.SETTINGS,

    // User profile data
    val userId: Int = 0,
    val name: String = "",
    val email: String = "",
    val avatarUrl: String? = null,
    val rating: Int = 1200,
    val birthday: String = "",
    val classOfStudy: String = "",
    val organizationName: String? = null,

    // Avatar picker
    val showAvatarPicker: Boolean = false,
    val diceBearOptions: List<DiceBearOption> = ProfileViewModel.DICEBEAR_STYLES.flatMap { style ->
        (0 until 3).map { i ->
            DiceBearOption(style = style, seed = "$style-seed$i")
        }
    },

    // Settings / preferences
    val boardTheme: String = "classic",
    val pieceStyle: String = "standard",
    val isSoundMuted: Boolean = false,

    // Rating history
    val ratingHistory: List<RatingHistoryEntry> = emptyList(),

    // Stats
    val stats: GameStats? = null,

    // Friends
    val friends: List<FriendInfo> = emptyList(),
    val friendsLoaded: Boolean = false,
    val friendSearchQuery: String = "",
    val friendSearchResults: List<FriendInfo> = emptyList(),

    // Messaging
    val error: String? = null,
    val snackbarMessage: String? = null,
)

enum class ProfileTab { SETTINGS, FRIENDS, STATS }

data class DiceBearOption(
    val style: String,
    val seed: String,
) {
    val url: String get() = "https://api.dicebear.com/7.x/$style/svg?seed=$seed"
}

data class BoardThemeInfo(
    val name: String,
    val darkColor: Long,
    val lightColor: Long,
    val tier: String,
)

data class PieceStyleInfo(
    val key: String,
    val label: String,
)

data class RatingHistoryEntry(
    val rating: Int,
    val date: String,
    val gameId: Int?,
    val change: Int,
)

data class GameStats(
    val totalGames: Int = 0,
    val wins: Int = 0,
    val losses: Int = 0,
    val draws: Int = 0,
    val winRate: Float = 0f,
    val currentStreak: Int = 0,
    val bestStreak: Int = 0,
    val averageGameDuration: Int = 0,
)

data class FriendInfo(
    val id: Int,
    val name: String,
    val rating: Int,
    val isOnline: Boolean,
    val avatarUrl: String? = null,
)
