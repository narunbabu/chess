package com.chess99.presentation.navigation

sealed class Screen(val route: String) {
    // Auth
    data object Login : Screen("login")
    data object Register : Screen("register")

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

    // Tutorial
    data object TutorialModules : Screen("tutorial/modules")
    data object TutorialLesson : Screen("tutorial/lesson/{lessonId}") {
        fun createRoute(lessonId: Int) = "tutorial/lesson/$lessonId"
    }

    // Profile
    data object RatingHistory : Screen("rating_history")
    data object GameHistory : Screen("game_history")
    data object Leaderboard : Screen("leaderboard")
}
