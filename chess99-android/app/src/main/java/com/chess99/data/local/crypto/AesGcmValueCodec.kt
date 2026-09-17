package com.chess99.data.local.crypto

import java.security.GeneralSecurityException
import java.util.Base64
import javax.crypto.Cipher
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * AES-256-GCM value encryption, the scheme `EncryptedSharedPreferences` used for
 * values before `androidx.security:security-crypto` was deprecated.
 *
 * Stored form is `Base64(iv || ciphertextWithTag)`, standard Base64 without
 * padding-free tricks, using [java.util.Base64] (API 26+, and our minSdk is 26)
 * rather than `android.util.Base64` so this class is unit-testable off-device.
 *
 * A fresh random IV is drawn per write by the cipher itself — a GCM key must
 * never see the same IV twice, so we never pin one.
 */
class AesGcmValueCodec(private val key: SecretKey) : ValueCodec {

    override fun encrypt(plain: String): String {
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, key)
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(plain.toByteArray(Charsets.UTF_8))
        val payload = ByteArray(iv.size + ciphertext.size)
        iv.copyInto(payload)
        ciphertext.copyInto(payload, iv.size)
        return Base64.getEncoder().encodeToString(payload)
    }

    override fun decrypt(stored: String): String? {
        return try {
            val payload = Base64.getDecoder().decode(stored)
            if (payload.size <= IV_LENGTH) return null
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(
                Cipher.DECRYPT_MODE,
                key,
                GCMParameterSpec(TAG_LENGTH_BITS, payload, 0, IV_LENGTH),
            )
            val plain = cipher.doFinal(payload, IV_LENGTH, payload.size - IV_LENGTH)
            String(plain, Charsets.UTF_8)
        } catch (e: GeneralSecurityException) {
            null
        } catch (e: IllegalArgumentException) {
            // Not Base64 at all.
            null
        }
    }

    companion object {
        const val TRANSFORMATION = "AES/GCM/NoPadding"

        /** 12 bytes is the GCM-recommended IV size and what the platform emits. */
        const val IV_LENGTH = 12
        const val TAG_LENGTH_BITS = 128
    }
}
