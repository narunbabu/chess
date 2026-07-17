# Chess99 Android Quality Fix Program — Master Plan

**Date:** 2026-07-14
**Source:** `docs/reviews/2026_07_14_android_app_quality_review.md` (3.5/10, NO-GO verdict; 57 screenshots in `chess99-android/review-artifacts/`)
**Goal:** take the Android app from NO-GO to owner green-signal for Play Store v1.
**Audience:** implementation agents. Each spec in this folder is self-contained —
read the spec you are assigned plus this master plan. Line numbers in specs were
verified on 2026-07-14; re-verify before editing (the tree moves).

---

## Workstreams

| Spec | Title | Priority | Platform | Est. | Depends on |
|------|-------|----------|----------|------|-----------|
| S1 | Tactical puzzle normalization + scoring integrity | **P0** | Android | 1 d | — |
| S2 | Stockfish engine bundling (all ABIs) | **P0** | Android | 1–2 d | — |
| S3 | Release data-layer fixes (spinners, crashes, error copy) | **P0** | Android | 1 d | — |
| S4 | Native legal pages (Privacy/Terms) + E-Book removal | **P0** | Android | 0.5 d | — |
| S5 | Learn/Tutorials contract fix + Learn IA | **P0** | Android (+verify backend) | 1 d | — |
| S6 | Real bottom navigation + drawer curation + logout | P1 | Android | 1–2 d | S3 merged first (shared files) |
| S7 | First-run onboarding | P1 | Android | 1 d | — |
| S8 | Streaks v1 + Home hero personalization | P1 | Android + backend | 1–2 d | S3 (Dashboard loaders) |
| S9 | Quick-wins polish bundle (18 items) | P1/P2 | Android | 1–2 d | S3 for two items (noted inline) |
| S10 | Lobby liquidity + bot personas | P1 | Android (+backend check) | 2–3 d | **S2** |

**Suggested execution order:** S1 ∥ S2 ∥ S4 (independent) → S3 → S5 → S9 → S6 → S7 → S8 → S10.
S1, S2, S3, S4, S5 are the launch blockers; S6–S10 are the "exceptional app" tier.

---

## Wave 2 (added 2026-07-15)

**Sources:** follow-up review `docs/reviews/2026_07_15_android_followup_review.md`
(3.5 → 6.4/10, CONDITIONAL GO) and web-vs-Android gap analysis
`docs/reviews/2026_07_15_web_vs_android_gap_analysis.md`, plus a 2026-07-15
three-way code investigation (Android / web / backend) whose facts are baked
into each spec. **S10 was rewritten in place** to the web-validated
"Nearby Opponents" pattern (the backend capability question in its old T1 is
now answered inside the spec). **S7 was amended** with verbatim landing-page
copy.

| Spec | Title | Priority | Platform | Est. | Depends on |
|------|-------|----------|----------|------|-----------|
| S11 | Error-copy completion (AuthViewModel) + game-abandonment guard | **P1** | Android | 0.5 d | — |
| S12 | Home "Continue playing" section + first Home ViewModel | **P1** | Android | 1 d | — |
| S13 | Friends request management UI (accept/decline/remove) | P1 | Android | 1 d | — |
| S14 | Remove Training-Exercise stubs (Endgame Drills / Opening Explorer) | **P1** | Android | 0.5 d | — |
| S10 v2 | Nearby Opponents + real synthetic games + bot personas | P1 | Android | 2–3 d | S2 (done), **S12** |
| S15 | Ambassador adult gate | **P1** (kid safety) | Backend + web + Android | 1 d | — |
| S16 | Web session stability + small web fixes | P1 | Web | 1 d | — |

**Suggested execution order:** S11 ∥ S14 (small, independent) → S12 → S13 →
S10 v2. S15 and S16 are independent of the Android chain and can run anytime
(S15 backend first, then its client tasks). S6–S8 from Wave 1 remain pending
and are unaffected; sequence them before or after Wave 2 at the owner's
preference — S7 should land before any store submission.

### Corrections to the 2026-07-15 gap analysis (verified in code — do not re-open)

- **PGN export already exists on Android** (generate + server fetch + share:
  `GameHistoryViewModel.kt:448-531`, `ShareManager.kt:280-310`, UI in
  GameReviewScreen/GameHistoryScreen). No spec needed. (Web's own server-PGN
  call is broken by a double `/api/api/` prefix — fixed in S16 T4.)
- **The follow-up review's "21 `e.message` sites" are already remediated** —
  all now use `friendlyError()`. The true remainder (8 sites in
  `AuthViewModel.kt` + 1 verbatim WebSocket string) is S11's scope.
- **Friends**: Android's API layer is complete (`MatchmakingApi.kt:82-101`);
  only the incoming-request/remove UI is missing → S13 is UI-only.
- **Training Drills / Opening Explorer**: confirmed stubs that 422 against the
  backend and praise any legal move → removed by S14, real drills parked in
  the post-v1 backlog.

### Wave 2 additions to the post-v1 backlog

- Real Endgame Drills / Opening Explorer content (S14 removed the stubs).
- Guardian-consent enrollment path for the Ambassador program
  (`guardian_consent_at` field exists; S15 gates adults-only for now).
- Outgoing-pending friend requests (needs a new backend endpoint; neither
  platform has it today).
- Sub-800 beginner bots are client-fabricated on web
  (`syntheticMatchPlayers.js`) — consider absorbing into the backend so
  Android inherits them (S10 v2 works without this).

### Post-v1 backlog (do NOT build now; listed so nobody invents scope)
- Delight layer: mascot, confetti on solve/level-up (a minimal confetti on puzzle
  solve is an optional task inside S1), sound design, XP path map.
- Parent dashboard port (web `ParentDashboardController` parity).
- Puzzle Rush / timed duel modes (Tier-1 competitive plan).
- Native E-Book reader (data already bundled at `chess-frontend/src/data/ebooks/v2/`).
- Push notifications parity (web backend already sends play-reminder emails).

---

## Global guardrails (every agent, every spec)

1. **Commands run via PowerShell only**: `powershell.exe -Command "..."`. Never bare bash for project ops.
2. **Never commit, push, deploy, or upload** anything. Owner has an explicit
   Play-upload HOLD. Leave work uncommitted in the tree.
3. **Do not regress the new theme** (`presentation/theme/Theme.kt`) or the
   redesigned Home (`presentation/home/HomeScreen.kt`) — they were just approved.
   New UI must use MaterialTheme color roles, not hardcoded `Color(0x…)`.
4. **Production caution**: the release build points at `api.chess99.com` (live).
   When verifying on-device: browse/solve puzzles freely; do NOT create
   tournaments/orgs, send chat, alter profile data, or touch payments.
5. **Test credentials** for on-device verification are in the project `CLAUDE.md`
   ("Test Credentials"). Never print them into reports or code.
6. **User-facing error text must never contain `e.message`**, class names, or raw
   enums. This is a kids app.
7. Match existing code style (Compose + Hilt + StateFlow UiState pattern; Timber
   for logging).

## Mandatory verification gate (Android specs)

Debug builds hid every bug in the review. **All verification happens on the
signed RELEASE build against production.**

```powershell
# 1. Compile + lint
powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess99-android'; .\gradlew.bat compileReleaseKotlin lintRelease"
# 2. Build + install (emulator-5554 must be running)
powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess99-android'; .\gradlew.bat assembleRelease"
powershell.exe -Command "& 'C:\Users\ab\AppData\Local\Android\Sdk\platform-tools\adb.exe' install -r 'C:\ArunApps\Chess-Web\chess99-android\app\build\outputs\apk\release\app-release.apk'"
# 3. Walk the changed screens; screencap evidence:
powershell.exe -Command "& 'C:\Users\ab\AppData\Local\Android\Sdk\platform-tools\adb.exe' shell screencap -p /sdcard/s.png; & 'C:\Users\ab\AppData\Local\Android\Sdk\platform-tools\adb.exe' pull /sdcard/s.png 'C:\ArunApps\Chess-Web\chess99-android\review-artifacts\fix-<spec>-<name>.png'"
```

Gates: `lintRelease` 0 errors; every acceptance criterion in the spec verified
**on-device on the release build** with a screenshot saved to
`review-artifacts/fix-<spec>-*.png`. Report completion as:
`TASK COMPLETE: <spec-id> | Build ✅ | Lint 0 errors | AC 1..N ✅ (screenshots)`.

For web changes (only S1 cross-check): `powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess-frontend'; pnpm build"`.
For backend changes (S8, maybe S5): `powershell.exe -Command "cd 'C:\ArunApps\Chess-Web\chess-backend'; php artisan test"` and `php artisan migrate --pretend` before any migration (schema changes need owner approval).

## Release-build smoke checklist (run after ALL P0 specs land)

Walk each destination on the release build against prod; each must reach a
terminal state (content OR friendly error with Retry) in <10 s, no spinner-forever,
no raw exception text, no empty legal pages:

Home (all 4 tabs) · drawer: Dashboard, Championships, Tournament Invites,
Leaderboard, Daily, Game History, Organizations, Referrals, Ambassador, My Plan,
Privacy, Terms · Learn Tutorials (open a module → open a lesson) · Tactical
Trainer (solve one puzzle — verify the solution makes chess sense and score
reflects mistakes) · Play vs Computer (full game start, engine replies) ·
Game History (open a game review) · Profile (all tabs incl. Stats) · Logout →
Login → log back in.

This checklist is the definition of "ready to re-screenshot and ask the owner
for the green signal." The review found 9 release-visible breaks in one pass —
nothing ships until this walk is clean.
