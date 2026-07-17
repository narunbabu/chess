# Chess99 Android — Google Play Launch-Readiness UX Review
**Date:** 2026-07-17
**Reviewer:** Principal product-design / QA audit
**Build under review:** `com.chess99.app` debug build, versionName `1.0.0`, versionCode `1`, targetSdk 35, minSdk 26
**Device:** Emulator `Medium_Phone_API_36.1` (Android API 36, 1080×2400)
**Backend:** local `php artisan serve` on `http://10.0.2.2:8000` (sparse seed data)
**Positioning benchmark set:** ChessKid, chess.com, Lichess, Duolingo

---

## 1. Executive Summary

**Verdict: CONDITIONAL GO — 6.5 / 10.**

Chess99 for Android is a genuinely well-crafted, well-engineered app that is *much* closer to launch than a typical 1.0. It has a coherent green-and-gold brand identity, a hand-tuned light **and** dark Material-3 palette, a real Duolingo-style learning progression (0/80 lessons, XP, levels), a beautiful chess board, thoughtful empty-state copy on most screens, and — critically for a kids' product — a clean Families-policy posture: **no ad SDKs, only 4 minimal permissions (INTERNET, NETWORK_STATE, POST_NOTIFICATIONS, VIBRATE), a birthday age-gate that requires a guardian email for minors, and cleartext HTTP confined to the debug manifest.** State handling is unusually mature: every major screen explicitly models loading, empty, and error states in code.

It is a **CONDITIONAL GO rather than a GO for one reason**: the app ships **free-text, real-time player-to-player chat inside multiplayer games with no in-app report / block / mute controls and no minor-gating on the client**, while marketing itself as a kids' chess platform. That combination is the single most likely thing to fail Google Play's User-Generated-Content and Families policy review. Fix that (add report/block/mute UI, or disable/whitelist chat for minors) and this app is a clean GO.

The secondary theme is polish: a handful of dead-end error/empty states without recovery actions, some placeholder-grade copy ("vs Unknown", "Game #0"), a text-list instead of a real rating chart, and spinners-everywhere instead of skeletons.

### Top 5 issues by impact
1. **[P0] In-game chat has no report/block/mute UI and is not minor-gated** — Play Families/UGC policy blocker. Evidence: `PlayMultiplayerScreen.kt:203–251, 755–800` (chat toggle + free-text panel, no moderation affordance); no `isMinor` check in the game screen/VM.
2. **[P1] Dashboard "Couldn't load your stats. Please try again." is a dead end** — inline error text with no retry button, shown *below* a successfully-loaded rating card. Evidence: `18-dashboard.png`; the page-level error has a Retry (`DashboardScreen.kt:270`) but this inline partial-failure state does not.
3. **[P1] Lobby "No players online" empty state has no icon, guidance, or CTA** — a bare centered string; a new user with an empty lobby hits a wall instead of being routed to "Play the computer" or "Invite a friend." Evidence: `09-lobby-tab.png`. (Contrast: Leaderboard's empty state does this right — `35-daily.png`.)
4. **[P1] "vs Unknown" opponent labels + "Game #0" title** — computer/AI games render with `opponent_name` null → "Unknown", and games show "Game #0". Reads as unfinished data for a kids' app. Evidence: `18-dashboard.png` (5× "vs Unknown"); `26-motionevent-resume.png` ("Game #0"); `DashboardViewModel.kt:145,207`.
5. **[P2] Profile "Rating History" is a text list, not a chart; loading uses spinners not skeletons** — weak progress visualization vs chess.com/Lichess graphs. Evidence: `ProfileScreen.kt:842–913` (text rows); 55 `CircularProgressIndicator`, 0 skeleton loaders across the UI.

---

## 2. Scorecard

| Dimension | Score /10 | One-line justification |
|---|---|---|
| First impression & onboarding | 7 | Clean, self-explanatory Home ("Ready to play?", clear Play-vs-Computer / Play-Online CTAs); guest path exists; but no first-run tour and empty lobbies can dead-end a newcomer. |
| Visual design system | 8 | Strong, non-template green/gold identity; full hand-tuned light **and** dark M3 palette; ~200 non-theme hardcoded colors are the main blemish. |
| Navigation & IA | 6 | Drawer + bottom nav + explore grid are logical, but "Play Online" card, "Lobby" bottom tab, and "Nearby Opponents" overlap; some back-stack lands on Dashboard vs Home. |
| Core loop quality | 7 | Board renders beautifully with coordinates; PvC setup (color/difficulty/rated/undo-chances) is thoughtful; multiplayer needs a live opponent to fully judge. |
| Engagement & retention | 7 | Duolingo-style Lessons/XP/Level, daily challenge, leaderboards, tournaments, achievements — strong scaffolding; streaks not surfaced; rating history is a text list. |
| State completeness | 8 | Every major screen models loading/empty/error in code; most empty copy is guiding; a few dead-end errors and bare empties pull it down. |
| Copy & microcopy | 6 | Mostly warm and on-brand ("No games today. Be the first!"), but "vs Unknown", "Game #0", and "this week yet" on non-weekly filters read as unfinished. |
| Accessibility | 6 | Password toggle labeled, targets generally ≥48dp; but 100 `contentDescription = null` vs 35 described — icon-only controls need audit. |
| Performance (perceived) | 6 | Warm start ~4.1s (debug-inflated); spinners everywhere instead of skeletons; no obvious jank observed. |
| Trust, safety & monetization UX | 7 | Excellent: no ads, minimal permissions, guardian-email age-gate, HTTPS-only release, compliant no-IAP subscription model. Dragged down only by unmoderated kids' chat. |

**Weighted overall: 6.5 / 10 — CONDITIONAL GO.**

---

## 3. Methodology note (read before trusting tap-level claims)

The running emulator exhibited a **reproducible adb input-injection artifact**: synthetic `input tap` / `input motionevent` events reliably actuate Material components (`IconButton`, `NavigationBar`, `Tab`, drawer `NavigationDrawerItem`, `AlertDialog` buttons) but only *intermittently* actuate Compose `Modifier.clickable` content cards (Home "Play vs Computer"/"Play Online"/"Resume", Dashboard quick-action tiles, Learn lesson cards). The same Resume card that ignored ten taps navigated correctly once via `motionevent DOWN/UP`. Focus stayed on `com.chess99.app/MainActivity` throughout and no overlay was intercepting touches. **This is an emulator/synthetic-input timing issue, not an app defect — a real finger touch is unaffected.** Consequently, card-tap failures are **not** reported as bugs; screens I could not reach by tap were audited from source. Navigation itself is confirmed working (I reached Lobby, Quick Play, Dashboard, Learn Tutorials + Training, Leaderboard, and a live Multiplayer board).

---

## 4. Screen-by-screen findings

### 4.1 Cold start / first frame — `01-first-frame.png`, `02-app-current.png`
- **Works:** Session persisted (test account already logged in) → lands directly on Home. Warm start measured **4.1s** (`TotalTime`), acceptable given debug build; the first cold launch hit 35s but that was a one-time emulator "System UI isn't responding" event during fresh boot, not the app.
- **[P3]** No branded splash observed between launch and Home; category leaders use a short branded splash to mask cold-start. Low priority.

### 4.2 Home / Play tab — `02`, `03`, `04`, `07`
- **Works (strength):** This is a strong home screen. Green gradient hero ("Welcome back / Ready to play? / Sharpen your game — one move at a time.") with the 99 shield logo; a "Continue playing" resume card with status chip; two large, unmistakable primary CTAs (Play vs Computer / Play Online); "Nearby Opponents" with rated avatars and "Show 9 more"; and an "Explore" grid (Learn, Puzzles, Daily, Tournaments, Leaderboard, History). A newcomer understands the value and next action in under 5 seconds.
- **[P1] IA overlap:** "Play Online" (hero card) → Lobby; "Lobby" (bottom tab) → the *same* Lobby; "Nearby Opponents" is a third online-play surface. Three paths to overlapping destinations dilutes the IA. **Fix:** make "Nearby Opponents" a section *inside* Lobby, or drop the bottom "Lobby" tab in favor of the hero card. Benchmark: chess.com keeps a single "Play" hub.
- **[P2] Hardcoded accent colors** (`HomeScreen.kt:327,353–357`): gold gradient + category colors are semantic and fine, but should be theme tokens for dark-mode/brand consistency.

### 4.3 Lobby — Players / Friends / Quick Play — `09`, `10b`, `11`
- **Works:** Three clear tabs; "0 online" live badge; Quick Play is excellent — time-control chips (3+1 … 30+10), Color (Random/White/Black), Mode (Casual/Rated), one big "Find Opponent" CTA (`11-lobby-quickplay.png`). Friends tab has a proper empty state: search bar + "No friends yet. Search for players above!" (`10b`).
- **[P1] Players empty state is a dead end** (`09-lobby-tab.png`): centered "No players online" with **no icon, no guidance, no CTA.** A first user on a quiet server sees a blank wall. **Fix:** icon + "No one's online right now — play the computer or invite a friend" + two buttons. (`LobbyScreen.kt` already models empties; upgrade this one to match Leaderboard's quality.) Benchmark: Lichess routes empty lobbies to bots/puzzles.
- **[P2] "0 online" uses an alarm-red pill** — red reads as an error for a benign zero. Use a neutral/secondary color.

### 4.4 Play vs Computer (setup + board) — audited from source (`PlayComputerScreen.kt`)
- **Works (strength):** Setup phase models Play-as (White/Black), bot/persona pick, a difficulty slider with human-readable labels, a Rated toggle that shows remaining undo chances, and a "Start Game" button with a loading state. Playing phase shows the board, "Computer thinking…", an **Undo button that displays remaining chances**, and Resign. Error handling is first-class: a dedicated "Can't play the computer right now" dialog with a retry action for engine failures, plus a generic Error dialog. This is category-leader quality.
- Could not exercise live due to the input artifact (§3); no defects assumed.

### 4.5 Multiplayer game board — `26-motionevent-resume.png`, `27-back-to-home.png`
- **Works:** Gorgeous board — a–h/1–8 coordinates, classic brown/cream theme, crisp pieces, player rows with ratings and 10:00 clocks, bot + chat icons in the app bar. Resign uses a proper confirm dialog ("This will count as a loss").
- **[P1] "Game #0" title** — placeholder-grade. Use "Casual · 10+0" or opponent name.
- **[P2] "Couldn't load this game. Please try again." dialog offers only "OK"** (`26`) — "try again" with no retry action is a mild dead end. (Root cause here is a stale seed game with no live WebSocket opponent — a *data* artifact — but the OK-only pattern is a real UX gap.) The board sat on "Connecting…" indefinitely.
- **[P0 — see §5] Chat panel has no report/block/mute and no minor gate.**

### 4.6 Dashboard — `18-dashboard.png`
- **Works:** Personalized "Welcome back, Arun"; a handsome Rating card (1294, "All-time high!" badge, Peak 1294 with trend arrow); Quick Actions (Computer/Online/Learn/Tournaments); Recent Games list; "See All →".
- **[P1] Inline "Couldn't load your stats. Please try again." with no retry** — sits between the rating card and Quick Actions; a bare dead end. (`DashboardScreen.kt:270` proves the team knows how to do Retry buttons — this partial state just lacks one.)
- **[P1] "vs Unknown … 10|0 - Draw" ×5** — `opponent_name` null for computer games → "Unknown" (`DashboardViewModel.kt:145,207`). **Fix:** fall back to "Computer (Lv N)" or the bot persona name.

### 4.7 Learn — Tutorials — `21`, `22`
- **Works (strength):** Duolingo-style stats header (0/80 Lessons · 0 XP · Lv 1); Tutorials/Training tabs; a beautifully structured Beginner track (Chess Basics, Rules & Goals, First Tactics, Piece Coordination, Beginner Endgames) each with a 0/5 progress bar and a kid-appropriate one-line description. This is the app's strongest retention asset and is genuinely excellent.

### 4.8 Learn — Training — `23-training-tab.png`
- **Works:** Daily Challenge, Achievements, and Practice → "Tactics Trainer — Staged puzzles from beginner to master with progression tracking." Achievements empty copy guides ("Complete lessons and solve puzzles to earn achievements").
- **[P2] "No daily challenge available"** is a bare gray box with no icon/retry. **This maps to the known backend 500 on `/tutorial/daily-challenge`** — a *backend* root cause — but the client's empty-state design should still offer a retry and an icon.

### 4.9 Leaderboard — `35-daily.png`, `36`
- **Works (strength / the empty-state gold standard):** Tabs (Most Games / Most Wins / Highest Points / By Rating) + time filters (Today / 7 Days / 30 Days / All Time). Empty state = **game-controller icon + "No games this week yet."** — icon + contextual copy. This is exactly what the Lobby and Daily empties should copy.
- **[P2] Filter-copy mismatch risk:** empty strings are period-specific ("this week", "this month", "today. Be the first!"), but code shows a generic "No games this week yet." that may persist under the All-Time filter. Verify the string switches with the selected period. (Filter-chip tap didn't register to confirm live — flagged from `36` + string dump.)

### 4.10 Navigation drawer — `05`, `17`
- **Works:** Branded header ("Chess99 · Play · Learn · Master"), consistent iconography, logical grouping, a divider before legal/logout. Dashboard, Championships, Tournament Invites, Leaderboard, Daily Challenges, Game History, Organizations, Referrals, My Plan, Privacy Policy, Terms of Service, Logout. **Ambassador entry correctly hidden for the minor test account** (`HomeScreen.kt:169`) — good conditional IA.

### 4.11 Subscription / My Plan — audited from source (`SubscriptionScreen.kt`)
- **Works (policy-smart):** The app **does not sell subscriptions in-app and does not link out** to a payment page. `PlansUnavailableCard`: "Premium plan purchases are not available in this app. If your Chess99 account has a premium plan, it is active here automatically." This entitlement-mirroring is the compliant way to avoid Play Billing conflicts.
- **[P2] UX gap:** a mobile-only user who wants premium has no path or explanation of *where* to buy. Consider a neutral "Manage your plan on chess99.com" line (informational, no purchase CTA) — but keep it policy-safe.

### 4.12 Auth (Login / Register) — audited from source (`LoginScreen.kt`, `RegisterScreen.kt`)
- **Works (strength):** Login has email/password, a labeled show/hide-password toggle, Sign-In disabled until fields are valid, Forgot-Password, Register nav, and an `onPlayAsGuest` guest path. Register collects birthday, computes age, sets `isMinor`, and **requires a guardian email for minors** (`RegisterScreen.kt:215,259,268`) — COPPA/Families-aligned. `isMinor` safely defaults to `true`.
- Auth not driven live to avoid a logout/login round-trip under the flaky-input condition; the persistent session was preserved.

---

## 5. Play policy & kids-safety deep dive (the CONDITIONAL in CONDITIONAL GO)

**Green (compliant / strong):**
- **No ad SDKs** anywhere in `build.gradle.kts` — avoids the strict Families ad-format regime entirely.
- **Only 4 permissions** (INTERNET, ACCESS_NETWORK_STATE, POST_NOTIFICATIONS, VIBRATE) — no location/camera/mic/contacts.
- **Age-gate with guardian email for minors** at registration; `isMinor` propagated through DTOs/domain with a safe `true` default.
- **HTTPS-only release** — cleartext is isolated in `app/src/debug/AndroidManifest.xml`.
- **No in-app purchases and no external payment links** — compliant subscription model.
- Firebase Analytics present (`build.gradle.kts:164`) — allowed, but **must be declared in the Play Data Safety form** and configured without ad-personalization for a Families listing.

**Red (the blocker):**
- **[P0] Unmoderated, un-gated in-game chat.** `PlayMultiplayerScreen.kt:203–251` renders an unconditional chat toggle; `:755–800` is a free-text input (≤500 chars) + message bubbles. There is **no report, block, or mute affordance** (the only `Icons.Default.Flag` in the file is the *Resign* button, `:533`) and **no `isMinor` gate** on chat visibility in the screen or ViewModel. Even if the backend `ChatSafetyService` filters profanity, Google Play's **User-Generated Content** policy requires *in-app* mechanisms to (a) report/flag content and users and (b) block users; the **Families** policy expects communication features for children to be moderated or restricted. As shipped, a child can exchange free-text messages with strangers with no way to report or block them.
  **Fix options (any one unblocks launch):** (1) add report/block/mute controls to the chat UI and a "report reason" flow; or (2) disable free-text chat for `isMinor` accounts and offer canned/quick-chat phrases only ("Good game!", "Well played!"); or (3) restrict chat to confirmed friends. ChessKid's model — pre-approved phrases only for kids, moderated free chat gated behind parental controls — is the reference.

---

## 6. Code-level findings (with refs)

- **Design system:** 257 `Color(0x…)` occurrences in `presentation/` (57 legitimately in `Theme.kt`). ~200 outside the theme bypass Material roles — mostly semantic (win-green `0xFF4CAF50`, loss-red `0xFFE53935` in `ProfileScreen.kt:908–910`; brand gold in `HomeScreen.kt`). **[P2]** Migrate to theme tokens for dark-mode fidelity.
- **Dark mode:** Fully hand-tuned `DarkColorScheme` (`Theme.kt:69–108`) mapping custom brand greens/golds to M3 roles — a real strength, not default-generated. `dynamicColor = false` by default (correct — preserves brand).
- **Accessibility:** `contentDescription = null` ×100 vs described ×35. Many nulls are decorative icons beside text (fine), but icon-only interactive controls need an audit. **[P2]**
- **Progress visualization:** `ProfileScreen.kt:842–913` — "Rating History" renders a **text list** (`ratingHistory.takeLast(10)` with date + rating + ±change), not a chart. Web has `UserProgressCharts.js`; this is an Android parity gap. **[P2]**
- **Loading states:** 55 `CircularProgressIndicator`, **0** skeleton/shimmer loaders. **[P2]** Adopt skeletons on list/dashboard screens for perceived speed (Duolingo/chess.com reference).
- **Copy fallbacks:** `DashboardViewModel.kt:145,207` and `LobbyViewModel.kt:159` default missing opponent names to "Unknown". **[P1/P2]**
- **State handling (strength):** grep confirms explicit loading/empty/error modeling in `GameHistoryScreen`, `ChampionshipListScreen`, `DashboardScreen`, `LobbyScreen`, `LearnScreen`, `LeaderboardScreen`.
- **No debug/placeholder text** leaked into UI — all "placeholder" hits are legitimate `TextField` hints.

---

## 7. Benchmark gap analysis (ranked by retention impact)

1. **Moderated / kid-safe chat (ChessKid):** pre-approved phrases for kids + report/block. *(Also the P0 policy fix.)*
2. **Streaks & daily-goal loop (Duolingo):** the Learn track has XP/levels but no visible streak counter or daily-goal ring on Home — the single biggest day-2 retention lever missing.
3. **Rating graph + insights (chess.com/Lichess):** replace the Profile text list with a sparkline/graph and per-mode breakdown.
4. **Post-game coach-style review (chess.com):** `GameReviewScreen` exists; surface a one-tap "Review this game" from every finished game and from Recent Games.
5. **Skeleton loaders (all leaders):** perceived-performance polish.
6. **Puzzle Rush / timed duel (chess.com):** Tactics Trainer is staged/progressive; a timed-rush mode adds a compulsive daily hook.
7. **Empty-state routing (Lichess):** every empty ("No players online", "No daily challenge") should push to the next-best action, not dead-end.
8. **Branded splash + first-run tour (Duolingo):** a 3-screen value intro for brand-new installs.

---

## 8. Prioritized roadmap

**Quick wins (≤1 day each)**
- Add a **Retry button** to Dashboard's inline "Couldn't load your stats" and Learn's "No daily challenge available." (P1/P2)
- Replace **"vs Unknown"** with "Computer (Lv N)"/persona name; replace **"Game #0"** with a mode/opponent title. (P1)
- Upgrade **Lobby "No players online"** to icon + guidance + "Play the computer"/"Invite a friend" CTAs (reuse the Leaderboard empty pattern). (P1)
- Change the **"0 online" red pill** to a neutral color. (P2)
- Verify **Leaderboard empty copy** switches with the time filter (no "this week" under All-Time). (P2)
- Fill the **Play Data Safety form** for Firebase Analytics; confirm no ad-personalization on a Families listing. (P1, store-side)

**Medium (≤1 week)**
- **Kid-safe chat:** report/block/mute UI **and** minor gating (canned phrases for `isMinor`) — the launch unblocker. (P0)
- Replace **Profile rating text list** with a real chart; surface **"Review game"** from Recent Games. (P2)
- Add **skeleton loaders** to Dashboard/History/Lobby lists. (P2)
- Audit **icon-only `contentDescription`** and add labels. (P2)

**Deep work**
- Add a **streak + daily-goal system** with Home surfacing and comeback notifications. (retention)
- **Consolidate online-play IA** (Play Online card vs Lobby tab vs Nearby Opponents). (P1)
- Migrate remaining **hardcoded colors → theme tokens**. (P2)
- **Puzzle Rush / timed duel** mode. (retention)

---

## 9. What's already strong — do not regress

- **Families-policy posture:** no ads, 4 permissions, guardian-email age-gate, HTTPS-only release, compliant no-IAP subscription model.
- **Brand & theme:** distinctive green/gold identity with a genuinely hand-tuned light **and** dark palette — never mistakable for a template.
- **Learn track:** Duolingo-style lessons/XP/levels with well-written, kid-appropriate descriptions.
- **Chess board & PvC setup:** coordinates, clean pieces, difficulty/rated/undo-chance modeling, engine-failure recovery dialog.
- **State discipline:** loading/empty/error modeled across all major screens; most empty copy is warm and guiding ("No games today. Be the first!", "No messages yet. Say hi!").
- **Auth:** guest path, password-visibility toggle with labels, validation-gated submit, guardian flow for minors.

---

## 10. Real defects vs local-dev-data artifacts

**Real app/UX defects (fix these):**
- Unmoderated/un-gated kids' chat (P0).
- Dashboard inline stats error with no retry (P1).
- Lobby "No players online" bare empty state (P1).
- "vs Unknown" / "Game #0" copy (P1).
- Rating history as text not chart; spinners not skeletons; ~200 non-theme colors; a11y label gaps (P2).
- "OK-only" (no retry) on the game-load error dialog (P2).

**Local-dev-data artifacts (not app defects — do not fix in app):**
- "No players online", "0 online", empty Nearby/Friends — sparse seed data.
- Empty leaderboards / "No games this week yet." — no seeded games.
- "No daily challenge available" — **known backend 500** on `/tutorial/daily-challenge` (backend bug; the app's empty-state polish is still fair game).
- Multiplayer game stuck on "Connecting…" + "Couldn't load this game" — stale seed game with no live WebSocket opponent.

*(Screenshots referenced above are in `/tmp/qa/`, numbered `01`–`37`.)*
