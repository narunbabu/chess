# Laravel Reverb Production Setup Guide

## Issue Summary
Chess piece movement not working due to WebSocket/Reverb misconfiguration:
- Frontend connecting to `localhost:8080` instead of production server
- Reverb service not running on production
- Missing production environment variables

---

## Backend Configuration

### 1. Update `/var/www/chess-backend/.env` on Server

Add/update these Reverb settings:

```bash
# Broadcasting
BROADCAST_CONNECTION=reverb

# Laravel Reverb Configuration (Production)
REVERB_APP_ID=874208
REVERB_APP_KEY=anrdh24nppf3obfupvqw
REVERB_APP_SECRET=d8ngbhjm2kfzncggjdui
REVERB_HOST=0.0.0.0
REVERB_PORT=8080
REVERB_SCHEME=https

# Reverb timeout settings
REVERB_APP_PING_INTERVAL=30
REVERB_APP_ACTIVITY_TIMEOUT=120

# Vite variables (for frontend build)
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="api.chess99.com"
VITE_REVERB_PORT=443
VITE_REVERB_SCHEME=https
```

**Important Notes:**
- `REVERB_HOST=0.0.0.0` - Listen on all interfaces
- `REVERB_PORT=8080` - Internal port (Nginx will proxy)
- `REVERB_SCHEME=https` - Use secure WebSocket (wss://)
- `VITE_REVERB_HOST=api.chess99.com` - Public domain name
- `VITE_REVERB_PORT=443` - HTTPS/WSS port

---

## 2. Create Systemd Service for Reverb

### Create service file:
```bash
sudo nano /etc/systemd/system/laravel-reverb.service
```

### Add this content:
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
SyslogIdentifier=laravel-reverb

# Performance tuning
LimitNOFILE=65535
TimeoutStopSec=30

[Install]
WantedBy=multi-user.target
```

### Enable and start service:
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service to start on boot
sudo systemctl enable laravel-reverb

# Start service
sudo systemctl start laravel-reverb

# Check status
sudo systemctl status laravel-reverb

# View logs
sudo journalctl -u laravel-reverb -f
```

---

## 3. Configure Nginx WebSocket Proxy

### Update `/etc/nginx/sites-available/api.chess99.com`:

Add this location block for WebSocket:

```nginx
server {
    listen 443 ssl http2;
    server_name api.chess99.com;

    # ... existing SSL and PHP-FPM configuration ...

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

    # Broadcasting auth endpoint
    location /api/broadcasting/auth {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # ... rest of configuration ...
}
```

### Test and reload Nginx:
```bash
# Test configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 4. Update Deploy Script (deploy.yml)

**DO NOT** start Reverb in deploy.yml. Instead, restart the service:

```yaml
# In .github/workflows/deploy.yml

- name: Deploy Backend
  run: |
    # ... existing deployment steps ...

    # Clear Laravel caches
    /usr/bin/php /var/www/chess-backend/artisan config:clear
    /usr/bin/php /var/www/chess-backend/artisan route:clear
    /usr/bin/php /var/www/chess-backend/artisan cache:clear

    # Restart Reverb service (systemd manages the service)
    sudo systemctl restart laravel-reverb

    # Check Reverb is running
    sudo systemctl is-active laravel-reverb || echo "Warning: Reverb not running"
```

---

## 5. Frontend Build Configuration

The frontend `.env.production` file has been created with:

```env
REACT_APP_BACKEND_URL=https://api.chess99.com/api
REACT_APP_REVERB_APP_KEY=anrdh24nppf3obfupvqw
REACT_APP_REVERB_HOST=api.chess99.com
REACT_APP_REVERB_PORT=443
REACT_APP_REVERB_SCHEME=https
REACT_APP_USE_POLLING_FALLBACK=false
```

**Production build will now use these values automatically.**

---

## 6. Firewall Configuration

Ensure port 8080 is NOT exposed externally (Nginx proxies it):

```bash
# Check firewall
sudo ufw status

# Allow HTTPS (443) - should already be open
sudo ufw allow 443/tcp

# Make sure 8080 is NOT publicly exposed
# (It should only be accessible from localhost via Nginx)
```

---

## Deployment Steps

### On Server:

1. **Update backend .env:**
   ```bash
   sudo nano /var/www/chess-backend/.env
   # Add Reverb configuration from above
   ```

2. **Create and start Reverb service:**
   ```bash
   sudo nano /etc/systemd/system/laravel-reverb.service
   # Add service configuration
   sudo systemctl daemon-reload
   sudo systemctl enable laravel-reverb
   sudo systemctl start laravel-reverb
   sudo systemctl status laravel-reverb
   ```

3. **Configure Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/api.chess99.com
   # Add WebSocket proxy configuration
   sudo nginx -t
   sudo systemctl reload nginx
   ```

4. **Test WebSocket connection:**
   ```bash
   # Check Reverb logs
   sudo journalctl -u laravel-reverb -f

   # Test WebSocket endpoint
   curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
     https://api.chess99.com/app/anrdh24nppf3obfupvqw
   ```

### On Local Machine:

5. **Rebuild and deploy frontend:**
   ```bash
   cd chess-frontend
   npm run build  # Uses .env.production automatically

   # Deploy will sync build files to server
   git add .env.production
   git commit -m "Add production WebSocket configuration"
   git push origin master  # Triggers GitHub Actions
   ```

---

## Verification

### Check Reverb Service:
```bash
sudo systemctl status laravel-reverb
sudo journalctl -u laravel-reverb -n 50
```

### Test WebSocket Connection:
```bash
# From browser console on https://chess99.com
const ws = new WebSocket('wss://api.chess99.com/app/anrdh24nppf3obfupvqw');
ws.onopen = () => console.log('Connected!');
ws.onerror = (err) => console.error('Error:', err);
```

### Check Frontend Console:
After deployment, check browser console:
- ✅ Should see: `[Echo] Successfully connected. Socket ID: xxx`
- ✅ Should see: `WebSocket config: {host: 'api.chess99.com', port: 443, scheme: 'https'}`
- ❌ Should NOT see: `localhost` in WebSocket config

---

## Troubleshooting

### Reverb Not Starting:
```bash
# Check logs
sudo journalctl -u laravel-reverb -n 100

# Check port availability
sudo netstat -tulpn | grep 8080

# Restart service
sudo systemctl restart laravel-reverb
```

### WebSocket Connection Fails:
```bash
# Check Nginx config
sudo nginx -t

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify Reverb is running
curl http://localhost:8080/app/anrdh24nppf3obfupvqw
```

### Chess Pieces Still Not Moving:
1. Clear browser cache and hard reload (Ctrl+Shift+R)
2. Check browser console for errors
3. Verify `.env.production` values in deployed build
4. Check Reverb logs for authentication errors

---

## Summary

**Before (Broken):**
- ❌ Frontend connecting to `localhost:8080` in production
- ❌ No Reverb service running
- ❌ No WebSocket proxy configuration

**After (Fixed):**
- ✅ Frontend connects to `wss://api.chess99.com:443`
- ✅ Reverb service managed by systemd
- ✅ Nginx proxies WebSocket traffic
- ✅ Production environment variables configured
- ✅ Chess pieces move in real-time via WebSocket

**Key Files Modified:**
1. `chess-frontend/.env.production` - Production WebSocket config
2. `/var/www/chess-backend/.env` - Backend Reverb settings
3. `/etc/systemd/system/laravel-reverb.service` - Service definition
4. `/etc/nginx/sites-available/api.chess99.com` - WebSocket proxy
5. `.github/workflows/deploy.yml` - Restart Reverb after deploy
