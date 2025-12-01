# 🔍 WebSocket Not Receiving - Diagnostic Summary

## Current Status

✅ **Backend**: Working correctly
- Request sent successfully from User 1
- Backend creates resume request in database
- Event broadcast to Reverb

✅ **Reverb**: Broadcasting correctly
- Receives event from backend
- Broadcasts to `private-App.Models.User.3`
- Shows correct channel and event data

❌ **Frontend (User 3)**: Not receiving event
- No event received in browser console
- Dialog not showing
- Subscription status unknown

## What We Know

### From User 1's Console (Sender)
```javascript
🎯 [Play Now Button] Clicked for match: 3
🎯 [Play Now] Button clicked: { matchId: 3, gameId: 1 }
📋 [Play Now] Match found: { ... }
👥 [Play Now] Opponent found: { id: 3, name: "Arun Nalamara" }
📤 [Play Now] Sending request to backend: {
    url: "http://localhost:8000/api/championships/5/matches/3/notify-start",
    currentUser: { id: 1, name: "Arun Nalamara" },
    opponent: { id: 3, name: "Arun Nalamara" },
    matchId: 3,
    gameId: 1
}
✅ [Play Now] Request sent successfully
```

### From Reverb Terminal
```
Broadcasting To .......................................................................... private-App.Models.User.3

{
    "event": "championship.game.resume.request",
    "data": {
        "type": "championship_game_resume_request",
        "request_id": 10,
        "match_id": 3,
        "game_id": 1,
        "requester": { ... }
    }
}
```

### From User 3's Console (Recipient)
**Need to check**: We don't have User 3's console logs yet!

## Diagnostic Steps

### Step 1: Check User 3's Subscription Status ⚠️ CRITICAL

Open **User 3's browser**, navigate to Championship Matches page, and check console for:

**Expected logs**:
```
🔌 [Resume] Setting up WebSocket connection...
🎧 [Resume] Channel name: App.Models.User.3
👤 [Resume] Current user: { id: 3, name: "...", email: "..." }
🌐 [Resume] Echo instance: { ... }
✅ [Resume] Channel created: { ... }
📡 [Resume] Listening for events on: App.Models.User.3
✅ [Resume] Successfully subscribed to channel: App.Models.User.3
```

**If you see these logs**: Subscription is working, event handling might be the issue.

**If you DON'T see these logs**: Subscription is not set up. Check:
- Is User 3 on the Championship Matches page?
- Is the component mounted?
- Is window.Echo available?

### Step 2: Manual Subscription Test

In **User 3's browser console**, run this JavaScript:

```javascript
// Test 1: Check Echo availability
console.log('Echo available?', !!window.Echo);
console.log('Echo instance:', window.Echo);

// Test 2: Check current subscriptions
console.log('Active channels:', window.Echo?.connector?.channels);

// Test 3: Check User 3's channel
const channel = window.Echo?.connector?.channels['private-App.Models.User.3'];
console.log('User 3 channel:', channel);
console.log('Is subscribed?', channel?.subscription?.subscribed);

// Test 4: Manual listener
const testChannel = window.Echo.private('App.Models.User.3');
testChannel.listen('.championship.game.resume.request', (event) => {
    console.log('🎮 MANUAL TEST: Event received!', event);
    alert('WebSocket working! Event received: ' + JSON.stringify(event));
});
console.log('✅ Manual listener added. Now have User 1 click Play Now again.');
```

**Expected output**:
```
Echo available? true
Echo instance: { connector: {...}, ... }
Active channels: { 'private-App.Models.User.3': {...}, ... }
User 3 channel: PusherPrivateChannel { ... }
Is subscribed? true
✅ Manual listener added. Now have User 1 click Play Now again.
```

**Then have User 1 click "Play Now" again**. If User 3 sees the alert, the WebSocket is working and the issue is in the component.

### Step 3: Use the Standalone Test Page

I created `TEST_USER3_SUBSCRIPTION.html` in the project root. Use it to test WebSocket independently:

1. Open `TEST_USER3_SUBSCRIPTION.html` in a browser
2. In the main app, open DevTools (F12) → Application → Local Storage
3. Copy the `auth_token` value
4. Paste into the test page
5. Click "🔌 Connect to WebSocket"
6. Watch the logs
7. Have User 1 click "Play Now" in the main app
8. The test page should show the event received

### Step 4: Check Component Mounting

The WebSocket subscription is set up in a `useEffect` hook. It might not be running if:

1. **Component not mounted**: User 3 is not on the Championship Matches page
2. **Missing dependencies**: `championshipId`, `user.id`, or `window.Echo` is undefined
3. **Effect not triggered**: Dependencies changed after initial mount

**Check in User 3's console**:
```javascript
// Check if on correct page
console.log('Current path:', window.location.pathname);
// Should be: /championships/{id}/my-matches or similar

// Check if user is logged in
console.log('User:', JSON.parse(localStorage.getItem('user') || 'null'));

// Check if Echo is loaded
console.log('Echo:', window.Echo);
```

### Step 5: Enable Pusher Debug Mode

In **User 3's browser console**, enable full Pusher debugging:

```javascript
// Enable Pusher logging
Pusher.logToConsole = true;

// Bind to all Pusher events
if (window.Echo?.connector?.pusher) {
    const pusher = window.Echo.connector.pusher;

    pusher.connection.bind('state_change', (states) => {
        console.log('🔌 Pusher state:', states.previous, '→', states.current);
    });

    pusher.connection.bind('connected', () => {
        console.log('✅ Pusher connected');
    });

    pusher.connection.bind('disconnected', () => {
        console.warn('⚠️ Pusher disconnected');
    });

    pusher.connection.bind('error', (err) => {
        console.error('❌ Pusher error:', err);
    });

    // Log all channel activity
    pusher.bind_global((eventName, data) => {
        console.log('📡 Pusher event:', eventName, data);
    });
}
```

Then refresh the page and watch the console.

## Common Issues & Solutions

### Issue 1: User 3 Not on Championship Matches Page

**Symptom**: No subscription logs at all

**Solution**: Navigate to `/championships/{id}/my-matches`

### Issue 2: Echo Not Initialized

**Symptom**: `window.Echo` is `undefined`

**Solution**:
1. Check if Echo is initialized in `App.js` or similar
2. Verify Reverb config in `echo.js` or `bootstrap.js`
3. Make sure Echo script is loaded before the component

### Issue 3: Channel Authorization Failed

**Symptom**: Subscription attempt but no "successfully subscribed" log

**Solution**: Check `chess-backend/routes/channels.php`:
```php
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

### Issue 4: Event Name Mismatch

**Symptom**: Subscribed but no events received

**Solution**: Verify event names match:
- Backend broadcasts as: `championship.game.resume.request`
- Frontend listens with: `.championship.game.resume.request` (note the dot!)

### Issue 5: Multiple Components Listening

**Symptom**: Sometimes works, sometimes doesn't

**Solution**:
1. Hard refresh (Ctrl+Shift+R) both browsers
2. Check for duplicate listeners
3. Make sure cleanup is working in `useEffect` return

### Issue 6: CORS or Auth Issues

**Symptom**: Subscription fails with 403 or 401

**Solution**:
1. Check auth token is valid
2. Verify CORS settings in `config/cors.php`
3. Check Reverb auth endpoint: `http://localhost:8000/broadcasting/auth`

## What to Share

Please share the output from **User 3's browser console** after:

1. ✅ Refreshing the Championship Matches page
2. ✅ Looking for subscription logs (Step 1)
3. ✅ Running the manual test (Step 2)
4. ✅ Having User 1 click "Play Now"

**Example of what to copy**:
```
// Paste everything from console, including:
- Subscription logs (🔌, 🎧, ✅)
- Any errors (❌)
- Manual test results
- Any Pusher logs
```

## Expected Working Flow

### User 3's Console (On Page Load)
```
🔌 [Resume] Setting up WebSocket connection...
🎧 [Resume] Channel name: App.Models.User.3
👤 [Resume] Current user: { id: 3, name: "Arun Nalamara", email: "..." }
🌐 [Resume] Echo instance: Echo { ... }
✅ [Resume] Channel created: PusherPrivateChannel { ... }
📡 [Resume] Listening for events on: App.Models.User.3
✅ [Resume] Successfully subscribed to channel: App.Models.User.3
```

### User 3's Console (When User 1 Clicks Play Now)
```
🎮 [Resume] ========================================
🎮 [Resume] INCOMING REQUEST RECEIVED!
🎮 [Resume] ========================================
🎮 [Resume] Event data: {
    type: "championship_game_resume_request",
    request_id: 10,
    match_id: 3,
    game_id: 1,
    requester: {
        id: 1,
        name: "Arun Nalamara",
        avatar_url: "..."
    },
    expires_at: "2025-11-21T...",
    message: "Arun Nalamara wants to start the game..."
}
🎮 [Resume] Request ID: 10
🎮 [Resume] Match ID: 3
🎮 [Resume] Game ID: 1
🎮 [Resume] Requester: { id: 1, name: "..." }
🎮 [Resume] ========================================
```

### User 3's Screen
- Modal dialog appears: "🎮 Game Start Request"
- Message: "Arun Nalamara wants to start the championship game now."
- Buttons: [❌ Decline] [✅ Accept & Play]

## Next Steps

1. ✅ **FIRST**: Check User 3's console for subscription logs
2. ✅ **SECOND**: Run manual test (Step 2) if no logs appear
3. ✅ **THIRD**: Use standalone test page to isolate issue
4. ✅ **FOURTH**: Share console output with me

The console logs will tell us exactly where the problem is! 🎯
