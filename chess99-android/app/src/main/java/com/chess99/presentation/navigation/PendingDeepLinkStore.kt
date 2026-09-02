package com.chess99.presentation.navigation

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Keeps an authenticated destination across the login flow and process
 * recreation. Password-reset tokens are never stored here because reset
 * destinations are handled immediately while logged out.
 */
@Singleton
class PendingDeepLinkStore @Inject constructor(
    @ApplicationContext context: Context,
) {
    private val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)

    fun save(route: String) {
        prefs.edit { putString(KEY_ROUTE, route) }
    }

    fun consume(): String? {
        val route = prefs.getString(KEY_ROUTE, null)
        prefs.edit { remove(KEY_ROUTE) }
        return route
    }

    companion object {
        private const val PREFS_NAME = "chess99_pending_navigation"
        private const val KEY_ROUTE = "route"
    }
}
