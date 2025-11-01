# Avatar 404 Diagnostic Steps

**Issue:** Profile update returns 200 OK, but avatar URL returns 404 Not Found
**Date:** 2025-11-01

## Quick Diagnostic Commands (Run on Production Server)

### 1. Check Laravel Logs for Profile Update
```bash
cd /path/to/chess-backend

# Check recent profile update logs
tail -100 storage/logs/laravel.log | grep -A 20 "PROFILE UPDATE CONTROLLER"

# Look for these key log entries:
# - "New avatar stored:" (should show file path and URL)
# - "storage_exists: true" (confirms Storage facade sees the file)
# - "file_exists: true" (confirms physical file exists)
# - "file_readable: true" (confirms file is readable)
```

### 2. Check Avatar Request Logs
```bash
# Check what happens when browser requests the avatar
tail -100 storage/logs/laravel.log | grep -A 10 "AVATAR REQUEST"

# Look for:
# - "Avatar served successfully" (good!)
# - "Avatar file not found" (file doesn't exist)
# - "Avatar file not readable" (permission issue)
```

### 3. Verify File Actually Exists
```bash
# List all avatar files
ls -la storage/app/public/avatars/

# Expected output should show:
# drwxr-xr-x (755) for directory
# -rw-r--r-- (644) for files

# Check specific file from the 404 error
ls -la storage/app/public/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
```

### 4. Check File Permissions
```bash
# Get detailed permission info
stat storage/app/public/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg

# Check directory permissions
stat storage/app/public/avatars/
```

### 5. Test Route Registration
```bash
# Verify the avatar route is registered
curl -I https://api.chess99.com/api/avatars/test.jpg

# Should return either:
# - 404 with JSON response (route works, file not found) ✓
# - 404 with HTML (route not registered) ✗
```

## Common Scenarios and Solutions

### Scenario 1: File Doesn't Exist
**Symptoms:**
- Logs show "Avatar file not found"
- `ls` command shows file is missing

**Likely Causes:**
- Storage path mismatch between environments
- File upload failed silently
- Different `storage_path()` in production

**Solution:**
```bash
# Check storage path configuration
grep APP_URL chess-backend/.env
grep FILESYSTEM_DISK chess-backend/.env

# Verify storage path
cd chess-backend
php artisan tinker
>>> storage_path('app/public/avatars')
>>> // Compare with where files are actually being saved
```

### Scenario 2: Permission Issue
**Symptoms:**
- Logs show "Avatar file not readable"
- File exists but has restrictive permissions (e.g., 0600)

**Solution:**
```bash
# Fix permissions (Quick Fix)
cd chess-backend
chmod 755 storage/app/public/avatars
chmod 644 storage/app/public/avatars/*

# Or recursively
find storage/app/public/avatars -type d -exec chmod 755 {} \;
find storage/app/public/avatars -type f -exec chmod 644 {} \;
```

### Scenario 3: Route Not Registered
**Symptoms:**
- Curl returns HTML 404 instead of JSON
- No logs in Laravel log file for avatar requests

**Solution:**
```bash
# Clear route cache
php artisan route:clear
php artisan cache:clear
php artisan config:clear

# Restart web server
# For nginx:
sudo systemctl restart nginx
sudo systemctl restart php8.2-fpm

# For Apache:
sudo systemctl restart apache2
```

### Scenario 4: Path Mismatch
**Symptoms:**
- Profile update logs show file saved to one path
- Avatar request logs look for file in different path
- APP_URL mismatch between .env and actual domain

**Solution:**
```bash
# Check APP_URL configuration
cat .env | grep APP_URL

# Should be: APP_URL=https://api.chess99.com
# If different, update and clear caches:
php artisan config:clear
php artisan cache:clear
```

## Step-by-Step Investigation

Run these commands **in order** and report the results:

```bash
# 1. Check if file exists after upload
ls -la storage/app/public/avatars/ | tail -5

# 2. Check latest profile update log
tail -200 storage/logs/laravel.log | grep -A 30 "PROFILE UPDATE CONTROLLER" | tail -35

# 3. Check latest avatar request log
tail -200 storage/logs/laravel.log | grep -A 15 "AVATAR REQUEST" | tail -20

# 4. Test the diagnostic endpoint
curl https://api.chess99.com/api/debug/avatar-storage | jq '.'

# 5. Check specific file permissions
stat storage/app/public/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
```

## What to Report Back

Please provide the output of:

1. **Profile update log entry** (from step 2 above)
2. **Avatar request log entry** (from step 3 above)
3. **File listing** (from step 1 above)
4. **Diagnostic endpoint output** (from step 4 above)

This will help identify the exact issue.

## Expected Normal Flow

When everything works correctly, you should see:

```
# 1. Profile update logs:
PROFILE UPDATE CONTROLLER CALLED
Processing avatar file: original_name=image.jpg, size=12345
New avatar stored:
  relative_path: avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
  full_path: /path/storage/app/public/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
  storage_exists: true
  file_exists: true
  file_readable: true
  file_permissions: 0644

# 2. Avatar request logs:
AVATAR REQUEST
  filename: MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
  exists: true
  readable: true
  permissions: 0644
Avatar served successfully
```

## Quick Fix (If Permissions Issue)

If you find it's a permission issue:

```bash
cd /path/to/chess-backend

# Fix all avatar permissions
chmod 755 storage/app/public/avatars
chmod 644 storage/app/public/avatars/*

# Verify
ls -la storage/app/public/avatars/
```

## References

- Full documentation: `/docs/updates/2025_10_30_avatar_upload_production_fix.md`
- Previous fix: `/docs/quick-fixes/avatar-404-fix.md`
- Code locations:
  - Upload logic: `app/Http/Controllers/UserController.php:105-153`
  - Serving route: `routes/api.php:192-272`
