package com.chess99.presentation.common

import com.chess99.engine.Square
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Geometry behind the board's piece-slide animation. These are the parts that
 * decide *where* a piece is drawn mid-slide, and which extra piece has to slide
 * when the move was a castle — get either wrong and pieces visibly fly to the
 * wrong square, which is exactly the kind of thing that is invisible in a
 * screenshot but obvious on a phone.
 */
class BoardGeometryTest {

    private fun sq(algebraic: String): Int {
        val file = algebraic[0] - 'a'
        val rank = 8 - (algebraic[1] - '0')
        return rank * 16 + file
    }

    // ── Orientation ──────────────────────────────────────────────────

    @Test
    fun `a1 sits bottom-left when white is at the bottom`() {
        assertEquals(0, BoardGeometry.viewFile(sq("a1"), whiteAtBottom = true))
        assertEquals(7, BoardGeometry.viewRank(sq("a1"), whiteAtBottom = true))
    }

    @Test
    fun `a1 sits top-right when the board is flipped for black`() {
        assertEquals(7, BoardGeometry.viewFile(sq("a1"), whiteAtBottom = false))
        assertEquals(0, BoardGeometry.viewRank(sq("a1"), whiteAtBottom = false))
    }

    @Test
    fun `flipping the board mirrors every square through the centre`() {
        for (rank in 0..7) {
            for (file in 0..7) {
                val square = rank * 16 + file
                assertEquals(
                    7 - BoardGeometry.viewFile(square, whiteAtBottom = true),
                    BoardGeometry.viewFile(square, whiteAtBottom = false),
                )
                assertEquals(
                    7 - BoardGeometry.viewRank(square, whiteAtBottom = true),
                    BoardGeometry.viewRank(square, whiteAtBottom = false),
                )
            }
        }
    }

    // ── Castling rook slide ──────────────────────────────────────────

    @Test
    fun `white king-side castle slides the h1 rook to f1`() {
        val slide = BoardGeometry.castlingRookSlide(sq("e1"), sq("g1"), movedPieceIsKing = true)
        assertEquals(sq("h1") to sq("f1"), slide)
    }

    @Test
    fun `white queen-side castle slides the a1 rook to d1`() {
        val slide = BoardGeometry.castlingRookSlide(sq("e1"), sq("c1"), movedPieceIsKing = true)
        assertEquals(sq("a1") to sq("d1"), slide)
    }

    @Test
    fun `black king-side castle slides the h8 rook to f8`() {
        val slide = BoardGeometry.castlingRookSlide(sq("e8"), sq("g8"), movedPieceIsKing = true)
        assertEquals(sq("h8") to sq("f8"), slide)
    }

    @Test
    fun `black queen-side castle slides the a8 rook to d8`() {
        val slide = BoardGeometry.castlingRookSlide(sq("e8"), sq("c8"), movedPieceIsKing = true)
        assertEquals(sq("a8") to sq("d8"), slide)
    }

    @Test
    fun `an ordinary king step moves no rook`() {
        assertNull(BoardGeometry.castlingRookSlide(sq("e1"), sq("f1"), movedPieceIsKing = true))
        assertNull(BoardGeometry.castlingRookSlide(sq("e1"), sq("e2"), movedPieceIsKing = true))
    }

    @Test
    fun `a two-file move by a non-king moves no rook`() {
        // A queen sweeping e1-g1 must not drag the h1 rook along with it.
        assertNull(BoardGeometry.castlingRookSlide(sq("e1"), sq("g1"), movedPieceIsKing = false))
    }

    @Test
    fun `a two-file king move across ranks is not a castle`() {
        // Defensive: a diagonal two-file delta can only come from bad input,
        // and must not be mistaken for castling.
        assertNull(BoardGeometry.castlingRookSlide(sq("e1"), sq("g3"), movedPieceIsKing = true))
    }

    @Test
    fun `square helper agrees with the engine's algebraic conversion`() {
        // Guards the test's own 0x88 arithmetic against silently drifting.
        assertEquals("e1", Square.toAlgebraic(sq("e1")))
        assertEquals("a8", Square.toAlgebraic(sq("a8")))
        assertEquals("h1", Square.toAlgebraic(sq("h1")))
    }
}
