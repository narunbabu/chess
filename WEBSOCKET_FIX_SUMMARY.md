# WebSocket / Chess Movement Fix Summary

## Problem Diagnosis

### Errors Observed:
1. ❌ `[Echo] Failed to initialize: You must pass your app key when you instantiate Pusher`
2. ❌ `WebSocket config: {wsHost: 'localhost', wsPort: 8080}` (wrong for production!)
3. ❌ `[WS] Echo singleton not ready yet - continuing HTTP-only mode`
4. ❌ Chess pieces not moving in real-time

### Root Causes:
1. **Missing `.env.production`** - Frontend using localhost WebSocket config in production
2. **No Reverb Service** - Laravel Reverb not running on server
3. **Wrong Configuration** - Backend .env pointing to localhost
4. **No Nginx WebSocket Proxy** - Missing WebSocket upgrade configuration

---

## Fixes Applied (Local)

### 1. Created `.env.production` ✅
**File:** `chess-frontend/.env.production`

```env
REACT_APP_BACKEND_URL=https://api.chess99.com/api
REACT_APP_REVERB_APP_KEY=anrdh24nppf3obfupvqw
REACT_APP_REVERB_HOST=api.chess99.com
REACT_APP_REVERB_PORT=443
REACT_APP_REVERB_SCHEME=https
REACT_APP_USE_POLLING_FALLBACK=false
```

**Effect:** Production builds now connect to `wss://api.chess99.com:443` instead of `localhost:8080`

### 2. Updated deploy.yml ✅
**File:** `.github/workflows/deploy.yml`

**Changes:**
- Added cache clearing before config:cache
- Added `systemctl restart laravel-reverb` after deployment
- Added service verification

**Effect:** Reverb service automatically restarts on each deployment

---

## Server Setup Required

### Step 1: Update Backend .env

SSH to server and edit `/var/www/chess-backend/.env`:

```bash
sudo nano /var/www/chess-backend/.env
```

Add/update:
```env
BROADCAST_CONNECTION=reverb

REVERB_APP_ID=874208
REVERB_APP_KEY=anrdh24nppf3obfupvqw
REVERB_APP_SECRET=d8ngbhjm2kfzncggjdui
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=https

VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="api.chess99.com"
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

### Step 2: Create Reverb Systemd Service

```bash
sudo nano /etc/systemd/system/laravel-reverb.service
```

Paste:
```ini
[Unit]
Description=Laravel Reverb WebSocket Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/chess-backend
ExecStart=/usr/bin/php /var/www/chess-backend/artisan reverb:start --host=0.0.0.0 --port=8080
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable laravel-reverb
sudo systemctl start laravel-reverb
sudo systemctl status laravel-reverb
```

### Step 3: Configure Nginx WebSocket Proxy

Edit Nginx config:
```bash
sudo nano /etc/nginx/sites-available/api.chess99.com
```

Add this location block:
```nginx
# Laravel Reverb WebSocket Proxy
location /app/ {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 86400;
    proxy_send_timeout 86400;
}
```

Test and reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## Deployment

After server setup is complete:

```bash
# Commit changes
git add .
git commit -m "Fix WebSocket configuration for production"
git push origin master
```

GitHub Actions will:
1. Deploy frontend with production WebSocket config
2. Clear Laravel caches
3. Restart Reverb service
4. Verify service is running

---

## Verification

### 1. Check Reverb Service:
```bash
sudo systemctl status laravel-reverb
sudo journalctl -u laravel-reverb -f
```

### 2. Check Browser Console:
Visit https://chess99.com, open DevTools Console:

**Before (Broken):**
```
WebSocket config: {wsHost: 'localhost', wsPort: 8080}
[Echo] Failed to initialize
```

**After (Fixed):**
```
WebSocket config: {wsHost: 'api.chess99.com', wsPort: 443, scheme: 'https'}
[Echo] Successfully connected. Socket ID: xxxxx
```

### 3. Test Chess Movement:
- Join a game
- Move a piece
- Should see immediate update on both players' screens
- No page refresh needed

---

## Answer to Your Questions

### Question 1: Should Reverb be in deploy.yml?

**NO** ❌

Reverb should run as a **systemd service** (like Nginx or MySQL). The deploy.yml should only **restart** the service, not start it.

**Why:**
- Reverb needs to run continuously, not just during deployment
- Systemd ensures auto-restart on crashes
- Systemd manages the process lifecycle properly
- Deploy.yml is for deployment automation, not service management

**What deploy.yml should do:**
```yaml
systemctl restart laravel-reverb  # Restart existing service
```

**What it should NOT do:**
```yaml
php artisan reverb:start &  # Wrong! Creates orphan processes
```

### Question 2: Why aren't chess pieces moving?

**Root Cause:** WebSocket configuration mismatch

**Before:**
- Frontend: trying to connect to `localhost:8080` ❌
- Backend: Reverb not running ❌
- Result: Falling back to HTTP polling (slower, not real-time) ❌

**After:**
- Frontend: connects to `wss://api.chess99.com:443` ✅
- Backend: Reverb running as systemd service ✅
- Nginx: proxies WebSocket traffic ✅
- Result: Real-time WebSocket communication ✅

---

## Quick Commands Reference

### On Server:

```bash
# Check Reverb status
sudo systemctl status laravel-reverb

# View Reverb logs
sudo journalctl -u laravel-reverb -f

# Restart Reverb
sudo systemctl restart laravel-reverb

# Check WebSocket port
sudo netstat -tulpn | grep 8080
```

### On Local:

```bash
# Build for production (uses .env.production)
cd chess-frontend
npm run build

# Deploy to server
git push origin master  # Triggers GitHub Actions
```

---

## Troubleshooting

### If Reverb won't start:
```bash
# Check for port conflicts
sudo netstat -tulpn | grep 8080

# Check Laravel logs
tail -f /var/www/chess-backend/storage/logs/laravel.log

# Try manual start to see errors
cd /var/www/chess-backend
php artisan reverb:start
```

### If WebSocket still shows localhost:
1. Clear browser cache (Ctrl+Shift+R)
2. Check deployed build: `cat /var/www/chess99.com/static/js/main.*.js | grep localhost`
3. Verify `.env.production` is committed and deployed

### If chess pieces still don't move:
1. Check browser console for WebSocket errors
2. Verify Echo shows "Successfully connected"
3. Check Reverb logs for authentication errors
4. Test WebSocket: `wscat -c wss://api.chess99.com/app/anrdh24nppf3obfupvqw`

---

## Success Criteria

✅ Reverb service running on server
✅ Frontend connects to `wss://api.chess99.com:443`
✅ Browser console shows "Echo successfully connected"
✅ Chess pieces move in real-time
✅ No "localhost" in production WebSocket config
✅ Nginx proxies WebSocket traffic correctly

---

## Files Modified

1. ✅ `chess-frontend/.env.production` - Production WebSocket config
2. ✅ `.github/workflows/deploy.yml` - Reverb service restart
3. 📝 `docs/reverb-production-setup.md` - Complete setup guide
4. 📝 `WEBSOCKET_FIX_SUMMARY.md` - This summary

## Next Steps

1. **On Server:** Run the 3 setup commands above (backend .env, systemd service, nginx config)
2. **Commit & Push:** `git add . && git commit -m "Fix WebSocket" && git push`
3. **Verify:** Check browser console and test chess movement
4. **Done!** 🎉
