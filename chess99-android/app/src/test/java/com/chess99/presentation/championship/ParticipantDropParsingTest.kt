package com.chess99.presentation.championship

import com.chess99.R
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * GET championships/{id}/participants returns a player dropped for repeated
 * forfeits as a still-registered, still-paid row; `dropped` / `dropped_at` is
 * the only signal that they are out of the tournament. The roster showed
 * nothing at all before, so a dropped player looked like an active entrant.
 */
class ParticipantDropParsingTest {

    private fun parse(json: String) =
        parseParticipants(JsonParser.parseString(json).asJsonArray)

    @Test
    fun `reads the dropped flag and reason`() {
        val participants = parse(
            """
            [
              {"user_id": 1, "dropped": false, "dropped_at": null, "dropped_reason": null,
               "user": {"name": "Still In", "rating": 1500}},
              {"user_id": 2, "dropped": true, "dropped_at": "2026-09-14 09:00:00",
               "dropped_reason": "forfeit_limit",
               "user": {"name": "Dropped Dan", "rating": 1400}}
            ]
            """.trimIndent()
        )

        assertEquals(2, participants.size)
        assertFalse(participants[0].dropped)
        assertNull(participants[0].droppedReason)
        assertTrue(participants[1].dropped)
        assertEquals("forfeit_limit", participants[1].droppedReason)
    }

    @Test
    fun `falls back to dropped_at when the boolean alias is absent`() {
        val participants = parse(
            """[{"user_id": 3, "dropped_at": "2026-09-14 09:00:00", "user": {"name": "Raw", "rating": 1200}}]"""
        )

        assertTrue(participants.single().dropped)
    }

    @Test
    fun `a row with neither field is not dropped`() {
        val participants = parse("""[{"user_id": 4, "user": {"name": "Plain", "rating": 1200}}]""")

        assertFalse(participants.single().dropped)
    }

    @Test
    fun `still reads name rating seed and skips malformed rows`() {
        val participants = parse(
            """
            [
              null,
              {"no_user_id": true},
              {"user_id": 5, "seed_number": 3, "user": {"name": "Seeded", "rating": 1700}}
            ]
            """.trimIndent()
        )

        val only = participants.single()
        assertEquals(5, only.userId)
        assertEquals("Seeded", only.name)
        assertEquals(1700, only.rating)
        assertEquals(3, only.seed)
    }

    @Test
    fun `drop reason gets a human label with a safe default`() {
        // The copy itself now lives in strings.xml; the mapping is what this asserts.
        assertEquals(
            R.string.championship_drop_reason_forfeit_limit,
            dropReasonLabelRes("forfeit_limit"),
        )
        assertEquals(R.string.championship_drop_reason_removed, dropReasonLabelRes(null))
        assertEquals(R.string.championship_drop_reason_removed, dropReasonLabelRes("something_new"))
    }
}
