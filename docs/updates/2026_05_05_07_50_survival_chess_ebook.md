# 2026-05-05 07:50 Update

## Summary

Created Book 2, "Survival Chess", as a complete v2 ebook draft and exported the final PDF.

## Changes

- Added `chess-frontend/src/data/ebooks/v2/survival-chess/manifest.json`.
- Added 10 Survival Chess chapters covering CCT scans, hanging pieces, one-move defense, king safety, trades, queen/rook mates, stalemate avoidance, opening safety, blunder-checks, and mixed survival game moments.
- Generated 70 new authoritative board PNG diagrams for Book 2.
- Updated the v2 `asset-manifest.json` across both books.
- Wired Survival Chess into the `/ebook` viewer after The First Chessboard.
- Regenerated ebook review packs and learner-facing print HTML for all 20 chapters.
- Exported the Survival Chess PDF under `docs/ebook-pdfs/survival-chess/`.
- Updated the 12-book curriculum plan with Book 2 production status.

## Verification

- `pnpm generate:ebook-diagrams` passed with 136 total diagram exports.
- `pnpm validate:ebooks` passed with 2 books, 20 chapters, 240 blocks, 146 board blocks, and 61 quizzes.
- `pnpm export:ebook-review-pack` passed with 20 review packs; all chapters report PASS.
- `pnpm export:ebook-pdf` passed and exported both book PDFs.
- `pnpm build` passed.
- Learner-facing Survival Chess combined print HTML has no visible `prose`, `FEN:`, `Arrows:`, or `Assertions:` metadata.

## Notes

- The build still reports existing stale Browserslist and baseline-browser-mapping warnings.
- Human chess, pedagogy, and editorial review are still needed before calling Book 2 publish-ready.
