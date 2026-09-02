package com.chess99.presentation.onboarding

import android.content.Context
import android.content.SharedPreferences
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tiny local-only store for the "has this device seen the first-run
 * onboarding pager" flag.
 *
 * Deliberately NOT part of [com.chess99.presentation.common.FeatureFlagManager]:
 * that class caches *remote* feature flags and its `saveToPrefs()` clears any
 * `flag_`-prefixed key not present in the latest `/health` response on every
 * refresh (startup + every 30 min) — folding `onboarding_seen` into it would
 * get the flag silently wiped shortly after being set. This class owns a
 * dedicated SharedPreferences file instead, mirroring the plain
 * SharedPreferences pattern used elsewhere for local-only state.
 */
@Singleton
class OnboardingPreferences @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    /** True once the user has left the onboarding pager by any path (including Skip). */
    fun hasSeenOnboarding(): Boolean = prefs.getBoolean(KEY_ONBOARDING_SEEN, false)

    fun markOnboardingSeen() {
        prefs.edit { putBoolean(KEY_ONBOARDING_SEEN, true) }
    }

    companion object {
        private const val PREFS_NAME = "chess99_onboarding_prefs"
        private const val KEY_ONBOARDING_SEEN = "onboarding_seen"
    }
}
