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

    @Test
    fun `restart with a retained session resumes Home`() {
        assertEquals("home", coldStartDestination(isLoggedIn = true, hasSeenOnboarding = true))
        assertEquals("home", coldStartDestination(isLoggedIn = true, hasSeenOnboarding = false))
    }

    @Test
    fun `restart after logout never resumes the authenticated Home screen`() {
        // Returning user (onboarding seen, session cleared by logout).
        assertEquals("login", coldStartDestination(isLoggedIn = false, hasSeenOnboarding = true))
        // Genuine first run.
        assertEquals("onboarding", coldStartDestination(isLoggedIn = false, hasSeenOnboarding = false))
    }

    @Test
    fun `leaving a screen with a previous entry is an ordinary pop`() {
        var consulted = false
        assertNull(leaveRouteFor(hasPreviousEntry = true) { consulted = true; "login" })
        assertEquals(false, consulted)
    }

    @Test
    fun `guest leaving Play Computer as the back-stack root goes to Login`() {
        // Guest entry from Onboarding marks onboarding seen, then pops it.
        val exit = leaveRouteFor(hasPreviousEntry = false) {
            coldStartDestination(isLoggedIn = false, hasSeenOnboarding = true)
        }
        assertEquals("login", exit)
    }

    @Test
    fun `signed-in root leave returns Home and first-run root leave returns Onboarding`() {
        assertEquals("home", leaveRouteFor(false) { coldStartDestination(true, true) })
        assertEquals("onboarding", leaveRouteFor(false) { coldStartDestination(false, false) })
    }
}
