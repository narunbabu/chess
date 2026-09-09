package com.chess99.presentation.navigation

sealed class Screen(val route: String) {
    // Onboarding (first-run only, pre-auth)
    data object Onboarding : Screen("onboarding")

    // Auth
    data object Login : Screen("login")
    data object Register : Screen("register?referralCode={referralCode}") {
        const val BASE_ROUTE = "register"
        fun createRoute(referralCode: String? = null): String =
            if (referralCode.isNullOrBlank()) {
                BASE_ROUTE
            } else {
                "$BASE_ROUTE?referralCode=${android.net.Uri.encode(referralCode)}"
            }
    }
    data object ForgotPassword : Screen("forgot_password")
    data object ResetPassword : Screen("reset_password?token={token}&email={email}") {
        fun createRoute(token: String, email: String) =
            "reset_password?token=${android.net.Uri.encode(token)}&email=${android.net.Uri.encode(email)}"
    }
    data object SkillAssessment : Screen("skill_assessment")

    // Main tabs
    data object Home : Screen("home")
    // Optional `tab` query param (T2): a Nearby Opponents real-player tap
    // lands directly on the Matchmaking tab instead of the default Players
    // tab. Absent/unrecognized values fall back to Players — see LobbyScreen.
    data object Lobby : Screen("lobby?tab={tab}") {
        const val BASE_ROUTE = "lobby"
        fun createRoute(tab: String? = null) = if (tab != null) "lobby?tab=$tab" else BASE_ROUTE
    }
    data object Learn : Screen("learn")
    data object Profile : Screen("profile")
    data object Progress : Screen("progress")

    // Game
    data object PlayComputer : Screen("play_computer")
    data object PlayMultiplayer : Screen("play_multiplayer/{gameId}") {
        fun createRoute(gameId: Int) = "play_multiplayer/$gameId"
    }
    data object GameReview : Screen("game_review/{gameId}") {
        fun createRoute(gameId: Int) = "game_review/$gameId"
    }
    data object LocalGameReview : Screen("local_game_review")

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
    // TrainingExercise removed (S14): "Endgame Drills" / "Opening Explorer"
    // were stubs — backend 422s the practice-game call, VM swallowed the
    // failure and showed a starting-position board that marked any legal
    // move "Good move!". Real drills are a post-v1 content project.
    data object TacticalTrainer : Screen("tactical_trainer")

    // Profile
    data object RatingHistory : Screen("rating_history")
    data object GameHistory : Screen("game_history")
    data object Leaderboard : Screen("leaderboard")

    // Subscription (status only — no in-app purchases in v1)
    data object Subscription : Screen("subscription")

    // Social
    data object ReferralDashboard : Screen("referrals")
    data object MyKids : Screen("parent")
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

    // Daily Challenges
    data object DailyChallenges : Screen("daily_challenges")

    // Organizations
    data object Organizations : Screen("organizations")

    // Ambassador program
    data object AmbassadorDashboard : Screen("ambassador")
    data object BecomeAmbassador : Screen("become_ambassador")

    // Content & Legal
    // Ebook: post-v1: native reader — no NavGraph destination in v1 (removed;
    // was a WebView pointed at a URL that never rendered inside WebView).
    // Kept defined so any lingering reference elsewhere still compiles.
    data object Ebook : Screen("ebook")
    data object Privacy : Screen("privacy")
    data object Terms : Screen("terms")
    data object OpenSourceLicenses : Screen("open_source_licenses")
}
