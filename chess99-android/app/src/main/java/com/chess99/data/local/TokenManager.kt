package com.chess99.data.local

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TokenManager @Inject constructor(
    @ApplicationContext private val context: Context,
) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs: SharedPreferences = EncryptedSharedPreferences.create(
        context,
        "chess99_secure_prefs",
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun saveToken(token: String) {
        prefs.edit { putString(KEY_TOKEN, token) }
    }

    fun getToken(): String? {
        return prefs.getString(KEY_TOKEN, null)
    }

    fun saveUserId(userId: Int) {
        prefs.edit { putInt(KEY_USER_ID, userId) }
    }

    fun getUserId(): Int {
        return prefs.getInt(KEY_USER_ID, -1)
    }

    fun saveUserName(name: String) {
        prefs.edit { putString(KEY_USER_NAME, name) }
    }

    fun getUserName(): String? {
        return prefs.getString(KEY_USER_NAME, null)
    }

    fun saveUserEmail(email: String) {
        prefs.edit { putString(KEY_USER_EMAIL, email) }
    }

    fun getUserEmail(): String? {
        return prefs.getString(KEY_USER_EMAIL, null)
    }

    fun saveIsMinor(isMinor: Boolean) {
        prefs.edit { putBoolean(KEY_IS_MINOR, isMinor) }
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
        prefs.edit { clear() }
    }

    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
        private const val KEY_USER_EMAIL = "user_email"
        private const val KEY_IS_MINOR = "is_minor"
    }
}
