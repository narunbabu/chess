# Web ↔ Android Parity Review 2: Best-Move Analysis + Synthetic-Bot Strength

**Date:** 2026-07-17
**Cluster:** CCT (Chess Coaching Tool) analysis + synthetic-bot / opponent engine strength
**Scope:** Read-only. Web = `chess-frontend/` (React) + `chess-backend/` (Laravel). Android = `chess99-android/` (Kotlin/Compose).

---

## Executive Summary

The **CCT analysis panel** (checks/captures/threats, warnings, best-move list, perspective toggle, rated-gate) is a faithful, near-1:1 port between platforms — very good parity. The **big divergences are all in bot strength / move selection and best-move help ergonomics**:

1. **DIVERGENT (highest impact): Opponent bots are NOT equally strong.** Web selects the bot's move with a sophisticated centipawn-budget + softmax + blunder-injection model (ELO-aware), plus a dedicated sub-1300 weakening engine. Android uses a crude rank-bucket lottery (`selectMoveFromRankedList`) that ignores ELO/rating entirely and only keys off the 4 difficulty tiers. Same level → materially different playing strength and "feel" across platforms.
2. **DIVERGENT: Companion strength differs.** Web companion always plays the single best move (`getStockfishTopMoves(fen, 1, …)` — pure top-1, no delay). Android companion routes through `getBestMove()`, which applies the rank-bucket weakening AND a forced 1500 ms think delay — so the Android companion can play *sub-optimal* moves and is slower, contradicting the "companion always suggests the best move" design.
3. **WEB-MISSING / ANDROID-DIVERGENT: think-time model.** Web has a rich human-like perceived-think-time model (`calculatePerceivedThinkTime`: personality profiles, phase, captures/checks, ELO jitter). Android has only a flat `MIN_PERCEIVED_THINK_TIME_MS = 1500` floor. Bots "think" very differently.
4. **ANDROID-MISSING: sub-1300 weakening engine.** Web's `sub1300Stockfish.js` (ELO 200–1300, per-anchor depth/temperature/blunder profiles) has no Android counterpart. Beginner bots on Android are much stronger than on web at the same nominal rating.
5. **ANDROID-MISSING: best-move helpline budget + numbered origin labels.** Web gates best-move reveals behind a consumable "helpline" budget (learning mode) and draws numbered 1/2/3 labels at move origins. Android draws best arrows but has no budget gating and no numbered labels.
6. **Minor: best-move arrow count** — web can show up to 3 best arrows + labels and up to 5 in the list; Android shows top 3 in both list and arrows (functionally close).

---

## Detailed Comparison Table

| Item | Web | Android | Gap | Key files |
|------|-----|---------|-----|-----------|
| **CCT scan (checks/captures/threats)** | `analyzeCCT()` pure chess.js; MVV-LVA capture sort; threat = quiet move whose piece now attacks equal-or-higher victim | `CCTAnalyzer.analyze()` — line-for-line port; same MVV-LVA sort, same threat logic, same piece values (P1/N3/B3.25/R5/Q9) | **Equivalent** ✅ (Android even handles en-passant explicitly) | `cctAnalysis.js` ↔ `CCTAnalyzer.kt` |
| **Threat/best-move arrows** | `cctToArrows`: checks (red, ≤3), captures (orange, ≤4), threats (yellow, ≤3, arrow from dest→victim) | `cctToArrows`: identical colors, identical caps, identical semantics | **Equivalent** ✅ | `cctAnalysis.js` L152 ↔ `CCTAnalyzer.kt` L223 |
| **Best-move arrows (gold/silver/bronze)** | top 3 arrows + numbered origin **labels** (1/2/3) | top 3 arrows, **no numbered labels** | **ANDROID-MISSING**: numbered origin labels | `CCTPanel.jsx` L112 `bestMovesToLabels` (no Android equiv) |
| **Best-move list** | up to 5 moves (`topMoveLimit=5`), tag + cp/mate badge | top 3 moves, tag + cp/mate badge | **DIVERGENT (minor)**: web 5 vs Android 3 | `CCTPanel.jsx` L231 ↔ `PlayMultiplayerViewModel.kt` L1171 |
| **Best-move engine depth** | `mapDepthToMoveTime(12)` movetime (~1200 ms) | `getBestMove(fen, 12)` → movetime 1200 ms (but adds 1500 ms floor) | **DIVERGENT**: Android best-move analysis inherits the 1500 ms gameplay floor (slower reveal) | `CCTPanel.jsx` L231 ↔ VM L1167 |
| **Move classification (Check/Capture/Threat/Positional)** | `classifyMoveAgainstCCT` | identical port | **Equivalent** ✅ | `cctAnalysis.js` L176 ↔ `CCTAnalyzer.kt` L242 |
| **Warning system (severity + messages)** | `getWarningInfo`, deterministic FEN-hash pick, 6 severity buckets, emoji-prefixed | `CCTAnalyzer.getWarning`, same FEN-hash pick, same message pools, `CCTWarningSeverity` enum | **Equivalent** ✅ (Android maps to CRITICAL/DANGER/WARNING/CAUTION/SAFE, web to critical/danger/warning/caution/safe) | `CCTPanel.jsx` L13 ↔ `CCTAnalyzer.kt` L262 |
| **Perspective toggle (My Moves / Their Threats)** | yes (`perspective` state) | yes (`onPerspectiveChange`) | **Equivalent** ✅ | both |
| **Rated-gate (counts visible, hints/best disabled)** | yes — `isRated` shows counts only | yes — `CCTRatedGate` identical behavior | **Equivalent** ✅ | both |
| **Best-move helpline budget (learning mode)** | `bestMoveBudget` / `onConsume('best-move')` / remaining-helplines gating + one-shot reveal | none — Best toggle is free/unlimited | **ANDROID-MISSING**: consumable helpline economy | `CCTPanel.jsx` L257–288 (no Android equiv) |
| **Opponent bot move selection** | `selectMoveWithCpBudget`: per-ELO cp budget `(3500-elo)/16`, softmax temperature `(3000-elo)/80`, blunder injection `(2800-elo)/12000` with opening protection + phase ramp | `selectMoveFromRankedList`: pick a random move from a fixed **rank bucket** by tier (EASY ranks 5–8, MEDIUM 2–4, HARD 1–2, EXPERT rank 1). **No ELO/rating input at all** | **DIVERGENT (critical)**: fundamentally different strength curves; Android ignores rating, only sees 4 tiers | `computerMoveUtils.js` L298 ↔ `StockfishEngine.kt` L295 |
| **Sub-1300 beginner weakening** | dedicated `sub1300Stockfish.js` — ELO 200–1300, per-anchor depth/multipv/temperature/blunder profiles, deliberate inaccuracy/mistake/blunder probabilities | none | **ANDROID-MISSING**: Android beginner bots are much stronger than web at same rating | `sub1300Stockfish.js` (no Android equiv) |
| **Bot ELO mapping** | explicit `rating` flows through to selector; falls back to `COMPUTER_LEVEL_RATINGS[depth]`; `getEffectiveDepthForRating` | only `depth` (1–16) flows to engine; rating never used in selection | **DIVERGENT**: web is rating-driven, Android is level-driven | `computerMoveUtils.js` L371 ↔ `PlayComputerViewModel.kt` L287 |
| **Companion move (plays on player's behalf)** | `getStockfishTopMoves(fen, 1, mapDepthToMoveTime(level))` → **always top-1 best move**, no artificial delay | `stockfishEngine.getBestMove(fen, companion.computerLevel)` → runs rank-bucket weakening + **1500 ms floor** | **DIVERGENT (high)**: Android companion can play sub-optimal moves & is slower; violates "companion always best" design | `CompanionControls.jsx` L30 ↔ `PlayMultiplayerViewModel.kt` L838 |
| **Bot "thinking time" model** | `calculatePerceivedThinkTime`: personality profiles (aggressive/defensive/…), game-phase multiplier, capture/check/promotion bumps, ELO-scaled jitter, 300–10000 ms; `waitForPerceivedThinkTime` subtracts real engine time | flat `MIN_PERCEIVED_THINK_TIME_MS = 1500` floor only | **WEB-only rich model / ANDROID-MISSING** | `computerMoveUtils.js` L186–265 ↔ `StockfishEngine.kt` L38,L164 |
| **MultiPV request width** | opponent: 25 top moves; CCT best: `topMoveLimit` (5) | fixed `NUM_TOP_MOVES = 10` engine-wide | **DIVERGENT (minor)**: narrower candidate pool on Android | `computerMoveUtils.js` L11 ↔ `StockfishEngine.kt` L37 |
| **Synthetic player DB / rating formula** | backend `SyntheticPlayer` model, `computer_level` 6–16, rating `800+level*100±50`, 35 players; served via `/api/v1/synthetic-players` | consumes same backend list (`loadCompanions`), maps `computerLevel` → engine depth | **Backend-shared** ✅ (both hit same API) | `SyntheticPlayer.php`, `synthetic-players-research.md` |
| **Fallback on engine failure** | random legal move fallback (two layers) | falls back to `game.legalMoves().firstOrNull()` (first legal, not random) | **DIVERGENT (minor)**: web random vs Android deterministic-first | `computerMoveUtils.js` L424 ↔ `PlayComputerViewModel.kt` L292 |
| **Learning-mode hints** | Best mode = one-shot help gated by helpline budget; CCT arrows free in casual | Best mode free & unlimited; CCT arrows free | **ANDROID-MISSING**: no helpline economy / no learning-mode gating | `CCTPanel.jsx` ↔ `CCTControls.kt` |

---

## Item 1 — Best-moves / CCT analysis

**Verdict: strong parity on the analysis surface.** `CCTAnalyzer.kt` is an explicit line-by-line port of `cctAnalysis.js`: same piece values, same MVV-LVA capture ordering, same threat definition (quiet move whose moved piece now attacks an equal-or-greater-value victim), same arrow colors and caps, same `classifyMoveAgainstCCT`, same warning message pools and deterministic FEN-hash message picker, same perspective toggle, same rated-gate behavior (counts visible, hints off).

**Gaps that remain:**
- **ANDROID-MISSING — numbered origin labels.** Web draws `1/2/3` labels at the origin squares of the top-3 best moves (`bestMovesToLabels`); Android draws only the colored arrows.
- **DIVERGENT — best-move list length.** Web lists up to 5 (`topMoveLimit=5`); Android lists 3.
- **ANDROID-MISSING — helpline budget.** Web's learning mode gates each best-move reveal behind a consumable budget (`bestMoveBudget.onConsume`) with a one-shot reveal per position; Android's "Best" chip is free and re-triggerable.
- **DIVERGENT — best-move reveal latency.** Web runs a dedicated ~1200 ms movetime search with no artificial delay; Android reuses `getBestMove()` which imposes the 1500 ms gameplay floor, making the reveal feel slower.

> Note: `computeCCT.js` (the richer exchange-evaluation threat engine with fork/self-hang/even-trade classification used by the **tactical puzzle trainer**) has **no Android port** — Android's `CCTAnalyzer` implements only the simpler live-game `cctAnalysis.js` logic. This is expected since the memory notes the tactical trainer "full CCT analysis phases not ported."

## Item 2 — Synthetic-bot strength / efficiency (the real divergence)

**Bots are NOT equally strong across platforms.**

- **Web opponent** (`makeComputerMove` → `selectMoveWithCpBudget`): derives a **target ELO** (explicit rating or `COMPUTER_LEVEL_RATINGS[depth]`), requests 25 MultiPV lines, then selects with (a) a per-ELO centipawn-loss budget, (b) a softmax temperature so higher ELO concentrates on the best move, and (c) probabilistic **blunder injection** that is protected during the opening and ramps by move 18. Below 1300 ELO it switches entirely to `sub1300Stockfish.js`, a bespoke weakening engine with per-anchor depth/temperature and explicit inaccuracy/mistake/blunder probabilities.

- **Android opponent** (`StockfishEngine.getBestMove` → `selectMoveFromRankedList`): requests 10 MultiPV lines, then picks a **uniformly random move from a fixed rank bucket** determined only by the coarse difficulty tier (EASY=ranks 5–8, MEDIUM=2–4, HARD=1–2, EXPERT=rank 1). **Rating/ELO is never consulted.** There is no cp budget, no softmax, no blunder injection, and no sub-1300 engine.

**Consequences:**
- Same synthetic player (same `computer_level`/rating) plays with a **different strength curve** on each platform. Android has only 4 effective strengths; web has a continuous ELO-scaled curve.
- Android EASY bots (rank 5–8 lottery) can feel erratically weak or randomly strong; web low-ELO bots make *human-like* graded mistakes.
- Android's lack of a sub-1300 engine means beginner-facing bots are **too strong** for the kid/beginner audience relative to web.

**Thinking time / efficiency:**
- **Web** shapes a human-like perceived think time per move (personality, phase, capture/check/promotion bumps, ELO jitter, 300–10000 ms) and subtracts real engine time so fast searches still "pause" naturally.
- **Android** applies only a single flat **1500 ms minimum** floor (`MIN_PERCEIVED_THINK_TIME_MS`). No personality, no phase, no variation.

**Companion (plays on the player's behalf):**
- **Web** asks for the **single top move** (`getStockfishTopMoves(fen, 1, …)`) with **no** artificial delay → the companion always plays the best move at its level, matching the documented design ("companions always suggest the BEST move").
- **Android** calls the **same `getBestMove()`** used for opponents, so the companion inherits `selectMoveFromRankedList` weakening (can pick a sub-optimal bucketed move) **and** the 1500 ms floor. This means the Android companion is both weaker-than-intended and slower than web's.

## Item 3 — Learning-mode help / hints

Both platforms surface hints through the same CCT panel: **CCT mode** (free colored arrows for checks/captures/threats) and **Best mode** (top engine moves as gold/silver/bronze arrows + list). Both disable hints in rated games and keep CCT counts visible.

The divergence is the **economy and presentation**:
- Web wraps Best-mode reveals in a **consumable helpline budget** (learning mode consumes one helpline per reveal, one-shot per position) and adds **numbered origin labels**.
- Android exposes Best mode as a **free, unlimited toggle** with arrows only (no labels, no budget).

---

## Recommended Fix Priority

1. **DIVERGENT (P0) — Unify opponent move selection.** Port `selectMoveWithCpBudget` (cp budget + softmax + blunder injection, ELO-driven) to Android, and thread `rating` (not just `depth`) into `getBestMove`. Widen MultiPV to ≥25. This is the single largest gameplay-feel gap.
2. **ANDROID-MISSING (P0 for kids audience) — Port `sub1300Stockfish.js`** so beginner bots match web strength.
3. **DIVERGENT (P1) — Fix Android companion** to request top-1 with no weakening and no 1500 ms floor (mirror web), so it truly "plays the best move."
4. **WEB-parity (P1) — Port `calculatePerceivedThinkTime`** to Android for human-like pacing; keep a floor only as a fallback.
5. **ANDROID-MISSING (P2) — Best-move helpline budget + numbered origin labels + 5-move list** for learning-mode parity.

---

## Key Files Index

**Web**
- `chess-frontend/src/utils/cctAnalysis.js` — live-game CCT scan + arrows + classification
- `chess-frontend/src/utils/computeCCT.js` — richer exchange-eval threat engine (tactical trainer; **not ported**)
- `chess-frontend/src/components/game/CCTPanel.jsx` — panel UI, helpline budget, numbered labels
- `chess-frontend/src/utils/computerMoveUtils.js` — `selectMoveWithCpBudget`, `calculatePerceivedThinkTime`, `getStockfishTopMoves`, `makeComputerMove`
- `chess-frontend/src/utils/sub1300Stockfish.js` — sub-1300 weakening engine (**not ported**)
- `chess-frontend/src/components/game/CompanionControls.jsx` — top-1, no delay
- `chess-backend/app/Models/SyntheticPlayer.php`, `docs/synthetic-players-research.md`

**Android**
- `chess99-android/.../engine/CCTAnalyzer.kt` — CCT port (+ warning system)
- `chess99-android/.../engine/StockfishEngine.kt` — `selectMoveFromRankedList` (rank buckets), `MIN_PERCEIVED_THINK_TIME_MS=1500`, MultiPV=10
- `chess99-android/.../presentation/game/CCTControls.kt` — panel UI (no labels, no budget)
- `chess99-android/.../presentation/game/CompanionControls.kt` — companion UI
- `chess99-android/.../presentation/game/PlayMultiplayerViewModel.kt` — companion + opponent move dispatch, `loadBestMoves`, arrow rendering
- `chess99-android/.../presentation/game/PlayComputerViewModel.kt` — single-player opponent dispatch
