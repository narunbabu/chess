# S2 — Best moves / CCT in PlayComputer (P0, Android only)

## Problem

PlayComputer (vs engine — the screen kids use most) has **zero** best-move or
CCT capability, while multiplayer has the full panel. Worse, the learning-mode
setup copy already promises "Best-move & undo help from a small pool" —
the best-move half doesn't exist. Web shows CCT arrows + Stockfish top-3 in
casual and learning single-player games.

All building blocks exist on Android already, built for multiplayer:
- `engine/CCTAnalyzer.kt` — pure CCT logic (checks/captures/threats)
- `presentation/game/CCTControls.kt` — bottom sheet UI incl. `CCTRatedGate`
- `ChessBoardView.kt` — `BoardArrow` overlay support
- `StockfishEngine` (`@Singleton`) — already injected into
  `PlayComputerViewModel` for the computer's own moves; `getBestMove()`
  returns `rankedMoves` (top-N with rank/score/mate)

This is a port of the multiplayer wiring (`PlayMultiplayerViewModel` lines
~1104–1240) into `PlayComputerViewModel`, plus mode gating.

## Web behavior to replicate (CCTPanel.jsx)

Hint levels: `0 = off`, `1 = CCT arrows`, `2 = Best moves (top-3 arrows,
gold/silver/bronze, origin squares labeled 1/2/3)`.

Gating:
- **Rated**: CCT *counts* may remain visible, but arrows and best moves are
  fully disabled (web shows a "Limited in Rated games" gate — `CCTRatedGate`
  already implements this on Android).
- **Casual / companion**: CCT unlimited, Best unlimited.
- **Learning**: CCT unlimited; each Best *reveal on a new position* consumes
  one helpline from the pool shared with undo (see S3). Re-toggling Best on
  the same FEN is free (web tracks `bestRevealFen`).

Best-move analysis: Stockfish top-3 at the multiplayer port's settings
(depth 12, MultiPV 3) on the current FEN; only when it's the player's turn
and the game is active; cancel/ignore stale results when a move lands.

## Tasks

### T1 — ViewModel wiring

In `PlayComputerViewModel`, mirror the multiplayer implementation:
- Add `cctState` (hint level, CCT counts, best moves, perspective) to
  `PlayComputerUiState` — reuse the same state types multiplayer uses so
  `CCTControls.kt` composables work unmodified.
- `setCctHintLevel(level)`, `updateCCTAnalysis()` (run `CCTAnalyzer` after
  every position change while a hint level is active), `loadBestMoves()`
  (Stockfish MultiPV top-3 → gold/silver/bronze `BoardArrow`s).
- **Engine contention**: the same Stockfish instance computes the computer's
  reply. Only run best-move analysis when `game.turn == playerColor` and no
  computer move is in progress; cancel analysis when the player moves. If the
  singleton can't safely interleave sessions, serialize via the existing
  engine mutex/dispatcher rather than adding a second engine process.
- Gating: rated → hint level locked to counts-only (arrows never emitted);
  learning → route Best reveals through the shared helpline consumer
  (S3's `consumeLearningHelp("best-move")`; until S3 lands, use the existing
  learning pool field directly).

### T2 — UI

In `PlayComputerScreen`:
- Add the Analysis entry point matching multiplayer (TopAppBar action →
  `CCTBottomSheet`), hidden in rated games or shown with `CCTRatedGate`.
- Render `cctArrows` on `ChessBoardView` exactly as multiplayer does.
- Learning mode: Best button label shows remaining pool, e.g. "Best (3 left)".

### T3 — Verification

- Casual game: CCT arrows update live; Best shows 3 ranked arrows; unlimited
  toggles.
- Learning game: each Best reveal on a new position decrements the shared
  pool; pool exhausted → Best blocked with message, CCT still works; undo
  also draws from the same pool.
- Rated game: no arrows, no Best, gate copy shown; undo button absent
  (existing behavior — must not regress).
- Computer thinking: Best request during engine move neither corrupts the
  engine session nor shows arrows for the wrong side.
