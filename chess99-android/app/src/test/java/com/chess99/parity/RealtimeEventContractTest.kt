package com.chess99.parity

import com.google.gson.JsonParser
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** Keeps Android's literal Pusher bindings aligned with the backend contract. */
class RealtimeEventContractTest {

    private val deliberatelyUndocumentedBindings = setOf(
        // Emitted and consumed, but not yet represented by the shared fixture.
        "game.chat",
        // Known legacy mismatch retained by the approved bounded takeback spec.
        "GameConnectionEvent",
    )

    @Test
    fun `game channel bindings use documented exact wire names`() {
        val source = sourceFile(
            "src/main/java/com/chess99/data/websocket/GameWebSocketService.kt",
            "app/src/main/java/com/chess99/data/websocket/GameWebSocketService.kt",
        ).readText()
        val bindings = Regex("channel\\.bind\\(\"([^\"]+)\"")
            .findAll(source)
            .map { it.groupValues[1] }
            .toSet()
        val documented = documentedWireNames()

        val unexpected = bindings - documented - deliberatelyUndocumentedBindings
        assertTrue("Android binds undocumented game events: $unexpected", unexpected.isEmpty())

        setOf(
            "game.undo.request",
            "game.undo.accepted",
            "game.undo.declined",
            "draw.offer.sent",
            "draw.offer.declined",
        ).forEach { expected ->
            assertTrue("missing canonical bind $expected", expected in bindings)
        }

        setOf(
            "undo.request", "undo.accepted", "undo.declined",
            "draw.offered", "draw.accepted", "draw.declined",
            "game.timer", "game.resigned", "GameEndedEvent",
        ).forEach { obsolete ->
            assertFalse("obsolete bind survived: $obsolete", obsolete in bindings)
        }
    }

    private fun documentedWireNames(): Set<String> {
        val contract = sourceFile(
            "../../chess-backend/docs/api-contract/websocket-events.json",
            "../chess-backend/docs/api-contract/websocket-events.json",
            "chess-backend/docs/api-contract/websocket-events.json",
        )
        assertTrue("shared websocket contract is missing: ${contract.absolutePath}", contract.exists())

        val channels = JsonParser.parseString(contract.readText()).asJsonObject
            .getAsJsonObject("properties")
            .getAsJsonObject("channels")
            .getAsJsonObject("properties")

        // Game bindings must be justified by the GAME channel, not by events
        // from user or presence channels (presence has pusher_events instead).
        return channels.getAsJsonObject("private-game.{gameId}")
            .getAsJsonObject("properties")
            .getAsJsonObject("events")
            .getAsJsonObject("properties")
            .keySet()
            .map { it.removePrefix(".") }
            .toSet()
    }

    private fun sourceFile(vararg candidates: String): File =
        candidates.asSequence().map(::File).firstOrNull(File::exists)
            ?: File(candidates.first())
}
