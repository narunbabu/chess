package com.chess99.presentation.common

import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.engine.Piece
import com.chess99.engine.Square
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The replay screens know which *position* they are showing but not which
 * *move* produced it. Everything the board highlights and animates on those
 * screens comes out of here, so a wrong square pair means a piece visibly
 * slides from nowhere — invisible in a screenshot, obvious on a phone.
 */
class MoveReplayTest {

    private fun sq(algebraic: String): Int {
        val file = algebraic[0] - 'a'
        val rank = 8 - (algebraic[1] - '0')
        return rank * 16 + file
    }

    /**
     * French-style opening that reaches a king-side castle and, a few plies
     * later, an en-passant capture. Written in SAN, as the API sends it.
     */
    private val castleAndEnPassantGame = listOf(
        "e4", "e6",     // 0, 1
        "Nf3", "d5",    // 2, 3
        "Bc4", "Bd6",   // 4, 5
        "O-O", "Nc6",   // 6 = white castles king-side, 7
        "e5", "f5",     // 8, 9 = black's double push past the e5 pawn
        "exf6",         // 10 = en passant
    )

    // ── Squares of a chosen ply ──────────────────────────────────────

    @Test
    fun `a quiet opening move reports its own two squares`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)

        assertEquals(sq("e2"), plies[0].from)
        assertEquals(sq("e4"), plies[0].to)
        assertEquals(MoveEffects.None, plies[0].effects)
    }

    @Test
    fun `every ply of the game resolves`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)
        assertEquals(castleAndEnPassantGame.size, plies.size)
    }

    @Test
    fun `castling reports the king's squares, and the rook slide follows from them`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)
        val castle = plies[6]

        assertEquals("O-O", castle.token)
        assertEquals(sq("e1"), castle.from)
        assertEquals(sq("g1"), castle.to)
        // The board derives the rook's own slide from the king's pair.
        assertEquals(
            sq("h1") to sq("f1"),
            BoardGeometry.castlingRookSlide(castle.from, castle.to, movedPieceIsKing = true),
        )
    }

    @Test
    fun `an en-passant capture fades the pawn on its own square, not the destination`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)
        val enPassant = plies[10]

        assertEquals(sq("e5"), enPassant.from)
        assertEquals(sq("f6"), enPassant.to)
        // The captured pawn stood on f5 — fading f6 would fade an empty square.
        assertEquals(sq("f5"), enPassant.effects.capturedSquare)
        assertEquals(Piece.make(Piece.PAWN, Color.BLACK), enPassant.effects.capturedPiece)
        assertTrue(enPassant.effects.hasCapture)
        assertFalse(enPassant.effects.isPromotion)
    }

    @Test
    fun `an ordinary capture fades the piece standing on the destination`() {
        // 1. e4 d5 2. exd5
        val plies = MoveReplay.replay(listOf("e4", "d5", "exd5"))
        val capture = plies[2]

        assertEquals(sq("e4"), capture.from)
        assertEquals(sq("d5"), capture.to)
        assertEquals(sq("d5"), capture.effects.capturedSquare)
        assertEquals(Piece.make(Piece.PAWN, Color.BLACK), capture.effects.capturedPiece)
    }

    @Test
    fun `promotion is flagged so the arriving pawn can become its new piece`() {
        // White pawn one square from the eighth rank, nothing else in the way.
        val plies = MoveReplay.replay(listOf("a8=Q"), startFen = "7k/P7/8/8/8/8/8/7K w - - 0 1")

        assertEquals(1, plies.size)
        assertEquals(sq("a7"), plies[0].from)
        assertEquals(sq("a8"), plies[0].to)
        assertTrue(plies[0].effects.isPromotion)
        assertFalse(plies[0].effects.hasCapture)
    }

    @Test
    fun `a capture that also promotes reports both`() {
        val plies = MoveReplay.replay(listOf("axb8=Q"), startFen = "1r5k/P7/8/8/8/8/8/7K w - - 0 1")

        assertEquals(sq("a7"), plies[0].from)
        assertEquals(sq("b8"), plies[0].to)
        assertTrue(plies[0].effects.isPromotion)
        assertEquals(sq("b8"), plies[0].effects.capturedSquare)
        assertEquals(Piece.make(Piece.ROOK, Color.BLACK), plies[0].effects.capturedPiece)
    }

    // ── Which ply belongs to the position on screen ──────────────────

    @Test
    fun `the starting position has no move to highlight`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)
        assertNull(MoveReplay.plyAtPosition(plies, 0))
    }

    @Test
    fun `position N is explained by the Nth ply`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)

        assertEquals(plies[0], MoveReplay.plyAtPosition(plies, 1))
        assertEquals(plies[6], MoveReplay.plyAtPosition(plies, 7))
        assertEquals(plies.last(), MoveReplay.plyAtPosition(plies, plies.size))
    }

    @Test
    fun `stepping backwards highlights the move that produced the position shown`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)

        // Standing after the castle (position 7) and stepping back to 6 should
        // highlight black's ...Bd6 — the move that made position 6 — not the
        // castle that was just undone.
        val afterStepBack = MoveReplay.plyAtPosition(plies, 6)
        assertNotNull(afterStepBack)
        assertEquals("Bd6", afterStepBack!!.san)
        assertEquals(sq("f8"), afterStepBack.from)
        assertEquals(sq("d6"), afterStepBack.to)
    }

    @Test
    fun `jumping several plies backwards lands on that position's own move`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)

        // From the end (position 11) straight back to position 3.
        val jumped = MoveReplay.plyAtPosition(plies, 3)
        assertNotNull(jumped)
        assertEquals("Nf3", jumped!!.san)
        assertEquals(sq("g1"), jumped.from)
        assertEquals(sq("f3"), jumped.to)
    }

    @Test
    fun `positions past the end of the game have nothing to highlight`() {
        val plies = MoveReplay.replay(castleAndEnPassantGame)
        assertNull(MoveReplay.plyAtPosition(plies, plies.size + 1))
        assertNull(MoveReplay.plyAtPosition(plies, -1))
    }

    // ── Accepted move notations ──────────────────────────────────────

    @Test
    fun `coordinate move lists replay the same as SAN ones`() {
        val san = MoveReplay.replay(listOf("e4", "e5", "Nf3"))
        val uci = MoveReplay.replay(listOf("e2e4", "e7e5", "g1f3"))

        assertEquals(san.map { it.from to it.to }, uci.map { it.from to it.to })
        assertEquals(san.map { it.fenAfter }, uci.map { it.fenAfter })
        // SAN is filled in either way, so callers get a readable label.
        assertEquals("Nf3", uci[2].san)
    }

    @Test
    fun `check and annotation marks on SAN are tolerated`() {
        val plies = MoveReplay.replay(listOf("e4", "e5", "Qh5", "Nc6", "Qxf7#"))
        assertEquals(5, plies.size)
        assertEquals(sq("h5"), plies[4].from)
        assertEquals(sq("f7"), plies[4].to)
    }

    @Test
    fun `zero-spelled castling is understood`() {
        val plies = MoveReplay.replay(listOf("e4", "e6", "Nf3", "d5", "Bc4", "Bd6", "0-0"))
        assertEquals(7, plies.size)
        assertEquals(sq("e1"), plies[6].from)
        assertEquals(sq("g1"), plies[6].to)
    }

    @Test
    fun `promotion in UCI keeps the promoted piece`() {
        val plies = MoveReplay.replay(listOf("a7a8r"), startFen = "7k/P7/8/8/8/8/8/7K w - - 0 1")

        assertEquals(1, plies.size)
        assertTrue(plies[0].effects.isPromotion)
        // A rook, not the queen a lazy default would have produced.
        assertEquals(Piece.make(Piece.ROOK, Color.WHITE), ChessGame(plies[0].fenAfter).get(sq("a8")))
    }

    // ── Bad input ────────────────────────────────────────────────────

    @Test
    fun `replay stops at the first move it cannot play`() {
        // Once a game desynchronises, every later ply describes a position that
        // never happened — better to highlight nothing than the wrong squares.
        val plies = MoveReplay.replay(listOf("e4", "e5", "Qq9", "Nf3"))
        assertEquals(2, plies.size)
    }

    @Test
    fun `garbage tokens resolve to nothing rather than a stray square`() {
        val game = ChessGame()
        assertNull(MoveReplay.findLegal(game, ""))
        assertNull(MoveReplay.findLegal(game, "Nf"))
        assertNull(MoveReplay.findLegal(game, "z9z9"))
        assertNull(MoveReplay.findLegal(game, "e2e5")) // legal-looking, not legal
    }

    @Test
    fun `an empty move list replays to nothing`() {
        assertEquals(emptyList<ReplayPly>(), MoveReplay.replay(emptyList()))
    }

    @Test
    fun `an unusable start position yields no plies instead of throwing`() {
        assertEquals(emptyList<ReplayPly>(), MoveReplay.replay(listOf("e4"), startFen = "not a fen"))
    }

    // ── FEN bookkeeping ──────────────────────────────────────────────

    @Test
    fun `each ply carries the position it produced`() {
        val plies = MoveReplay.replay(listOf("e4", "e5"))
        val board = ChessGame(plies[1].fenAfter)

        assertEquals(Piece.make(Piece.PAWN, Color.WHITE), board.get(sq("e4")))
        assertEquals(Piece.make(Piece.PAWN, Color.BLACK), board.get(sq("e5")))
        assertEquals(Piece.NONE, board.get(sq("e2")))
    }

    @Test
    fun `square helper agrees with the engine's algebraic conversion`() {
        // Guards this test's own 0x88 arithmetic against silently drifting.
        assertEquals("e4", Square.toAlgebraic(sq("e4")))
        assertEquals("f5", Square.toAlgebraic(sq("f5")))
        assertEquals("a8", Square.toAlgebraic(sq("a8")))
    }
}
