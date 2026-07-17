# S12 — Home "Resume your game" section + first Home ViewModel (P1, Android)

**Added 2026-07-15** from the gap analysis (§2: web surfaces in-progress and
paused games with one-tap Resume/Discard; Android Home has no resume path).
No dependencies. **S10 v2 builds on the ViewModel this spec introduces — do
S12 first.**

## Facts (verified 2026-07-15)

- Android already has the data layer AND two partial surfaces:
  - Lobby: `ActiveGamesBanner` (`LobbyScreen.kt:99-105`, `:466-489`) →
    `GET games/active` (`GameApi.kt:15-16`), 10 s polling.
  - Dashboard: `UnfinishedGamePrompt` dialog (`DashboardScreen.kt:53-64`,
    `presentation/common/UnfinishedGamePrompt.kt`) → `GET games/unfinished`
    (`GameApi.kt:18-19`); also `POST games/create-from-unfinished`
    (`:21-22`) and `DELETE games/{id}/unfinished` (`:42-43`).
- But **Home is where users land**, and `HomeScreen.kt` is purely static — no
  ViewModel. Crucially `onNavigateToGame: (Int) -> Unit` is already a Home
  parameter (line 44) and already wired to PlayMultiplayer in
  `NavGraph.kt:138-140` — **it is never used in the body**.
- Opening a game needs only
  `Screen.PlayMultiplayer.createRoute(gameId)` (`Screen.kt:22-24`); the VM
  self-loads from `savedStateHandle` (`PlayMultiplayerViewModel.kt:53, 69-74`).
- Backend semantics (`GameController.php`): `GET /games/active` returns
  statuses `waiting|active|paused` (:1332-1363); `GET /games/unfinished`
  returns `paused` games with `paused_reason ∈ navigation|inactivity|
  beforeunload` from the last hour and auto-aborts staler ones (:1368-1443);
  `DELETE /games/{id}/unfinished` hard-deletes paused games (:1569-1600).
  ⚠️ `POST /games/{id}/abandon` (web's "Abandon" on active cards) exists
  **only in legacy `routes/api.php:119`** — relative path `games/{id}/abandon`
  from Android's `/api/` base works without backend changes.
- Web reference UX (`Dashboard.js:780-935`): card shows `vs {opponent}`,
  status, "Playing as white/black", "Last move: {time}"; Resume navigates to
  the game; Abandon (paused/waiting only) asks
  "Abandon game vs X? This will end the game with no rating impact…".

## Tasks

### T1 — HomeViewModel

New `presentation/home/HomeViewModel.kt` (@HiltViewModel, StateFlow UiState —
match the house pattern). On init, load in parallel: `getActiveGames()` +
`getUnfinishedGames()`. Refresh on screen resume (Lifecycle) — no 10 s polling
on Home. Errors → empty state (Home must never show a spinner or error card
for this section; on failure the section is simply absent). Merge rule:
active games first, then unfinished games not already in the active list
(dedupe by id).

### T2 — "Continue playing" section on Home

In `PlayTab` (`HomeScreen.kt:229-294`), insert a section between the
HeroBanner and "Start a game" — a returning player's unfinished game is the
single most relevant action on the screen:

- `SectionHeader("Continue playing")`, shown only when the merged list is
  non-empty.
- Card per game (max 2, then "See all in Lobby" text button → Lobby): opponent
  name ("Computer"/bot name for synthetic games), status chip (Active /
  Paused), "Playing as White/Black", relative last-move time ("2h ago",
  "No moves yet"). Primary button **Resume** → `onNavigateToGame(game.id)`
  (already wired). Overflow/secondary **Discard** on paused games only →
  confirm dialog ("Discard this game? This will end the game with no rating
  impact.") → `DELETE games/{id}/unfinished`; for `waiting` games use
  `POST games/{id}/abandon`. Remove from state on success.
- Thread `onNavigateToGame` into `PlayTab`'s parameters (it currently receives
  only `onPlayComputer/onPlayOnline/onNavigate/onLearn`, `:230-234`).

### T3 — Keep existing surfaces consistent

Leave Lobby's `ActiveGamesBanner` as-is. Dashboard's `UnfinishedGamePrompt`
dialog: keep, but it must not fire for a game the user just discarded from
Home (both read the server, so state converges — just verify no stale local
cache).

### T4 — MaterialTheme only

New UI uses MaterialTheme color roles (master-plan guardrail 3) — no
hardcoded `Color(0x…)`.

## Acceptance criteria (RELEASE build, prod)

1. Start a multiplayer game, background out mid-game, relaunch → Home shows
   "Continue playing" with the game; **Resume** lands back in the live game.
2. Pause/navigate away from a game → it appears on Home; **Discard** →
   confirm → card gone; Dashboard prompt doesn't resurrect it; not present in
   Lobby banner after refresh.
3. Account with no active/unfinished games → section absent entirely; Home
   layout identical to today.
4. Airplane mode → section absent, no spinner, Home otherwise intact.
5. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S12-*.png`.
