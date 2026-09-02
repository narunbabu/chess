package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Perft (performance test) — the standard move-generator conformance check.
 *
 * Counts leaf nodes of the legal-move tree from known positions and compares
 * against the published reference values (chessprogramming.org). A single
 * mis-generated or missing move anywhere — a bad pin, an illegal castle, a
 * dropped en-passant, a promotion under-count — shifts the totals, so these
 * numbers are a far stronger guarantee than any hand-written case list.
 *
 * Depths are kept modest so the suite still runs in seconds on CI.
 */
class ChessGamePerftTest {

    private fun perft(game: ChessGame, depth: Int): Long {
        if (depth == 0) return 1L
        val moves = game.legalMoves()
        if (depth == 1) return moves.size.toLong()

        var nodes = 0L
        for (move in moves) {
            val applied = game.moveUci(move.uci())
                ?: error("legal move ${move.uci()} was rejected by moveUci in ${game.fen()}")
            nodes += perft(game, depth - 1)
            game.undo()
            check(applied.from == move.from) { "undo desynchronised the board" }
        }
        return nodes
    }

    private fun assertPerft(fen: String, expected: List<Long>) {
        expected.forEachIndexed { index, count ->
            val depth = index + 1
            val game = ChessGame(fen)
            assertEquals("perft($depth) for $fen", count, perft(game, depth))
        }
    }

    @Test
    fun `perft from the starting position`() {
        assertPerft(ChessGame.STARTING_FEN, listOf(20L, 400L, 8_902L, 197_281L))
    }

    @Test
    fun `perft from Kiwipete - castling, pins and en passant`() {
        assertPerft(
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            listOf(48L, 2_039L, 97_862L),
        )
    }

    @Test
    fun `perft from the endgame position with en passant discovery`() {
        assertPerft(
            "8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1",
            listOf(14L, 191L, 2_812L, 43_238L),
        )
    }

    @Test
    fun `perft from the promotion-heavy position`() {
        assertPerft(
            "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
            listOf(6L, 264L, 9_467L),
        )
    }

    @Test
    fun `perft from the mirrored middlegame position`() {
        assertPerft(
            "rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8",
            listOf(44L, 1_486L, 62_379L),
        )
    }

    @Test
    fun `undo after every legal move restores the position exactly`() {
        val fens = listOf(
            ChessGame.STARTING_FEN,
            "r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1",
            "rnbqkbnr/ppp1p1pp/8/3pPp2/8/8/PPPP1PPP/RNBQKBNR w KQkq f6 0 3",
            "r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1",
        )

        fens.forEach { fen ->
            val game = ChessGame(fen)
            game.legalMoves().forEach { move ->
                game.moveUci(move.uci())
                game.undo()
                assertEquals("undo of ${move.uci()} from $fen", fen, game.fen())
            }
        }
    }
}
