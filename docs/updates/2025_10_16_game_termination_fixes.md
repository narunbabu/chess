# Game Termination Fixes - 2025-10-16

## Issues Fixed

### 1. Removed "Forfeit Game" Button ✅
**Problem**: Users had a manual "Forfeit Game" button which created confusion about when to use it vs Resign.

**Solution**: Removed the forfeit button completely from PlayMultiplayer.js (line 1705-1716 and handleKillGame function).

**Reasoning**: Forfeit should ONLY happen automatically on timeout, not as a user action. Users who want to give up can use the Resign button instead.

---

### 2. Fixed Timeout Handling ✅
**Problem**: When a player's timer reached 00:00, the game showed "finished" status but didn't display the end card modal, leaving the game stuck.

**Solution**:
- Updated `timerUtils.js` to pass `who` parameter ('player' or 'opponent') to `onFlag` callback
- Modified `handleTimerFlag` in PlayMultiplayer.js to call `wsService.forfeitGame('timeout')`
- Updated backend to accept and use the `reason` parameter ('timeout' vs 'forfeit')
- Backend now broadcasts gameEnd event with correct winner/loser information

**Files Changed**:
- `/chess-frontend/src/utils/timerUtils.js:49, 57` - Pass who parameter
- `/chess-frontend/src/components/play/PlayMultiplayer.js:125-169` - Call forfeitGame on timeout
- `/chess-frontend/src/services/WebSocketGameService.js:1155-1183` - Add forfeitGame method
- `/chess-backend/app/Http/Controllers/WebSocketController.php:667-668` - Accept reason parameter
- `/chess-backend/app/Services/GameRoomService.php:815, 838, 843` - Use reason parameter

---

### 3. Changed "Opponent" to "Rival" ✅
**Problem**: Long text "Opponent" was causing button size issues due to length.

**Solution**: Changed all default "Opponent" text to "Rival" throughout the application.

**Files Changed**:
- `/chess-frontend/src/components/play/GameContainer.js:47`
- `/chess-frontend/src/components/play/PlayMultiplayer.js:39, 403, 410, 1227`

---

## Game Termination Types (Clarified)

### Automatic (No User Action Needed)
1. **Timeout** → Player with 00:00 loses, opponent wins immediately
   - Frontend detects timer reaching 0
   - Calls `forfeitGame('timeout')`
   - Server determines winner (opponent of timed-out player)
   - Broadcasts gameEnd event
   - Both players see correct Victory/Defeat modal

2. **Inactivity** → Game pauses, can be resumed
   - Already handled via PresenceConfirmationDialog
   - Game status: 'paused'
   - Resumable via resume request flow

### User-Initiated
1. **Resign** → "I give up" button
   - Player admits defeat → Opponent wins immediately
   - No consent needed from opponent
   - STATUS: ✅ Implemented

2. **Draw Offer** → "Let's call it a draw" button
   - Player offers draw → Opponent can Accept/Decline
   - If accepted: Game ends as draw
   - If declined: Game continues
   - STATUS: ⚠️ NOT IMPLEMENTED (see below)

---

## Draw Offer Implementation Needed ⚠️

### Current Status
Draw Offer functionality does NOT exist. The backend supports `draw_agreed` as an end_reason, but there are no endpoints or UI for it.

### What Needs to Be Implemented

#### Backend (Laravel)
1. **Create Routes** (`routes/api.php`):
   ```php
   Route::post('/games/{gameId}/draw/offer', [WebSocketController::class, 'offerDraw']);
   Route::post('/games/{gameId}/draw/accept', [WebSocketController::class, 'acceptDraw']);
   Route::post('/games/{gameId}/draw/decline', [WebSocketController::class, 'declineDraw']);
   ```

2. **Controller Methods** (`WebSocketController.php`):
   - `offerDraw()` - Store draw offer in cache (5 min expiry), broadcast to opponent
   - `acceptDraw()` - Update game status to finished with draw result
   - `declineDraw()` - Remove draw offer from cache, broadcast decline

3. **Broadcast Events**:
   - `DrawOfferSent` - Notify opponent of draw offer
   - `DrawOfferAccepted` - Notify both players, end game
   - `DrawOfferDeclined` - Notify offering player

#### Frontend (React)
1. **WebSocketGameService.js**:
   ```javascript
   async offerDraw() { /* POST to /draw/offer */ }
   async acceptDraw() { /* POST to /draw/accept */ }
   async declineDraw() { /* POST to /draw/decline */ }
   ```

2. **PlayMultiplayer.js**:
   - Add `[drawOfferPending, setDrawOfferPending]` state
   - Add `handleOfferDraw()` function
   - Add `handleAcceptDraw()` function
   - Add `handleDeclineDraw()` function
   - Listen to WebSocket events: `draw.offer.sent`, `draw.offer.accepted`, `draw.offer.declined`

3. **UI Components**:
   - "Offer Draw" button (when no draw offer pending)
   - Draw offer notification modal (when opponent offers draw)
   - Accept/Decline buttons in modal

### Implementation Priority
**Medium** - Draw offers are a standard chess feature but not critical for MVP. Implement after core gameplay is stable.

---

## Testing Checklist

### Timeout Scenarios
- [ ] Player's timer reaches 00:00 → Shows "Defeat" modal for player
- [ ] Player's timer reaches 00:00 → Shows "Victory" modal for opponent
- [ ] Timeout result shows "X wins by timeout" text
- [ ] Game properly saves to history with timeout reason
- [ ] Refresh after timeout shows finished game, not stuck state

### Resign Flow
- [ ] Resign button only visible when game is active
- [ ] Resign shows confirmation dialog
- [ ] After resign, opponent sees Victory modal
- [ ] Resigning player sees Defeat modal
- [ ] Game history shows resignation reason

### UI Text
- [ ] "Rival" displays correctly in all locations
- [ ] No "Opponent" text remains in UI
- [ ] Button sizes are consistent

---

## Summary

**Fixed Issues**:
1. ✅ Removed manual Forfeit button - only automatic timeout now
2. ✅ Fixed timeout game ending - proper Victory/Defeat modals
3. ✅ Changed "Opponent" to "Rival" for brevity
4. ✅ Backend correctly sets winner_user_id for timeout/forfeit
5. ✅ Frontend correctly displays Victory for winner, Defeat for loser

**Remaining Work**:
1. ⚠️ Implement Draw Offer functionality (backend + frontend)
2. ⚠️ Add comprehensive testing for all game termination scenarios

**Game Termination Options (Current)**:
- Automatic: Timeout (loss for timed-out player)
- Automatic: Inactivity (game pauses, resumable)
- User-initiated: Resign (immediate loss for resigning player)
- User-initiated: Draw Offer (NOT IMPLEMENTED - needs to be built)
