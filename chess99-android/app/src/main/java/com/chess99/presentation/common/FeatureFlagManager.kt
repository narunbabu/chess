package com.chess99.presentation.common

import android.content.Context
import android.content.SharedPreferences
import com.chess99.data.api.AuthApi
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Feature flag management system.
 *
 * Reads the `features` map from the /health endpoint response
 * ([com.chess99.data.dto.HealthResponse.features]) and caches
 * flags both in-memory and in SharedPreferences for offline access.
 *
 * Known flags:
 *   - multiplayer_enabled
 *   - tournaments_enabled
 *   - payments_enabled
 *   - chat_enabled
 *   - ai_analysis_enabled
 *
 * Refresh strategy:
 *   - On app startup (called from init)
 *   - Every 30 minutes via background coroutine
 *   - On-demand via [refreshFlags]
 */
@Singleton
class FeatureFlagManager @Inject constructor(
    private val authApi: AuthApi,
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    /**
     * In-memory cache of feature flags.
     * Thread-safe via volatile + immutable map replacement.
     */
    @Volatile
    private var flags: Map<String, Boolean> = loadFromPrefs()

    init {
        // Initial refresh on creation
        scope.launch { fetchFlags() }

        // Periodic refresh every 30 minutes
        scope.launch {
            while (isActive) {
                delay(REFRESH_INTERVAL_MS)
                fetchFlags()
            }
        }
    }

    // ── Public API ───────────────────────────────────────────────────────

    /**
     * Check whether a feature flag is enabled.
     * Returns `false` if the flag is not known or not yet fetched.
     */
    fun isEnabled(flag: String): Boolean {
        return flags[flag] ?: false
    }

    /**
     * Get all known flags as an immutable map.
     */
    fun getAllFlags(): Map<String, Boolean> = flags.toMap()

    /**
     * Manually trigger a flag refresh from the server.
     */
    fun refreshFlags() {
        scope.launch { fetchFlags() }
    }

    // ── Internal ─────────────────────────────────────────────────────────

    private suspend fun fetchFlags() {
        try {
            val response = authApi.getHealth()
            if (response.isSuccessful) {
                val healthResponse = response.body()
                val newFlags = healthResponse?.features ?: emptyMap()

                if (newFlags.isNotEmpty()) {
                    flags = newFlags
                    saveToPrefs(newFlags)
                    Timber.d("Feature flags refreshed: $newFlags")
                }
            } else {
                Timber.w("Health endpoint returned ${response.code()}, using cached flags")
            }
        } catch (e: Exception) {
            Timber.e(e, "Failed to fetch feature flags, using cached values")
        }
    }

    private fun loadFromPrefs(): Map<String, Boolean> {
        val result = mutableMapOf<String, Boolean>()
        val all = prefs.all
        for ((key, value) in all) {
            if (key.startsWith(FLAG_PREFIX) && value is Boolean) {
                result[key.removePrefix(FLAG_PREFIX)] = value
            }
        }
        Timber.d("Loaded ${result.size} cached feature flags")
        return result
    }

    private fun saveToPrefs(newFlags: Map<String, Boolean>) {
        val editor = prefs.edit()
        // Clear old flags
        prefs.all.keys
            .filter { it.startsWith(FLAG_PREFIX) }
            .forEach { editor.remove(it) }
        // Write new flags
        for ((key, value) in newFlags) {
            editor.putBoolean("$FLAG_PREFIX$key", value)
        }
        editor.apply()
    }

    companion object {
        private const val PREFS_NAME = "chess99_feature_flags"
        private const val FLAG_PREFIX = "flag_"
        private const val REFRESH_INTERVAL_MS = 30L * 60L * 1000L // 30 minutes

        // Known flag keys for compile-time safety
        const val FLAG_MULTIPLAYER_ENABLED = "multiplayer_enabled"
        const val FLAG_TOURNAMENTS_ENABLED = "tournaments_enabled"
        const val FLAG_PAYMENTS_ENABLED = "payments_enabled"
        const val FLAG_CHAT_ENABLED = "chat_enabled"
        const val FLAG_AI_ANALYSIS_ENABLED = "ai_analysis_enabled"
    }
}
