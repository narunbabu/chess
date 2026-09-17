package com.chess99.presentation.history

import com.chess99.R
import com.google.gson.JsonParser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LifelineMarkersTest {

    @Test
    fun `reads array and object marker shapes`() {
        val arrayMove = JsonParser.parseString(
            """{"learning_help":["best-move",{"type":"review"}]}""",
        ).asJsonObject
        val objectMove = JsonParser.parseString(
            """{"lifelines":{"learningHelp":["undo"]}}""",
        ).asJsonObject

        assertEquals(listOf("best-move", "review"), LifelineMarkers.fromMoveJson(arrayMove))
        assertEquals(listOf("undo"), LifelineMarkers.fromMoveJson(objectMove))
    }

    @Test
    fun `reads compact tokens and gives stable review labels`() {
        assertEquals(
            listOf("best-move", "review"),
            LifelineMarkers.fromCompactToken("best-move+review"),
        )
        assertEquals(R.string.lifeline_best, LifelineMarkers.labelRes("best_move"))
        assertEquals(R.string.lifeline_review, LifelineMarkers.labelRes("review"))
        assertTrue(LifelineMarkers.fromCompactToken(null).isEmpty())
    }
}
