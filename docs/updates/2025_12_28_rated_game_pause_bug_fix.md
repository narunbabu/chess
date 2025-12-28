# Rated Game Pause Bug Fix

**Date**: December 28, 2025
**Status**: ✅ Complete - Ready for Testing
**Issue**: Rated games were incorrectly pausing due to inactivity instead of letting clock run

---

## Problem Summary

### User Report
When a user tried to navigate away from a rated game:
1. ✅ Navigation warning appeared correctly
2. ✅ "Pause Game & Navigate" button clicked
3. ✅ "Cannot pause rated games" error shown correctly
4. ❌ **BUG**: If user went inactive, game paused instead of continuing clock

### Root Cause

**Backend Issue** (`GameRoomService.php:1154`):
```php
// WRONG - Allowed pausing rated games for 'inactivity' and 'beforeunload' reasons
if ($game->game_mode === 'rated' && $reason !== 'inactivity' && $reason !== 'beforeunload') {
    return ['success' => false, 'message' => 'Rated games cannot be paused manually'];
}
```

**Frontend Issue** (`PlayMultiplayer.js`):
1. **Line 1991**: Inactivity detection didn't check for rated games before showing presence dialog
2. **Lines 4343 & 4881**: `onCloseTimeout` callbacks didn't check for rated games before calling `pauseGame()`

### The Flow That Caused The Bug

1. User in rated game tries to navigate → blocked correctly ✅
2. User goes inactive for 60 seconds
3. Presence confirmation dialog appears (shouldn't happen in rated games) ❌
4. Dialog timeout fires after 30 seconds
5. `onCloseTimeout` calls `wsService.pauseGame()` without checking game mode ❌
6. Backend receives pause request with reason 'inactivity'
7. Backend check: `reason !== 'inactivity'` is FALSE, so pause is allowed ❌
8. Rated game gets paused incorrectly ❌

---

## Solution

### Design Decision: Rated Games Should NEVER Pause

**Principle**: In competitive rated games, if a player is inactive, they should **lose on time**, not pause.

This matches standard chess behavior:
- Chess.com: No pausing in rated games
- Lichess: No pausing in rated games
- Over-the-board tournaments: Clock runs continuously

---

## Changes Made

### 1. Backend Fix: Strict Rated Game Pause Prevention

**File**: `chess-backend/app/Services/GameRoomService.php`
**Lines**: 1153-1160

**Before** (WRONG):
```php
// Check game mode - rated games cannot be paused manually
if ($game->game_mode === 'rated' && $reason !== 'inactivity' && $reason !== 'beforeunload') {
    return [
        'success' => false,
        'message' => 'Rated games cannot be paused manually'
    ];
}
```

**After** (CORRECT):
```php
// Check game mode - rated games CANNOT be paused under ANY circumstance
// Players who abandon rated games should lose on time, not pause
if ($game->game_mode === 'rated') {
    return [
        'success' => false,
        'message' => 'Rated games cannot be paused. Players must complete the game or resign.'
    ];
}
```

**What Changed**:
- Removed exception for 'inactivity' and 'beforeunload' reasons
- Rated games can NEVER be paused, regardless of reason
- Improved error message clarity

---

### 2. Frontend Fix: Prevent Presence Dialog in Rated Games

#### A. Inactivity Detection (Don't Show Dialog)

**File**: `chess-frontend/src/components/play/PlayMultiplayer.js`
**Lines**: 1991-2004

**Before** (WRONG):
```javascript
if (inactiveDuration >= 60 && !showPresenceDialogRef.current && !isPausingRef.current) {
  console.log('[Inactivity] Opening presence dialog...');
  setShowPresenceDialog(true);
  showPresenceDialogRef.current = true;
}
```

**After** (CORRECT):
```javascript
if (inactiveDuration >= 60 && !showPresenceDialogRef.current && !isPausingRef.current) {
  // RATED GAMES: Do NOT show presence dialog - let clock run and player loses on time
  if (ratedMode === 'rated') {
    console.log('[Inactivity] RATED game - skipping presence dialog, player will lose on time if inactive');
    return;
  }

  console.log('[Inactivity] Opening presence dialog...');
  setShowPresenceDialog(true);
  showPresenceDialogRef.current = true;
}
```

**What Changed**:
- Added check for `ratedMode === 'rated'`
- If rated game: Skip dialog, let clock run
- If casual game: Show dialog as before

---

#### B. Dialog Timeout Callback (Defensive Check)

**File**: `chess-frontend/src/components/play/PlayMultiplayer.js`
**Lines**: 4343-4352 (first instance) & 4881-4890 (second instance)

**Before** (WRONG):
```javascript
onCloseTimeout={async () => {
  console.log('[PresenceConfirmationDialogSimple] Timeout - pausing game');

  // Set presence lock to prevent dialog re-opening during pause attempt
  isPausingRef.current = true;

  try {
    const timeData = getTimeData();
    const pauseResult = await wsService.current?.pauseGame(timeData);
    // ...
```

**After** (CORRECT):
```javascript
onCloseTimeout={async () => {
  console.log('[PresenceConfirmationDialogSimple] Timeout - attempting to pause game');

  // RATED GAMES: NEVER pause - player should lose on time
  if (ratedMode === 'rated') {
    console.log('[PresenceConfirmationDialogSimple] 🚫 RATED game - cannot pause, closing dialog');
    setShowPresenceDialog(false);
    showPresenceDialogRef.current = false;
    return;
  }

  // Set presence lock to prevent dialog re-opening during pause attempt
  isPausingRef.current = true;

  try {
    const timeData = getTimeData();
    const pauseResult = await wsService.current?.pauseGame(timeData);
    // ...
```

**What Changed**:
- Added defensive check for `ratedMode === 'rated'`
- If rated game: Close dialog without pausing
- Prevents pause even if dialog somehow appears

---

#### C. Dependency Array Update

**File**: `chess-frontend/src/components/play/PlayMultiplayer.js`
**Line**: 2017

**Before**:
```javascript
}, [gameInfo.status, showPresenceDialog, showPausedGame, isWaitingForResumeResponse]);
```

**After**:
```javascript
}, [gameInfo.status, showPresenceDialog, showPausedGame, isWaitingForResumeResponse, ratedMode]);
```

**What Changed**:
- Added `ratedMode` to dependencies since it's now used in the effect

---

## Files Modified

### Backend (1 file)
1. `chess-backend/app/Services/GameRoomService.php`
   - Removed inactivity/beforeunload exception for rated game pausing
   - Lines: 1153-1160

### Frontend (1 file)
1. `chess-frontend/src/components/play/PlayMultiplayer.js`
   - Prevent inactivity dialog from appearing in rated games (Lines: 1991-2004)
   - Add defensive check in dialog timeout callback - Instance 1 (Lines: 4343-4352)
   - Add defensive check in dialog timeout callback - Instance 2 (Lines: 4881-4890)
   - Update useEffect dependency array (Line: 2017)

---

## Testing Guide

### Test Scenario 1: Casual Game Inactivity (Should Pause)

**Steps**:
1. Start a casual game (game_mode = 'casual')
2. Make a move and wait for opponent to respond
3. Go inactive for 60 seconds (don't interact with game)
4. **Expected**: Presence confirmation dialog appears after 60s
5. Don't respond to dialog (wait 30s for timeout)
6. **Expected**: Game pauses automatically
7. **Verify**: "Game has been paused due to inactivity" dialog shows
8. **Verify**: Game status changes to 'paused'

**✅ Success Criteria**:
- Presence dialog appears at 60s inactivity
- Game pauses after dialog timeout
- Resume button is available

---

### Test Scenario 2: Rated Game Inactivity (Should Continue Clock)

**Steps**:
1. Start a rated game (game_mode = 'rated')
2. Confirm you understand rated game rules
3. Make a move and wait for opponent to respond
4. Go inactive for 60 seconds (don't interact with game)
5. **Expected**: No presence confirmation dialog appears
6. Continue to stay inactive
7. **Expected**: Clock continues running
8. Wait until your time expires
9. **Expected**: Game ends with time loss

**✅ Success Criteria**:
- No presence dialog appears (dialog is skipped)
- Clock keeps running during inactivity
- If time runs out → game ends in loss
- No paused game state at any point

---

### Test Scenario 3: Rated Game Navigation Attempt

**Steps**:
1. Start a rated game (game_mode = 'rated')
2. Try to navigate to dashboard (click Dashboard in nav)
3. **Expected**: Navigation warning appears
4. Click "⏸️ Pause Game & Navigate"
5. **Expected**: Rated game warning appears:
   ```
   ⚠️ RATED GAME WARNING
   You cannot pause a rated game!
   If you pause or exit, you will FORFEIT this game and it will count as a LOSS.
   Do you want to resign and forfeit this game?
   ```
6. Click "🔄 Stay in Game"
7. **Expected**: Warning closes, game continues
8. Try navigation again, click "🏳️ Forfeit & Leave"
9. **Expected**: Game is resigned, navigation proceeds

**✅ Success Criteria**:
- Navigation warning appears (first dialog)
- Rated game warning appears (second dialog)
- No pause occurs at any point
- Only resignation allows navigation

---

### Test Scenario 4: Backend Validation

**Backend Logs to Check**:
1. Start rated game, try to pause via API
2. **Expected Log**: "Rated games cannot be paused. Players must complete the game or resign."
3. Check response: `{ success: false, message: "..." }`
4. Verify game status remains 'active', not 'paused'

**API Test**:
```bash
curl -X POST http://localhost:8000/api/websocket/games/{game_id}/pause \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"white_time_ms": 600000, "black_time_ms": 600000}'
```

**Expected Response**:
```json
{
  "success": false,
  "message": "Rated games cannot be paused. Players must complete the game or resign."
}
```

---

## Verification Checklist

- [ ] **Backend Validation**: Rated game pause API returns error
- [ ] **Casual Inactivity**: Presence dialog appears and pauses game
- [ ] **Rated Inactivity**: No dialog appears, clock continues
- [ ] **Rated Navigation**: Warning shows, pause blocked, only resignation works
- [ ] **Time Loss**: Inactive rated player loses on time (no pause)
- [ ] **Logs**: Console shows correct skip messages for rated games
- [ ] **Database**: No rated games with status='paused' after inactivity

---

## Success Criteria

✅ **Rated Game Behavior**:
1. No presence dialog appears during inactivity
2. Clock runs continuously (no pausing)
3. Player loses on time if inactive too long
4. Navigation attempts show forfeit warning
5. Only resignation or completion allows leaving

✅ **Casual Game Behavior** (Unchanged):
1. Presence dialog appears after 60s inactivity
2. Game pauses on dialog timeout
3. Resume button available
4. Pause/resume works normally

✅ **Backend Protection**:
1. Rated games cannot be paused via API (any reason)
2. Clear error messages returned
3. Game status remains 'active' during inactivity

---

## Technical Details

### Rated Game Flow - Inactivity Scenario

**Before Fix** (WRONG):
```
1. Rated game active
2. User inactive 60s → Presence dialog shows ❌
3. Dialog timeout → pauseGame() called ❌
4. Backend: reason='inactivity' → Pause allowed ❌
5. Game paused ❌
```

**After Fix** (CORRECT):
```
1. Rated game active
2. User inactive 60s → Check ratedMode → Skip dialog ✅
3. Clock continues running ✅
4. Time expires → Game ends in loss ✅
5. No pause state ✅
```

---

### Defensive Programming

**Multiple Layers of Protection**:
1. **Layer 1**: Frontend - Don't show dialog for rated games
2. **Layer 2**: Frontend - Defensive check in dialog timeout
3. **Layer 3**: Backend - Reject all pause attempts for rated games

**Why Multiple Layers**:
- Frontend check prevents dialog (primary)
- Frontend timeout check prevents accidental pause (secondary)
- Backend validation prevents API abuse (final defense)

---

## Edge Cases Handled

### Edge Case 1: Manual Pause Attempt
**Scenario**: User tries to manually pause rated game via button
**Current**: GameControls.js already handles this (lines 115-122)
**Behavior**: No pause button shown for rated games ✅

### Edge Case 2: Browser Navigation
**Scenario**: User tries to close tab or navigate via browser
**Current**: GameNavigationContext handles this
**Behavior**: beforeunload warning shows, game continues ✅

### Edge Case 3: Network Disconnect
**Scenario**: User loses network connection
**Current**: Separate disconnect handling
**Behavior**: Game continues, reconnection allowed ✅

### Edge Case 4: API Direct Call
**Scenario**: Malicious user calls pause API directly
**Current**: Backend validation (Layer 3)
**Behavior**: API returns error, no pause ✅

---

## Performance Impact

- ✅ **Minimal**: Only adds conditional checks (no API calls)
- ✅ **Efficient**: Early return prevents unnecessary processing
- ✅ **No overhead**: Rated games skip entire dialog flow
- ✅ **Logs**: Clear debug messages for troubleshooting

---

## Security Considerations

- ✅ **No bypass**: Backend enforces rule regardless of frontend
- ✅ **API protected**: Direct API calls also blocked
- ✅ **Consistent**: All pause paths check game mode
- ✅ **Clear messages**: User understands rated game rules

---

## Backward Compatibility

- ✅ **Existing casual games**: Behavior unchanged
- ✅ **Existing rated games**: Now correctly prevent pausing
- ✅ **Database**: No migration needed
- ✅ **API**: Backward compatible (stricter validation)

---

## Rollback Plan

If issues occur, revert these changes:

**Backend**:
```bash
git checkout HEAD~1 chess-backend/app/Services/GameRoomService.php
```

**Frontend**:
```bash
git checkout HEAD~1 chess-frontend/src/components/play/PlayMultiplayer.js
```

**Alternative**: Remove rated mode check conditions, restore original behavior

---

## Status: Ready for End-to-End Testing

All implementation tasks complete:
- ✅ Backend pause validation fixed
- ✅ Frontend inactivity detection updated
- ✅ Frontend dialog timeout callbacks protected
- ✅ Dependencies updated correctly
- ✅ Documentation complete

**Next Step**: Follow the testing guide above to validate the complete flow.

---

**Implementation Complete**: ✅
**Ready for Testing**: ✅
**Production Ready**: ⏳ (After testing)
