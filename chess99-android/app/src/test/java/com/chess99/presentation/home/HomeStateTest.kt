package com.chess99.presentation.home

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class HomeStateTest {
    private val cachedGame = ContinuePlayingGame(
        id = 9,
        opponentName = "Computer Ada",
        status = "active",
        playingAsWhite = true,
        lastMoveAtIso = null,
        canDiscard = false,
    )

    @Test
    fun `failed resume refresh preserves cached cards and exposes retry state`() {
        val result = applyResumeLoad(
            current = HomeUiState(continuePlayingGames = listOf(cachedGame)),
            active = Result.failure(IllegalStateException("offline")),
            unfinished = Result.success(emptyList()),
        )

        assertEquals(listOf(cachedGame), result.continuePlayingGames)
        assertTrue(result.resumeLoadFailed)
        assertFalse(result.isResumeLoading)
    }

    @Test
    fun `successful refresh de-duplicates active and unfinished games`() {
        val pausedDuplicate = cachedGame.copy(status = "paused", canDiscard = true)
        val other = cachedGame.copy(id = 10, opponentName = "Ravi", status = "paused")

        val result = applyResumeLoad(
            current = HomeUiState(),
            active = Result.success(listOf(cachedGame)),
            unfinished = Result.success(listOf(pausedDuplicate, other)),
        )

        assertEquals(listOf(9, 10), result.continuePlayingGames.map { it.id })
        assertFalse(result.resumeLoadFailed)
        assertFalse(result.isResumeLoading)
    }

    @Test
    fun `successful empty refresh is distinct from a load failure`() {
        val result = applyResumeLoad(
            current = HomeUiState(continuePlayingGames = listOf(cachedGame)),
            active = Result.success(emptyList()),
            unfinished = Result.success(emptyList()),
        )

        assertTrue(result.continuePlayingGames.isEmpty())
        assertFalse(result.resumeLoadFailed)
    }
}
