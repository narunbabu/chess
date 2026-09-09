package com.chess99.presentation.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class MainNavigationTest {
    @Test
    fun `primary routes select their route-derived destination`() {
        assertEquals(MainDestination.Play, mainDestinationForRoute("home"))
        assertEquals(MainDestination.Learn, mainDestinationForRoute("learn"))
        assertEquals(MainDestination.Compete, mainDestinationForRoute("championships"))
        assertEquals(MainDestination.You, mainDestinationForRoute("profile"))
    }

    @Test
    fun `preserved sub-routes retain their owning destination`() {
        assertEquals(MainDestination.Play, mainDestinationForRoute("lobby?tab={tab}"))
        assertEquals(MainDestination.Learn, mainDestinationForRoute("tutorial/lesson/{lessonId}"))
        assertEquals(MainDestination.Compete, mainDestinationForRoute("championships/{id}"))
        assertEquals(MainDestination.You, mainDestinationForRoute("game_review/{gameId}"))
        assertEquals(MainDestination.You, mainDestinationForRoute("local_game_review"))
    }

    @Test
    fun `focused and unauthenticated routes have no main navigation`() {
        assertNull(mainDestinationForRoute("play_computer"))
        assertNull(mainDestinationForRoute("play_multiplayer/{gameId}"))
        assertNull(mainDestinationForRoute("login"))
        assertNull(mainDestinationForRoute(null))
    }
}
