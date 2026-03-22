package com.chess99.presentation.navigation

import android.net.Uri
import timber.log.Timber

/**
 * Deep link handler for Chess99.
 *
 * Parses both custom-scheme and web URLs into navigation destinations:
 *
 * Custom scheme:
 *   - chess99://game/{id}       -> PlayMultiplayer(gameId)
 *   - chess99://tournament/{id} -> ChampionshipDetail(id)
 *   - chess99://lobby           -> Lobby
 *   - chess99://profile         -> Profile
 *   - chess99://learn           -> Learn
 *
 * Web URLs:
 *   - https://chess99.com/game/{id}           -> PlayMultiplayer(gameId)
 *   - https://chess99.com/tournament/{id}     -> ChampionshipDetail(id)
 *   - https://chess99.com/lobby               -> Lobby
 *   - https://chess99.com/profile             -> Profile
 *   - https://chess99.com/learn               -> Learn
 *   - https://chess99.com/championships       -> ChampionshipList
 *   - https://chess99.com/join/{code}         -> ReferralJoin(code)
 *   - https://chess99.com/share/result/{id}   -> SharedResult(uniqueId)
 *   - https://chess99.com/reset-password?...  -> ResetPassword(token, email)
 *   - https://chess99.com/referrals           -> ReferralDashboard
 *   - https://chess99.com/puzzles             -> Puzzles
 *   - https://chess99.com/pricing             -> Pricing
 *   - https://chess99.com/                    -> Home
 *
 * Usage:
 *   In MainActivity, call handleDeepLink(intent.data) on incoming intents
 *   and navigate to the returned [DeepLinkDestination].
 */
object DeepLinkHandler {

    /**
     * Parse a [Uri] into a [DeepLinkDestination], or null if the URI
     * doesn't match any known pattern.
     */
    fun handleDeepLink(uri: Uri?): DeepLinkDestination? {
        if (uri == null) return null

        Timber.d("Handling deep link: $uri")

        val scheme = uri.scheme?.lowercase()
        val host = uri.host?.lowercase()
        val pathSegments = uri.pathSegments

        return when {
            // ── Custom scheme: chess99:// ─────────────────────────
            scheme == "chess99" -> parseCustomScheme(host, pathSegments, uri)

            // ── Web URL: https://chess99.com/... ──────────────────
            scheme in listOf("http", "https") && host == "chess99.com" ->
                parseWebUrl(pathSegments, uri)

            else -> {
                Timber.w("Unknown deep link scheme/host: $uri")
                null
            }
        }
    }

    /**
     * Build a [Screen] route string from a deep link destination.
     * Used by NavGraph to navigate after parsing.
     */
    fun destinationToRoute(destination: DeepLinkDestination): String {
        return when (destination) {
            is DeepLinkDestination.Game ->
                Screen.PlayMultiplayer.createRoute(destination.gameId)
            is DeepLinkDestination.Tournament ->
                Screen.ChampionshipDetail.createRoute(destination.championshipId)
            is DeepLinkDestination.Lobby -> Screen.Lobby.route
            is DeepLinkDestination.ProfilePage -> Screen.Profile.route
            is DeepLinkDestination.LearnPage -> Screen.Learn.route
            is DeepLinkDestination.ChampionshipListPage -> Screen.ChampionshipList.route
            is DeepLinkDestination.HomePage -> Screen.Home.route
            is DeepLinkDestination.GameReviewPage ->
                Screen.GameReview.createRoute(destination.gameId)
            is DeepLinkDestination.ReferralJoin ->
                Screen.Register.route // Navigate to register with code stored
            is DeepLinkDestination.SharedResultPage ->
                Screen.SharedResult.createRoute(destination.uniqueId)
            is DeepLinkDestination.ResetPasswordPage ->
                Screen.ResetPassword.createRoute(destination.token, destination.email)
            is DeepLinkDestination.ReferralDashboardPage ->
                Screen.ReferralDashboard.route
            is DeepLinkDestination.PuzzlesPage -> Screen.Puzzles.route
            is DeepLinkDestination.PricingPage -> Screen.Pricing.route
            is DeepLinkDestination.PublicGamePage ->
                Screen.PublicGameViewer.createRoute(destination.gameId)
        }
    }

    // ── Private Parsers ──────────────────────────────────────────────────

    private fun parseCustomScheme(
        host: String?,
        pathSegments: List<String>,
        uri: Uri,
    ): DeepLinkDestination? {
        return when (host) {
            "game" -> {
                val gameId = pathSegments.firstOrNull()?.toIntOrNull()
                    ?: uri.getQueryParameter("id")?.toIntOrNull()
                if (gameId != null) DeepLinkDestination.Game(gameId) else null
            }
            "tournament" -> {
                val id = pathSegments.firstOrNull()?.toIntOrNull()
                    ?: uri.getQueryParameter("id")?.toIntOrNull()
                if (id != null) DeepLinkDestination.Tournament(id) else null
            }
            "lobby" -> DeepLinkDestination.Lobby
            "profile" -> DeepLinkDestination.ProfilePage
            "learn" -> DeepLinkDestination.LearnPage
            "home" -> DeepLinkDestination.HomePage
            "referrals" -> DeepLinkDestination.ReferralDashboardPage
            "puzzles" -> DeepLinkDestination.PuzzlesPage
            else -> {
                Timber.w("Unknown custom scheme host: $host")
                null
            }
        }
    }

    private fun parseWebUrl(
        pathSegments: List<String>,
        uri: Uri,
    ): DeepLinkDestination? {
        if (pathSegments.isEmpty()) return DeepLinkDestination.HomePage

        return when (pathSegments[0]) {
            "game" -> {
                val gameId = pathSegments.getOrNull(1)?.toIntOrNull()
                    ?: uri.getQueryParameter("id")?.toIntOrNull()
                if (gameId != null) DeepLinkDestination.Game(gameId) else null
            }
            "tournament", "championships" -> {
                val id = pathSegments.getOrNull(1)?.toIntOrNull()
                if (id != null) {
                    DeepLinkDestination.Tournament(id)
                } else {
                    DeepLinkDestination.ChampionshipListPage
                }
            }
            "lobby" -> DeepLinkDestination.Lobby
            "profile" -> DeepLinkDestination.ProfilePage
            "learn" -> DeepLinkDestination.LearnPage
            "review" -> {
                val gameId = pathSegments.getOrNull(1)?.toIntOrNull()
                if (gameId != null) DeepLinkDestination.GameReviewPage(gameId) else null
            }
            "join" -> {
                val code = pathSegments.getOrNull(1)
                if (code != null) DeepLinkDestination.ReferralJoin(code) else null
            }
            "share" -> {
                if (pathSegments.getOrNull(1) == "result") {
                    val uniqueId = pathSegments.getOrNull(2)
                    if (uniqueId != null) DeepLinkDestination.SharedResultPage(uniqueId) else null
                } else null
            }
            "reset-password" -> {
                val token = uri.getQueryParameter("token") ?: ""
                val email = uri.getQueryParameter("email") ?: ""
                if (token.isNotBlank()) DeepLinkDestination.ResetPasswordPage(token, email) else null
            }
            "referrals" -> DeepLinkDestination.ReferralDashboardPage
            "puzzles" -> DeepLinkDestination.PuzzlesPage
            "pricing" -> DeepLinkDestination.PricingPage
            "play" -> {
                // https://chess99.com/play/public/{gameId}
                if (pathSegments.getOrNull(1) == "public") {
                    val gameId = pathSegments.getOrNull(2)?.toIntOrNull()
                    if (gameId != null) DeepLinkDestination.PublicGamePage(gameId) else null
                } else null
            }
            else -> {
                Timber.w("Unknown web path: ${pathSegments[0]}")
                null
            }
        }
    }
}

/**
 * Sealed class representing all deep-link destinations in Chess99.
 * Maps 1-to-1 with [Screen] routes.
 */
sealed class DeepLinkDestination {
    /** Navigate to a specific multiplayer game. */
    data class Game(val gameId: Int) : DeepLinkDestination()

    /** Navigate to a specific tournament / championship detail. */
    data class Tournament(val championshipId: Int) : DeepLinkDestination()

    /** Navigate to the lobby / matchmaking screen. */
    data object Lobby : DeepLinkDestination()

    /** Navigate to the user profile screen. */
    data object ProfilePage : DeepLinkDestination()

    /** Navigate to the learn / tutorials screen. */
    data object LearnPage : DeepLinkDestination()

    /** Navigate to the championships list. */
    data object ChampionshipListPage : DeepLinkDestination()

    /** Navigate to the home / dashboard screen. */
    data object HomePage : DeepLinkDestination()

    /** Navigate to a game review. */
    data class GameReviewPage(val gameId: Int) : DeepLinkDestination()

    /** Handle referral code join link — store code and navigate to register. */
    data class ReferralJoin(val code: String) : DeepLinkDestination()

    /** View a shared game result. */
    data class SharedResultPage(val uniqueId: String) : DeepLinkDestination()

    /** Handle reset password deep link with token and email. */
    data class ResetPasswordPage(val token: String, val email: String) : DeepLinkDestination()

    /** Navigate to the referral dashboard. */
    data object ReferralDashboardPage : DeepLinkDestination()

    /** Navigate to the puzzles screen. */
    data object PuzzlesPage : DeepLinkDestination()

    /** Navigate to the pricing screen. */
    data object PricingPage : DeepLinkDestination()

    /** View a public game replay. */
    data class PublicGamePage(val gameId: Int) : DeepLinkDestination()
}
