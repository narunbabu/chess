# Resume Request Channel Fix
**Date:** 2025-12-09
**Type:** Critical Bug Fix - WebSocket Channel Subscription
**Status:** ✅ IMPLEMENTED
**Priority**: CRITICAL
---

## 🚨 **PROBLEM**

Resume requests were not being received by the opponent when a game was paused. The backend was correctly broadcasting the resume request, but the frontend wasn't receiving it.

## 🔍 **ROOT CAUSE ANALYSIS**

### Issue 1: Wrong Channel Name
- Backend broadcasts to: `private-game.5`
- GlobalWebSocketManager was subscribing to: `game.5` (missing `private-` prefix)
- Result: Channel mismatch, no events received

### Issue 2: Wrong Event Name
- Backend sends event: `.resume.request.sent`
- GlobalWebSocketManager was listening for: `.GameResumeRequested`
- Result: Event name mismatch, no events received

### Issue 3: Echo Singleton Disruption
- Local cleanup was setting `this.echo = null`
- This could affect other services using the Echo singleton
- Result: User channel might be disconnected

## ✅ **FIXES IMPLEMENTED**

### 1. Correct Channel Name (GlobalWebSocketManager.js:62)
```javascript
// Before: channelName = `game.${gameId}`;
const channelName = `private-game.${gameId}`;
```

### 2. Correct Event Name (GlobalWebSocketManager.js:71)
```javascript
// Before: channel.listen('.GameResumeRequested', ...)
channel.listen('.resume.request.sent', (event) => {
  console.log('[GlobalWebSocket] 📢 Resume request received:', event);
  this.emit('resumeRequest', event);
});
```

### 3. Preserve Echo Singleton (WebSocketGameService.js:1631-1636)
```javascript
// IMPORTANT: Don't set this.echo = null because it's a singleton shared by all services
this.isConnected = false;
this.socketId = null;
this.listeners = {};
// Note: We don't emit 'disconnected' event here since we're keeping the connection alive
```

### 4. Enhanced Logging
Added comprehensive logging to:
- Track which user is receiving the request
- Show user IDs in resume requests
- Debug channel subscription status

## 🎯 **EXPECTED FLOW**

1. Player 1 pauses game and navigates to dashboard
2. Player 2 sends resume request
3. Backend broadcasts:
   - To `private-game.5` with `game.paused` event ✅
   - To `private-App.Models.User.1` with `resume.request.sent` event ✅
4. Frontend receives:
   - Game pause event via game channel ✅
   - Resume request via user channel ✅
5. Dialog appears on dashboard ✅

## 🧪 **TESTING CHECKLIST**

1. Check console logs when pause happens:
   ```
   [GlobalWebSocket] ✅ Subscribed to game channel: private-game.5
   [WebSocket] HOTFIX: keepChannelAlive requested -> performing localOnly cleanup
   [WebSocket] ✅ Local cleanup completed - WebSocket connection preserved
   ```

2. When opponent sends resume request, look for:
   ```
   [GlobalInvitation] 🎯 Resume request received via WebSocket: {...}
   [GlobalInvitation] 👤 My user ID: 1, Request from user: 2, Game ID: 5
   [GlobalInvitation] ✅ Setting resume request state
   ```

3. Dialog should appear with:
   - Requesting user's name
   - Accept/Decline buttons
   - Proper styling

## 📊 **FILES MODIFIED**

1. **chess-frontend/src/services/GlobalWebSocketManager.js**
   - Fixed channel name from `game.${gameId}` to `private-game.${gameId}`
   - Fixed event name from `.GameResumeRequested` to `.resume.request.sent`
   - Enhanced logging

2. **chess-frontend/src/services/WebSocketGameService.js**
   - Modified `_performLocalCleanup()` to preserve Echo singleton
   - Removed `this.echo = null` to prevent disconnection of other channels

3. **chess-frontend/src/contexts/GlobalInvitationContext.js**
   - Added detailed logging for resume request debugging

## 🔧 **DEBUGGING TIPS**

If resume requests still don't work, check:

1. **WebSocket Connection Status**:
   ```
   // In browser console
   window.Echo.connector.pusher.connection.state
   // Should be "connected"
   ```

2. **Channel Subscriptions**:
   ```
   // Check if channels are subscribed
   window.Echo.connector.pusher.channels.channels
   ```

3. **User ID Mismatch**:
   - Ensure the backend is sending to the correct user ID
   - Check if the logged-in user matches the target user

## 🎉 **RESULT**

Resume requests should now be received correctly by paused players, even when they're on the dashboard or other pages. The WebSocket connection stays alive for 2 minutes after pausing, ensuring reliable communication between players.