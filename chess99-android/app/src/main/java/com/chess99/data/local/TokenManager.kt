package com.chess99.data.local

import android.content.Context
import com.chess99.data.local.crypto.SecurePreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * The signed-in session: auth token, user identity, age classification.
 *
 * Backed by [SecurePreferences] — an ordinary private preferences file with
 * AES-256-GCM encrypted values under an Android Keystore key. It used to be
 * `EncryptedSharedPreferences` from `androidx.security:security-crypto`, which
 * is deprecated; anything that store still holds is imported once, on first
 * construction, by [LegacyEncryptedPreferences] (the only remaining caller of
 * that library).
 */
@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val prefs: SecurePreferences by lazy {
        SecurePreferences.create(context, PREFS_NAME, KEY_ALIAS).also(::migrateLegacy)
    }

    private fun migrateLegacy(target: SecurePreferences) {
        target.putAll(LegacyEncryptedPreferences.drain(context))
    }

    fun saveToken(token: String) {
        prefs.putString(KEY_TOKEN, token)
    }

    fun getToken(): String? {
        return prefs.getString(KEY_TOKEN)
    }

    fun saveUserId(userId: Int) {
        prefs.putInt(KEY_USER_ID, userId)
    }

    fun getUserId(): Int {
        return prefs.getInt(KEY_USER_ID, -1)
    }

    fun saveUserName(name: String) {
        prefs.putString(KEY_USER_NAME, name)
    }

    fun getUserName(): String? {
        return prefs.getString(KEY_USER_NAME)
    }

    fun saveUserEmail(email: String) {
        prefs.putString(KEY_USER_EMAIL, email)
    }

    fun getUserEmail(): String? {
        return prefs.getString(KEY_USER_EMAIL)
    }

    fun saveIsMinor(isMinor: Boolean) {
        prefs.putBoolean(KEY_IS_MINOR, isMinor)
    }

    /**
     * Fail closed when an older session has no cached age classification.
     * The next current-user/auth response refreshes this value.
     */
    fun isMinor(): Boolean {
        return prefs.getBoolean(KEY_IS_MINOR, true)
    }

    fun isLoggedIn(): Boolean {
        return getToken() != null
    }

    fun clearAll() {
        prefs.clear()
    }

    companion object {
        private const val PREFS_NAME = "chess99_secure_prefs_v2"
        private const val KEY_ALIAS = "chess99_secure_prefs_key"

        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_IS_MINOR = "is_minor"
    }
}
