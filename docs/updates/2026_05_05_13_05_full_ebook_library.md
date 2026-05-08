# 2026-05-05 13:05 Update

## Summary

Created the remaining Chess99 v2 ebook library, covering Books 3 through 12, and exported PDFs for the full 12-book set.

## Changes

- Added 10 new v2 book packages:
  - `beginner-tactics`
  - `opening-habits-real-games`
  - `calculation-candidate-moves`
  - `club-tactics`
  - `positional-chess-club`
  - `endgame-foundations`
  - `advanced-strategy`
  - `calculation-depth-quiet-moves`
  - `repertoire-model-games`
  - `tournament-mastery-self-coaching`
- Added 100 new chapter JSON files across Books 3-12.
- Generated deterministic board PNG diagrams for the full 12-book library.
- Updated the v2 ebook viewer so it discovers all v2 manifests and chapters automatically.
- Regenerated all review packs and learner-facing print HTML files.
- Exported PDF files for all 12 books.
- Updated the 12-book curriculum plan with production status for Books 3-12.

## Verification

- `pnpm generate:ebook-diagrams` passed with 836 total diagram exports.
- `pnpm validate:ebooks` passed with 12 books, 120 chapters, 1440 blocks, 846 board blocks, and 361 quizzes.
- `pnpm export:ebook-review-pack` passed with 120 review packs.
- Review pack index has zero `NEEDS REVIEW` or `FLAG` rows after title cleanup.
- `pnpm export:ebook-pdf` passed and exported all 12 PDFs.
- Learner-facing combined print HTML has zero visible `prose`, `FEN:`, `Arrows:`, or `Assertions:` metadata leaks.

## Notes

- Books 3-12 are complete v2 drafts suitable for structured editorial review.
- Human chess, pedagogy, and editorial review are still needed before marking any new book publish-ready.
