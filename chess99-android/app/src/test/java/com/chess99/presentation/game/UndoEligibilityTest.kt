package com.chess99.presentation.game

import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Pins [MultiplayerUiState.canRequestUndo] to web's takeback rules
 * (chess-frontend/src/components/play/PlayMultiplayer.js:2636-2697 and :2957).
 */
class UndoEligibilityTest {

    private fun move(n: Int) = GameMoveRecord(
        moveNumber = n,
        from = "e2",
        to = "e4",
        san = "e4",
        fen = ChessGame.STARTING_FEN,
        playerColor = Color.WHITE,
        captured = false,
    )

    /** Playing White, White to move, two plies on the board, one chance left. */
    private fun eligible() = MultiplayerUiState(
        fen = ChessGame.STARTING_FEN,
        playerColor = Color.WHITE,
        gamePhase = MultiplayerPhase.PLAYING,
        moveHistory = listOf(move(1), move(2)),
        undoChancesRemaining = 3,
        isRated = false,
    )

    @Test
    fun `a casual game on your own turn with chances left allows a takeback`() {
        assertTrue(eligible().canRequestUndo)
    }

    @Test
    fun `rated games never allow a takeback`() {
        assertFalse(eligible().copy(isRated = true).canRequestUndo)
    }

    @Test
    fun `a spent budget blocks the request`() {
        assertFalse(eligible().copy(undoChancesRemaining = 0).canRequestUndo)
    }

    @Test
    fun `you cannot ask twice while a request is in flight`() {
        assertFalse(eligible().copy(undoRequestPending = true).canRequestUndo)
    }

    @Test
    fun `you can only ask on your own turn`() {
        // Same starting position (White to move) but we are Black.
        assertFalse(eligible().copy(playerColor = Color.BLACK).canRequestUndo)
    }

    @Test
    fun `there must be a full turn pair to roll back`() {
        assertFalse(eligible().copy(moveHistory = listOf(move(1))).canRequestUndo)
        assertFalse(eligible().copy(moveHistory = emptyList()).canRequestUndo)
    }

    @Test
    fun `a finished game allows nothing`() {
        assertFalse(eligible().copy(gamePhase = MultiplayerPhase.COMPLETED).canRequestUndo)
        assertFalse(eligible().copy(gamePhase = MultiplayerPhase.CONNECTING).canRequestUndo)
    }

    @Test
    fun `isMyTurn reads the side to move out of the fen`() {
        val blackToMove = ChessGame.STARTING_FEN.replace(" w ", " b ")

        assertTrue(eligible().copy(fen = blackToMove, playerColor = Color.BLACK).isMyTurn)
        assertFalse(eligible().copy(fen = blackToMove, playerColor = Color.WHITE).isMyTurn)
    }
}
