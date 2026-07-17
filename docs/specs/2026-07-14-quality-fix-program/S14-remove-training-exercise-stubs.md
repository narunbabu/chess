# S14 — Remove the Training-Exercise stubs (P1, Android, 0.5 d)

**Added 2026-07-15.** The gap analysis asked "stub or real?" for the Learn
tab's "Endgame Drills" and "Opening Explorer" cards. Investigation answered:
**both are stubs that pretend to work** — worse than broken, they mis-teach.

## Facts (verified 2026-07-15)

- Cards: `presentation/learn/LearnScreen.kt` — "Endgame Drills" :542-549,
  "Opening Explorer" :550-557; both →
  `onNavigateToTrainingExercise("endgame"|"opening")` →
  `Screen.TrainingExercise` (`Screen.kt:42-44`, `NavGraph.kt:191-193,
  217-226`) → `TrainingExerciseScreen.kt` + `TrainingExerciseViewModel.kt`.
- The VM (`TrainingExerciseViewModel.kt:41-73`) calls
  `tutorialApi.createPracticeGame()` with only `{"exercise_id": ...}`, but the
  backend (`TutorialController.php:795-816`) requires
  `ai_difficulty in easy|medium|hard|expert` → **every request 422s**. The VM
  swallows the failure (:65-67) and shows defaults: generic title, empty
  instruction, a starting-position board, `totalSteps = 1`.
- `onMove` (:75-91) then marks **any legal move "Good move!"** and finishes
  after one move. A child "completes" a drill that taught nothing. Even a
  successful API call wouldn't help — the endpoint returns a DB row, not
  exercise content. Nothing endgame- or opening-specific exists anywhere.

## Decision

**Remove for v1** (precedent: S4's E-Book removal — honest absence beats a
fake feature, especially one that praises random moves to children). Building
real drills is a content project, not a bug fix — parked in the post-v1
backlog (master plan).

## Tasks

### T1 — Remove the two cards

Delete the "Endgame Drills" and "Opening Explorer" cards from
`LearnScreen.kt` (:542-557). The Training tab keeps "Tactics Trainer"
(:534-541), which is real. If the tab looks bare with one card, promote the
Tactics Trainer card to full width — no new features.

### T2 — Dead-code cleanup

Remove the now-unreachable `onNavigateToTrainingExercise` callback plumbing,
the `NavGraph.kt:191-193` lambda and :217-226 composable registration, and
`Screen.TrainingExercise`. Delete `TrainingExerciseScreen.kt` /
`TrainingExerciseViewModel.kt` (git history preserves them; a commented-out
route à la `Screen.Ebook` (`Screen.kt:84-87`) is acceptable if the team
prefers a breadcrumb).

### T3 — Verify no other entry points

Grep for `TrainingExercise` and `training/` route usages (deep links included —
check `DeepLinkHandler.kt`) to confirm nothing else navigates there.

## Acceptance criteria (RELEASE build, prod)

1. Learn → Training shows only real, working entries; no "Endgame Drills" /
   "Opening Explorer".
2. Tactics Trainer still opens and works.
3. Grep for `TrainingExercise` in `presentation/` returns nothing (or only the
   commented breadcrumb).
4. `gradlew.bat compileReleaseKotlin lintRelease` green; screenshot
   `review-artifacts/fix-S14-learn-tab.png`.
