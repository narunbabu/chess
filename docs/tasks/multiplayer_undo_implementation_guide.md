# Multiplayer Undo Implementation Guide

**Date:** 2025-12-10
**Difficulty:** Medium-High (⭐⭐⭐⭐☆)
**Estimated Effort:** 8-12 hours for full implementation

## Overview

This guide outlines the implementation of an undo functionality for human-to-human multiplayer games in PlayMultiplayer.js, similar to the successfully implemented undo feature in PlayComputer.js but adapted for the unique requirements of multiplayer gameplay.

## Key Differences: Computer Play vs Multiplayer

### Computer Play (Existing)
- **Unilateral decision** - Player can undo without permission
- **Local state** - Game state managed entirely on frontend
- **2-move undo** - Undoes both player's last move and computer's response
- **Difficulty-based chances** - Limited undo chances based on computer level
- **Immediate execution** - No waiting for approval

### Multiplayer (To Implement)
- **Bilateral agreement** - Both players must consent to undo
- **Server synchronization** - Game state on server, requires backend support
- **1-move undo** - Undoes only the last move made
- **Request-response protocol** - Initiating player requests, opponent accepts/declines
- **Real-time notification** - Opponent notified via WebSocket

## Complexity Assessment

### Technical Challenges
1. **Backend Integration** ⭐⭐⭐⭐
   - Requires new endpoints and WebSocket events
   - Server-side move history rollback
   - State synchronization between players

2. **Opponent Agreement Protocol** ⭐⭐⭐⭐
   - Request/response flow similar to resume requests
   - Timeout handling for unanswered requests
   - Edge cases (disconnection, game state changes)

3. **Timer Synchronization** ⭐⭐⭐
   - Both players' timers need adjustment
   - Move timing calculations affected
   - Complexity similar to resume functionality

4. **Frontend State Management** ⭐⭐⭐
   - Game history reconstruction (reusable from PlayComputer)
   - Score adjustments for both players
   - UI state for pending requests

**Overall Difficulty:** Medium-High (comparable to pause/resume feature)

## Implementation Strategy

### Phase 1: Backend Foundation (4-5 hours)
**Priority:** CRITICAL - Must be completed first

#### 1.1 New API Endpoints

Create in `chess-backend/routes/websocket.php`:

```php
// Request to undo last move
POST /websocket/games/{game_id}/undo-request
- Validates requesting player's turn (must have just made a move)
- Stores undo request with timestamp
- Broadcasts to opponent via WebSocket
- Returns: { success, request_id, expires_at }

// Respond to undo request
POST /websocket/games/{game_id}/undo-response
- Validates opponent is authorized to respond
- If accepted: Rolls back last move in database
- Clears undo request state
- Broadcasts result to both players
- Returns: { success, accepted, new_game_state }
```

#### 1.2 WebSocket Events

Add in `chess-backend/app/Events/`:

```php
// UndoRequestEvent.php
- Event: '.undo.request'
- Payload: { requester_name, move_to_undo, expires_at }
- Broadcast to: Opponent only

// UndoResponseEvent.php
- Event: '.undo.response'
- Payload: { accepted, new_fen, new_turn, updated_history }
- Broadcast to: Both players
```

#### 1.3 Database Changes

Modify `games` table (if needed):
- Consider adding `undo_request_pending` column
- Store requester and expiry timestamp
- Or use in-memory/Redis for temporary state

### Phase 2: Frontend WebSocket Integration (2-3 hours)

#### 2.1 WebSocketGameService Updates

**File:** `chess-frontend/src/services/WebSocketGameService.js`

Add methods following existing patterns (similar to resume requests):

```javascript
/**
 * Request to undo last move (similar to requestResume)
 */
async requestUndo() {
  if (!this.isWebSocketConnected()) {
    throw new Error('WebSocket not connected');
  }

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      `${BACKEND_URL}/websocket/games/${this.gameId}/undo-request`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.getSocketId(),
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || 'Undo request failed');
    }

    console.log('✅ Undo request sent successfully:', data);
    this.emit('undoRequestSent', data);
    return data;
  } catch (error) {
    console.error('Failed to request undo:', error);
    throw error;
  }
}

/**
 * Respond to opponent's undo request (similar to respondToResumeRequest)
 */
async respondToUndoRequest(accepted) {
  if (!this.isWebSocketConnected()) {
    throw new Error('WebSocket not connected');
  }

  try {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(
      `${BACKEND_URL}/websocket/games/${this.gameId}/undo-response`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          socket_id: this.getSocketId(),
          accepted: accepted,
        }),
      }
    );

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || data.message || 'Undo response failed');
    }

    console.log('✅ Undo response sent successfully:', data);
    this.emit('undoResponseSent', { accepted, ...data });
    return data;
  } catch (error) {
    console.error('Failed to respond to undo request:', error);
    throw error;
  }
}
```

#### 2.2 Event Listeners Setup

In PlayMultiplayer.js `initializeGame()`, add listeners similar to resume events:

```javascript
// Inside wsService.current.initialize() callback
userChannel.listen('.undo.request', (event) => {
  console.log('📥 Undo request received:', event);
  handleUndoRequestReceived(event);
});

userChannel.listen('.undo.response', (event) => {
  console.log('📥 Undo response received:', event);
  handleUndoResponse(event);
});
```

### Phase 3: Frontend UI & State (2-3 hours)

#### 3.1 State Variables

**File:** `chess-frontend/src/components/play/PlayMultiplayer.js`

Add new state variables (around line 60):

```javascript
// Undo request state
const [undoRequestData, setUndoRequestData] = useState(null); // { requester, move, expires_at }
const [isWaitingForUndoResponse, setIsWaitingForUndoResponse] = useState(false); // Sent request
const [undoRequestCountdown, setUndoRequestCountdown] = useState(0); // Countdown timer
```

#### 3.2 Request Undo Handler

Add handler (similar to handleRequestResume around line 1000):

```javascript
const handleRequestUndo = useCallback(async () => {
  // Validation
  if (!gameHistory || gameHistory.length === 0) {
    setErrorMessage('No moves to undo');
    setShowError(true);
    return;
  }

  if (isWaitingForUndoResponse) {
    setErrorMessage('Undo request already pending');
    setShowError(true);
    return;
  }

  // Confirm with user
  const confirmed = window.confirm(
    'Request to undo your last move? Your opponent must approve.'
  );
  if (!confirmed) return;

  try {
    const data = await wsService.current.requestUndo();
    setIsWaitingForUndoResponse(true);
    setUndoRequestCountdown(30); // 30 second timeout

    // Start countdown timer
    const countdownInterval = setInterval(() => {
      setUndoRequestCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsWaitingForUndoResponse(false);
          setErrorMessage('Undo request timed out');
          setShowError(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

  } catch (error) {
    console.error('Failed to request undo:', error);
    setErrorMessage(error.message);
    setShowError(true);
  }
}, [gameHistory, isWaitingForUndoResponse]);
```

#### 3.3 Receive Undo Request Handler

```javascript
const handleUndoRequestReceived = useCallback((event) => {
  console.log('🔔 Received undo request from opponent:', event);

  setUndoRequestData({
    requester: event.requester_name,
    move: event.move_to_undo,
    expiresAt: event.expires_at
  });

  // Show confirmation dialog to opponent
  setShowNotification(true);
  setNotificationMessage(
    `${event.requester_name} wants to undo their last move (${event.move_to_undo})`
  );
}, []);
```

#### 3.4 Respond to Undo Request Handler

```javascript
const handleRespondToUndo = useCallback(async (accepted) => {
  try {
    const data = await wsService.current.respondToUndoRequest(accepted);

    if (accepted) {
      console.log('✅ Undo accepted, applying new game state');
      // Game state update handled by handleUndoResponse event
    } else {
      console.log('❌ Undo declined');
      setNotificationMessage('You declined the undo request');
      setShowNotification(true);
    }

    // Clear undo request dialog
    setUndoRequestData(null);

  } catch (error) {
    console.error('Failed to respond to undo:', error);
    setErrorMessage(error.message);
    setShowError(true);
  }
}, []);
```

#### 3.5 Handle Undo Response (Apply Changes)

```javascript
const handleUndoResponse = useCallback((event) => {
  console.log('📥 Processing undo response:', event);

  if (!event.accepted) {
    // Undo was declined
    setIsWaitingForUndoResponse(false);
    setUndoRequestCountdown(0);
    setErrorMessage('Opponent declined your undo request');
    setShowError(true);
    return;
  }

  // Undo was accepted - apply new game state
  try {
    // Update game with new FEN from server
    const newGame = new Chess();
    newGame.load(event.new_fen);
    setGame(newGame);

    // Update game history (remove last move)
    setGameHistory(prev => prev.slice(0, -1));

    // Update turn
    setGameInfo(prev => ({
      ...prev,
      turn: event.new_turn
    }));

    // Adjust scores if needed (remove last evaluation)
    const lastMove = gameHistory[gameHistory.length - 1];
    if (lastMove?.evaluation?.total) {
      const wasMyMove = lastMove.playerColor === myColor;
      if (wasMyMove) {
        setPlayerScore(prev => Math.max(0, prev - lastMove.evaluation.total));
      } else {
        setOpponentScore(prev => Math.max(0, prev - lastMove.evaluation.total));
      }
    }

    // Clear pending request state
    setIsWaitingForUndoResponse(false);
    setUndoRequestCountdown(0);
    setUndoRequestData(null);

    // Show success message
    setNotificationMessage('Move undone successfully!');
    setShowNotification(true);
    playSound(moveSoundEffect);

    console.log('✅ Undo applied successfully');
  } catch (error) {
    console.error('Error applying undo:', error);
    setErrorMessage('Failed to apply undo changes');
    setShowError(true);
  }
}, [gameHistory, myColor, playSound, moveSoundEffect]);
```

#### 3.6 UI Components

**Undo Request Button** (add to GameControls or create new component):

```javascript
{/* Undo Request Button - shown after player makes a move */}
{!isWaitingForUndoResponse && gameHistory.length > 0 && isMyTurn === false && (
  <button
    onClick={handleRequestUndo}
    disabled={gameInfo.status !== 'active'}
    style={{
      marginLeft: '10px',
      backgroundColor: '#f59e0b',
      color: 'white',
      padding: '8px 16px',
      border: 'none',
      borderRadius: '4px',
      cursor: 'pointer'
    }}
  >
    ↩️ Request Undo
  </button>
)}

{/* Waiting for undo response indicator */}
{isWaitingForUndoResponse && (
  <div style={{ marginTop: '10px', color: '#f59e0b' }}>
    Waiting for opponent's response... ({undoRequestCountdown}s)
  </div>
)}
```

**Undo Request Dialog** (for opponent - similar to PresenceConfirmationDialogSimple):

```javascript
{undoRequestData && (
  <div className="undo-request-overlay">
    <div className="undo-request-dialog">
      <h3>Undo Request</h3>
      <p>
        {undoRequestData.requester} wants to undo their last move:
        <br />
        <strong>{undoRequestData.move}</strong>
      </p>
      <div className="button-group">
        <button onClick={() => handleRespondToUndo(true)}>
          ✅ Accept
        </button>
        <button onClick={() => handleRespondToUndo(false)}>
          ❌ Decline
        </button>
      </div>
    </div>
  </div>
)}
```

### Phase 4: Testing & Edge Cases (1-2 hours)

#### Test Scenarios

1. **Basic Flow**
   - Player makes move
   - Player requests undo
   - Opponent accepts
   - Game state correctly rolled back

2. **Decline Flow**
   - Player requests undo
   - Opponent declines
   - Requester notified, game continues

3. **Timeout**
   - Player requests undo
   - No response within 30 seconds
   - Request expires, game continues

4. **Edge Cases**
   - Request undo when no moves made
   - Request undo when already pending
   - Opponent disconnects during request
   - Game ends during pending request
   - Multiple undo attempts

5. **Timer Synchronization**
   - Verify both player timers handled correctly
   - Check move timing calculations after undo

6. **Score Adjustments**
   - Verify scores correctly adjusted after undo
   - Test with captures and special moves

## Files to Modify

### Frontend (chess-frontend/src/)

1. **components/play/PlayMultiplayer.js** ✏️
   - Add undo state variables
   - Implement request/response handlers
   - Add UI for undo button and dialogs
   - Integrate with existing game state management

2. **services/WebSocketGameService.js** ✏️
   - Add `requestUndo()` method
   - Add `respondToUndoRequest(accepted)` method
   - Add event listeners setup

3. **components/play/GameControls.js** (Optional) ✏️
   - Could reuse existing undo button
   - Or add multiplayer-specific undo button

4. **components/play/UndoRequestDialog.js** (New) ➕
   - New component for opponent's confirmation dialog
   - Similar to resume request dialogs

### Backend (chess-backend/)

1. **routes/websocket.php** ✏️
   - Add `/websocket/games/{game_id}/undo-request` endpoint
   - Add `/websocket/games/{game_id}/undo-response` endpoint

2. **app/Http/Controllers/WebSocketGameController.php** ✏️
   - Add `undoRequest()` method
   - Add `undoResponse()` method
   - Implement move rollback logic

3. **app/Events/UndoRequestEvent.php** (New) ➕
   - WebSocket event for undo requests

4. **app/Events/UndoResponseEvent.php** (New) ➕
   - WebSocket event for undo responses

5. **database/migrations/** (Optional) ✏️
   - Add undo request tracking columns if needed
   - Or use in-memory state (Redis/cache)

## Reusable Code from PlayComputer.js

### Directly Reusable ✅

1. **GameControls.js undo button UI** - Visual elements and styling
2. **Sound effects** - moveSoundEffect, notification sounds
3. **Confirmation patterns** - Dialog UX patterns
4. **Game reconstruction from history** - Logic to rebuild Chess.js state

### Adaptable with Modifications 🔧

1. **getUndoChancesForLevel()** - Could remove for multiplayer (unlimited requests) or adapt
2. **Score adjustment logic** - Same concept, different implementation for multiplayer scores
3. **State management patterns** - Similar structure for undo state variables
4. **Validation checks** - Adapt for multiplayer context (server validation instead of local)

### Not Reusable ❌

1. **Computer move undo** - Multiplayer undoes only one move, not two
2. **Unilateral execution** - Multiplayer requires opponent agreement
3. **Local-only state** - Multiplayer requires server synchronization

## Implementation Checklist

### Backend
- [ ] Create `/undo-request` endpoint
- [ ] Create `/undo-response` endpoint
- [ ] Implement server-side move rollback logic
- [ ] Create `UndoRequestEvent` class
- [ ] Create `UndoResponseEvent` class
- [ ] Add validation logic (turn check, game state, etc.)
- [ ] Add database migration (if needed)
- [ ] Test endpoints with Postman/Thunder Client

### Frontend - WebSocket Layer
- [ ] Add `requestUndo()` to WebSocketGameService
- [ ] Add `respondToUndoRequest()` to WebSocketGameService
- [ ] Add `.undo.request` event listener
- [ ] Add `.undo.response` event listener
- [ ] Test WebSocket events in browser console

### Frontend - UI Layer
- [ ] Add undo state variables to PlayMultiplayer
- [ ] Implement `handleRequestUndo()`
- [ ] Implement `handleUndoRequestReceived()`
- [ ] Implement `handleRespondToUndo()`
- [ ] Implement `handleUndoResponse()`
- [ ] Create/adapt undo request button
- [ ] Create undo request dialog for opponent
- [ ] Add countdown timer display
- [ ] Add loading/pending states

### Testing
- [ ] Test basic undo flow (request → accept → rollback)
- [ ] Test decline flow
- [ ] Test timeout scenario
- [ ] Test with disconnections
- [ ] Test timer synchronization
- [ ] Test score adjustments
- [ ] Test edge cases (no moves, pending requests, etc.)
- [ ] Test in different browsers
- [ ] Test with slow network conditions

### Documentation
- [ ] Update API documentation
- [ ] Add code comments
- [ ] Create success story document
- [ ] Update user guide (if applicable)

## Risk Assessment

### High Risk Areas 🔴
- **Server state synchronization** - Critical to maintain consistency
- **Concurrent requests** - Handle race conditions (both players request simultaneously)
- **Timer calculations** - Must correctly adjust both timers

### Medium Risk Areas 🟡
- **WebSocket reliability** - Handle connection drops gracefully
- **User experience** - Clear messaging for all scenarios
- **Edge cases** - Comprehensive testing needed

### Low Risk Areas 🟢
- **UI components** - Can reuse existing patterns
- **Sound effects** - Straightforward integration
- **Local state** - Well-established patterns

## Alternative Approaches

### Option 1: Server-Managed Undo (Recommended) ⭐
- Server stores undo request state
- Full validation server-side
- More secure and reliable
- **Effort:** 8-12 hours

### Option 2: Client-Only with Server Validation
- Client manages undo request state
- Server validates and applies
- Lighter backend, more frontend complexity
- **Effort:** 6-8 hours

### Option 3: Automatic Undo (No Approval)
- Undo immediately executes
- Opponent notified after
- Controversial, less fair
- **Effort:** 4-6 hours

**Recommendation:** Option 1 provides the best balance of fairness, security, and user experience.

## Success Criteria

✅ Players can request to undo their last move
✅ Opponents receive real-time notification
✅ Opponents can accept or decline
✅ Game state correctly rolls back on acceptance
✅ Timers properly synchronized
✅ Scores correctly adjusted
✅ Clear UI feedback for all states
✅ Handles edge cases gracefully
✅ No duplicate or conflicting requests
✅ Works across page refreshes (request persistence)

## Conclusion

Implementing undo for multiplayer is moderately complex but achievable by following the established patterns from resume requests and adapting the undo logic from PlayComputer.js. The key challenges are:

1. Backend coordination and validation
2. Real-time opponent agreement protocol
3. State synchronization across clients
4. Timer and score adjustments

A medium-level developer familiar with the codebase should be able to implement this feature in 8-12 hours by following this guide systematically, starting with backend foundation and building up to the frontend integration.
