@file:Suppress("DEPRECATION")

package com.chess99.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import timber.log.Timber
import java.io.File

/**
 * One-time reader for the `androidx.security:security-crypto` preferences file
 * [TokenManager] used before it moved to [com.chess99.data.local.crypto.SecurePreferences].
 *
 * The whole library is deprecated (it is `1.1.0` stable and going no further),
 * which is why every remaining call to it is confined to this file behind a
 * file-level `@Suppress("DEPRECATION")`: no other source in the app references
 * `EncryptedSharedPreferences` or `MasterKey`, so the compiler warning is gone
 * from the code we actually maintain.
 *
 * This file — and the `libs.security.crypto` dependency with it — can be deleted
 * once a release carrying the migration has been in users' hands long enough
 * that nobody is still holding a session written by the old format. Deleting it
 * sooner only costs a re-login, never data.
 */
object LegacyEncryptedPreferences {

    const val FILE_NAME = "chess99_secure_prefs"

    /**
     * Reads everything the old store holds, as strings, then removes the file so
     * the import can only ever run once.
     *
     * Returns an empty map when there is nothing to migrate, including when the
     * old master key can no longer open the file — a session we cannot read is
     * a session the user has to re-establish, and that must not crash startup.
     */
    fun drain(context: Context): Map<String, String> {
        if (!exists(context)) return emptyMap()

        val values = try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()
            val prefs = EncryptedSharedPreferences.create(
                context,
                FILE_NAME,
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
            prefs.all.mapNotNull { (key, value) ->
                value?.let { key to it.toString() }
            }.toMap()
        } catch (e: Exception) {
            Timber.w(e, "Could not read legacy encrypted prefs; discarding them")
            emptyMap()
        }

        delete(context)
        return values
    }

    /**
     * Checked on disk rather than by opening the store: `create()` would build
     * the file (and a master key) for a user who never had one.
     */
    private fun exists(context: Context): Boolean =
        File(File(context.applicationInfo.dataDir, "shared_prefs"), "$FILE_NAME.xml").exists()

    private fun delete(context: Context) {
        runCatching { context.deleteSharedPreferences(FILE_NAME) }
            .onFailure { Timber.w(it, "Could not delete legacy encrypted prefs") }
    }
}
