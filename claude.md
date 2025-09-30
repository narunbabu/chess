* Read `docs/context.md`, understand architecture/constraints, and scan the code paths you’ll touch.
* Identify stakeholders and invariants; keep behavior consistent with existing patterns.
* Propose a short plan (goal, files, risks, tests) and wait for approval before coding.
* Work in small, reversible slices; prefer additive, feature-flagged changes over edits to shared primitives.
* Match existing import/export styles, naming, logging, error handling, i18n, and accessibility conventions.
* Preserve public contracts and data schemas; if change is unavoidable, provide backward compatibility and a clear rollback.
* Keep the build green; run build, tests, type checks, and lints locally.
* Write targeted tests for new/changed behavior, including flag-off/legacy paths.
* Avoid secrets and production data in code or logs; follow security and privacy practices.
* Monitor performance on likely hot paths; avoid algorithmic regressions and excessive allocations.
* Communicate high-level status after each slice; call out assumptions and pause for re-approval if scope shifts.
* Execute TODO items incrementally and mark them complete as you go.
* Append a concise change log to `docs/updates/yyyy_mm_dd_hh_mm_update.md` (same timestamp as the TODO; “todo” → “update”) covering context, diff summary, risks, tests, and completed checklist.
* For every debug fix, add a brief **Success Story** file under `docs/success-stories/YYYY_MM_DD_HH_MM_<slug>.md` that captures problem, root cause, resolution, impact, lessons learned, and links to PR/tests; link it from the corresponding update note.
* Use `pnpm` for Node workflows (`pnpm i`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`).
* Use clear, conventional commit messages so each change is traceable and easy to revert.
