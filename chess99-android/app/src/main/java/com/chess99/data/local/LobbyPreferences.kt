package com.chess99.data.local

import android.content.Context
import android.content.SharedPreferences
import com.chess99.data.api.RatingWindow
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Lobby choices that should survive leaving the screen: the Elo range the player
 * typed into the Players filter, and the mode / time control they last used to
 * start a game from that list.
 *
 * Web parity: `ratingWindow.js` keeps the explicitly-typed range in its own
 * localStorage bucket (`chess99_rating_window_prefs`) so that finishing a game
 * can never silently move a range the player chose. Same split here — nothing
 * writes [saveRatingWindow] except the filter itself.
 *
 * Plain (unencrypted) SharedPreferences: none of this is sensitive, unlike
 * [TokenManager].
 */
@Singleton
class LobbyPreferences @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** The stored range, or null when the player has never set one. */
    fun getRatingWindow(): RatingWindow? {
        if (!prefs.contains(KEY_MIN_RATING) || !prefs.contains(KEY_MAX_RATING)) return null
        val min = prefs.getInt(KEY_MIN_RATING, RatingWindow.MIN_OPPONENT_RATING)
        val max = prefs.getInt(KEY_MAX_RATING, RatingWindow.MAX_OPPONENT_RATING)
        return RatingWindow(min, max).normalize()
    }

    fun saveRatingWindow(window: RatingWindow) {
        val normalized = window.normalize()
        prefs.edit()
            .putInt(KEY_MIN_RATING, normalized.minRating)
            .putInt(KEY_MAX_RATING, normalized.maxRating)
            .apply()
    }

    /** Drop the stored range so the mode-aware default applies again. */
    fun clearRatingWindow() {
        prefs.edit().remove(KEY_MIN_RATING).remove(KEY_MAX_RATING).apply()
    }

    /** Mode last used to start a game from the Players list ("casual"/"rated"/"learning"). */
    fun getGameMode(): String = prefs.getString(KEY_GAME_MODE, DEFAULT_GAME_MODE) ?: DEFAULT_GAME_MODE

    fun saveGameMode(mode: String) {
        prefs.edit().putString(KEY_GAME_MODE, mode).apply()
    }

    /** Time control in minutes, and increment in seconds. */
    fun getTimeControlMinutes(): Int = prefs.getInt(KEY_TIME_CONTROL, DEFAULT_TIME_CONTROL)

    fun saveTimeControlMinutes(minutes: Int) {
        prefs.edit().putInt(KEY_TIME_CONTROL, minutes).apply()
    }

    fun getIncrementSeconds(): Int = prefs.getInt(KEY_INCREMENT, DEFAULT_INCREMENT)

    fun saveIncrementSeconds(seconds: Int) {
        prefs.edit().putInt(KEY_INCREMENT, seconds).apply()
    }

    companion object {
        private const val PREFS_NAME = "chess99_lobby_prefs"
        private const val KEY_MIN_RATING = "rating_window_min"
        private const val KEY_MAX_RATING = "rating_window_max"
        private const val KEY_GAME_MODE = "game_mode"
        private const val KEY_TIME_CONTROL = "time_control_minutes"
        private const val KEY_INCREMENT = "increment_seconds"

        const val DEFAULT_GAME_MODE = "casual"
        const val DEFAULT_TIME_CONTROL = 10
        const val DEFAULT_INCREMENT = 0
    }
}
