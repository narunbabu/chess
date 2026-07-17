# Chess99 Android — App Quality Review (Release Build)

- **Date:** 2026-07-14
- **Build under review:** `com.chess99.app` v1.0.0 (versionCode 1), signed release (minified, non-debuggable), installed 2026-07-14 18:21 on emulator-5554 (1080×2400), pointed at **production** (`api.chess99.com`)
- **Reviewer role:** principal-level app design review + QA audit (app-quality-reviewer agent)
- **Benchmarks:** ChessKid, chess.com mobile, Lichess, Duolingo
- **Positioning judged against:** "the ChessKid of India" — a kids-focused chess academy
- **Artifacts:** `chess99-android/review-artifacts/*.png` (numbered, referenced throughout)

---

## 1. Executive summary

**Uninstall-test verdict: a new user uninstalls this build within 90 seconds — the Play Store hold must stay in place.** The very first CTA on the home screen ("Play vs Computer") dies with a raw engine error, the Learn tab contains literally zero lessons, and the lobby proudly announces "0 online". The one loop that works beautifully — the bundled Tactical Trainer — is quietly teaching children the *losing* move on its puzzles because the Lichess setup-ply was never applied to the bundled data, and its scoring hands out 100/100 after the child has failed twice and peeked at the solution. Around that core, the release build is riddled with dead ends that debug-build testing never caught: Game History crashes into an obfuscated `ClassCastException` shown to the user, Dashboard and Referrals spin forever, "My Plan" throws `Failed to load subscription: p`, and the in-app Privacy Policy and Terms pages render **empty** — a store-policy risk for a kids app. The new green/gold theme is genuinely cohesive and the My Kids parent-linking screen is excellent; the visual foundation is worth keeping. But today this is a well-painted building with no floors.

**Top 5 issues by impact:**
1. **P0 — Play vs Computer is dead** (no Stockfish binary): the app's #1 CTA errors out; also silently breaks Companion/CCT/analysis (`42-play-computer-game.png`).
2. **P0 — Tactical Trainer teaches wrong chess**: every sampled bundled puzzle expects the *opponent's setup blunder* as "Correct!", mislabels the mating side, and lets you score 100/100 after revealing the solution (`34-solution-move2.png`, `38-puzzle-solved.png`). The identical data ships on web — cross-check `chess-frontend/src/data/*.json`.
3. **P0 cluster — release-build data layer collapses on prod data**: Game History = user-visible obfuscated cast error; Dashboard, Referrals, Profile→Stats = infinite spinners; My Plan = error dialog. All share the same root: `JsonObject` hand-parsing that throws on `JsonNull` + catch blocks that swallow errors without clearing loading state.
4. **P0 — Privacy Policy, Terms, and E-Book WebViews render empty/error** in-app: for a 13+ kids app this is a Play review liability, not just a bug (`17-privacy-policy.png`, `18-terms.png`, `15-ebook.png`).
5. **P1 — the academy has no lessons and no retention loop**: every Tutorials module opens to "No lessons in this module yet", stats read 0/0, copy references streaks that no UI ever shows, XP has no earn path, achievements point at the nonexistent lessons (`25-lesson-detail.png`, `08-daily-challenges.png`).

---

## 2. Scorecard

| # | Dimension | Score /10 | Justification |
|---|-----------|-----------|---------------|
| 1 | First impression & onboarding | **3** | First run is a bare login form that says "Welcome back" to a brand-new user; zero value pitch, no kid-friendly onboarding; guest path exists (good) |
| 2 | Visual design system | **6** | New green/gold theme is cohesive, fully role-mapped, not template-y; but logo ships on an opaque dark tile, 200 hardcoded colors bypass the theme, and there is zero illustration/mascot/delight for kids |
| 3 | Navigation & IA | **4** | Bottom "tabs" are fake (bar vanishes on 3 of 4 destinations); 13-item drawer duplicates the Explore grid; naming drift (Championships/Tournaments, Tactics Trainer vs Tactical Trainer, My Plan/My Subscription); logout occupies the prime top-bar slot — and is broken |
| 4 | Core loop quality | **3** | #1 CTA (vs Computer) hard-broken; online play faces an empty lobby; the one working loop (Tactical Trainer) has excellent UI but poisoned data and gameable scoring |
| 5 | Engagement & retention | **2** | No streak UI (copy references one!), no daily goal, XP stuck at 0 with no earn path, achievements gated on lessons that don't exist; leaderboard invite CTA is the lone hook |
| 6 | State completeness | **2** | Two infinite spinners, one raw obfuscated exception on screen, one error dialog with obfuscated class name, three empty/broken WebViews, bare "No X found" empty states, locked-tab selection/content mismatch |
| 7 | Copy & microcopy | **4** | Good tone in Daily Challenges & My Kids; but raw enum `swiss_only`, dangling "Invited by ", ISO-timestamp birthday, "Rating -0", contradictory puzzle prompts ("find the best continuation" vs "mate in one" vs 2-move solution) |
| 8 | Accessibility | **5** | Touch targets generally ≥48dp, light-theme contrast fine, icon buttons carry labels; 92 null contentDescriptions (mostly decorative), hint button forfeits the puzzle with no confirmation — a motor-slip trap for kids |
| 9 | Performance (perceived) | **7** | Cold start 819 ms with a fully drawn first frame; navigation and board interaction are snappy. Perceived slowness is entirely failed/never-ending loads, not rendering |
| 10 | Trust, safety & monetization UX | **4** | Good: no-gambling disclaimer, honest "purchases not available in this app", child-link approval flow, guest mode. Bad: empty legal pages in-app, obfuscated subscription error, commission "Ambassador" program surfaced to children, referral links shipped without attribution codes |

**Overall: 3.5/10 — NO-GO for Play Store submission.** The bones (theme, board, trainer UI, parent dashboard) are close to a 7; the connective tissue is at a 2.

---

## 3. Screen-by-screen findings

### 3.1 Cold start & Home (Play tab) — `00`, `01`, `02`
**What works:** 819 ms cold start; first frame is the complete Home screen (no blank splash). Hero card + two big CTAs + Explore grid is a clear hierarchy. The green/gold identity lands.

| Sev | Finding | Evidence | Benchmark / fix |
|-----|---------|----------|-----------------|
| P0 | **Logout button in the top-right of Home is dead** — two taps, zero response, no confirmation dialog either way | `49-logout-tap.png`, `50-logout-retry.png`; root cause §4.1 | No benchmark app puts logout on the home app bar. Remove it entirely (keep drawer entry), wire it to `AuthViewModel.logout()`, add a confirmation dialog |
| P1 | "Welcome back / Ready to play?" hero never greets the child by name and shows no rating/streak/XP — pure static decoration | `01-home-settled.png` | ChessKid greets with avatar + name + level; Duolingo leads with streak flame. Personalize the hero: name, rating, streak, "continue where you left off" |
| P2 | Brand logo is pasted as an opaque square tile with a dark chessboard background sitting on the green card | `01-home-settled.png` | Export a transparent-background logo variant; today it reads as a placeholder |
| P2 | Tagline text runs to the very edge of the logo tile ("…one move at a time." touches the image) | `01-home-settled.png` | Add end padding / constrain text width |
| P1 | Explore tiles are static icon+label cards with no live data (Daily shows no "3 challenges today", History no recent game, Leaderboard no rank) | `02-home-scrolled.png` | chess.com home modules each surface live state. At minimum add subtitle lines fed by cached data |
| P2 | "Learn" appears twice on one screen (Explore tile + bottom tab), "Puzzles" tile routes to *Tactical Trainer* while Learn→Practice has a different "Tactics Trainer" | `02`, `40` | Deduplicate; one name per destination |

### 3.2 Navigation drawer — `03`
**What works:** Groups the long tail; Privacy/Terms present; scrims correctly.

| Sev | Finding | Evidence | Benchmark / fix |
|-----|---------|----------|-----------------|
| P1 | 13 flat destinations, several duplicating Explore/bottom-nav (Leaderboard, Daily, Game History) — classic junk drawer | `03-nav-drawer.png` | Lichess keeps its drawer curated & sectioned. Cut to ≤8, section headers ("Compete", "Account", "Legal") |
| P2 | Drawer header shows app logo + "Play · Learn · Master" instead of the signed-in child's avatar/name/rating | `03-nav-drawer.png` | ChessKid drawer = identity anchor. Show user identity here |
| P2 | Bottom "tab bar" only exists on Home — Lobby/Learn/Profile all push full screens with back arrows, so the tabs are actually buttons | `19`, `24`, `43` | Make it a real `NavigationBar` persisted across the four top-level destinations, or drop the tab metaphor |

### 3.3 Dashboard — `04-dashboard.png`, `04-dashboard-25s.png`
| Sev | Finding | Evidence | Benchmark / fix |
|-----|---------|----------|-----------------|
| P0 | **Infinite spinner** — bare `CircularProgressIndicator` in a void (no app bar, no skeleton) still spinning at 25+ s; no timeout, no error state, no retry; back-gesture is the only escape | screenshots; root cause §4.3 | Any benchmark: skeleton rows + error card with Retry. Fix the swallowed exceptions and add `finally { isLoading=false }` |

### 3.4 Championships — `05-championships.png`
**What works:** Search + status/format filter chips; empty state has icon + guidance; loads fast.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P2 | Drawer says "Championships", screen title says "Tournaments" | `03` vs `05` | Pick one term app-wide (web uses Championships) |
| P1 | Default view ("All") shows "No tournaments found" on prod — an empty competitive ecosystem presented with zero rescue (no "get notified", no sample/finished events) | `05` | chess.com never shows a dead tournaments tab; list recently-finished events or cross-sell Daily Challenges |

### 3.5 Tournament Invitations — `06-tournament-invites.png`
| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | Raw enum leaked to UI: "Format: swiss_only" | `06`; `ChampionshipInvitationsScreen.kt:105` | Map enums to display strings ("Swiss") |
| P1 | Dangling label: "Invited by " with empty inviter name — raw incomplete data rendered | `06`; `ChampionshipInvitationsScreen.kt:111` | Hide the row when the value is missing |
| P2 | Data inconsistency: an invitation exists for "First Summer" while the Championships list claims no tournaments exist | `05` vs `06` | Include invited tournaments in the list query |

### 3.6 Leaderboard — `07-leaderboard.png` ⭐ one of the best screens
**What works:** Podium top-3 with avatars, 4 metric tabs, time-range chips, list rows, and a "Challenge your friends!" invite CTA — a real, designed screen.

| Sev | Finding | Fix |
|-----|---------|-----|
| P2 | The signed-in user is #1 but there's no "You" affordance/highlight | Highlight own row (ChessKid does) |
| P2 | 4th tab ("By Rating") clips at the screen edge | Use scrollable tabs or shorter labels |
| P1 | Exposes tiny liquidity (4 players, "1 game") — trust problem for newcomers | Default to All-Time + minimum-population display rules |

### 3.7 Daily Challenges — `08`, `09`
**What works:** Three-track concept with XP rewards; clear CTA ("Solve Today's Challenge"); locked tracks signal progression.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | Copy says "keep your streak alive" but **no streak counter exists anywhere in the app** | `08` | Duolingo rule: if you say streak, show the flame + number everywhere. Add streak chip here and on Home |
| P1 | Tapping a locked track selects the tab (gold highlight) but content still shows Daily Starter — selection/content mismatch, and no explanation of how to unlock | `09-daily-locked-track.png` | Locked tabs: non-selectable + tooltip "Solve 5 Starters to unlock", or show a locked-state card |
| P2 | Screen is one card + dead whitespace | `08` | Add streak calendar / past challenges / reward chest |

### 3.8 Game History — `10`, `11` — **P0, fully broken**
| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | Screen fails with **"Network error: I5.n cannot be cast to I5.q"** — an R8-obfuscated `JsonNull→JsonObject` ClassCastException shown verbatim to a child; Retry fails identically; game review is therefore unreachable | `10`, `11`; root cause §4.2 | Null-safe parsing + human error copy. This exact bug class ("Gson-R8 bit us once") is called out in `proguard-rules.pro` — it needs a release-build smoke suite |
| P2 | It's also *mislabeled* — a parse bug reported as "Network error" erodes trust | same | Distinguish parse vs network failures |

### 3.9 Organizations — `12`
| Sev | Finding | Fix |
|-----|---------|-----|
| P2 | Bare "No organizations found" — no icon, no guidance, and the search placeholder wraps awkwardly | Empty state pattern: icon + "Find your school or chess club" + Search CTA |

### 3.10 Referral Program — `13-referrals-18s.png` — **P0**
| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | **Infinite spinner** (18+ s, never resolves) — the growth loop is unreachable in release | screenshots | Same swallowed-exception fix as Dashboard |

### 3.11 Ambassador — `14`
**What works:** Loads, clear structure, share templates with kid/parent-appropriate copy, Copy/Share buttons.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | "Your referral link" = bare `https://chess99.com` — **no `/r/{code}`**, so every share loses attribution (and the ambassador loses commission) | `14-ambassador.png` | Never render the link until the code loads; block Copy/Share on a code-less link |
| P1 | A commission-earning program presented inside a kids app with no parent gate | `14` | Gate Ambassador behind parent verification / move to parent surface |

### 3.12 E-Book, Privacy Policy, Terms (WebViews) — `15`, `17`, `18` — **P0 cluster**
| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | E-Book: web app error page ("Something went wrong… Refresh") inside the WebView; Refresh loops forever | `15-ebook.png`, `15-ebook-refresh.png` | Fix the wrapped route or pull the drawer item until it works |
| P0 | **Privacy Policy and Terms render footer-only — zero legal text** — for a kids-focused 13+ app this risks Play rejection and parent trust | `17-privacy-policy.png`, `18-terms.png` | Ship static in-app legal pages (bundled HTML/native text). Never depend on the SPA rendering inside a WebView for compliance surfaces |
| P2 | WebViews show the site's logged-out header ("Login") inside a logged-in app + dark web theme clashing with light app | `15` | Hide site chrome via embedded=1 param or CSS injection; match theme |

### 3.13 My Plan / Subscription — `16` — **P0**
| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | Error dialog on entry: **"Failed to load subscription: p"** — obfuscated class name as user copy | `16-my-plan.png` | Null-safe parse + friendly failure ("Couldn't check your plan — you're on Free for now") |
| ✅ | The underlying screen is honest ("Premium plan purchases are not available in this app…") — good Play-billing compliance posture | `16` | Keep |

### 3.14 Lobby (Players / Friends / Quick Play) — `19`–`23`
**What works:** Quick Play form is clean (8 time controls, color, casual/rated, big Find Opponent); searching state has progress + Cancel; cancel works instantly.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | Red **"0 online"** badge in the title actively advertises a dead platform, and the Players tab is a full-screen "No players online" void with no rescue CTA | `19-lobby.png` | chess.com/ChessKid never surface raw liquidity. Remove the badge; empty state should offer "Play the computer" / "Challenge a friend" |
| P1 | Matchmaking lets a child search into a provably empty pool with no expectation setting and no fallback ("play a bot while you wait") | `21-matchmaking-searching.png` | Auto-offer a synthetic opponent (the backend already has 35 synthetic players) after ~15 s |
| P2 | Friends empty state is plain text ("No friends yet. Search for players above!") | `23` | Add invite-a-friend CTA reusing the Leaderboard invite card |

### 3.15 Learn — Tutorials — `24`, `25` — **P0 for an academy app**
**What works:** Stats header concept (Lessons/XP/Level), Beginner section layout, per-module progress bars.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | **Every module opens to "No lessons in this module yet"** — the Learn tab of a chess academy contains zero lessons; header reads "0/0 Lessons", every card "0/0" | `25-lesson-detail.png` | Root cause §4.5. Either the API contract drifted or prod has no mobile lesson content — block launch until Learn is real; web has interactive lessons to port/bundle |
| P1 | Lesson cards have **descriptions but no titles** — each card is an unanchored sentence | `24-learn-tab.png` | Title + short description + distinct per-module icon (ChessKid pattern) |
| P2 | All module icons identical (book) | `24` | Vary icons/colors per topic |

### 3.16 Learn — Training hub — `26`
**What works:** Daily Challenge card w/ XP, Practice list (Tactics Trainer, Tactical Progression, Endgame Drills) — good IA.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | Achievements card says "Complete lessons to earn achievements" — but there are no lessons (circular dead end) | `26` | Point achievements at puzzles/dailies until lessons exist |
| P1 | "Tactics Trainer" (API, shows "No puzzles available" on prod — known) sits next to "Tactical Progression" (bundled, works) — two near-identical names, one broken | `26` | Merge into one entry backed by bundled data with API sync |

### 3.17 Tactical Trainer (bundled) — `27`–`38` ⭐ best screen, worst data
**What works (a lot):** Dashboard with rating/solved/accuracy/streak + overall progress + staged cards with rating ranges, accuracy badges, theme chips and unlock criteria ("Solve 13 more to unlock Positional Tactics") — genuinely category-competitive. Board rendering with Cburnett pieces is beautiful; selection shows legal-move dots; wrong-move feedback ("Incorrect. Try again!") plus an automatic hint banner ("Try moving from f6") is a great recovery pattern; success card ("Correct! Rating +2") is clear.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | **Puzzle data teaches the losing move.** The bundled Lichess-format data stores the opponent's setup ply as `moves[0]`, but the app (and the data's own generated `explanation`/`playerColor`) treat it as the solver's answer. On-device: puzzle 33 says "White to move… find the best continuation", rejects winning tries, hints the rook, accepts **Rxh6??** as "Correct! 100/100" — after which the *solution viewer itself* shows Black mating White (Qg2#). The child is trained to blunder and told the wrong side mates | `31`–`34`, `38`; data §4.4 | Regenerate assets applying `moves[0]` to the FEN (or auto-play it in-app), recompute side-to-move labels; **web ships the identical files — audit `chess-frontend/src/data/*.json` too** |
| P1 | Scoring is gameable: after 2 failed attempts *and* viewing the full solution, replaying the known move still yields "Score: 100/100, Rating +2" | `38` | Score = f(attempts, hints, solution-viewed); web already has split scoring |
| P1 | Hint lightbulb **forfeits the puzzle instantly** — one tap jumps to the Solution screen, records "Rating -0", no confirmation | `32-puzzle-hint.png` | Two-stage hints (highlight piece → show move), explicit "Give up?" confirm |
| P2 | "Rating -0" — a minus-zero shown in red | `32` | Show real delta or hide |
| P1 | From Solution, "Next" opens the *next puzzle's solution* (spoiler + confusing), not its solve state | `35-puzzle-34.png` | "Next" from solution must enter play mode |
| P2 | On "Correct!", the board never shows the move played nor the opponent's reply — no payoff animation, no line playback | `38` | Animate the solution line; celebrate (confetti for kids — Duolingo) |
| P2 | Stage descriptions truncate mid-word ("and re…", "and in…") | `27` | maxLines with proper ellipsis or shorter copy |

### 3.18 Play vs Computer — `41`, `42` — **P0 (known, verified)**
**What works:** Setup screen is clear (color, difficulty 1–16 with undo counts, rated toggle).

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P0 | Start Game → dialog: **"Failed to start engine: Failed to start Stockfish engine"** — redundant double-message, no recovery suggestion, and the app's primary CTA is dead on all devices (also silently breaks Companion/CCT/game-review analysis) | `42-play-computer-game.png` | Bundle the Stockfish binary per-ABI (fix already planned). Until then the failure needs honest copy + redirect ("try a puzzle instead") — but really, don't ship without the engine |
| P2 | No bot personas — one anonymous slider vs chess.com's characterful bot gallery | `41` | The backend already models 35 synthetic players with names/levels — reuse them as selectable personas |
| P3 | Difficulty slider thumb renders as an odd pill/bar overlap at the left edge | `41` | Custom slider polish |

### 3.19 Profile (Settings / Friends / Stats) — `43`–`45`
**What works:** Avatar upload/pick, board theme picker with previews, clean form layout.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | Birthday renders raw ISO: **"1981-06-06T18:30:00.000000Z"** in a field labeled "(YYYY-MM-DD)" — and it's a free-text field, not a date picker (this field also gates chat kid-safety!) | `43-profile.png`; `ProfileScreen.kt:249` | Format + DatePicker. A safety-relevant field must not accept junk |
| P0 | Stats tab = infinite spinner (same swallowed-failure class) | `44`, `45` | Same fix as Dashboard |
| P2 | "Class / Grade (1-12)" displays "Working Professional" — label/value contract mismatch | `43` | Fix option mapping |
| ✅ | "My Kids" (family icon): excellent — clear value copy, child-must-approve linking, real empty state | `46-parental.png` | Keep; surface it more prominently for parent accounts |

### 3.20 Auth (first-run, Sign Up, Forgot Password) — `51`–`57`
**What works:** Guest mode ("Play as Guest") — critical for kids' first session; Google/Facebook SSO; disabled-until-valid CTAs; password visibility toggle; DOB collected at signup with a real picker icon; login restores cleanly.

| Sev | Finding | Evidence | Fix |
|-----|---------|----------|-----|
| P1 | First-run screen greets a brand-new install with **"Welcome back"** and a login form — zero onboarding, zero value pitch, no "I'm new here" path distinct from sign-in | `51-first-run.png` | Duolingo/ChessKid: 2–3 playful value screens → "Get started" (guest or signup) vs "I have an account" |
| P2 | No microcopy explaining *why* date-of-birth is collected (kid-safety gate) — parents notice this | `52-register.png` | "We use birthdays to keep chat safe for kids" |
| P2 | Forgot Password content block floats oddly at vertical center-bottom with a huge empty top | `53` | Top-align under the app bar |
| P3 | Dark-tile logo again on the light auth screens | `51` | Transparent logo asset |

### 3.21 Cross-cutting (Phase 4 sweep)
- **Back navigation:** no traps found; but depth is inconsistent — back from a puzzle exits to Learn (skipping the Tactical dashboard) while other flows return stepwise (`36-back-from-solution.png`).
- **Interrupted flows:** backgrounding and resuming restores the exact screen (`47-resume-after-background.png`) — good.
- **Rapid/double taps:** no double-navigation observed; the dead logout absorbed all taps (see §4.1).
- **Session:** `pm clear` → login works; session persists across cold starts.

---

## 4. Code-level findings (root causes)

### 4.1 Dead logout — `presentation/navigation/NavGraph.kt:142-146` + `presentation/home/HomeScreen.kt:78`
`onLogout` only navigates: `navController.navigate(Screen.Login.route) { popUpTo(0){inclusive=true} }`. It **never calls `AuthViewModel.logout()`** (`presentation/auth/AuthViewModel.kt:227` exists but is unused from Home), so the session stays authenticated and `LoginScreen.kt:48`'s `LaunchedEffect(uiState.isAuthenticated)` immediately bounces back to Home → net effect: the button does nothing. Fix: invoke `authViewModel.logout()` (clear tokens) before navigating, and add a confirm dialog.

### 4.2 Game History user-visible cast error — `presentation/history/GameHistoryViewModel.kt:84, 111-116`
`parseGameSummary(el.asJsonObject)` throws `ClassCastException` when a prod game entry contains `JsonNull` (deleted opponent/null result etc.); the catch renders `"Network error: ${e.message}"` → **"Network error: I5.n cannot be cast to I5.q"** (obfuscated Gson `JsonNull`/`JsonObject`). Fix: null-safe accessors (`el.takeIf{it.isJsonObject}`), `mapNotNull`, and never print `e.message` to users.

### 4.3 Infinite spinners — `presentation/dashboard/DashboardViewModel.kt:50-86` + `DashboardScreen.kt:79`
`loadDashboard()` sets `isLoading=true` then launches 5 child loaders; each catch **logs and returns without clearing `isLoading`** (e.g. `loadUserInfo` clears it only inside `if (response.isSuccessful)`). The screen spins while `isLoading && stats == null` → any prod parse failure = spinner forever. The same pattern afflicts Referrals (`presentation/referral/ReferralViewModel.kt`) and Profile Stats. Fix: `finally { copy(isLoading=false) }` + explicit error state per section + skeletons.

### 4.4 Poisoned tactical puzzle data — `app/src/main/assets/tactical/*.json` (and **identical files** in `chess-frontend/src/data/`)
Sample (`beginner_puzzles.json`, id `s0_004WZ`): `fen` has White to move, `moves: ["f1g1","c6h1"]`, `explanation: "White to move and deliver checkmate in one move."`, `playerColor: "w"`. In the Lichess puzzle format **`moves[0]` is the opponent's setup ply to auto-apply**; the solver is the *other* side. The generation pipeline instead treated `moves[0]` as the answer and derived `playerColor`/`explanation` from the pre-setup FEN. Consequences observed live: the trainer demands the blunder, calls it Correct, and the solution viewer shows the child's side getting mated. Fix in the data pipeline (apply ply 0 to FEN, flip side labels, drop ply 0 from expected answers) — regenerate all 2,500 puzzles ×2 platforms.

### 4.5 Empty Learn/Tutorials — `presentation/learn/LearnViewModel.kt:75-76, 149-151`
Progress totals parse `completed_lessons`/`total_lessons` with `?: 0` fallbacks and lessons via `getAsJsonArray("lessons") ?: …` then `mapNotNull` — every miss silently degrades to `0/0` and empty lists, rendered as "No lessons in this module yet" with no error surfaced. Whether the prod API contract drifted or content is missing, the client's silent-fallback style converts it into a fake-working UI. Fix: verify against `chess-backend` tutorial endpoints; make contract mismatches loud in QA builds; bundle a starter lesson pack offline.

### 4.6 ProGuard confirms the risk was known — `app/proguard-rules.pro`
Header comment: *"Test features that use reflection/Gson against a RELEASE build… R8 stripping has already bitten tactical-puzzle loading once."* The keep rules cover `com.chess99.data.dto.**` — but that package contains only `AuthDtos.kt`/`DtoMappers.kt`; every other feature hand-parses `Response<JsonObject>` (`data/api/GameApi.kt` et al.), so obfuscated Gson internals leak into user-facing messages on any parse failure. Action: add a release-build smoke test lane (the failures found here — History, Dashboard, Referrals, Stats, Subscription — are all release-visible).

### 4.7 Theme & a11y
- `presentation/theme/Theme.kt`: **good** — full light+dark Material role mapping to the brand palette with an explanatory comment; this is why the app no longer looks template-purple.
- But **200 hardcoded `Color(0x…)` usages** exist in `presentation/**` outside the theme package — drift risk for future re-themes and dark-mode correctness.
- Content descriptions: 92 `contentDescription = null` vs 35 labeled — most nulls are decorative icons beside text (acceptable Compose practice), and key icon-only buttons (Menu, Logout) are labeled; TalkBack/font-scale passes not yet run.
- Copy bugs with file refs: raw enum + dangling inviter — `presentation/championship/ChampionshipInvitationsScreen.kt:105,111`; ISO birthday — `presentation/profile/ProfileScreen.kt:249`.

---

## 5. Benchmark gap analysis (ranked by retention impact)

1. **Streaks & daily goals (Duolingo/ChessKid):** the app *mentions* streaks but has no streak system UI. This is the single biggest comeback mechanic missing. (Data exists — trainer tracks `bestStreak: 46`.)
2. **Real lessons with a guided path (ChessKid's #1 asset):** Tutorials are empty; web has interactive lessons. Without lessons, "chess academy for kids" is a slogan.
3. **Bot personas (chess.com):** faceless difficulty slider vs named, avatared bots kids pick by personality. Backend already has 35 synthetic players — pure reuse.
4. **Celebration & delight (ChessKid/Duolingo):** no confetti, no mascot, no animation on "Correct!" or level-up. For kids, celebration *is* retention.
5. **Liquidity-masking matchmaking (chess.com):** never show "0 online"; blend bots into quick play so a child always gets a game in <10 s.
6. **Puzzle Rush / timed modes (chess.com, and this repo's own Tier-1 competitive plan):** trainer is untimed-only; no adrenaline loop.
7. **Progress visualization (Duolingo path, ChessKid levels):** XP/Level exist as dead numbers; no path map, no next-milestone framing.
8. **Notifications/comeback hooks:** no evidence of daily-puzzle reminders or streak-rescue pushes on Android (web backend already sends play-reminder emails — parity gap).
9. **Own-row highlight & social proof (Lichess leaderboards):** minor, but cheap.
10. **Parent-facing surface (ChessKid's parent app/report cards):** My Kids linking is built and good — extend it to a parent dashboard view with the weekly report card promised in its copy.

---

## 6. Prioritized roadmap

### Quick wins (≤1 day each)
1. **Wire logout properly** (call `AuthViewModel.logout()`, add confirm; or remove from top bar) — NavGraph.kt:142.
2. **Human error copy everywhere**: replace `e.message` renderings; "Network error: I5.n…" → "Couldn't load your games. Retry."
3. **`finally { isLoading = false }` + error cards** in Dashboard/Referral/Stats ViewModels — kills all three infinite spinners.
4. **Null-safe `parseGameSummary`** (`mapNotNull`, `isJsonObject` guards) — restores Game History.
5. **Format birthday + date picker** (ProfileScreen.kt:249); map `swiss_only`→"Swiss"; hide empty "Invited by"; fix "Rating -0".
6. **Remove the "0 online" badge**; give Lobby/Organizations empty states a CTA.
7. **Static in-app Privacy/Terms** (bundled text) — closes the compliance hole today.
8. **Hint confirmation** ("Show solution? This ends the puzzle") + make "Next" from Solution open play mode.
9. Transparent logo asset on hero/auth; pad hero text.

### Medium (≤1 week each)
1. **Bundle Stockfish binaries (all ABIs) and restore Play vs Computer** — also revives Companion/CCT/review analysis. Add a release-build device smoke test to CI so a missing binary can never ship again.
2. **Regenerate tactical puzzle assets** with the setup ply applied (fix pipeline, both Android assets and `chess-frontend/src/data/`), fix `playerColor`/`explanation`, and add honest scoring (attempts/hints/solution-viewed) + solution-line playback animation.
3. **Fix Learn**: verify tutorial API contract, surface real lessons (or bundle a starter pack), give lesson cards titles, connect achievements to live features.
4. **Streak system v1**: daily-anything streak (puzzle/daily/game), flame + count on Home hero and Daily screen, streak-rescue local notification.
5. **First-run onboarding**: 2–3 value screens → guest-first flow → name/age → first puzzle within 60 s ("first win").
6. **Real bottom navigation** (persistent NavigationBar across Home/Lobby/Learn/Profile) + drawer curation to ≤8 sectioned items.
7. **Fix WebView surfaces** (E-Book) or remove them from the drawer until the wrapped routes work; hide site chrome inside WebViews.
8. **Referral/Ambassador attribution**: never render a code-less link; parent-gate the commission program.

### Deep work (multi-week)
1. **Bot personas + liquidity blending**: surface the 35 synthetic players as characterful opponents in Quick Play and PvC; auto-offer after 15 s of empty matchmaking.
2. **Delight layer for kids**: mascot, celebration animations (confetti on solve/level-up), sound design, XP path map with milestones.
3. **Parent dashboard on Android**: extend My Kids into report-card views (web `ParentDashboardController` exists — parity port).
4. **Release-build QA discipline**: Play-store-track internal testing checklist that walks every drawer destination on a minified build against prod (this review found 9 release-visible breaks in one pass).
5. **Puzzle Rush/duel timed modes** per the Tier-1 competitive plan.

---

## 7. What's already strong (do not regress)

1. **The green/gold theme** (`Theme.kt`) — complete Material role mapping, light+dark, reads as a brand, not a template. The re-theme achieved its goal.
2. **Tactical Trainer UI/UX shell** — dashboard stats, staged progression with unlock criteria, theme chips, hint-on-failure, clean success card. Once the data is fixed this is the app's flagship, near ChessKid quality.
3. **Chessboard rendering** — Cburnett pieces, selection dots, coordinates; fast and attractive.
4. **My Kids parent linking** — clear value copy, child-approval consent model, honest empty state. Genuinely good kid-safety design.
5. **Leaderboard** — podium + tabs + invite CTA; best-designed social surface in the app.
6. **Quick Play form** — clean time-control/color/mode selection with a proper searching/cancel state.
7. **Auth affordances** — guest mode, SSO, disabled-until-valid buttons, DOB capture at signup.
8. **Performance fundamentals** — 819 ms cold start to a fully drawn Home; snappy navigation; state restoration on process resume.
9. **Trust posture** — no-gambling disclaimer, honest "purchases happen on the website" subscription stance.

---

*Review artifacts: 57 numbered screenshots in `chess99-android/review-artifacts/`. All findings verified live against the signed release build on production; code citations from the current working tree at `chess99-android/app/src/main/java/com/chess99/`.*
