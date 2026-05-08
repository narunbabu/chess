# Chess99 E-Book Authoring, Asset Generation, and Review Pipeline

Date: 2026-05-04
Status: Planning baseline
Owner: Chess99 learning/content system

## Executive Decision

The current `chess-frontend/src/data/ebook/chapter-01.json` through `chapter-06.json` should be treated as disposable prototype content. They prove that the app can display an ebook, but they are not the source model for a serious Chess99 learning library.

Markdown alone is not the right canonical format for this job. Markdown is useful for prose fragments, but it cannot reliably represent chess positions, arrows, legal move sequences, generated board PNGs, reviewer checks, subscription gates, or interactive tests.

The recommended source format is a structured "Chess99 Book Package":

- `manifest.json` for book-level metadata.
- `chapter.json` files for typed content blocks.
- Markdown strings only inside prose fields such as `body_md`.
- Typed blocks for boards, animations, exercises, puzzles, images, and review assertions.
- Generated PNG/SVG/video assets derived from the typed blocks, never manually pasted into source as the authority.

This keeps authoring flexible while making the chess content machine-checkable.

## Why Plain Markdown Is Not Enough

Plain Markdown is good for:

- Headings, paragraphs, lists, tables, emphasis.
- Drafting human-readable explanation.
- Lightweight handoff notes.

Plain Markdown is weak for Chess99 ebooks because it cannot enforce:

- Valid FEN.
- Legal UCI/SAN move sequences.
- Correct side to move.
- Correct relationship between arrows/highlights and written text.
- Diagram asset regeneration.
- Subscription access by block or chapter.
- Interactive challenge behavior.
- Translation between web, PDF, EPUB, and app-native experiences.

MDX is better than Markdown for interactive web content because it can embed React components, and the MDX documentation describes it as Markdown combined with JSX components. That makes it attractive for a web-only authoring layer. For Chess99, however, raw MDX should not become the canonical truth because JSX typos can break rendering and because chess validation is easier when diagrams are typed data.

## Recommended Canonical Format

Use JSON as the canonical content graph. Use Markdown only inside safe prose fields.

Example chapter block:

```json
{
  "id": "b02-c03-d04",
  "type": "board_diagram",
  "title": "The pinned knight cannot defend e5",
  "fen": "r1bqk2r/pppp1ppp/2n2n2/4p3/2B1P3/2NP1N2/PPPP1PPP/R1BQK2R w KQkq - 4 4",
  "orientation": "white",
  "arrows": [
    { "from": "c4", "to": "f7", "colorRole": "check" },
    { "from": "f3", "to": "g5", "colorRole": "candidate" }
  ],
  "highlights": [
    { "square": "f7", "colorRole": "target" }
  ],
  "caption_md": "White notices the weak f7 square before calculating the sacrifice.",
  "assertions": [
    { "type": "side_to_move", "value": "white" },
    { "type": "piece_on", "square": "c4", "piece": "white_bishop" },
    { "type": "attacks", "from": "c4", "to": "f7" }
  ],
  "exports": {
    "png": "assets/diagrams/b02-c03-d04.png",
    "hash": "sha256-to-be-filled-by-generator"
  }
}
```

## Book Package Layout

Recommended future folder:

```text
chess-frontend/src/data/ebooks/v2/
  beginner-board-rules/
    manifest.json
    chapters/
      01-board-coordinates.json
      02-piece-movement.json
    assets/
      diagrams/
      illustrations/
      covers/
```

Each `manifest.json` should include:

- `bookId`
- `title`
- `subtitle`
- `eloStart`
- `eloEnd`
- `requiredTier`
- `purpose`
- `audience`
- `howToRead`
- `prerequisites`
- `outcomes`
- `chapterOrder`
- `assessment`
- `assetPolicy`

Each chapter should include:

- `chapterId`
- `title`
- `learningObjectives`
- `estimatedMinutes`
- `requiredTier`
- `blocks`
- `checkpoint`
- `reviewAssertions`

## Content Block Types

Use a small typed vocabulary.

| Block Type | Purpose | Rendered As |
| --- | --- | --- |
| `prose` | Explanation, stories, principles | Rich text from `body_md` |
| `board_diagram` | Static chess position | React board plus generated PNG |
| `board_animation` | Move sequence | Interactive playback plus GIF/video export |
| `guided_move` | User plays one move | Chessboard with validation and feedback |
| `puzzle` | Solve position | Tactical puzzle player |
| `cct_scan` | Find checks, captures, threats | CCT trainer UI |
| `mistake_refutation` | Show why a common move fails | Board sequence plus explanation |
| `model_game` | Annotated game segment | Move list, board, branching notes |
| `image` | Non-authoritative visual illustration | Generated or curated image |
| `quiz` | Concept check | Multiple choice or short answer |
| `checkpoint` | Gate progress | Mixed test |

## Image and Diagram Policy

There are two different visual categories. They must not be mixed.

### Authoritative Chess Diagrams

These must be generated deterministically from structured data:

- Board coordinates.
- FEN.
- Side to move.
- Orientation.
- Piece set.
- Square highlights.
- Arrows.
- Captured-piece callouts.
- Move sequence.

Use existing Chess99 resources:

- `react-chessboard`
- `chess.js`
- `EbookBoard.jsx`
- `TacticalPuzzleBoard.js`
- `computeCCT.js`
- `html2canvas`
- Playwright screenshots

Never use a generative image model to draw an exact chess position. Image models can produce beautiful visuals, but exact piece count and square placement must come from a chess renderer.

### Explanatory Generated Images

Use image generation for non-authoritative visuals:

- Book covers.
- Chapter openers.
- Concept illustrations, such as "a king under pressure" or "a planning map".
- Backgrounds for premium lesson cards.
- Character or coach visuals.

Use the OpenAI Image API or Responses API image-generation tool for repeatable production work rather than relying on a human manually using ChatGPT Pro. ChatGPT Pro can help with early art direction, but the production pipeline should be API-driven so prompts, seeds/options where available, output size, asset IDs, and approvals can be tracked.

## Visual Language

Use the same color roles across all books.

| Color Role | Hex / RGBA | Meaning |
| --- | --- | --- |
| `best` | `#81b64c` | Best move, correct idea |
| `candidate` | `#7b61a6` | Candidate move |
| `check` | `#ef4444` | Check, king danger |
| `capture` | `#5b8dd9` | Capture |
| `threat` | `#c9882a` | Threat |
| `target` | `#f59e0b` | Weak square or target |
| `lastMove` | `rgba(255,221,0,0.35)` | Last move |
| `wrong` | `rgba(220,60,60,0.35)` | Wrong move |
| `safe` | `rgba(129,182,76,0.25)` | Safe square |

Default board style for instruction:

- Light square: `#eeeed2`
- Dark square: `#769656`
- Use high contrast arrows.
- Avoid decorative board themes in official diagrams.

## Production Tools

### Already Available In Chess99

| Tool / File | Use |
| --- | --- |
| `react-chessboard` | Board rendering with arrows and square styles |
| `chess.js` | FEN parsing, move legality, SAN/UCI conversion |
| `html2canvas` | Existing browser DOM capture path |
| Playwright | Deterministic screenshots and visual regression checks |
| `gif.js` | Animation export support |
| `chess-frontend/src/components/ebook/EbookBoard.jsx` | Existing ebook board renderer |
| `chess-frontend/src/components/ebook/EbookPuzzle.jsx` | Existing ebook puzzle interaction |
| `chess-frontend/src/components/tactical/TacticalPuzzleBoard.js` | CCT-first tactical training |
| `chess-frontend/src/utils/computeCCT.js` | Checks, captures, threats computation |
| `chess-frontend/src/data/stage*_puzzles.json` | Puzzle bank by level |
| `chess-backend/database/videogen/*.json` | Existing tactical script fragments |
| `chess-backend/vendor/chesslablab/php-chess/img/pieces/` | SVG/PNG piece assets |

### Recommended Additions

| Tool | Why |
| --- | --- |
| JSON Schema validator | Reject malformed content before rendering |
| Diagram generator CLI | Generate PNGs from FEN/arrows/highlights |
| Asset manifest builder | Track file paths, hashes, sizes, and source block IDs |
| Chess assertion checker | Verify claims like side to move, legal move, mate, capture |
| Vision/text reviewer | Compare rendered diagram against caption and assertions |
| EPUB/PDF export path | Publish static versions from the same source |

## Reviewer Pipeline

Every chapter must pass these gates before it becomes publishable.

### 1. Schema Review

Checks:

- Required metadata exists.
- Block types are known.
- Subscription tier values are valid: `free`, `silver`, `gold`.
- Color roles are from the approved palette.
- Asset paths are valid and deterministic.

### 2. Chess Logic Review

Checks:

- FEN parses.
- Side to move matches prose and prompts.
- UCI/SAN moves are legal unless block explicitly allows sandbox mode.
- Final FEN after move sequences matches expected result.
- Captures, checks, mates, pins, forks, and threats claimed by the text are verified where possible.

### 3. Diagram Generation Review

Checks:

- PNG generated from the content block.
- Board orientation is correct.
- Highlighted squares exist.
- Arrows point to legal board squares.
- Board image hash matches the manifest.

### 4. Text-to-Image Consistency Review

Checks:

- Caption does not mention missing arrows/highlights.
- Caption does not claim the wrong side is to move.
- Text does not identify a piece on the wrong square.
- "Best move" matches the expected solution.
- Capture diagrams show the captured square/piece correctly.

This reviewer should combine deterministic checks with a vision-capable AI review. Deterministic checks catch exact chess facts; AI review catches human-language mismatches such as "rook on the open file" when the diagram shows a bishop.

### 5. Pedagogy Review

Checks:

- The section teaches one idea at a time.
- Diagrams appear before dense explanation when the visual is needed.
- Hints progress from conceptual to specific.
- Wrong answers explain why they fail.
- Chapter checkpoint tests the stated objectives.

### 6. Human Chess Review

At least one strong chess reviewer must approve each chapter. Automation should reduce mistakes, not replace chess judgment.

## Reviewer Roles

| Role | Responsibility |
| --- | --- |
| Curriculum architect | Book sequence, ELO ladder, learning objectives |
| Chess analyst | Move truth, lines, alternatives, refutations |
| Content author | Prose and learner voice |
| Diagram producer | Board blocks, arrows, highlights, generated PNGs |
| Visual reviewer | Board image/text consistency |
| Pedagogy reviewer | Learning clarity and exercise design |
| Final editor | Tone, grammar, formatting, release readiness |

## Generation Workflow

1. Create book manifest.
2. Draft chapter outline with learning objectives and diagram inventory.
3. Generate structured chapter blocks with strict schema.
4. Generate deterministic board PNGs from board blocks.
5. Generate optional non-authoritative illustrations through image generation.
6. Run schema and chess validators.
7. Run visual/text reviewer.
8. Render web chapter locally.
9. Export static PDF/EPUB test version.
10. Human review.
11. Publish behind subscription gates.

## Export Strategy

The web interactive ebook is the primary product. Static exports are secondary products.

| Output | Recommended Method | Notes |
| --- | --- | --- |
| Web interactive | React renderer from JSON blocks | Full interactivity |
| PDF | Render print HTML and capture/export | Uses generated board PNGs |
| EPUB 3.3 | Static XHTML/CSS/assets package | No complex interactivity |
| PNG diagram pack | Diagram CLI | Useful for marketing and teacher notes |
| GIF/video snippets | Animation exporter | Useful for lessons and social content |

EPUB is still important because EPUB 3.3 is a W3C Recommendation and packages structured web content such as HTML, CSS, SVG, and other resources in a single-file container. It should be a distribution format, not the authoring source.

## Subscription Integration

Every book, chapter, and premium block should support `requiredTier`.

Rules:

- Free users can read full free books.
- Free users can preview locked Silver/Gold chapters with static diagrams but no full puzzle bank.
- Silver users get beginner and club books plus full standard exercises.
- Gold users get all books, deep analysis, advanced reviewer feedback, repertoire tools, and premium generated assets.

## Minimum Acceptance Standard For A Chapter

A chapter is not publishable until it has:

- A clear ELO target.
- At least 5 authoritative board diagrams.
- At least 1 interactive board.
- At least 1 common mistake/refutation.
- At least 1 checkpoint exercise.
- Valid FEN for every chess block.
- Generated diagram assets with hashes.
- Reviewer signoff.

For tactical or calculation chapters, raise this to:

- 10-20 diagrams.
- 6-12 exercises.
- Full move-line explanations.
- Accepted alternatives and refutations.

## Implemented Pilot Slice

The first v2 production slice now exists in the frontend:

```text
chess-frontend/src/data/ebooks/v2/beginner-board-rules/
  manifest.json
  chapters/01-board-coordinates.json
```

The `/ebook` viewer now loads this v2 package first. The old `chapter-01.json` through `chapter-06.json` files remain untouched as prototype archive content, but they are no longer the model for the serious ebook library.

Supporting renderer and validation files:

```text
chess-frontend/src/components/ebook/EbookViewer.jsx
chess-frontend/src/components/ebook/EbookChapter.jsx
chess-frontend/src/components/ebook/EbookBoard.jsx
chess-frontend/src/components/ebook/EbookQuiz.jsx
chess-frontend/src/components/ebook/utils/ebookV2Adapter.js
chess-frontend/src/components/ebook/utils/ebookVisuals.js
chess-frontend/src/components/ebook/utils/markdownLite.js
chess-frontend/scripts/validate-ebook-v2.cjs
chess-frontend/scripts/generate-ebook-diagrams.cjs
chess-frontend/scripts/export-ebook-review-pack.cjs
```

Run the current content gate with:

```bash
cd chess-frontend
pnpm validate:ebooks
```

Generate deterministic PNG diagrams with:

```bash
cd chess-frontend
pnpm generate:ebook-diagrams
```

This writes PNGs under each book package, for example:

```text
chess-frontend/src/data/ebooks/v2/beginner-board-rules/assets/diagrams/
```

It also writes a generated asset manifest:

```text
chess-frontend/src/data/ebooks/v2/asset-manifest.json
```

The validator checks:

- Book and chapter metadata.
- Allowed subscription tiers.
- Known block types.
- FEN placement syntax, including instructional boards that are not legal games.
- Legal move assertions for interactive and animation blocks.
- Piece-on-square assertions.
- Required deterministic assertions for every board-like block.
- Arrow and highlight square validity.
- Generated diagram file existence and SHA-256 hash matching.
- Quiz correctness shape.

The diagram generator checks the same source blocks for `exports.png`, renders the board from FEN placement, applies arrows and highlights from the approved color roles, uses local Chess99 piece assets, writes SHA-256 hashes back into chapter JSON, and records those hashes in the generated asset manifest.

Generate chapter review packs and a print-ready HTML export with:

```bash
cd chess-frontend
pnpm export:ebook-review-pack
```

This writes:

```text
docs/ebook-review-packs/index.md
docs/ebook-review-packs/<book-id>/<chapter-id>.md
docs/ebook-review-packs/<book-id>/<chapter-id>.print.html
```

The review pack is the handoff surface for chess, visual, pedagogy, and final editorial review. It includes:

- Chapter intent, ELO range, tier, objectives, and quality gate results.
- Every block in reading order.
- Generated PNGs embedded beside their FEN, arrows, highlights, assertions, and hash.
- Text-to-visual square and move traces.
- Deterministic reviewer flags for missing assertions, missing image evidence, and asset hash problems.
- Human signoff placeholders for chess analyst, visual reviewer, pedagogy reviewer, and final editor.

The print HTML is a static export prototype for PDF production. It uses generated PNGs for authoritative chess diagrams and keeps interactive blocks readable as static prompts, quiz options, FEN, arrows, highlights, and assertions.

The validator now also enforces chapter-level `reviewAssertions`, including minimum board diagrams, guided moves, quizzes, and allowed subscription tier. This prevents a chapter from looking complete while silently falling below the minimum publishing standard.

Book 1 is now complete as a v2 draft with 10 chapters:

```text
chess-frontend/src/data/ebooks/v2/beginner-board-rules/manifest.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/01-board-coordinates.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/02-pieces-values-setup.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/03-king-and-goal.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/04-rook-and-bishop.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/05-queen-power.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/06-knight-jumps.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/07-pawn-rules.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/08-check-and-escape.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/09-checkmate-and-stalemate.json
chess-frontend/src/data/ebooks/v2/beginner-board-rules/chapters/10-first-guided-game.json
```

Book 1 covers board coordinates, piece names and setup, king movement, rook and bishop movement, queen movement, knight jumps, pawn rules, check escapes, checkmate vs stalemate, and one short guided game. The `/ebook` viewer lists all 10 chapters.

The generated Book 1 asset set currently contains 66 authoritative PNG diagrams. The review pack index contains 10 chapter review files and 10 print HTML files:

```text
docs/ebook-review-packs/index.md
docs/ebook-review-packs/beginner-board-rules/
```

The current validation summary is:

```text
1 book, 10 chapters, 130 blocks, 76 board blocks, 31 quiz blocks
```

The next production step is human review of Book 1 through the review packs, then expansion of the print HTML into true PDF/EPUB export commands.

## References

- OpenAI image generation docs: GPT Image models support image generation/editing through API workflows, with configurable output and production cost considerations. Source: https://developers.openai.com/api/docs/guides/image-generation
- OpenAI Structured Outputs: schema-adherent model output is available and recommended over plain JSON mode where possible. Source: https://developers.openai.com/api/docs/guides/structured-outputs
- OpenAI graders: graders compare reference answers with generated answers and can return partial credit scores. Source: https://developers.openai.com/api/docs/guides/graders
- Playwright visual comparisons: `toHaveScreenshot()` can generate and compare reference screenshots. Source: https://playwright.dev/docs/test-snapshots
- W3C EPUB 3.3: EPUB 3.3 is a W3C Recommendation and packages HTML/CSS/SVG/resources for distribution. Source: https://www.w3.org/press-releases/2023/epub33-rec/
- Pandoc manual: Pandoc supports Markdown input and EPUB/PDF-oriented output formats, making it useful for static export experiments. Source: https://pandoc.org/MANUAL.html
- MDX documentation: MDX combines Markdown with JSX components, useful for component-rich authoring but not sufficient as the only source of truth. Source: https://mdxjs.com/docs/what-is-mdx/
