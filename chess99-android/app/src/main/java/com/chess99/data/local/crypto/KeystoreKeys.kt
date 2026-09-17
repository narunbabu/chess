package com.chess99.data.local.crypto

import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import java.security.KeyStore
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey

/**
 * The AES-256 key that [AesGcmValueCodec] uses, held in the Android Keystore so
 * the raw key material never reaches the app process or a backup.
 *
 * This replaces `MasterKey` from the deprecated `androidx.security:security-crypto`;
 * the generated key has the same shape the library's `AES256_GCM` scheme used —
 * AES-256, GCM, no padding, no user-authentication requirement (the app must be
 * able to refresh a token in the background).
 */
object KeystoreKeys {

    private const val PROVIDER = "AndroidKeyStore"
    private const val KEY_SIZE = 256

    /** Returns the existing key for [alias], generating it on first use. */
    fun getOrCreate(alias: String): SecretKey {
        val keyStore = KeyStore.getInstance(PROVIDER).apply { load(null) }
        (keyStore.getEntry(alias, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }
        return generate(alias)
    }

    /** Drops [alias] so the next [getOrCreate] mints a fresh key. */
    fun delete(alias: String) {
        runCatching {
            KeyStore.getInstance(PROVIDER).apply { load(null) }.deleteEntry(alias)
        }
    }

    private fun generate(alias: String): SecretKey {
        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, PROVIDER)
        generator.init(
            KeyGenParameterSpec.Builder(
                alias,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(KEY_SIZE)
                .setUserAuthenticationRequired(false)
                .build(),
        )
        return generator.generateKey()
    }
}
