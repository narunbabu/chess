# Web vs Android Parity Review — Cluster 3: Victory-Image Social Sharing + User Progress

Date: 2026-07-17
Scope: `chess-frontend/` (React) + `chess-backend/` (Laravel) vs `chess99-android/` (Kotlin/Compose)
Method: READ-ONLY source review (Android build artifacts under `app/build/` ignored).

---

## TL;DR

- **Web is far ahead on sharing.** After a game, web renders a rich branded victory/defeat card, captures it as a JPEG via `html2canvas`, and shares it (image + text) through the native share sheet, plus **animated GIF and MP4 replay** generation, plus a server-uploaded shareable link with OG preview. Android has code for a comparable card + screenshot share **but it is dead/unwired** — the live game-over screen shows only a plain "Victory!/Defeat" text card with a single navigation button and **no share at all**. The only working Android share is a PGN-file share from the game-history list.
- **Web is ahead on progress visualization.** Web has time-series **charts** (rating line chart, points-per-day and games-per-day stacked bar charts) backed by `/user/progress`. Android shows only **flat numeric stats** and a text list of recent rating changes — no charts, and it does **not** consume the `/user/progress` endpoint.

---

## Item 1 — Sharing victory image on social media

| Aspect | Web | Android | Gap |
|---|---|---|---|
| Post-game result card | Rich branded `GameEndCard` (gradient theme by result, Chess99 logo, both players w/ avatars + crown, score, rating delta, eval points, "avenge my defeat" CTA) | `GameEndCard.kt` composable exists with similar structure (result header, players, animated rating change, stat chips, 5 share buttons) **but has ZERO callers**. Live games render a minimal `GameResultCard` instead: just "Victory!/Defeat/Draw" + details + one button ("New Game" / "Back to Lobby"). | **ANDROID-MISSING** (functional): the good card is dead code; users see a bare text card. |
| Victory **image** generation | Yes — `html2canvas` captures the card to a scale-2 JPEG blob | `ShareManager.captureAndShareScreenshot()` exists (View→Bitmap→PNG→FileProvider→ACTION_SEND) **but is never called anywhere**. | **ANDROID-MISSING**: no image is ever produced/shared in practice. |
| Animated replay (GIF) | Yes — `shareGameReplay` renders the game to an animated GIF and shares it | None | **ANDROID-MISSING** |
| Video replay (MP4/WebM) | Yes — `shareGameVideo` (MediaRecorder), portrait 9:16 & landscape 16:9 for Reels/Stories/YouTube | None | **ANDROID-MISSING** |
| Share targets | Native Web Share API (files+text) first; fallbacks: WhatsApp, Facebook, X/Twitter, LinkedIn, Instagram (download+clipboard), copy-link, download | In `ShareManager`: system chooser + direct WhatsApp / Twitter(X) / Facebook / copy-link / invite-link / PGN-file — but only `sharePgnFile` is wired (from history). Social/text/screenshot share methods are unreferenced. | **DIVERGENT / ANDROID-MISSING**: Android has broader per-network intent code, yet none of it is reachable from the game-end flow. |
| Server-side shareable link + OG preview | Yes — `uploadGameResultImage` → `share_url` copied to clipboard, used as fallback and background upload | `SocialApi` injected into `ShareManager` but `trackShare()` is a no-op stub ("would need a coroutine scope in production"); no image upload / share link. | **ANDROID-MISSING** |
| What actually ships today | Full image/GIF/video + multi-network share from the game-completion overlay | Only: share a **.pgn file** for a past game from the History screen. No victory image anywhere. | **ANDROID-MISSING** (core feature) |

### Key files — Item 1
- Web: `chess-frontend/src/components/GameEndCard.js` (card + `handleShare` html2canvas capture), `chess-frontend/src/components/GameCompletionAnimation.js` (Share / GIF / Video buttons, share menu), `chess-frontend/src/utils/shareUtils.js` (`shareGameWithFriends`, `shareGameReplay`, `shareGameVideo`, `generateShareMessage`), `chess-frontend/src/utils/gifExportUtils.js`, `chess-frontend/src/utils/videoExportUtils.js`, `chess-frontend/src/services/sharedResultService.js` (`uploadGameResultImage`).
- Android: `chess99-android/app/src/main/java/com/chess99/presentation/social/ShareManager.kt` (all share methods; only `sharePgnFile` wired), `.../social/GameEndCard.kt` (rich card — **no callers**), `.../social/RatingChangeNotification.kt` (**no callers**), `.../game/PlayComputerScreen.kt` (`GameResultCard` — the real, bare game-over UI), `.../game/PlayMultiplayerScreen.kt` (bare result card → Back to Lobby), `.../history/GameHistoryViewModel.kt` (only real ShareManager consumer, calls `sharePgnFile`).

---

## Item 2 — User progress storing / retrieving / showing

| Aspect | Web | Android | Gap |
|---|---|---|---|
| Rating progression over time | **Line chart** (recharts) via `/user/progress` `rating_progression`, with 7d/30d/all period toggle and date-gap filling | Text list of last ~10 games (date, new rating, +/- change) in `ProfileScreen` Stats tab / `RatingHistoryScreen`; no chart | **ANDROID-MISSING** (no time-series chart) |
| Points gained/lost per day | **Stacked bar chart** (`points_per_day`: gained green / lost red) | None | **ANDROID-MISSING** |
| Games/day win-draw-loss breakdown | **Stacked bar chart** (`games_per_day`: wins/draws/losses) | None | **ANDROID-MISSING** |
| Win/loss/draw counts | Yes (`DetailedStatsModal` + charts) | Yes (Profile Stats tab, Dashboard, `DetailedStatsSheet`) | Parity |
| Streaks (current + best) | Yes | Yes | Parity |
| Peak rating | Yes | Yes | Parity |
| Game-by-game history | Yes (full table: date, mode, opponent, color, result, scores, moves) | Yes (text rows) | Parity (web richer) |
| Puzzle / tactical stats in progress view | Present in web progress/stats surfaces | Only inside the separate Tactical Trainer module, not the progress/profile view | **DIVERGENT** (minor) |
| Backend endpoint consumed | `GET /user/progress?period=` → `{ rating_progression, points_per_day, games_per_day }` (day-grouped SQL over `ratings_history` + `games`) | `GET /rating/history` + `GET /performance/stats` (flat aggregates + per-game list). **Does NOT call `/user/progress`.** | **ANDROID-MISSING**: the daily time-series endpoint exists server-side but Android never uses it, so charts can't be built from current calls. |

### Key files — Item 2
- Web: `chess-frontend/src/components/UserProgressCharts.js` (3 recharts charts), `chess-frontend/src/components/ProgressChartsModal.js` (period toggle, calls `/user/progress`), `chess-frontend/src/components/DetailedStatsModal.js` (summary cards, CSS bar chart, W/L/D timeline, games table), `chess-backend/app/Http/Controllers/UserProgressController.php` (`progress()` builds `rating_progression`/`points_per_day`/`games_per_day`).
- Android: `.../presentation/dashboard/DashboardScreen.kt` + `DashboardViewModel.kt` (rating, peak, games, win rate, streak, recent games — numbers only), `.../presentation/profile/ProfileScreen.kt` + `ProfileViewModel.kt` (Stats tab: W/L/D badges, rating history text list), `.../presentation/profile/RatingHistoryScreen.kt` (summary cards + per-game text list), `.../presentation/common/DetailedStatsSheet.kt` (numeric stats sheet), `.../data/api/ProfileApi.kt` (`/rating/history`, `/performance/stats`). No charting library in `build.gradle.kts` (no Vico/MPAndroidChart).

---

## Prioritized gaps (most impactful first)

1. **ANDROID-MISSING — No post-game sharing at all (highest impact).** The live game-over screens (`PlayComputerScreen.GameResultCard`, `PlayMultiplayerScreen`) show a plain text card with a single navigate button and no share. The complete, well-built `GameEndCard.kt` + `ShareManager` screenshot/social share is present but **entirely unwired** (0 callers of `GameEndCard(`, 0 callers of `captureAndShareScreenshot`). Web's virality loop (image/GIF/video + WhatsApp/FB/X/native share + shareable link) has no Android counterpart in the shipped flow. Fix is largely wiring existing code + adding a bitmap capture of the card.
2. **ANDROID-MISSING — No progress charts.** No rating line chart, no points-per-day, no games-per-day bar charts. Android shows flat numbers + a text list. Web's `/user/progress` daily time-series endpoint is not consumed by Android; a charting lib (e.g., Vico) + the endpoint would be needed.
3. **ANDROID-MISSING — No GIF/MP4 replay export.** Web-exclusive share formats (Reels/Stories/YouTube-ready) with no Android equivalent.
4. **ANDROID-MISSING — No server share-link / OG preview.** `SocialApi` is injected but `trackShare` is a stub and no `uploadGameResultImage` equivalent exists; Android cannot produce link-preview shares.
5. **DIVERGENT — Share-tracking analytics.** Web logs shares (background upload + conversion tracking); Android's `trackShare` is an explicit no-op TODO, so even the one working share (PGN) is untracked.
6. **DIVERGENT (minor) — Puzzle/tactical stats** surfaced in web progress views but siloed in Android's Tactical Trainer, absent from Profile/Dashboard progress.

_No WEB-MISSING items found in this cluster — web is a strict superset of Android for both sharing and progress._
