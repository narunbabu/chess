# PlayMultiplayer.js Refactoring Plan

## Overview

**Goal**: Refactor the 4,031-line PlayMultiplayer.js file into a modular, maintainable structure
**Current Issues**:
- Single file with 40+ state variables and 8 major functional domains mixed together
- Complex pause/resume logic (~700 lines)
- WebSocket event handling intertwined with UI
- Difficult to test, debug, and maintain

**Target Structure**: Create a `multiplayer/` module with ~20 organized files averaging 220 lines each

## 🎯 Proposed Module Structure

```
chess-frontend/src/components/play/
├── multiplayer/                          # NEW MODULE DIRECTORY
│   ├── index.js                          # Main orchestrator (500 lines)
│   ├── hooks/
│   │   ├── useGameInitialization.js     # Game setup & loading (200 lines)
│   │   ├── useWebSocketConnection.js    # WebSocket lifecycle (250 lines)
│   │   ├── usePauseResumeSystem.js      # Pause/resume logic (400 lines)
│   │   ├── useResumeRequests.js         # Resume request handlers (500 lines)
│   │   ├── useTimerManagement.js        # Timer state & sync (150 lines)
│   │   ├── useMoveHandler.js            # Move logic & validation (300 lines)
│   │   ├── useGameEndHandler.js         # Game completion (350 lines)
│   │   ├── useChampionshipContext.js    # Championship integration (100 lines)
│   │   ├── useInactivityDetection.js    # Presence tracking (200 lines)
│   │   └── useGameNavigation.js         # Navigation guard integration (100 lines)
│   ├── handlers/
│   │   ├── gameEventHandlers.js         # WebSocket event callbacks (400 lines)
│   │   ├── moveHandlers.js              # Move execution & validation (200 lines)
│   │   ├── drawOfferHandlers.js         # Draw offer logic (150 lines)
│   │   └── newGameHandlers.js           # Rematch/new game (200 lines)
│   ├── components/
│   │   ├── PausedGameOverlay.jsx        # Paused UI (300 lines)
│   │   ├── MultiplayerHeader.jsx        # Game header (100 lines)
│   │   └── MultiplayerControls.jsx      # Game controls (100 lines)
│   └── utils/
│       ├── gameStateUtils.js            # State calculations (150 lines)
│       ├── playerColorUtils.js          # Color determination (100 lines)
│       └── resumeRequestUtils.js        # Resume request helpers (150 lines)
```

## 📋 Detailed Module Breakdown

### 1. Main Orchestrator (multiplayer/index.js)
**Lines**: ~500
**Purpose**: Compose all hooks and render the UI
**Responsibilities**:
- Import and coordinate all custom hooks
- Manage top-level state coordination
- Render PlayShell/GameContainer with composed data
- Handle feature flag switching (PlayShell vs legacy)

### 2. Custom Hooks (multiplayer/hooks/)

#### a) useGameInitialization.js (~200 lines)
**Extract from**: lines 328-786
**Responsibilities**:
- Fetch game data from API
- Validate game access (403 checks)
- Handle finished/paused game states
- Initialize chess.js game instance
- Determine player color (authoritative)
- Restore scores from database
- Fetch championship context
- Register with navigation guard

#### b) useWebSocketConnection.js (~250 lines)
**Extract from**: lines 678-786
**Responsibilities**:
- Initialize WebSocketGameService
- Set up event listeners (connected, disconnected, gameMove, etc.)
- Subscribe to user channel for draw offers
- Manage connection lifecycle
- Handle reconnection logic
- Clean up on unmount

#### c) usePauseResumeSystem.js (~400 lines)
**Extract from**: lines 713-921
**Responsibilities**:
- handleGamePaused event handler
- handleGameResumed event handler
- Timer recalculation on resume (with grace time)
- Show/hide paused UI
- Reset move timer on pause/resume
- Clear pending resume requests

#### d) useResumeRequests.js (~500 lines)
**Extract from**: lines 2007-2700
**Responsibilities**:
- Resume request countdown timer
- handleRequestResume (manual & lobby-initiated)
- handleResumeResponse (accept/decline)
- sendResumeRequest (WebSocket + HTTP fallback)
- canUseWebSocketForResume check
- Polling fallback for offline opponents
- Auto-send for lobby resumes
- Cooldown management
- Resume status checking

#### e) useTimerManagement.js (~150 lines)
**Extract from**: lines 92-228, 582-673
**Responsibilities**:
- Calculate initial timer state from database/moves
- Sync with useMultiplayerTimer hook
- getTimeData helper
- moveStartTimeRef tracking
- Timer state updates on move/pause/resume

#### f) useMoveHandler.js (~300 lines)
**Extract from**: lines 2776-2994
**Responsibilities**:
- performMove validation
- Move execution (optimistic local + server send)
- Move evaluation (score calculation)
- Move time tracking
- Update game history
- onDrop handler
- handleSquareClick handler
- Check validation (king in check warnings)

#### g) useGameEndHandler.js (~350 lines)
**Extract from**: lines 1189-1452
**Responsibilities**:
- handleGameEnd event processing
- Save game to history (with moves encoding)
- Report championship result
- Prepare GameCompletionAnimation data
- Handle forfeit/timeout scenarios
- Update game state to finished

#### h) useChampionshipContext.js (~100 lines)
**Extract from**: lines 290-326, 1141-1187
**Responsibilities**:
- fetchChampionshipContext
- reportChampionshipResult
- Restore context from sessionStorage
- Non-intrusive championship handling

#### i) useInactivityDetection.js (~200 lines)
**Extract from**: lines 1514-1629
**Responsibilities**:
- Inactivity timer (60s check)
- lastActivityTimeRef management
- handleMoveActivity
- showPresenceDialog triggering
- Pause on timeout via PresenceConfirmationDialogSimple

#### j) useGameNavigation.js (~100 lines)
**Extract from**: lines 1694-1727
**Responsibilities**:
- Listen for 'requestGamePause' events
- Trigger pause on navigation
- Register/unregister with GameNavigationContext

### 3. Event Handlers (multiplayer/handlers/)

#### a) gameEventHandlers.js (~400 lines)
**Extract from**: lines 682-1140
**Responsibilities**:
- handleRemoteMove
- handleGameStatusChange
- handlePlayerConnection
- handleGameActivated
- handleOpponentPing
- handleDrawOfferReceived
- handleDrawOfferDeclined

#### b) moveHandlers.js (~200 lines)
**Refactored subset of**: performMove
**Responsibilities**:
- Move validation logic
- Error message formatting
- King in check detection
- Move data preparation

#### c) drawOfferHandlers.js (~150 lines)
**Extract from**: lines 932-987
**Responsibilities**:
- handleOfferDraw
- handleAcceptDraw
- handleDeclineDraw

#### d) newGameHandlers.js (~200 lines)
**Extract from**: lines 2999-3192
**Responsibilities**:
- handleNewGame (rematch/new game)
- handleAcceptNewGameRequest
- handleDeclineNewGameRequest
- Polling for game activation

### 4. Components (multiplayer/components/)

#### a) PausedGameOverlay.jsx (~300 lines)
**Extract from**: lines 3584-3854
**Responsibilities**:
- Render paused overlay UI
- Resume request buttons
- Lobby resume messaging
- Accept/decline resume UI
- Countdown display
- Back to lobby button

#### b) MultiplayerHeader.jsx (~100 lines)
**Extract from**: lines 3238-3290
**Responsibilities**:
- Championship banner
- Time control display
- Connection status indicator
- Turn status display

#### c) MultiplayerControls.jsx (~100 lines)
**Extract from**: lines 3348-3375
**Responsibilities**:
- Resign button
- Offer Draw button
- Rematch/New Game buttons

### 5. Utilities (multiplayer/utils/)

#### a) gameStateUtils.js (~150 lines)
**Responsibilities**:
- calculatePlayerColor (authoritative logic)
- isGameFinished check
- validateGameAccess
- prepareGameResult

#### b) playerColorUtils.js (~100 lines)
**Responsibilities**:
- Derive color from IDs (single source of truth)
- Handle snake_case vs camelCase conversions
- Player data extraction helpers

#### c) resumeRequestUtils.js (~150 lines)
**Responsibilities**:
- Resume request validation
- Cooldown calculation
- Expiry time formatting
- Error message parsing

## 🚀 Implementation Strategy

### Phase 1: Extract Utilities (Low Risk)
1. Create `multiplayer/utils/` directory
2. Extract pure functions (no hooks/state)
3. Test utils in isolation
4. Update main file imports

### Phase 2: Extract Custom Hooks (Medium Risk)
Create `multiplayer/hooks/` directory and extract hooks in dependency order:
1. `useChampionshipContext` (independent)
2. `useGameInitialization` (uses championship)
3. `useWebSocketConnection` (uses initialization)
4. `useTimerManagement` (independent)
5. `useInactivityDetection` (uses timer)
6. `usePauseResumeSystem` (uses timer, WebSocket)
7. `useResumeRequests` (uses pause/resume)
8. `useMoveHandler` (uses timer, WebSocket)
9. `useGameEndHandler` (uses championship, timer)
10. `useGameNavigation` (uses pause)

### Phase 3: Extract Event Handlers (Medium Risk)
1. Create `multiplayer/handlers/` directory
2. Extract event handlers with stable dependencies
3. Pass required functions via parameters

### Phase 4: Extract UI Components (Low-Medium Risk)
1. Create `multiplayer/components/` directory
2. Extract JSX into dedicated components
3. Pass props for state/handlers

### Phase 5: Create Main Orchestrator (High Risk - Final Integration)
1. Create `multiplayer/index.js`
2. Import and compose all hooks
3. Import and use all handlers/components
4. Test full integration
5. Replace PlayMultiplayer.js export with new module

## ⚠️ Risk Assessment & Mitigation

### High-Risk Areas

1. **WebSocket Event Listener Dependencies**
   - **Risk**: Event handlers capture stale closures
   - **Mitigation**:
     - Use refs for frequently changing values
     - Wrap handlers in useCallback with correct dependencies
     - Test pause/resume/move flows thoroughly

2. **Resume Request State Machine**
   - **Risk**: Complex state transitions (sent/received/expired)
   - **Mitigation**:
     - Extract state machine logic into dedicated hook
     - Document state transition diagram
     - Add comprehensive logging

3. **Timer Synchronization**
   - **Risk**: Timer drift between move/pause/resume
   - **Mitigation**:
     - Keep timer logic centralized in useTimerManagement
     - Use performance.now() for precision
     - Test pause → resume → move sequences

4. **Championship vs Regular Play**
   - **Risk**: Different behavior for championship games
   - **Mitigation**:
     - Use feature flags/conditional logic clearly
     - Test both modes thoroughly
     - Document championship-specific paths

### Medium-Risk Areas

5. **Lobby Resume Auto-Send**
   - **Risk**: Race conditions in auto-send logic
   - **Mitigation**:
     - Extract auto-send into separate useEffect
     - Use hasAutoRequestedResume ref guards
     - Test lobby → paused game flow

6. **Inactivity Detection**
   - **Risk**: False positives/negatives on pause triggers
   - **Mitigation**:
     - Centralize activity tracking in one hook
     - Clear interval cleanup on unmount
     - Test idle → presence dialog → pause flow

## ✅ Testing Strategy

### Unit Tests (Per Module)
**Example**: `useMoveHandler.test.js`
- Test move validation
- Test score calculation
- Test illegal move rejection
- Test check detection

### Integration Tests
**Example**: `pauseResumeFlow.test.js`
- Test inactivity → presence dialog → pause
- Test manual resume request → accept
- Test lobby resume → auto-send → accept

### E2E Tests
**Full game flows**:
- Regular game: join → move → resign
- Championship game: join → move → complete → report
- Pause/resume: idle → pause → lobby resume → continue

## 📊 Benefits of Refactoring

1. **Maintainability**: Each file has single responsibility (~200-400 lines)
2. **Testability**: Hooks/utils can be unit tested in isolation
3. **Readability**: Clear separation of concerns
4. **Reusability**: Hooks can be reused in other components
5. **Debugging**: Easier to locate bugs in specific modules
6. **Collaboration**: Multiple devs can work on different modules
7. **Performance**: Better code splitting opportunities

## 📝 Migration Checklist

- [ ] Create `multiplayer/` directory structure
- [ ] Extract `utils/` (Phase 1)
- [ ] Extract `hooks/` (Phase 2) - 10 hooks
- [ ] Extract `handlers/` (Phase 3) - 4 handler files
- [ ] Extract `components/` (Phase 4) - 3 components
- [ ] Create `index.js` orchestrator (Phase 5)
- [ ] Write unit tests for each module
- [ ] Write integration tests
- [ ] Update imports in dependent files
- [ ] Test all flows (regular, championship, pause/resume)
- [ ] Replace original PlayMultiplayer.js export
- [ ] Remove old file (keep backup)

## 📈 Success Metrics

- File size reduction: 4,031 lines → avg 220 lines per file
- Test coverage increase: Target 80%+ for new modules
- Bug fix time reduction: Target 50% faster debugging
- Developer onboarding time reduction: Target 60% faster

## 🔍 Dependencies and Constraints

- Must maintain backward compatibility during migration
- WebSocket connection must remain stable during extraction
- Timer precision must be maintained (performance.now())
- Championship feature must continue working seamlessly
- Resume request functionality must remain robust

## 📚 Additional Resources

- Original PlayMultiplayer.js file: `src/components/play/PlayMultiplayer.js`
- Related components: PlayShell, GameContainer, ChessBoard
- Services: WebSocketGameService, gameService
- Contexts: GameNavigationContext, MultiplayerTimerContext