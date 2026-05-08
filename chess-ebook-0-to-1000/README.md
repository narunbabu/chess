# Chess E-Book: 0 to 1000 ELO

A complete chess learning curriculum for absolute beginners to reach 1000 ELO rating.

## Philosophy

This book teaches chess using the **CCT Framework** (Checks, Captures, Threats) — the same systematic thinking method used in the Chess99 Tactical Progression Trainer. Instead of memorizing moves, you learn *how to think* at the board.

## Structure

| Chapter | Title | ELO Range | Focus |
|---------|-------|-----------|-------|
| 1 | The Board and Pieces | 0-200 | Rules, piece movement, basic checkmate |
| 2 | Basic Principles | 200-400 | Opening principles, piece coordination, simple tactics |
| 3 | Tactical Foundations | 400-600 | The CCT system — Checks, Captures, Threats |
| 4 | Opening Basics | 600-800 | Sound development, avoiding traps, first 10 moves |
| 5 | Endgame Essentials | 800-1000 | King activity, pawn promotion, basic endgames |
| 6 | Practical Play | All | Avoiding blunders, time management, game review |

Each chapter includes:
- Core concepts with visual diagrams
- Interactive exercises
- Common mistakes and how to avoid them
- Progress checkpoints

## Building the E-Book

To compile the full e-book:
```bash
cat chapters/*.md > ebook.md
```

For PDF output (requires pandoc):
```bash
pandoc ebook.md -o chess-0-to-1000.pdf --pdf-engine=xelatex
```

For EPUB output:
```bash
pandoc ebook.md -o chess-0-to-1000.epub
```

## Credits

Built on the pedagogical framework from the [Chess99](https://chess99.com) platform's Tactical Progression Trainer and CCT Analysis engine.
