# Chess-Web (Chess99) — Project Reference

**Domain:** [chess99.com](https://chess99.com) (LIVE)
**Status:** Production — Phase 5 Complete (Multiplayer + Tournaments + Learning Hub)
**Repository:** Monorepo — `chess-frontend/` + `chess-backend/` + `chess99-android/` + `chess99-ios/`

---

## Project Overview

Chess99 is a real-time multiplayer chess platform featuring:

- **Real-time multiplayer** via WebSockets (Laravel Reverb / Pusher protocol)
- **Championship tournaments** — Swiss, Elimination, and Hybrid formats with standings, tiebreaks, and organizer dashboards
- **Learning hub** — Interactive tutorials (beginner/intermediate/advanced), training puzzles, skill assessment, daily challenges
- **Social sharing** — Branded game-end cards, WhatsApp/social sharing with Open Graph meta tags
- **Guest play** — No registration required; local storage persistence and game resumption
- **Game review** — Move-by-move replay and history browsing
- **User profiles** — Elo ratings, stats, avatar uploads, OAuth login (Google, Facebook)
- **Payments** — Razorpay integration for tournament entry fees and premium features

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3, React Router 6.30, MUI 7.3, Tailwind CSS, chess.js, react-chessboard |
| **Backend** | Laravel 12, PHP 8.2+ |
| **WebSockets** | Laravel Reverb (native WS server, Pusher-compatible), laravel-echo, Pusher.js |
| **Auth** | Laravel Sanctum (API tokens), Socialite (Google/Facebook OAuth) |
| **Database** | MySQL 8 (production), SQLite (testing) |
| **Cache/Sessions** | Redis 6+ |
| **Payments** | Razorpay 2.9 |
| **E2E Testing** | Playwright (11 spec files) |
| **Backend Testing** | PHPUnit (Unit + Feature + Integration) |
| **Build Tool** | Create React App (frontend), Composer (backend) |
| **Package Manager** | pnpm (frontend), Composer (backend) |
| **Mobile** | Kotlin/Jetpack Compose (Android), Swift/SwiftUI (iOS) |

---

## Architecture

```
                    ┌──────────────────────────────┐
                    │        Nginx (VPS)           │
                    │  chess99.com → static build   │
                    │  api.chess99.com → Laravel    │
                    └────────┬──────────┬──────────┘
                             │          │
              ┌──────────────┘          └──────────────┐
              v                                        v
┌─────────────────────────┐          ┌─────────────────────────────┐
│   Frontend (React 18)   │          │   Backend (Laravel 12)      │
│                         │  HTTP    │                             │
│  chess.js (game logic)  │◄────────►│  Controllers / Services     │
│  react-chessboard (UI)  │          │  Eloquent Models            │
│  MUI + Tailwind (style) │  WS     │  Events (WebSocket)         │
│  laravel-echo (WS)      │◄────────►│  Laravel Reverb (WS server) │
└─────────────────────────┘          └──────────┬──────────────────┘
                                                │
                                     ┌──────────┴──────────┐
                                     v                     v
                              ┌────────────┐       ┌────────────┐
                              │  MySQL 8   │       │   Redis    │
                              │  (data)    │       │  (cache,   │
                              │            │       │  sessions, │
                              └────────────┘       │  presence) │
                                                   └────────────┘
```

### WebSocket Channel Structure

```
private-game.{gameId}                    # Game events (moves, state sync)
private-game.{gameId}.player.{playerId}  # Player-specific events
presence-lobby                           # Online user tracking
presence-game.{gameId}                   # Game presence
public-rooms                             # Room listings
```

### Auth Flow

1. User authenticates via Sanctum (or OAuth via Socialite)
2. Receives API token + WebSocket auth token
3. Connects to Reverb with token
4. Joins game-specific private/presence channels

---

## Project Structure

```
Chess-Web/
├── chess-backend/
│   ├── app/
│   │   ├── Models/              # Game, Championship, Tutorial, User, etc.
│   │   ├── Http/Controllers/    # API controllers
│   │   ├── Services/            # SwissPairingService, StandingsCalculator, etc.
│   │   ├── Events/              # WebSocket events
│   │   └── Policies/            # ChampionshipPolicy, etc.
│   ├── database/migrations/     # Schema migrations
│   ├── routes/
│   │   ├── api.php              # API routes
│   │   ├── api_v1.php           # v1 API routes (226+ endpoints)
│   │   └── channels.php         # WebSocket channel definitions
│   └── tests/                   # PHPUnit tests
├── chess-frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── play/            # Game interface (PlayMultiplayer, GameContainer)
│   │   │   ├── championship/    # Tournament components
│   │   │   ├── tutorial/        # Learning system components
│   │   │   └── auth/            # Login, register
│   │   ├── pages/               # Page components
│   │   ├── services/            # API service modules
│   │   └── utils/               # Utility functions
│   └── tests/e2e/               # Playwright E2E specs
├── chess99-android/             # Kotlin/Compose Android app
├── chess99-ios/                 # Swift/SwiftUI iOS app
├── docs/                        # Documentation
└── testing/                     # Shared test utilities
```

---

## CLI Commands

### Frontend (`chess-frontend/`)

All commands via PowerShell: `powershell.exe -Command "cd 'C:\\ArunApps\\Chess-Web\\chess-frontend'; <cmd>"`

| Command | Description |
|---------|-------------|
| `pnpm install` | Install dependencies |
| `pnpm start` | Dev server (port 3000) |
| `pnpm build` | Production build |
| `pnpm test` | Unit tests (react-scripts / Jest) |
| `pnpm test:e2e` | Playwright E2E tests |
| `pnpm test:e2e:ui` | Playwright UI mode |
| `pnpm lint` | ESLint |
| `pnpm typecheck` | TypeScript type checking |

### Backend (`chess-backend/`)

All commands via PowerShell: `powershell.exe -Command "cd 'C:\\ArunApps\\Chess-Web\\chess-backend'; <cmd>"`

| Command | Description |
|---------|-------------|
| `composer install` | Install PHP dependencies |
| `php artisan serve` | Dev server (port 8000) |
| `php artisan test` | Run PHPUnit tests |
| `php artisan migrate` | Run database migrations |
| `php artisan migrate --pretend` | Dry-run migrations (always do first) |
| `php artisan reverb:start` | Start WebSocket server |
| `php artisan queue:listen` | Start queue processor |
| `composer dev` | Start all services concurrently |
| `php artisan config:clear` | Clear configuration cache |
| `php artisan cache:clear` | Clear application cache |
| `php artisan route:clear` | Clear route cache |
| `php artisan view:clear` | Clear compiled views |

---

## E2E Test Suites (Playwright)

Located in `chess-frontend/tests/e2e/`:

| Test File | Coverage |
|-----------|----------|
| `lobby-smoke.spec.js` | Lobby page rendering, game list display |
| `multiplayer-game.spec.js` | Game creation, joining, move sync |
| `chess-board-interaction.spec.js` | Board rendering, piece movement, drag-and-drop |
| `interactive-lessons.spec.js` | Lesson module, tutorial progression |
| `performance.spec.js` | Load times, rendering performance |
| `chess-web.spec.js` | General app smoke tests |
| `lobby-authenticated.spec.js` | Authenticated lobby flows |
| `lobby-with-token.spec.js` | Token-based lobby access |
| `matchmaking-real-users.spec.js` | Real user matchmaking flows |
| `pricing-checkout.spec.js` | Pricing page, Razorpay checkout |
| `timer-expiry.spec.js` | Timer countdown, game timeout |

### Backend Tests (PHPUnit)

Located in `chess-backend/tests/`:

- **Unit/** — ChessDrawDetectionService, ChampionshipServices, InteractiveLessonStage, TournamentConfig (value objects)
- **Feature/** — WebSocketConnection, WebSocketEvents, ChampionshipTournament, TutorialSystem, TournamentProgression, ConsoleCommands, InteractiveLessonApi
- **Integration/** — TournamentWorkflow end-to-end

Test database: SQLite in-memory (`/tmp/chess_test.sqlite`), Cache/Mail: array drivers.

---

## Database

| Environment | Engine | Details |
|-------------|--------|---------|
| **Production** | MySQL 8 | VPS `69.62.73.225`, persistent data |
| **Testing** | SQLite | In-memory, `RefreshDatabase` trait |
| **Cache/Sessions** | Redis 6+ | Real-time state, presence, queues |

### Key Tables

- `users` — Profiles, ratings, avatars
- `games` — Active and completed games, move history
- `game_connections` — WebSocket connection tracking
- `game_chat_messages` — In-game chat
- `championships` — Tournament definitions (Swiss/Elimination/Hybrid)
- `championship_participants` — Registration, seeding
- `championship_matches` — Scheduled matches per round
- `championship_standings` — Rankings, tiebreak scores (Buchholz, Sonneborn-Berger)
- Tutorial/lesson tables — Progress, achievements, exercises

### Migration Safety

Always run `php artisan migrate --pretend` before actual migrations. Schema changes require human approval.

---

## Key API Endpoints

### Game Management
```
GET    /api/games                    # List active games
POST   /api/games                    # Create new game
GET    /api/games/{id}               # Get game details
POST   /api/games/{id}/move          # Submit a move
```

### Championships
```
GET    /api/championships                     # List tournaments
POST   /api/championships                     # Create tournament
GET    /api/championships/{id}                # Tournament details
POST   /api/championships/{id}/register       # Register for tournament
GET    /api/championships/{id}/matches        # All matches
GET    /api/championships/{id}/my-matches     # User's matches
POST   /api/matches/{id}/create-game          # Create game from match
GET    /api/championships/{id}/standings       # Standings
POST   /api/championships/{id}/start          # Start tournament
POST   /api/championships/{id}/generate-round # Generate next round
```

### In-Game Chat
```
GET    /api/v1/websocket/games/{gameId}/chat  # Chat history
POST   /api/v1/websocket/games/{gameId}/chat  # Send message
```

Full API: 226+ routes in `routes/api.php` and `routes/api_v1.php`.

---

## Deployment

### Production Environment

- **VPS:** Contabo `69.62.73.225`, Ubuntu
- **Web Server:** Nginx — `chess99.com` serves static React build, `api.chess99.com` proxies to Laravel
- **Frontend served from:** `/var/www/chess99.com/` (copied from `chess-frontend/build/`)
- **Backend served from:** `/opt/Chess-Web/chess-backend/`
- **Services:** PHP 8.3-FPM, MySQL 8, Redis, Laravel Reverb (systemd `chess-reverb`)
- **SSL:** Let's Encrypt (auto-renewal via Certbot)
- **Email:** `support@chess99.com` (Postfix/Dovecot, DKIM/SPF/DMARC verified)

### Deployment Procedure

1. All quality gates pass: `pnpm build && pnpm test:e2e` (frontend), `php artisan test` (backend)
2. Route through ServerMigrationAgent (never deploy from project pane)
3. SMA deploys via SSH:
   ```bash
   cd /opt/Chess-Web && git pull

   # Backend (if changed):
   cd chess-backend
   composer install --no-dev
   php artisan migrate --force
   php artisan config:clear && cache:clear && route:clear && view:clear
   systemctl restart chess-reverb && systemctl reload php8.3-fpm

   # Frontend (if changed):
   cd /opt/Chess-Web/chess-frontend
   pnpm install --frozen-lockfile && pnpm build
   sudo cp -r build/. /var/www/chess99.com/

   # Always:
   sudo systemctl reload nginx
   ```
4. Health check: `curl https://chess99.com` + `curl https://api.chess99.com/health`

### Rollback

```bash
cd /opt/Chess-Web && git revert HEAD
# Backend: composer install --no-dev, migrate:rollback --step=1, restart services
# Frontend: pnpm build, copy build to /var/www/chess99.com/, reload nginx
```

---

## Key Conventions

- **Read `docs/context.md` first** before making changes
- **Propose a plan and wait for approval** before coding
- **PowerShell mandatory** for all command execution (`powershell.exe -Command "..."`)
- **pnpm only** (never npm/yarn) for frontend
- **Conventional commits:** `type(scope): summary`
- **Change logs:** `docs/updates/YYYY_MM_DD_HH_MM_update.md`
- **Debug fixes:** `docs/success-stories/YYYY_MM_DD_HH_MM_<slug>.md`
- Work in small, reversible slices; prefer additive code over modifying shared primitives
- Run drift check before DB changes: align schema, validators, client constants
- Keep build green: `pnpm build && pnpm test && pnpm lint && pnpm typecheck`
- Never log payment credentials or user PII
- Rate limit all public API endpoints

### Quality Gates (Mandatory)

```bash
# Frontend
cd chess-frontend && pnpm build && pnpm test:e2e

# Backend
cd chess-backend && php artisan test && php artisan migrate --pretend
```

All gates must pass. No exceptions.

---

## Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| WebSocket connection | < 3s | < 500ms |
| Move latency | < 100ms | — |
| Concurrent games | 100+ | 50+ |
| Uptime | 99.9% | > 99% |
| DB query time | < 50ms | — |
| Game completion rate | > 90% | — |

---

## Current Status & Roadmap

### Completed Phases

| Phase | Scope | Status |
|-------|-------|--------|
| **Phase 1** | Foundation — WebSocket infra, DB schema, auth, presence | Done |
| **Phase 2A** | Connection & handshake protocol | Done |
| **Phase 2B** | Move synchronization & validation | Done |
| **Phase 3** | Enhanced UX — Profiles, game review, social sharing, guest play | Done |
| **Phase 4** | Championship tournament system (Swiss/Elimination/Hybrid) | Done |
| **Phase 5** | Learning hub & training system | Done |

### Mobile App Progress

- **Android (Kotlin/Compose):** Phases 0-11 complete (auth, single-player, multiplayer, lobby, profile, history, tournaments, learning, social, payments, dashboard)
- **iOS (Swift/SwiftUI):** Phases 0-2 complete (API prep, scaffolding, single-player)

### Planned

- Chess clocks and time controls refinement
- AI opponents (Stockfish integration)
- Credit economy and premium features
- Spectator mode
- Tournament payment processing and email notifications
- Advanced learning system (video tutorials, multi-language)

---

## Environment Variables

```env
# WebSocket
REVERB_APP_ID=...
REVERB_APP_KEY=...
REVERB_APP_SECRET=...

# Database
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306

# Redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379

# URLs
APP_URL=https://api.chess99.com
SHARE_URL=https://chess99.com

# Razorpay
RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
```

---

**Overall Progress:** ~85-90% complete
**Last Updated:** March 2026
