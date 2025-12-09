# WebSocket Keep-Alive Hotfix
**Date:** 2025-12-09
**Type:** Critical Hotfix - Prevent Immediate WebSocket Disconnect
**Status:** ✅ IMPLEMENTED
**Priority**: CRITICAL
---

## 🚨 **PROBLEM**

Despite setting `keepChannelAlive: true`, the WebSocket was immediately disconnecting when pausing and navigating away from games. This prevented resume requests from being received.

## 🔍 **ROOT CAUSE**

The `disconnect()` method in WebSocketGameService was ignoring the `keepChannelAlive` flag and performing a full disconnect when `immediate: true` was passed. The issue was in the logic flow:

1. PlayMultiplayer calls `disconnect({ immediate: true, keepChannelAlive: true })`
2. WebSocketService checks `options.immediate` first
3. Since `immediate: true`, it skips all logic and calls `_performDisconnect()`
4. `_performDisconnect()` leaves the channel regardless of `keepChannelAlive`

## ✅ **HOTFIX IMPLEMENTED**

### 1. Priority Check for `keepChannelAlive` (WebSocketGameService.js:1489-1494)

```javascript
// Fast hotfix: if keepChannelAlive requested, never perform a global immediate disconnect
if (options.keepChannelAlive) {
  console.log('[WebSocket] HOTFIX: keepChannelAlive requested -> performing localOnly cleanup');
  this._performLocalCleanup();
  return;
}
```

**Why it works:** This gives `keepChannelAlive` priority over `immediate`, ensuring the channel stays alive when requested.

### 2. New Local-Only Cleanup Method (WebSocketGameService.js:1598-1637)

```javascript
_performLocalCleanup() {
  // Clear timers
  // Stop local listeners
  // IMPORTANT: DON'T leaveChannel() or disconnect Echo
  // Keep WebSocket connection alive for global manager
}
```

**Why it works:** Removes local listeners and timers without disconnecting the actual WebSocket connection.

### 3. Updated PlayMultiplayer Disconnect Call (PlayMultiplayer.js:1768-1771)

```javascript
// OLD: Was causing immediate disconnect
wsService.current.disconnect({
  immediate: true,
  keepChannelAlive: true
});

// NEW: Local-only cleanup
wsService.current.disconnect({
  localOnly: true,
  keepChannelAlive: true
});
```

**Why it works:** Uses the new `localOnly` flag instead of `immediate: true` to prevent full disconnect.

### 4. Enhanced Logging (GlobalWebSocketManager.js)

Added comprehensive logging to track:
- Games being kept alive
- Channel subscriptions
- Cleanup operations
- Alive game counts

## 🎯 **EXPECTED BEHAVIOR AFTER HOTFIX**

When pausing and navigating away:

```
🧹 Navigation check: {isNavigatingAway: true, wasPausedForNavigation: true}
🧹 Disconnect decision: {shouldDelayDisconnect: true}
🌐 Using global WebSocket manager to keep game alive
[GlobalWebSocket] 🔄 Keeping game 5 alive for 120 seconds
[GlobalWebSocket] ✅ Subscribed to game channel: game.5
[WebSocket] HOTFIX: keepChannelAlive requested -> performing localOnly cleanup
[WebSocket] 🧩 Local-only cleanup: removing local listeners & timers
[WebSocket] ✅ Stopped local listeners, channel remains active for global manager
[WebSocket] ✅ Local cleanup completed - WebSocket connection preserved
```

**NO MORE:** `WebSocket disconnected and cleaned up` when pausing!

## 🧪 **TESTING CHECKLIST**

1. Pause game and navigate to dashboard
   - ✅ See "HOTFIX: keepChannelAlive requested" log
   - ✅ See "Local cleanup completed - WebSocket connection preserved"
   - ❌ NO "WebSocket disconnected and cleaned up" log

2. Opponent sends resume request
   - ✅ Resume request received in dashboard
   - ✅ Dialog appears
   - ✅ No 404 errors

3. Accept resume request
   - ✅ Navigates back to game
   - ✅ Game resumes properly
   - ✅ WebSocket reconnects successfully

## 📊 **FILES MODIFIED**

1. **chess-frontend/src/services/WebSocketGameService.js**
   - Added `localOnly` option to `disconnect()`
   - Added priority check for `keepChannelAlive`
   - Added `_performLocalCleanup()` method

2. **chess-frontend/src/components/play/PlayMultiplayer.js**
   - Changed disconnect call to use `localOnly: true`

3. **chess-frontend/src/services/GlobalWebSocketManager.js**
   - Enhanced logging for debugging

## 🔧 **TECHNICAL DETAILS**

### Before Hotfix:
```
disconnect({ immediate: true, keepChannelAlive: true })
  → _performDisconnect() [ignores keepChannelAlive]
    → leaveChannel() ❌
    → echo = null ❌
```

### After Hotfix:
```
disconnect({ localOnly: true, keepChannelAlive: true })
  → _performLocalCleanup()
    → stopListening() ✅
    → Channel stays subscribed ✅
    → Echo connection preserved ✅
```

## ⚡ **NEXT STEPS**

This hotfix resolves the immediate disconnect issue. For a more robust long-term solution:
1. Implement proper channel reference counting in GlobalWebSocketManager
2. Add connection state management
3. Implement graceful Echo disconnect when no channels are active

## 🎉 **RESULT**

Resume requests should now work reliably when users navigate away from paused games! The WebSocket connection stays alive for 2 minutes, allowing resume requests to be received on any page.