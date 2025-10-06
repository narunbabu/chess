# Auth-Gated Multiplayer Implementation - Task Tracker

**Project**: Chess99 Frontend Navigation & Auth Gates
**Start Date**: 2025-10-06
**Target Completion**: 2025-10-16 (10 working days)
**Status**: 🟡 Planning Phase

---

## 🚨 CRITICAL PRESERVATION REQUIREMENTS

### ❌ **MUST NOT TOUCH - Working Functionality**

#### 1. WebSocket & Real-Time System
- **File**: `src/services/echoSingleton.js` - ❌ DO NOT MODIFY
- **File**: `src/services/WebSocketGameService.js` - ❌ DO NOT MODIFY
- **File**: `src/services/presenceService.js` - ❌ DO NOT MODIFY
- **Functionality**:
  - ✅ Online status broadcasting
  - ✅ Move broadcasting in multiplayer games
  - ✅ Challenge sending and acceptance broadcasting
  - ✅ Presence indicators and real-time updates
  - ✅ Private channel subscriptions
- **Note**: Polling is FALLBACK ONLY when WebSocket fails

#### 2. Authentication System
- **File**: `src/contexts/AuthContext.js` - ⚠️ READ ONLY (no modifications)
- **File**: `src/components/auth/AuthCallback.js` - ❌ DO NOT MODIFY
- **File**: `src/components/auth/SocialLogin.js` - ❌ DO NOT MODIFY
- **Functionality**:
  - ✅ Social login (Google, GitHub)
  - ✅ Manual email/password login
  - ✅ Token storage and management
  - ✅ Echo initialization on login
  - ✅ Session persistence

#### 3. Play Computer (AI System)
- **File**: `src/components/play/PlayComputer.js` - ❌ DO NOT MODIFY LOGIC
- **File**: `src/stockfish.worker.js` - ❌ DO NOT MODIFY
- **File**: `public/stockfish.js` - ❌ DO NOT MODIFY
- **Functionality**:
  - ✅ Stockfish worker communication
  - ✅ AI move calculation and analysis
  - ✅ Position evaluation scoring
  - ✅ Move validation and game logic
  - ✅ Sound effects (move, check, game end)

#### 4. Multiplayer Play System
- **File**: `src/components/play/PlayMultiplayer.js` - ❌ DO NOT MODIFY CORE LOGIC
- **File**: `src/components/play/ChessBoard.js` - ❌ DO NOT MODIFY
- **Functionality**:
  - ✅ WebSocket move synchronization
  - ✅ Game state updates via WebSocket events
  - ✅ Real-time opponent move updates
  - ✅ Polling fallback when WebSocket unavailable
  - ✅ Timer management and synchronization

#### 5. Lobby Page Real-Time Features
- **File**: `src/pages/LobbyPage.js` - ⚠️ WRAP ONLY (preserve internal logic)
- **Functionality**:
  - ✅ Real-time player list updates (WebSocket)
  - ✅ Challenge invitations (WebSocket)
  - ✅ Invitation acceptance (WebSocket)
  - ✅ Presence polling intervals
  - ✅ Active games list updates

#### 6. Data Context & Caching
- **File**: `src/contexts/AppDataContext.js` - ⚠️ USE AS-IS
- **Functionality**:
  - ✅ In-flight request deduplication
  - ✅ Cache invalidation logic
  - ✅ Promise-based API reuse

---

## ✅ **ALLOWED TO MODIFY - Navigation & Layout**

### Safe Areas for Implementation
1. **Landing Page** (`src/pages/LandingPage.js`) - ✅ Full redesign allowed
2. **Login Page** (`src/pages/Login.js`) - ✅ UI changes allowed (preserve auth flow)
3. **Layout Components** (`src/components/layout/`) - ✅ Create new layout wrappers
4. **Dashboard** (`src/components/Dashboard.js`) - ✅ UI changes allowed (preserve data fetching)
5. **Routing** (`src/App.js`) - ✅ Add route guards (preserve existing routes)

### Implementation Strategy
- **Composition over Replacement**: Wrap existing components, don't rewrite
- **Feature Flags**: All new features behind environment flags
- **Incremental Rollout**: Test each PR independently before merge

---

## 📋 PHASE 1: Foundation & Layout (Days 1-2)

### PR-1: Header, Portal, and Theme Foundation
**Status**: ⬜ Not Started
**Risk Level**: 🟠 MEDIUM
**Files to Create**:
- [ ] `src/theme.css` - CSS custom properties
- [ ] `src/components/layout/Header.jsx` - New sticky header
- [ ] `src/components/layout/Footer.jsx` - Mobile footer navigation

**Files to Modify**:
- [ ] `public/index.html` - Add `<div id="modal-root"></div>`
- [ ] `src/components/layout/Layout.js` - Add Header/Footer integration
- [ ] `src/index.css` - Import theme.css

**Implementation Notes**:
```javascript
// Layout.js - COMPOSITION APPROACH
import Header from './Header';
import Footer from './Footer';

export default function Layout({ children }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <>
      {!isLandingPage && <Header />} {/* Only show on non-landing pages */}
      <main>{children}</main>
      {!isLandingPage && <Footer />}
    </>
  );
}
```

**Testing Checklist**:
- [ ] Header appears on all pages except landing
- [ ] Header doesn't obscure existing content
- [ ] Z-index hierarchy preserved (no overlap with existing modals)
- [ ] Portal mount point works for modals
- [ ] No CLS (Cumulative Layout Shift) issues

**Preservation Checklist**:
- [ ] Existing Layout.js background functionality intact
- [ ] Dashboard renders correctly
- [ ] LobbyPage renders correctly
- [ ] PlayComputer and PlayMultiplayer load correctly

---

## 📋 PHASE 2: Authentication Gates (Days 2-3)

### PR-2: Auth Gate Modal & Route Guards
**Status**: ⬜ Not Started
**Risk Level**: 🔴 CRITICAL
**Files to Create**:
- [ ] `src/components/layout/AuthGateModal.jsx` - Modal component
- [ ] `src/utils/guards.js` - Route guard utility

**Files to Modify**:
- [ ] `src/App.js` - Add route guards to `/lobby` and `/play/multiplayer/:gameId`

**Implementation Notes**:
```javascript
// guards.js - PRESERVE EXISTING AUTH CONTEXT
import { useAuth } from '../contexts/AuthContext';
import AuthGateModal from '../components/layout/AuthGateModal';

export function requireAuth(element, reason) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) return <div>Loading...</div>;

  if (!isAuthenticated) {
    return <AuthGateModal
      reason={reason}
      returnTo={location.pathname + location.search}
    />;
  }

  return element;
}

// App.js - MINIMAL CHANGES
import { requireAuth } from './utils/guards';

<Route path="/lobby" element={requireAuth(<LobbyPage />, 'multiplayer')} />
<Route path="/play/multiplayer/:gameId" element={requireAuth(<PlayMultiplayer />, 'multiplayer')} />
```

**AuthGateModal - DO NOT INTERFERE WITH AUTH**:
```javascript
// AuthGateModal.jsx
export default function AuthGateModal({ reason, returnTo }) {
  const { login } = useAuth(); // Use EXISTING login function
  const navigate = useNavigate();

  const handleLoginSuccess = async (token) => {
    await login(token); // ✅ Existing function handles Echo init
    // Wait for Echo to initialize
    setTimeout(() => {
      navigate(returnTo || '/dashboard');
    }, 500); // Give Echo time to connect
  };

  // Rest of modal implementation
}
```

**Testing Checklist** (CRITICAL):
- [ ] Guest accessing `/lobby` shows AuthGateModal
- [ ] Guest accessing `/play/multiplayer/:gameId` shows AuthGateModal
- [ ] After login, WebSocket connects successfully
- [ ] Presence indicators work after auth gate login
- [ ] Challenge invitations work after auth gate login
- [ ] No duplicate Echo connections created
- [ ] `/play` (computer) remains accessible without auth

**Preservation Checklist** (CRITICAL):
- [ ] **WebSocket Events**: Test in Network tab (filter: WS)
  - [ ] `gameMove` events fire in multiplayer
  - [ ] `GameInvitationEvent` fires on challenge
  - [ ] Presence updates broadcast correctly
- [ ] **AuthContext Flow**:
  - [ ] Social login (Google, GitHub) works
  - [ ] Manual login works
  - [ ] Echo initializes exactly once on login
  - [ ] Token storage works correctly
- [ ] **Existing Routes**:
  - [ ] `/dashboard` loads correctly after login
  - [ ] `/lobby` loads correctly after auth gate
  - [ ] `/play` (computer) accessible without login

**Feature Flag**:
```bash
# .env
REACT_APP_AUTH_GATES_ENABLED=false # Start disabled, enable after testing
```

---

## 📋 PHASE 3: Landing Page Redesign (Day 3)

### PR-3: Landing Page CTA Refresh
**Status**: ⬜ Not Started
**Risk Level**: 🟢 LOW
**Files to Modify**:
- [ ] `src/pages/LandingPage.js` - Redesign CTAs and layout

**Implementation Notes**:
```javascript
// LandingPage.js - SAFE TO REDESIGN
export default function LandingPage() {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [showAuthGate, setShowAuthGate] = useState(false);

  return (
    <div className="landing-page">
      {/* Primary CTA */}
      <button onClick={() => navigate('/play')}>
        Play Computer Now
      </button>

      {/* Secondary CTAs */}
      {!isAuthenticated && (
        <>
          <button onClick={() => navigate('/login')}>Login</button>
          <button onClick={() => navigate('/login?signup=true')}>Sign Up</button>
        </>
      )}

      {/* Multiplayer Teaser */}
      <button onClick={() => {
        if (isAuthenticated) {
          navigate('/lobby');
        } else {
          setShowAuthGate(true);
        }
      }}>
        Play with Friends {!isAuthenticated && '(Login Required)'}
      </button>

      {showAuthGate && <AuthGateModal reason="multiplayer" />}
    </div>
  );
}
```

**Testing Checklist**:
- [ ] Guest: "Play Computer Now" → `/play` (no auth)
- [ ] Guest: "Play with Friends" → Shows AuthGateModal
- [ ] Guest: Login/Sign Up → `/login`
- [ ] Registered: "Play with Friends" → `/lobby` (direct)

**Preservation Checklist**:
- [ ] No impact on other pages
- [ ] Existing landing page assets preserved

---

## 📋 PHASE 4: Play Page Integration (Days 4-5)

### PR-4: PlayShell Component (Layout Only)
**Status**: ⬜ Not Started
**Risk Level**: 🔴 CRITICAL
**Files to Create**:
- [ ] `src/components/play/PlayShell.jsx` - Layout wrapper ONLY

**Files to Modify**:
- [ ] `src/components/play/PlayComputer.js` - WRAP ONLY (no logic changes)
- [ ] `src/components/play/PlayMultiplayer.js` - WRAP ONLY (no logic changes)

**Implementation Strategy** (CRITICAL):
```javascript
// PlayShell.jsx - PURE LAYOUT WRAPPER
export default function PlayShell({
  children, // Existing PlayComputer or PlayMultiplayer
  mode, // 'computer' or 'multiplayer'
  controls, // Control buttons from existing components
  sidePanel // Side panel from existing components
}) {
  return (
    <div className="play-shell">
      <div className="play-controls">{controls}</div>
      <div className="play-board">{children}</div>
      <div className="play-side-panel">{sidePanel}</div>
    </div>
  );
}

// PlayComputer.js - MINIMAL WRAPPER ONLY
import PlayShell from './PlayShell';

export default function PlayComputer() {
  // ✅ ALL EXISTING LOGIC STAYS HERE
  const [game] = useState(new Chess());
  const [fen, setFen] = useState(game.fen());
  const [stockfishWorker] = useState(() => new Worker('/stockfish.worker.js'));
  // ... ALL EXISTING STATE AND LOGIC ...

  // Extract components for PlayShell slots
  const controls = (
    <div>
      <button onClick={handleNewGame}>New Game</button>
      <button onClick={handleUndo}>Undo</button>
      {/* ALL EXISTING CONTROLS */}
    </div>
  );

  const sidePanel = (
    <div>
      <ScoreDisplay score={score} />
      {/* ALL EXISTING SIDE PANEL */}
    </div>
  );

  // Wrap in PlayShell (COMPOSITION ONLY)
  return (
    <PlayShell mode="computer" controls={controls} sidePanel={sidePanel}>
      {/* ✅ EXISTING CHESSBOARD COMPONENT */}
      <ChessBoard
        position={fen}
        onPieceDrop={onDrop}
        // ALL EXISTING PROPS
      />
    </PlayShell>
  );
}
```

**DO NOT CHANGE**:
- Stockfish worker initialization
- useEffect hooks for worker communication
- State management (game, fen, moveHistory)
- Sound effect triggers
- Move validation logic
- WebSocket event listeners (in PlayMultiplayer)

**Testing Checklist** (CRITICAL):
- [ ] **Play Computer**:
  - [ ] AI makes moves correctly
  - [ ] Stockfish worker communicates correctly
  - [ ] Sound effects play (move, check, game end)
  - [ ] Undo button works
  - [ ] Score display updates
  - [ ] New game resets correctly
- [ ] **Play Multiplayer**:
  - [ ] WebSocket events fire correctly (`gameMove`, `gameEnded`)
  - [ ] Opponent moves appear in real-time
  - [ ] Polling fallback works when WebSocket disabled
  - [ ] Resign/draw buttons work
  - [ ] Timer synchronizes correctly

**Preservation Checklist** (CRITICAL):
- [ ] **Stockfish Communication**:
  - [ ] Worker messages sent correctly
  - [ ] Best move responses received
  - [ ] Evaluation scores updated
- [ ] **WebSocket Events** (PlayMultiplayer):
  - [ ] Network tab shows WS connection active
  - [ ] `gameMove` events received
  - [ ] Move updates sync correctly
- [ ] **Sound Effects**:
  - [ ] Move sound plays
  - [ ] Check sound plays
  - [ ] Game end sound plays

**Feature Flag**:
```bash
# .env
REACT_APP_USE_PLAY_SHELL=false # Start disabled
```

---

## 📋 PHASE 5: Lobby Tabs & Challenge (Days 6-7)

### PR-5: Lobby Component Refactor (UI Only)
**Status**: ⬜ Not Started
**Risk Level**: 🟠 MEDIUM
**Files to Create**:
- [ ] `src/components/lobby/LobbyTabs.jsx`
- [ ] `src/components/lobby/PlayersList.jsx`
- [ ] `src/components/lobby/InvitationsList.jsx`
- [ ] `src/components/lobby/ActiveGamesList.jsx`
- [ ] `src/components/lobby/ChallengePopover.jsx`

**Files to Modify**:
- [ ] `src/pages/LobbyPage.js` - EXTRACT TO COMPONENTS (preserve data fetching)

**Implementation Strategy**:
```javascript
// LobbyPage.js - PRESERVE DATA FETCHING LOGIC
export default function LobbyPage() {
  // ✅ ALL EXISTING STATE AND POLLING LOGIC
  const [players, setPlayers] = useState([]);
  const [invitations, setInvitations] = useState([]);

  // ✅ PRESERVE EXISTING POLLING INTERVALS
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPendingInvitations();
    }, 5000); // Keep existing 5s interval
    return () => clearInterval(interval);
  }, []);

  // ✅ PRESERVE PRESENCE SERVICE
  useEffect(() => {
    presenceService.startTracking();
    return () => presenceService.stopTracking();
  }, []);

  // Render with new tab structure (UI ONLY)
  return (
    <LobbyTabs>
      <TabPanel label="Players">
        <PlayersList
          players={players}
          onChallenge={handleChallenge} // ✅ Existing function
        />
      </TabPanel>
      <TabPanel label="Invitations">
        <InvitationsList
          invitations={invitations}
          onAccept={handleAccept} // ✅ Existing function
        />
      </TabPanel>
    </LobbyTabs>
  );
}
```

**DO NOT CHANGE**:
- Polling intervals (5s, 10s)
- Presence service integration
- WebSocket event listeners
- API endpoints (`/invitations/pending`, etc.)
- Challenge acceptance flow

**Testing Checklist** (CRITICAL):
- [ ] **Real-Time Updates**:
  - [ ] Player list updates when users come online
  - [ ] Invitations appear in real-time
  - [ ] Active games list updates
- [ ] **Challenge Flow**:
  - [ ] Send challenge → WebSocket event fires
  - [ ] Receive challenge → Invitation appears
  - [ ] Accept challenge → Game starts correctly
- [ ] **Presence System**:
  - [ ] Online status indicators accurate
  - [ ] Busy/In-game status shows correctly

**Preservation Checklist** (CRITICAL):
- [ ] **WebSocket Events**:
  - [ ] `GameInvitationEvent` received
  - [ ] Challenge broadcasts work
  - [ ] Acceptance broadcasts work
- [ ] **Polling Intervals**:
  - [ ] 5s interval for pending invitations
  - [ ] 10s interval for accepted invitations
- [ ] **Presence Service**:
  - [ ] Tracking starts correctly
  - [ ] Status updates broadcast

---

## 📋 PHASE 6: Dashboard & Resume (Day 8)

### PR-6: Dashboard Primary Card & Resume Button
**Status**: ⬜ Not Started
**Risk Level**: 🟡 MEDIUM
**Files to Create**:
- [ ] `src/hooks/useActiveGame.js`

**Files to Modify**:
- [ ] `src/components/Dashboard.js` - UI changes only
- [ ] `src/components/layout/Header.jsx` - Add Resume button

**Implementation Strategy**:
```javascript
// useActiveGame.js - USE EXISTING CONTEXT
import { useAppData } from '../contexts/AppDataContext';

export function useActiveGame() {
  const { getGameHistory } = useAppData();
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    // ✅ USE EXISTING CACHE (don't force refresh)
    getGameHistory(false)
      .then(games => {
        const active = games.find(g => g.status === 'in_progress');
        setActiveGame(active);
      });
  }, []);

  return activeGame;
}

// Header.jsx - ADD RESUME BUTTON
import { useActiveGame } from '../../hooks/useActiveGame';

export default function Header() {
  const activeGame = useActiveGame();
  const navigate = useNavigate();

  return (
    <header>
      {/* Existing header content */}
      {activeGame && (
        <button onClick={() => navigate(`/play/multiplayer/${activeGame.id}`)}>
          Resume Game
        </button>
      )}
    </header>
  );
}
```

**DO NOT CHANGE**:
- AppDataContext cache logic
- Game history API endpoints
- Dashboard data fetching

**Testing Checklist**:
- [ ] Resume button appears when active game exists
- [ ] Resume button navigates to correct game
- [ ] Dashboard primary card shows correct state
- [ ] No duplicate API calls (verify in Network tab)

**Preservation Checklist**:
- [ ] **Cache Behavior**:
  - [ ] No forced cache invalidation
  - [ ] In-flight request deduplication works
  - [ ] Dashboard and GameHistory share cache correctly

---

## 📋 PHASE 7: Telemetry (Days 9-10)

### PR-7: Analytics Events
**Status**: ⬜ Not Started
**Risk Level**: 🟢 LOW
**Files to Create**:
- [ ] `src/utils/analytics.js`

**Files to Modify**:
- [ ] Various components to add `track()` calls

**Implementation Strategy**:
```javascript
// analytics.js
export const track = (event, payload) => {
  if (window.gtag) {
    window.gtag('event', event, payload);
  }

  // Dev logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[Analytics]', event, payload);
  }
};

// Usage in components (NON-INVASIVE)
import { track } from '../utils/analytics';

// In AuthGateModal.jsx
const handleLoginClick = () => {
  track('auth_gate_action', { action: 'login', reason });
  // Continue with existing login flow
};
```

**Testing Checklist**:
- [ ] Events fire in development console
- [ ] No performance impact
- [ ] No errors if gtag not available

**Preservation Checklist**:
- [ ] No impact on existing functionality
- [ ] Analytics calls are non-blocking

---

## 🎯 SUCCESS CRITERIA

### Functional Requirements
- [ ] Guest can play computer game in 1 click from landing
- [ ] Guest sees auth gate when accessing multiplayer features
- [ ] Registered user can challenge opponent in ≤2 clicks
- [ ] Resume button appears globally when active game exists
- [ ] Header never obscures content
- [ ] All existing WebSocket functionality works

### Technical Requirements
- [ ] Zero test failures
- [ ] Zero console errors
- [ ] No performance regression
- [ ] CLS score <0.1
- [ ] All feature flags work correctly

### Critical Preservation Requirements
- [ ] ✅ WebSocket events (moves, challenges, presence)
- [ ] ✅ Stockfish AI analysis
- [ ] ✅ Authentication flow (social + manual)
- [ ] ✅ Polling fallback
- [ ] ✅ Sound effects
- [ ] ✅ Game state synchronization

---

## 📊 PROGRESS TRACKING

### Overall Progress: 0% Complete (0/7 PRs)

| PR | Phase | Status | Risk | Progress |
|----|-------|--------|------|----------|
| PR-1 | Foundation | ⬜ Not Started | 🟠 MEDIUM | 0% |
| PR-2 | Auth Gates | ⬜ Not Started | 🔴 CRITICAL | 0% |
| PR-3 | Landing Page | ⬜ Not Started | 🟢 LOW | 0% |
| PR-4 | PlayShell | ⬜ Not Started | 🔴 CRITICAL | 0% |
| PR-5 | Lobby Tabs | ⬜ Not Started | 🟠 MEDIUM | 0% |
| PR-6 | Dashboard | ⬜ Not Started | 🟡 MEDIUM | 0% |
| PR-7 | Telemetry | ⬜ Not Started | 🟢 LOW | 0% |

---

## 📝 NOTES & LEARNINGS

### Decisions Made
- None yet

### Issues Encountered
- None yet

### Optimization Opportunities
- None yet

---

## 🚨 ROLLBACK PROCEDURES

### If WebSocket Breaks
1. Set `REACT_APP_AUTH_GATES_ENABLED=false`
2. Revert PR-2
3. Investigate Echo connection issues
4. Re-test with isolated changes

### If Stockfish Breaks
1. Set `REACT_APP_USE_PLAY_SHELL=false`
2. Revert PR-4
3. Test worker communication in isolation
4. Re-integrate with minimal changes

### If Multiplayer Breaks
1. Set `REACT_APP_USE_PLAY_SHELL=false`
2. Revert PR-4
3. Verify WebSocket events in Network tab
4. Re-test with feature flag

---

**Last Updated**: 2025-10-06
**Next Review**: After each PR merge
