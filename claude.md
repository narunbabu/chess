# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

**Chess99** is a production-grade, real-time multiplayer chess platform. Domain: **chess99.com** (LIVE). Monorepo with separate frontend and backend.

**Read `docs/context.md` before making changes** — it has the full architecture, data flow, and current state.

## Architecture

```
Chess-Web/
├── chess-frontend/     # React 18 + MUI + Tailwind CSS
├── chess-backend/      # Laravel 12 (PHP 8.2+) + Laravel Reverb WebSockets
├── chess99-android/    # Android app
├── chess99-ios/        # iOS app
├── chess-tactical-progression-trainer/  # Standalone Gemini AI tactical trainer (Vite/TS)
├── docs/               # Documentation (context.md, updates/, success-stories/)
└── testing/            # Shared test utilities
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3, React Router 6.30, MUI 7.3, Tailwind CSS, chess.js + react-chessboard |
| **Backend** | Laravel 12, PHP 8.2+, Laravel Reverb (WebSockets), Laravel Sanctum (API auth) |
| **Database** | MySQL 8 (production), SQLite (testing) |
| **Cache** | Redis (session, presence, queue) |
| **Payments** | Razorpay 2.9 |
| **Real-time** | Laravel Reverb + laravel-echo + Pusher.js |
| **Testing** | Playwright (E2E, 8 suites), PHPUnit (backend unit + feature) |

## Commands

### Frontend (`chess-frontend/`)
```bash
pnpm start              # Dev server (port 3000)
pnpm build              # Production build
pnpm test               # Unit tests (react-scripts)
pnpm test:e2e           # Playwright E2E tests (8 suites)
pnpm test:e2e:ui        # Playwright UI mode
pnpm lint               # ESLint
pnpm typecheck          # TypeScript check
```

### Backend (`chess-backend/`)
```bash
php artisan serve              # Dev server
php artisan test               # PHPUnit (unit + feature tests)
php artisan migrate            # Run database migrations
php artisan migrate --pretend  # Dry-run migrations (ALWAYS do this first)
php artisan reverb:start       # Start WebSocket server
php artisan queue:listen       # Start queue processor
composer dev                   # Start all services concurrently
```

## Package Manager

**pnpm** for frontend. **Composer** for backend. Never use npm/yarn.

## Command Execution

**PowerShell is mandatory.** All commands must be executed via `powershell.exe -Command "..."` format. Never use direct bash commands. Example:
```bash
powershell.exe -Command "cd 'C:\\ArunApps\\Chess-Web\\chess-frontend'; pnpm build"
```

## Testing

### E2E Test Suites (Playwright — 8 suites)
- `lobby-smoke.spec.js` — Lobby page, game list
- `multiplayer-game.spec.js` — Game creation, joining, moves
- `chess-board-interaction.spec.js` — Board rendering, piece movement
- `interactive-lessons.spec.js` — Lesson module
- `performance.spec.js` — Load times, rendering performance
- Plus 3 additional suites

### Backend Tests (PHPUnit)
- Test DB: SQLite in-memory (`/tmp/chess_test.sqlite`)
- Cache/Mail: Array drivers (in-memory, no sending)
- Directories: `tests/Unit/`, `tests/Feature/`, `tests/Integration/`

## Database

- **Production**: MySQL 8 on VPS
- **Testing**: SQLite in-memory
- **Migrations**: `chess-backend/database/migrations/`
- Always run `php artisan migrate --pretend` before actual migration
- Schema changes require human approval

## Key Conventions

- **Read `docs/context.md` first** — map code paths before changes
- Propose a plan and wait for approval before coding
- Work in small, reversible slices; prefer additive code over shared primitive edits
- Match existing styles: imports/exports, naming, logging, error handling
- Run drift check before DB changes: align schema, validators, client constants
- Preserve public APIs; if breaking, provide compatibility shims and rollback plan
- Keep build green: `pnpm build && pnpm test && pnpm lint && pnpm typecheck`
- Write targeted tests for new/changed behavior including failure modes
- **CRITICAL**: Performance optimization must preserve functional correctness — test all user flows after each change, especially multi-step scenarios (workers, WebSockets, caches)
- Use conventional commits: `type(scope): summary`
- Change logs: `docs/updates/YYYY_MM_DD_HH_MM_update.md`
- Debug fixes: `docs/success-stories/YYYY_MM_DD_HH_MM_<slug>.md`

## Recent Features (as of 2026-04-18)

### Tactical Progression Trainer (`chess-frontend/src/components/tactical/`)
- Multi-stage puzzle system with sequential unlock (stages 1–4, Lichess puzzles)
- `TacticalPuzzleBoard.js` — full puzzle board with illegal/wrong move split scoring
- `TacticalTrainer.js` + `TacticalTrainerDashboard.js` — trainer UI and dashboard
- `tacticalStages.js` + `stageVideos.js` — stage config and video map
- Puzzle data: `chess-frontend/src/data/stage{1..4}_puzzles.json` + `beginner_puzzles.json`
- Standalone Gemini AI version: `chess-tactical-progression-trainer/` (Vite/TS, uses Gemini API)

### CCT (Chess Coaching Tool) Analysis (`chess-frontend/src/components/game/`)
- `CCTPanel.jsx` / `CCTPanel.css` — in-game analysis panel with threat detection and best-move arrows
- `chess-frontend/src/utils/cctAnalysis.js` + `computeCCT.js` — CCT computation utilities
- Two-phase scoring: threshold gate + score badges; pending/completion states tracked

### Companion Mode (redesigned)
- `CompanionControls.jsx` + `CompanionSelector.jsx` — companion plays on player's behalf (not as opponent)
- Backend: `GET /api/v1/synthetic-players` endpoint (`LobbyController::syntheticPlayers`)
- Migrations: `add_companion_to_game_mode` + `add_companion_to_matchmaking_tables`
- E2E: `chess-frontend/tests/e2e/companion-mode.spec.js`

### User Progress & Dashboard
- `ProgressChartsModal.js` — modal with rating/game stats charts
- `UserProgressCharts.js` — rating history and game statistics visualization
- `UserProgressController.php` — backend controller for progress data
- `WebSocketController.php` — expanded with chat + game state endpoints
- E2E: `chess-frontend/tests/e2e/user-progress.spec.js`

### Profile Quick-Edit UI
- `AvatarQuickEdit.js` / `.css` — inline avatar editing in header
- `NameQuickEdit.js` / `.css` — inline display name editing in header

### Game Result Standardization
- `chess-frontend/src/utils/resultStandardization.js` — normalizes result format across components
- `normalizeMoves` helper in `gameStateUtils.js` — handles plain string moves vs JSON
- `GameController@show` now returns standardized result format

## Security

- Sanctum for API auth, Socialite for OAuth (Google, Facebook)
- Razorpay webhook signature verification required
- Never log payment credentials or user PII
- Rate limit all public API endpoints
- Enforce authZ/authN on all new entry points

### Test Credentials (for debugging/verification)
- Email: `ab@ameyem.com` | Password: `Vedansh@123` (stored in `.env.local` as `CHESS99_TEST_EMAIL` / `CHESS99_TEST_PASSWORD`)
- Use these credentials to log in and test game states, review pages, etc. when investigating issues

---

## Quality Gates (MANDATORY before deployment)

```bash
# Frontend
cd chess-frontend && pnpm build && pnpm test:e2e

# Backend
cd chess-backend && php artisan test && php artisan migrate --pretend
```

**ALL gates must pass. No exceptions.**

### Deployment Procedure

1. All quality gates pass (see above)
2. Agent reports `READY TO DEPLOY` with gate results to WTM
3. WTM validates and routes to ServerMigrationAgent
4. SMA deploys via SSH to VPS:
   ```
   cd /opt/Chess-Web
   git pull

   # Backend (if backend files changed):
   cd chess-backend
   composer install --no-dev → php artisan migrate --force
   → config:clear → cache:clear → route:clear → view:clear
   → systemctl restart chess-reverb → systemctl reload php8.3-fpm

   # Frontend (if frontend files changed):
   cd /opt/Chess-Web/chess-frontend
   pnpm install --frozen-lockfile && pnpm build
   sudo cp -r /opt/Chess-Web/chess-frontend/build/. /var/www/chess99.com/

   # Always:
   sudo systemctl reload nginx
   ```
   **IMPORTANT**: Nginx serves chess99.com from `/var/www/chess99.com/` — the
   React build output at `chess-frontend/build/` must be copied there after
   every frontend build or the old version stays live.
5. Health check: `curl https://chess99.com` + `curl https://api.chess99.com/health`
6. **Never deploy directly from this project pane**

### Rollback Plan
```bash
cd /opt/Chess-Web
git revert HEAD

# Backend rollback:
cd chess-backend
composer install --no-dev
php artisan migrate:rollback --step=1
systemctl restart chess-reverb && systemctl reload php8.3-fpm

# Frontend rollback (if frontend changed):
cd /opt/Chess-Web/chess-frontend
pnpm build
sudo cp -r /opt/Chess-Web/chess-frontend/build/. /var/www/chess99.com/
sudo systemctl reload nginx
```

### Reference
- Full standards: `/mnt/c/ArunApps/docs/DEVELOPMENT-STANDARDS.md`
- Deployment pipeline: `/mnt/c/ArunApps/docs/DEPLOYMENT-PIPELINE.md`
- Agent coordination: `/mnt/c/ArunApps/docs/AGENT-COORDINATION-PROTOCOL.md`
