# Chess99 Android — Production-Readiness & Web-Parity Audit

**Date:** 2026-07-26
**Scope:** `chess99-android/` (package `com.chess99.app`, versionName 1.0.0, versionCode 1)
vs `chess-frontend/` (chess99.com SPA)
**Method:** source + config audit, route inventory diff, upload-key fingerprint check,
offline `:app:assembleRelease` verification. No device/emulator run this pass.
**Prior art:** `2026-07-17-android-play-readiness-ux.md`, `2026_07_15_web_vs_android_gap_analysis.md`,
`android-play-store-release-plan.md`, Cycles 1–11 (git, through 2026-07-18).

---

## 2026-07-27 closure update

The implementation blockers identified below are now closed in the worktree:

- Release builds fail fast while Firebase/OAuth production configuration is
  missing; the Google button is hidden in non-production-configured builds.
- Android chat now consumes the server kill switch, restricts every minor to
  kid-safe quick chat, and provides per-message report plus player blocking.
- The complete GPLv3 text, an in-app open-source notice, exact Stockfish 11
  source revision/build provenance, and binary hashes are tracked.
- Logged-out reset/referral links work; authenticated destinations resume after
  login; App Links claim only supported routes; `/r/{code}` is supported.
- Puzzles fall back to the five bundled tactical sets and continue offline.
- `compileSdk`/`targetSdk` are 36 and the build uses the minimum compatible
  AGP 8.9.1 with Gradle 8.11.1.
- Eight JVM tests now cover chat policy and deep-link routing. Three backend
  feature tests cover the kill switch and native-vs-web CAPTCHA boundary.

Verification on 2026-07-27:

- `:app:testDebugUnitTest`: 8 passed.
- `:app:lintDebug`: 0 errors, 118 existing warnings.
- `:app:assembleDebug`: passed; APK 28,920,935 bytes.
- Backend: 315 passed / 4,055 assertions; 158 existing skips and one existing
  risky test; `migrate --pretend` reports nothing pending.
- `:app:verifyReleaseConfiguration`: expected failure, listing the remaining
  external inputs instead of allowing a broken release artifact.

The codebase is ready for release-candidate generation, but it is **not ready
for Play upload** until the production `google-services.json` is supplied and
the upload/Play signing SHA-1s are registered for the configured Google web
OAuth client. After Play App Signing enrollment, its signing SHA-256 must also
be appended to `assetlinks.json` and deployed.
The original findings below are retained as the audit record.

---

## 1. Verdict

**Feature parity: essentially done. Release readiness: 4 blockers open.**

The parity programme worked. Every gap named in the 2026-07-15 analysis is closed
except the ones that were closed *deliberately*: Friends now has full
send/accept/decline + pending requests (`LobbyViewModel.kt:193,543,555,573`), PGN
copy **and** file export exist (`GameReviewScreen.kt:74–94`, `ShareManager.kt:395`),
rating history is a real chart (`UserProgressCharts.kt`, `RatingHistoryScreen.kt`),
Stockfish ships as three ABIs (~1 MB each under `app/src/main/jniLibs/`), and the
dashboard carries active games, daily-quota and W/L/D. `:app:assembleRelease`
builds green with R8 + resource shrinking on → `app-release.apk` 6.3 MB.

What stops a submission is **configuration and compliance, not features**. Three of
the four blockers are one-file fixes; the fourth (chat safety) is the same P0 the
2026-07-17 review raised and is still untouched in the Android client.

**Correction to STATUS.md:** its top TODO, "Bundle Stockfish for Android", is
already done — the binaries and `abiFilters` are in place.

---

## 2. Release blockers

### B1 — `google-services.json` is a placeholder
`app/google-services.json` declares project `chess99-placeholder`, project number
`000000000000`, api key `placeholder-api-key-for-compilation`, and an **empty
`oauth_client` array**. It is well-formed enough for the Gradle plugin to accept,
so the build passes and the failure is invisible until runtime. Consequences:

- **FCM push is dead** — `Chess99FirebaseMessagingService` can never register a
  token, so game invites, move-made and tournament notifications never arrive.
  This is the app's only re-engagement channel.
- **Crashlytics reports nothing** — you would launch with no crash telemetry, on a
  minified build, which is the worst possible combination for a 1.0.
- **Analytics reports nothing** — yet Firebase Analytics must still be declared on
  the Data Safety form, so the declaration and the reality diverge.

### B2 — Google Sign-In cannot work
`GoogleSignInHelper.signIn()` reflectively reads `BuildConfig.GOOGLE_SERVER_CLIENT_ID`
(`:47–54`); **no such `buildConfigField` exists** in `app/build.gradle.kts`. The
catch branch logs a warning and continues with an empty server client ID, so
Credential Manager throws. `LoginScreen.kt:188–196` renders "Sign in with Google"
unconditionally — a permanently broken button on the first screen a Play reviewer
sees. Fix needs the real web client ID from the Firebase/GCP project (so B1 first),
plus the release + Play-signing SHA-1s registered there.

### B3 — In-game chat has no moderation and no minor gate (still open)
Web reached parity in the other direction here: `chess-frontend/src/components/play/ChatPanel.js`
has per-message **Report** and **Block** affordances (`:85–104`) and a
`blocked: 'Chat is blocked between these players.'` state. Android's
`PlayMultiplayerScreen.kt` still renders an unconditional chat toggle (`:210–220`)
and a free-text panel (`:756–849`) with **no report, block or mute control and no
`isMinor` check** — grepping `Report|Block|Mute|canned|isMinor` across
`presentation/game/` returns nothing. Play's UGC policy requires in-app
report+block; Families expects child communication to be restricted or moderated.
Cheapest compliant fix: port the web panel's two icon actions, and serve canned
phrases only when `isMinor`.

Related: `FeatureFlagManager` already defines `chat_enabled` — but the class is
**never injected anywhere** (only self-references and one comment). There is no
server kill-switch for chat today, despite the code implying one.

### B4 — GPLv3 obligations for the bundled Stockfish are unmet
Three `libstockfish.so` binaries are shipped and `exec`'d directly
(`StockfishBridge.kt`). Stockfish 11 is GPLv3, so distribution requires the licence
text and a written offer of (or access to) the corresponding source. Today:

- No Stockfish/GPL/open-source notice anywhere in the app — `LegalScreens.kt` and
  `AboutContactDialog.kt` contain none.
- `LegalScreens.kt:357` asserts the opposite: content "is owned by Chess99 or its
  licensors and is protected by intellectual-property laws."
- `third_party/` — the sources the binaries were compiled from — is **gitignored**,
  so the repo cannot substantiate a source offer.

Fix: an "Open-source licences" screen with the GPLv3 text and a source URL, and
track the exact Stockfish revision (submodule, or a pinned tarball hash).

---

## 3. High-priority defects (not strictly blockers)

1. **Deep links dropped when logged out.** `MainActivity.handleDeepLinkIntent`
   returns early on `!tokenManager.isLoggedIn()` (`:85`) — which kills exactly the
   two links that only matter to logged-out users: password reset and
   `/join/{code}` referral. Both parse fine in `DeepLinkHandler`; they are thrown
   away one layer up.
2. **The app claims all of chess99.com.** The `autoVerify` intent-filter has a host
   and no `pathPrefix`, so once verified, *every* chess99.com link opens the app.
   Unhandled paths (`/pricing`, `/ebook`, `/training`, `/r/{code}`) parse to `null`
   and the user lands on Home instead of the page they tapped —
   `DeepLinkHandler.kt:174` even says "/pricing … stays in the browser flow", which
   the manifest contradicts. `/r/{code}` (a live web referral short link) is not
   parsed at all.
3. **Puzzles screen has a single point of failure.** `PuzzleViewModel` sources its
   only puzzle from `/tutorial/daily-challenge` (`:60`) — the endpoint known to 500
   on prod — so Retry loops on "No puzzles available" forever, while 5 JSON files
   with ~2,500 puzzles sit unused in `assets/tactical/`. (Web's `/puzzles` is only
   a hub page, so a bundled random/themed mode would put Android *ahead*.)
4. **assetlinks.json carries only the upload key.** The deployed fingerprint
   matches `chess99-upload.jks` (verified by keytool: `72:B3:BB:…:C6:1F`), but with
   Play App Signing the verifying certificate is Play's, so App Links will fail for
   store builds until the Play signing SHA-256 is appended and redeployed. Also
   still unverified that nginx serves `/.well-known/` (a `location ~ /\.` deny rule
   would 404 it).
5. **Stale release bundle.** `app/build/outputs/bundle/release/app-release.aab` is
   from 2026-07-17, i.e. before Cycles 8–11. Rebuild before any upload.
6. **targetSdk 35.** Play's annual target-API requirement moves to 36 around
   2026-08-31; a submission this close to the deadline should go up on 36. Verify
   the exact date in Play Console. `enableEdgeToEdge()` is already called, so the
   API 36 edge-to-edge enforcement is not a concern.

---

## 4. Quality gaps

| Gap | Evidence | Cost |
|---|---|---|
| Zero automated tests | test deps declared in `build.gradle.kts:190–197`, but `app/src/test` and `app/src/androidTest` do not exist | ChessGame/EloMoveSelector/DeepLinkHandler are pure-logic and cheap to cover |
| No localisation | **0** `stringResource` uses; all copy is hardcoded Kotlin literals; `strings.xml` holds only app name + Facebook IDs | blocks Telugu/Hindi listings for an India-first product |
| 263 hardcoded `Color(0x…)` | `presentation/**` (57 legitimately in `Theme.kt`) | dark-mode drift |
| 58 spinners, 0 skeletons | `CircularProgressIndicator` count | perceived speed |
| 103 `contentDescription = null` | icon-only controls need a pass | a11y / Play pre-launch a11y report |
| Store assets thin | 5 phone screenshots, no tablet/7-inch set; feature graphic marked "serviceable, replace with designer art" | listing conversion |
| No piece-move animation | `ChessBoardView.kt` has last-move + check highlights but no `animate*` | polish |

---

## 5. Web features deliberately absent (do not treat as gaps)

- **Billing** (`/pricing`, `/account/subscription`, Razorpay) — Play policy; "My
  Plan" mirrors entitlements read-only. Correct as-is.
- **Training drills / Opening Explorer** (`/training`, `/training/:level/:id`) —
  removed in S14 because the backend 422s the practice-game call and the stub
  marked any legal move "Good move!". Real drills are a post-v1 content project.
- **E-book** (`/ebook`) — broken on web too; Android dropped it rather than ship a
  dead WebView.
- **Ambassador poster/QR + multi-language share templates** (`/ambassador/poster`) —
  low priority.
- **Admin/ops surfaces** (`/admin/*`, championship admin, `/system-status`,
  `/health`, `/coming-soon`, `/test/championship`) — staff tooling, no mobile need.

Still open on **both** platforms: no adult gate on the ambassador
(commission-earning) programme. Best fixed backend-side so both clients inherit it.

---

## 6. Refinement ideas, ranked by payoff

1. **Bundled puzzle mode** (fixes §3.3 and beats web) — random + themed sets from
   the 2,500 offline puzzles; works on a plane, no backend dependency.
2. **Streaks + daily goal on Home.** `DashboardViewModel` already parses
   `current_streak` / `best_streak` (`:118`); Home never mentions streak (0 hits).
   The data is free — surfacing it is the single biggest day-2 retention lever.
3. **Kid-safe quick-chat.** Turn B3 from a compliance chore into a feature: canned
   phrases ("Good game!", "Nice move!") for minors, free text for adults, report +
   block for everyone. ChessKid's model.
4. **One-tap "Review this game"** from every finished game and from Recent Games —
   `GameReviewScreen` already exists and is strong; it is under-surfaced.
5. **Skeleton loaders** on Dashboard/History/Lobby, replacing the 58 spinners.
6. **Consolidate the online-play IA** — "Play Online" card, "Lobby" tab and
   "Nearby Opponents" are three doors to overlapping destinations.
7. **Path-scoped app links + a browser fallback** so an unhandled chess99.com link
   opens the web page instead of dumping the user on Home.
8. **Empty-state routing** — every empty state should offer the next-best action
   (Leaderboard's icon+copy pattern is the in-house gold standard).
9. **Puzzle Rush / timed duel** — a compulsive daily hook on top of the staged
   Tactics Trainer.
10. **Branded splash** (`androidx.core.splashscreen`) to mask cold start.

---

## 7. Repository location

`chess99-android/` is **already** at `C:\ArunApps\Chess-Web\chess99-android`,
tracked in the Chess-Web repo since commit `589fba5`. Nothing to move, and
co-location is right: it consumes `api.chess99.com`, its review/plan docs live in
`docs/`, and its App Links depend on `chess-frontend/public/.well-known/assetlinks.json`
— all of which would drift if split.

`D:\ArunApps\GameProduction\Chess99-PawnPop` is a *different* product
(`com.chess99.pawnpop`, a kids' saga game forked from this client, stalled since
2026-05-11). Its own STATUS calls for extracting it into a lean SDK-free binary for
Families review — the opposite direction from merging it back in here. Keep it in
GameProduction.
