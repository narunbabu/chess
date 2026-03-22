package com.chess99.presentation.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.chess99.presentation.auth.ForgotPasswordScreen
import com.chess99.presentation.auth.LoginScreen
import com.chess99.presentation.auth.RegisterScreen
import com.chess99.presentation.auth.ResetPasswordScreen
import com.chess99.presentation.auth.SkillAssessmentScreen
import com.chess99.presentation.championship.ChampionshipDetailScreen
import com.chess99.presentation.championship.ChampionshipInvitationsScreen
import com.chess99.presentation.championship.ChampionshipListScreen
import com.chess99.presentation.dashboard.DashboardScreen
import com.chess99.presentation.game.PlayComputerScreen
import com.chess99.presentation.game.PlayMultiplayerScreen
import com.chess99.presentation.history.GameHistoryScreen
import com.chess99.presentation.history.GameReviewScreen
import com.chess99.presentation.home.HomeScreen
import com.chess99.presentation.learn.LearnScreen
import com.chess99.presentation.learn.PuzzleScreen
import com.chess99.presentation.learn.TrainingExerciseScreen
import com.chess99.presentation.learn.TutorialLessonScreen
import com.chess99.presentation.lobby.LobbyScreen
import com.chess99.presentation.payment.PricingScreen
import com.chess99.presentation.payment.SubscriptionScreen
import com.chess99.presentation.profile.ProfileScreen
import com.chess99.presentation.referral.ReferralDashboardScreen
import com.chess99.presentation.game.PublicGameViewerScreen
import com.chess99.presentation.history.GameDetailScreen
import com.chess99.presentation.profile.RatingHistoryScreen
import com.chess99.presentation.social.LeaderboardScreen
import com.chess99.presentation.social.SharedResultScreen

@Composable
fun Chess99NavGraph(
    navController: NavHostController,
    startDestination: String,
) {
    NavHost(
        navController = navController,
        startDestination = startDestination,
    ) {
        // ── Auth ────────────────────────────────────────────────────────────
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToRegister = { navController.navigate(Screen.Register.route) },
                onNavigateToForgotPassword = { navController.navigate(Screen.ForgotPassword.route) },
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

        composable(Screen.ForgotPassword.route) {
            ForgotPasswordScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToResetPassword = { /* handled via deep link */ },
            )
        }

        composable(
            route = Screen.ResetPassword.route,
            arguments = listOf(
                navArgument("token") { type = NavType.StringType; defaultValue = "" },
                navArgument("email") { type = NavType.StringType; defaultValue = "" },
            ),
        ) { backStackEntry ->
            val token = backStackEntry.arguments?.getString("token") ?: ""
            val email = backStackEntry.arguments?.getString("email") ?: ""
            ResetPasswordScreen(
                token = token,
                email = email,
                onNavigateToLogin = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToForgotPassword = {
                    navController.navigate(Screen.ForgotPassword.route) {
                        popUpTo(Screen.Login.route)
                    }
                },
            )
        }

        composable(Screen.SkillAssessment.route) {
            SkillAssessmentScreen(
                onNavigateBack = { navController.popBackStack() },
                onComplete = {
                    navController.navigate(Screen.Home.route) {
                        popUpTo(Screen.SkillAssessment.route) { inclusive = true }
                    }
                },
            )
        }

        // ── Main ────────────────────────────────────────────────────────────
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

        // ── Game screens ────────────────────────────────────────────────────
        composable(Screen.PlayComputer.route) {
            PlayComputerScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.PlayMultiplayer.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) {
            PlayMultiplayerScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Lobby ───────────────────────────────────────────────────────────
        composable(Screen.Lobby.route) {
            LobbyScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToGame = { gameId ->
                    navController.navigate(Screen.PlayMultiplayer.createRoute(gameId))
                },
            )
        }

        // ── Learn ───────────────────────────────────────────────────────────
        composable(Screen.Learn.route) {
            LearnScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToLesson = { lessonId ->
                    navController.navigate(Screen.TutorialLesson.createRoute(lessonId))
                },
                onNavigateToPuzzles = {
                    navController.navigate(Screen.Puzzles.route)
                },
                onNavigateToTrainingExercise = { exerciseId ->
                    navController.navigate(Screen.TrainingExercise.createRoute(exerciseId))
                },
            )
        }

        composable(Screen.Puzzles.route) {
            PuzzleScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.TutorialLesson.route,
            arguments = listOf(navArgument("lessonId") { type = NavType.IntType }),
        ) { backStackEntry ->
            val lessonId = backStackEntry.arguments?.getInt("lessonId") ?: return@composable
            TutorialLessonScreen(
                lessonId = lessonId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        composable(
            route = Screen.TrainingExercise.route,
            arguments = listOf(navArgument("exerciseId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val exerciseId = backStackEntry.arguments?.getString("exerciseId") ?: ""
            TrainingExerciseScreen(
                exerciseId = exerciseId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Profile ─────────────────────────────────────────────────────────
        composable(Screen.Profile.route) {
            ProfileScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToReferrals = {
                    navController.navigate(Screen.ReferralDashboard.route)
                },
                onNavigateToRatingHistory = {
                    navController.navigate(Screen.RatingHistory.route)
                },
            )
        }

        // ── Championships ───────────────────────────────────────────────────
        composable(Screen.ChampionshipList.route) {
            ChampionshipListScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToDetail = { championshipId ->
                    navController.navigate(Screen.ChampionshipDetail.createRoute(championshipId))
                },
            )
        }

        composable(
            route = Screen.ChampionshipDetail.route,
            arguments = listOf(navArgument("id") { type = NavType.IntType }),
        ) { backStackEntry ->
            val championshipId = backStackEntry.arguments?.getInt("id") ?: return@composable
            ChampionshipDetailScreen(
                championshipId = championshipId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToGame = { gameId ->
                    navController.navigate(Screen.PlayMultiplayer.createRoute(gameId))
                },
            )
        }

        composable(Screen.ChampionshipInvitations.route) {
            ChampionshipInvitationsScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToChampionship = { championshipId ->
                    navController.navigate(Screen.ChampionshipDetail.createRoute(championshipId))
                },
            )
        }

        // ── Game History & Review ───────────────────────────────────────────
        composable(Screen.GameHistory.route) {
            GameHistoryScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToReview = { gameId ->
                    navController.navigate(Screen.GameDetail.createRoute(gameId))
                },
            )
        }

        composable(
            route = Screen.GameReview.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) {
            GameReviewScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Leaderboard ─────────────────────────────────────────────────────
        composable(Screen.Leaderboard.route) {
            LeaderboardScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Payment & Subscription ──────────────────────────────────────────
        composable(Screen.Pricing.route) {
            PricingScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToSubscription = {
                    navController.navigate(Screen.Subscription.route)
                },
            )
        }

        composable(Screen.Subscription.route) {
            SubscriptionScreen(
                onNavigateBack = { navController.popBackStack() },
                onNavigateToPricing = {
                    navController.navigate(Screen.Pricing.route)
                },
            )
        }

        // ── Referral ────────────────────────────────────────────────────────
        composable(Screen.ReferralDashboard.route) {
            ReferralDashboardScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Shared Result ───────────────────────────────────────────────────
        composable(
            route = Screen.SharedResult.route,
            arguments = listOf(navArgument("uniqueId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val uniqueId = backStackEntry.arguments?.getString("uniqueId") ?: ""
            SharedResultScreen(
                uniqueId = uniqueId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Rating History ──────────────────────────────────────────────────
        composable(Screen.RatingHistory.route) {
            RatingHistoryScreen(
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Game Detail ────────────────────────────────────────────────────
        composable(
            route = Screen.GameDetail.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getInt("gameId") ?: return@composable
            GameDetailScreen(
                gameId = gameId,
                onNavigateBack = { navController.popBackStack() },
                onNavigateToReview = { id ->
                    navController.navigate(Screen.GameReview.createRoute(id))
                },
            )
        }

        // ── Public Game Viewer ─────────────────────────────────────────────
        composable(
            route = Screen.PublicGameViewer.route,
            arguments = listOf(navArgument("gameId") { type = NavType.IntType }),
        ) { backStackEntry ->
            val gameId = backStackEntry.arguments?.getInt("gameId") ?: return@composable
            PublicGameViewerScreen(
                gameId = gameId,
                onNavigateBack = { navController.popBackStack() },
            )
        }

        // ── Dashboard ───────────────────────────────────────────────────────
        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onNavigateToPlayComputer = {
                    navController.navigate(Screen.PlayComputer.route)
                },
                onNavigateToLobby = {
                    navController.navigate(Screen.Lobby.route)
                },
                onNavigateToLearn = {
                    navController.navigate(Screen.Learn.route)
                },
                onNavigateToChampionships = {
                    navController.navigate(Screen.ChampionshipList.route)
                },
                onNavigateToGameHistory = {
                    navController.navigate(Screen.GameHistory.route)
                },
                onNavigateToGame = { gameId ->
                    navController.navigate(Screen.PlayMultiplayer.createRoute(gameId))
                },
                onNavigateToChampionship = { championshipId ->
                    navController.navigate(Screen.ChampionshipDetail.createRoute(championshipId))
                },
                onNavigateToReferrals = {
                    navController.navigate(Screen.ReferralDashboard.route)
                },
            )
        }
    }
}
