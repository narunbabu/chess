# S11 — Error-copy completion + game-abandonment guard (P1, Android)

**Added 2026-07-15** from the follow-up review
(`docs/reviews/2026_07_15_android_followup_review.md` §3). No dependencies.

## Problem — and a scope correction

The follow-up review flagged "21 `e.message` call sites across 10 files."
**That list is stale: a 2026-07-15 re-grep confirms all 21 were already
converted to `friendlyError(...)`** (the helper at
`presentation/common/ErrorCopy.kt:13-16`, used in ~50 sites across 22 files).
What actually remains:

1. **`presentation/auth/AuthViewModel.kt` — 8 raw-message sites** (the one
   file the sweep missed): lines 55 (login), 87 (register), 114/123 (Google),
   154/163 (Facebook), 192/217 (silent-login paths) — all of the form
   `error = error.message ?: "..."` or `result.exception.message ?: "..."`.
2. **`PlayMultiplayerViewModel.kt:347`** — `error = event.message` shows a
   WebSocket error event's server text verbatim.
3. **No back-press protection on active games.** `BackHandler` appears nowhere
   in the app. PlayComputerScreen's toolbar arrow pops unconditionally
   (`PlayComputerScreen.kt:46-50`, `NavGraph.kt:155`); PlayMultiplayerScreen
   guards only the toolbar arrow (`:139-148` shows
   `GameNavigationWarningDialog` when `gamePhase == PLAYING`) — hardware/
   gesture back bypasses it on both screens, silently forfeiting.

## Tasks

### T1 — AuthViewModel error copy

Auth errors need slightly richer handling than `friendlyError` (a wrong
password must not become "Couldn't reach Chess99"). Add a private helper in
AuthViewModel (or ErrorCopy.kt):

- HTTP 401/422 on login → **"That email or password doesn't match. Try
  again."** (for register 422, prefer the server's validation message ONLY if
  it is a known human-readable field message; otherwise **"Please check your
  details and try again."**)
- `IOException` → reuse `friendlyError`'s network copy.
- Everything else → "Couldn't sign in. Please try again." / "Couldn't create
  your account. Please try again." / "Google sign-in didn't work. Please try
  again." / Facebook equivalent.
- Silent-login failures (lines 192/217) should set **no user-visible error at
  all** — a background token refresh failing must not pop copy on launch; fall
  through to the normal login screen.

Replace all 8 sites. `e.message` / `error.message` /
`exception.message` must not reach UI state in this file.

### T2 — WebSocket error event copy

`PlayMultiplayerViewModel.kt:347`: map `event.message` through a sanitizer —
known/whitelisted server phrases pass; anything else becomes
"Connection hiccup — trying to reconnect." Log the raw text via Timber only.

### T3 — BackHandler on active games

- `PlayComputerScreen.kt` (composable body, ~line 31): add
  `BackHandler(enabled = state.gamePhase == GamePhase.PLAYING) { showLeaveDialog = true }`
  reusing `presentation/common/GameNavigationWarningDialog.kt`; wire the same
  dialog to the toolbar arrow. Confirm → leave (game abandoned as today);
  cancel → stay.
- `PlayMultiplayerScreen.kt`: add the same `BackHandler` so hardware/gesture
  back gets the SAME dialog the toolbar arrow already shows (`:77-87`).
- Dialog copy (kid-safe): title "Leave the game?", body "Your game is still
  going. If you leave now, it counts as a loss." (multiplayer) / "Your game
  won't be saved." (vs computer, unless S12's pause flow applies), buttons
  "Keep playing" / "Leave game".

### T4 — Regression gate

Add/verify grep gate: under `app/src/main/java/com/chess99/presentation/`,
`e.message`, `error.message`, `exception.message` must have **zero user-facing
occurrences** (comments and Timber logs allowed). Record the grep output in
the completion report.

## Acceptance criteria (RELEASE build, prod)

1. Wrong password on login → "That email or password doesn't match. Try
   again." — no raw text. Airplane-mode login → friendly network copy.
2. Fresh launch with an expired/invalid stored social token → lands on Login
   with no error dialog/banner.
3. Active Play vs Computer game + hardware back → dialog; "Keep playing"
   stays with board intact; "Leave game" exits. Same for gesture back. Same
   on PlayMultiplayer.
4. Back from the PvC setup screen (no active game) → no dialog.
5. Grep gate (T4) clean; `gradlew.bat compileReleaseKotlin lintRelease` green;
   screenshots `review-artifacts/fix-S11-*.png`.
