# Project Summary

## Overview
This repository consists of two main parts:

1. **Frontend (`chess/`)**: A React-based chess training and play UI.
2. **Backend (`learn-api/`)**: A Laravel-powered REST API for authentication and game history management.

---

## 1. Frontend (`chess/`)

### 1.1 Structure

```
chess/
├── public/              Static assets (HTML, images)
├── src/
│   ├── index.js         App entry point
│   ├── App.js           Defines routes and navigation
│   ├── config.js        Configuration (e.g., BACKEND_URL)
│   ├── components/      UI components
│   │   ├── play/        Game vs. computer UI (ChessBoard, Controls, Info, etc.)
│   │   ├── TrainingHub  Lists training puzzles
│   │   └── TrainingExercise  Puzzle interface
│   ├── services/        HTTP/client layers
│   │   ├── api.js       Axios instance with auth interceptors
│   │   └── gameHistoryService.js  CRUD for localStorage saved games
│   ├── utils/           Helpers (move evaluation, state updates, timer, exercises data)
│   └── assets/          Images, styles, fonts
└── package.json         NPM scripts and deps
```

### 1.2 Key Modules

- **App.js**: Sets up React Router for “Play vs Computer” and “Training Exercises”.
- **ChessBoard.js**: Renders board using `react-chessboard`, highlights legal moves, handles user input.
- **PlayComputer.js**: Coordinates engine moves (via Stockfish worker), timers, score evaluation, and history.
- **TrainingExercise.js**: Loads FEN positions from `utils/trainingExercises.js`, validates user moves, reveals solutions.
- **api.js**: Axios instance pointing to `BACKEND_URL`, attaches Bearer token and redirects on 401.
- **gameHistoryService.js**: Persists game history locally; can be extended to sync with backend.

### 1.3 Frontend↔Backend Interaction

- **Auth**: Frontend redirects user to `/api/auth/{provider}/redirect`, stores returned token in `localStorage`.
- **API Calls**: Uses `api.js` to call endpoints under `/api/game-history` (list, show, store) and `/api/rankings`.

---

## 2. Backend (`learn-api/`)

### 2.1 Structure

```
learn-api/
├── app/
│   ├── Http/
│   │   ├── Controllers/
│   │   │   ├── Auth/SocialAuthController.php  OAuth redirect and callback
│   │   │   └── Api/GameHistoryController.php CRUD for game history + rankings
│   └── Models/
│       ├── GameHistory.php    Eloquent model for game records
│       └── User.php           Default user model (with Sanctum tokens)
├── routes/
│   └── api.php         Defines auth and game-history routes
├── config/, bootstrap/, database/, resources/, etc.
├── composer.json       PHP deps
└── vite.config.js      Frontend build integration
```

### 2.2 Key Endpoints (routes/api.php)

- **Auth** (`/api/auth/{provider}/redirect|callback`) uses SocialAuthController for OAuth (Google, Facebook, etc.).
- **Protected** (`auth:sanctum`):
  - `GET /api/game-history` → index (list summaries)
  - `GET /api/game-history/{id}` → show (detailed record with moves)
  - `POST /api/game-history` → store (save new game)
  - `GET /api/rankings` → rankings (leaderboard)
- **Public test**: `GET /api/public-test`

### 2.3 Workflow

1. **Login**: Frontend invokes `/api/auth/{provider}/redirect`, user completes OAuth, callback returns Sanctum token.
2. **Token Storage**: Frontend stores token, uses in `Authorization: Bearer <token>` for subsequent calls.
3. **Game History**: Play sessions posted via `POST /api/game-history`, stored in DB via `GameHistoryController@store`.
4. **Retrieval**: User can list (`index`), view single (`show`), and fetch leaderboard (`rankings`).

---

## 3. Sub-module Interactions

- **React Services → Laravel API**: `src/services/api.js` sends HTTP requests to Laravel endpoints. Errors auto-redirect on 401.
- **Game State & History**: React utilities evaluate moves; on game end, PlayComputer triggers `gameHistoryService` (can be swapped to call API store).
- **Auth Flow**: SocialAuthController issues Sanctum tokens; frontend persists and attaches to API calls.

---

## 4. Development & Deployment

- **Frontend**: `npm start` or `yarn start` in `chess/` (runs React dev server).
- **Backend**: `php artisan serve` in `learn-api/` (runs Laravel dev server). Configure `.env` (DB, OAuth creds, FRONTEND_URL).

---

_End of project summary._
