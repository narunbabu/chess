package com.chess99.data.api

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins [RatingWindow] to the behaviour of the web util it ports,
 * `chess-frontend/src/utils/ratingWindow.js`.
 */
class RatingWindowTest {

    @Test
    fun `default window is wider above than below`() {
        val window = RatingWindow.default(1200)

        assertEquals(1000, window.minRating)
        assertEquals(1550, window.maxRating)
    }

    @Test
    fun `default window clamps to the ratable range at both ends`() {
        assertEquals(RatingWindow.MIN_OPPONENT_RATING, RatingWindow.default(200).minRating)
        assertEquals(RatingWindow.MAX_OPPONENT_RATING, RatingWindow.default(3200).maxRating)
    }

    @Test
    fun `an unknown rating falls back to the default user rating`() {
        assertEquals(RatingWindow.default(RatingWindow.DEFAULT_USER_RATING), RatingWindow.default(null))
    }

    @Test
    fun `a rating below the floor is treated as the floor`() {
        // normalizeUserRating clamps into 200..3200 — a 50-rated account still
        // matches a window that starts at 200.
        assertTrue(RatingWindow(200, 400).contains(50))
    }

    @Test
    fun `bounds typed the wrong way round are swapped, not rejected`() {
        val normalized = RatingWindow(minRating = 1500, maxRating = 900).normalize()

        assertEquals(900, normalized.minRating)
        assertEquals(1500, normalized.maxRating)
    }

    @Test
    fun `a floor below the lowest rating is kept, matching web`() {
        // normalize() clamps window bounds into 0..3200, NOT 200..3200 — the web
        // util keeps a typed floor of 0 rather than snapping it up to 200.
        assertEquals(0, RatingWindow(0, 800).normalize().minRating)
    }

    @Test
    fun `bounds above the ceiling are clamped`() {
        val normalized = RatingWindow(100, 9999).normalize()

        assertEquals(RatingWindow.MAX_OPPONENT_RATING, normalized.maxRating)
    }

    @Test
    fun `contains is inclusive at both ends`() {
        val window = RatingWindow(800, 1200)

        assertTrue(window.contains(800))
        assertTrue(window.contains(1200))
        assertFalse(window.contains(799))
        assertFalse(window.contains(1201))
    }

    @Test
    fun `the full window admits every ratable opponent`() {
        val window = RatingWindow.full()

        assertTrue(window.contains(RatingWindow.MIN_OPPONENT_RATING))
        assertTrue(window.contains(RatingWindow.MAX_OPPONENT_RATING))
        assertTrue(window.contains(1000))
    }
}
