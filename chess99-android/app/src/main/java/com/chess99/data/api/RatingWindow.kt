package com.chess99.data.api

/**
 * Opponent Elo range — both the window sent to `GET v1/lobby/players` and the
 * range the player types into the lobby's Players filter.
 *
 * Port of `chess-frontend/src/utils/ratingWindow.js`. The clamping rules are
 * deliberately identical, including the asymmetry between [normalizeUserRating]
 * (clamps into [MIN_OPPONENT_RATING]..[MAX_OPPONENT_RATING]) and [normalize]
 * (clamps the window bounds into 0..[MAX_OPPONENT_RATING]) — a player may type a
 * floor below the lowest rating that exists, and web keeps it rather than
 * snapping it up.
 */
data class RatingWindow(
    val minRating: Int,
    val maxRating: Int,
) {
    /** Clamp both bounds, swapping them if they were typed the wrong way round. */
    fun normalize(): RatingWindow {
        var min = minRating.coerceIn(0, MAX_OPPONENT_RATING)
        var max = maxRating.coerceIn(0, MAX_OPPONENT_RATING)
        if (min > max) {
            val swap = min
            min = max
            max = swap
        }
        return RatingWindow(min, max)
    }

    /** True when [rating] falls inside this window, after both are normalized. */
    fun contains(rating: Int?): Boolean {
        val window = normalize()
        val normalized = normalizeUserRating(rating ?: DEFAULT_USER_RATING)
        return normalized >= window.minRating && normalized <= window.maxRating
    }

    companion object {
        const val DEFAULT_USER_RATING = 400
        const val MIN_OPPONENT_RATING = 200
        const val MAX_OPPONENT_RATING = 3200
        const val DEFAULT_WINDOW_BELOW = 200
        const val DEFAULT_WINDOW_ABOVE = 350

        fun normalizeUserRating(rating: Int): Int =
            rating.coerceIn(MIN_OPPONENT_RATING, MAX_OPPONENT_RATING)

        /**
         * Window a player gets before touching the filter: wider above than
         * below, so the default surfaces opponents worth beating.
         */
        fun default(userRating: Int? = null): RatingWindow {
            val rating = normalizeUserRating(userRating ?: DEFAULT_USER_RATING)
            return RatingWindow(
                minRating = (rating - DEFAULT_WINDOW_BELOW).coerceAtLeast(MIN_OPPONENT_RATING),
                maxRating = (rating + DEFAULT_WINDOW_ABOVE).coerceAtMost(MAX_OPPONENT_RATING),
            )
        }

        /**
         * Full rating span. The Players tab fetches with this so the server
         * returns opponents across every skill level; the player then narrows
         * the list locally with the Elo filter. A narrow fetch window (e.g.
         * 200–750 for an unknown rating) hid every seeded synthetic opponent.
         */
        fun full(): RatingWindow = RatingWindow(MIN_OPPONENT_RATING, MAX_OPPONENT_RATING)
    }
}
