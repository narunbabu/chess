# Experience implementation delta-spec

Owner authorisation: 2026-09-08, "Please implement this plan" (experience plan dated September 8). Implement the existing plan, preserving current architecture and user changes; no deployment, recruitment, payment, schema or SDK upgrade.

## Routing and baseline

Codex availability probe: OK, 12.5 seconds, September 8. Quota snapshot: 29% weekly used, age zero minutes. The script's Z.AI HTTP-200/code-404 result is not valid quota evidence. Use the available same-session Codex lane; critical agents use the documented Sol/high sideways route. Controller owns web product files, integration, status and records. Android workers own disjoint native files. No agent may change the website checkout, invoke Sites, deploy, migrate, commit user changes or edit STATUS.md.

The prior audit F1–F11 is the baseline. HEAD 2359d3a has existing uncommitted takeback backend work, web game-end Review and daily-streak changes. Preserve and extend those changes; do not reset/stash/commit them wholesale.

## Criticality and file ownership

- CRITICAL: auth logout, realtime event decoding, takeback state/budgets, local engine/timer lifecycle, best-move budget and game-review persistence. Wrong results affect account isolation or game correctness.
- CRITICAL: navigation shell/account routing (preserve auth, back stack and deep links); accessible move entry (must call existing legal-move validation).
- STANDARD: theme tokens, landing hierarchy, readable labels, responsive CSS, hub links and test scaffolding.
- Controller: all chess-frontend product edits and tests; integration docs/status. Coordinate backend tests/changes separately.
- Native navigation/auth/home worker: navigation, HomeScreen/HomeViewModel, theme and auth repository/session wiring, related tests only.
- Native gameplay worker: PlayComputerScreen/ViewModel, local review entry/storage, ChessBoardView accessibility, related tests only. Request controller coordination before changing NavGraph.
- Realtime worker: backend takeback work/tests and Android data/websocket + PlayMultiplayerViewModel/tests only. Return required web changes as recommendations (controller owns web).

## Required behavior

1. First-use casual computer tour opens before engine/clock activation. Dismiss/complete starts once, respecting colour; rated/live online clocks never pause for onboarding. Status describes real phase. Restart/cleanup cancels stale tour/start callbacks.
2. Keep backend canonical game.undo.* and draw.offer.* names. Clients match exact names. Ignore own undo-request echo; authoritative accepted state replaces board and remaining budget once; failures, expiry and reconnect recover pending UI. Existing backend synthetic/expiry/rollback changes must be tested, not replaced blindly.
3. All Android Logout entries clear local token and account-scoped state, cancel stale account work and navigate only after clearing; server revoke is bounded/best-effort and cannot strand offline logout. Relaunch/protected deep links cannot resurrect prior auth.
4. Four top-level destinations: Play, Learn, Compete, You. Preserve existing routes and auth/age gates; route-derived selected state, save/restore tabs, one clear Back behavior; focused gameplay excludes nav. Community stays secondary and adult-gated. First Home content is resume/start, not oversized marketing.
5. Tokens preserve green/cream identity; dark action green supports white text; meaningful labels >=14px web, body >=16px, 44px web actions and 48dp native controls. Keep board square colors. No dependency additions for basic layout.
6. Computer setup defaults are useful and colour choices explicit. No engine depth jargon in primary copy. Label computer personas/fallback honestly; preserve rated mode and difficulty semantics.
7. Local Android eligible games expose Best and Undo, sharing the existing learning budget; no assistance in rated games; async stale engine replies must not paint/charge a new position. Result has Review game + Play again + Share; local/guest review survives restart and failed remote save. Existing web Review implementation must stay intact.
8. Accessible board lets a user select a square/piece and legal destination, including promotion, via keyboard/TalkBack or equivalent semantic move-entry UI; retains gesture play and existing rules. No overlapping invisible square targets.
9. Resume/nearby loading distinguishes failure from empty; preserves cached games and offers Retry without blocking offline computer play.
10. Learn and You hubs consolidate existing lesson/practice and progress/history entry points without inventing data or removing entitlement restrictions. Preserve advanced routes through secondary navigation.

## Verification

Pin each changed defect with targeted tests including its negative/failure path. First-run timer fake time, black/white and rated cases; event decoding and self-echo/expiry; offline logout/relaunch; tab selected-route/Back; help budget/stale result; correct completed-game replay; inaccessible-board alternatives and legal promotion; failed resume fetch preserves cards. Run frontend build/lint/typecheck/unit and focused E2E, Android compile/unit/lint, backend relevant tests. Use a fresh-context review after mechanical tests. Do not claim phone or two-client realtime verification unless actually performed. No release gate passes with unverified P1s; full remaining scope remains in STATUS rather than a claim of completion.

## Visual blueprint accepted by the approved plan

Home: compact brand/navigation, Resume if present, Start game primary, Continue learning secondary, small progress link. Setup: game choice, clear difficulty and colour, advanced mode/time, Start. Board: player/clock, largest fitting square board, own clock and compact actions, moves/coaching below/on side according to viewport. Result: reason + Review primary + Play again secondary. This is an extension of the existing design, not a replacement site or hosting migration.
