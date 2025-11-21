# 🔌 WebSocket Debugging Guide

## 🚨 The Problem

**WebSocket events are not reaching the recipient** because the **Reverb server is not running**.

## ✅ Solution

### Quick Fix

```powershell
# Open a new PowerShell terminal
cd C:\ArunApps\Chess-Web\chess-backend
php artisan reverb:start
```

Keep this terminal open while testing WebSocket features.

### Easy Startup (All Servers)

```powershell
# Run the startup script to start all servers automatically
.\start-all-servers.ps1
```

This will open 3 PowerShell windows:
1. Laravel Backend (Port 8000)
2. Reverb WebSocket (Port 8080)
3. React Frontend (Port 3000)

## 🧪 Testing the Fix

### Step 1: Verify Reverb is Running

```powershell
# Run the diagnostic script
cd C:\ArunApps\Chess-Web\chess-backend
php test-broadcast.php
```

**Expected Output:**
```
✅ Reverb server is RUNNING at http://localhost:8080
```

### Step 2: Test Championship Match Notification

1. **Open two browser windows** (or incognito mode for second user)
2. **Log in as Player A** in first window
3. **Log in as Player B** in second window
4. Both players join the same championship
5. **Player A clicks "Play Now"**

**Expected Flow:**

**Player A's Browser:**
```
🎧 [Resume] Listening on channel: App.Models.User.3
📤 Sending request to opponent...
⏳ Waiting for Arun Nalamara to respond...
```

**Player B's Browser (THIS SHOULD NOW WORK!):**
```
🎧 [Resume] Listening on channel: App.Models.User.1
🎮 [Resume] Request received: {request_id: 6, match_id: 3, ...}
🔔 Incoming request from Player A
[Dialog opens automatically]
```

### Step 3: Verify Backend Logs

Check Laravel logs for broadcast confirmation:

```powershell
# View recent logs
cd C:\ArunApps\Chess-Web\chess-backend
Get-Content storage/logs/laravel.log -Tail 50
```

Look for:
```
🎮 Championship game resume request sent
```

## 🔍 Common Issues

### Issue 1: Port 8080 Already in Use

**Error:**
```
Address already in use (http://localhost:8080)
```

**Solution:**
```powershell
# Find process using port 8080
netstat -ano | findstr :8080

# Kill the process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

### Issue 2: Frontend Can't Connect to WebSocket

**Symptoms:**
- No console log: `🎧 [Resume] Listening on channel:`
- Echo connection fails

**Solution:**

Check frontend environment variables in `chess-frontend/.env`:
```
REACT_APP_REVERB_APP_KEY=anrdh24nppf3obfupvqw
REACT_APP_REVERB_HOST=localhost
REACT_APP_REVERB_PORT=8080
REACT_APP_REVERB_SCHEME=http
```

Restart frontend after changing `.env`:
```powershell
cd C:\ArunApps\Chess-Web\chess-frontend
pnpm start
```

### Issue 3: Authentication Failures

**Symptoms:**
```
WebSocket connection failed: 403 Forbidden
```

**Solution:**

Check channel authorization in `chess-backend/routes/channels.php`:

```php
Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});
```

Verify user is authenticated and token is valid.

## 📊 Console Debugging Commands

### Frontend Console

```javascript
// Check Echo connection
window.Echo

// Check subscribed channels
window.Echo.connector.channels

// Manually test event reception
window.Echo.private('App.Models.User.1')
    .listen('.test.event', (event) => {
        console.log('Test event received:', event);
    });
```

### Backend Testing

```bash
# Send test broadcast from backend
php artisan tinker

# In Tinker console:
broadcast(new \App\Events\ChampionshipGameResumeRequestSent(
    \App\Models\ChampionshipGameResumeRequest::first()
));
```

## 🎯 Verification Checklist

Before testing, ensure:

- [ ] Reverb server is running (`php artisan reverb:start`)
- [ ] Backend server is running (`php artisan serve`)
- [ ] Frontend server is running (`pnpm start`)
- [ ] Both users are logged in
- [ ] Both users are in the same championship
- [ ] Browser console is open (F12) to see logs
- [ ] No WebSocket connection errors in console

## 🔧 Advanced Debugging

### Enable Reverb Debug Mode

```powershell
# Edit .env
REVERB_DEBUG=true
```

Restart Reverb to see detailed connection logs.

### Monitor WebSocket Traffic

Use browser DevTools:
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "WS" (WebSocket)
4. Click on WebSocket connection
5. View Messages tab

You should see:
- Connection established
- Subscribe to `private-App.Models.User.{id}`
- Event: `championship.game.resume.request`

## 📝 File References

**Backend Event:**
- `chess-backend/app/Events/ChampionshipGameResumeRequestSent.php` - Broadcasts to recipient

**Frontend Listener:**
- `chess-frontend/src/components/championship/ChampionshipMatches.jsx:228-272` - Listens for events

**Channel Authorization:**
- `chess-backend/routes/channels.php:7-9` - Authorizes user channels

**Configuration:**
- `chess-backend/.env:46,94-108` - Reverb settings
- `chess-frontend/.env` - Frontend WebSocket config

## 🎉 Success Indicators

When everything works correctly:

1. **Reverb Terminal Shows:**
   ```
   [2025-11-21 10:44:54] Connection established
   [2025-11-21 10:44:54] Subscribing to private-App.Models.User.1
   [2025-11-21 10:44:54] Broadcasting: championship.game.resume.request
   ```

2. **Player B's Console Shows:**
   ```
   🎧 [Resume] Listening on channel: App.Models.User.1
   🎮 [Resume] Request received: {request_id: 6, ...}
   ```

3. **Player B's UI Shows:**
   - Blue badge: "🔔 1"
   - Notification toast: "🎮 Player A wants to start the game!"
   - Dialog opens automatically

4. **Backend Logs Show:**
   ```
   [2025-11-21 10:44:54] local.INFO: 🎮 Championship game resume request sent
   ```

## 🆘 Still Not Working?

If you've followed all steps and it's still not working:

1. **Restart everything:**
   ```powershell
   # Kill all processes
   # Then run:
   .\start-all-servers.ps1
   ```

2. **Clear all caches:**
   ```powershell
   cd C:\ArunApps\Chess-Web\chess-backend
   php artisan config:clear
   php artisan cache:clear
   php artisan route:clear
   php artisan view:clear
   ```

3. **Check firewall:**
   - Ensure Windows Firewall allows connections to port 8080
   - Try accessing http://localhost:8080 in browser (should see Reverb response)

4. **Verify package installation:**
   ```powershell
   cd C:\ArunApps\Chess-Web\chess-backend
   composer show laravel/reverb
   ```

5. **Check logs:**
   ```powershell
   # Backend logs
   Get-Content chess-backend/storage/logs/laravel.log -Tail 100

   # Frontend console (F12 in browser)
   ```
