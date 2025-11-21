# 🧪 WebSocket Subscription Test

## Issue

User 3's browser is not receiving the `championship.game.resume.request` event even though Reverb is broadcasting it correctly.

## Reverb Logs Show

```
Broadcasting To .......................................................................... private-App.Models.User.3

{
    "event": "championship.game.resume.request",
    "data": {
        "type": "championship_game_resume_request",
        "request_id": 10,
        "match_id": 3,
        "game_id": 1,
        "req...
```

This means:
- ✅ Backend is sending the event
- ✅ Reverb is broadcasting to the correct channel
- ❌ Frontend is not receiving it

## Possible Causes

### 1. User 3's Browser Not Subscribed

**Check in User 3's console**:
```javascript
// Should see these logs after page load:
🔌 [Resume] Setting up WebSocket connection...
🎧 [Resume] Channel name: App.Models.User.3
👤 [Resume] Current user: { id: 3, name: "Arun Nalamara", email: "..." }
✅ [Resume] Channel created: {...}
📡 [Resume] Listening for events on: App.Models.User.3
✅ [Resume] Successfully subscribed to channel: App.Models.User.3
```

If you DON'T see `✅ Successfully subscribed`, the subscription failed.

### 2. Event Name Mismatch

Laravel Echo requires the event name to be listened with a dot prefix when using `channel.listen()`.

**Backend broadcasts**: `championship.game.resume.request`
**Frontend listens**: `.championship.game.resume.request`

This should be correct, but let's verify.

### 3. Channel Authorization Failed

Reverb shows User 3 subscribing to `private-App.Models.User.3`, but we need to verify the authorization succeeded.

## Quick Tests

### Test 1: Check Subscription Status

In **User 3's browser console**, run:
```javascript
// Check if Echo is available
console.log('Echo:', window.Echo);

// Check active subscriptions
console.log('Channels:', window.Echo.connector.channels);

// Check specific channel
const channel = window.Echo.connector.channels['private-App.Models.User.3'];
console.log('User 3 Channel:', channel);
console.log('Is subscribed?', channel?.subscription?.subscribed);
```

Expected output:
```javascript
Echo: {connector: {...}, ...}
Channels: {
  'private-App.Models.User.3': PusherPrivateChannel {...}
}
User 3 Channel: PusherPrivateChannel {...}
Is subscribed?: true  // ← Should be true!
```

### Test 2: Manual Event Listener

In **User 3's browser console**, run:
```javascript
// Subscribe to the channel
const channel = window.Echo.private('App.Models.User.3');

// Listen for the event
channel.listen('.championship.game.resume.request', (event) => {
  console.log('🎮 TEST: Event received!', event);
  alert('WebSocket event received: ' + JSON.stringify(event));
});

console.log('✅ Manual listener added');
```

Now have **User 1 click "Play Now"** again and see if User 3's browser shows the alert.

### Test 3: Listen to All Events

In **User 3's browser console**, run:
```javascript
// Listen to ALL events on the channel
const channel = window.Echo.private('App.Models.User.3');

channel.notification((notification) => {
  console.log('📬 Notification received:', notification);
});

// Also try listening without the dot prefix
channel.listen('championship.game.resume.request', (event) => {
  console.log('🎮 Event received (no dot):', event);
});

// And with the dot prefix
channel.listen('.championship.game.resume.request', (event) => {
  console.log('🎮 Event received (with dot):', event);
});

console.log('✅ All listeners added');
```

### Test 4: Check Pusher Debug

In **User 3's browser console**, enable Pusher debugging:
```javascript
// Enable Pusher debug
if (window.Echo?.connector?.pusher) {
  window.Echo.connector.pusher.connection.bind('state_change', (states) => {
    console.log('Pusher state changed:', states.previous, '→', states.current);
  });

  window.Echo.connector.pusher.connection.bind('connected', () => {
    console.log('✅ Pusher connected');
  });

  window.Echo.connector.pusher.connection.bind('error', (err) => {
    console.error('❌ Pusher error:', err);
  });

  // Enable all event logging
  Pusher.logToConsole = true;
}
```

## Manual Backend Test

Let's verify the backend is working by sending a test broadcast from Tinker.

### Step 1: Open Tinker

```bash
php artisan tinker
```

### Step 2: Create Test Request

```php
// Get the users
$user1 = \App\Models\User::find(1); // Sender
$user3 = \App\Models\User::find(3); // Recipient

// Get the match
$match = \App\Models\ChampionshipMatch::find(3);

// Create a test resume request
$request = \App\Models\ChampionshipGameResumeRequest::create([
    'championship_match_id' => 3,
    'game_id' => 1,
    'requester_id' => 1,
    'recipient_id' => 3,
    'status' => 'pending',
    'expires_at' => now()->addMinutes(5),
]);

// Load relationships
$request->load(['requester', 'recipient', 'championshipMatch', 'game']);

// Broadcast the event
broadcast(new \App\Events\ChampionshipGameResumeRequestSent($request));

echo "✅ Test event broadcast to User 3!\n";
```

### Step 3: Check User 3's Browser

User 3's console should show:
```
🎮 [Resume] ========================================
🎮 [Resume] INCOMING REQUEST RECEIVED!
🎮 [Resume] ========================================
```

If NOT, the issue is with the frontend subscription, not the backend.

## Common Issues & Fixes

### Issue 1: Not Subscribed to Channel

**Symptom**: No "✅ Successfully subscribed" log

**Cause**: Component not mounting or useEffect not running

**Fix**: Refresh the page, check that:
- Championship ID is set
- User is logged in
- Window.Echo exists

### Issue 2: Channel Authorization Failed

**Symptom**: Reverb shows subscription attempt but no "successfully subscribed"

**Cause**: Backend channel authorization failing

**Fix**: Check `chess-backend/routes/channels.php`:
```php
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

### Issue 3: Event Name Mismatch

**Symptom**: Subscribed but events not received

**Cause**: Listening for wrong event name

**Fix**: Verify event name matches:
- Backend: `broadcastAs()` returns `championship.game.resume.request`
- Frontend: `channel.listen('.championship.game.resume.request', ...)`

### Issue 4: Multiple Echo Instances

**Symptom**: Sometimes works, sometimes doesn't

**Cause**: Multiple Echo connections interfering

**Fix**: Hard refresh (Ctrl+Shift+R) both browsers

### Issue 5: Reverb Connection Lost

**Symptom**: Was working, then stopped

**Cause**: Reverb server restarted or connection dropped

**Fix**: Restart Reverb and refresh browsers

## Expected Full Flow

### User 1 (Sender)
1. Clicks "🎮 Play Now"
2. Console logs:
   ```
   🎯 [Play Now] Button clicked
   📤 [Play Now] Sending request to backend
   ✅ [Play Now] Request sent successfully
   ```
3. Sees notification: "⏳ Request sent to Arun Nalamara. Waiting for response..."

### Reverb Terminal
```
Broadcasting To .......................................................................... private-App.Models.User.3

{
    "event": "championship.game.resume.request",
    "data": {
        "request_id": 10,
        "match_id": 3,
        "game_id": 1,
        "requester": {...}
    }
}
```

### User 3 (Recipient)
1. Console logs:
   ```
   🎮 [Resume] ========================================
   🎮 [Resume] INCOMING REQUEST RECEIVED!
   🎮 [Resume] ========================================
   🎮 [Resume] Event data: {...}
   ```
2. Sees modal dialog: "🎮 Game Start Request"
3. Clicks "✅ Accept & Play"
4. Navigates to game

## Next Steps

1. ✅ Refresh User 3's browser
2. ✅ Check console for subscription logs
3. ✅ Run Test 1 in console (check subscription status)
4. ✅ If not subscribed, check why (component mounting? Echo available?)
5. ✅ If subscribed, run Test 2 (manual listener)
6. ✅ If manual listener works, check component code
7. ✅ If manual listener doesn't work, run Test 4 (Pusher debug)

**Report back with the results from Test 1!** 🚀
