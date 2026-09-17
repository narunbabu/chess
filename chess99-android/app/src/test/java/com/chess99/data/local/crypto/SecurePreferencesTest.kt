package com.chess99.data.local.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class SecurePreferencesTest {

    /** Reversible, inspectable stand-in for the Keystore-backed codec. */
    private class ReversingCodec : ValueCodec {
        override fun encrypt(plain: String): String = "enc:" + plain.reversed()
        override fun decrypt(stored: String): String? =
            if (stored.startsWith("enc:")) stored.removePrefix("enc:").reversed() else null
    }

    private val backing = FakeSharedPreferences()
    private val prefs = SecurePreferences(backing, ReversingCodec())

    @Test
    fun `stores strings encrypted and reads them back`() {
        prefs.putString("auth_token", "17|secret-token")

        assertEquals("enc:nekot-terces|71", backing.values["auth_token"])
        assertEquals("17|secret-token", prefs.getString("auth_token"))
    }

    @Test
    fun `missing keys read as absent or default`() {
        assertNull(prefs.getString("auth_token"))
        assertEquals(-1, prefs.getInt("user_id", -1))
        assertTrue(prefs.getBoolean("is_minor", true))
    }

    @Test
    fun `round trips ints and booleans`() {
        prefs.putInt("user_id", 4242)
        prefs.putBoolean("is_minor", false)

        assertEquals(4242, prefs.getInt("user_id", -1))
        assertFalse(prefs.getBoolean("is_minor", true))
    }

    @Test
    fun `an undecryptable value falls back to the default rather than throwing`() {
        backing.values["auth_token"] = "written-by-something-else"
        backing.values["user_id"] = "written-by-something-else"
        backing.values["is_minor"] = "written-by-something-else"

        assertNull(prefs.getString("auth_token"))
        assertEquals(-1, prefs.getInt("user_id", -1))
        // Fail closed: an unreadable age classification must still mean "minor".
        assertTrue(prefs.getBoolean("is_minor", true))
    }

    @Test
    fun `a decryptable but unparseable number falls back to the default`() {
        prefs.putString("user_id", "not-a-number")
        prefs.putString("is_minor", "maybe")

        assertEquals(-1, prefs.getInt("user_id", -1))
        assertTrue(prefs.getBoolean("is_minor", true))
    }

    @Test
    fun `putAll encrypts every imported value`() {
        prefs.putAll(
            mapOf(
                "auth_token" to "17|secret-token",
                "user_id" to "4242",
                "user_name" to "Ånand",
                "is_minor" to "false",
            ),
        )

        assertEquals("17|secret-token", prefs.getString("auth_token"))
        assertEquals(4242, prefs.getInt("user_id", -1))
        assertEquals("Ånand", prefs.getString("user_name"))
        assertFalse(prefs.getBoolean("is_minor", true))
        assertFalse(backing.values.values.any { it == "17|secret-token" })
    }

    @Test
    fun `putAll of nothing writes nothing`() {
        prefs.putAll(emptyMap())
        assertTrue(backing.values.isEmpty())
    }

    @Test
    fun `clear drops every value`() {
        prefs.putString("auth_token", "17|secret-token")
        prefs.putInt("user_id", 4242)

        prefs.clear()

        assertNull(prefs.getString("auth_token"))
        assertEquals(-1, prefs.getInt("user_id", -1))
        assertTrue(backing.values.isEmpty())
    }
}
