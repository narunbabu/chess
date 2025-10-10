# Chess99 Frontend - Developer Guide

## 📋 Table of Contents
- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Core Features](#core-features)
- [Architecture & Design Patterns](#architecture--design-patterns)
- [Key Components](#key-components)
- [Services & Utilities](#services--utilities)
- [State Management](#state-management)
- [Real-time Communication](#real-time-communication)
- [Routing & Navigation](#routing--navigation)
- [Development Workflow](#development-workflow)
- [Environment Configuration](#environment-configuration)
- [Build & Deployment](#build--deployment)
- [Testing](#testing)
- [Contributing Guidelines](#contributing-guidelines)

---

## Overview

**Chess99** is a modern, feature-rich online chess platform designed for kids and learners. The frontend is built as a React single-page application (SPA) that provides:

- **Multiple Game Modes**: Play against computer (Stockfish engine), play multiplayer with friends, solve puzzles
- **Learning Features**: Interactive lessons, tutorials, and training exercises
- **Real-time Multiplayer**: WebSocket-based live gameplay with smart polling fallback
- **Game Management**: Complete game history, review, and analysis capabilities
- **Social Authentication**: OAuth integration with Google and GitHub
- **Responsive Design**: Mobile-first approach with Tailwind CSS

**Target Audience**: Kids and chess learners in India and globally

---

## Technology Stack

### Core Technologies
| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.3.1 | UI framework |
| **React Router** | 6.30.0 | Client-side routing |
| **Axios** | 1.12.2 | HTTP client |
| **Tailwind CSS** | 3.4.17 | Utility-first styling |

### Chess-Specific Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| **chess.js** | 1.1.0 | Chess game logic and validation |
| **react-chessboard** | 4.7.2 | Interactive chessboard component |
| **Stockfish** | Custom | Chess engine (public/stockfish.js) |

### Real-time & Communication
| Library | Version | Purpose |
|---------|---------|---------|
| **Laravel Echo** | 2.2.4 | WebSocket client wrapper |
| **Pusher JS** | 8.4.0 | WebSocket protocol implementation |

### Additional Libraries
| Library | Version | Purpose |
|---------|---------|---------|
| **date-fns** | 4.1.0 | Date manipulation |
| **html2canvas** | 1.4.1 | Screenshot capture |
| **gif.js** | 0.2.0 | GIF generation |
| **react-icons** | 5.5.0 | Icon library |

### Development Tools
- **react-scripts** 5.0.1 - Build tooling (webpack, babel, etc.)
- **PostCSS** 8.5.6 - CSS processing
- **Autoprefixer** 10.4.21 - CSS vendor prefixing

---

## Project Structure

```
chess-frontend/
├── public/                     # Static assets
│   ├── index.html             # HTML entry point
│   ├── stockfish.js           # Stockfish chess engine
│   ├── gif.worker.js          # GIF generation worker
│   └── chess99.ico            # Favicon
│
├── src/
│   ├── index.js               # Application entry point
│   ├── App.js                 # Root component with routing
│   ├── config.js              # Environment configuration
│   ├── index.css              # Global styles
│   │
│   ├── assets/                # Images, sounds, icons
│   │   ├── images/            # Logo, backgrounds, illustrations
│   │   ├── sounds/            # Game sound effects (move, check, end)
│   │   └── icons/             # Custom icon components
│   │
│   ├── components/            # Reusable components
│   │   ├── auth/              # Authentication components
│   │   │   ├── AuthCallback.js
│   │   │   └── SocialLogin.js
│   │   ├── layout/            # Layout components
│   │   │   ├── Layout.js
│   │   │   └── Background.js
│   │   ├── play/              # Game-specific components
│   │   │   ├── PlayComputer.js
│   │   │   ├── PlayMultiplayer.js
│   │   │   ├── ChessBoard.js
│   │   │   ├── GameControls.js
│   │   │   ├── TimerDisplay.js
│   │   │   ├── ScoreDisplay.js
│   │   │   ├── GameInfo.js
│   │   │   ├── DifficultyMeter.js
│   │   │   ├── PawnColorSwitch.js
│   │   │   └── TimerButton.js
│   │   ├── Dashboard.js       # User dashboard
│   │   ├── GameHistory.js     # Game history viewer
│   │   ├── GameReview.js      # Game review/analysis
│   │   ├── TrainingHub.js     # Training exercises hub
│   │   ├── TrainingExercise.js
│   │   ├── Puzzles.js         # Chess puzzles
│   │   ├── Learn.js           # Learning materials
│   │   ├── Countdown.js       # Countdown timer
│   │   ├── PresenceIndicator.js
│   │   ├── GameCompletionAnimation.js
│   │   └── CheckmateNotification.js
│   │
│   ├── pages/                 # Page-level components
│   │   ├── LandingPage.js     # Public landing page
│   │   ├── Login.js           # Login/signup page
│   │   └── LobbyPage.js       # Multiplayer lobby
│   │
│   ├── contexts/              # React Context providers
│   │   ├── AuthContext.js     # Authentication state
│   │   └── AppDataContext.js  # Application data caching
│   │
│   ├── services/              # API and external services
│   │   ├── api.js             # Axios instance with interceptors
│   │   ├── WebSocketGameService.js  # WebSocket game management
│   │   ├── echoSingleton.js   # Echo WebSocket singleton
│   │   ├── presenceService.js # User presence tracking
│   │   └── gameHistoryService.js  # Game history API
│   │
│   ├── utils/                 # Utility functions
│   │   ├── computerMoveUtils.js    # AI move calculation
│   │   ├── gameStateUtils.js       # Game state management
│   │   ├── gameHistoryUtils.js     # History utilities
│   │   ├── gameHistoryStringUtils.js
│   │   ├── timerUtils.js           # Timer management
│   │   ├── evaluate.js             # Position evaluation
│   │   └── trainingExercises.js    # Training data
│   │
│   └── stockfish.worker.js    # Stockfish web worker wrapper
│
├── package.json               # Dependencies and scripts
├── tailwind.config.js         # Tailwind CSS configuration
├── postcss.config.js          # PostCSS configuration
└── DEVELOPER_GUIDE.md         # This file
```

---

## Core Features

### 1. **Play Against Computer** (`/play`)
- **Stockfish Integration**: Web Worker-based chess engine
- **Difficulty Levels**: Adjustable AI strength (1-20)
- **Time Controls**: Multiple time control options
- **Score Tracking**: Real-time position evaluation
- **Sound Effects**: Audio feedback for moves, checks, and game end
- **Board Orientation**: Switch between white/black perspective
- **Move Hints**: Optional move suggestions

**Key Components**:
- `PlayComputer.js` - Main game container
- `ChessBoard.js` - Interactive board
- `DifficultyMeter.js` - AI strength selector
- `ScoreDisplay.js` - Position evaluation display
- `stockfish.worker.js` - Engine communication

### 2. **Multiplayer Chess** (`/play/multiplayer/:gameId`)
- **Real-time Gameplay**: WebSocket-based move synchronization
- **Smart Polling Fallback**: HTTP polling when WebSocket unavailable
- **Game Invitations**: Send/accept game invitations
- **Presence System**: Live player status tracking
- **Game Resume**: Continue paused games
- **Resign & Draw**: Complete game flow controls

**Key Components**:
- `PlayMultiplayer.js` - Multiplayer game container
- `WebSocketGameService.js` - Real-time communication
- `LobbyPage.js` - Game lobby and invitations
- `PresenceIndicator.js` - Player online status

### 3. **Game Management**
- **Game History** (`/history`): Complete game archive
- **Game Review** (`/play/review/:id`): Step-through replay with analysis
- **Dashboard** (`/dashboard`): Personal statistics and active games
- **Screenshot & GIF Export**: Save game positions

**Key Components**:
- `GameHistory.js` - History listing
- `GameReview.js` - Game replay viewer
- `Dashboard.js` - User statistics

### 4. **Learning & Training**
- **Training Hub** (`/training`): Structured exercises by skill level
- **Puzzles** (`/puzzles`): Tactical chess puzzles
- **Learn Section** (`/learn`): Educational content and tutorials

**Key Components**:
- `TrainingHub.js` - Exercise browser
- `TrainingExercise.js` - Interactive exercises
- `Puzzles.js` - Puzzle solver
- `Learn.js` - Learning materials

### 5. **Authentication**
- **Social Login**: Google and GitHub OAuth
- **Token-based Auth**: JWT tokens with auto-refresh
- **Session Management**: Persistent login across tabs
- **Protected Routes**: Role-based access control

**Key Components**:
- `Login.js` - Login/signup UI
- `AuthCallback.js` - OAuth redirect handler
- `SocialLogin.js` - Social auth buttons
- `AuthContext.js` - Auth state management

### 6. **UI/UX Features**
- **Responsive Design**: Mobile-first, works on all screen sizes
- **Landscape Detection**: Optimized for landscape mode
- **Animated Transitions**: Smooth page transitions
- **Loading States**: Skeleton screens and spinners
- **Error Handling**: User-friendly error messages
- **Accessibility**: WCAG-compliant components

---

## Architecture & Design Patterns

### Component Architecture
```
App (Router + Providers)
├── AuthProvider (Authentication state)
├── AppDataProvider (Data caching)
└── Layout (Common layout wrapper)
    ├── Background (Decorative background)
    └── Pages
        ├── LandingPage
        ├── Dashboard
        ├── PlayComputer
        ├── PlayMultiplayer
        └── ...
```

### Design Patterns

#### 1. **Context Providers** (Global State Management)
- `AuthContext`: Authentication state, user info, login/logout
- `AppDataContext`: Cached data (user, game history) with invalidation

#### 2. **Service Layer** (Business Logic Abstraction)
- `api.js`: Centralized HTTP client with interceptors
- `WebSocketGameService.js`: WebSocket lifecycle management
- `gameHistoryService.js`: Game data fetching
- `presenceService.js`: User presence tracking

#### 3. **Singleton Pattern**
- `echoSingleton.js`: Single WebSocket connection shared across components
- Prevents duplicate connections and resource waste

#### 4. **Web Worker Pattern**
- `stockfish.worker.js`: Offload chess engine to background thread
- Keeps UI responsive during AI calculations

#### 5. **Smart Polling Fallback**
- Automatic fallback from WebSocket to HTTP polling
- Dynamic poll intervals based on game state (1s on your turn, 3s otherwise)
- ETag-based conditional requests to reduce bandwidth

#### 6. **Request Deduplication**
- `AppDataContext` prevents duplicate API calls
- In-flight request tracking with promise reuse

#### 7. **Error Boundary Pattern**
- API interceptors for global error handling
- Automatic token refresh on 401 responses
- User-friendly error messages

---

## Key Components

### 1. **PlayComputer.js**
**Purpose**: Single-player chess game against Stockfish AI

**Key Features**:
- Stockfish web worker integration
- Difficulty adjustment (depth 1-20)
- Position evaluation scoring
- Move sound effects
- Screenshot/GIF export
- Game history saving

**State Management**:
- `game` - Chess.js instance
- `fen` - Board position (FEN notation)
- `moveHistory` - Array of moves
- `difficulty` - AI strength level
- `score` - Position evaluation

**Props**: None (standalone page)

### 2. **PlayMultiplayer.js**
**Purpose**: Real-time multiplayer chess game

**Key Features**:
- WebSocket move synchronization
- Smart polling fallback
- Presence indicators
- Game state recovery
- Resign/draw functionality
- Timer management

**State Management**:
- `gameState` - Current game state from server
- `wsService` - WebSocketGameService instance
- `playerColor` - User's assigned color
- `connected` - WebSocket connection status

**WebSocket Events**:
- `gameMove` - Opponent move received
- `gameEnded` - Game completion
- `connected` - Connection established
- `disconnected` - Connection lost

### 3. **Dashboard.js**
**Purpose**: User statistics and game management

**Key Features**:
- Active games listing
- Recent games history
- Win rate calculation
- Quick action buttons
- Resume game functionality

**Data Sources**:
- `getGameHistory()` from AppDataContext
- `/games/active` API endpoint

### 4. **LobbyPage.js**
**Purpose**: Multiplayer game lobby and invitations

**Key Features**:
- Send game invitations
- Accept/decline invitations
- Active games list
- Real-time presence
- Auto-navigation on acceptance

**Polling Strategy**:
- 5s interval: `/invitations/pending`
- 5s interval: `/invitations/sent`
- 10s interval: `/invitations/accepted`

### 5. **AuthContext.js**
**Purpose**: Global authentication state

**Provides**:
- `isAuthenticated` - Login status
- `user` - User object
- `login(token)` - Login function
- `logout()` - Logout function
- `loading` - Auth initialization status

**Features**:
- Auto-fetch user on mount
- Token storage in localStorage
- Echo initialization on login
- Echo cleanup on logout

### 6. **AppDataContext.js**
**Purpose**: Cached data management with deduplication

**Provides**:
- `getMe(forceRefresh)` - Get current user
- `getGameHistory(forceRefresh)` - Get game history
- `invalidateMe()` - Clear user cache
- `invalidateGameHistory()` - Clear history cache
- `clearCache()` - Clear all caches

**Features**:
- In-flight request deduplication
- Cache invalidation
- Promise-based API
- Logging for debugging

---

## Services & Utilities

### API Service (`services/api.js`)

**Axios Instance Configuration**:
```javascript
baseURL: BACKEND_URL // Configured from environment
```

**Request Interceptor**:
- Injects `Authorization: Bearer {token}` header
- Reads token from localStorage

**Response Interceptor**:
- Catches 401 Unauthorized
- Clears token and redirects to `/login`

**Usage**:
```javascript
import api from './services/api';

// GET request
const response = await api.get('/user');

// POST request
const response = await api.post('/games', { data });
```

### WebSocket Service (`services/WebSocketGameService.js`)

**Purpose**: Manage real-time game communication

**Key Methods**:
- `initialize(gameId, user)` - Connect to game
- `joinGameChannel()` - Subscribe to game events
- `sendMove(moveData)` - Send move to server
- `resignGame()` - Resign current game
- `disconnect()` - Clean up connection

**WebSocket Events**:
- `gameMove` - Opponent move
- `gameEnded` - Game finished
- `connected` - WebSocket connected
- `disconnected` - WebSocket disconnected

**Polling Fallback**:
- Activated via `REACT_APP_USE_POLLING_FALLBACK=true`
- Smart dynamic intervals (1s/3s/8s)
- ETag-based conditional requests
- Compact state API (`/websocket/room-state`)

**Usage**:
```javascript
const wsService = new WebSocketGameService();
await wsService.initialize(gameId, user);

wsService.on('gameMove', (event) => {
  // Handle opponent move
});

await wsService.sendMove({ from: 'e2', to: 'e4' });
```

### Echo Singleton (`services/echoSingleton.js`)

**Purpose**: Single shared WebSocket connection

**Key Functions**:
- `initEcho({ token, wsConfig })` - Initialize singleton
- `getEcho()` - Get existing instance
- `disconnectEcho()` - Disconnect and cleanup
- `joinChannel(name, type)` - Join channel (idempotent)
- `leaveChannel(name)` - Leave channel

**Benefits**:
- Single WebSocket connection for entire app
- Prevents connection duplication
- Shared across components
- Automatic cleanup

### Game History Service (`services/gameHistoryService.js`)

**Key Functions**:
- `getGameHistories()` - Fetch all game history
- `getGameHistory(gameId)` - Fetch specific game
- `saveGameHistory(gameData)` - Save game to history

### Stockfish Worker (`stockfish.worker.js`)

**Purpose**: Web Worker wrapper for Stockfish engine

**Communication**:
```javascript
// Main thread
const worker = new Worker('/stockfish.worker.js');
worker.postMessage({ type: 'position', fen: '...' });
worker.postMessage({ type: 'go', depth: 10 });

worker.onmessage = (e) => {
  if (e.data.type === 'bestmove') {
    // Handle AI move
  }
};
```

---

## State Management

### Global State (Context API)

#### AuthContext
```javascript
{
  isAuthenticated: boolean,
  user: {
    id: number,
    username: string,
    email: string,
    avatar: string
  },
  login: (token) => Promise,
  logout: () => Promise,
  loading: boolean
}
```

#### AppDataContext
```javascript
{
  me: User | null,
  gameHistory: Game[] | null,
  getMe: (forceRefresh?) => Promise<User>,
  getGameHistory: (forceRefresh?) => Promise<Game[]>,
  invalidateMe: () => void,
  invalidateGameHistory: () => void,
  clearCache: () => void
}
```

### Local State (Component useState)

**Example - PlayComputer**:
```javascript
const [game] = useState(new Chess());
const [fen, setFen] = useState(game.fen());
const [moveHistory, setMoveHistory] = useState([]);
const [difficulty, setDifficulty] = useState(5);
const [score, setScore] = useState(0);
```

### URL State (React Router)

**Example - Game Review**:
```javascript
// Route: /play/review/:id
const { id } = useParams(); // Access game ID from URL
```

---

## Real-time Communication

### WebSocket Architecture

```
Frontend                    Backend
   ↓                           ↓
Echo Client  ←→  Reverb/Pusher Server
   ↓                           ↓
WebSocketGameService    Laravel Channels
   ↓                           ↓
React Component         Game Controller
```

### Channel Subscription

**Private Game Channel**:
```javascript
// Channel: private-game.{gameId}
echo.private(`game.${gameId}`)
  .listen('GameMoveEvent', (e) => { /* ... */ })
  .listen('GameEndedEvent', (e) => { /* ... */ })
  .listen('GameStatusEvent', (e) => { /* ... */ });
```

**User Channel**:
```javascript
// Channel: private-App.Models.User.{userId}
echo.private(`App.Models.User.${userId}`)
  .listen('GameInvitationEvent', (e) => { /* ... */ })
  .notification((notification) => { /* ... */ });
```

### Polling Fallback Strategy

**When WebSocket is unavailable**:
1. HTTP polling kicks in automatically
2. Dynamic intervals based on game state:
   - **Your turn**: 1s
   - **Opponent turn**: 3s
   - **Tab hidden**: 8s
3. ETag-based caching reduces bandwidth
4. Server returns compact state (`/websocket/room-state`)

**Advantages**:
- Works behind restrictive firewalls
- Lower server resource usage
- Better for mobile networks
- Graceful degradation

---

## Routing & Navigation

### Route Configuration (`App.js`)

| Path | Component | Auth Required | Description |
|------|-----------|---------------|-------------|
| `/` | LandingPage | No | Public landing page |
| `/login` | Login | No | Login/signup page |
| `/dashboard` | Dashboard | Yes | User dashboard |
| `/play` | PlayComputer | No | Single-player game |
| `/play/:gameId` | PlayMultiplayer | Yes | Multiplayer game |
| `/play/multiplayer/:gameId` | PlayMultiplayer | Yes | Multiplayer game (alt route) |
| `/play/review/:id` | GameReview | Yes | Game review/analysis |
| `/lobby` | LobbyPage | Yes | Multiplayer lobby |
| `/history` | GameHistory | Yes | Game history |
| `/training` | TrainingHub | No | Training exercises |
| `/training/:level/:id` | TrainingExercise | No | Specific exercise |
| `/puzzles` | Puzzles | No | Chess puzzles |
| `/learn` | Learn | No | Learning materials |
| `/auth/callback` | AuthCallback | No | OAuth redirect |

### Navigation Patterns

**Programmatic Navigation**:
```javascript
import { useNavigate } from 'react-router-dom';

const navigate = useNavigate();
navigate('/dashboard');
navigate(`/play/review/${gameId}`);
```

**Link Components**:
```javascript
import { Link } from 'react-router-dom';

<Link to="/play">Play Chess</Link>
```

**Conditional Rendering**:
```javascript
const location = useLocation();
const isLandingPage = location.pathname === '/';
```

---

## Development Workflow

### Setup Instructions

1. **Clone Repository**:
```bash
git clone https://github.com/your-org/chess-web.git
cd chess-web/chess-frontend
```

2. **Install Dependencies**:
```bash
npm install
# or
pnpm install
```

3. **Configure Environment**:
```bash
cp .env.example .env
```

Edit `.env`:
```env
REACT_APP_BACKEND_URL=http://localhost:8000/api
REACT_APP_REVERB_APP_KEY=your-reverb-key
REACT_APP_REVERB_HOST=localhost
REACT_APP_REVERB_PORT=8080
REACT_APP_REVERB_SCHEME=http
REACT_APP_USE_POLLING_FALLBACK=false
```

4. **Start Development Server**:
```bash
npm start
```

Application runs on `http://localhost:3000`

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start development server |
| `npm run build` | Build production bundle |
| `npm test` | Run test suite |
| `npm run eject` | Eject from Create React App (irreversible) |

### Development Tips

**Hot Module Replacement (HMR)**:
- Changes to `.js` files trigger auto-refresh
- Changes to `.css` files hot-reload without refresh

**Browser DevTools**:
- React DevTools extension recommended
- Network tab for API debugging
- Console for WebSocket event logging

**Debugging WebSockets**:
```javascript
// Enable verbose logging
localStorage.setItem('debug', 'Echo:*');
```

**Code Organization Best Practices**:
- Components: One component per file
- Naming: PascalCase for components, camelCase for functions
- File structure: Group related files by feature
- Comments: Document complex logic

---

## Environment Configuration

### Configuration File (`config.js`)

```javascript
export const BACKEND_URL = process.env.REACT_APP_BACKEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? "https://api.chess99.com/api"
    : "http://localhost:8000/api");

export const BASE_URL = BACKEND_URL.replace(/\/api$/, '');
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REACT_APP_BACKEND_URL` | No | See below | Backend API base URL |
| `REACT_APP_REVERB_APP_KEY` | Yes | - | Reverb/Pusher app key |
| `REACT_APP_REVERB_HOST` | No | localhost | WebSocket host |
| `REACT_APP_REVERB_PORT` | No | 8080 | WebSocket port |
| `REACT_APP_REVERB_SCHEME` | No | http | WebSocket scheme (http/https) |
| `REACT_APP_USE_POLLING_FALLBACK` | No | false | Force HTTP polling mode |

**Default Backend URLs**:
- Development: `http://localhost:8000/api`
- Production: `https://api.chess99.com/api`

### Build-time Configuration

Environment variables are embedded at build time. Changes require rebuild.

---

## Build & Deployment

### Production Build

```bash
npm run build
```

**Output**:
- Directory: `build/`
- Optimized, minified, production-ready bundle
- Source maps generated for debugging

### Build Artifacts

```
build/
├── static/
│   ├── css/          # Minified CSS
│   ├── js/           # Minified JS bundles
│   └── media/        # Images, fonts
├── index.html        # Entry point
├── manifest.json     # PWA manifest
└── asset-manifest.json
```

### Deployment Strategies

#### 1. **Static Hosting** (Recommended)
- **Netlify**: Drop `build/` folder or connect Git
- **Vercel**: Zero-config deployment
- **AWS S3 + CloudFront**: Enterprise solution
- **GitHub Pages**: Free for public repos

#### 2. **Docker Deployment**

**Dockerfile**:
```dockerfile
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/build /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 3. **Environment-Specific Builds**

**Staging**:
```bash
REACT_APP_BACKEND_URL=https://api-staging.chess99.com/api npm run build
```

**Production**:
```bash
REACT_APP_BACKEND_URL=https://api.chess99.com/api npm run build
```

### Performance Optimization

**Code Splitting**:
- Automatic route-based code splitting via React.lazy
- Dynamic imports reduce initial bundle size

**Asset Optimization**:
- Images compressed and optimized
- CSS minified and purged (Tailwind)
- JavaScript tree-shaken and minified

**Caching Strategy**:
- Aggressive caching for static assets
- Cache-busting via content hashes

---

## Testing

### Test Structure

```
src/
├── __tests__/              # Test files
│   ├── components/
│   ├── services/
│   └── utils/
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Test Categories

#### 1. **Component Tests**
- Render testing
- User interaction simulation
- Prop validation

#### 2. **Service Tests**
- API mocking
- WebSocket simulation
- Error handling

#### 3. **Utility Tests**
- Pure function testing
- Edge case validation

### Testing Libraries
- **Jest**: Test runner and assertions
- **React Testing Library**: Component testing
- **Mock Service Worker (MSW)**: API mocking (recommended)

---

## Contributing Guidelines

### Code Style

**ESLint Configuration**:
```json
{
  "extends": ["react-app", "react-app/jest"]
}
```

**Prettier** (recommended):
```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

### Git Workflow

1. **Create Feature Branch**:
```bash
git checkout -b feature/your-feature-name
```

2. **Make Changes & Commit**:
```bash
git add .
git commit -m "feat: add new feature"
```

**Commit Message Convention**:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style changes
- `refactor:` - Code refactoring
- `test:` - Test changes
- `chore:` - Build/tooling changes

3. **Push & Create PR**:
```bash
git push origin feature/your-feature-name
```

### Pull Request Checklist

- [ ] Code follows style guidelines
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No console errors/warnings
- [ ] Build succeeds (`npm run build`)
- [ ] Responsive design verified
- [ ] Cross-browser tested

---

## Additional Resources

### Documentation
- [React Docs](https://react.dev)
- [React Router Docs](https://reactrouter.com)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [chess.js Documentation](https://github.com/jhlywa/chess.js)
- [Laravel Echo Docs](https://laravel.com/docs/broadcasting#client-side-installation)

### Tools
- [React DevTools](https://react.dev/learn/react-developer-tools)
- [Redux DevTools](https://github.com/reduxjs/redux-devtools) (if needed)
- [Postman](https://www.postman.com/) - API testing
- [WebSocket Test Client](https://websocketking.com/)

### Support
- **Issues**: GitHub Issues
- **Discussions**: GitHub Discussions
- **Email**: dev@chess99.com

---

## Changelog

### Version 0.1.0 (Current)
- ✅ Core chess gameplay (single-player & multiplayer)
- ✅ Stockfish AI integration
- ✅ WebSocket real-time multiplayer
- ✅ Smart polling fallback
- ✅ Game history and review
- ✅ Social authentication (Google, GitHub)
- ✅ Training exercises and puzzles
- ✅ Responsive design with Tailwind CSS
- ✅ Sound effects and animations

### Planned Features
- 🔄 Chess variants (Chess960, Crazyhouse)
- 🔄 Tournament system
- 🔄 Rating system (ELO)
- 🔄 Video lessons integration
- 🔄 Mobile app (React Native)
- 🔄 Offline mode with service workers
- 🔄 Advanced game analysis with engine

---

## License

This project is proprietary software. All rights reserved.

---

**Happy Coding! ♟️**

For questions or support, reach out to the development team at dev@chess99.com
