# Race Condition - Duplicate Save Fix

**Date**: 2025-11-27 19:00
**Issue**: Pending game still saving twice due to race condition
**Status**: ✅ RESOLVED

---

## Problem

Even after switching from state to ref, the pending game was **still being saved twice** after login because of a **race condition**.

### Evidence
```
POST http://localhost:8000/api/game-history (Status: 201) ← First save
POST http://localhost:8000/api/game-history (Status: 201) ← Second save (DUPLICATE!)
```

---

## Root Cause: Race Condition

**File**: `chess-frontend/src/contexts/AuthContext.js`

### The Race Condition

```javascript
// ❌ PROBLEM: Flag set AFTER async operation
const checkAndSavePendingGames = useCallback(async () => {
  if (pendingGameSavedRef.current) return;

  const pendingGame = getPendingGame();  // Synchronous
  if (pendingGame) {
    const saveSuccess = await savePendingGame();  // ← ASYNC!

    if (saveSuccess) {
      pendingGameSavedRef.current = true;  // ← Flag set too late!
    }
  }
}, []);
```

### Timeline of the Race Condition

```
Time  | Call 1                           | Call 2
------|----------------------------------|----------------------------------
0ms   | Check ref (false) ✓              |
1ms   | Start savePendingGame()...       |
2ms   |   (waiting for backend...)       | Check ref (STILL FALSE!) ✓
3ms   |   (waiting for backend...)       | Start savePendingGame()... ❌
4ms   |   (waiting for backend...)       |   (waiting for backend...)
...   |   (waiting for backend...)       |   (waiting for backend...)
500ms | Backend responds ✅              |   (waiting for backend...)
501ms | Set ref to true                  |   (waiting for backend...)
600ms |                                  | Backend responds ✅ (DUPLICATE!)
601ms |                                  | Set ref to true (too late)
```

**Problem**: Between the time Call 1 **checks** the flag and **sets** it, Call 2 can also check the flag and see it's still false!

### Why Two Calls Happened

The `fetchUser()` function was being called twice:

1. **From `login()` function** (explicit call)
2. **From `useEffect`** (automatic call when `fetchUser` changes)

Each call to `fetchUser()` triggers `checkAndSavePendingGames()`, and because the flag was set **after** the async operation, both calls passed the guard.

---

## Solution Applied

### Set Flag IMMEDIATELY (Synchronously)

```javascript
// ✅ SOLUTION: Set flag IMMEDIATELY before async operation
const checkAndSavePendingGames = useCallback(async () => {
  console.log('[Auth] 🔍 checkAndSavePendingGames called, ref:', pendingGameSavedRef.current);
  console.trace('[Auth] 📍 Call stack trace'); // Debug logging

  if (pendingGameSavedRef.current) {
    console.log('[Auth] ⏭️ Skipping pending game save - already processed');
    return;
  }

  // Set flag IMMEDIATELY to prevent race condition
  pendingGameSavedRef.current = true;  // ← Set synchronously BEFORE async!
  console.log('[Auth] 🔒 Set ref to true to prevent duplicate saves');

  try {
    const pendingGame = getPendingGame();
    if (pendingGame) {
      console.log('[Auth] 📝 Found pending game, attempting to save...');

      const saveSuccess = await savePendingGame();  // Now safe to await

      if (saveSuccess) {
        console.log('[Auth] ✅ Pending game saved successfully!');
        // ref already set to true above
      } else {
        console.warn('[Auth] ⚠️ Failed to save, resetting flag for retry');
        pendingGameSavedRef.current = false;  // Reset to allow retry
      }
    } else {
      console.log('[Auth] ℹ️ No pending game found');
      // ref already set to true above
    }
  } catch (error) {
    console.error('[Auth] ❌ Error checking for pending games:', error);
    // Keep ref as true to prevent infinite retries on error
  }
}, []);
```

### Timeline After Fix

```
Time  | Call 1                           | Call 2
------|----------------------------------|----------------------------------
0ms   | Check ref (false) ✓              |
1ms   | Set ref to TRUE immediately      |
2ms   | Start savePendingGame()...       | Check ref (TRUE) ❌ SKIP!
3ms   |   (waiting for backend...)       | Return early
4ms   |   (waiting for backend...)       |
...   |   (waiting for backend...)       |
500ms | Backend responds ✅              |
501ms | Done (ref already true)          |
```

**Success**: Call 2 sees the flag is already true and skips!

---

## Key Changes

### 1. Synchronous Flag Setting
- **Before**: Flag set after `await savePendingGame()`
- **After**: Flag set **before** any async operations

### 2. Error Handling
- **Success**: Flag stays true (already set)
- **Failure**: Flag reset to false to allow retry
- **Error**: Flag stays true to prevent infinite retries

### 3. Debug Logging
- Added call stack trace to identify duplicate call sources
- Added detailed logging at each step
- Added emoji indicators for quick visual scanning

---

## Verification

### Expected Console Output (Success)

```
[Auth] 🔍 checkAndSavePendingGames called, ref: false
[Auth] 📍 Call stack trace
[Auth] 🔒 Set ref to true to prevent duplicate saves
[Auth] 📝 Found pending game, attempting to save...
[PendingGame] 📤 Saving pending game to backend...
[PendingGame] ✅ Pending game saved successfully
[Auth] ✅ Pending game saved successfully after login!

[Auth] 🔍 checkAndSavePendingGames called, ref: true  ← Second call
[Auth] 📍 Call stack trace
[Auth] ⏭️ Skipping pending game save - already processed  ← Blocked!
```

### Network Tab
- **Before Fix**: 2 POST requests to `/api/game-history`
- **After Fix**: 1 POST request to `/api/game-history` ✅

---

## Technical Deep Dive

### Race Conditions in Async JavaScript

A race condition occurs when the outcome depends on the timing of events. In our case:

1. **Check-Then-Act Pattern**: Classic race condition pattern
   ```javascript
   if (!flag) {      // Check (not atomic with act)
     flag = true;    // Act
   }
   ```

2. **Async Makes It Worse**: The gap between check and set is larger
   ```javascript
   if (!flag) {           // Check
     await something();   // ← Gap where race can occur!
     flag = true;         // Act (too late)
   }
   ```

3. **Solution: Check-And-Set Atomically**
   ```javascript
   if (!flag) {      // Check
     flag = true;    // Set IMMEDIATELY (no gap)
     await something();  // Now safe
   }
   ```

### Why This Pattern Works

JavaScript is **single-threaded**, so synchronous operations are atomic:

```javascript
// This sequence is atomic (no interruption possible):
if (!pendingGameSavedRef.current) {
  pendingGameSavedRef.current = true;
}
// After these two lines, no other code has run
```

But as soon as you `await`, other code can run:

```javascript
if (!pendingGameSavedRef.current) {
  await savePendingGame();  // ← Other code can run here!
  pendingGameSavedRef.current = true;
}
```

### Best Practice: Lock Before Async

For any async operation with a guard:

```javascript
// ✅ GOOD: Set flag before async
if (!locked) {
  locked = true;  // Lock immediately
  await asyncOperation();  // Safe
}

// ❌ BAD: Set flag after async
if (!locked) {
  await asyncOperation();  // Race condition possible!
  locked = true;  // Too late
}
```

---

## Testing Checklist

- [x] Guest plays game
- [x] Guest clicks "Login to Save"
- [x] User completes login
- [x] Check Network tab - only **1** POST request
- [x] Check console - second call is skipped
- [x] Verify game appears in history
- [x] Test with slow network (throttling)
- [x] Test logout and re-login (flag reset works)

---

## Related Files

### Modified
- `chess-frontend/src/contexts/AuthContext.js`
  - Lines 21-58: Updated `checkAndSavePendingGames` to set flag synchronously
  - Added call stack tracing for debugging
  - Added detailed logging with emoji indicators

---

## Performance Impact

### Before Fix
- **API Calls**: 2 POST requests per login
- **Database Writes**: 2 inserts per login (duplicate data)
- **Backend Load**: 2x unnecessary load

### After Fix
- **API Calls**: 1 POST request per login ✅
- **Database Writes**: 1 insert per login ✅
- **Backend Load**: 50% reduction ✅

---

## Lessons Learned

1. **Race Conditions are Subtle**: Even with refs, timing matters
2. **Lock Before Async**: Always set flags/locks before async operations
3. **JavaScript is Single-Threaded**: Use this to your advantage
4. **Test with Slow Networks**: Throttling helps expose race conditions
5. **Logging is Essential**: Call stack traces help identify duplicate call sources

---

## Related Issues

- [2025_11_27_18_30_login-pending-game-moves-format-fix.md](./2025_11_27_18_30_login-pending-game-moves-format-fix.md) - Fixed moves format
- [2025_11_27_18_45_duplicate-pending-game-save-fix.md](./2025_11_27_18_45_duplicate-pending-game-save-fix.md) - Fixed state/ref issue

---

## Future Improvements

1. Consider using a mutex/lock library for complex async flows
2. Add automated tests with concurrent operations
3. Consider debouncing as additional safety measure
4. Add E2E tests that verify single save operation

---

**Status**: ✅ COMPLETE
**Next Steps**: Test in production, remove debug logging after verification
