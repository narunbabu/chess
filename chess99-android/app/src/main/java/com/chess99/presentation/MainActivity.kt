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
import com.chess99.presentation.navigation.Chess99NavGraph
import com.chess99.presentation.navigation.DeepLinkHandler
import com.chess99.presentation.navigation.Screen
import com.chess99.presentation.theme.Chess99Theme
import dagger.hilt.android.AndroidEntryPoint
import timber.log.Timber
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var tokenManager: TokenManager

    private var navController: NavHostController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()

        setContent {
            Chess99Theme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val nc = rememberNavController()
                    navController = nc

                    val startDestination = if (tokenManager.isLoggedIn()) {
                        Screen.Home.route
                    } else {
                        Screen.Login.route
                    }

                    Chess99NavGraph(
                        navController = nc,
                        startDestination = startDestination,
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
        navController?.let { handleDeepLinkIntent(intent, it) }
    }

    private fun handleDeepLinkIntent(intent: Intent, navController: NavHostController) {
        val uri = intent.data ?: return
        if (!tokenManager.isLoggedIn()) return

        val destination = DeepLinkHandler.handleDeepLink(uri)
        if (destination != null) {
            val route = DeepLinkHandler.destinationToRoute(destination)
            Timber.d("Deep link navigating to: $route")
            navController.navigate(route) {
                launchSingleTop = true
            }
        }
    }
}
