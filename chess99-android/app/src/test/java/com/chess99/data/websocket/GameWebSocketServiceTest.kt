package com.chess99.data.websocket

import app.cash.turbine.test
import com.chess99.data.api.WebSocketApi
import com.chess99.data.local.TokenManager
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class GameWebSocketServiceTest {

    private fun service() = GameWebSocketService(
        pusherManager = mockk(relaxed = true),
        webSocketApi = mockk<WebSocketApi>(relaxed = true),
        tokenManager = mockk<TokenManager>(relaxed = true),
    )

    @Test
    fun `canonical draw offer reads offerer id`() = runTest {
        val service = service()
        service.events.test {
            service.handleGameEvent("draw.offer.sent", """{"offerer_id":42}""")

            val event = awaitItem() as GameEvent.DrawOffered
            assertEquals(42, event.offeredBy)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `canonical undo request reads backend keys`() = runTest {
        val service = service()
        service.events.test {
            service.handleGameEvent(
                "game.undo.request",
                """{"requested_by_user_id":7,"requested_by_user_name":"Mira","expires_at":"2026-09-08T12:00:30Z"}""",
            )

            val event = awaitItem() as GameEvent.UndoRequested
            assertEquals(7, event.requestedBy)
            assertEquals("Mira", event.requestedByName)
            assertEquals("2026-09-08T12:00:30Z", event.expiresAt)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `accepted undo carries the authoritative position and nullable bot accepter`() = runTest {
        val service = service()
        service.events.test {
            service.handleGameEvent(
                "game.undo.accepted",
                """{
                    "fen":"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                    "move_count":0,
                    "undo_white_remaining":8,
                    "undo_black_remaining":9,
                    "accepted_by_user_id":null,
                    "accepted_by_synthetic":true
                }""".trimIndent(),
            )

            val event = awaitItem() as GameEvent.UndoAccepted
            assertEquals(0, event.moveCount)
            assertEquals(8, event.undoWhiteRemaining)
            assertEquals(9, event.undoBlackRemaining)
            assertNull(event.acceptedByUserId)
            assertTrue(event.acceptedBySynthetic)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `lookalike legacy event names are not decoded`() = runTest {
        val service = service()
        service.events.test {
            service.handleGameEvent("undo.request", """{"requested_by_user_id":7}""")
            service.handleGameEvent("prefix.game.undo.request", """{"requested_by_user_id":7}""")
            expectNoEvents()
            cancelAndIgnoreRemainingEvents()
        }
    }
}
