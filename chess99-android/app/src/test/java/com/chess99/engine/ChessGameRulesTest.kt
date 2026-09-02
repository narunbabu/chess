package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Rules coverage for the pure-Kotlin [ChessGame] (our chess.js equivalent).
 *
 * The whole native game loop — PlayComputer, PlayMultiplayer, puzzles, review —
 * sits on this class, so a rules bug here is a bug in every screen. These tests
 * pin the behaviours a player can actually hit on a real device: castling,
 * en passant, promotion, the five draw conditions, undo, FEN round-trips and
 * SAN/UCI parsing.
 */
class ChessGameRulesTest {

    // ── Setup / move generation ──────────────────────────────────────

    @Test
    fun `starting position has twenty legal moves for white`() {
        val game = ChessGame()

        assertEquals(20, game.legalMoves().size)
        assertEquals(Color.WHITE, game.turn)
        assertEquals(ChessGame.STARTING_FEN, game.fen())
    }

    @Test
    fun `legalMovesFrom only returns moves for the side to move`() {
        val game = ChessGame()

        assertEquals(2, game.legalMovesFrom("e2").size) // e3, e4
        assertTrue("black may not move on white's turn", game.legalMovesFrom("e7").isEmpty())
    }

    @Test
    fun `double pawn push sets and then clears the en passant square`() {
        val game = ChessGame()

        game.move("e2", "e4")
        assertEquals(Square.fromAlgebraic("e3"), game.enPassantSquare)

        game.move("a7", "a6")
        assertEquals(-1, game.enPassantSquare)
    }

    // ── Castling ─────────────────────────────────────────────────────

    @Test
    fun `kingside castling moves king and rook and is recorded as O-O`() {
        val game = ChessGame("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4")

        val castle = game.legalMovesFrom("e1").find { it.isCastling }
        assertNotNull("kingside castling must be available", castle)
        assertEquals("O-O", castle!!.san(game))

        game.moveUci(castle.uci())
        assertEquals(Piece.make(Piece.KING, Color.WHITE), game.get("g1"))
        assertEquals(Piece.make(Piece.ROOK, Color.WHITE), game.get("f1"))
        assertEquals(Piece.NONE, game.get("e1"))
        assertEquals(Piece.NONE, game.get("h1"))
    }

    @Test
    fun `queenside castling moves king and rook and is recorded as O-O-O`() {
        val game = ChessGame("r3kbnr/pppqpppp/2n5/3p4/3P4/2N1B3/PPPQPPPP/R3KBNR w KQkq - 6 5")

        val castle = game.legalMovesFrom("e1").find { it.isCastling }
        assertNotNull("queenside castling must be available", castle)
        assertEquals("O-O-O", castle!!.san(game))

        game.moveUci(castle.uci())
        assertEquals(Piece.make(Piece.KING, Color.WHITE), game.get("c1"))
        assertEquals(Piece.make(Piece.ROOK, Color.WHITE), game.get("d1"))
    }

    @Test
    fun `cannot castle out of, through, or into check`() {
        // Black rook on e8 pins the castling king — out of check.
        val outOfCheck = ChessGame("4r3/8/8/8/8/8/8/4K2R w K - 0 1")
        assertTrue(outOfCheck.legalMovesFrom("e1").none { it.isCastling })

        // Black rook on f8 attacks f1 — the square the king crosses.
        val throughCheck = ChessGame("5r2/8/8/8/8/8/8/4K2R w K - 0 1")
        assertTrue(throughCheck.legalMovesFrom("e1").none { it.isCastling })

        // Black rook on g8 attacks g1 — the king's destination.
        val intoCheck = ChessGame("6r1/8/8/8/8/8/8/4K2R w K - 0 1")
        assertTrue(intoCheck.legalMovesFrom("e1").none { it.isCastling })
    }

    @Test
    fun `moving the king forfeits both castling rights`() {
        val game = ChessGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")

        game.move("e1", "f1")
        game.move("a8", "b8")
        game.move("f1", "e1")
        game.move("b8", "a8")

        assertTrue(game.legalMovesFrom("e1").none { it.isCastling })
        // White forfeited both rights by moving its king; black's a8 rook round
        // trip forfeited only its queenside right, leaving "k".
        assertEquals("k", game.fen().split(" ")[2])
    }

    @Test
    fun `capturing a rook on its home square forfeits that side's castling right`() {
        val game = ChessGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")

        game.move("a1", "a8") // Rxa8 removes black's queenside right

        assertEquals("Kk", game.fen().split(" ")[2])
    }

    // ── En passant ───────────────────────────────────────────────────

    @Test
    fun `en passant capture removes the passed pawn`() {
        val game = ChessGame("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3")

        val ep = game.move("e5", "f6")

        assertNotNull(ep)
        assertTrue(ep!!.isEnPassant)
        assertEquals(Piece.make(Piece.PAWN, Color.WHITE), game.get("f6"))
        assertEquals("captured pawn on f5 must be removed", Piece.NONE, game.get("f5"))
    }

    @Test
    fun `en passant is only legal on the move immediately after the double push`() {
        val game = ChessGame("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3")

        game.move("a2", "a3")
        game.move("a7", "a6")

        assertNull("the en passant window must have closed", game.move("e5", "f6"))
    }

    @Test
    fun `en passant that would expose the king is rejected`() {
        // White K e5, R? — black rook on h5 x-rays through both pawns: taking en
        // passant clears d5 and e5's own pawn off the rank, exposing the king.
        val game = ChessGame("8/8/8/K1pP3r/8/8/8/7k w - c6 0 2")

        assertNull("en passant may not leave the king in check", game.move("d5", "c6"))
    }

    // ── Promotion ────────────────────────────────────────────────────

    @Test
    fun `pawn reaching the last rank offers all four promotion pieces`() {
        val game = ChessGame("8/4P3/8/8/8/8/8/K6k w - - 0 1")

        val promos = game.legalMovesFrom("e7").filter { it.promotion != 0 }
        assertEquals(
            setOf(Piece.QUEEN, Piece.ROOK, Piece.BISHOP, Piece.KNIGHT),
            promos.map { it.promotion }.toSet(),
        )
    }

    @Test
    fun `underpromotion to knight is honoured and encoded in UCI`() {
        val game = ChessGame("8/4P3/8/8/8/8/8/K6k w - - 0 1")

        val move = game.move("e7", "e8", 'n')

        assertNotNull(move)
        assertEquals("e7e8n", move!!.uci())
        assertEquals(Piece.make(Piece.KNIGHT, Color.WHITE), game.get("e8"))
    }

    @Test
    fun `promotion SAN carries the equals suffix`() {
        val game = ChessGame("8/4P3/8/8/8/8/8/K6k w - - 0 1")
        val queening = game.legalMovesFrom("e7").first { it.promotion == Piece.QUEEN }

        assertEquals("e8=Q", queening.san(game))
    }

    // ── Terminal states ──────────────────────────────────────────────

    @Test
    fun `fools mate is detected as checkmate`() {
        val game = ChessGame()
        listOf("f2" to "f3", "e7" to "e5", "g2" to "g4", "d8" to "h4").forEach { (from, to) ->
            assertNotNull("$from$to must be legal", game.move(from, to))
        }

        assertTrue(game.isCheck())
        assertTrue(game.isCheckmate())
        assertTrue(game.isGameOver())
        assertFalse(game.isStalemate())
        assertTrue(game.legalMoves().isEmpty())
    }

    @Test
    fun `classic stalemate is a draw and not checkmate`() {
        val game = ChessGame("7k/5Q2/6K1/8/8/8/8/8 b - - 0 1")

        assertTrue(game.isStalemate())
        assertFalse(game.isCheck())
        assertFalse(game.isCheckmate())
        assertTrue(game.isDraw())
    }

    @Test
    fun `insufficient material covers the drawn minor piece endings`() {
        assertTrue("K vs K", ChessGame("8/8/4k3/8/8/3K4/8/8 w - - 0 1").isInsufficientMaterial())
        assertTrue("K+N vs K", ChessGame("8/8/4k3/8/8/3K1N2/8/8 w - - 0 1").isInsufficientMaterial())
        assertTrue("K+B vs K", ChessGame("8/8/4k3/8/8/3K1B2/8/8 w - - 0 1").isInsufficientMaterial())
        assertFalse("K+R vs K is a win", ChessGame("8/8/4k3/8/8/3K1R2/8/8 w - - 0 1").isInsufficientMaterial())
        assertFalse("a pawn can promote", ChessGame("8/8/4k3/8/8/3K1P2/8/8 w - - 0 1").isInsufficientMaterial())
    }

    @Test
    fun `fifty move rule triggers at one hundred half moves`() {
        assertFalse(ChessGame("8/8/4k3/8/8/3K1R2/8/8 w - - 99 60").isFiftyMoveRule())
        assertTrue(ChessGame("8/8/4k3/8/8/3K1R2/8/8 w - - 100 60").isFiftyMoveRule())
    }

    @Test
    fun `half move clock resets on a pawn move and on a capture`() {
        val pawn = ChessGame("8/8/4k3/8/8/3K1R2/P7/8 w - - 42 60")
        pawn.move("a2", "a4")
        assertEquals(0, pawn.halfMoveClock)

        val quiet = ChessGame("8/8/4k3/8/8/3K1R2/P7/8 w - - 42 60")
        quiet.move("f3", "f4")
        assertEquals(43, quiet.halfMoveClock)
    }

    @Test
    fun `threefold repetition is detected after shuffling knights back twice`() {
        val game = ChessGame()
        // Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1 Ng8 — the start position occurs three times.
        val shuffle = listOf(
            "g1" to "f3", "g8" to "f6", "f3" to "g1", "f6" to "g8",
            "g1" to "f3", "g8" to "f6", "f3" to "g1", "f6" to "g8",
        )
        shuffle.forEach { (from, to) -> assertNotNull(game.move(from, to)) }

        assertTrue(game.isThreefoldRepetition())
        assertTrue(game.isDraw())
    }

    // ── Undo ─────────────────────────────────────────────────────────

    @Test
    fun `undo restores the exact previous position including clocks and rights`() {
        val game = ChessGame()
        val before = game.fen()

        game.move("e2", "e4")
        game.move("c7", "c5")
        game.undo()
        game.undo()

        assertEquals(before, game.fen())
        assertTrue(game.history().isEmpty())
        assertEquals(Color.WHITE, game.turn)
    }

    @Test
    fun `undo restores a captured piece and an en passant capture`() {
        val game = ChessGame("rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3")
        val before = game.fen()

        game.move("e5", "f6")
        game.undo()

        assertEquals(before, game.fen())
        assertEquals(Piece.make(Piece.PAWN, Color.BLACK), game.get("f5"))
    }

    @Test
    fun `undo restores castling rights and the rook after castling`() {
        val game = ChessGame("r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1")
        val before = game.fen()

        val castle = game.legalMovesFrom("e1").first { it.isCastling }
        game.moveUci(castle.uci())
        game.undo()

        assertEquals(before, game.fen())
        assertEquals(Piece.make(Piece.ROOK, Color.WHITE), game.get("h1"))
    }

    @Test
    fun `undo on a fresh game is a no-op`() {
        val game = ChessGame()

        assertNull(game.undo())
        assertEquals(ChessGame.STARTING_FEN, game.fen())
    }

    // ── FEN / SAN / UCI ──────────────────────────────────────────────

    @Test
    fun `fen round-trips for every position we ship in tests`() {
        val fens = listOf(
            ChessGame.STARTING_FEN,
            "r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4",
            "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
            "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        )

        fens.forEach { fen -> assertEquals(fen, ChessGame(fen).fen()) }
    }

    @Test
    fun `illegal and malformed moves are rejected without mutating the board`() {
        val game = ChessGame()
        val before = game.fen()

        assertNull("pawns cannot jump three squares", game.move("e2", "e5"))
        assertNull("no piece on e5", game.move("e5", "e6"))
        assertNull("truncated UCI", game.moveUci("e2e"))
        assertNull("not a legal SAN in this position", game.moveSan("Qh5xf7#"))
        assertEquals(before, game.fen())
    }

    @Test
    fun `moveSan drives a full opening line`() {
        val game = ChessGame()
        val line = listOf("e4", "e5", "Nf3", "Nc6", "Bb5", "a6")

        line.forEach { san -> assertNotNull("$san must be playable", game.moveSan(san)) }

        assertEquals(line, game.historyVerbose().mapIndexed { i, r -> r.move.san(game, i) })
        assertEquals("1. e4 e5 2. Nf3 Nc6 3. Bb5 a6", game.pgn())
    }

    @Test
    fun `SAN disambiguates by file when two rooks share a rank`() {
        val game = ChessGame("7k/8/8/8/8/8/4K3/R6R w - - 0 1")
        val toD1 = game.legalMoves().filter {
            Piece.type(it.piece) == Piece.ROOK && it.toAlgebraic == "d1"
        }

        assertEquals(2, toD1.size)
        assertEquals(setOf("Rad1", "Rhd1"), toD1.map { it.san(game) }.toSet())
    }

    @Test
    fun `SAN disambiguates by rank when two rooks share a file`() {
        val game = ChessGame("R6k/8/8/8/8/8/8/R6K w - - 0 1")
        val toA4 = game.legalMoves().filter {
            Piece.type(it.piece) == Piece.ROOK && it.toAlgebraic == "a4"
        }

        assertEquals(2, toA4.size)
        assertEquals(setOf("R1a4", "R8a4"), toA4.map { it.san(game) }.toSet())
    }

    @Test
    fun `isSquareAttacked reports attacks by each side`() {
        val game = ChessGame()

        assertTrue(game.isSquareAttacked(Square.fromAlgebraic("f3"), Color.WHITE))
        assertTrue(game.isSquareAttacked(Square.fromAlgebraic("f6"), Color.BLACK))
        assertFalse(game.isSquareAttacked(Square.fromAlgebraic("e5"), Color.WHITE))
    }

    @Test
    fun `a pinned piece may not abandon the king`() {
        // Black bishop on b4 pins the c3 knight against the white king on e1
        // along the b4-c3-d2-e1 diagonal.
        val game = ChessGame("4k3/8/8/8/1b6/2N5/8/4K3 w - - 0 1")

        assertTrue(
            "the pinned knight must have no legal moves",
            game.legalMovesFrom("c3").isEmpty(),
        )
    }

    @Test
    fun `when in check only check-resolving moves are legal`() {
        // Bishop on b5 checks the black king down the b5-c6-d7-e8 diagonal;
        // black can block, interpose or step aside, but nothing else.
        val game = ChessGame("rnbqkbnr/ppp2ppp/3p4/1B2p3/4P3/8/PPPP1PPP/RNBQK1NR b KQkq - 1 3")

        assertTrue(game.isCheck())
        val replies = game.legalMoves()
        assertTrue("this position is check, not mate — replies must exist", replies.isNotEmpty())
        replies.forEach { move ->
            val probe = ChessGame(game.fen())
            probe.moveUci(move.uci())
            // After any legal reply the side that just moved is no longer in check.
            assertFalse("${move.uci()} must resolve the check", probe.isSquareAttacked(
                probe.kingSquare(Color.BLACK), Color.WHITE,
            ))
        }
    }
}
