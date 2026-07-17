# S8 — Streaks v1 + Home hero personalization (P1, Android + backend check)

**Depends on S3** (Dashboard loaders must be fixed so hero data loads reliably).

## Problem (review §3.7, §5.1)

Daily Challenges copy says "keep your streak alive" but **no streak counter
exists anywhere in the app**; the Home hero is static decoration ("Welcome
back / Ready to play?") with no name, rating, or streak. Streaks are the
single biggest missing comeback mechanic vs Duolingo/ChessKid.

Good news: **the backend already returns a streak.** `GET /api/v1/tutorial/
progress` → `data.stats.streak` (see S5's contract table), and profile
performance stats include `current_streak`/`best_streak`.

## Phase 1 — Surface what exists (bulk of this spec)

### T1 — Verify semantics first

Read `chess-backend` code to determine what increments `data.stats.streak`
(grep `streak` in `app/Services/` + `TutorialController`): lesson completions?
daily challenges? any activity? Record the answer in your report — the UI copy
must match reality ("N-day learning streak" if it's lessons-only). Don't guess.

### T2 — Streak chip component

New `presentation/common/StreakChip.kt`: 🔥 (or `Icons.Default.
LocalFireDepartment`) + "N day streak" in a rounded `secondaryContainer` chip.
States: N≥1 → filled chip; N==0 → outlined chip "Start your streak today!".

### T3 — Home hero personalization

`HomeScreen.kt` hero (keep the existing gradient design — additive change):
- Home currently has no ViewModel — create a light `HomeViewModel` (Hilt):
  fetch `authApi.getCurrentUser()` (typed `UserDto` — name, rating) and the
  tutorial progress streak; expose `{ firstName, rating, streak }` UiState with
  a 5s-timeout fallback to the current static copy (never block the hero on
  network).
- Hero text becomes: "Hi {firstName}! 👋" (fallback "Welcome back") /
  "Ready to play?" unchanged / below the tagline row: rating chip
  ("⭐ {rating}") + `StreakChip`.
- Cache last-known values (DataStore or in-memory singleton) so the hero is
  instant on later launches.

### T4 — Daily Challenges screen

Add the `StreakChip` next to the "keep your streak alive" copy
(`presentation/daily/DailyChallengesScreen.kt`), fed by the same progress call
(the screen's ViewModel already hits tutorial endpoints — reuse).

## Phase 2 — Backend: streak counts ANY qualifying activity (small, optional
if T1 shows it already does)

If T1 reveals streak = lessons-only: extend the backend calculation so a day
counts when the user did ANY of: completed a daily challenge, solved ≥1
tactical puzzle (`POST tactical attempts` exists), finished a game, or
completed a lesson. Implementation sketch: compute from existing activity
tables in the streak accessor (no new table, no migration if derivable);
**if a migration is unavoidable, STOP — schema changes need owner approval**
(CLAUDE.md rule). Add/extend a PHPUnit test for the calculation.
Gate: `php artisan test` green.

## Phase 3 — Streak-rescue notification (optional, do only if 1+2 land early)

Local notification via WorkManager at 19:00 device time if no qualifying
activity today AND streak ≥ 2: "Your {N}-day streak needs one puzzle! 🔥".
Respect the existing notification permission flow (`NotificationHelper.kt`).

## Acceptance criteria (RELEASE build, prod)

1. Home hero greets the test user by first name with rating + streak chips;
   with network blocked, hero still renders (fallback copy) instantly.
2. Daily Challenges shows the streak chip; the number matches
   `/tutorial/progress` (verify the raw value via the S5 debug method).
3. Phase-2 (if done): solving a tactical puzzle today makes today count —
   verified by API response change; `php artisan test` green.
4. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots
   `review-artifacts/fix-S8-*.png`.
