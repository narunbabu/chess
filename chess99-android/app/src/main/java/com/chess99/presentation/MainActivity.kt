package com.chess99.presentation

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.rememberNavController
import com.chess99.data.local.TokenManager
import com.chess99.presentation.auth.FacebookSignInHelper
import com.chess99.presentation.navigation.Chess99NavGraph
import com.chess99.presentation.navigation.DeepLinkHandler
import com.chess99.presentation.navigation.PendingDeepLinkStore
import com.chess99.presentation.navigation.Screen
import com.chess99.presentation.navigation.requiresAuthentication
import com.chess99.presentation.onboarding.OnboardingPreferences
import com.chess99.presentation.theme.Chess99Theme
import dagger.hilt.android.AndroidEntryPoint
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    @Inject
    lateinit var onboardingPreferences: OnboardingPreferences

    @Inject
    lateinit var facebookSignInHelper: FacebookSignInHelper

    @Inject
    lateinit var pendingDeepLinkStore: PendingDeepLinkStore

    private var navController: NavHostController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            Chess99Theme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val nc = rememberNavController()
                    navController = nc

                    // T2 (S7): authenticated -> Home; not authenticated and the
                    // first-run pager hasn't been seen yet -> Onboarding;
                    // otherwise (returning, not-yet-authenticated user) -> Login.
                    val startDestination = when {
                        tokenManager.isLoggedIn() -> Screen.Home.route
                        !onboardingPreferences.hasSeenOnboarding() -> Screen.Onboarding.route
                        else -> Screen.Login.route
                    }

                    Chess99NavGraph(
                        navController = nc,
                        startDestination = startDestination,
                        consumePendingDeepLink = pendingDeepLinkStore::consume,
                    )

                    // Handle deep link from launch intent
                    LaunchedEffect(Unit) {
                        handleDeepLinkIntent(intent, nc)
                    }
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        navController?.let { handleDeepLinkIntent(intent, it) }
    }

    @Deprecated("Used by Facebook SDK callback forwarding")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        facebookSignInHelper.callbackManager.onActivityResult(requestCode, resultCode, data)
    }

    private fun handleDeepLinkIntent(intent: Intent, navController: NavHostController) {
        val uri = intent.data ?: return

        val destination = DeepLinkHandler.handleDeepLink(uri)
        if (destination != null) {
            val route = DeepLinkHandler.destinationToRoute(destination)
            if (!tokenManager.isLoggedIn() && destination.requiresAuthentication()) {
                pendingDeepLinkStore.save(route)
                navController.navigate(Screen.Login.route) {
                    launchSingleTop = true
                }
                return
            }
            Timber.d("Deep link navigating to: $route")
            navController.navigate(route) {
                launchSingleTop = true
            }
        }
    }
}
