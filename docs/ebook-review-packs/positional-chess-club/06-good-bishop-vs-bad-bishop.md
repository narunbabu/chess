# Review Pack: Good Bishop Vs Bad Bishop

Book: Positional Chess For Club Players
Chapter: 06-good-bishop-vs-bad-bishop
Source: ../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/chapters/06-good-bishop-vs-bad-bishop.json
Generated: 2026-05-05T07:36:03.924Z
Status: PASS - deterministic checks clean

## Chapter Intent

ELO range: 1500-1800
Required tier: silver
Estimated minutes: 28

Learning objectives:
- Recognize the visual signal for good bishop vs bad bishop.
- Choose a move or plan that fits good bishop vs bad bishop.
- Avoid the common beginner error connected with good bishop vs bad bishop.
- Pass a checkpoint without relying on guesswork.

## Quality Gates

| Gate | Result | Detail |
| --- | --- | --- |
| Sections | PASS | 2 |
| Total blocks | PASS | 12 |
| Board-like blocks | PASS | 7 |
| Generated PNG exports | PASS | 7 |
| Interactive/check blocks | PASS | 4 |
| Deterministic warnings | PASS | 0 |
| minimum_board_diagrams >= 5 | PASS | 5 board_diagram block(s) |
| minimum_guided_moves >= 1 | PASS | 1 guided_move block(s) |
| minimum_quizzes >= 3 | PASS | 3 quiz block(s) |
| tier_allowed <= silver | PASS | chapter tier is silver |

## Block Review

### b07-c06-p01 - prose

Section: Goal And Pattern
Type: prose

Text under review:

```text
Good Bishop Vs Bad Bishop is not a memory trick. It is a way to organize the position. First name the signal, then compare candidate moves, then choose the move that improves your position without creating a new weakness.
```

Reviewer flags: none from deterministic checks.

### b07-c06-d01 - Training Diagram: main pattern

Section: Goal And Pattern
Type: board_diagram
FEN: `4k3/8/8/8/3q4/5N2/8/4K3 w - - 0 1`
Orientation: white
Arrows: f3-d4 (capture)
Highlights: f3 (candidate), d4 (capture), e6 (target)
Assertions: piece_on white_knight f3, highlight_exists d4, arrow_exists f3-d4
Text square claims: none
Text move claims: none
Visual square evidence: e8, d4, f3, e1, e6

![b07-c06-d01](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-d01-queen-target.png)

PNG hash: `aea6b7c053c73e4c85be700613d794ab0953babb82989dce6362a1defd6ec009`

Text under review:

```text
Training Diagram: main pattern
A high-value target changes the whole position when it is undefended. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b07-c06-d02 - Training Diagram: candidate move

Section: Goal And Pattern
Type: board_diagram
FEN: `r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 2 3`
Orientation: white
Arrows: e1-g1 (best)
Highlights: e1 (candidate), g1 (best), f1 (safe)
Assertions: piece_on white_king e1, highlight_exists g1, arrow_exists e1-g1
Text square claims: none
Text move claims: none
Visual square evidence: a8, c8, d8, e8, f8, g8, h8, a7, b7, c7, d7, f7, g7, h7, c6, e5, c4, e4, f3, a2, b2, c2, d2, f2, g2, h2, a1, b1, c1, d1, e1, h1, g1, f1

![b07-c06-d02](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-d02-castle-safety.png)

PNG hash: `bd737dec6642befd1202e51c1319afdd38d26a2aa4c3c58aef29f163e40cb593`

Text under review:

```text
Training Diagram: candidate move
King safety often beats a tempting pawn grab or one-move threat. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b07-c06-p02 - prose

Section: Analysis And Decision
Type: prose

Text under review:

```text
Use the diagram as a thinking board. Ask what is forcing, what is loose, and what changes after the move. Strong players do not only see a move; they see the reason the move works.
```

Reviewer flags: none from deterministic checks.

### b07-c06-d03 - Training Diagram: comparison position

Section: Analysis And Decision
Type: board_diagram
FEN: `rnbqkbnr/pppp1ppp/8/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 1 3`
Orientation: white
Arrows: c4-f7 (check)
Highlights: c4 (candidate), f7 (check), e8 (check)
Assertions: piece_on white_bishop c4, highlight_exists f7, arrow_exists c4-f7
Text square claims: none
Text move claims: none
Visual square evidence: a8, b8, c8, d8, e8, f8, g8, h8, a7, b7, c7, d7, f7, g7, h7, e5, c4, e4, f3, a2, b2, c2, d2, f2, g2, h2, a1, b1, c1, d1, e1, h1

![b07-c06-d03](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-d03-cct-check.png)

PNG hash: `39a15b2b6ae9d397dce46428e4bbd20629c2f84f94dbfb5de3cf7a471d9e81ef`

Text under review:

```text
Training Diagram: comparison position
Checks are forcing moves and should be examined before quieter ideas. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b07-c06-d04 - Training Diagram: best practical choice

Section: Analysis And Decision
Type: board_diagram
FEN: `4k3/8/8/8/8/8/8/R3K3 w Q - 0 1`
Orientation: white
Arrows: a1-a8 (best), a8-e8 (check)
Highlights: a1 (candidate), a8 (best), e8 (check)
Assertions: piece_on white_rook a1, highlight_exists a8, arrow_exists a1-a8
Text square claims: none
Text move claims: none
Visual square evidence: e8, a1, e1, a8

![b07-c06-d04](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-d04-rook-activity.png)

PNG hash: `031f45e0008946de9642cfb6f9a496809731dac1dc716cb071b2a2fcb3cbce0a`

Text under review:

```text
Training Diagram: best practical choice
Open files are highways for rooks, especially when a king or target is exposed. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b07-c06-d05 - Training Diagram: review position

Section: Analysis And Decision
Type: board_diagram
FEN: `4k3/8/8/8/8/8/4P3/4K3 w - - 0 1`
Orientation: white
Arrows: e2-e4 (best)
Highlights: e2 (candidate), e4 (best), e5 (target)
Assertions: piece_on white_pawn e2, highlight_exists e4, arrow_exists e2-e4
Text square claims: none
Text move claims: none
Visual square evidence: e8, e2, e1, e4, e5

![b07-c06-d05](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-d05-king-pawn.png)

PNG hash: `ae5f0d1f381e60100ace69a06e95f3a98c5e4418bef6b7d757d82e9daaaa016c`

Text under review:

```text
Training Diagram: review position
In pawn endings, one tempo can decide whether the pawn advances or stalls. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b07-c06-g01 - Try It: Find The Training Move

Section: Analysis And Decision
Type: guided_move
FEN: `4k3/8/8/8/3q4/5N2/8/4K3 w - - 0 1`
Orientation: white
Arrows: f3-d4 (capture)
Highlights: f3 (candidate), d4 (capture), e6 (target)
Assertions: legal_move f3d4, piece_on white_knight f3, highlight_exists d4, arrow_exists f3-d4
Text square claims: f3, d4
Text move claims: none
Visual square evidence: e8, d4, f3, e1, e6

![b07-c06-g01](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-g01-queen-target.png)

PNG hash: `aea6b7c053c73e4c85be700613d794ab0953babb82989dce6362a1defd6ec009`

Text under review:

```text
Try It: Find The Training Move
The guided move turns the diagram idea into a playable habit.
Play the highlighted move from **f3** to **d4**. Do it only after saying the idea in words.
Correct. The move matches the chapter idea.
Pause, compare the arrows, and try the chapter idea again.
```

Reviewer flags: none from deterministic checks.

### b07-c06-m01 - Common Mistake: Missing The Diagram Signal

Section: Analysis And Decision
Type: mistake_refutation
FEN: `4k3/8/8/8/3q4/5N2/8/4K3 w - - 0 1`
Orientation: white
Arrows: f3-d4 (capture), f3-d4 (best)
Highlights: f3 (candidate), d4 (capture), e6 (target), f3 (wrong)
Assertions: piece_on white_knight f3, highlight_exists d4, arrow_exists f3-d4
Text square claims: none
Text move claims: none
Visual square evidence: e8, d4, f3, e1, e6

![b07-c06-m01](../../../chess-frontend/src/data/ebooks/v2/positional-chess-club/assets/diagrams/b07-c06-m01-queen-target.png)

PNG hash: `2a2252dff2f5842d4fa919dd8d55624d106ad4ed60e29516928cfa67ce377daa`

Text under review:

```text
Common Mistake: Missing The Diagram Signal
The common mistake is to move by habit and miss the chapter signal. The diagram marks the useful move and the important target so the error is visible before it happens.
The marked relationship is the reason the natural careless move fails.
```

Reviewer flags: none from deterministic checks.

### b07-c06-q01 - Good Bishop Vs Bad Bishop Check 1

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
Good Bishop Vs Bad Bishop Check 1
What should you do first in a position about **good bishop vs bad bishop**?
```

Quiz options:
- [correct] a: Name the key signal before choosing a move.
- [wrong] b: Move instantly because the first idea is usually enough.
- [wrong] c: Ignore the diagram and choose by piece value only.

Reviewer flags: none from deterministic checks.

### b07-c06-q02 - Good Bishop Vs Bad Bishop Check 2

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
Good Bishop Vs Bad Bishop Check 2
Which answer best matches the chapter habit for **good bishop vs bad bishop**?
```

Quiz options:
- [correct] a: Compare candidate moves and reject the unsafe one.
- [wrong] b: Move instantly because the first idea is usually enough.
- [wrong] c: Ignore the diagram and choose by piece value only.

Reviewer flags: none from deterministic checks.

### b07-c06-q03 - Good Bishop Vs Bad Bishop Check 3

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
Good Bishop Vs Bad Bishop Check 3
What is the biggest danger if you ignore **good bishop vs bad bishop**?
```

Quiz options:
- [correct] a: You may miss a tactic, plan, or defensive resource.
- [wrong] b: Move instantly because the first idea is usually enough.
- [wrong] c: Ignore the diagram and choose by piece value only.

Reviewer flags: none from deterministic checks.

## Human Signoff

- Chess analyst: pending
- Visual reviewer: pending
- Pedagogy reviewer: pending
- Final editor: pending
