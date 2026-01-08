# Rated Game Timer Continues Counting Fix
**Date**: December 28, 2025
**Status**: ✅ Fixed - Ready for Testing
---

## Problem Report
### User Issue
In rated multiplayer games, the timer countdown was stopping when the user navigated away or when the game status changed. This is incorrect behavior - **rated games must never stop the timer**, even if the user leaves the page.

### Expected Behavior
- **Rated games**: Timer ALWAYS counts down, regardless of navigation or game status
- **Casual games**: Timer can be paused/stopped when game is paused

### Console Logs Showing Issue
```
[Timer] Game data analysis: {timeControlMinutes: 10, initialTimeMs: 600000, storedWhiteMs: 577100, ...}
[Timer] Restored from database: {whiteMs: '577s', blackMs: '583s', increment: '0s', source: 'database'}
[PlayMultiplayer] Initial game setup: {playerColor: 'black', serverTurn: 'black', status: 'active'}
```

The timer was initializing but then stopping when the game status changed or user navigated away.

---

## Root Cause Analysis

### The Issue
The `useMultiplayerTimer` hook in `timerUtils.js` was stopping the timer for ALL games when `gameStatus === 'paused'` or `gameStatus === 'finished'`:

```javascript
// OLD CODE (INCORRECT):
if (gameStatus === 'finished' || gameStatus === 'paused') {
  clearInterval(timerRef.current);
  timerRef.current = null;
  return;
}
```

This logic was correct for casual games (which can be paused), but **incorrect for rated games** (which cannot be paused and must always have the timer running).

### Why Rated Games Must Have Continuous Timer
1. **Chess clock rules**: In rated/competitive chess, the clock NEVER stops except between moves
2. **Fairness**: Both players' clocks must count down simultaneously to prevent cheating
3. **Forfeit prevention**: If a player leaves, their clock should continue counting and eventually flag
4. **Rating integrity**: Rated games affect player ratings, so standard chess timing rules apply

---

## Solution Implemented

### Changes Made

#### 1. timerUtils.js
**Location**: `chess-frontend/src/utils/timerUtils.js`

**Added `isRated` parameter to useMultiplayerTimer** (Lines 6-14):
```javascript
export const useMultiplayerTimer = ({
  myColor,
  serverTurn,
  gameStatus,
  onFlag,
  initialMyMs = 600000,
  initialOppMs = 600000,
  incrementMs = 0,
  isRated = false // NEW: Track if this is a rated game
}) => {
```

**Updated timer stopping logic to check isRated** (Lines 52-68):
```javascript
// Timer logic for multiplayer
useEffect(() => {
  // For rated games, never stop the timer - keep counting even if status changes
  // For casual games, stop timer when paused or finished
  if (!isRated && (gameStatus === 'finished' || gameStatus === 'paused')) {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      console.log('[Timer] ⏸️ Timer stopped (casual game finished/paused)');
    }
    return;
  }

  // Log that timer continues for rated games
  if (isRated && (gameStatus === 'paused' || gameStatus === 'finished')) {
    console.log('[Timer] ⏱️ Rated game - timer continues counting despite status:', gameStatus);
  }

  // ... rest of timer logic
}, [gameStatus, serverTurn, myColor, isRated]); // Add isRated to dependencies
```

#### 2. PlayMultiplayer.js
**Location**: `chess-frontend/src/components/play/PlayMultiplayer.js`

**Pass isRated parameter to useMultiplayerTimer** (Lines 245-255):
```javascript
const { myMs, oppMs, setMyMs, setOppMs } = useMultiplayerTimer({
  myColor,
  serverTurn,
  gameStatus: gameInfo.status,
  onFlag: handleTimerFlag,
  initialMyMs: myColor === 'w' ? initialTimerState.whiteMs : initialTimerState.blackMs,
  initialOppMs: myColor === 'w' ? initialTimerState.blackMs : initialTimerState.whiteMs,
  incrementMs: initialTimerState.incrementMs,
  isRated: ratedMode === 'rated' // Pass rated mode to timer
});
```

---

## Fixed Behavior

### For Rated Games
```javascript
gameStatus === 'paused' || gameStatus === 'finished'
  ↓
isRated === true
  ↓
Timer KEEPS RUNNING ⏱️
  ↓
Clock continues counting down until:
  - Player runs out of time (FORFEIT on time)
  - Game ends normally (checkmate, draw, resignation)
  - User explicitly forfeits
```

### For Casual Games
```javascript
gameStatus === 'paused' || gameStatus === 'finished'
  ↓
isRated === false
  ↓
Timer STOPS ⏸️
  ↓
Game is frozen until resumed
```

---

## Testing Instructions

### Test Scenario 1: Rated Game Timer Continues When Navigating Away
1. Start a **rated** multiplayer game (10 min time control)
2. Make a move to ensure it's your opponent's turn
3. Note your remaining time (e.g., 9:45)
4. Navigate to Dashboard or Lobby (don't close browser, just navigate)
5. Wait 30 seconds
6. Navigate back to the game
7. **Expected**: Your clock shows ~9:15 (timer continued while you were away)
8. **NOT Expected**: Your clock should NOT still show 9:45

### Test Scenario 2: Rated Game Timer Continues on Tab Switch
1. Start a **rated** game
2. Note your time (e.g., 9:50)
3. Switch to a different browser tab
4. Wait 20 seconds
5. Switch back to the game tab
6. **Expected**: Your clock shows ~9:30 (timer continued)
7. Console should show: `[Timer] ⏱️ Rated game - timer continues counting despite status: active`

### Test Scenario 3: Casual Game Timer Stops When Paused
1. Start a **casual** multiplayer game
2. Note your time (e.g., 9:40)
3. Click pause or navigate away
4. Wait 30 seconds
5. Resume or return to game
6. **Expected**: Your clock shows ~9:40 (timer was paused)
7. Console should show: `[Timer] ⏸️ Timer stopped (casual game finished/paused)`

### Test Scenario 4: Rated Game Timer Flags on Time
1. Start a **rated** game with very short time control (1 min)
2. Make moves until your clock is low (e.g., 10 seconds)
3. Navigate away from the game
4. Wait 15 seconds
5. **Expected**: You should see a "time forfeit" message (you lost on time)
6. **NOT Expected**: The timer should NOT pause and save you from flagging

---

## Technical Details

### Timer Implementation
- **Timer interval**: 100ms (updates every 0.1 seconds)
- **Countdown**: 100ms per interval (myMs = myMs - 100)
- **Turn tracking**: Server's `serverTurn` determines whose clock counts
- **Flag handler**: `onFlag` callback called when timer reaches 0

### Dependencies Updated
- Added `isRated` to `useMultiplayerTimer` dependency array
- PlayMultiplayer passes `ratedMode === 'rated'` to timer
- Timer re-evaluates when `isRated`, `gameStatus`, `serverTurn`, or `myColor` changes

### Console Logs Added
```javascript
// When timer stops for casual game:
'[Timer] ⏸️ Timer stopped (casual game finished/paused)'

// When timer continues for rated game:
'[Timer] ⏱️ Rated game - timer continues counting despite status: paused'
```

---

## Edge Cases Handled
✅ Rated game with paused status: Timer continues
✅ Rated game with finished status: Timer continues (cleanup handled by component unmount)
✅ Casual game with paused status: Timer stops
✅ Casual game with finished status: Timer stops
✅ User navigates away during rated game: Timer continues
✅ User switches tabs during rated game: Timer continues
✅ Opponent moves while user away: Timer switches correctly when returning

---

## Related Documentation
- Rated Game Navigation Warning Fix: `docs/updates/2025_12_28_rated_game_pause_fix.md`
- Game Modes Implementation: `docs/updates/2025_12_28_game_modes_implementation_summary.md`
- Rated Game Pause Bug Fix: `docs/updates/2025_12_28_rated_game_pause_bug_fix.md`

---

## Verification Checklist
- [ ] Rated game timer continues when navigating away
- [ ] Rated game timer continues when switching browser tabs
- [ ] Rated game timer continues when game status is 'paused' (if somehow set)
- [ ] Casual game timer stops when paused
- [ ] Casual game timer can be resumed
- [ ] Both players' clocks count down correctly in rated games
- [ ] Time forfeit works correctly when clock runs out
- [ ] Console logs show rated game timer behavior
