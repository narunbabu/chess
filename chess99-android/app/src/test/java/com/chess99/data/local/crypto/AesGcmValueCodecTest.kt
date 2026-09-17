package com.chess99.data.local.crypto

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.util.Base64
import javax.crypto.KeyGenerator

/**
 * The encryption format that replaced `EncryptedSharedPreferences`' value
 * scheme. Runs on the JVM with a locally generated key — production draws the
 * same kind of AES-256 key from the Android Keystore instead.
 */
class AesGcmValueCodecTest {

    private val key = KeyGenerator.getInstance("AES").apply { init(256) }.generateKey()
    private val codec = AesGcmValueCodec(key)

    @Test
    fun `round trips a token`() {
        val token = "17|kXqB2mZ9wPl4Tn8vRc1sYd6FgH0jKa3bN5eU7iOp"
        assertEquals(token, codec.decrypt(codec.encrypt(token)))
    }

    @Test
    fun `round trips empty and non-ascii values`() {
        assertEquals("", codec.decrypt(codec.encrypt("")))
        assertEquals("Ånand ♞ 王", codec.decrypt(codec.encrypt("Ånand ♞ 王")))
    }

    @Test
    fun `does not store the plaintext`() {
        val encrypted = codec.encrypt("auth-token-value")
        assertNotEquals("auth-token-value", encrypted)
        assertEquals(false, encrypted.contains("auth-token-value"))
    }

    @Test
    fun `draws a fresh iv per write so equal values differ`() {
        val first = codec.encrypt("same")
        val second = codec.encrypt("same")
        assertNotEquals(first, second)
        assertEquals("same", codec.decrypt(first))
        assertEquals("same", codec.decrypt(second))
    }

    @Test
    fun `returns null for a tampered value instead of throwing`() {
        val payload = Base64.getDecoder().decode(codec.encrypt("auth-token-value"))
        payload[payload.size - 1] = (payload[payload.size - 1] + 1).toByte()
        assertNull(codec.decrypt(Base64.getEncoder().encodeToString(payload)))
    }

    @Test
    fun `returns null for text this codec never wrote`() {
        assertNull(codec.decrypt("not base64 at all !!"))
        assertNull(codec.decrypt(Base64.getEncoder().encodeToString(ByteArray(4))))
        assertNull(codec.decrypt(""))
    }

    @Test
    fun `returns null under a different key`() {
        val other = AesGcmValueCodec(
            KeyGenerator.getInstance("AES").apply { init(256) }.generateKey(),
        )
        assertNull(other.decrypt(codec.encrypt("auth-token-value")))
    }
}
