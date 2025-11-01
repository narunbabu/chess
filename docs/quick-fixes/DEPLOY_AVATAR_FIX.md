# Deploy Avatar 404 Fix

**Issue:** Avatar URLs using `/api/avatars/` are returning 404 because nginx intercepts before Laravel
**Solution:** Change to `/storage/avatars/` to use direct symlink (faster and works with nginx)

## Step-by-Step Deployment

### Step 1: Update Code on Production

```bash
# SSH to production server
ssh root@api.chess99.com

# Navigate to backend directory
cd /opt/Chess-Web/chess-backend

# Pull latest changes (includes the fix)
git pull origin master

# OR manually edit if git isn't available:
nano app/Http/Controllers/UserController.php
# Find line 130 and change:
#   FROM: $fullUrl = url('/api/avatars/' . $filename);
#   TO:   $fullUrl = url('/storage/avatars/' . $filename);
```

### Step 2: Fix Existing User Avatar URLs in Database

```bash
# Still in /opt/Chess-Web/chess-backend

# Run the fix script
php fix_avatar_urls.php

# Expected output:
# === Avatar URL Fix Script ===
# Found X users with avatar URLs
# User ID: 123, Name: John
#   Current URL: https://api.chess99.com/api/avatars/xyz.jpg
#   → Updated to: https://api.chess99.com/storage/avatars/xyz.jpg
# === Summary ===
# Total users: X
# Updated: Y
# Skipped: Z
```

### Step 3: Clear Caches

```bash
php artisan cache:clear
php artisan config:clear
php artisan route:clear
```

### Step 4: Test the Fix

```bash
# Test direct storage access (should work)
curl -I https://api.chess99.com/storage/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg

# Expected response:
# HTTP/2 200
# content-type: image/jpeg
# ...

# Test in browser
# Visit: https://api.chess99.com/storage/avatars/MoNKA39M7Yc7gCKVI3KqfVppfY0A9XTRgloT4pTu.jpg
# Should show the image
```

### Step 5: Verify Profile Page

1. Go to https://chess99.com/profile
2. Your avatar should now display correctly
3. Try uploading a new avatar
4. New avatar should display immediately (no 404)

## Files Changed

1. **UserController.php** (line 130-132)
   - Changed avatar URL from `/api/avatars/` to `/storage/avatars/`

2. **fix_avatar_urls.php** (new file)
   - One-time script to update existing database records

## Why This Fix Works

**Before:**
- URL: `https://api.chess99.com/api/avatars/file.jpg`
- Nginx tries to find `/api/avatars/` route → Not configured → 404
- Laravel route never reached

**After:**
- URL: `https://api.chess99.com/storage/avatars/file.jpg`
- Nginx serves directly from `public/storage/avatars/` symlink
- No PHP/Laravel overhead → Faster performance

**Symlink exists:**
```
public/storage → storage/app/public
```

So `/storage/avatars/file.jpg` maps to:
```
public/storage/avatars/file.jpg → storage/app/public/avatars/file.jpg
```

## Performance Benefits

- ✅ **Faster:** Nginx serves files directly (no PHP processing)
- ✅ **More reliable:** No routing configuration needed
- ✅ **Standard Laravel pattern:** Uses the built-in storage symlink
- ✅ **Less server load:** Static file serving is more efficient

## Rollback (if needed)

If you need to rollback for any reason:

```bash
# Revert code change
cd /opt/Chess-Web/chess-backend
git checkout HEAD~1 app/Http/Controllers/UserController.php

# Revert database URLs
php artisan tinker
>>> DB::table('users')->where('avatar_url', 'like', '%/storage/avatars/%')->update(['avatar_url' => DB::raw("REPLACE(avatar_url, '/storage/avatars/', '/api/avatars/')")]);
>>> exit

# Clear caches
php artisan cache:clear
```

## Verification Checklist

- [ ] Code deployed (UserController.php updated)
- [ ] Fix script executed successfully
- [ ] Caches cleared
- [ ] Avatar URL loads in browser (no 404)
- [ ] Profile page shows avatar
- [ ] New avatar upload works
- [ ] No errors in Laravel logs

## Troubleshooting

### Still getting 404?

```bash
# Check if symlink exists
ls -la /opt/Chess-Web/chess-backend/public/storage

# Should show:
# lrwxrwxrwx ... storage -> /opt/Chess-Web/chess-backend/storage/app/public

# If symlink is missing, create it:
php artisan storage:link
```

### Image not loading?

```bash
# Check file permissions
ls -la storage/app/public/avatars/

# Should show:
# drwxr-xr-x (755) for directory
# -rw-r--r-- (644) for files

# Fix if needed:
chmod 755 storage/app/public/avatars
chmod 644 storage/app/public/avatars/*
```

## Success Criteria

✅ Avatar displays on profile page
✅ No 404 errors in browser console
✅ New avatar uploads work immediately
✅ Faster page load (no PHP processing for images)

## Next Steps

After confirming the fix works:
1. Monitor for any issues over next 24 hours
2. Can safely delete the old `/api/avatars/` route from `routes/api.php` (lines 192-272)
3. Can delete `fix_avatar_urls.php` script (one-time use)
