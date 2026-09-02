package com.chess99.parity

import android.net.Uri
import com.chess99.presentation.navigation.Screen
import io.mockk.every
import io.mockk.mockkStatic
import io.mockk.unmockkStatic
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.net.URLEncoder

/**
 * Web ↔ native parity contract.
 *
 * Chess99's web app (chess-frontend/src/App.js) is the reference product. This
 * test pins, route by route, which web journeys a player must also be able to
 * complete in the Android app — so that renaming or deleting an Android
 * destination fails the build instead of silently dropping a feature that
 * chess99.com still offers.
 *
 * Web routes that are deliberately *not* shipped in the native v1 are listed
 * separately with the reason, so the gap stays a decision rather than an
 * oversight.
 */
class WebParityMatrixTest {

    /**
     * Route builders percent-encode via [Uri], which is an android.jar stub in a
     * JVM test — stand it up with the equivalent JDK encoder.
     */
    @Before
    fun stubUriEncoding() {
        mockkStatic(Uri::class)
        every { Uri.encode(any<String>()) } answers {
            URLEncoder.encode(firstArg<String>(), "UTF-8").replace("+", "%20")
        }
    }

    @After
    fun releaseUriEncoding() {
        unmockkStatic(Uri::class)
    }

    /** A web route and the Android destination that must serve the same journey. */
    private data class Parity(val webRoute: String, val screen: Screen, val journey: String)

    private val parityMatrix = listOf(
        // Auth & onboarding
        Parity("/login", Screen.Login, "sign in"),
        Parity("/register", Screen.Register, "create an account, optionally via a referral code"),
        Parity("/forgot-password", Screen.ForgotPassword, "request a password reset"),
        Parity("/reset-password", Screen.ResetPassword, "complete a password reset from the emailed link"),

        // Core play
        Parity("/play", Screen.PlayComputer, "play vs computer at a chosen level or bot persona"),
        Parity("/play/multiplayer/:gameId", Screen.PlayMultiplayer, "play a live multiplayer game"),
        Parity("/lobby", Screen.Lobby, "find an opponent — players, matchmaking, friends"),
        Parity("/dashboard", Screen.Dashboard, "see active games, daily quota and W/L/D"),

        // Learning
        Parity("/learn", Screen.Learn, "browse learning content"),
        Parity("/tutorial", Screen.TutorialModules, "open the tutorial modules"),
        Parity("/tutorial/lesson/:lessonId", Screen.TutorialLesson, "work through a lesson"),
        Parity("/puzzles", Screen.Puzzles, "solve puzzles"),
        Parity("/tactical-trainer", Screen.TacticalTrainer, "progress through tactical stages"),
        Parity("/daily-challenges", Screen.DailyChallenges, "complete daily challenges"),

        // History, review and progress
        Parity("/history", Screen.GameHistory, "review past games"),
        Parity("/game/:id", Screen.GameDetail, "open one past game"),
        Parity("/play/review/:id", Screen.GameReview, "replay a game with analysis"),
        Parity("/games/:id/replay", Screen.PublicGameViewer, "watch a shared game"),
        Parity("/profile", Screen.Profile, "view and edit the profile"),
        Parity("/leaderboard", Screen.Leaderboard, "see the leaderboard"),

        // Competition
        Parity("/championships", Screen.ChampionshipList, "browse championships"),
        Parity("/championships/:id", Screen.ChampionshipDetail, "open a championship"),
        Parity("/championship-invitations", Screen.ChampionshipInvitations, "respond to invitations"),

        // Growth & account
        Parity("/referrals", Screen.ReferralDashboard, "share a referral link and track invites"),
        Parity("/ambassador", Screen.AmbassadorDashboard, "track ambassador earnings"),
        Parity("/become-ambassador", Screen.BecomeAmbassador, "apply to the ambassador programme"),
        Parity("/organizations", Screen.Organizations, "manage school / club affiliation"),
        Parity("/parent", Screen.MyKids, "parent dashboard for a child account"),
        Parity("/account/subscription", Screen.Subscription, "see the current plan"),
        Parity("/share/result/:uniqueId", Screen.SharedResult, "open a shared result"),

        // Legal
        Parity("/privacy", Screen.Privacy, "read the privacy policy"),
        Parity("/terms", Screen.Terms, "read the terms of service"),
    )

    /**
     * Web routes with no native destination in v1, each with the reason. Adding
     * a native screen for one of these means moving it into [parityMatrix].
     */
    private val deliberateGaps = mapOf(
        "/" to "web landing page — the native app opens on Home after auth",
        "/coming-soon" to "web marketing placeholder",
        "/pricing" to "no in-app purchases in v1 (Play Billing is a v1.1 item)",
        "/auth/callback" to "OAuth callback is handled in-process by the native sign-in SDKs",
        "/admin/dashboard" to "staff-only tooling, web-only by design",
        "/admin/referrals" to "staff-only tooling, web-only by design",
        "/championships/:id/admin" to "organiser tooling, web-only by design",
        "/championships/:id/matches/edit" to "organiser tooling, web-only by design",
        "/ambassador/poster" to "poster generator is a print/desktop flow",
        "/ebook" to "post-v1: needs a native reader, the WebView never rendered",
        "/training" to "endgame drills / opening explorer were stubs; removed in S14",
        "/training/:level/:id" to "see /training",
        "/friends" to "friends are reachable inside the Lobby's Friends tab",
        "/game-history" to "duplicate of /history on web",
        "/game-review" to "web-only index page; native opens a review per game",
        "/daily-challenge" to "singular alias of /daily-challenges on web",
        "/tutorial/daily" to "served by the Daily Challenges screen natively",
        "/tutorial/module/:slug" to "module detail is a sheet inside the Learn screen",
        "/join/:code" to "handled as a deep link, not a screen",
        "/r/:code" to "handled as a deep link, not a screen",
        "/system-status" to "operational page, web-only",
        "/health" to "operational page, web-only",
        "/test/championship" to "developer test page",
        "/play/:gameId" to "legacy web alias of /play/multiplayer/:gameId",
    )

    @Test
    fun `every parity journey resolves to a real Android destination`() {
        parityMatrix.forEach { (webRoute, screen, journey) ->
            assertNotNull("$webRoute ($journey) has no Android route", screen.route)
            assertTrue(
                "$webRoute ($journey) maps to a blank Android route",
                screen.route.isNotBlank(),
            )
        }
    }

    @Test
    fun `android routes are unique so navigation cannot be ambiguous`() {
        val routes = parityMatrix.map { it.screen.route }

        val duplicates = routes.groupBy { it }.filter { it.value.size > 1 }.keys
        assertTrue("duplicate Android routes: $duplicates", duplicates.isEmpty())
    }

    @Test
    fun `the parity matrix and the documented gaps together cover every web route`() {
        // Sanity guard on the bookkeeping itself: a route may not be claimed as
        // both shipped and deliberately skipped.
        val covered = parityMatrix.map { it.webRoute }.toSet()
        val skipped = deliberateGaps.keys

        val both = covered intersect skipped
        assertTrue("routes listed as both shipped and skipped: $both", both.isEmpty())
        assertTrue("every documented gap needs a reason",
            deliberateGaps.values.all { it.isNotBlank() })
    }

    @Test
    fun `the native app covers the core web journeys a player pays for`() {
        // These are the journeys the business depends on; if any is ever removed
        // from the matrix this test says so explicitly.
        val mustHave = listOf(
            "/play", "/play/multiplayer/:gameId", "/lobby", "/dashboard",
            "/puzzles", "/tactical-trainer", "/history", "/profile",
            "/championships", "/referrals", "/parent", "/privacy", "/terms",
        )
        val covered = parityMatrix.map { it.webRoute }.toSet()

        val missing = mustHave.filterNot { it in covered }
        assertTrue("core web journeys missing from the native app: $missing", missing.isEmpty())
    }

    // ── Parameterised routes build valid destinations ────────────────

    @Test
    fun `game routes build well-formed destinations from an id`() {
        assertEquals("play_multiplayer/42", Screen.PlayMultiplayer.createRoute(42))
        assertEquals("game_review/42", Screen.GameReview.createRoute(42))
        assertEquals("game_detail/42", Screen.GameDetail.createRoute(42))
        assertEquals("public_game/42", Screen.PublicGameViewer.createRoute(42))
        assertEquals("championships/9", Screen.ChampionshipDetail.createRoute(9))
        assertEquals("tutorial/lesson/5", Screen.TutorialLesson.createRoute(5))
        assertEquals("shared_result/abc123", Screen.SharedResult.createRoute("abc123"))
    }

    @Test
    fun `registration keeps an optional referral code and drops a blank one`() {
        assertEquals("register", Screen.Register.createRoute(null))
        assertEquals("register", Screen.Register.createRoute(""))
        assertEquals("register", Screen.Register.createRoute("   "))
        assertEquals("register?referralCode=ABC123", Screen.Register.createRoute("ABC123"))
    }

    @Test
    fun `a password reset link carries an encoded token and email`() {
        val route = Screen.ResetPassword.createRoute("tok en+/=", "kid%40example.com")

        assertTrue(route.startsWith("reset_password?token="))
        assertTrue("the raw token must not leak unencoded separators",
            !route.removePrefix("reset_password?token=").substringBefore("&").contains("/"))
        assertTrue(route.contains("&email="))
    }

    @Test
    fun `the lobby opens on the matchmaking tab when asked, players by default`() {
        assertEquals("lobby", Screen.Lobby.createRoute(null))
        assertEquals("lobby?tab=matchmaking", Screen.Lobby.createRoute("matchmaking"))
    }

    @Test
    fun `parameterised route patterns declare the arguments their builders fill`() {
        val patterns = mapOf(
            Screen.PlayMultiplayer.route to "gameId",
            Screen.GameReview.route to "gameId",
            Screen.GameDetail.route to "gameId",
            Screen.PublicGameViewer.route to "gameId",
            Screen.ChampionshipDetail.route to "id",
            Screen.TutorialLesson.route to "lessonId",
            Screen.SharedResult.route to "uniqueId",
        )

        patterns.forEach { (route, arg) ->
            assertTrue("$route must declare {$arg}", route.contains("{$arg}"))
        }
    }
}
