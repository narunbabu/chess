# S1 — Tactical puzzle normalization + scoring integrity (P0, Android)

## Problem

The bundled tactical puzzles are raw **Lichess format**: `moves[0]` is the
*opponent's setup ply* that must be applied to the FEN before the puzzle is
shown; the solver is the *other* side. The data's `playerColor` and
`explanation` were generated from the pre-setup FEN, so they label the wrong
side (generator bug: `chess-backend/database/puzzles_data_download_lichess.js`
lines 32–44 — do NOT fix the generator in this spec; data stays as-is).

- **Web is CORRECT**: `chess-frontend/src/components/tactical/TacticalTrainer.js`
  lines 18–45 has `normalizePuzzle()` which applies `moves[0]` to the FEN,
  drops it from `moves`, recomputes `playerColor` from the new FEN, and fixes
  the explanation prefix. It runs on every puzzle right after the JSON loads.
- **Android never ported this**. `TacticalTrainerViewModel.loadPuzzlesFromFile()`
  (lines ~237–245) gson-parses the JSON and uses it raw. Observed live: puzzle
  says "White to move", accepts White's *blunder* as "Correct! 100/100", and the
  solution viewer then shows White getting mated (review §3.17, §4.4;
  screenshots `31`–`38`).

Also observed (Android-only scoring/UX defects, review §3.17):
- After 2 wrong attempts AND viewing the full solution, replaying the known
  move still scores **100/100** — state resets when re-entering the puzzle.
  (`computePuzzleScore()` in `TacticalModels.kt` lines 155–200 already supports
  `wrongCount`/`solutionShown` correctly; the *caller* loses the state.)
- The hint lightbulb **forfeits instantly** to the Solution screen, records
  "Rating -0", no confirmation.
- "Next" from the Solution screen opens the *next puzzle's solution* (spoiler),
  not its play state.
- "Rating -0" is rendered in red.

## Files

- `chess99-android/app/src/main/java/com/chess99/presentation/learn/tactical/TacticalTrainerViewModel.kt`
- `chess99-android/app/src/main/java/com/chess99/presentation/learn/tactical/TacticalModels.kt`
- `chess99-android/app/src/main/java/com/chess99/presentation/learn/tactical/TacticalPuzzleContent.kt`
- Reference (read-only): `chess-frontend/src/components/tactical/TacticalTrainer.js` lines 18–54

## Tasks

### T1 — Port `normalizePuzzle` to Kotlin (the core fix)

In `TacticalTrainerViewModel`, add a private function mirroring the web exactly,
and apply it to every puzzle in `loadPuzzlesFromFile()` right after gson parse
(before `sortedBy { it.rating }`):

```kotlin
/**
 * Lichess-format bundled puzzles store the opponent's setup ply as moves[0].
 * Apply it to the FEN so the solver sees the real puzzle position — mirrors
 * normalizePuzzle() in chess-frontend TacticalTrainer.js.
 */
private fun normalizePuzzle(p: TacticalPuzzle): TacticalPuzzle {
    if (p.moves.size < 2) return p
    return try {
        val game = ChessGame(p.fen)
        // apply setup ply; moveUci returns success — check the actual signature
        // of ChessGame.moveUci (used at TacticalTrainerViewModel:~296) and bail
        // out (return p) if the move is illegal/fails
        if (!game.moveUci(p.moves[0])) return p
        val newFen = game.fen()
        val newColor = newFen.split(" ")[1]                 // "w" or "b"
        val colorName = if (newColor == "w") "White" else "Black"
        val wrongName = if (newColor == "w") "Black" else "White"
        val newExplanation =
            if (p.explanation.startsWith(wrongName))
                colorName + p.explanation.removePrefix(wrongName)
            else p.explanation
        p.copy(
            fen = newFen,
            moves = p.moves.drop(1),
            playerColor = newColor,
            explanation = newExplanation,
        )
    } catch (e: Exception) {
        p // never crash puzzle loading over one bad entry
    }
}
```

Notes for the implementer:
- `TacticalPuzzle` is a gson-parsed model in `TacticalModels.kt` — confirm it is
  a `data class` so `.copy()` exists; if fields are `var`/non-data, convert to
  data class (gson is unaffected).
- If `ChessGame.moveUci` returns `Unit` or a Move object instead of Boolean,
  adapt the guard accordingly (web treats a failed/illegal setup move as
  "leave the puzzle unchanged").
- Everything downstream (attemptMove expected-move indexing, opponent
  auto-reply, board orientation from `playerColor`, solution viewer) already
  indexes `moves` from 0 and will be correct once the data is normalized.
  **Do not change `attemptMove` logic for this task.**
- Do NOT modify the JSON assets and do NOT touch web code — web already works.

### T2 — Scoring integrity (state must survive the solution viewer)

`computePuzzleScore(wrongCount, …, solutionShown)` already returns execScore 0
when `solutionShown=true` and 100/75/50/25/10 by wrongCount. Fix the callers:

1. Track per-puzzle attempt state (`wrongCount`, `solutionShown`) keyed by
   puzzle id in the ViewModel, NOT in transient screen state.
2. Opening the solution viewer for the current puzzle sets
   `solutionShown = true` for that puzzle id — **permanently for this attempt**.
   Returning to the board and playing the revealed move must score exec 0 and
   award no rating gain.
3. Re-entering the same puzzle in the same session must not reset `wrongCount`.
   (Moving to the NEXT puzzle starts fresh state — that is correct.)
4. Ensure `onPuzzleSolved` passes the real `wrongCount` and `solutionShown`
   into `computePuzzleScore` (verify current call site — the 100/100 symptom
   means at least one of them arrives as default).

### T3 — Hint flow: two-stage + confirmation

Current: lightbulb → instant Solution screen ("Rating -0"). Replace with:
1. First tap: highlight the from-square of the expected move (the mechanism
   already exists — `hintSquare` is set after a wrong attempt at
   `TacticalTrainerViewModel:~303`). Costs nothing.
2. Second tap: `AlertDialog` — title "Show the solution?", text "You'll get 0
   points for this puzzle.", confirm "Show solution" / dismiss "Keep trying".
   Confirm → solution viewer + `solutionShown = true` (T2).

### T4 — "Next" from Solution opens PLAY mode

From the solution viewer, the Next button must load the next puzzle in its
normal play phase (board, not solution). Find the phase transition in
`TacticalTrainerViewModel` (solution-viewer "next" path) and route it through
the same entry point used when a puzzle is opened from the dashboard.

### T5 — Rating delta display

Never render "-0". Rule: delta > 0 → "+N" (green); delta < 0 → "−N" (red);
delta == 0 → hide the rating chip entirely. Locate the composable rendering
"Rating -0" in `TacticalPuzzleContent.kt`.

### T6 (optional, P2 — do last, skip if time-boxed out)

On "Correct!", animate the remaining solution line on the board (player move +
opponent reply, ~600 ms per ply) before showing the success card, and add a
lightweight celebration (e.g., 1.5 s confetti; if adding a library is needed,
use `nl.dionsegijn:konfetti-compose` — otherwise skip confetti, keep playback).

## Acceptance criteria (verify on RELEASE build, on-device)

1. Open Beginner Tactics puzzle #1: the position shown is AFTER the setup ply,
   the side-to-move label matches the board, and the accepted first move is a
   **sound tactical move** (spot-check 3 puzzles against a chess engine or by
   eye — e.g., for data id `s0_000Zo` the solver must be Black playing `e8e1`
   on the post-`e5f6` position, mating with `e1f1` after `g1f2`).
2. The explanation text names the side that is actually to move.
3. Fail twice, view the solution, then play the revealed move → score shows
   exec 0 contribution (NOT 100/100) and no positive rating delta.
4. Hint: first tap highlights a square; second tap shows the confirmation
   dialog; cancel keeps the puzzle alive.
5. "Next" from a solution screen lands on a playable board.
6. No "-0" rating chip anywhere.
7. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshots saved as
   `review-artifacts/fix-S1-*.png`.
