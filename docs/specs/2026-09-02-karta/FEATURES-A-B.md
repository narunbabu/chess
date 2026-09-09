# Implementation Spec — e003: Game-End Review Entry (A) & Always-Visible Streak (B)

Repo: `D:\ArunApps\Chess-Web` (read-only audit; every file cited below was opened).

---

# FEATURE A — Surface game review at game end

## A1. What already exists

**Review engine + routes (live, reachable):**
- `chess-frontend/src/App.js:302-317` — routes `/game-review` and `/play/review/:id` both render `<GameReview />` inside `<RouteGuard>`.
- `chess-frontend/src/components/routing/RouteGuard.js:18-34` — default `requireAuth = false`, and `AUTH_GATES` flag is `false` (`src/contexts/FeatureFlagsContext.js:9`), so both routes are currently pass-throughs — **guests can load the review page**; the constraint is data, not routing.
- `chess-frontend/src/components/GameReview.js` — full review page: move list with eval badges, opening detection, PGN/FEN, share, and **three data sources** (`loadGameData`, lines 388-833): (1) `location.state.gameHistory` (in-memory, zero API), (2) `gameId` + `?mode=multiplayer` → `GET /games/:id`, (3) `getGameHistoryById` → `GET /game-history/:id` with fallback to `GET /games/:id` (auto-detects synthetic/bot games via `synthetic_player_id`, line 431). Has loading / error / "No moves to review" screens with Back buttons (lines 1259-1288). Auto-reshows GameEndCard once per game id unless `sessionStorage['endcard_dismissed_<id>']` set (lines 843-852). Renders `PostGameAnalysis` (Stockfish, `POST /games/:id/analyze`) **only when a route `gameId` exists** (lines 1582-1611).
- `chess-frontend/src/components/PostGameAnalysis.js:43-64` — user-triggered "Analyze with Stockfish", has its own error/retry UI.
- Existing entry points that work today: `Dashboard.js:425-430` (`handleReviewGame`), `GameHistoryPage.js:141-143` (navigates **with** `state.gameHistory` — the shape precedent), `GameDetailPage.js:618`, and `PlayMultiplayer` for already-seen finished games via `src/utils/endedGamesTracker.js`.

**Game-end surface:**
- `chess-frontend/src/components/GameEndCard.js` — presentational card (props incl. `reviewReport`, `gameId`, `ratedMode`); no review CTA. Not the place to wire navigation.
- `chess-frontend/src/components/GameCompletionAnimation.js` — the real game-end surface. **Multiplayer button bar (lines 984-1188) already has a "👁️ Review" button** rendered when `onPreview` is passed (lines 1133-1159). **Single-player bar (lines 722-851) has NO review button** — Share/GIF/Vid/Report/History/Play Again only — and ignores `onPreview` entirely.
- `chess-frontend/src/components/play/PlayMultiplayer.js:5801-5805` (and duplicate render `:6223-6224`) — passes `onPreview` → `navigate(\`/play/review/${gameId}?mode=multiplayer\`)`. **Multiplayer is already fully wired.**
- `chess-frontend/src/components/play/PlayComputer.js:3709-3749` — renders `GameCompletionAnimation` **without** `onPreview`. Covers rated, casual, learning, and bot/synthetic games (`ratedMode`, `syntheticOpponent`, `isOnlineGame`). Key facts verified:
  - Backend game row is created **only when logged in** (`PlayComputer.js:2305-2329`, `gameService.createComputerGame`); guests have `backendGame = null`.
  - At game end it already calls `gameService.completeGame(id, {… moves …})` (`:851-861`) so `games.moves` is populated for auth users, and saves history (`:934-1006`): auth → `POST /game-history`; guest → localStorage.
  - Guests get the signup CTA (`GameCompletionAnimation.js:666-719`, `handleGuestSignupCta`).

**Data needed at game end:** none new. In-memory state (`gameHistory`, `gameResult`, `playerColor`, `computerDepth`, `liveReviewReport`) is sufficient via the `location.state.gameHistory` path; `PostGameAnalysis` uses the existing `POST /games/{id}/analyze` when a numeric game id is in the URL. **No backend changes and no new endpoints.**

## A2. The delta

| # | File | Change | Writer |
|---|------|--------|--------|
| 1 | `chess-frontend/src/components/GameCompletionAnimation.js` | In the single-player button bar (both auth and guest branches, lines 737-849): render a "🔍 Review" button when `onPreview` is provided, mirroring the multiplayer button (lines 1133-1159). No other changes. | A |
| 2 | `chess-frontend/src/components/play/PlayComputer.js` | Add `handleReviewGame()`: build the state payload — reuse the `gameHistoryData` object already built at `:936-955` but with `moves` as the **parsed array** with a `Start` entry prepended, entries mapped `{move, fen, time: timeSpent, evaluation, learningHelp}` (exact precedent: `GameHistoryPage.js:110-143`); include `game_mode: 'computer'`, `computer_level`, `review_report`. Then: set `sessionStorage['endcard_dismissed_<id>']` (suppresses GameReview's auto end-card re-show, `GameReview.js:843-852`); write the same payload to `localStorage['lastGameHistory']` — this wires GameReview's **currently dead** fallback read at `GameReview.js:402`; navigate to `/play/review/${backendGame?.id}` with `{ state: { gameHistory } }` when `backendGame?.id` exists (state renders instantly; route id enables PostGameAnalysis + shareable URL), else `/game-review` with state (guests). Pass as `onPreview`; omit when `gameHistory.length === 0`. | A |
| 3 | `chess-frontend/tests/e2e/game-end-review.spec.js` | NEW Playwright spec (criteria below). | A |

`GameReview.js`, `App.js`, backend: **no changes**. `GameEndCard.js`: no changes. No file is co-written with Feature B.

## A3. Acceptance criteria

1. **Given** an authenticated player finishes a computer game (rated mode) by checkmate, **when** the end card appears, **then** a Review button is present and clicking it lands on `/play/review/<backendGame.id>` showing the full move list without a loading error, and the URL is shareable.
2. Same for **casual** and **learning** modes (`ratedMode` values) — button present; learning game shows lifeline markers in the move list (they ride in `moves[].learningHelp`).
3. Same for a **bot/synthetic** game — review loads with the synthetic opponent's name/avatar (fields already carried on the standardized result, `PlayComputer.js:909-914`).
4. **Given** a **guest** finishes a computer game, **when** they click Review, **then** they land on `/game-review` with the board and moves rendered from navigation state (no API call, no login wall), and the Stockfish analysis card is absent (no route id).
5. **Given** a **multiplayer** game ends (resign/timeout/draw), **then** the existing "👁️ Review" button continues to work (regression only — no code change expected).
6. **Given** any end reason (resign/timeout/checkmate/draw), **then** the Review button appears identically (it is on the end card, which all reasons produce).
7. **Given** a game ends with 0 moves, **then** no Review button renders (avoids the "No moves to review" dead end).
8. **Given** a guest on `/game-review` (state-loaded) refreshes the page, **then** the game still loads from `localStorage['lastGameHistory']` (fallback now written); if that also fails, the existing error screen with a Back button shows (`GameReview.js:399-414`).
9. **Given** the user navigates from the end card into review, **then** GameReview does **not** re-open the GameEndCard modal (dismiss key was set).
10. `pnpm build && pnpm lint && pnpm typecheck` green; new E2E spec passes.

## A4. Failure paths

- **Game ends but backend `completeGame` failed earlier** (`PlayComputer.js:863-866` is non-blocking): review still works via state payload (moves come from memory). If the user instead reaches `/play/review/<id>` later with empty `games.moves`, GameReview's linked-history fetch (`GameReview.js:728-750`) or the "No moves to review" screen handles it — user sees a message either way.
- **`GET /games/:id` or `/game-history/:id` fails** when loading by id: existing error screen shows `'Failed to load game data. <msg>'` + Back (`GameReview.js:823-827, 1269-1277`). No silent blanks.
- **Guest + state lost + no localStorage**: explicit "No game specified" error screen — not a blank page.
- **Stockfish analyze fails/409**: `PostGameAnalysis` shows "Analysis Failed" + Retry (`PostGameAnalysis.js:53-63, 133-144`).
- Guests never hit auth walls because they use the state path; `/games/:id` and `/game-history/:id` are sanctum-protected (`chess-backend/routes/api_v1.php:75,144,194-196`) and are simply never called for them.

## A5. Effort

**1.5-2 days** (0.5 wiring, 0.5 guest/state edge cases + lastGameHistory, 0.5-1 E2E + gate runs).

## A6. Could not determine

- Whether every multiplayer ending path (resign/timeout/draw/cancel via `GameRoomService`) lands as an Eloquent `Game` update — irrelevant to A (multiplayer already wired) but noted for B.
- Whether `AUTH_GATES` can be flipped at runtime server-side (flag file shows `false`; a runtime override would gate `/game-review` for guests — the state path would then need the flag left off or the route exempted). Build should assert the flag state in the E2E.
- `handleContinue` in `GameCompletionAnimation.js:394-415` appears unwired to any button — possibly dead; I did not trace further since A does not need it.
- Android/iOS apps have their own game-end surfaces (`chess99-android/`, `chess99-ios/`) — not examined; this spec is web-only.

---

# FEATURE B — Streak visible across all activity

## B1. What already exists

**The streak number today is dead UI.** Three components read it, none can ever receive it:

- `chess-frontend/src/components/daily/DailyChallengeCard.js:27-32` — `GET /tutorial/progress/stats` → `setStreak(stats.daily_streak || 0)`; renders 🔥 badge (lines 101-116) and `StreakBar` (lines 160, 178-211). Same broken key in `src/pages/DailyChallengePage.js:82` and `src/pages/DailyChallengesPage.js:48`.
- Backend `TutorialController@getStats` (`chess-backend/app/Http/Controllers/TutorialController.php:395-422`) returns `{ stats, practice_stats, recent_assessments }` where `stats` = `User::getTutorialStatsAttribute()` (`app/Models/User.php:1087-1133`) containing **`current_streak`** (from the `current_streak_days` column). **No `daily_streak` key exists anywhere in the backend** (repo-wide grep) — so `streak` is always 0 and the 🔥 never renders.

**Streak state + computation (backend):**
- Columns `current_streak_days`, `longest_streak_days`, `last_activity_date` on `users` (migration `2025_11_19_100009_add_tutorial_fields_to_users_table.php:18-19`; fillable + serialized — `User.php:48-50, 90-96`).
- `User::updateDailyStreak()` (`User.php:1022-1053`): if last activity was yesterday → +1; today → no-op (idempotent per day); older → reset to 1. Day = server timezone.
- **Sole caller today: `TutorialController@completeLesson` line 276.** Not called by `submitDailyChallenge` (`TutorialController.php:595-691`), not by `GameController@completeGame` (`:582-684`), not by tactical (`TacticalProgressController::attempt/sync`), not by drills, not by multiplayer endings.
- A **second, divergent** streak definition: `User::getCurrentDailyStreak()` (`User.php:1058-1082`) counts consecutive *daily-challenge* completions; used by `getProgress` (`TutorialController.php:367`) and streak achievements (`UserDailyChallengeCompletion.php:108-125`).
- Timezone: `chess-backend/config/app.php:81` — `'timezone' => 'Asia/Kolkata'`. Day boundary = IST midnight, server-side.
- `GET /api/v1/user` returns the full model (`routes/api_v1.php:76-78`) → `current_streak_days` **already reaches the frontend** in `AuthContext`'s `user` (`AuthContext.js:151` `fetchUser`; `updateUser` patcher at `:277`). No new endpoint needed for display.
- `GameObserver.php:15-38` — already hooks the `Game::updated` terminal-status transition (finished/completed, not aborted) and cleans up invitations/resume info — the natural single hook to credit both players' streaks when any game ends, regardless of which controller/service ended it.
- `Header.js` — no streak anywhere; insertion points: right-section `user-compact` div (`:568-617`) and nav-panel user info (`:653-657`).

## B2. The delta

**Decision (spec-fixed): canonical streak = `users.current_streak_days`, advanced by `User::updateDailyStreak()`.** `getCurrentDailyStreak()` stays for challenge-streak achievements but is no longer the displayed value.

**Activity definition (explicit):** a streak day is credited by any of —
- daily challenge solved (`submitDailyChallenge`, correct answer only),
- lesson completed (already wired),
- tactical puzzle solved (`TacticalProgressController::attempt` on correct / `sync` applying solved deltas),
- training drill attempted (`TrainingDrillController::attempt`),
- any game reaching `finished`/`completed` status — rated, casual, learning, bot/synthetic, multiplayer; **aborted/cancelled games do NOT count**.

**Breaks:** a full IST calendar day with zero qualifying activities (next activity resets to 1 — `updateDailyStreak`'s else-branch). Failed puzzle attempts, logins, browsing, aborted games do not credit.

| # | File | Change | Writer |
|---|------|--------|--------|
| 1 | `chess-backend/app/Observers/GameObserver.php` | In the terminal-transition block: for `finished`/`completed` (not `aborted`), load both human players (`white_player_id`/`black_player_id`, skip nulls/synthetic) and call `updateDailyStreak()` on each, each wrapped in try/catch that logs and continues (copy the pattern at `TutorialController.php:274-284`). | B |
| 2 | `chess-backend/app/Http/Controllers/TutorialController.php` | (a) `submitDailyChallenge`: after `markCompleted()` (line ~673), call `$user->updateDailyStreak()` in the same try/catch pattern. (b) `getStats`: add top-level `'daily_streak' => $user->current_streak_days` (and keep `stats.current_streak`) so the existing frontend key works — belt-and-braces BC. | B |
| 3 | `chess-backend/app/Http/Controllers/TacticalProgressController.php` | In `attempt` (correct solve) and `sync` (when solved-count increases): call `updateDailyStreak()` (same try/catch). | B |
| 4 | `chess-backend/app/Http/Controllers/TrainingDrillController.php` | In `attempt`: call `updateDailyStreak()` (same try/catch). | B |
| 5 | `chess-frontend/src/hooks/useDailyStreak.js` | NEW: returns `{ streak, longest }` from `useAuth().user.current_streak_days/longest_streak_days`; refetches via `fetchUser()` on `visibilitychange→visible` and window `focus` (pattern precedent: `DailyChallengeCard.js:38-42`); on fetch failure keeps last value and `console.warn`s. | B |
| 6 | `chess-frontend/src/components/layout/Header.js` | Right-section `user-compact` (`~:584`, beside the tier badge) and nav-panel user info (`~:656`): render `🔥 {streak}` when `streak > 0`, `title` tooltip "N-day activity streak — games, puzzles, lessons and challenges count. Longest: M". Hidden entirely for guests. | B |
| 7 | `chess-frontend/src/components/daily/DailyChallengeCard.js` | Replace the `stats.daily_streak` fetch with `useDailyStreak()`; fix `StreakBar` day labels to IST (`toLocaleString('en-US',{timeZone:'Asia/Kolkata'})`-derived weekday) so labels match the backend day boundary. | B |
| 8 | `chess-frontend/src/pages/DailyChallengePage.js`, `chess-frontend/src/pages/DailyChallengesPage.js` | Same source swap (streak display at `DailyChallengePage.js:352,430`). | B |
| 9 | `chess-backend/tests/Feature/DailyStreakTest.php` | NEW PHPUnit: updateDailyStreak day arithmetic; observer credits players on finish, not abort; submitDailyChallenge credits on correct only; idempotency (two activities same day → streak +1 once). | B |
| 10 | `chess-frontend/tests/e2e/streak-header.spec.js` | NEW E2E (criteria below). | B |

**No file is written by both features** (A owns `GameCompletionAnimation.js` + `PlayComputer.js`; B owns Header + daily components + backend hooks). If B later wants an instant streak bump in the end card, it must patch `AuthContext` via `updateUser({current_streak_days})` from `PlayComputer`'s existing `completeGame` response — coordinate with A's writer; not required for launch (Header refetches on focus).

## B3. Acceptance criteria

1. Given an authenticated user with `current_streak_days = 3`, when any header-bearing page loads, then `🔥 3` renders in the header right-section and in the profile nav panel.
2. Given a guest, then no streak UI renders anywhere in the header (no 🔥 0).
3. Given a logged-in user finishes one rated multiplayer game (opponent resigns), when either player next loads the header, then both players' `current_streak_days` incremented by 1 (or initialized to 1) — verified via `GET /user` and DB.
4. Given a game is aborted (`status = aborted`), then neither player's streak changes.
5. Given streak already credited today (any activity), when a second activity completes the same day, then `current_streak_days` is unchanged (idempotent) and `last_activity_date` still today.
6. Given `last_activity_date` = two days ago (IST) and streak was 5, when any qualifying activity completes, then streak becomes 1.
7. Given the user solves the daily challenge correctly, then streak credits even if they play no game ( PHPUnit + UI 🔥 bump after refocus).
8. Given a wrong daily-challenge attempt, then streak does not credit.
9. Given `DailyChallengeCard` loads, then the 🔥 badge and 7-day bar show the same number as the header (single source).
10. Given a user active 4 consecutive IST days then inactive one full IST day, then the header shows the streak reset after their next activity, and the StreakBar day letters match IST weekdays.
11. `php artisan test` (new `DailyStreakTest` passes) and `pnpm build && pnpm lint && pnpm typecheck` green.

## B4. Failure paths

- **`updateDailyStreak()` throws** (e.g., DB write fails): caught, logged (`error` level, user_id), activity endpoint still returns success — a streak must never block a game/puzzle completion. Precedent: `TutorialController.php:274-284`.
- **`fetchUser()` fails in `useDailyStreak`**: keep last known streak, `console.warn('[useDailyStreak] refresh failed', msg)`; if never loaded, render nothing (badge absent). Header must not degrade.
- **`GET /tutorial/progress/stats` fails in `DailyChallengeCard`**: today's `.catch(() => {})` is silent — replace with a visible fallback: hide the 🔥 row and show nothing else (challenge card itself still renders); the header remains the authoritative streak surface, so information is not silently lost.
- **Guests**: streak is a server-side per-user value; guests get no badge and no error.
- **Clock skew**: day arithmetic is server-side only (IST); client never computes streak, only labels.

## B5. Effort

**2-3 days** — backend hooks + observer 0.5-1; frontend hook + Header + 3 component fixes 0.5-1; tests (PHPUnit + E2E) + gate runs 1.

## B6. Could not determine

- Whether every multiplayer ending (resign/timeout/draw via `GameRoomService`, and the WS controllers `WebSocketController.php:706-902`) performs an Eloquent `Game::update` that fires `GameObserver` — assumed yes (resignGame delegates to `gameRoomService->resignGame`); if any path uses raw `DB::table()->update()`, the observer misses it. `DailyStreakTest` must cover resign/timeout/draw explicitly.
- Why the frontend reads `daily_streak` while the backend only ever produced `stats.current_streak` — whether an older deployed backend returned `daily_streak`, or the key was simply never implemented, is not determinable from the tree (openapi.yaml references a `TutorialStats` schema; I did not enumerate its fields).
- Whether tactical `sync` (offline batch) can attribute solves to specific past days — `updateDailyStreak` credits *today* only; retroactive multi-day backfill from `sync` is out of scope and flagged as a known limitation.
- Runtime toggles for feature flags (`AUTH_GATES`) — could not verify whether a server-side override mechanism exists.
- Native apps (`chess99-android/`, `chess99-ios/`) presumably surface `/user` too; whether they show streaks was not examined.
