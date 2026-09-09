# Chess99 web + Android experience improvement plan

Date: 2026-09-08. Status: **PROPOSED — owner review, not implementation or release approval.**

## Scope and routing

Improve appearance, functionality and ease of use around one complete loop: **start a game → play confidently → review → improve → return**. Keep the existing Chess99 identity and React/Laravel/native Compose architecture. Community programmes remain a secondary backlog, not the main navigation or this release's acquisition message.

| Workstream | Production role / tier | Current allocation / availability |
|---|---|---|
| Evidence gathering, UX audit, proposed plan | Asha / Tara / Ravi / Sana / Omar lenses; A-plan work | Current Codex session; operational. No separately allocated model lane. Quota lookup returned no result; no external lane capacity claimed. |
| Auth, game timing, event contracts, persisted game state | Arjun / A-impl | Not allocated; approved delta-spec and fresh lane check required before build. |
| Visual components, copy, responsive layout | Leo / B | Not allocated; use the current MODEL_ROUTING.md when approved. |
| Independent runtime verification and release review | Sana / Tara / Omar / Divya; fresh A-plan context | Not performed or approved by this planning session. |

This is INTAKE → AUDIT → proposed PLAN → RECORD. It does not pass the SPEC, BUILD, VERIFY or deployment gates. No application code, schema, production settings or user accounts were changed.

## Evidence and limits

- **Live observed:** desktop guest journey on [chess99.com](https://chess99.com/): landing page, game setup, countdown, game board and first-use tour. Browser was shown visibly. No authenticated or human-opponent game was created.
- **Current source inspected:** web landing/header/game container/computer game/event subscriptions; Android home/navigation/theme, computer-game controls/results, multiplayer event handling, board accessibility, learning hub, home data loading and logout wiring; corresponding backend event names.
- **Historical visual reference only:** Android `play-store-assets/screenshots/01-home.png` and `05-play-vs-computer.png`, dated July 14. The latter predates later theme/mode improvements. These are not screenshots of today's APK.
- **Not verified today:** Android on-device behavior (`adb devices -l` returned no devices); small-screen web layouts; authenticated web/dashboard/learning journeys; end-to-end multiplayer; production deployment of local patches; release configuration. Browser control repeatedly timed out after the tour opened, so no complete game or post-game runtime result is claimed. The control-tool timeout is not classified as an application defect.
- Baseline HEAD: `2359d3a`. Existing uncommitted changes include takeback/backend contracts, daily streaks, web game-end Review and Header. Preserve and coordinate these; do not overwrite or rebuild already-started features.
- Older documentation is useful history, not a present-day pass certificate. `docs/context.md` is dated December 2025; July quality findings about missing piece art/Stockfish have subsequently been marked resolved. Route-count parity is not interaction parity.

## Audit: what should change first

P1 = major functional, trust or accessibility failure; P2 = usability/quality gap; P3 = minor polish. No new P0 is established by this limited review. This is not an all-clear for unaudited areas.

| ID / priority | Finding and evidence | Proposed correction |
|---|---|---|
| F1 · P1 · live + source | First-use tour covers an already-running game. White's clock was **09:19**, then **07:53**, with zero moves and tour step 1 still open; the side panel still said “Setup your game and press Start.” `PlayComputer.js:2301` opens the tour on a delay while `:2331` starts the clock. | Teach before starting the clock. For local casual practice, do not start either engine turn or timer until Start/Skip; never let a tutorial pause a live rated/online clock. Derive status copy from actual game phase. |
| F2 · P1 · source | Backend emits `game.undo.request/accepted/declined`; web subscribes to `.undo.request/accepted/declined` (`WebSocketGameService.js:232`); Android binds the unprefixed names (`GameWebSocketService.kt:126`). Android also binds `draw.offered` while backend emits `draw.offer.sent`. | Finish the existing cross-client contract repair, not a duplicate implementation. Verify delivery to both clients, not merely HTTP success. |
| F3 · P1 · source | Android Home/Drawer Logout ultimately only navigates to Login (`NavGraph.kt:187`). The repository's local-session clearing exists (`AuthRepositoryImpl.kt:76`) but this route does not call it. Startup still trusts the retained token (`presentation/MainActivity.kt:57`). | Wire one real logout operation, clear local auth and user-scoped caches even offline, then navigate. Verify restart/back/deep-link cannot restore the prior account without authentication. Do not claim this was reproduced on a device. |
| F4 · P1 · source | Android `PlayComputerScreen.kt:325` promises Best-move help, but its gameplay controls at `:497` only expose Undo and Resign. Its result card at `:550` exposes New Game/Share, not Review. | Complete eligible-mode Best help and direct post-game Review, including the local/guest path. Reuse existing engine/review systems; preserve rated restrictions and help budgets. |
| F5 · P1 · source accessibility | Android board is a Canvas with one description and pointer gestures (`ChessBoardView.kt:220`); no square-level selection/action semantics are exposed there. Web's observed board tree also did not expose actionable named squares. | Add an operable accessible board or equivalent move-entry mode. Screen-reader/keyboard users must be able to choose a piece and legal destination, not merely hear “chess board.” Web keyboard capability still needs runtime testing. |
| F6 · P2 · live + source | Landing page prioritizes “Login and Play” over guest play, then displays nine advanced play/learning choices including CCT/Best/Companion and engine terminology. Guest setup shows “depth 3” and a White/Black checkbox. | One clear “Try a game” primary action; secondary “Sign in.” Three plain-language play choices. Keep expert settings and coaching explanations contextual. Use explicit colour choices rather than an ambiguous on/off switch. |
| F7 · P2 · source + historical visual | Android bottom navigation lives only inside Home; Lobby/Learn/Profile navigate to separate screens. `selectedTab` can still mark Learn/Profile when back returns to Home's always-rendered PlayTab (`HomeScreen.kt:57–139`, `NavGraph.kt:167–179`). Home also duplicates destinations through a large hero, Explore grid and drawer. | Build a real persistent top-level shell; selection derives from route. Reduce duplicate navigation, shorten the hero, move Logout into account settings. Keep focused gameplay outside the shell. |
| F8 · P2 · measured source colours | White on web `#81b64c` is **2.41:1** (`LandingPage.js:111,278`); Android white on primary `#769656` is **3.35:1** (`Theme.kt`). These are colour-pair calculations, not a whole-app accessibility score. | Use a darker action-green with white text, or dark text on light green. Audit real usages, hover/focus/disabled states and both themes; retain recognisable board colours. |
| F9 · P2 · source | Android Home hides resume/opponent sections on failed loads (`HomeViewModel.kt:182–209,254`; `HomeScreen.kt:333`). An unavailable service looks like no games to continue. | Distinguish loading, genuinely empty, cached/stale and failed states; preserve known games and give a small Retry message. Keep offline computer play available. |
| F10 · P2 · live + source | Live computer setup turns into a named/avatar opponent without an equally clear Computer label in the observed board text. Android “real players” copy also sits above a flow with synthetic fallback (`HomeScreen.kt:327`; `LobbyViewModel.kt`). | Label computer opponents and matchmaking fallback honestly. Use “Players near your rating,” not wording that suggests physical proximity. Do not count computer availability as humans online. |
| F11 · P2 · source / follow-up required | Learning is split into Tutorials/Training, Puzzles/Tactical, Daily and separate progress/history destinations. Existing parity audit still lists many modules unaudited. | One Learn hub with “Continue lesson” and “Today's practice”; one Progress hub with recent game review. Audit actual controls and completion paths before expanding content. |

**Important existing-work nuance:** `GameRoomService.php` already contains uncommitted synthetic-opponent undo auto-accept/rollback and expiry work. The wire-name mismatches remain in the source inspected today, and Android's pending-request path (`PlayMultiplayerViewModel.kt:714`) has no recovery timer there. Finish and verify this slice together. Likewise, web single-player game-end Review already has a September 2 local patch; extend/verify it rather than starting it again. The two uses of “Review” are different: live post-move coaching versus replaying a finished game.

## Product and visual direction

**Keep:** the playable landing board, recognisable green/cream chess palette, bundled piece art, native Android, guest computer play, existing lessons/puzzles/replay, and existing rules/rating logic.

**Improve:** hierarchy and consistency. Use one primary action per screen, fewer simultaneous panels, comfortable text, consistent icons, restrained animation and clear feedback. No new mascot/art generation or technology rewrite is necessary for this first programme.

- Define shared semantic tokens: page/surface/text/muted/border/action/success/warning/error; spacing 4/8/12/16/24/32; small, consistent radius and type scales. Implement separately in CSS and Compose, with the same naming and intent.
- Support light and dark appearances with deliberate colour pairs. Keep the present default until the owner sees both options; do not silently switch everyone's theme.
- Reserve green for primary actions and gold for achievement/accent. Stop mixing decorative emoji, unrelated icon styles and multiple equally prominent buttons.
- Web desktop: board gets the main space; clocks/player identity adjacent; moves and coaching in one secondary panel. Phone: board and clocks first, a compact control row, then a bottom sheet for details. Avoid side panels shrinking the board into a small centre column.
- Compress returning-user Home: Resume game first when applicable; otherwise Start a game; then Continue learning and one small progress summary. Pricing, organisations and community must not compete with the first move.
- Plain labels: “Hint / Best move,” “Take back,” “Coach: checks, captures and threats,” “Review game.” Distinguish instant local undo from an opponent takeback request. Beginner/Easy/Medium/Hard are enough before Advanced; engine depth is implementation detail.

### Target navigation

| Main destination | What belongs here |
|---|---|
| Play | Resume, Play computer, Play online, Play a friend; advanced setup beneath these choices |
| Learn | Continue lesson, daily practice, puzzles; drills/tactical progression under one organised hub |
| Compete | Tournaments, invitations, next match and leaderboard |
| You | Progress, game history/review, profile and settings; parent/organisation/subscription entries as applicable |

Use these four destinations as web top navigation and Android/mobile-web bottom navigation. Preserve old URLs/deep links and entitlement/age checks. Lobby becomes a Play subdestination, not a competing main tab. Hide the global shell during a live game if needed for board space, with a safe return/resume path. Community lives under an adult-only secondary entry in You/More, not a fifth primary tab.

## Delivery plan

The sizes below are provisional engineering effort, not promised calendar dates. Budget roughly **3–5 development weeks** for the focused core and verification, then re-estimate the wider parity backlog. Owner configuration, device access and production rollout are separate dependencies.

### Stage 0 — trust and correctness (first; approximately 3–5 days)

Scope: F1–F3 and the current takeback patch. Confirm the running Android build and gather fresh screenshots of the six critical journeys before changing their layouts.

- Start/Skip tutorial before local game timing/engine turns; accurate turn/check/reconnect/status text.
- Match actual backend event names across web/Android; human accept/decline, expiry and synthetic auto-response handled consistently. Reconcile position, clocks and remaining help once, including duplicate/out-of-order delivery.
- Real Android logout with predictable offline handling; avoid falsely displaying successful logout while retaining the account.
- Recheck production/frontend/backend version alignment. Carry forward Firebase/OAuth/App Links/release concerns as **unverified historical blockers**, not newly verified facts.

Exit: targeted failing-before/passing-after tests plus web↔web, Android↔Android and web↔Android runtime demonstrations on a test backend. No production user games used as fixtures. No P1 knowingly left in the slice being released.

### Stage 1 — navigation, first play and visual foundation (approximately 4–6 days)

Scope: F6–F10; approve static screen designs for Home, setup and board before code.

- Apply shared tokens and readable action colours; refactor one component at a time.
- Four-destination shell; route-driven Android selection, preserved tab state and predictable Back.
- Short guest entry and remembered, sensible game defaults. Place mode/rating impact, colour and time settings together. Show advanced options on demand.
- Clear computer/human identity and matchmaking states: searching, found, cancelled, unavailable, fallback offered.
- Restore/Retry affordances; distinguish offline from an empty account. Move logout out of the primary game header.

Exit: a newcomer can find guest play and reach a ready board in no more than three deliberate actions with defaults, excluding first-run consent if required; no tutorial consumes clock time. Top-level navigation remains visible outside focused gameplay and selected state always matches content.

### Stage 2 — board, help and post-game loop (approximately 5–8 days)

Scope: F4–F5 plus core gameplay parity and responsive board layout.

- Board, clocks, turn/check indication, captured pieces and actions get a stable hierarchy; no control clipping on short phones or at increased font size.
- Keep tap-to-select and drag moves. Provide keyboard/screen-reader selection, legal targets, promotion and confirmation/error announcements. Never rely on colour alone.
- Keep rated games assistance-free. Make eligible coaching discoverable without opening multiple stacked panels. Clearly show remaining budget and unavailable reasons; prevent double charging on retries.
- Add Android Best where promised, direct Review game from every completed-game surface, and per-move help markers where supported. Preserve September 2 web Review work and local/guest review data.
- Result layout: result + reason; **Review game** primary, **Play again** secondary, Share tertiary. “Play again” must retain setup or clearly offer changes. Avoid a full-screen celebration blocking the next action.
- On reconnect/background/restart, restore the authoritative board/clock/result or show an honest recoverable state. A failed save must not discard a locally reviewable finished game.

Exit: guest and signed-in computer games can finish → review → play again; rated/casual/learning restrictions remain correct. Two-client takeback and reconnect tests still pass after visual changes.

### Stage 3 — learning, progress and release polish (approximately 3–5 days, then device QA)

- Consolidate Learn entry points without removing working lessons. Show the next useful lesson/practice and completion feedback; retain progress across sessions.
- Progress answers “Am I improving?” with a clearly labelled rating trend, recent results and a recommended next activity, not a wall of counters. Empty users get a useful first step, not misleading zero statistics after errors.
- Make tournament status/action obvious: registration, upcoming match, join when ready, completed results. Audit remaining modules control-by-control; separately scope gaps too large for this programme.
- Complete core-screen resource strings, loading/error copy, touch/keyboard checks, tablet/landscape layouts and reduced-motion behavior. Re-capture store screenshots only from the verified final build.

Exit: approved usability checklist and release gates; no claim that screen-count parity proves functionality. Release through the existing owner/WTM/SMA process, not directly from this task.

## Acceptance tests that pin the observed gaps

| Test | Defect the test must expose on today's code / requirement it verifies |
|---|---|
| First-use clock | Open a fresh guest game, leave tour open for 30 seconds: no local clock/engine consumption before intentional start; after start status says whose turn it is. Today's clock runs under the tour. |
| Cross-client takeback/draw | Assert the actual emitted wire name reaches the other web/Android client; accept/decline/expire; synthetic response; duplicate request/delivery. An HTTP 200 or matching backend-only fixture is insufficient. |
| Logout and relaunch | Home and drawer Logout must clear local session; restart and protected deep link require auth, including offline logout. Today's callbacks only navigate. |
| Mode-specific help | Android local computer Learning exposes working Best and Undo with the approved budget; rated forbids both. Today's setup advertises a missing Best control. |
| Result continuity | Finish guest/local and signed-in games; Review opens the correct move sequence; reload/restart preserves review; Play again preserves intended setup. Today's Android local result has no Review action. |
| Top-level navigation | Play → Learn → Back and Play → Profile → Back always show matching content/selected tab; top-level navigation is present where designed. Today's selection state and content can disagree. |
| Resume-load failure | Known active game, then timeout/500/offline: retain cached card or explain unavailable with Retry; never silently turn failure into “no games.” |
| Board accessibility | Make a legal move, undo when allowed and choose promotion with keyboard and TalkBack; square/piece/turn/check are understandable. A single canvas description does not pass. |
| Visual regression | Home/setup/board/result/Learn/You at 360×640, 390×844, tablet and desktop; increased text size; light/dark; long names, errors and slow connection. These are proposed validation sizes, not tested results. |

Text targets: at least 4.5:1 for ordinary text and 3:1 for qualifying large text, following [W3C contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). Android action controls should have at least 48dp touch areas per [Compose accessibility guidance](https://developer.android.com/develop/ui/compose/accessibility/api-defaults); inspect effective touch areas, not just icon dimensions. Dense board squares need an explicit accessible interaction solution rather than overlapping expanded targets. Web action buttons target 44px as a product design goal.

Run existing frontend build/unit/lint/typecheck/E2E and Android unit/lint/instrumented tests for changed slices. Run relevant backend tests for contracts/auth/game-state changes. Use migration dry-run before any future schema action; none is proposed for the visual foundation. Capture actual exit codes and build identifiers. Add a physical arm64 Stockfish run, slow-network/reconnect run and owner walkthrough before release.

## Scope control and community programmes

- **Must:** repair first-run timing/event/session issues; simplify first play/navigation; readable shared styling; usable board; reliable review loop; real runtime verification.
- **Should:** consolidated Learn/Progress, clearer tournament next actions, consistent recovery and offline states, core-screen localisation readiness.
- **Could later:** additional board themes, broader language/content work, deeper personalisation, advanced analysis presentation.
- **Won't in this programme:** framework/engine rewrite, new monetisation, large feature expansion, automatic payouts, recruitment campaign, store upload or production deployment.

Retain the existing tester/promoter work. When resumed, put it behind the adult account area and separately audit identity/Ameyem registration, capacity rules, referral attribution, duplicate/fraud checks, owner review and monthly payout accounting. Preserve the earlier intention of **no more than 20 members** and **up to ₹5,000/month**, but resolve whether the cap covers both roles or promoters only and how earnings are actually calculated before publishing commitments. No guaranteed salary or payment for positive public reviews. This turn does not approve recruitment copy, create jobs, enroll anyone, transfer money, or claim community pages are deployed.

## Recommended approval point

Approve **Stage 0 + Stage 1** first, keeping the Chess99 brand and the four-destination navigation. Before implementation, write the multi-module delta-spec and approve Home/setup/board designs. Reuse the current takeback, streak and game-end patches with their existing owners. Review the improved first-game build before authorising the wider learning/community scope.

MODELS: Codex (current session, review and planning only); no delegated build or independent verification run.
