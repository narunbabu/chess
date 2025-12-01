# 🧪 WebSocket Resume Request Test Flow

## Pre-Test Checklist

- [ ] Reverb server is running (`php artisan reverb:start`)
- [ ] Backend server is running (`php artisan serve`)
- [ ] Frontend server is running (`pnpm start`)
- [ ] Two browser windows/tabs open (or one regular + one incognito)
- [ ] Both browsers have console open (F12 → Console tab)

---

## Test Scenario

**Setup:**
- **Browser A**: User 1 (nalamara.arun@gmail.com)
- **Browser B**: User 3 (sanatan.dharmam@gmail.com)
- **Championship**: ID 5
- **Match**: ID 3 (User 1 vs User 3)

---

## Step-by-Step Test

### Step 1: Login & Navigate

**Browser A (User 1):**
1. Login at http://localhost:3000/login
2. Navigate to http://localhost:3000/championships
3. Open Championship ID 5
4. Go to "My Matches" tab

**Browser B (User 3):**
1. Login at http://localhost:3000/login (use incognito or different browser)
2. Navigate to http://localhost:3000/championships
3. Open Championship ID 5
4. Go to "My Matches" tab

### Step 2: Verify WebSocket Connection

**Both browsers should show in console:**
```
🎧 [Resume] Listening on channel: App.Models.User.{id}
👤 [Resume] Current user: {id: X, name: "...", email: "..."}
```

**Check:**
- [ ] Browser A shows: `App.Models.User.1`
- [ ] Browser B shows: `App.Models.User.3`

---

### Step 3: Browser B (User 3) Sends Request

**Action:** User 3 clicks "Play Now" button for Match ID 3

**Expected Console Output in Browser B:**
```
📤 [Resume] Sending request: {
  currentUser: {id: 3, name: "Arun Nalamara"},
  opponent: {id: 1, name: "Arun Nalamara"},
  matchId: 3,
  gameId: 1
}
✅ [Resume] Request sent successfully: {
  success: true,
  message: "Request sent to Arun Nalamara. Waiting for response...",
  request: {
    id: 8,
    requester_id: 3,
    recipient_id: 1,
    ...
  }
}
```

**Expected UI in Browser B:**
- Yellow badge appears: "⏳ 1"
- Notification toast: "⏳ Request sent to Arun Nalamara. Waiting for response..."

---

### Step 4: Browser A (User 1) Receives Request

**Expected Console Output in Browser A:**
```
🎮 [Resume] Request received: {
  type: "championship_game_resume_request",
  request_id: 8,
  match_id: 3,
  game_id: 1,
  requester: {
    id: 3,
    name: "Arun Nalamara",
    avatar_url: "..."
  },
  expires_at: "2025-11-21T10:59:00.000Z",
  message: "Arun Nalamara wants to start the game. Accept to begin playing!"
}
```

**Expected UI in Browser A:**
- Blue badge appears: "🔔 1"
- Dialog opens automatically with:
  - Title: "🎮 Game Request"
  - Message: "Arun Nalamara wants to start the game. Accept to begin playing!"
  - Buttons: "Accept" (green) | "Decline" (red)
- Notification toast: "🎮 Arun Nalamara wants to start the game!"

**Check:**
- [ ] Console shows request received
- [ ] Blue badge appears
- [ ] Dialog opens
- [ ] Notification toast shows

---

### Step 5: Reverb Server Logs

**Expected in Reverb Terminal:**
```
Broadcasting To .......................................................................... private-App.Models.User.1
{
  "event": "championship.game.resume.request",
  "data": {
    "type": "championship_game_resume_request",
    "request_id": 8,
    "match_id": 3,
    ...
  }
}
```

**Check:**
- [ ] Shows broadcasting to `private-App.Models.User.1` (the recipient)
- [ ] Event name is `championship.game.resume.request`

---

### Step 6: User 1 Accepts Request

**Action:** User 1 clicks "Accept" button in dialog

**Expected Console Output in Browser A:**
```
✅ [Resume] Request accepted: {
  game_id: 1,
  match_id: 3,
  ...
}
```

**Expected UI in Browser A:**
- Dialog closes
- Notification: "✅ Game starting! Navigating..."
- Navigates to `/play/1`

**Expected Console Output in Browser B:**
```
✅ [Resume] Request accepted: {
  game_id: 1,
  match_id: 3,
  ...
}
```

**Expected UI in Browser B:**
- Yellow badge disappears
- Notification: "✅ Game starting! Navigating..."
- Navigates to `/play/1`

**Check:**
- [ ] Both browsers receive acceptance event
- [ ] Both browsers navigate to game page
- [ ] Badges cleared on both sides

---

## Troubleshooting

### Issue: No console log in Browser A

**Possible Causes:**
1. **Reverb not running** → Start `php artisan reverb:start`
2. **Wrong channel subscription** → Check console shows correct user ID
3. **WebSocket disconnected** → Refresh browser, check network tab
4. **Broadcasting to wrong user** → Check database: `requester_id` vs `recipient_id`

**Debug:**
```powershell
# Check database
sqlite3 database/database.sqlite "SELECT * FROM championship_game_resume_requests ORDER BY id DESC LIMIT 1"

# Check Reverb logs
# Look for: Broadcasting To .........
```

### Issue: Wrong user receives notification

**Example:** User 3 clicks "Play Now" but User 3 also receives the notification

**Possible Causes:**
1. **Database stores wrong IDs** → Check controller logic in `notifyStart`
2. **Frontend subscribed to wrong channel** → Check `user.id` in console
3. **Event broadcasts to wrong channel** → Check `ChampionshipGameResumeRequestSent.php:36`

**Debug:**
```javascript
// In browser console
console.log('Current user:', user);
console.log('Subscribed to:', `App.Models.User.${user.id}`);
```

### Issue: Reverb shows broadcasting but no event in console

**Possible Causes:**
1. **Event name mismatch** → Frontend listens to `.championship.game.resume.request`
2. **Channel authorization failed** → Check `routes/channels.php`
3. **WebSocket connection closed** → Check network tab for WS connection

**Debug:**
```javascript
// Check Echo connection
window.Echo

// Check channels
window.Echo.connector.channels

// Re-subscribe manually
window.Echo.private('App.Models.User.1')
  .listen('.championship.game.resume.request', (e) => console.log('Manual test:', e));
```

---

## Success Criteria

✅ **Test passes when:**

1. User 3 clicks "Play Now"
2. Reverb logs show: `Broadcasting To private-App.Models.User.1`
3. User 1's console shows: `🎮 [Resume] Request received`
4. User 1's UI shows: Blue badge + Dialog + Notification
5. User 1 clicks "Accept"
6. Both browsers navigate to `/play/1`

---

## Database Verification

After test completes, verify:

```powershell
sqlite3 database/database.sqlite "
SELECT
  id,
  championship_match_id as match,
  requester_id as from_user,
  recipient_id as to_user,
  status,
  created_at
FROM championship_game_resume_requests
ORDER BY id DESC
LIMIT 5
"
```

**Expected:**
- Latest request should have `requester_id=3, recipient_id=1, status='accepted'`

---

## Clean Up Between Tests

```powershell
# Clear all pending requests
sqlite3 database/database.sqlite "DELETE FROM championship_game_resume_requests"

# Or just expire old ones
sqlite3 database/database.sqlite "UPDATE championship_game_resume_requests SET status='expired' WHERE status='pending'"
```

---

## Quick Reference

**Key Files:**
- Event: `chess-backend/app/Events/ChampionshipGameResumeRequestSent.php`
- Controller: `chess-backend/app/Http/Controllers/ChampionshipMatchController.php:1086-1114`
- Frontend: `chess-frontend/src/components/championship/ChampionshipMatches.jsx:227-313`
- Channels: `chess-backend/routes/channels.php:7-9`

**Console Commands:**
```javascript
// Check user
console.log(user)

// Check Echo
console.log(window.Echo)

// Check subscriptions
console.log(window.Echo.connector.channels)

// Manual subscribe
window.Echo.private('App.Models.User.1').listen('.championship.game.resume.request', console.log)
```

**PowerShell Commands:**
```powershell
# Check Reverb status
Invoke-WebRequest -Uri http://localhost:8080

# View latest request
sqlite3 database/database.sqlite "SELECT * FROM championship_game_resume_requests ORDER BY id DESC LIMIT 1"

# View Laravel logs
Get-Content storage/logs/laravel.log -Tail 50
```
