package com.chess99.data.local.crypto

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit

/**
 * A small encrypted key/value store: an ordinary private [SharedPreferences]
 * file whose *values* are AES-256-GCM ciphertext produced by a [ValueCodec].
 *
 * It is the replacement for `EncryptedSharedPreferences`, which shipped in
 * `androidx.security:security-crypto` and is deprecated — see
 * [com.chess99.data.local.LegacyEncryptedPreferences] for the one-time import
 * of anything that library already wrote.
 *
 * Two deliberate differences from the library it replaces:
 *
 * - **Keys are stored in the clear.** Ours are fixed, non-secret field names
 *   ("auth_token", "user_id", …); encrypting them bought deterministic-SIV
 *   complexity for no confidentiality here.
 * - **A value that cannot be decrypted reads as absent** instead of throwing.
 *   A rotated or invalidated Keystore key (device restore, "clear credentials")
 *   then logs the user out, which is exactly the fail-closed behaviour we want,
 *   rather than crashing every read.
 *
 * Every value is stored as a string; [getInt]/[getBoolean] parse on the way out.
 */
class SecurePreferences(
    private val prefs: SharedPreferences,
    private val codec: ValueCodec,
) {

    fun getString(key: String): String? {
        val stored = prefs.getString(key, null) ?: return null
        return codec.decrypt(stored)
    }

    fun putString(key: String, value: String) {
        prefs.edit { putString(key, codec.encrypt(value)) }
    }

    fun getInt(key: String, default: Int): Int =
        getString(key)?.toIntOrNull() ?: default

    fun putInt(key: String, value: Int) = putString(key, value.toString())

    fun getBoolean(key: String, default: Boolean): Boolean =
        getString(key)?.toBooleanStrictOrNull() ?: default

    fun putBoolean(key: String, value: Boolean) = putString(key, value.toString())

    fun clear() {
        prefs.edit { clear() }
    }

    /** Encrypts and stores [values] in one commit — used by the legacy import. */
    fun putAll(values: Map<String, String>) {
        if (values.isEmpty()) return
        prefs.edit {
            values.forEach { (key, value) -> putString(key, codec.encrypt(value)) }
        }
    }

    companion object {
        /**
         * Opens [fileName], encrypting with the Keystore key held under [keyAlias].
         *
         * If the Keystore entry has gone (device restore, credential reset) the
         * existing ciphertext is undecryptable dead weight, so it is wiped and a
         * fresh key minted rather than left to fail every read.
         */
        fun create(context: Context, fileName: String, keyAlias: String): SecurePreferences {
            val prefs = context.getSharedPreferences(fileName, Context.MODE_PRIVATE)
            val key = runCatching { KeystoreKeys.getOrCreate(keyAlias) }.getOrElse {
                KeystoreKeys.delete(keyAlias)
                prefs.edit { clear() }
                KeystoreKeys.getOrCreate(keyAlias)
            }
            return SecurePreferences(prefs, AesGcmValueCodec(key))
        }
    }
}
