# Learning Mode Helplines

Added a Learning mode for computer games with a shared helpline budget. Players choose 7, 5, 3, or 1 helplines before starting; Undo and Best-move reveal each spend one helpline, while CCT remains unlimited.

Frontend changes:
- Added Learning to the game mode selector.
- Added the pre-game helpline chooser.
- Hid companion controls in Learning games.
- Limited Best reveal in the CCT panel and reset Best after each new position so every reveal is intentional.
- Stored Learning games as casual backend games for legacy compatibility, with explicit Learning metadata for help tracking.

Backend changes:
- Added Learning game columns for help limit, help used, and Learner Elo result data.
- Added separate user Learner Elo fields and `learner_rating_history`.
- Applied help-aware Learner Elo on Learning completion and resignation.
- Kept regular rated Elo unchanged.

Verification:
- `pnpm build` passed.
- `CI=true pnpm test --watchAll=false --runInBand` passed.
- `php artisan migrate --pretend --path=database/migrations/2026_05_07_060000_add_learner_elo_tracking.php` passed.
- `php artisan test tests/Feature/SyntheticComputerGameTest.php` passed, including the Learner Elo completion case.
- Full backend PHPUnit progressed through the new Learner Elo test, but local full-suite completion is blocked by a PHP memory-limit fatal near later route-heavy tests in this workspace.
- `pnpm test:e2e` could not complete locally: first blocked by Playwright worker spawn permissions, then timed out waiting for its configured web server / long-running E2E execution.
