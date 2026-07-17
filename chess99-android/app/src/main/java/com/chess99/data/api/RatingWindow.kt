package com.chess99.data.api

/**
 * Rating window used to fetch "nearby" opponents (real + synthetic) from
 * `GET v1/lobby/players`. Mirrors
 * chess-frontend/src/utils/ratingWindow.js:1-28 exactly (default window,
 * clamping, default user rating) — Android only needs the default-window
 * subset; web's stored-preference/mode-aware variants are not used here.
 */
object RatingWindow {
    const val DEFAULT_USER_RATING = 400
    const val MIN_OPPONENT_RATING = 200
    const val MAX_OPPONENT_RATING = 3200
    const val DEFAULT_WINDOW_BELOW = 200
    const val DEFAULT_WINDOW_ABOVE = 350

    private fun normalizeUserRating(rating: Int): Int =
        rating.coerceIn(MIN_OPPONENT_RATING, MAX_OPPONENT_RATING)

    /** [minRating, maxRating] clamped to [MIN_OPPONENT_RATING, MAX_OPPONENT_RATING]. */
    fun defaultWindow(userRating: Int? = null): Pair<Int, Int> {
        val rating = normalizeUserRating(userRating ?: DEFAULT_USER_RATING)
        val min = (rating - DEFAULT_WINDOW_BELOW).coerceAtLeast(MIN_OPPONENT_RATING)
        val max = (rating + DEFAULT_WINDOW_ABOVE).coerceAtMost(MAX_OPPONENT_RATING)
        return min to max
    }

    /**
     * Full rating span, for the Lobby "Players" list where the intent is to
     * show opponents across ALL skill levels (synthetic bots of varying ELO),
     * not just ones near the current user — unlike Home's rating-windowed
     * "Nearby Opponents". A narrow default window (e.g. 200–750 for an unknown
     * rating) would hide the seeded bots, which start around 800.
     */
    fun fullWindow(): Pair<Int, Int> = MIN_OPPONENT_RATING to MAX_OPPONENT_RATING
}
