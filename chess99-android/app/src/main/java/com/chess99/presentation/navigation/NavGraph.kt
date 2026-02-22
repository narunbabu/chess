package com.chess99.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.chess99.presentation.auth.LoginScreen
import com.chess99.presentation.auth.RegisterScreen
import com.chess99.presentation.game.PlayComputerScreen
import com.chess99.presentation.home.HomeScreen

@Composable
fun Chess99NavGraph(
    navController: NavHostController,
    startDestination: String,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        // Auth
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                onLoginSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToLogin = { navController.popBackStack() },
                onRegisterSuccess = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
            )
        }

        // Main
        composable(Screen.Home.route) {
            HomeScreen(
                onNavigateToPlayComputer = {
                    navController.navigate(Screen.PlayComputer.route)
                },
                onNavigateToLobby = {
                    navController.navigate(Screen.Lobby.route)
                },
                onNavigateToLearn = {
                    navController.navigate(Screen.Learn.route)
                },
                onNavigateToProfile = {
                    navController.navigate(Screen.Profile.route)
                },
                onNavigateToGame = { gameId ->
                    navController.navigate(Screen.PlayMultiplayer.createRoute(gameId))
                },
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
            )
        }

        // Placeholder screens — will be implemented in later phases
        composable(Screen.PlayComputer.route) {
            PlayComputerScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.PlayMultiplayer.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) {
            // Phase 3: PlayMultiplayerScreen
            PlaceholderScreen("Multiplayer Game")
        }

        composable(Screen.Lobby.route) {
            // Phase 3: LobbyScreen
            PlaceholderScreen("Game Lobby")
        }

        composable(Screen.Learn.route) {
            // Phase 6: TutorialModulesScreen
            PlaceholderScreen("Learn Chess")
        }

        composable(Screen.Profile.route) {
            // Phase 4: ProfileScreen
            PlaceholderScreen("Profile")
        }

        composable(Screen.ChampionshipList.route) {
            // Phase 5: ChampionshipListScreen
            PlaceholderScreen("Tournaments")
        }

        composable(
            route = Screen.GameReview.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) {
            // Phase 4: GameReviewScreen
            PlaceholderScreen("Game Review")
        }

        composable(Screen.GameHistory.route) {
            PlaceholderScreen("Game History")
        }

        composable(Screen.Leaderboard.route) {
            PlaceholderScreen("Leaderboard")
        }
    }
}

@Composable
private fun PlaceholderScreen(title: String) {
    androidx.compose.foundation.layout.Box(
        modifier = androidx.compose.ui.Modifier.fillMaxSize(),
        contentAlignment = androidx.compose.ui.Alignment.Center,
    ) {
        androidx.compose.material3.Text(
            text = "$title\n(Coming Soon)",
            style = androidx.compose.material3.MaterialTheme.typography.headlineMedium,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
    }
}

private fun androidx.compose.ui.Modifier.fillMaxSize() =
    this.then(androidx.compose.foundation.layout.Modifier.fillMaxSize())
