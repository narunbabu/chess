package com.chess99.presentation.common

import com.chess99.engine.ChessGame
import com.chess99.engine.Square
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AccessibleMoveEntryTest {

    @Test
    fun `accessible entry exposes only engine-legal starting moves`() {
        val options = accessibleMoveOptions(ChessGame())

        assertEquals(20, options.size)
        assertTrue(options.any {
            it.fromSquare == Square.fromAlgebraic("e2") &&
                it.toSquare == Square.fromAlgebraic("e4")
        })
        assertTrue(options.none {
            it.fromSquare == Square.fromAlgebraic("e2") &&
                it.toSquare == Square.fromAlgebraic("e5")
        })
    }

    @Test
    fun `accessible entry preserves all legal promotion choices`() {
        val game = ChessGame("7k/P7/8/8/8/8/8/7K w - - 0 1")
        val promotions = accessibleMoveOptions(game)
            .filter {
                it.fromSquare == Square.fromAlgebraic("a7") &&
                    it.toSquare == Square.fromAlgebraic("a8")
            }
            .mapNotNull { it.promotion }
            .toSet()

        assertEquals(setOf('q', 'r', 'b', 'n'), promotions)
    }
}
