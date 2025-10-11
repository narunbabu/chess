# Fix Multiplayer Timer Hook Error

**Date:** 2025-01-11
**Type:** Bug Fix
**Status:** ✅ Fixed

## Problem

```
Uncaught TypeError: setMyMs is not a function
    at PlayMultiplayer.js:1153
```

**Root Cause:**
- `PlayMultiplayer.js` was calling `useGameTimer` with an object config expecting `{ myMs, oppMs, setMyMs, setOppMs }`
- But `useGameTimer` in `timerUtils.js` was the old single-player implementation
- The hook signatures didn't match, causing `setMyMs` to be undefined

## Solution

Updated `useGameTimer` hook in `/chess-frontend/src/utils/timerUtils.js` to support **both** multiplayer and single-player modes:

### Multiplayer Mode (New)
```javascript
const { myMs, oppMs, setMyMs, setOppMs } = useGameTimer({
  myColor: 'w',
  serverTurn: 'white',
  gameStatus: 'active',
  onFlag: handleTimerFlag,
  initialMyMs: 600000,
  initialOppMs: 600000
});
```

**Features:**
- Returns `myMs`, `oppMs`, `setMyMs`, `setOppMs`
- Auto-updates timers based on `serverTurn`
- Supports game states: active, paused, finished
- 100ms tick interval for smooth countdown
- Calls `onFlag` callback when time runs out

### Single-Player Mode (Legacy)
```javascript
const {
  playerTime,
  computerTime,
  handleTimer,
  pauseTimer,
  resetTimer
} = useGameTimer(playerColor, game, setGameStatus);
```

**Backwards Compatible:**
- Existing `PlayComputer.js` continues to work
- No breaking changes to single-player timer logic

## Implementation Details

### Detection Logic
```javascript
const isMultiplayer = typeof config === 'object' &&
                      config !== null &&
                      'myColor' in config;
```

### Timer Management
- **Multiplayer:** Auto-starts/stops based on `gameStatus` and `serverTurn`
- **Single-player:** Manual control via `handleTimer`, `pauseTimer`, `resetTimer`

## Files Changed

- `chess-frontend/src/utils/timerUtils.js` - Updated `useGameTimer` hook

## Testing

✅ PlayMultiplayer loads without errors
✅ Timer countdown works correctly
✅ `setMyMs` and `setOppMs` are defined functions
✅ PlayComputer still works (backwards compatibility)
✅ Paused games stop timer correctly
✅ Resumed games restart timer correctly

## Related

- Part of the global invitation dialog implementation
- Required for multiplayer timer functionality
- Maintains compatibility with single-player mode

---

**Fixed by:** Claude Code
**Tested:** Local development
