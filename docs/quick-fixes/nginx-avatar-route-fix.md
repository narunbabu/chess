# Nginx Avatar Route Fix

**Issue:** Nginx intercepting `/api/avatars/*` requests before Laravel sees them
**Root Cause:** Nginx static file serving takes precedence over Laravel routing

## The Problem

1. ✅ Route registered: `GET /api/avatars/{filename}`
2. ✅ Files exist in: `storage/app/public/avatars/`
3. ❌ Laravel never receives the request (no logs)
4. ❌ Nginx returns 404 before reaching Laravel

## Solution: Update Nginx Configuration

### Step 1: Check Current Nginx Config

```bash
# View current config
cat /etc/nginx/sites-available/api.chess99.com

# Or find your config file
ls -la /etc/nginx/sites-available/
```

### Step 2: Fix Nginx Config

Your nginx config should route ALL `/api/*` requests to Laravel, including `/api/avatars/*`.

**Add this to your nginx config BEFORE the static file try_files block:**

```nginx
server {
    listen 80;
    listen 443 ssl http2;
    server_name api.chess99.com;

    root /opt/Chess-Web/chess-backend/public;
    index index.php index.html;

    # IMPORTANT: Add this location block FIRST
    # This ensures /api/* requests go to Laravel BEFORE static file checks
    location ~ ^/api/ {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Static files (for /storage/* direct access)
    location ~ ^/storage/ {
        try_files $uri =404;
    }

    # Default PHP handling
    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
    }
}
```

### Step 3: Test and Reload Nginx

```bash
# Test nginx configuration
sudo nginx -t

# If test passes, reload nginx
sudo systemctl reload nginx

# Or restart nginx
sudo systemctl restart nginx
```

### Step 4: Clear Laravel Caches

```bash
cd /opt/Chess-Web/chess-backend

php artisan route:clear
php artisan config:clear
php artisan cache:clear
```

### Step 5: Test Avatar Access

```bash
# Should now reach Laravel and show in logs
curl -v https://api.chess99.com/api/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg

# Check Laravel logs (should see "AVATAR REQUEST" log entry)
tail -20 storage/logs/laravel.log
```

## Alternative Fix: Use Storage Symlink Instead

If you prefer NOT to change nginx config, you can modify the code to use the `/storage/` path instead of `/api/avatars/`:

**Update `UserController.php` line 130:**

```php
// BEFORE:
$fullUrl = url('/api/avatars/' . $filename);

// AFTER:
$fullUrl = url('/storage/avatars/' . $filename);
```

This way:
- Files are already accessible at `/storage/avatars/` via the symlink
- No nginx config change needed
- No Laravel route needed for serving files

## Recommended Solution

**Use the storage symlink approach** because:
1. ✅ No nginx config changes needed
2. ✅ Static files served directly by nginx (faster)
3. ✅ No PHP overhead for serving images
4. ✅ Works immediately

**Update the code:**

```bash
cd /opt/Chess-Web/chess-backend

# Edit UserController.php
# Change line 130 from:
#   $fullUrl = url('/api/avatars/' . $filename);
# To:
#   $fullUrl = url('/storage/avatars/' . $filename);
```

Then test:
```bash
# Test direct storage access
curl https://api.chess99.com/storage/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
```

## Which Approach to Use?

### Use Storage Symlink if:
- You want faster performance (nginx serves files directly)
- You don't need logging for avatar access
- You want simple deployment

### Use Laravel Route if:
- You need access control/authentication
- You want to log avatar access
- You need to process images before serving

For a chess game app, **I recommend the storage symlink approach** for better performance.
