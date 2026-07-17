# Chess99 Android — Quality & Parity Plan (pre-publish)

**Date**: 2026-07-14
**Status**: PROPOSED — publish is ON HOLD until these close and owner approves
**Why**: Owner review of release screenshots — app reads as mediocre: low-quality
chess pieces, weak visual design, and shallower functionality than the web app.

---

## Confirmed quality problems (evidence from running the signed release build)

### Q1 — Chess pieces are Unicode glyphs, not real piece art  ✅ FIXED (2026-07-14)
Was: `ChessBoardView.kt` drew pieces with `drawText` of Unicode chess characters
(`♔…♟`) — thin font outlines, white/black indistinguishable.
Fix: extracted the exact Cburnett SVG paths the web uses
(`chess-frontend/src/assets/pieces/pieces3d.js`, gradient + specular highlight +
colored stroke), rasterized to 256px PNGs via `chess99-android/scripts/gen_pieces.py`
→ `app/src/main/res/drawable-nodpi/piece_{w,b}{p,n,b,r,q,k}.png`. `ChessBoardView`
now loads them (`ImageBitmap.imageResource`) and draws with `drawImage`
(FilterQuality.High). **Verified on-device**: puzzle board renders premium 3D
pieces identical to web. Single shared board component, so this covers every screen.

### Q2 — Engine features fully broken (no Stockfish binary bundled)
No `jniLibs/` or `assets/stockfish` ships in the APK; `StockfishBridge` execs a
binary that doesn't exist. Breaks, on ALL devices: Play vs Computer, Companion
mode, CCT best-move, game-review engine analysis. **Fix options**:
- (a) Bundle Stockfish: cross-compile for arm64-v8a / armeabi-v7a / x86_64
  (PIE executable or `.so`) into `jniLibs`, wire extract+chmod+exec, test.
- (b) Ship a lightweight pure-Kotlin engine fallback for low levels (weaker but
  always works), keep native for higher levels.
- (a) is the right long-term answer and matches the store listing claim.

### Q3 — App theme + Home design were generic  ✅ FIXED (2026-07-14)
Root cause: `Theme.kt` set only 5 Material roles (primary/secondary/tertiary/
surface/background) and left every *container* + *surfaceVariant* role at
Material's **purple** baseline — so cards, the Learn stats bar, sliders and nav
highlights all rendered generic lavender despite the green/gold brand.
Fixes:
- `Theme.kt`: full brand palette (light + dark) — all primary/secondary/tertiary
  container roles, surfaceVariant, and the surfaceContainer ladder mapped to the
  board-green + warm cream/gold family. Status-bar icons follow theme. **This
  recolored every logged-in screen at once** (verified: Learn stats bar is now
  green, not purple; nav highlight is gold).
- `HomeScreen.kt`: redesigned the starting page — green gradient hero with the
  Chess99 logo + tagline, two branded gradient play cards (green / gold), and an
  "Explore" 2-col grid (Learn, Puzzles, Daily, Tournaments, Leaderboard, History)
  that fills the former dead white space. Branded drawer header too.
- `LoginScreen.kt`: added the brand logo + scroll-safe layout.
Still deferred (minor, in-game board): last-move/selection highlight polish,
check indicator, move animations.

## Verified working (so not everything is broken)
Email/Google/Facebook login, guest play, lobby + live WebSocket presence,
tutorials list, tactical trainer dashboard + bundled puzzle solving (after the
R8/Gson fix), profile, subscription status.

## Known smaller defects found
- Profile birthday shows raw ISO string `1981-06-06T18:30:00.000000Z` (format it).
- "Practice → Tactics Trainer" (API puzzles) returns "No puzzles available" on
  prod for the test account; bundled Tactical Progression works.
- Stats tab renders empty (no chart/data).

---

## Feature-parity gap analysis (NEEDS A PROPER PASS)
Screen *count* is roughly at parity (≈37 Android screens vs ≈33 web routes), so
"less functionality" is likely **depth within screens**, not missing screens.
Before committing to a fix list, run a systematic web-vs-Android comparison per
feature area and record: present / partial / missing / broken. Candidate areas
to audit (web routes as the reference):
play (vs computer, online, companion), lobby/matchmaking, learn (tutorials +
training), tactical trainer, daily challenges, championships/tournaments,
game history + review, leaderboard, friends/social, organizations, referrals,
ambassador, parent dashboard, profile/settings, ebook, puzzles.

---

## Proposed sequencing (pending owner priorities)
1. **Q1 chess pieces + Q3 board design** — highest visual ROI; makes the app
   look credible. (~1–2 days incl. asset prep)
2. **Q2 Stockfish** — restores Play vs Computer + companion + analysis. (~1 day)
3. **Feature-parity audit** → prioritized backlog of depth gaps. (~0.5 day audit)
4. Close smaller defects (birthday format, stats, API puzzles).
5. Re-screenshot, re-verify on device, THEN request owner green signal to publish.

## Owner decisions needed
- Q2 approach: bundle native Stockfish (a) vs add Kotlin fallback (b) vs both?
- Piece set: reuse the exact web set, or pick a standard set (cburnett/Merida)?
- Scope: fix everything to parity before v1, or ship a smaller high-quality v1
  (fewer features, but each polished) and add the rest in updates?
