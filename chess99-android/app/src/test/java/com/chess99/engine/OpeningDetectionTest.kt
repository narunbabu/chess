package com.chess99.engine

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * Opening names shown on the game review / history screens. Ported from
 * chess-frontend/src/utils/openingDetection.js — the same game must be labelled
 * identically on web and native, so these cases pin the "longest match wins"
 * rule the web book relies on.
 */
class OpeningDetectionTest {

    @Test
    fun `the most specific matching opening wins over its prefix`() {
        assertEquals("King's Pawn Game", detectOpening(listOf("e4", "e5")))
        assertEquals("Ruy Lopez", detectOpening(listOf("e4", "e5", "Nf3", "Nc6", "Bb5")))
        assertEquals("Italian Game", detectOpening(listOf("e4", "e5", "Nf3", "Nc6", "Bc4")))
        assertEquals("Scotch Game", detectOpening(listOf("e4", "e5", "Nf3", "Nc6", "d4")))
    }

    @Test
    fun `common defences are recognised from the first pair of moves`() {
        assertEquals("Sicilian Defense", detectOpening(listOf("e4", "c5")))
        assertEquals("French Defense", detectOpening(listOf("e4", "e6")))
        assertEquals("Caro-Kann Defense", detectOpening(listOf("e4", "c6")))
        assertEquals("Scandinavian Defense", detectOpening(listOf("e4", "d5")))
        assertEquals("Alekhine's Defense", detectOpening(listOf("e4", "Nf6")))
    }

    @Test
    fun `queen's pawn lines resolve to their deepest name`() {
        assertEquals("Queen's Pawn Game", detectOpening(listOf("d4", "d5")))
        assertEquals("Queen's Gambit", detectOpening(listOf("d4", "d5", "c4")))
        assertEquals("Queen's Gambit Accepted", detectOpening(listOf("d4", "d5", "c4", "dxc4")))
        assertEquals(
            "Queen's Gambit Declined",
            detectOpening(listOf("d4", "d5", "c4", "e6", "Nc3")),
        )
        assertEquals(
            "Nimzo-Indian Defense",
            detectOpening(listOf("d4", "Nf6", "c4", "e6", "Nc3", "Bb4")),
        )
    }

    @Test
    fun `extra moves beyond the book do not change the name`() {
        val withContinuation = detectOpening(
            listOf("e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O"),
        )

        assertEquals("Ruy Lopez", withContinuation)
    }

    @Test
    fun `flank openings are covered`() {
        assertEquals("English Opening", detectOpening(listOf("c4")))
        assertEquals("Reti Opening", detectOpening(listOf("Nf3")))
        assertEquals("King's Indian Attack", detectOpening(listOf("Nf3", "d5", "g3")))
    }

    @Test
    fun `an unbooked or empty game has no opening name`() {
        assertNull(detectOpening(emptyList()))
        assertNull(detectOpening(listOf("a3")))
        assertNull(detectOpening(listOf("h4", "h5")))
    }

    @Test
    fun `detection is driven by SAN produced by our own engine`() {
        val game = ChessGame()
        val sans = mutableListOf<String>()
        listOf("e4", "c5", "Nf3", "d6", "d4").forEach { san ->
            val move = game.legalMoves().first { it.san(game) == san }
            sans += san
            game.moveUci(move.uci())
        }

        assertEquals("Sicilian Najdorf", detectOpening(sans))
    }
}
