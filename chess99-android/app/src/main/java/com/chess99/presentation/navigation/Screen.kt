package com.chess99.presentation.navigation

sealed class Screen(val route: String) {
    // Auth
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object ForgotPassword : Screen("forgot_password")
    data object ResetPassword : Screen("reset_password?token={token}&email={email}") {
        fun createRoute(token: String, email: String) =
            "reset_password?token=$token&email=$email"
    }
    data object SkillAssessment : Screen("skill_assessment")

    // Main tabs
    data object Home : Screen("home")
    data object Lobby : Screen("lobby")
    data object Learn : Screen("learn")
    data object Profile : Screen("profile")

    // Game
    data object PlayComputer : Screen("play_computer")
    data object PlayMultiplayer : Screen("play_multiplayer/{gameId}") {
        fun createRoute(gameId: Int) = "play_multiplayer/$gameId"
    }
    data object GameReview : Screen("game_review/{gameId}") {
        fun createRoute(gameId: Int) = "game_review/$gameId"
    }

    // Championship
    data object ChampionshipList : Screen("championships")
    data object ChampionshipDetail : Screen("championships/{id}") {
        fun createRoute(id: Int) = "championships/$id"
    }
    data object ChampionshipInvitations : Screen("championship_invitations")

    // Tutorial & Learning
    data object TutorialModules : Screen("tutorial/modules")
    data object TutorialLesson : Screen("tutorial/lesson/{lessonId}") {
        fun createRoute(lessonId: Int) = "tutorial/lesson/$lessonId"
    }
    data object Puzzles : Screen("puzzles")
    data object TrainingExercise : Screen("training/{exerciseId}") {
        fun createRoute(exerciseId: String) = "training/$exerciseId"
    }

    // Profile
    data object RatingHistory : Screen("rating_history")
    data object GameHistory : Screen("game_history")
    data object Leaderboard : Screen("leaderboard")

    // Payment & Subscription
    data object Pricing : Screen("pricing")
    data object Subscription : Screen("subscription")

    // Social
    data object ReferralDashboard : Screen("referrals")
    data object SharedResult : Screen("shared_result/{uniqueId}") {
        fun createRoute(uniqueId: String) = "shared_result/$uniqueId"
    }

    // Game Detail & Public Viewer
    data object GameDetail : Screen("game_detail/{gameId}") {
        fun createRoute(gameId: Int) = "game_detail/$gameId"
    }
    data object PublicGameViewer : Screen("public_game/{gameId}") {
        fun createRoute(gameId: Int) = "public_game/$gameId"
    }

    // Dashboard
    data object Dashboard : Screen("dashboard")
}
