package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The Chess Coaching Tool panel — Checks, Captures, Threats — is the in-game
 * teaching aid a learner leans on, so a wrong or missing warning is a teaching
 * bug. These tests pin the analysis, the arrow budget, the move classification
 * and the warning severity ladder, all mirroring the web CCTPanel.
 */
class CCTAnalyzerTest {

    @Test
    fun `a quiet opening position has nothing to warn about`() {
        val cct = CCTAnalyzer.analyze(ChessGame())

        assertTrue("no checks are available on move one", cct.checks.isEmpty())
        assertTrue("no captures are available on move one", cct.captures.isEmpty())
        assertEquals(
            CCTWarningSeverity.SAFE,
            CCTAnalyzer.getWarning(cct, ChessGame.STARTING_FEN).severity,
        )
    }

    @Test
    fun `an available check is found and drawn`() {
        // White queen on h5 can check on f7 (and e8 is covered by the black king).
        val game = ChessGame("rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3")

        val cct = CCTAnalyzer.analyze(game)

        assertTrue("Qxf7+ must be reported as a check",
            cct.checks.any { Square.toAlgebraic(it.to) == "f7" })
        assertEquals(CCTWarningSeverity.CRITICAL, CCTAnalyzer.getWarning(cct, game.fen()).severity)
    }

    @Test
    fun `a hanging piece is reported as a capture`() {
        // Black knight on e5 is en prise to the d4 pawn.
        val game = ChessGame("rnbqkb1r/pppp1ppp/5n2/4n3/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 4")

        val cct = CCTAnalyzer.analyze(game)

        assertTrue("dxe5 must be reported as a capture",
            cct.captures.any { Square.toAlgebraic(it.to) == "e5" })
    }

    @Test
    fun `the opponent perspective analyses the other side's resources`() {
        // White to move, but we ask what black could do if it were black's turn.
        val game = ChessGame("rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2")

        val mine = CCTAnalyzer.analyze(game, perspective = "mine")
        val theirs = CCTAnalyzer.analyze(game, perspective = "opponent")

        assertTrue("the two perspectives must not be identical",
            mine.captures != theirs.captures || mine.checks != theirs.checks ||
                mine.threats != theirs.threats)
    }

    @Test
    fun `a malformed position degrades to an empty analysis rather than crashing`() {
        val cct = CCTAnalyzer.analyze(ChessGame("8/8/8/8/8/8/8/8 w - - 0 1"))

        assertTrue(cct.checks.isEmpty())
        assertTrue(cct.captures.isEmpty())
        assertTrue(cct.threats.isEmpty())
    }

    @Test
    fun `arrows stay within the per-category budget the board can render`() {
        val game = ChessGame("r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 6 4")

        val arrows = CCTAnalyzer.cctToArrows(CCTAnalyzer.analyze(game))

        assertTrue("at most 3 checks + 4 captures + 3 threats may be drawn",
            arrows.size <= 10)
        assertTrue("arrows must reference real squares",
            arrows.all { it.from in 0..119 && it.to in 0..119 })
    }

    @Test
    fun `moves are classified against the analysis the panel shows`() {
        val game = ChessGame("rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3")
        val cct = CCTAnalyzer.analyze(game)

        assertEquals("Check+Capture", CCTAnalyzer.classifyMoveAgainstCCT("h5f7", cct))
        assertEquals("Positional", CCTAnalyzer.classifyMoveAgainstCCT("a2a3", cct))
        assertEquals("a truncated UCI string must not crash the panel",
            "Positional", CCTAnalyzer.classifyMoveAgainstCCT("h5", cct))
    }

    @Test
    fun `warning severity follows the checks then captures then threats ladder`() {
        val check = CCTCheck(from = 0, to = 1, san = "Qf7+", isCheckmate = false)
        val capture = CCTCapture(
            from = 2, to = 3, san = "dxe5",
            victimType = Piece.PAWN, attackerType = Piece.PAWN,
            victimName = "Pawn", victimValue = 1.0, attackerValue = 1.0,
        )

        fun severity(checks: List<CCTCheck>, captures: List<CCTCapture>) =
            CCTAnalyzer.getWarning(CCTResult(checks, captures, emptyList()), "fen").severity

        assertEquals(CCTWarningSeverity.CRITICAL, severity(listOf(check), listOf(capture)))
        assertEquals(CCTWarningSeverity.DANGER, severity(listOf(check), emptyList()))
        assertEquals(CCTWarningSeverity.WARNING, severity(emptyList(), listOf(capture)))
        assertEquals(CCTWarningSeverity.SAFE, severity(emptyList(), emptyList()))
    }

    @Test
    fun `warning copy is stable for a position and never empty`() {
        val fen = "rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR w KQkq - 2 3"
        val cct = CCTAnalyzer.analyze(ChessGame(fen))

        val first = CCTAnalyzer.getWarning(cct, fen)
        val second = CCTAnalyzer.getWarning(cct, fen)

        assertEquals("the same position must not flicker between messages",
            first.message, second.message)
        assertFalse(first.message.isBlank())
    }

    @Test
    fun `piece values match the web coaching scale`() {
        assertEquals(1.0, PieceValues.value(Piece.PAWN), 0.001)
        assertEquals(3.0, PieceValues.value(Piece.KNIGHT), 0.001)
        assertEquals("the bishop carries the web's half-point edge over a knight",
            3.25, PieceValues.value(Piece.BISHOP), 0.001)
        assertEquals(5.0, PieceValues.value(Piece.ROOK), 0.001)
        assertEquals(9.0, PieceValues.value(Piece.QUEEN), 0.001)
    }
}
