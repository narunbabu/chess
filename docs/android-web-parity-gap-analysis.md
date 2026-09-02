# Android ↔ Web parity — feature-level gap analysis

**Date**: 2026-08-24. **Method**: side-by-side reading of web components against
Android screens, plus on-device observation. Every gap below cites the file and
line that proves it.

## Why the existing parity test missed all of this

`WebParityMatrixTest` asserts that each web **route** has an Android
**destination**. That is navigation coverage, not feature coverage. `/lobby`
resolving to `Screen.Lobby` passes whether or not the lobby has an ELO filter;
`/play/multiplayer/:id` passes whether or not the game screen has lifelines.
Every gap in this document sits *inside* a screen the route test calls green.
The test is not wrong — it was over-read (by me) as evidence of parity.

---

## Module 1 — Lobby › Players tab

| Capability | Web | Android | Status |
|---|---|---|---|
| ELO range filter (From/To) | `PlayersList.jsx:39-95` — "ELO" label, From/To inputs, apply + reset | none | **MISSING** |
| Rating-window persistence | `ratingWindow.js` — `RATING_WINDOW_PREFS_KEY`, per-mode defaults, `rememberRatingWindow` | none | **MISSING** |
| Mode-aware default window | `LobbyPage.js:84` `getModeAwareDefaultRatingWindow(user.rating, mode)` | none | **MISSING** |
| Filter applied to incoming players | `LobbyPage.js:256` `isRatingInWindow(...)` on join events | none | **MISSING** |

Android's Players tab is an unfiltered list. Confirmed on device: nine synthetic
opponents from 200–600 with no way to narrow by rating.

## Module 2 — Starting a game against a listed opponent

`LobbyViewModel.startGameVsSynthetic` (`LobbyViewModel.kt:417-445`) hardcodes:

```kotlin
addProperty("time_control", 10)
addProperty("increment", 0)
addProperty("game_mode", "casual")
```

Web's equivalent (`PlayOnlineButton.js:51-55`) sends stored preferences:
`time_control_minutes`, `game_mode` (casual/rated/**learning**), and
`learning_help_limit`.

| Capability | Web | Android | Status |
|---|---|---|---|
| Choose mode before starting | yes | hardcoded `casual` | **MISSING** |
| Choose time control | yes | hardcoded 10\|0 | **MISSING** |
| Learning help limit carried | `learning_help_limit` | not sent | **MISSING** |

This is why the game header read *"Casual • 10|0"* with no way to change it.

## Module 3 — Lobby › Quick Play

| Capability | Web | Android | Status |
|---|---|---|---|
| Mode selector | 3 modes (casual / rated / learning) | 2 chips only — Casual, Rated (`LobbyScreen.kt:599-604`) | **PARTIAL — Learning missing** |
| Time control | yes | yes (`LobbyScreen.kt:551`) | OK |
| Colour choice | yes | yes | OK |

## Module 4 — In-game controls, multiplayer  ← the reported bug

Web `GameContainer.js:330-400` renders, for casual **and** learning games:

- Pause / Resume
- **Review** toggle — best-move alternatives after each move (`:346`)
- **Undo** with remaining count, title *"Undo — N helplines left"* (`:357-366`)
- **Best** with remaining budget, title *"Show Best (N helplines left)"* (`:369-378`)
- More menu

Android `PlayMultiplayerScreen.kt` renders only **Draw / Pause / Resign**
(`:523-558`). Undo appears solely as an *incoming* request banner (`:445`) —
there is no control to request one.

| Capability | Web | Android | Status |
|---|---|---|---|
| Undo / takeback request button | yes, with budget | none (receive-only) | **MISSING** |
| Best-move lifeline w/ budget | yes | CCT sheet has a "Best" chip (`CCTControls.kt:161`) but no budget, not presented as a lifeline | **PARTIAL** |
| Review (post-move alternatives) | yes | none | **MISSING** |
| Lifeline budget accounting | `bestMoveBudget`, `undoChancesRemaining` | none in multiplayer | **MISSING** |

## Module 5 — Play vs Computer

Better state than multiplayer — but with a broken promise.

| Capability | Web | Android | Status |
|---|---|---|---|
| 3-way mode selector | yes | yes (`PlayComputerScreen.kt:293-311`) | OK |
| Undo with budget | yes | yes (`:505-513`) | OK |
| Difficulty-scaled undo counts | yes | yes (`:643-646`) | OK |
| Best-move help | yes | **none** — no CCT entry point on this screen | **MISSING** |

`PlayComputerScreen.kt:326` tells the player Learning mode gives
*"Best-move & undo help from a small pool"* — but only undo exists here. The
`CCTBottomSheet` that provides Best is wired only into the multiplayer screen.

## Module 6 — Game Review

| Capability | Web | Android | Status |
|---|---|---|---|
| Per-move lifeline markers | `GameReview.js` — 28 references, badges per move, totals | **0 references** in `history/GameReviewScreen.kt` | **MISSING** |
| Lifelines-used summary | `GameEndCard.js:1073` | none | **MISSING** |

---

## Not yet audited at feature level

Listed so the coverage of this document is not over-read the way the route test
was. These modules have Android screens and passing routes, but have **not**
been compared control-by-control against web:

Dashboard · Championships · Daily Challenges · Tactical Trainer · Puzzles ·
Tutorial/Learn · Leaderboard · Referrals · Ambassador · Organizations ·
Parent dashboard · Profile/Progress · Subscription · Public game viewer · Chat

## Implementation status (2026-08-24)

Modules 1-3 are **implemented and verified on an emulator against production**.
Modules 4-6 are not started.

- [x] **Module 1 - Elo range filter.** `RatingWindow` is now a data class with
      `normalize()` / `contains()` ported from the web util, covered by 9 new JVM
      tests (`RatingWindowTest`). `LobbyPreferences` persists the typed range.
      Verified: entering 400-600 narrowed the list to exactly those five
      opponents, inclusive at both ends, and the range survived a full app
      restart.
- [x] **Module 2 - mode + time control from the Players tab.** The hardcoded
      `casual` / `10|0` is gone; a "Game options" card drives the payload.
      Verified: a 5+0 game started and the header read `5|0`.
- [x] **Module 3 - Learning chip in Quick Play.** Third chip added, so the
      Android mode set matches web's three.

**Found while verifying Module 2** - the game header shows `Casual` for a
Learning game. The server takes learning as `game_mode=casual` +
`learning_mode=true` (validation is `in:rated,casual`, so sending
`game_mode=learning` 422s - that was hit and fixed during testing). The header
reads the raw `game_mode` and therefore never says "Learning". Fix belongs with
Module 4, which needs the learning state on the game screen anyway.

## Module 4 status (2026-08-24)

**Correction to the Module 4 table above.** `bestMoveBudget` is supplied only by
`PlayComputer.js:3277` - web's *multiplayer* Best is **not** budgeted either, so
Android's existing CCT "Best" chip is closer to parity than the table implied.
The genuine multiplayer gaps were the missing Undo control and the Review
toggle; the Best budget belongs to Module 5, not here.

Done and verified on an emulator against production:

- [x] **Learning header label.** Reads the `learning_mode` flag rather than
      `game_mode` (which the server only ever stores as rated/casual). Header
      now shows `Learning - 5|0` where it previously said `Casual`.
- [x] **Takeback (Undo) control** with the per-colour budget seeded from
      `undo_white_remaining` / `undo_black_remaining` (fallback 9, matching
      web's `useGameState.js:71`). The eligibility gate is ported one-for-one
      from `PlayMultiplayer.js:2636-2697` and `:2957` - not rated, a chance
      left, your own turn, a live game, at least one full turn pair, no request
      already in flight - and is covered by 8 new JVM tests
      (`UndoEligibilityTest`). Verified on device: disabled with one ply on the
      board, enabled after `1. e5 d4`, `POST .../undo/request` returned 200 and
      the button moved to "Asked".
- [x] **Control row relaid out.** A fourth button made every label wrap
      mid-word ("Dra w" / "Res ign"); the row now runs tight single-line labels.

### Found while verifying - takeback against a synthetic opponent hangs

The request reaches the server (200) and the button sits at "Asked" forever,
because nothing ever accepts it: a synthetic opponent has no authenticated user
to call `undo/accept`, and the synthetic auto-play loop does not answer takeback
requests. Against a human opponent the flow is fine.

Two ways out, neither started:
1. server-side - auto-accept a takeback when the opponent is a synthetic player;
2. client-side - for `isSyntheticGame`, roll back locally and post the resulting
   position instead of asking.

(1) is the cleaner fix but needs a backend change, and the backend branch is
already five commits behind production - see STATUS.md.

### Still open in Module 4

- [ ] Review toggle (best-move alternatives after each move) - web
      `GameContainer.js:346`, no Android equivalent.

## Proposed implementation order

1. ~~**Lobby ELO range filter** (Module 1)~~ - done
2. ~~**Mode + time control when starting from Players tab** (Module 2)~~ - done
3. ~~**Learning chip in Quick Play** (Module 3)~~ - done
4. ~~**Undo lifeline + Learning header label in multiplayer** (Module 4)~~ - done; Review toggle and synthetic-opponent takeback remain (see Module 4 status)
5. **Best-move entry point in Play vs Computer** (Module 5) - reuse `CCTBottomSheet`
6. **Lifeline markers in Game Review** (Module 6) - display-only once moves carry the markers
7. Feature-level audit of the unaudited modules above
