# Review Pack: King And Pawn Vs King

Book: Endgame Foundations
Chapter: 04-king-and-pawn-vs-king
Source: ../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/chapters/04-king-and-pawn-vs-king.json
Generated: 2026-05-05T07:36:03.834Z
Status: PASS - deterministic checks clean

## Chapter Intent

ELO range: 1500-1900
Required tier: silver
Estimated minutes: 28

Learning objectives:
- Recognize the visual signal for king and pawn vs king.
- Choose a move or plan that fits king and pawn vs king.
- Avoid the common beginner error connected with king and pawn vs king.
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

### b08-c04-p01 - prose

Section: Goal And Pattern
Type: prose

Text under review:

```text
King And Pawn Vs King is not a memory trick. It is a way to organize the position. First name the signal, then compare candidate moves, then choose the move that improves your position without creating a new weakness.
```

Reviewer flags: none from deterministic checks.

### b08-c04-d01 - Training Diagram: main pattern

Section: Goal And Pattern
Type: board_diagram
FEN: `4k3/8/8/8/8/8/4K3/8 w - - 0 1`
Orientation: white
Arrows: e2-e3 (best)
Highlights: e2 (candidate), e3 (best), e4 (target)
Assertions: piece_on white_king e2, highlight_exists e3, arrow_exists e2-e3
Text square claims: none
Text move claims: none
Visual square evidence: e8, e2, e3, e4

![b08-c04-d01](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-d01-quiet-king.png)

PNG hash: `ce2add3d0ab22977e9d511845aa867997857060430dd19ac47b00ed2c248b9ab`

Text under review:

```text
Training Diagram: main pattern
Not every best move is a capture; sometimes the quiet improving move is the point. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b08-c04-d02 - Training Diagram: candidate move

Section: Goal And Pattern
Type: board_diagram
FEN: `8/1r1k4/8/8/8/1N6/8/4K3 w - - 0 1`
Orientation: white
Arrows: b3-c5 (best), c5-d7 (check), c5-b7 (capture)
Highlights: b3 (candidate), c5 (best), d7 (check), b7 (capture)
Assertions: piece_on white_knight b3, highlight_exists c5, arrow_exists b3-c5
Text square claims: none
Text move claims: none
Visual square evidence: b7, d7, b3, e1, c5

![b08-c04-d02](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-d02-knight-fork.png)

PNG hash: `037958d91d2faf2faa3a36842ed3976e394627c7a7de0458643c3d9d73bfb777`

Text under review:

```text
Training Diagram: candidate move
The best square creates two problems at once: king danger and material pressure. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b08-c04-p02 - prose

Section: Analysis And Decision
Type: prose

Text under review:

```text
Use the diagram as a thinking board. Ask what is forcing, what is loose, and what changes after the move. Strong players do not only see a move; they see the reason the move works.
```

Reviewer flags: none from deterministic checks.

### b08-c04-d03 - Training Diagram: comparison position

Section: Analysis And Decision
Type: board_diagram
FEN: `4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1`
Orientation: white
Arrows: e1-e7 (capture), e7-e8 (check)
Highlights: e1 (candidate), e7 (capture), e8 (check)
Assertions: piece_on white_rook e1, highlight_exists e7, arrow_exists e1-e7
Text square claims: none
Text move claims: none
Visual square evidence: e8, e7, e1, g1

![b08-c04-d03](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-d03-pin-file.png)

PNG hash: `b541b43709ee57aaac40dbabc37a3f68b2aab49c80784568f3a02bd76877519c`

Text under review:

```text
Training Diagram: comparison position
The target cannot move freely because the king behind it matters. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b08-c04-d04 - Training Diagram: best practical choice

Section: Analysis And Decision
Type: board_diagram
FEN: `6k1/5ppp/8/8/8/8/8/2R3K1 w - - 0 1`
Orientation: white
Arrows: c1-c8 (best), c8-g8 (check)
Highlights: c1 (candidate), c8 (best), g8 (check)
Assertions: piece_on white_rook c1, highlight_exists c8, arrow_exists c1-c8
Text square claims: none
Text move claims: none
Visual square evidence: g8, f7, g7, h7, c1, g1, c8

![b08-c04-d04](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-d04-back-rank.png)

PNG hash: `e70871e69145e8c4af273344c446a777d1d89452c20750c7bace1361932ce4f7`

Text under review:

```text
Training Diagram: best practical choice
A rook reaches the back rank when the escape squares are boxed in. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b08-c04-d05 - Training Diagram: review position

Section: Analysis And Decision
Type: board_diagram
FEN: `4k3/5r2/8/8/2B5/8/8/4K3 w - - 0 1`
Orientation: white
Arrows: c4-f7 (capture)
Highlights: c4 (candidate), f7 (capture), e8 (target)
Assertions: piece_on white_bishop c4, highlight_exists f7, arrow_exists c4-f7
Text square claims: none
Text move claims: none
Visual square evidence: e8, f7, c4, e1

![b08-c04-d05](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-d05-bishop-wins-rook.png)

PNG hash: `8569b4e4fc02e0edcdc258f56ea0c9f1b0b8ae1debd137d3430b4156d82f94c2`

Text under review:

```text
Training Diagram: review position
The line to the target is clear, so the capture wins higher-value material. Study the highlighted relationship before reading the move.
```

Reviewer flags: none from deterministic checks.

### b08-c04-g01 - Try It: Find The Training Move

Section: Analysis And Decision
Type: guided_move
FEN: `4k3/8/8/8/8/8/4K3/8 w - - 0 1`
Orientation: white
Arrows: e2-e3 (best)
Highlights: e2 (candidate), e3 (best), e4 (target)
Assertions: legal_move e2e3, piece_on white_king e2, highlight_exists e3, arrow_exists e2-e3
Text square claims: e2, e3
Text move claims: none
Visual square evidence: e8, e2, e3, e4

![b08-c04-g01](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-g01-quiet-king.png)

PNG hash: `ce2add3d0ab22977e9d511845aa867997857060430dd19ac47b00ed2c248b9ab`

Text under review:

```text
Try It: Find The Training Move
The guided move turns the diagram idea into a playable habit.
Play the highlighted move from **e2** to **e3**. Do it only after saying the idea in words.
Correct. The move matches the chapter idea.
Pause, compare the arrows, and try the chapter idea again.
```

Reviewer flags: none from deterministic checks.

### b08-c04-m01 - Common Mistake: Missing The Diagram Signal

Section: Analysis And Decision
Type: mistake_refutation
FEN: `4k3/8/8/8/8/8/4K3/8 w - - 0 1`
Orientation: white
Arrows: e2-e3 (best), e2-e3 (best)
Highlights: e2 (candidate), e3 (best), e4 (target), e2 (wrong)
Assertions: piece_on white_king e2, highlight_exists e3, arrow_exists e2-e3
Text square claims: none
Text move claims: none
Visual square evidence: e8, e2, e3, e4

![b08-c04-m01](../../../chess-frontend/src/data/ebooks/v2/endgame-foundations/assets/diagrams/b08-c04-m01-quiet-king.png)

PNG hash: `43b3107757bc8851aad76f5afb0c943df1262f5886346ace388661a1d476942b`

Text under review:

```text
Common Mistake: Missing The Diagram Signal
The common mistake is to move by habit and miss the chapter signal. The diagram marks the useful move and the important target so the error is visible before it happens.
The marked relationship is the reason the natural careless move fails.
```

Reviewer flags: none from deterministic checks.

### b08-c04-q01 - King And Pawn Vs King Check 1

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
King And Pawn Vs King Check 1
What should you do first in a position about **king and pawn vs king**?
```

Quiz options:
- [correct] a: Name the key signal before choosing a move.
- [wrong] b: Move instantly because the first idea is usually enough.
- [wrong] c: Ignore the diagram and choose by piece value only.

Reviewer flags: none from deterministic checks.

### b08-c04-q02 - King And Pawn Vs King Check 2

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
King And Pawn Vs King Check 2
Which answer best matches the chapter habit for **king and pawn vs king**?
```

Quiz options:
- [correct] a: Compare candidate moves and reject the unsafe one.
- [wrong] b: Move instantly because the first idea is usually enough.
- [wrong] c: Ignore the diagram and choose by piece value only.

Reviewer flags: none from deterministic checks.

### b08-c04-q03 - King And Pawn Vs King Check 3

Section: Chapter Checkpoint
Type: quiz

Text under review:

```text
King And Pawn Vs King Check 3
What is the biggest danger if you ignore **king and pawn vs king**?
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
