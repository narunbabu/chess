package com.chess99.presentation.navigation

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepLinkHandlerTest {
    @Test
    fun `password reset remains available while logged out and decodes values`() {
        val destination = DeepLinkHandler.handleDeepLink(
            "https://chess99.com/reset-password?token=a%2Bb%2Fc&email=kid%40example.com"
        )

        assertEquals(
            DeepLinkDestination.ResetPasswordPage("a+b/c", "kid@example.com"),
            destination,
        )
        assertFalse(requireNotNull(destination).requiresAuthentication())
    }

    @Test
    fun `join and short referral links preserve their code`() {
        assertEquals(
            DeepLinkDestination.ReferralJoin("COACH99"),
            DeepLinkHandler.handleDeepLink("https://chess99.com/join/COACH99"),
        )
        assertEquals(
            DeepLinkDestination.ReferralJoin("COACH99"),
            DeepLinkHandler.handleDeepLink("https://chess99.com/r/COACH99"),
        )
    }

    @Test
    fun `protected game link is deferred for authentication`() {
        val destination = DeepLinkHandler.handleDeepLink("https://chess99.com/game/42")

        assertEquals(DeepLinkDestination.Game(42), destination)
        assertTrue(requireNotNull(destination).requiresAuthentication())
    }

    @Test
    fun `unsupported commerce and content pages remain browser-only`() {
        assertNull(DeepLinkHandler.handleDeepLink("https://chess99.com/pricing"))
        assertNull(DeepLinkHandler.handleDeepLink("https://chess99.com/ebook"))
        assertNull(DeepLinkHandler.handleDeepLink("https://chess99.com/training"))
    }
}
