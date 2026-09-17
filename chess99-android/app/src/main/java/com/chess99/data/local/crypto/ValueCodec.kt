package com.chess99.data.local.crypto

/**
 * Symmetric codec for a single preference value.
 *
 * Split out from [SecurePreferences] so the encryption format can be exercised
 * by a plain JVM unit test (no Android Keystore, no device), while production
 * gets the Keystore-backed [AesGcmValueCodec].
 */
interface ValueCodec {
    /** Encrypts [plain] into a storable, printable string. */
    fun encrypt(plain: String): String

    /**
     * Decrypts a value previously produced by [encrypt].
     *
     * Returns `null` — never throws — when the stored text is not something this
     * codec wrote, or can no longer decrypt (tampering, a rotated/invalidated
     * key, a restored backup). Callers treat that as "value absent".
     */
    fun decrypt(stored: String): String?
}
