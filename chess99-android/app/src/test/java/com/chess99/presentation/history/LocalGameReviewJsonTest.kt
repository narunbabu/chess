package com.chess99.presentation.history

import com.chess99.engine.ChessGame
import com.chess99.engine.Color
import com.chess99.presentation.game.EndReason
import com.chess99.presentation.game.GameMode
import com.chess99.presentation.game.GameMoveRecord
import com.chess99.presentation.game.GameResultState
import com.chess99.presentation.game.ResultStatus
import com.chess99.presentation.game.Winner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LocalGameReviewJsonTest {

    @Test
    fun `completed local review survives a serialize and process-style reload`() {
        val record = LocalGameReviewRecord(
            moves = listOf(
                GameMoveRecord(
                    moveNumber = 1,
                    from = "e2",
                    to = "e4",
                    san = "e4",
                    fen = ChessGame().apply { move("e2", "e4") }.fen(),
                    playerColor = Color.WHITE,
                    captured = false,
                )
            ),
            result = GameResultState(
                status = ResultStatus.LOST,
                endReason = EndReason.RESIGNATION,
                winner = Winner.OPPONENT,
                details = "You resigned",
            ),
            playerColor = Color.WHITE,
            opponentName = "Computer",
            difficulty = 6,
            gameMode = GameMode.LEARNING,
            completedAtEpochMillis = 42L,
        )

        val restored = LocalGameReviewJson.decode(LocalGameReviewJson.encode(record))

        assertEquals(record, restored)
    }

    @Test
    fun `corrupt persisted review is ignored`() {
        assertNull(LocalGameReviewJson.decode("not-json"))
        assertNull(LocalGameReviewJson.decode("{}"))
        assertNull(LocalGameReviewJson.decode("null"))
        assertNull(LocalGameReviewJson.decode("{\"moves\":[]}"))
    }
}
