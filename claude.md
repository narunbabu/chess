* Read `docs/context.md`; map the exact code paths you’ll touch (call graph, data flow, entry points), list constraints/invariants, and note any global/shared primitives implicated.
* Identify stakeholders (modules, services, users, jobs) and the public contracts they rely on; write down invariants and edge cases discovered in code, tests, and logs.
* Propose a short plan (goal, approach, files to change, rollout/flags, observability, risks, tests) and wait for approval before coding.
* Work in small, reversible slices behind feature flags; prefer additive code and local adapters over edits to shared primitives; include a kill-switch and default flags to off.
* Match existing styles for imports/exports, naming, logging (structured), error handling, i18n, and accessibility; copy nearby patterns rather than inventing new ones.
* Run a drift check before changes: align DB schema/migrations, server validators/types, and client constants/enums; document any mismatches and propose mapping/migration.
* Preserve public APIs and data schemas; if a change is unavoidable, provide compatibility shims/versioning, safe migrations, and a documented rollback plan with precise steps.
* Keep the build green locally: `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`; run migrations in dry-run/staging first and include seed/fixtures for new data.
* Write targeted tests for new/changed behavior, including flag-off and legacy paths; cover failure modes, boundary cases, and schema/validator parity; update snapshots intentionally.
* Exclude secrets/PII from code and logs; use env vars/secret manager; sanitize request/response logging; enforce authZ/authN and input validation on all new entry points.
* Monitor performance on likely hot paths; add lightweight metrics/timers; avoid N+1s, excessive allocations, and unnecessary async/await; include a simple perf budget in PR notes.
* Communicate high-level status after each slice (what/why/next/risks); call out assumptions and pause for re-approval if scope, contracts, or risk surface change.
* Execute TODO items incrementally; convert TODOs into trackable tasks where useful; check them off in the update note as they’re completed.
* Append a concise change log to `docs/updates/YYYY_MM_DD_HH_MM_update.md` (same timestamp as the TODO; “todo” → “update”) covering context, diff summary, risks, tests, rollout/flags, metrics, and links to PRs/dashboards.
* For each debug fix, add `docs/success-stories/YYYY_MM_DD_HH_MM_<slug>.md` with problem, root cause, resolution, impact, lessons learned, and links to PR/tests; link it from the corresponding update note.
* Use `pnpm` for Node workflows (`pnpm i`, `pnpm build`, `pnpm test`, `pnpm lint`, `pnpm typecheck`); keep the lockfile committed and avoid mixing package managers.
* Use clear conventional commits (`type(scope): summary`); reference issues, mention flags/migrations in the body, and make changesets easy to trace and revert.
* Tests should be compatible to run in windows powershell