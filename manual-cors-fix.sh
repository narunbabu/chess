#!/bin/bash
# Manual CORS fix script - Run this directly on the production server
# This will check and fix CORS headers for avatar images

echo "🔧 Manual CORS Fix for api.chess99.com"
echo "========================================"
echo ""

# Step 1: Check current nginx config
echo "📋 Step 1: Checking current nginx configuration..."
if grep -q "Access-Control-Allow-Origin" /etc/nginx/sites-available/api.chess99.com; then
    echo "✅ CORS headers found in config file"
else
    echo "❌ CORS headers NOT found in config file"
    echo "⚠️  The nginx config was not properly updated!"
fi
echo ""

# Step 2: Test current CORS headers
echo "📋 Step 2: Testing current CORS headers..."
CORS_TEST=$(curl -s -I -H "Origin: https://chess99.com" https://api.chess99.com/storage/avatars/test.jpg 2>&1 | grep -i "access-control-allow-origin")
if [ -n "$CORS_TEST" ]; then
    echo "✅ CORS headers are being sent: $CORS_TEST"
    echo "✅ No fix needed!"
    exit 0
else
    echo "❌ CORS headers are NOT being sent"
    echo "⚠️  Need to fix nginx configuration"
fi
echo ""

# Step 3: Backup current config
echo "📋 Step 3: Backing up current configuration..."
sudo cp /etc/nginx/sites-available/api.chess99.com /etc/nginx/sites-available/api.chess99.com.backup-manual-$(date +%Y%m%d-%H%M%S)
echo "✅ Backup created"
echo ""

# Step 4: Create fixed config
echo "📋 Step 4: Creating fixed nginx configuration..."
sudo tee /etc/nginx/sites-available/api.chess99.com > /dev/null <<'NGINX_EOF'
# =======================
# HTTP -> HTTPS redirect
# /etc/nginx/sites-available/api.chess99.com
# =======================
server {
    listen 80;
    listen [::]:80;
    server_name api.chess99.com;
    return 301 https://$host$request_uri;
}

# =======================
# HTTPS App Server
# =======================
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.chess99.com;

    # --- SSL (Certbot) ---
    ssl_certificate /etc/letsencrypt/live/api.chess99.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.chess99.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    # --- Laravel public dir ---
    root /opt/Chess-Web/chess-backend/public;
    index index.php;

    # --- CORS headers for ALL responses (including storage) ---
    add_header Access-Control-Allow-Origin "https://chess99.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With" always;

    # --- Handle OPTIONS preflight for CORS ---
    if ($request_method = OPTIONS) {
        add_header Access-Control-Allow-Origin "https://chess99.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Origin, Content-Type, Authorization, X-Requested-With" always;
        add_header Access-Control-Max-Age 3600;
        return 204;
    }

    # --- Storage files (avatars, shared-results, etc.) ---
    location ~ ^/storage/ {
        expires 1y;
        access_log off;
        try_files $uri =404;
    }

    # --- Avatar serving via Laravel ---
    location /api/avatars/ {
        try_files $uri /index.php?$query_string;
    }

    # --- Route ALL non-files to Laravel ---
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # --- PHP-FPM ---
    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    # --- Static files (optional cache) ---
    location ~* \.(?:jpg|jpeg|png|gif|ico|css|js|woff2?|ttf|svg)$ {
        expires 30d;
        access_log off;
        try_files $uri =404;
    }

    # --- Hide dotfiles except ACME ---
    location ~ /\.(?!well-known) {
        deny all;
    }

    # --- Laravel Reverb WebSocket proxy (/app) ---
    location /app {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        if ($request_method = OPTIONS) {
            add_header Access-Control-Allow-Origin "https://chess99.com" always;
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS" always;
            add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
            return 204;
        }
    }
}
NGINX_EOF

echo "✅ Fixed configuration created"
echo ""

# Step 5: Test nginx configuration
echo "📋 Step 5: Testing nginx configuration..."
sudo nginx -t
if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid!"
else
    echo "❌ Nginx configuration test failed!"
    echo "⚠️  Restoring backup..."
    sudo cp /etc/nginx/sites-available/api.chess99.com.backup-manual-* /etc/nginx/sites-available/api.chess99.com
    exit 1
fi
echo ""

# Step 6: Reload nginx
echo "📋 Step 6: Reloading nginx..."
sudo systemctl reload nginx
if [ $? -eq 0 ]; then
    echo "✅ Nginx reloaded successfully!"
else
    echo "❌ Nginx reload failed!"
    exit 1
fi
echo ""

# Step 7: Test CORS headers again
echo "📋 Step 7: Testing CORS headers again..."
sleep 2
CORS_TEST_AFTER=$(curl -s -I -H "Origin: https://chess99.com" https://api.chess99.com/storage/avatars/test.jpg 2>&1 | grep -i "access-control-allow-origin")
if [ -n "$CORS_TEST_AFTER" ]; then
    echo "✅ CORS headers are now being sent!"
    echo "✅ $CORS_TEST_AFTER"
    echo ""
    echo "🎉 CORS fix successful!"
    echo ""
    echo "📝 Test it now:"
    echo "1. Go to https://chess99.com/game-review/{game_id}"
    echo "2. Click 'Test Share'"
    echo "3. Check browser console - should see images convert successfully!"
else
    echo "❌ CORS headers are STILL not being sent"
    echo "⚠️  There may be another issue. Check nginx error logs:"
    echo "   sudo tail -50 /var/log/nginx/error.log"
fi
