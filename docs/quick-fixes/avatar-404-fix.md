# Quick Fix: Avatar 404 Error

**Problem:** Avatars return 404 on production server
**Time to Fix:** 5-10 minutes

## Immediate Fix

### 1. Fix Permissions (SSH to production server)
```bash
cd /path/to/chess-backend

# Fix directory permissions
chmod 755 storage/app/public/avatars

# Fix all existing avatar files
chmod 644 storage/app/public/avatars/*

# Or recursively fix everything
find storage/app/public/avatars -type d -exec chmod 755 {} \;
find storage/app/public/avatars -type f -exec chmod 644 {} \;
```

### 2. Verify Fix
```bash
# Check permissions
ls -la storage/app/public/avatars/

# Should see:
# drwxr-xr-x  (directory)
# -rw-r--r--  (files)
```

### 3. Test
```bash
# Visit diagnostic endpoint
curl https://api.chess99.com/api/debug/avatar-storage

# Try accessing a specific avatar
curl https://api.chess99.com/api/avatars/your-filename.jpg
```

## Alternative: Fix Ownership

If permission fixes don't work, try fixing ownership:

```bash
# Find web server user
ps aux | grep nginx | grep -v grep | head -1

# Change ownership (replace www-data with your web server user)
chown -R www-data:www-data storage/app/public/avatars/
```

## Why This Happens

- Laravel stores files with restrictive permissions by default
- Web server (nginx/Apache) runs as different user than PHP
- Files need to be readable by "others" (permission 644)
- Directories need execute permission (permission 755)

## Permanent Fix

The code changes already implemented ensure new uploads will have correct permissions automatically. This manual fix is only needed for existing files.

## Verify It's Working

1. Upload a new avatar via the profile page
2. Check Laravel logs: `tail -f storage/logs/laravel.log`
3. Look for: "Avatar served successfully"
4. Avatar should display immediately without 404

## Still Having Issues?

Check the full documentation: `/docs/updates/2025_10_30_avatar_upload_production_fix.md`
