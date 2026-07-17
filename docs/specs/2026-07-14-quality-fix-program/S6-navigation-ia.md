# S6 — Real bottom navigation, drawer curation, working logout (P1, Android)

**Do after S3 is merged** (touches the same screens; avoid conflicts).

## Problems (review §3.1, §3.2, §4.1)

1. **The bottom tab bar is fake.** It exists only on Home; tapping Lobby/Learn/
   Profile pushes full screens with back arrows and no bar (screenshots `19`,
   `24`, `43`). Tabs that navigate away from tabs are buttons.
2. **The drawer is a 13-item junk drawer** duplicating the Explore grid
   (Leaderboard, Daily, Game History appear in both).
3. **Logout on the Home top bar is dead**: `NavGraph.kt:142-146` `onLogout`
   only navigates to Login; it never calls `AuthViewModel.logout()`
   (`presentation/auth/AuthViewModel.kt:227` exists, unused from Home), so
   `LoginScreen.kt:48`'s `LaunchedEffect(uiState.isAuthenticated)` bounces
   straight back to Home. Net effect: button does nothing.
4. Naming drift: drawer "Championships" vs screen title "Tournaments".

## Tasks

### T1 — Persistent bottom NavigationBar (the standard M3 pattern)

Restructure so the four top-level destinations share one scaffold:

1. In `NavGraph.kt`, wrap the `NavHost` in a `Scaffold` whose `bottomBar` shows
   the `NavigationBar` **only when** `currentBackStackEntry`'s route is one of
   `Screen.Home/Lobby/Learn/Profile` (use
   `navController.currentBackStackEntryAsState()`).
2. Tab clicks navigate with state preservation:
   ```kotlin
   navController.navigate(dest.route) {
       popUpTo(Screen.Home.route) { saveState = true }
       launchSingleTop = true
       restoreState = true
   }
   ```
   Selected tab derives from the current route — delete `selectedTab`
   remember-state in `HomeScreen.kt` (it currently desyncs on back).
3. Remove the now-redundant `bottomBar` from `HomeScreen`'s own Scaffold, and
   the back arrows from Lobby/Learn/Profile top bars (they're top-level now;
   system back from them should go to Home tab, which the popUpTo pattern
   gives you).
4. Keep the drawer accessible from Home only (unchanged).
5. Verify deep links / other `navigate(Screen.Learn.route)` call sites still
   work (Explore grid tiles, `DeepLinkHandler.kt`).

### T2 — Drawer curation (≤8 content items + sections)

In `HomeScreen.kt` `AppDrawer`:
- **Remove** (already on Explore grid): Leaderboard, Daily Challenges,
  Game History. Remove E-Book (S4 does this — coordinate; skip if done).
- **Section headers** (plain `Text`, `labelLarge`, onSurfaceVariant, 28.dp
  start padding): **Compete** → Championships, Tournament Invites; **Progress**
  → Dashboard; **Community** → Organizations, Referrals, Ambassador;
  **Account** → My Plan; footer (existing divider) → Privacy, Terms, Logout.
- Ambassador/Referrals adult-gating is S9 item 10 — don't do it here.

### T3 — Fix logout properly

1. Remove the logout `IconButton` from the Home `TopAppBar` entirely (no
   benchmark app puts logout there).
2. Drawer "Logout" → `AlertDialog` "Log out of Chess99?" (confirm/cancel).
3. Confirm → call `AuthViewModel.logout()` (inject via `hiltViewModel()` in
   `HomeScreen` or hoist to NavGraph) **and await/complete token clearing
   before** `navController.navigate(Screen.Login.route) { popUpTo(0) {
   inclusive = true } }`. Verify `AuthViewModel.logout()` (line ~227) clears
   the stored token + sets `isAuthenticated=false`; if it's fire-and-forget,
   expose a completion (suspend or callback) so the bounce race can't recur.

### T4 — One name per thing

- Championship screen title "Tournaments" → **"Championships"** (matches
  drawer + web).
- Grep for remaining drift: `grep -rn "Tournaments\b" app/src/main/java` and
  align labels (route names/ids stay unchanged).

## Acceptance criteria (RELEASE build)

1. Bottom bar visible and correctly highlighted on all four tabs; switching
   tabs preserves each tab's scroll/state; system back from any tab returns to
   Play tab, then exits.
2. Drawer shows sectioned, deduplicated list; every entry navigates.
3. Logout: confirm dialog → lands on Login → **does not bounce back**; relaunch
   app → still logged out; log back in works.
4. No screen titled "Tournaments".
5. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S6-*.png` (all four tabs + drawer + logout dialog).
