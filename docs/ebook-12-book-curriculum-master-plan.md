# Chess99 12-Book E-Book Curriculum Master Plan

Date: 2026-05-04
Status: Planning baseline
Related plan: `docs/ebook-authoring-format-and-production-pipeline.md`

## Executive Summary

Chess99 should build 12 serious interactive e-books, not a loose pile of chapters. The books should form a rating ladder from absolute beginner to advanced competitive player. Skill level decides what the learner needs. Subscription tier decides depth, volume, personalization, and advanced tooling.

The old `chapter-01.json` through `chapter-06.json` content should not be expanded. It should be replaced by a structured v2 book library using generated board diagrams, validated move analysis, interactive tests, and reviewer signoff.

## Subscription Library

| Tier | Access |
| --- | --- |
| Free | Full Books 1-2, selected previews from Books 3-4, basic progress, limited checkpoint attempts |
| Silver | Full Books 1-8, unlimited standard checkpoints, club-level training plans, static PDF/EPUB exports |
| Gold | Full Books 1-12, advanced analysis, repertoire/model-game tools, deeper reviewer feedback, premium training plans |

## How Every Book Should Be Read

The books are not passive reading material. Each chapter should be studied in this order:

1. Read the chapter goal.
2. Study the first board diagram before reading the explanation.
3. Guess the move or idea.
4. Play the move on the interactive board.
5. Read the move analysis.
6. Try the common mistake and see the refutation.
7. Solve the checkpoint without hints.
8. Repeat failed checkpoints after spaced review.

The reader should not advance just because they scrolled to the end. Advancement should require checkpoint performance.

## Standard Chapter Design

Every chapter should follow this pattern:

| Section | Purpose |
| --- | --- |
| Learning goal | State the exact skill for this chapter |
| Visual position | Show the idea on a generated board |
| Plain explanation | Explain in learner language |
| Move analysis | Explain candidate moves, best move, and rejected moves |
| Interactive try | User plays or marks the idea |
| Common mistake | Show the natural wrong move and punishment |
| Mini drill | 3-8 positions |
| Summary | What to remember |
| Checkpoint | Required score to unlock next chapter |

Minimum assets per chapter:

- 5 generated board diagrams.
- 1 interactive board.
- 1 mistake/refutation diagram.
- 1 checkpoint.

Tactics, calculation, and endgame chapters should have more: 10-20 diagrams and 6-12 exercises.

## Book 1: The First Chessboard

Rating range: 0-300
Subscription: Free
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/beginner-board-rules/`
Purpose: Turn a non-player into someone who understands the board, pieces, legal moves, and the idea of checkmate.
Who should read: Children, parents, complete beginners, and school onboarding users.
How to read: Very slowly, with every diagram manipulated on the board. No chapter should be skipped.

Main chapters:

1. The board, coordinates, files, ranks, and colors.
2. Piece names, values, and setup.
3. King movement and why the king matters.
4. Rook and bishop movement.
5. Queen movement and long-range power.
6. Knight movement and jumps.
7. Pawn movement, captures, double move, promotion.
8. Check and escaping check.
9. Checkmate vs stalemate.
10. First guided complete game.

Key visuals:

- Empty board with coordinates.
- Legal movement maps for every piece.
- Setup checklist board.
- Check escape diagrams.
- First checkmate diagrams.

Exit test:

- Set up the board.
- Identify legal moves for each piece.
- Escape a simple check.
- Deliver mate in one.

## Book 2: Survival Chess

Rating range: 300-700
Subscription: Free
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/survival-chess/`
Purpose: Stop the first wave of beginner losses: illegal thinking, hanging pieces, missing checks, and stalemating won games.
Who should read: Anyone who knows the rules but loses pieces for free.
How to read: Solve each diagram before revealing the answer. Use the CCT habit from the beginning.

Main chapters:

1. The three questions: checks, captures, threats.
2. What is a hanging piece?
3. One-move attacks and one-move defenses.
4. Safe squares for the king.
5. Capturing wisely: good trades and bad trades.
6. Basic checkmates with queen and rook.
7. Avoiding stalemate.
8. Opening safety: do not move the same piece repeatedly.
9. Blunder-check before every move.
10. Ten survival games: find the safe move.

Key visuals:

- Red danger arrows for checks.
- Blue capture arrows.
- Amber threat arrows.
- Wrong-move refutation boards.
- Before/after trade boards.

Exit test:

- Complete 20 CCT scans.
- Identify 15 hanging pieces.
- Convert queen vs king and rook vs king checkmates.

## Book 3: Beginner Tactics

Rating range: 700-1000
Subscription: Silver, with Free preview
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/beginner-tactics/`
Purpose: Build the first tactical pattern library.
Who should read: Players who can play complete games but miss forks, pins, skewers, and mate threats.
How to read: Treat each chapter as pattern training. Do not read the answer until the move is played.

Main chapters:

1. Forks.
2. Pins.
3. Skewers.
4. Discovered attacks.
5. Back-rank mate.
6. Removing the defender.
7. Deflection.
8. Decoy.
9. Mate in one and mate in two.
10. Mixed beginner tactics test.

Key visuals:

- Pattern diagrams with arrows.
- Captured-piece callouts.
- Animated tactic sequences.
- Mistake/refutation boards.

Exit test:

- 70 percent score across mixed tactics.
- At least 10 first-try solves in a row.

## Book 4: Opening Habits For Real Games

Rating range: 900-1200
Subscription: Silver
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/opening-habits-real-games/`
Purpose: Teach safe development and useful opening principles without forcing memorization.
Who should read: Players who get bad positions in the first 10 moves.
How to read: Study model positions, then play guided opening moves against the trainer.

Main chapters:

1. Control the center.
2. Develop knights and bishops.
3. King safety and castling.
4. Do not bring the queen out too early.
5. Pawn moves that help vs pawn moves that weaken.
6. Openings after 1.e4.
7. Openings after 1.d4.
8. What to do when the opponent plays strange moves.
9. First 10-move plans.
10. Opening checkpoint games.

Key visuals:

- Center-control maps.
- Development arrows.
- Weak-square warnings.
- Good/bad queen move comparisons.

Exit test:

- Play 5 guided openings without violating core principles.
- Explain the purpose of each opening move.

## Book 5: Calculation I - Candidate Moves

Rating range: 1100-1400
Subscription: Silver
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/calculation-candidate-moves/`
Purpose: Replace guessing with a repeatable thinking process.
Who should read: Improving beginners who see tactics sometimes but calculate inconsistently.
How to read: Always write or select candidate moves before moving.

Main chapters:

1. Candidate moves.
2. Forcing moves first.
3. Checks.
4. Captures.
5. Threats.
6. Opponent's best reply.
7. One-move deeper.
8. When to stop calculating.
9. Avoiding hope chess.
10. Calculation checkpoint.

Key visuals:

- Candidate arrows in purple.
- Main-line arrows in green.
- Refutation arrows in red.
- Branching line diagrams.

Exit test:

- Solve positions by selecting candidate moves first.
- Maintain 75 percent accuracy in CCT-to-solution flow.

## Book 6: Club Tactics

Rating range: 1300-1600
Subscription: Silver
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/club-tactics/`
Purpose: Move from isolated motifs to combinations.
Who should read: Club players who know tactical names but miss multi-move sequences.
How to read: Calculate full lines before touching the piece.

Main chapters:

1. Double attacks.
2. Overloaded defenders.
3. Zwischenzug.
4. Attraction and decoy.
5. Clearance.
6. Interference.
7. Sacrifices on f7/f2 and h7/h2.
8. King-in-the-center tactics.
9. Defensive tactics.
10. Mixed club tactics test.

Key visuals:

- Multi-move animated boards.
- Defender relationship highlights.
- Before/after material maps.

Exit test:

- Complete 50 mixed positions.
- Explain the role of each move in 10 combinations.

## Book 7: Positional Chess For Club Players

Rating range: 1500-1800
Subscription: Silver
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/positional-chess-club/`
Purpose: Teach plans, not just tactics.
Who should read: Players who can find tactics but do not know what to do in quiet positions.
How to read: Pause at each diagram and choose a plan before seeing moves.

Main chapters:

1. What is a plan?
2. Pawn structure basics.
3. Weak squares.
4. Open files and rooks.
5. Outposts.
6. Good bishop vs bad bishop.
7. Space advantage.
8. Piece activity.
9. Trading with purpose.
10. Plan selection checkpoint.

Key visuals:

- Target-square overlays.
- Piece-route arrows.
- Good/bad piece comparison boards.
- Pawn-structure diagrams.

Exit test:

- Identify the correct plan in 20 quiet positions.
- Explain why a trade helps or hurts.

## Book 8: Endgame Foundations

Rating range: 1500-1900
Subscription: Silver
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/endgame-foundations/`
Purpose: Teach the endgames needed to convert real advantages.
Who should read: Club players who win material but fail to win games.
How to read: Repeat positions until technique is automatic.

Main chapters:

1. King activity.
2. Opposition.
3. Key squares.
4. King and pawn vs king.
5. Passed pawns and the square rule.
6. Rook activity.
7. Lucena basics.
8. Philidor basics.
9. Minor-piece endings.
10. Conversion checkpoint.

Key visuals:

- Key-square grids.
- Opposition diagrams.
- Rook checking-distance arrows.
- Pawn race boards.

Exit test:

- Convert basic king-pawn positions.
- Hold basic rook defensive positions.
- Choose correct king route in key-square tests.

## Book 9: Advanced Strategy

Rating range: 1800-2100
Subscription: Gold
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/advanced-strategy/`
Purpose: Teach strategic imbalance evaluation and long-term decision-making.
Who should read: Strong club players preparing for serious competition.
How to read: Use the plan-before-move method. Do not solve by move guessing.

Main chapters:

1. Imbalances.
2. Static vs dynamic advantages.
3. Prophylaxis.
4. Pawn majorities.
5. Minority attack.
6. Isolated queen's pawn positions.
7. Hanging pawns.
8. Exchange sacrifices.
9. Strategic defense.
10. Model-game strategy test.

Key visuals:

- Strategic maps.
- Pawn-break arrows.
- Long-term target highlights.
- Model-game snapshots.

Exit test:

- Annotate 3 model positions.
- Choose plans and justify them against alternatives.

## Book 10: Calculation II - Depth and Quiet Moves

Rating range: 1900-2200
Subscription: Gold
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/calculation-depth-quiet-moves/`
Purpose: Build serious calculation depth and recognition of non-obvious winning moves.
Who should read: Advanced players who calculate forcing moves but miss quiet resources.
How to read: Calculate on a blank board mode when prompted, then verify.

Main chapters:

1. Candidate trees.
2. Defensive resources.
3. Quiet moves.
4. Zwischenzug at depth.
5. Sacrifice evaluation.
6. Perpetual check awareness.
7. Mating nets.
8. Endgame tactics.
9. Time-pressure calculation.
10. Advanced calculation exam.

Key visuals:

- Calculation trees.
- Hidden resource diagrams.
- Quiet move before/after diagrams.
- Blindfold/hidden-piece exercises.

Exit test:

- Solve multi-move positions with written candidate lines.
- Maintain accuracy under timed sections.

## Book 11: Repertoire And Model Games

Rating range: 2000-2300
Subscription: Gold
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/repertoire-model-games/`
Purpose: Connect opening choices to middlegame plans and model games.
Who should read: Competitive players who need structured preparation.
How to read: Study model games by plans, not just move order.

Main chapters:

1. Building a repertoire.
2. Choosing openings by style.
3. Model games as memory anchors.
4. Typical pawn breaks.
5. Typical piece placements.
6. Anti-sidelines.
7. Transition to middlegame.
8. Opening mistakes and punishments.
9. Repertoire review drills.
10. Build your first Chess99 repertoire file.

Key visuals:

- Opening tabiya boards.
- Plan arrows.
- Model-game branching diagrams.
- Repertoire flashcards.

Exit test:

- Build and pass a small repertoire drill.
- Explain plans in 5 tabiya positions.

## Book 12: Tournament Mastery And Self-Coaching

Rating range: 2100+
Subscription: Gold
Production status: v2 complete draft created under `chess-frontend/src/data/ebooks/v2/tournament-mastery-self-coaching/`
Purpose: Turn advanced knowledge into repeatable performance.
Who should read: Tournament players, coaches, school-team leaders, and ambitious advanced users.
How to read: Use it alongside real games and post-game review.

Main chapters:

1. Pre-game preparation.
2. Opponent-style preparation.
3. Time management.
4. Decision journals.
5. Post-game annotation.
6. Blunder taxonomy.
7. Opening repair.
8. Endgame repair.
9. Tournament routines.
10. Personal training plan.

Key visuals:

- Annotation boards.
- Mistake classification diagrams.
- Clock/time-pressure positions.
- Training dashboard examples.

Exit test:

- Annotate 3 personal games.
- Produce a 30-day training plan from weaknesses.

## Cross-Book Training Ladder

| ELO Transition | Required Competence |
| --- | --- |
| 0 to 300 | Legal play and board confidence |
| 300 to 700 | Basic survival, checks, captures, threats |
| 700 to 1000 | Tactical pattern recognition |
| 1000 to 1200 | Safe openings and simple plans |
| 1200 to 1400 | Candidate move discipline |
| 1400 to 1600 | Multi-move tactics |
| 1600 to 1800 | Quiet-position planning |
| 1800 to 2000 | Endgame conversion |
| 2000 to 2200 | Advanced strategy and prophylaxis |
| 2200 to 2400 | Deep calculation and repertoire |
| 2400+ | Tournament self-coaching |

## Required Resource Mapping

| Resource | Use In Books |
| --- | --- |
| `EbookBoard.jsx` | All board diagrams and animations |
| `EbookPuzzle.jsx` | Beginner and club checkpoints |
| `TacticalPuzzleBoard.js` | Books 3, 5, 6, 10 |
| `computeCCT.js` | Books 2, 3, 5, 6, 10 |
| `stage1_puzzles.json` | Books 3 and 5 |
| `stage2_puzzles.json` | Books 5 and 6 |
| `stage3_puzzles.json` | Books 7, 9, 10 |
| `stage4_puzzles.json` | Books 10 and 12 |
| `database/videogen/*.json` | Draft source for tactical explanations |
| Subscription gates | Free/Silver/Gold access |
| Game analysis tables | Gold self-coaching and review flow |

## Release Order

Do not build all 12 at once. Build in this order:

1. Book 1 and Book 2 as the new Free trust-builder.
2. Book 3 as the first Silver conversion book.
3. Book 5 because CCT/calculation reuses existing tactical infrastructure.
4. Book 8 because endgames are high-value and evergreen.
5. Books 4, 6, and 7 to complete Silver.
6. Books 9-12 to complete Gold.

## Quality Bar

Every book must have:

- A manifest.
- 8-10 chapters.
- 60-150 authoritative board diagrams.
- 30-100 exercises depending on level.
- Generated cover art.
- Generated board PNG pack.
- Static export path.
- Interactive web version.
- Reviewer signoff.

Gold books must additionally have:

- Model-game annotations.
- Alternative-line analysis.
- Advanced checkpoints.
- Personal-game or repertoire integration where relevant.

## Next Implementation Step

Create a v2 pilot package for Book 1 with one chapter only:

`beginner-board-rules/chapters/01-board-coordinates.json`

That pilot should prove:

- Structured schema.
- Deterministic board PNG generation.
- Web rendering.
- PDF/EPUB static export feasibility.
- Text-to-image consistency review.
- Subscription metadata.

Once the pilot passes, scale the same template across the 12-book library.
