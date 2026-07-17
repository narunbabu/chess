# S10 v2 — Nearby Opponents + real synthetic games + bot personas (P1, Android)

**Rewritten 2026-07-15** after the web-vs-Android gap analysis
(`docs/reviews/2026_07_15_web_vs_android_gap_analysis.md` §2) and a backend
capability check. The original draft's "wait 15 s then toast a bot offer" is
replaced by the pattern web already validated in production: a rating-filtered
**"Nearby Opponents"** list with synthetic players woven in. The original T1
question is answered: **the backend supports real persisted games vs synthetic
players** — evidence below. Depends on: **S2 (done — engine works)** and
**S12 (Home ViewModel — build S12 first; this spec extends the same VM)**.

## Problem (review §3.14, §3.18, §5.3, §5.5; gap analysis §2)

A child can search matchmaking into a provably empty pool ("0 online") with no
expectation-setting and no fallback; Play vs Computer is a faceless difficulty
slider. Web solved this: Dashboard shows a "Nearby Opponents" list
(rating-windowed, real players first, synthetic players appended) where tapping
a bot starts a game immediately. Android has none of it.

## Backend facts (verified 2026-07-15 — do not re-derive)

- **`GET /api/v1/lobby/players?min_rating=X&max_rating=Y`**
  (`routes/api_v1.php:284` → `LobbyController::players`, `LobbyController.php:18-111`)
  returns `{ real_players: [], synthetic_players: [] }`. Server does the work:
  real players = online in last 5 min, filtered to the window, sorted by rating
  proximity, with in-game detection; synthetics = up to 40 bots inside the
  window (`SyntheticPlayer::getForLobby`). Client only merges the two arrays.
- **Rating window (web's values — reuse them)**: default
  `[userRating − 200, userRating + 350]`, clamped to `[200, 3200]`, default
  user rating 400 (`chess-frontend/src/utils/ratingWindow.js:1-28`).
- **Real synthetic games are supported**: `POST /api/v1/games/computer` accepts
  `synthetic_player_id` and creates a persisted `games` row
  (`GameController::createComputerGame`, `GameController.php:84-200`;
  validation line 91; proven by `tests/Feature/SyntheticComputerGameTest.php`).
- **Bot moves are client-computed**: the client runs its own engine and posts
  each bot move to **`POST /api/websocket/games/{gameId}/synthetic-move`**
  (`WebSocketController::broadcastSyntheticMove`, `WebSocketController.php:634-667`;
  server validates turn + legality via `GameRoomService::recordSyntheticMove`).
  ⚠️ This route exists **only in legacy `routes/api.php:249`**, not in
  `api_v1.php`. Android's Retrofit base ends at `/api/`, so the relative path
  `websocket/games/{id}/synthetic-move` works as-is — no backend change needed.
- **Matchmaking already falls back to synthetics server-side**: quick-match
  priority is human → synthetic → computer
  (`MatchmakingService.php:314-400`), and queue expiry matches with a synthetic
  (`checkStatus` lines 79-98 → `matchWithSynthetic` 170-252). Android's queue
  UI just doesn't surface it.

## Android facts (verified 2026-07-15)

- `MatchmakingApi.kt:71-72` already has `getSyntheticPlayers()`;
  `domain/model/SyntheticPlayer.kt` has `id, name, rating, computerLevel,
  personality, bio, avatarUrl, gamesPlayed, winRate` + `skillGroup`.
- Engine level mapping lives in `engine/StockfishEngine.kt` (levels 1–16,
  `mapDepthToMoveTime` :41-47, tiers :50-55).
- Home's `PlayTab` column (`presentation/home/HomeScreen.kt:229-294`):
  HeroBanner → "Start a game" cards → "Explore" grid. S12 adds the Home
  ViewModel and a Resume section; this spec adds Nearby Opponents to the same
  VM/screen.

## Tasks

### T1 — Data layer

Add to `MatchmakingApi.kt`:
`@GET("v1/lobby/players") suspend fun getLobbyPlayers(@Query("min_rating") min: Int, @Query("max_rating") max: Int)`.
Parse `real_players` + `synthetic_players` (synthetic entries carry
`type: "synthetic"` and `computer_level`). Add a small
`RatingWindow` util mirroring web's constants (−200/+350, clamp 200–3200,
default 400).

### T2 — "Nearby Opponents" section on Home

In the S12 Home ViewModel, load lobby players with the user's rating window.
New section on `PlayTab` under "Start a game" (before "Explore"):

- Collapsed: **3 cards** (web's `COLLAPSED_COUNT = 3`), "Show N more" expander.
- Card: avatar (or initial in colored circle), name, `Rating: N`, status dot —
  synthetic → "Available" (green); real `in_game` → "In game" (amber, not
  tappable to challenge); else "Online".
- Real players come first in the merged list (server order) — beginners with
  no nearby humans naturally see bots. **No "0 online" style counts anywhere.**
- Tap synthetic → start a game vs that bot (T3). Tap real player → navigate to
  Lobby matchmaking tab with the rating window applied (web does exactly this —
  no direct challenge from Dashboard).
- Offline/error → hide the section entirely (Home must not gain a spinner).

### T3 — Real synthetic game flow

On synthetic tap (from T2 or T5 persona row):
1. `POST v1/games/computer` with `synthetic_player_id`, casual, 10+0, random
   color (web's defaults, `Dashboard.js:153-183`).
2. Open the game via the multiplayer stack (`Screen.PlayMultiplayer` route) OR
   the PlayComputer stack — pick whichever already renders a served game with
   an opponent identity; the deciding factor is where
   `GameRoomService`-recorded moves render. The existing Companion flow
   (`PlayMultiplayerViewModel.loadCompanions/selectCompanion` :680-760) already
   runs local Stockfish inside PlayMultiplayer — reuse that machinery.
3. After each bot move computed locally (map `computer_level` → engine level),
   `POST websocket/games/{gameId}/synthetic-move` so the game is
   server-recorded and appears in Game History.
4. **Fallback path (only if the wiring above turns out unexpectedly deep):**
   purely local Stockfish game skinned with the bot's name/avatar/rating,
   casual, not server-recorded. Record in the completion report which path
   shipped and why.

### T4 — Matchmaking queue expectation + synthetic surfacing

In the Lobby searching state: subtitle under the spinner
**"Finding a player usually takes under a minute."** Verify Android's queue
uses `quick-match`/`checkStatus` so the server's synthetic fallback actually
reaches the client; when the match result is synthetic, the game screen and
result card must show the bot's name + rating (never "Computer (Level N)" and
never a raw "synthetic" enum). Confirm S9 item 5 held: no "0 online" badge.

### T5 — Bot personas in Play vs Computer

`presentation/game/PlayComputerScreen.kt` setup: above the difficulty slider,
horizontally scrolling persona row fed by `getSyntheticPlayers()` (cache;
offline → hide row, slider still works). Chip: avatar/initial, name, rating.
Selecting a persona sets the slider to `computerLevel` and the in-game top bar
shows "Playing {name}". Slider remains as "Custom". Persona games via T3's
flow when online; local when offline.

## Acceptance criteria (RELEASE build, prod)

1. Home shows "Nearby Opponents" with ≥3 entries for a fresh low-rated account
   (synthetics fill the window); expander works; no liquidity counts shown.
2. Tapping a bot lands in a playable game titled with the bot's name; the bot
   replies with sound moves; after finishing, the game appears in Game History
   (if T3 shipped the server-recorded path).
3. Tapping a real player lands on the Lobby matchmaking tab.
4. Queue search shows the expectation subtitle; a queue that matches a
   synthetic shows the bot identity end-to-end.
5. Play vs Computer shows persona chips; picking one starts a correctly-titled
   game; offline the setup screen still works (slider only).
6. Offline Home: section hidden, no spinner, rest of Home intact.
7. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S10-*.png`.
