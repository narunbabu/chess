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

Android `PlayMultiplayerScreen.kt` renders **Draw / Review / Undo / Pause / Resign**
(`:523-558`). Undo appears solely as an *incoming* request banner (`:445`) —
there is no control to request one.

| Capability | Web | Android | Status |
|---|---|---|---|
| Undo / takeback request button | yes, with budget | none (receive-only) | **MISSING** |
| Best-move lifeline w/ budget | yes | CCT sheet has a "Best" chip (`CCTControls.kt:161`) but no budget, not presented as a lifeline | **PARTIAL** |
| Review (post-move alternatives) | yes | live toggle with async top-5 alternatives | **DONE** |
| Lifeline budget accounting | `bestMoveBudget`, `undoChancesRemaining` | Review markers are persisted; multiplayer Best budget remains a separate follow-up | **PARTIAL** |

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
| Per-move lifeline markers | `GameReview.js` — 28 references, badges per move, totals | `GameReviewScreen.kt` badges from JSON/compact history | **DONE** |
| Lifelines-used summary | `GameEndCard.js:1073` | `LifelineSummary` in `GameReviewScreen.kt` | **DONE** |

---

## Feature-level audit scope

The following source audit compares the Android screen/view-model/API behavior
with the corresponding web components. It is a feature-level review of the
available code paths, not a claim of browser, emulator, physical-device, or
authenticated multi-client acceptance. Statuses mean **DONE** (feature is
substantially equivalent), **MOSTLY PARITY** (one bounded omission), **PARTIAL**
(core flow exists but important web capability is absent), and **GAP** (a
correctness issue or major flow is missing).

### Audit matrix

| Module | Android coverage compared with web | Status / evidence |
|---|---|---|
| Dashboard | Rating/stats, quick actions, games, tournaments, unfinished games, daily quota, pull-to-refresh. Web additionally has nearby-player/rating filtering, progress/detail modals, and richer notification/admin/org areas; Android notifications have no loader/API path. | **PARTIAL** — `DashboardScreen.kt`, `DashboardViewModel.kt`, `Dashboard.js` |
| Championships | List/detail, search/status/format filters, registration, create, invitations, standings, matches, pairing/schedule/start and review. Android lacks upcoming/registered/archived filters, paid registration/Razorpay/contact consent, and several admin lifecycle/archive controls. | **PARTIAL** — `ChampionshipListScreen.kt`, `ChampionshipDetailScreen.kt`, `ChampionshipListViewModel.kt`, `ChampionshipList.jsx`, `ChampionshipDetails.jsx` |
| Daily Challenges | Tracks, tier locks, summary/streak, solve entry and leaderboard. Solving now persists the completion/XP through `daily-challenge/submit`, completed challenges stay open for review, and the leaderboard is the daily one. Web still has richer attempt history and result presentation. | **PARTIAL** (was GAP; closed 2026-09-16) — `DailyChallengesViewModel.kt`, `PuzzleViewModel.kt`, `DailyChallengesPage.js`, `DailyChallengePage.js` |
| Tactical Trainer | Five stages, unlocks, local/server/offline progress, hints, solution viewer, wrong-move scoring and badges. Android omits web CCT phases/threshold scoring, Fast/Guided mode, stage video, and puzzle-list navigation. | **PARTIAL** — `TacticalTrainerViewModel.kt`, `TacticalPuzzleContent.kt`, `TacticalTrainer.js`, `TacticalPuzzleBoard.js` |
| Puzzles | Android has an actual solver with online daily and bundled fallback puzzles, hints and in-session counters; web Puzzles is a hub to Tactical Trainer, Daily Challenges, Lessons and ebook. Daily completion is not persisted from Android, and ebook is not wired into the Android nav graph. | **PARTIAL** — `PuzzleScreen.kt`, `PuzzleViewModel.kt`, `Puzzles.js` |
| Learn | Modules, stats, daily/achievement summaries and staged lesson board exist. Android lacks web tier/access presentation, theory quizzes/visual aids, practice-game controls and server-backed hint/reset behavior. Lesson validation and completion are now server-side against the real lesson/stage rows (2026-09-16). | **PARTIAL** (was GAP) — `TutorialLessonScreen.kt`, `LearnScreen.kt`, `LearnViewModel.kt`, `LessonPlayer.jsx`, `EnhancedInteractiveLesson.jsx` |
| Leaderboard | Four game categories, periods, refresh, medals, current rank and native text sharing. Android has no tactical category and no web-style image-card/download/social sharing controls. | **PARTIAL** — `LeaderboardViewModel.kt`, `LeaderboardScreen.kt`, `LeaderboardPage.js` |
| Referrals | Stats, primary link, copy, code generation, referred users, earnings and payout history. Android lacks direct WhatsApp/email sharing and a visible generated-code list with commission-rate/inactive/usage detail. | **PARTIAL** — `ReferralViewModel.kt`, `ReferralDashboardScreen.kt`, `ReferralDashboard.js` |
| Ambassador | Adult gate, application/status, stats, link copy/share, audience templates and payout history. Android cannot submit payout requests, show milestones/commission detail, or display/download QR/poster assets and template actions. | **PARTIAL** — `AmbassadorDashboardScreen.kt`, `BecomeAmbassadorScreen.kt`, `AmbassadorDashboard.js`, `BecomeAmbassador.js` |
| Organizations | Search/list, create, selected members and invite with member/admin role. Android lacks received accept/reject, sent cancellation, removal, chat-access toggle, website field and richer admin controls. | **PARTIAL** — `OrganizationsViewModel.kt`, `OrganizationsScreen.kt`, `OrganizationDashboard.js` |
| Parent | Link/invite, accept/decline, pending cancel, report-card metrics, replay, weekly email and child management are present. PGN download from the child replay is missing. | **MOSTLY PARITY** — `MyKidsScreen.kt`, `MyKidsViewModel.kt`, `MyKidsPage.js` |
| Profile / Progress | Core profile, appearance, friends, stats, progress and rating history exist. Android omits hierarchical location, tournament/WhatsApp consent, organization affiliation/request/leave, tutorial achievement/XP detail, account-security/settings navigation, crop workflow and invite/share controls. | **PARTIAL** — `ProfileScreen.kt`, `ProfileViewModel.kt`, `ProgressScreen.kt`, `Profile.js` |
| Subscription | Android shows current subscription and cancel action. It has no plan catalog, upgrade/change-plan checkout, or real Play Billing restore; the view model documents Billing as planned for 1.1. | **PARTIAL / INTENTIONAL** — `SubscriptionScreen.kt`, `PaymentViewModel.kt`, `SubscriptionManagement.jsx`, `SubscriptionContext.js` |
| Public game viewer | Android has replay controls, result and players and now loads the unauthenticated `public/games/{id}`, so logged-out deep links work (2026-09-16; the endpoint itself was 404ing for every game and was fixed with it). Since 2026-09-17 it also orients the board from `publicShow`'s new `player_color` (with a flip toggle), shows date/moves/end reason/opening/time control, shares the web `/games/{id}/replay` URL, and has a Play CTA; not device-checked. | **DONE (unit-verified)** (was PARTIAL) — `PublicGameViewerScreen.kt`, `GameApi.kt`, `GameController::publicShow`, `PublicGameViewer.js` |
| Chat | Multiplayer Android chat has history/live messages, policy-aware presets/free text, filtered notice, report/block and unread state. Android has no equivalent of web computer-game synthetic chat/unread behavior. | **PARTIAL** — `PlayMultiplayerViewModel.kt`, `PlayMultiplayerScreen.kt`, `ChatPanel.js`, `GameChat.js`, `PlayComputer.js` |

### Prioritized follow-ups

- ~~**P0 correctness:** fix Learn lesson validation/completion, route Daily Challenge
  solving through a track-aware persisted submit/review flow, and make Public
  Game Viewer use the public API for logged-out links.~~ **Done 2026-09-16 —
  see "P0 correctness follow-ups" below.**
- **P1 parity:** add the daily leaderboard endpoint and persisted attempt/XP state;
  bring Tactical CCT/guide/video/navigation affordances and Leaderboard tactical
  category to Android; add Parent PGN export.
- **P2 completeness:** close the remaining Dashboard, Championship, Referral,
  Ambassador, Organization, Profile, Subscription and computer-chat omissions as
  the corresponding backend/payment/device acceptance work becomes available.

## Implementation status (2026-09-15)

Modules 1-3 are **implemented and verified on an emulator against production**.
Module 4's live Review toggle, per-move lifeline markers (Module 6) and the
multiplayer Best-move budget accounting are implemented. The remaining Module 4
follow-ups are device acceptance and the synthetic-opponent takeback hang.

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

## Module 4 status (2026-09-15)

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

- [x] Review toggle (best-move alternatives after each move) - Android
      `PlayMultiplayerScreen.kt` and `PlayMultiplayerViewModel.kt`; casual/learning only.
- [x] Best-move budget accounting (2026-09-16) - the casual/learning
      multiplayer Best toggle draws from the same `undoChancesRemaining` pool
      as takebacks on both clients; a charged reveal is persisted as a
      `best-move` marker in the move's `learning_help` (the lifeline-summary
      marker set), and the budget is rebuilt on reload/takeback-resync as
      `server remaining − persisted markers`. Web:
      `src/utils/multiplayerBestBudget.js` (+12 Jest tests), wiring in
      `PlayMultiplayer.js`; Android: `bestMoveSpend()` + a charged
      `setCctHintLevel` in `PlayMultiplayerViewModel.kt` (+9 JVM tests,
      `PlayMultiplayerBestBudgetTest`). Unit-level only — device acceptance
      still open. Evidence: docs/updates/2026_09_16_08_17_update.md.

## P0 correctness follow-ups (2026-09-16)

All three landed and are covered by unit/feature tests. Unit-level only — none
of this is device- or browser-accepted yet.

- [x] **Public game viewer loads through the public endpoint.**
      `PublicGameViewerViewModel.loadGame` calls the new
      `GameApi.getPublicGame` (`public/games/{id}`, outside `auth:sanctum`)
      instead of `gameApi.getGame`, so a shared link opened while logged out no
      longer 401s. The previously declared path `games/public/{id}` matched no
      route; the registered one is `routes/api.php:68`. Covered by
      `PublicGameViewerLoadTest` (3 JVM tests).

      **Found while testing — the endpoint 404'd for every game.**
      `GameController::publicShow` gated on `$game->status !== 'completed' &&
      !== 'ended'`, but `status` is an accessor over the `game_statuses`
      lookup whose only finished code is `finished`; `completed` is a
      *write-side* alias (`GameStatus::fromLegacy`). The guard therefore matched
      nothing and the whole public-replay feature — web `GameReplayPage.js:78`
      as well as Android — answered 404. Now compares with
      `GameStatusEnum::FINISHED`. New `tests/Feature/PublicGameViewerTest.php`
      (6 tests) covers the unauthenticated read, the canonical and legacy
      written statuses, the 401 on `games/{id}` that makes the public route
      necessary, and the aborted/in-progress/unknown 404s. The first run of that
      test reproduced the 404 before the fix.

- [x] **Learn lesson validation and completion are server-side.** Moves post to
      `tutorial/lessons/{id}/validate-move` with the real lesson id and the
      stage's `interactive_lesson_stages.id` (the placeholder `lessonId = 0` is
      gone), the lesson is started on load — `completeLesson` 404s without a
      progress row — and finishing posts `tutorial/lessons/{id}/complete` with
      web's score/seconds/attempts payload, with the failure surfaced and
      retryable. Theory slides have no server stage and stay local read-alongs.
      Covered by `TutorialLessonCompletionTest` (4 JVM tests).

- [x] **Daily Challenge submit/review is persisted, on its own leaderboard.**
      Solving today's challenge posts `tutorial/daily-challenge/submit`
      (`challenge_id`, `track`, the SAN line, seconds) and shows the server's
      verdict/XP; an already-completed challenge stays open for review and is
      not resubmitted; a failed submit says so rather than claiming a save. The
      hub's leaderboard reads `tutorial/daily-challenge/leaderboard` (today's
      fastest solves for the selected track) instead of the all-time rating
      endpoint — `TacticalApi` is no longer injected there at all — and the
      selected track is carried into the solver through a `?track=` nav arg.
      Covered by `DailyChallengeSolveTest` (7) and `DailyChallengesViewModelTest`
      (3).

      **Two solver defects fixed while testing.** (1) The daily solution is a
      list of the *player's* moves — the web compares the Nth move played with
      `solution[N]` and never auto-plays a reply (`DailyChallengePage.js:126`) —
      but Android ran it through the generic puzzle solver, which plays entry 1
      as the opponent's answer; a multi-move line would have submitted a short
      solution, and the SAN→UCI pre-conversion dropped such a challenge outright.
      The daily branch now matches SAN directly (`+`/`#` stripped, case
      insensitive, the same comparison `submitDailyChallenge` makes). (2) The
      submitted SAN was generated on the board *after* the move was made, so
      `Move.san()` disambiguated against the opponent's legal moves and could
      invent a file/rank prefix the server would reject; it is now read off a
      pre-move board. Written `challenge_data.hints` are also preferred over the
      synthesized from-square hint, and a failed bundled-asset read no longer
      takes the daily challenge down with it.

## Proposed implementation order

1. ~~**Lobby ELO range filter** (Module 1)~~ - done
2. ~~**Mode + time control when starting from Players tab** (Module 2)~~ - done
3. ~~**Learning chip in Quick Play** (Module 3)~~ - done
4. ~~**Undo lifeline + Learning header label in multiplayer** (Module 4)~~ - done; Review toggle and Best-move budget accounting are now also complete; synthetic-opponent takeback remains (see Module 4 status)
5. **Best-move entry point in Play vs Computer** (Module 5) - reuse `CCTBottomSheet`
6. ~~**Lifeline markers in Game Review** (Module 6)~~ - done; Android reads JSON/compact markers and shows per-move badges plus totals
7. Feature-level audit of the unaudited modules above
