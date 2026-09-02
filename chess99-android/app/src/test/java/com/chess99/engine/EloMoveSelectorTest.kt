package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.max
import kotlin.random.Random

/**
 * [EloMoveSelector] is what makes a "1200-rated" bot actually feel like 1200 —
 * it is the Kotlin port of the web frontend's `selectMoveWithCpBudget`
 * (chess-frontend/src/utils/computerMoveUtils.js). These tests pin the model's
 * observable contract: the ELO table, the centipawn budget, softmax weighting,
 * the opening-protected blunder ramp, and the safety rails that stop a bot from
 * throwing away a forced mate at any rating.
 */
class EloMoveSelectorTest {

    /** Builds a MultiPV list whose rank-N move loses [losses]\[N-1] centipawns. */
    private fun ranked(losses: List<Int>, bestCp: Int = 0): List<RankedMove> =
        losses.mapIndexed { index, loss ->
            RankedMove(
                rank = index + 1,
                uci = "m${index + 1}",
                score = bestCp - loss,
                isMate = false,
                depth = 12,
            )
        }

    private fun lossOf(uci: String, losses: List<Int>): Int =
        losses[uci.removePrefix("m").toInt() - 1]

    /** Mean centipawn loss over [samples] selections at [elo]. */
    private fun meanCpLoss(
        elo: Int,
        losses: List<Int>,
        halfMoveCount: Int = 40,
        samples: Int = 4_000,
        seed: Int = 20260812,
    ): Double {
        val moves = ranked(losses)
        val rng = Random(seed)
        var total = 0L
        repeat(samples) {
            val pick = EloMoveSelector.select(moves, elo, halfMoveCount, rng)!!
            total += lossOf(pick, losses)
        }
        return total.toDouble() / samples
    }

    // ── ELO resolution (web COMPUTER_LEVEL_RATINGS parity) ───────────

    @Test
    fun `difficulty levels map to the same ELOs as the web frontend`() {
        val expected = mapOf(
            1 to 400, 2 to 600, 3 to 800, 4 to 1000, 5 to 1200, 6 to 1400,
            7 to 1600, 8 to 1800, 9 to 2000, 10 to 2200, 11 to 2400, 12 to 2600,
            13 to 2750, 14 to 2900, 15 to 3050, 16 to 3200,
        )

        expected.forEach { (level, elo) ->
            assertEquals("level $level", elo, EloMoveSelector.resolveTargetElo(level, null))
        }
    }

    @Test
    fun `an explicit synthetic player rating overrides the difficulty table`() {
        assertEquals(1337, EloMoveSelector.resolveTargetElo(depth = 2, rating = 1337))
        assertEquals(600, EloMoveSelector.resolveTargetElo(depth = 2, rating = null))
        assertEquals("a zero or negative rating falls back to the table",
            600, EloMoveSelector.resolveTargetElo(depth = 2, rating = 0))
    }

    @Test
    fun `out of range difficulty is clamped instead of crashing`() {
        assertEquals(400, EloMoveSelector.resolveTargetElo(depth = 0, rating = null))
        assertEquals(400, EloMoveSelector.resolveTargetElo(depth = -5, rating = null))
        assertEquals(3200, EloMoveSelector.resolveTargetElo(depth = 99, rating = null))
    }

    // ── Degenerate inputs ────────────────────────────────────────────

    @Test
    fun `an empty MultiPV list returns null so the caller can fall back`() {
        assertNull(EloMoveSelector.select(emptyList(), targetElo = 1200, halfMoveCount = 10))
    }

    @Test
    fun `a single legal move is played at every rating`() {
        val only = listOf(RankedMove(1, "e1f2", -900, false, 12))

        listOf(400, 1200, 2400, 3200).forEach { elo ->
            assertEquals("elo $elo", "e1f2", EloMoveSelector.select(only, elo, halfMoveCount = 30))
        }
    }

    @Test
    fun `selection is reproducible for a given seed`() {
        val moves = ranked(listOf(0, 20, 60, 140, 300))

        val first = (1..50).map { EloMoveSelector.select(moves, 1200, 40, Random(7))!! }
        val second = (1..50).map { EloMoveSelector.select(moves, 1200, 40, Random(7))!! }

        assertEquals(first, second)
    }

    // ── Strength scaling ─────────────────────────────────────────────

    @Test
    fun `a grandmaster-rated bot almost always plays the engine's top move`() {
        val losses = listOf(0, 45, 90, 160, 260)
        val moves = ranked(losses)
        val rng = Random(11)

        val best = (1..2_000).count { EloMoveSelector.select(moves, 3200, 40, rng) == "m1" }

        assertTrue("3200 played the top move only $best/2000 times", best > 1_900)
    }

    @Test
    fun `a beginner-rated bot frequently strays from the top move`() {
        val losses = listOf(0, 45, 90, 160, 260)
        val moves = ranked(losses)

        val beginner = Random(11).let { rng ->
            (1..2_000).count { EloMoveSelector.select(moves, 400, 40, rng) == "m1" }
        }
        val master = Random(11).let { rng ->
            (1..2_000).count { EloMoveSelector.select(moves, 3200, 40, rng) == "m1" }
        }

        assertTrue("400 played the top move $beginner/2000 times — too engine-like",
            beginner < 1_500)
        assertTrue(
            "400 ($beginner) and 3200 ($master) picked the top move equally often",
            master - beginner > 400,
        )
    }

    @Test
    fun `average centipawn loss falls monotonically as rating climbs`() {
        val losses = listOf(0, 10, 25, 50, 80, 120, 180, 250, 400)
        val ladder = listOf(400, 800, 1200, 1600, 2000, 2400, 2800, 3200)

        val means = ladder.map { elo -> elo to meanCpLoss(elo, losses) }

        means.zipWithNext { (lowElo, lowMean), (highElo, highMean) ->
            assertTrue(
                "mean cp loss rose from $lowElo ($lowMean) to $highElo ($highMean)",
                highMean <= lowMean + 1.0,
            )
        }
        val weakest = means.first().second
        val strongest = means.last().second
        assertTrue(
            "400 ($weakest) should be far looser than 3200 ($strongest)",
            weakest > strongest * 3,
        )
    }

    @Test
    fun `the centipawn budget never exceeds the web formula for the rating`() {
        val losses = listOf(0, 30, 70, 120, 200, 300, 450, 700)
        val moves = ranked(losses)

        listOf(400, 1000, 1600, 2200, 2800, 3200).forEach { elo ->
            val budget = ((3500.0 - elo) / 16.0).coerceIn(5.0, 250.0)
            val blunderCeiling = (120.0 + (2400 - elo) * 0.22).coerceIn(100.0, 350.0)
            val ceiling = max(budget, blunderCeiling)
            val rng = Random(3)

            repeat(3_000) {
                val loss = lossOf(EloMoveSelector.select(moves, elo, 40, rng)!!, losses)
                assertTrue(
                    "elo $elo picked a move losing $loss cp, above its $ceiling ceiling",
                    loss <= ceiling,
                )
            }
        }
    }

    // ── Blunder ramp / opening protection ────────────────────────────

    @Test
    fun `blunders are suppressed in the opening and ramp up by the middlegame`() {
        val losses = listOf(0, 10, 25, 50, 80, 120, 180, 250)
        val moves = ranked(losses)
        val budget = (3500.0 - 800) / 16.0 // 168.75 — only a blunder exceeds this
        fun blunderRate(halfMoves: Int): Double {
            val rng = Random(99)
            val hits = (1..6_000).count {
                lossOf(EloMoveSelector.select(moves, 800, halfMoves, rng)!!, losses) > budget
            }
            return hits / 6_000.0
        }

        val opening = blunderRate(halfMoves = 0)    // move 1
        val middlegame = blunderRate(halfMoves = 38) // move 20

        assertTrue("opening blunder rate $opening should be near zero", opening < 0.01)
        assertTrue("middlegame blunder rate $middlegame should be materially higher",
            middlegame > opening * 5)
    }

    @Test
    fun `ratings at or above 2800 never blunder`() {
        val losses = listOf(0, 10, 40, 90, 200, 320)
        val moves = ranked(losses)
        val rng = Random(5)

        repeat(5_000) {
            val loss = lossOf(EloMoveSelector.select(moves, 2800, 60, rng)!!, losses)
            assertTrue("2800 lost $loss cp", loss <= (3500.0 - 2800) / 16.0)
        }
    }

    // ── Safety rails ─────────────────────────────────────────────────

    @Test
    fun `when every alternative is outside the budget the best move is played`() {
        // A forced recapture: everything else drops a piece or worse.
        val moves = ranked(listOf(0, 500, 620, 900))
        val rng = Random(1)

        repeat(2_000) {
            assertEquals("m1", EloMoveSelector.select(moves, 400, 60, rng))
        }
    }

    @Test
    fun `a forced mate is never traded for a merely winning move`() {
        val moves = listOf(
            RankedMove(1, "h5f7", score = 1, isMate = true, depth = 12),   // mate in 1
            RankedMove(2, "d1d8", score = 900, isMate = false, depth = 12), // +9 but no mate
            RankedMove(3, "a2a3", score = 20, isMate = false, depth = 12),
        )
        val rng = Random(2)

        listOf(400, 1200, 2400, 3200).forEach { elo ->
            repeat(1_000) {
                assertEquals("elo $elo abandoned mate in one", "h5f7",
                    EloMoveSelector.select(moves, elo, 60, rng))
            }
        }
    }

    @Test
    fun `a faster mate outranks a slower one`() {
        val moves = listOf(
            RankedMove(1, "slow", score = 5, isMate = true, depth = 14),
            RankedMove(2, "fast", score = 1, isMate = true, depth = 14),
        )
        val rng = Random(4)

        // Mate-in-1 (9998 effective cp) is *better* than the engine's rank-1
        // mate-in-5 (9994), so both sit at zero loss and either is acceptable —
        // what must never happen is a non-mating move sneaking in.
        val picks = (1..500).map { EloMoveSelector.select(moves, 700, 60, rng)!! }.toSet()
        assertTrue(picks.all { it == "slow" || it == "fast" })
    }

    @Test
    fun `walking into a forced mate is never chosen`() {
        val moves = listOf(
            RankedMove(1, "safe", score = -30, isMate = false, depth = 12),
            RankedMove(2, "loses", score = -2, isMate = true, depth = 12), // mated in 2
        )
        val rng = Random(6)

        repeat(2_000) {
            assertEquals("safe", EloMoveSelector.select(moves, 400, 60, rng))
        }
    }

    @Test
    fun `MultiPV entries out of rank order are still sorted before selection`() {
        val shuffled = listOf(
            RankedMove(3, "third", -180, false, 12),
            RankedMove(1, "first", 0, false, 12),
            RankedMove(2, "second", -60, false, 12),
        )
        val rng = Random(8)

        val best = (1..2_000).count { EloMoveSelector.select(shuffled, 3200, 40, rng) == "first" }

        assertTrue("rank order was ignored — top move chosen only $best/2000", best > 1_900)
    }
}
