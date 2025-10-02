# Production Deployment Guide - chess99.com

Complete guide for deploying the Chess Web Application to production server at chess99.com.

## Table of Contents

- [Overview](#overview)
- [Server Requirements](#server-requirements)
- [Initial Setup](#initial-setup)
- [Domain Configuration](#domain-configuration)
- [Backend Setup](#backend-setup)
- [Frontend Setup](#frontend-setup)
- [WebSocket Configuration](#websocket-configuration)
- [Nginx Configuration](#nginx-configuration)
- [SSL/TLS Setup](#ssltls-setup)
- [Process Management](#process-management)
- [Deployment Script](#deployment-script)
- [Monitoring & Logs](#monitoring--logs)
- [Troubleshooting](#troubleshooting)

---

## Overview

**Production Domain**: chess99.com

**Infrastructure**:
- Main Site: `https://chess99.com`
- API Backend: `https://api.chess99.com`
- WebSocket: `wss://ws.chess99.com`

**Tech Stack**:
- Frontend: React (served via Nginx)
- Backend: Laravel 11 (PHP 8.3 + PHP-FPM)
- WebSocket: Laravel Reverb
- Database: SQLite (production) / MySQL (optional)
- Web Server: Nginx
- Process Manager: Supervisor / systemd

---

## Server Requirements

### Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install required packages
apt install -y \
  nginx \
  php8.3 \
  php8.3-fpm \
  php8.3-cli \
  php8.3-sqlite3 \
  php8.3-curl \
  php8.3-xml \
  php8.3-mbstring \
  php8.3-zip \
  php8.3-bcmath \
  php8.3-intl \
  composer \
  git \
  supervisor \
  certbot \
  python3-certbot-nginx \
  nodejs \
  npm

# Verify PHP extensions
php -m | grep -E 'curl|dom|sqlite3|mbstring|xml'

# Install pnpm globally
npm install -g pnpm

# Verify installations
php --version        # Should show PHP 8.3.x
nginx -v            # Should show nginx version
node --version      # Should show Node.js version
pnpm --version      # Should show pnpm version
```

### System Requirements

- **OS**: Ubuntu 22.04 LTS or later
- **RAM**: Minimum 2GB (4GB recommended)
- **Storage**: Minimum 10GB free space
- **CPU**: 2 cores minimum

---

## Initial Setup

### 1. Clone Repository

```bash
# Clone to /opt directory
cd /opt
git clone https://github.com/narunbabu/chess.git Chess-Web
cd Chess-Web
git checkout master

# Verify structure
ls -la
# Should show:
# - chess-backend/
# - chess-frontend/
# - docs/
```

### 2. Set Directory Permissions

```bash
# Set ownership to www-data (web server user)
chown -R www-data:www-data /opt/Chess-Web

# Set base permissions
chmod -R 755 /opt/Chess-Web
```

---

## Domain Configuration

### DNS Records

Configure the following DNS A records pointing to your server IP (e.g., 69.62.73.225):

| Record Type | Name | Value | TTL |
|-------------|------|-------|-----|
| A | @ | 69.62.73.225 | 3600 |
| A | www | 69.62.73.225 | 3600 |
| A | api | 69.62.73.225 | 3600 |
| A | ws | 69.62.73.225 | 3600 |

**Verify DNS propagation**:

```bash
dig chess99.com +short
dig www.chess99.com +short
dig api.chess99.com +short
dig ws.chess99.com +short
```

All should return your server IP.

---

## Backend Setup

### 1. Install Dependencies

```bash
cd /opt/Chess-Web/chess-backend

# Install Composer dependencies as www-data user
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp .env.example .env

# Generate application key
php artisan key:generate

# Edit environment file
nano .env
```

**Production `.env` Configuration**:

```env
# Application
APP_NAME="Chess99"
APP_ENV=production
APP_KEY=base64:XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
APP_DEBUG=false
APP_TIMEZONE=UTC
APP_URL=https://api.chess99.com
APP_LOCALE=en
APP_FALLBACK_LOCALE=en
APP_FAKER_LOCALE=en_US

# Frontend
FRONTEND_URL=https://chess99.com

# Database (SQLite)
DB_CONNECTION=sqlite
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=
# DB_USERNAME=
# DB_PASSWORD=

# Broadcasting & WebSocket
BROADCAST_DRIVER=reverb
QUEUE_CONNECTION=sync

# Laravel Reverb
REVERB_APP_ID=chess99-app
REVERB_APP_KEY=your-reverb-app-key-here
REVERB_APP_SECRET=your-reverb-secret-here
REVERB_HOST=ws.chess99.com
REVERB_PORT=8080
REVERB_SCHEME=https

# VITE Configuration (for frontend build)
VITE_REVERB_APP_KEY="${REVERB_APP_KEY}"
VITE_REVERB_HOST="${REVERB_HOST}"
VITE_REVERB_PORT="${REVERB_PORT}"
VITE_REVERB_SCHEME="${REVERB_SCHEME}"

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URL=https://api.chess99.com/auth/google/callback

# Session & Cache
SESSION_DRIVER=file
CACHE_DRIVER=file

# Logging
LOG_CHANNEL=stack
LOG_LEVEL=error
LOG_DEPRECATIONS_CHANNEL=null

# Security
SESSION_LIFETIME=120
SANCTUM_STATEFUL_DOMAINS=chess99.com,www.chess99.com
```

**Generate Reverb credentials**:

```bash
# Generate random strings for Reverb
php -r "echo 'REVERB_APP_KEY=' . bin2hex(random_bytes(16)) . PHP_EOL;"
php -r "echo 'REVERB_APP_SECRET=' . bin2hex(random_bytes(32)) . PHP_EOL;"
```

Update the `.env` file with generated values.

### 3. Database Setup

```bash
# Create SQLite database file
mkdir -p database
touch database/database.sqlite

# Set correct permissions
chown www-data:www-data database/database.sqlite
chmod 664 database/database.sqlite
chown www-data:www-data database/
chmod 775 database/

# Run migrations
sudo -u www-data php artisan migrate --force
```

### 4. Storage and Cache Setup

```bash
# Create storage link
php artisan storage:link

# Set storage permissions
chmod -R 775 storage
chmod -R 775 bootstrap/cache
chown -R www-data:www-data storage
chown -R www-data:www-data bootstrap/cache

# Clear and cache configuration
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 5. Update Google OAuth Redirect URI

In Google Cloud Console (https://console.cloud.google.com):

1. Navigate to **APIs & Services** > **Credentials**
2. Select your OAuth 2.0 Client ID
3. Add authorized redirect URI:
   - `https://api.chess99.com/auth/google/callback`
4. Save changes

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd /opt/Chess-Web/chess-frontend

# Install Node.js dependencies
pnpm install --prod
```

### 2. Environment Configuration

Create production environment file:

```bash
nano .env.production
```

**Production `.env.production` Configuration**:

```env
# API Backend
REACT_APP_BACKEND_URL=https://api.chess99.com/api

# WebSocket Configuration
REACT_APP_WS_HOST=ws.chess99.com
REACT_APP_WS_PORT=443
REACT_APP_WS_SCHEME=wss

# Application
REACT_APP_NAME=Chess99
REACT_APP_ENV=production

# Google OAuth (must match backend)
REACT_APP_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

### 3. Build Production Bundle

```bash
# Build optimized production bundle
pnpm build

# Verify build output
ls -la build/
# Should contain: index.html, static/, favicon.ico, etc.

# Set permissions
chown -R www-data:www-data build/
chmod -R 755 build/
```

---

## WebSocket Configuration

### Reverb Configuration File

Edit `/opt/Chess-Web/chess-backend/config/reverb.php`:

```php
<?php

return [
    'default' => env('REVERB_SERVER', 'reverb'),

    'servers' => [
        'reverb' => [
            'host' => env('REVERB_HOST', '0.0.0.0'),
            'port' => env('REVERB_PORT', 8080),
            'hostname' => env('REVERB_HOSTNAME'),
            'options' => [
                'tls' => [],
            ],
            'scaling' => [
                'enabled' => env('REVERB_SCALING_ENABLED', false),
            ],
            'pulse_ingest_interval' => env('REVERB_PULSE_INGEST_INTERVAL', 15),
            'telescope_ingest_interval' => env('REVERB_TELESCOPE_INGEST_INTERVAL', 15),
        ],
    ],

    'apps' => [
        'provider' => 'config',
        'apps' => [
            [
                'id' => env('REVERB_APP_ID'),
                'key' => env('REVERB_APP_KEY'),
                'secret' => env('REVERB_APP_SECRET'),
                'options' => [
                    'host' => env('REVERB_HOST'),
                    'port' => env('REVERB_PORT', 8080),
                    'scheme' => env('REVERB_SCHEME', 'https'),
                    'useTLS' => env('REVERB_SCHEME') === 'https',
                ],
                'allowed_origins' => ['*'],
                'ping_interval' => env('REVERB_APP_PING_INTERVAL', 60),
                'max_message_size' => env('REVERB_APP_MAX_MESSAGE_SIZE', 10000),
            ],
        ],
    ],
];
```

---

## Nginx Configuration

### Main Configuration File

Create `/etc/nginx/sites-available/chess99.com`:

```nginx
# Frontend - Main Website
server {
    listen 80;
    listen [::]:80;
    server_name chess99.com www.chess99.com;

    # Redirect to HTTPS (will be added by Certbot)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name chess99.com www.chess99.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/chess99.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/chess99.com/privkey.pem;

    root /opt/Chess-Web/chess-frontend/build;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Main location - SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Static assets with long-term caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        access_log off;
    }

    # Disable access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }
}

# Backend API
server {
    listen 80;
    listen [::]:80;
    server_name api.chess99.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.chess99.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/api.chess99.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/api.chess99.com/privkey.pem;

    root /opt/Chess-Web/chess-backend/public;
    index index.php;

    # Increase max upload size
    client_max_body_size 20M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # CORS headers (adjust as needed)
    add_header Access-Control-Allow-Origin "https://chess99.com" always;
    add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Handle preflight requests
    if ($request_method = 'OPTIONS') {
        add_header Access-Control-Allow-Origin "https://chess99.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "Authorization, Content-Type, X-Requested-With" always;
        add_header Access-Control-Max-Age 86400;
        add_header Content-Length 0;
        add_header Content-Type text/plain;
        return 204;
    }

    # Laravel routing
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # PHP processing
    location ~ \.php$ {
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
        fastcgi_hide_header X-Powered-By;
        fastcgi_buffer_size 32k;
        fastcgi_buffers 4 32k;
        fastcgi_read_timeout 300;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        access_log off;
        log_not_found off;
    }

    # Deny access to sensitive files
    location ~ /(?:\.env|\.git|composer\.json|composer\.lock|package\.json|package-lock\.json|phpunit\.xml) {
        deny all;
    }
}

# WebSocket Server (Reverb)
server {
    listen 80;
    listen [::]:80;
    server_name ws.chess99.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name ws.chess99.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/ws.chess99.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/ws.chess99.com/privkey.pem;

    # WebSocket proxy
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_connect_timeout 86400;
        proxy_send_timeout 86400;

        # CORS for WebSocket
        add_header Access-Control-Allow-Origin "https://chess99.com" always;
        add_header Access-Control-Allow-Credentials "true" always;
    }
}
```

### Enable Site and Restart Nginx

```bash
# Create symbolic link to enable site
ln -s /etc/nginx/sites-available/chess99.com /etc/nginx/sites-enabled/

# Remove default site if exists
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# If test passes, restart Nginx
systemctl restart nginx

# Enable Nginx to start on boot
systemctl enable nginx
```

---

## SSL/TLS Setup

### Install SSL Certificates with Let's Encrypt

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Obtain SSL certificates for all domains
certbot --nginx -d chess99.com -d www.chess99.com
certbot --nginx -d api.chess99.com
certbot --nginx -d ws.chess99.com

# During installation, choose:
# - Email: your-email@example.com
# - Agree to terms: Yes
# - Share email: Your choice
# - Redirect HTTP to HTTPS: Yes (option 2)

# Verify certificates
certbot certificates

# Test auto-renewal
certbot renew --dry-run

# Auto-renewal is already configured via systemd timer
systemctl status certbot.timer
```

### Manual SSL Configuration (if needed)

If Certbot doesn't automatically configure SSL, add these lines to the HTTPS server blocks:

```nginx
ssl_certificate /etc/letsencrypt/live/chess99.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/chess99.com/privkey.pem;
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers HIGH:!aNULL:!MD5;
ssl_prefer_server_ciphers on;
```

---

## Process Management

Laravel Reverb WebSocket server needs to run continuously. Use Supervisor or systemd.

### Option 1: Supervisor (Recommended)

```bash
# Install Supervisor
apt install -y supervisor

# Create Supervisor configuration
cat > /etc/supervisor/conf.d/laravel-reverb.conf << 'EOF'
[program:laravel-reverb]
process_name=%(program_name)s_%(process_num)02d
command=php /opt/Chess-Web/chess-backend/artisan reverb:start
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=1
redirect_stderr=true
stdout_logfile=/opt/Chess-Web/chess-backend/storage/logs/reverb.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=5
stopwaitsecs=3600
EOF

# Update Supervisor
supervisorctl reread
supervisorctl update

# Start Reverb
supervisorctl start laravel-reverb:*

# Check status
supervisorctl status laravel-reverb:*

# Useful Supervisor commands:
# supervisorctl restart laravel-reverb:*
# supervisorctl stop laravel-reverb:*
# supervisorctl tail -f laravel-reverb:* stdout
```

### Option 2: systemd Service

```bash
# Create systemd service file
cat > /etc/systemd/system/laravel-reverb.service << 'EOF'
[Unit]
Description=Laravel Reverb WebSocket Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/opt/Chess-Web/chess-backend
ExecStart=/usr/bin/php artisan reverb:start
Restart=always
RestartSec=3
StandardOutput=append:/opt/Chess-Web/chess-backend/storage/logs/reverb.log
StandardError=append:/opt/Chess-Web/chess-backend/storage/logs/reverb-error.log
TimeoutStopSec=3600

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd
systemctl daemon-reload

# Enable service to start on boot
systemctl enable laravel-reverb

# Start service
systemctl start laravel-reverb

# Check status
systemctl status laravel-reverb

# Useful systemd commands:
# systemctl restart laravel-reverb
# systemctl stop laravel-reverb
# journalctl -u laravel-reverb -f  # Follow logs
```

---

## Deployment Script

Create automated deployment script for future updates.

### Create Deploy Script

```bash
# Create script file
nano /opt/Chess-Web/deploy.sh
```

**Deployment Script Content**:

```bash
#!/bin/bash
#
# Production Deployment Script for chess99.com
# Location: /opt/Chess-Web/deploy.sh
#

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}🚀 Chess99 Deployment Script${NC}"
echo -e "${GREEN}========================================${NC}"

# Confirmation prompt
read -p "Deploy to production? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Step 1: Pull latest code
echo -e "\n${YELLOW}📥 Pulling latest code from GitHub...${NC}"
cd /opt/Chess-Web
git fetch origin
git pull origin master

# Step 2: Backend deployment
echo -e "\n${YELLOW}📦 Deploying Backend...${NC}"
cd /opt/Chess-Web/chess-backend

# Install/update dependencies
echo "  → Installing Composer dependencies..."
sudo -u www-data COMPOSER_HOME=/var/www composer install --no-dev --optimize-autoloader --no-interaction

# Run database migrations
echo "  → Running database migrations..."
sudo -u www-data php artisan migrate --force

# Clear caches
echo "  → Clearing caches..."
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Optimize for production
echo "  → Optimizing application..."
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Step 3: Frontend deployment
echo -e "\n${YELLOW}🏗️  Deploying Frontend...${NC}"
cd /opt/Chess-Web/chess-frontend

# Install dependencies
echo "  → Installing npm dependencies..."
pnpm install --prod

# Build production bundle
echo "  → Building production bundle..."
pnpm build

# Step 4: Set permissions
echo -e "\n${YELLOW}🔐 Setting correct permissions...${NC}"
chown -R www-data:www-data /opt/Chess-Web/chess-backend/storage
chown -R www-data:www-data /opt/Chess-Web/chess-backend/bootstrap/cache
chown -R www-data:www-data /opt/Chess-Web/chess-frontend/build
chmod -R 775 /opt/Chess-Web/chess-backend/storage
chmod -R 775 /opt/Chess-Web/chess-backend/bootstrap/cache
chmod 664 /opt/Chess-Web/chess-backend/database/database.sqlite

# Step 5: Restart services
echo -e "\n${YELLOW}🔄 Restarting services...${NC}"

# Restart PHP-FPM
echo "  → Restarting PHP-FPM..."
systemctl restart php8.3-fpm

# Restart Reverb (choose one based on your setup)
if systemctl list-units --full -all | grep -q laravel-reverb.service; then
    echo "  → Restarting Laravel Reverb (systemd)..."
    systemctl restart laravel-reverb
elif command -v supervisorctl &> /dev/null; then
    echo "  → Restarting Laravel Reverb (supervisor)..."
    supervisorctl restart laravel-reverb:*
fi

# Reload Nginx
echo "  → Reloading Nginx..."
systemctl reload nginx

# Step 6: Health checks
echo -e "\n${YELLOW}🏥 Running health checks...${NC}"

# Check if Nginx is running
if systemctl is-active --quiet nginx; then
    echo -e "  ${GREEN}✓${NC} Nginx is running"
else
    echo -e "  ${RED}✗${NC} Nginx is not running"
fi

# Check if PHP-FPM is running
if systemctl is-active --quiet php8.3-fpm; then
    echo -e "  ${GREEN}✓${NC} PHP-FPM is running"
else
    echo -e "  ${RED}✗${NC} PHP-FPM is not running"
fi

# Check if Reverb is running
if systemctl is-active --quiet laravel-reverb 2>/dev/null || supervisorctl status laravel-reverb:* 2>/dev/null | grep -q RUNNING; then
    echo -e "  ${GREEN}✓${NC} Laravel Reverb is running"
else
    echo -e "  ${RED}✗${NC} Laravel Reverb is not running"
fi

# Test API endpoint
echo "  → Testing API endpoint..."
API_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://api.chess99.com/api/debug/oauth-config || echo "000")
if [ "$API_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} API is responding (HTTP $API_RESPONSE)"
else
    echo -e "  ${YELLOW}⚠${NC} API response: HTTP $API_RESPONSE"
fi

# Test frontend
echo "  → Testing frontend..."
FRONTEND_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://chess99.com || echo "000")
if [ "$FRONTEND_RESPONSE" = "200" ]; then
    echo -e "  ${GREEN}✓${NC} Frontend is responding (HTTP $FRONTEND_RESPONSE)"
else
    echo -e "  ${YELLOW}⚠${NC} Frontend response: HTTP $FRONTEND_RESPONSE"
fi

# Final summary
echo -e "\n${GREEN}========================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo -e "\nDeployed to:"
echo -e "  • Frontend: https://chess99.com"
echo -e "  • API: https://api.chess99.com"
echo -e "  • WebSocket: wss://ws.chess99.com"
echo -e "\nMonitor logs:"
echo -e "  • Laravel: tail -f /opt/Chess-Web/chess-backend/storage/logs/laravel.log"
echo -e "  • Reverb: tail -f /opt/Chess-Web/chess-backend/storage/logs/reverb.log"
echo -e "  • Nginx: tail -f /var/log/nginx/error.log"
echo ""
```

### Make Script Executable

```bash
chmod +x /opt/Chess-Web/deploy.sh
```

### Run Deployment

```bash
# Deploy
/opt/Chess-Web/deploy.sh

# Or with sudo if needed
sudo /opt/Chess-Web/deploy.sh
```

---

## Monitoring & Logs

### Log Locations

```bash
# Laravel application logs
/opt/Chess-Web/chess-backend/storage/logs/laravel.log

# Laravel Reverb WebSocket logs
/opt/Chess-Web/chess-backend/storage/logs/reverb.log
/opt/Chess-Web/chess-backend/storage/logs/reverb-error.log

# Nginx access logs
/var/log/nginx/access.log

# Nginx error logs
/var/log/nginx/error.log

# PHP-FPM logs
/var/log/php8.3-fpm.log

# Supervisor logs (if using Supervisor)
/var/log/supervisor/supervisord.log

# systemd journal (if using systemd)
journalctl -u laravel-reverb
journalctl -u nginx
journalctl -u php8.3-fpm
```

### Real-time Log Monitoring

```bash
# Laravel logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/laravel.log

# Reverb WebSocket logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/reverb.log

# Nginx error logs
tail -f /var/log/nginx/error.log

# PHP-FPM logs
tail -f /var/log/php8.3-fpm.log

# All Laravel logs combined
tail -f /opt/Chess-Web/chess-backend/storage/logs/*.log

# systemd Reverb logs (if using systemd)
journalctl -u laravel-reverb -f

# Supervisor logs (if using Supervisor)
supervisorctl tail -f laravel-reverb:* stdout
```

### Log Rotation

Laravel logs are automatically rotated. Configure additional rotation:

```bash
# Create log rotation config
cat > /etc/logrotate.d/chess99 << 'EOF'
/opt/Chess-Web/chess-backend/storage/logs/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    sharedscripts
}
EOF
```

### Health Monitoring Script

Create `/opt/Chess-Web/health-check.sh`:

```bash
#!/bin/bash
# Health monitoring script

echo "=== Chess99 Health Check ==="
echo ""

# Check Nginx
if systemctl is-active --quiet nginx; then
    echo "✓ Nginx: Running"
else
    echo "✗ Nginx: Stopped"
fi

# Check PHP-FPM
if systemctl is-active --quiet php8.3-fpm; then
    echo "✓ PHP-FPM: Running"
else
    echo "✗ PHP-FPM: Stopped"
fi

# Check Reverb
if systemctl is-active --quiet laravel-reverb 2>/dev/null; then
    echo "✓ Reverb (systemd): Running"
elif supervisorctl status laravel-reverb:* 2>/dev/null | grep -q RUNNING; then
    echo "✓ Reverb (supervisor): Running"
else
    echo "✗ Reverb: Stopped"
fi

# Check disk space
echo ""
echo "Disk Usage:"
df -h /opt/Chess-Web | tail -1

# Check database size
if [ -f /opt/Chess-Web/chess-backend/database/database.sqlite ]; then
    DB_SIZE=$(du -h /opt/Chess-Web/chess-backend/database/database.sqlite | cut -f1)
    echo "Database Size: $DB_SIZE"
fi

# Recent errors
echo ""
echo "Recent Laravel Errors (last 5):"
grep -i "error" /opt/Chess-Web/chess-backend/storage/logs/laravel.log | tail -5 || echo "No errors found"
```

```bash
chmod +x /opt/Chess-Web/health-check.sh
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. 502 Bad Gateway (Nginx)

**Cause**: PHP-FPM not running or socket misconfigured

**Solution**:
```bash
# Check PHP-FPM status
systemctl status php8.3-fpm

# Restart PHP-FPM
systemctl restart php8.3-fpm

# Check socket exists
ls -la /run/php/php8.3-fpm.sock

# Check Nginx error logs
tail -f /var/log/nginx/error.log
```

#### 2. WebSocket Connection Failed

**Cause**: Reverb not running or firewall blocking

**Solution**:
```bash
# Check Reverb status
systemctl status laravel-reverb
# OR
supervisorctl status laravel-reverb:*

# Restart Reverb
systemctl restart laravel-reverb
# OR
supervisorctl restart laravel-reverb:*

# Check if port 8080 is listening
netstat -tlnp | grep 8080

# Check Reverb logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/reverb.log
```

#### 3. CORS Errors

**Cause**: Incorrect CORS headers or domain mismatch

**Solution**:
```bash
# Check .env configuration
grep -E "(FRONTEND_URL|APP_URL)" /opt/Chess-Web/chess-backend/.env

# Should show:
# APP_URL=https://api.chess99.com
# FRONTEND_URL=https://chess99.com

# Update Nginx CORS headers in /etc/nginx/sites-available/chess99.com
# Then reload Nginx
nginx -t && systemctl reload nginx
```

#### 4. OAuth Login Fails

**Cause**: Redirect URI mismatch or missing database columns

**Solution**:
```bash
# Check Laravel logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/laravel.log

# Run migrations
cd /opt/Chess-Web/chess-backend
sudo -u www-data php artisan migrate --force

# Verify Google OAuth settings in .env
grep GOOGLE_ .env

# Ensure redirect URI in Google Console matches:
# https://api.chess99.com/auth/google/callback
```

#### 5. Permission Denied Errors

**Cause**: Incorrect file ownership or permissions

**Solution**:
```bash
# Fix backend permissions
cd /opt/Chess-Web/chess-backend
chown -R www-data:www-data storage bootstrap/cache database
chmod -R 775 storage bootstrap/cache
chmod 664 database/database.sqlite

# Fix frontend permissions
chown -R www-data:www-data /opt/Chess-Web/chess-frontend/build
chmod -R 755 /opt/Chess-Web/chess-frontend/build
```

#### 6. Database Migration Errors

**Cause**: Duplicate columns or constraint violations

**Solution**:
```bash
# Check migration status
php artisan migrate:status

# Rollback last migration
sudo -u www-data php artisan migrate:rollback --step=1

# Re-run migrations
sudo -u www-data php artisan migrate --force

# Fresh migrations (DANGEROUS - deletes all data)
# sudo -u www-data php artisan migrate:fresh --force
```

#### 7. SSL Certificate Issues

**Cause**: Expired certificates or renewal failed

**Solution**:
```bash
# Check certificate status
certbot certificates

# Renew certificates
certbot renew

# Force renewal for specific domain
certbot renew --cert-name chess99.com --force-renewal

# Test auto-renewal
certbot renew --dry-run
```

#### 8. High Memory Usage

**Cause**: PHP-FPM or Reverb consuming too much memory

**Solution**:
```bash
# Check memory usage
free -h
top -o %MEM

# Restart services
systemctl restart php8.3-fpm
systemctl restart laravel-reverb

# Optimize PHP-FPM pool settings in /etc/php/8.3/fpm/pool.d/www.conf
# Adjust: pm.max_children, pm.start_servers, pm.min_spare_servers
```

### Emergency Rollback

If deployment causes issues:

```bash
# Go to Chess-Web directory
cd /opt/Chess-Web

# Check git log
git log --oneline -10

# Rollback to previous commit
git reset --hard <previous-commit-hash>

# Re-run deployment
./deploy.sh
```

### Debug Mode (Temporary)

**⚠️ NEVER leave debug mode enabled in production!**

```bash
# Enable debug temporarily
cd /opt/Chess-Web/chess-backend
sed -i 's/APP_DEBUG=false/APP_DEBUG=true/' .env
php artisan config:clear

# Check logs for detailed errors
tail -f storage/logs/laravel.log

# DISABLE debug after troubleshooting
sed -i 's/APP_DEBUG=true/APP_DEBUG=false/' .env
php artisan config:clear
```

---

## Maintenance Tasks

### Regular Maintenance Checklist

**Weekly**:
- Check disk space: `df -h`
- Review error logs
- Verify backups are running
- Check SSL certificate expiry: `certbot certificates`

**Monthly**:
- Update system packages: `apt update && apt upgrade`
- Review and clean old logs
- Check database size and optimize if needed
- Review security advisories

### Database Backup

```bash
# Create backup script
cat > /opt/Chess-Web/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/opt/Chess-Web/backups"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Backup database
cp /opt/Chess-Web/chess-backend/database/database.sqlite \
   $BACKUP_DIR/database_$DATE.sqlite

# Compress old backups (older than 1 day)
find $BACKUP_DIR -name "*.sqlite" -mtime +1 -exec gzip {} \;

# Delete backups older than 30 days
find $BACKUP_DIR -name "*.gz" -mtime +30 -delete

echo "Backup completed: database_$DATE.sqlite"
EOF

chmod +x /opt/Chess-Web/backup.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/Chess-Web/backup.sh") | crontab -
```

### System Updates

```bash
# Update system packages
apt update
apt upgrade -y

# Update Composer dependencies
cd /opt/Chess-Web/chess-backend
composer update --no-dev

# Update npm packages
cd /opt/Chess-Web/chess-frontend
pnpm update

# Rebuild frontend
pnpm build

# Restart services
systemctl restart php8.3-fpm nginx laravel-reverb
```

---

## Security Hardening

### Firewall Configuration (UFW)

```bash
# Install UFW
apt install -y ufw

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (IMPORTANT: Do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status verbose
```

### Fail2Ban (Brute Force Protection)

```bash
# Install Fail2Ban
apt install -y fail2ban

# Create local config
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

# Edit configuration
nano /etc/fail2ban/jail.local

# Add Nginx jail:
cat >> /etc/fail2ban/jail.local << 'EOF'

[nginx-http-auth]
enabled = true

[nginx-noscript]
enabled = true

[nginx-badbots]
enabled = true

[nginx-noproxy]
enabled = true
EOF

# Restart Fail2Ban
systemctl restart fail2ban

# Check status
fail2ban-client status
```

---

## Contact & Support

**Deployment Issues**: Check logs and troubleshooting section above

**Production Monitoring**: Set up tools like:
- Uptime monitoring: UptimeRobot, Pingdom
- Error tracking: Sentry, Bugsnag
- Analytics: Google Analytics, Plausible

**Server Access**:
- SSH: `ssh root@69.62.73.225`
- Web: https://chess99.com

---

## Appendix

### Quick Reference Commands

```bash
# Deploy new version
/opt/Chess-Web/deploy.sh

# Check service status
systemctl status nginx php8.3-fpm laravel-reverb

# Restart all services
systemctl restart nginx php8.3-fpm laravel-reverb

# View logs
tail -f /opt/Chess-Web/chess-backend/storage/logs/laravel.log
tail -f /opt/Chess-Web/chess-backend/storage/logs/reverb.log

# Clear Laravel caches
cd /opt/Chess-Web/chess-backend
php artisan optimize:clear

# Run migrations
cd /opt/Chess-Web/chess-backend
sudo -u www-data php artisan migrate --force

# Health check
/opt/Chess-Web/health-check.sh

# Database backup
/opt/Chess-Web/backup.sh
```

### Environment Comparison

| Aspect | Local Development | Production (chess99.com) |
|--------|------------------|--------------------------|
| Domain | localhost:3000 | https://chess99.com |
| API | localhost:8000 | https://api.chess99.com |
| WebSocket | localhost:8080 | wss://ws.chess99.com |
| Database | SQLite | SQLite |
| Web Server | `php artisan serve` | Nginx + PHP-FPM |
| Process Manager | Manual | Supervisor/systemd |
| SSL | None | Let's Encrypt |
| Debug Mode | Enabled | Disabled |

---

**Last Updated**: 2025-10-02
**Version**: 1.0
**Deployment Target**: chess99.com
