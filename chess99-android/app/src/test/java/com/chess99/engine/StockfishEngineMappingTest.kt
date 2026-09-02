package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The pure difficulty mappings on [StockfishEngine]'s companion — think time,
 * tier and undo budget. These are the numbers a player feels directly when they
 * drag the difficulty slider, and they must match the web frontend's
 * `PlayComputer.js` / `computerMoveUtils.js` tables exactly.
 */
class StockfishEngineMappingTest {

    @Test
    fun `think time per difficulty matches the web table`() {
        val expected = mapOf(
            1 to 100, 2 to 150, 3 to 200, 4 to 250, 5 to 300, 6 to 400, 7 to 500, 8 to 600,
            9 to 700, 10 to 800, 11 to 1000, 12 to 1200, 13 to 1500, 14 to 1800,
            15 to 2200, 16 to 2500,
        )

        expected.forEach { (depth, movetime) ->
            assertEquals("depth $depth", movetime, StockfishEngine.mapDepthToMoveTime(depth))
        }
    }

    @Test
    fun `think time rises monotonically with difficulty`() {
        val times = (StockfishEngine.MIN_DEPTH..StockfishEngine.MAX_DEPTH)
            .map { StockfishEngine.mapDepthToMoveTime(it) }

        times.zipWithNext { lower, higher ->
            assertTrue("think time must never drop as difficulty rises", higher > lower)
        }
    }

    @Test
    fun `out of range difficulty is clamped to the ends of the table`() {
        assertEquals(100, StockfishEngine.mapDepthToMoveTime(0))
        assertEquals(100, StockfishEngine.mapDepthToMoveTime(-3))
        assertEquals(2500, StockfishEngine.mapDepthToMoveTime(99))
    }

    @Test
    fun `difficulty tiers split at the web boundaries`() {
        assertEquals(StockfishEngine.DifficultyTier.EASY, StockfishEngine.difficultyTier(1))
        assertEquals(StockfishEngine.DifficultyTier.EASY, StockfishEngine.difficultyTier(4))
        assertEquals(StockfishEngine.DifficultyTier.MEDIUM, StockfishEngine.difficultyTier(5))
        assertEquals(StockfishEngine.DifficultyTier.MEDIUM, StockfishEngine.difficultyTier(8))
        assertEquals(StockfishEngine.DifficultyTier.HARD, StockfishEngine.difficultyTier(9))
        assertEquals(StockfishEngine.DifficultyTier.HARD, StockfishEngine.difficultyTier(12))
        assertEquals(StockfishEngine.DifficultyTier.EXPERT, StockfishEngine.difficultyTier(13))
        assertEquals(StockfishEngine.DifficultyTier.EXPERT, StockfishEngine.difficultyTier(16))
    }

    @Test
    fun `undo budgets match the web per-tier allowance`() {
        assertEquals(15, StockfishEngine.undoChances(depth = 2, isRated = false))
        assertEquals(9, StockfishEngine.undoChances(depth = 6, isRated = false))
        assertEquals(6, StockfishEngine.undoChances(depth = 10, isRated = false))
        assertEquals(3, StockfishEngine.undoChances(depth = 15, isRated = false))
    }

    @Test
    fun `a rated game never grants an undo at any difficulty`() {
        (StockfishEngine.MIN_DEPTH..StockfishEngine.MAX_DEPTH).forEach { depth ->
            assertEquals("depth $depth", 0, StockfishEngine.undoChances(depth, isRated = true))
        }
    }

    @Test
    fun `undo budget shrinks as difficulty rises`() {
        val budgets = (StockfishEngine.MIN_DEPTH..StockfishEngine.MAX_DEPTH)
            .map { StockfishEngine.undoChances(it, isRated = false) }

        budgets.zipWithNext { easier, harder ->
            assertTrue("a harder level must not grant more undos", harder <= easier)
        }
    }

    @Test
    fun `the MultiPV request is wide enough for the ELO selector to have choices`() {
        // EloMoveSelector needs a spread of ranked moves to model a weak player;
        // web requests the same 25.
        assertEquals(25, StockfishEngine.NUM_TOP_MOVES)
        assertTrue(StockfishEngine.MIN_PERCEIVED_THINK_TIME_MS >= 1_000)
    }

    @Test
    fun `the default difficulty sits in the beginner tier`() {
        assertEquals(
            StockfishEngine.DifficultyTier.EASY,
            StockfishEngine.difficultyTier(StockfishEngine.DEFAULT_DEPTH),
        )
        assertTrue(StockfishEngine.DEFAULT_DEPTH in StockfishEngine.MIN_DEPTH..StockfishEngine.MAX_DEPTH)
    }

    @Test
    fun `engine failure copy stays kid-safe and actionable`() {
        assertTrue(EngineFailureCopy.MESSAGE.isNotBlank())
        assertTrue(EngineFailureCopy.ACTION_LABEL.isNotBlank())
        listOf("exception", "null", "error code", ".so", "stack").forEach { jargon ->
            assertTrue(
                "engine failure copy must not leak '$jargon'",
                !EngineFailureCopy.MESSAGE.lowercase().contains(jargon),
            )
        }
    }
}
