package com.chess99.presentation.game

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ChatSafetyRulesTest {
    @Test
    fun `minor can send approved presets and emoji only`() {
        val policy = ChatPolicy(enabled = true, presetOnly = false)

        assertTrue(ChatSafetyRules.canSend("Good game!", isMinor = true, policy))
        assertTrue(ChatSafetyRules.canSend("👍", isMinor = true, policy))
        assertFalse(ChatSafetyRules.canSend("What is your phone number?", isMinor = true, policy))
    }

    @Test
    fun `adult can send filtered text when server policy permits`() {
        val policy = ChatPolicy(enabled = true, presetOnly = false)

        assertTrue(ChatSafetyRules.canSend("Thanks for the game", isMinor = false, policy))
    }

    @Test
    fun `server kill switch and block policy fail closed`() {
        assertFalse(
            ChatSafetyRules.canSend(
                "Good luck!",
                isMinor = false,
                policy = ChatPolicy(enabled = false, reason = "blocked"),
            )
        )
    }

    @Test
    fun `server preset-only policy also restricts adults`() {
        val policy = ChatPolicy(enabled = true, presetOnly = true)

        assertTrue(ChatSafetyRules.canSend("Thanks!", isMinor = false, policy))
        assertFalse(ChatSafetyRules.canSend("free text", isMinor = false, policy))
    }
}
