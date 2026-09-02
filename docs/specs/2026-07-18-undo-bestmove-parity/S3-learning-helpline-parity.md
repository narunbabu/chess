# S3 — Learning helpline pool parity (P1, Android only, depends on S2)

## Problem

Web learning mode has a single **shared helpline pool**: the user picks the
pool size at game start (7 / 5 / 3 / 1), and both undo AND best-move reveals
deduct from it. Android currently hardcodes the learning pool to 5 and only
undo consumes it (best-move doesn't exist until S2).

## Web behavior to replicate

- `LEARNING_HELP_OPTIONS = [7, 5, 3, 1]` — selected in game setup, learning
  mode only.
- `consumeLearningHelp(kind)` (PlayComputer.js 2961-2980): if pool empty,
  block with kind-specific message ("No best-move helplines remaining!" /
  "No learning helplines remaining!") and return false; else decrement and
  show "…helpline used. N helplines remaining."
- Undo button copy in learning mode says "helplines" not "undo chances".
- Best reveal consumes one helpline **per new position** (`bestRevealFen`
  guard — re-showing on the same FEN is free). Undo consumes one per use.
- CCT arrows never consume helplines.
- Usage is recorded for the post-game review report (web:
  `recordPendingLearningHelp(kind)` feeding `createMoveReviewReport`). Android:
  check whether the game-completion payload already carries help-usage fields;
  if the backend accepts `undo_used` / `best_used` style metadata, send it;
  if not, skip — **do not add backend fields in this spec**.

## Tasks

### T1 — Pool size selector

`PlayComputerScreen` setup, learning mode selected → segmented row `7 5 3 1`
(default 5, matching current behavior). Store choice in
`PlayComputerViewModel` as `learningHelpLimit`.

### T2 — Shared consumer

`consumeLearningHelp(kind: HelpKind): Boolean` in `PlayComputerViewModel`:
single source of truth for the pool; called by `undoMove()` and by S2's Best
reveal path. Kind-specific exhaustion messages per web copy above. In casual
mode return true without deduction (casual undo keeps its own
difficulty-based budget 15/9/6/3 — unchanged).

### T3 — Copy parity

- Learning setup description: "Undo and Best share a limited helpline pool.
  CCT stays unlimited. Results affect Learner Elo only." (web
  ChallengeModal.jsx wording).
- Undo button in learning mode: "Undo (N helplines left)".

### T4 — Verification

- Start learning game with pool=1: one Best reveal → pool 0 → undo blocked
  with "No learning helplines remaining!", CCT still free.
- Same-FEN Best re-toggle does not double-charge.
- Casual game unaffected (difficulty budget, "undo chances" copy).
