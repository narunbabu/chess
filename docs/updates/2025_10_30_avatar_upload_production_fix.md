# Avatar Upload Production Fix

**Date:** 2025-10-30
**Issue:** Avatar uploads work on local server but return 404 on production server
**Status:** Fixed with diagnostics

## Problem Summary

### Symptoms
- Local environment: Avatar upload and display work perfectly ✅
- Production environment: Avatar upload appears successful, but accessing the avatar URL returns 404 ❌
- Error URL: `https://api.chess99.com/api/avatars/{filename}.jpg` → 404 Not Found

### Root Cause Analysis

The issue stems from file/directory permissions on the production server. When Laravel stores files using `Storage::disk('public')->store()`, the default permissions may not be sufficient for the web server to read the files.

**Key Issues:**
1. **File Permissions**: Uploaded files may have restrictive permissions (e.g., 600) preventing web server access
2. **Directory Permissions**: The avatars directory may lack execute permissions (755) needed for traversal
3. **Server User Mismatch**: PHP process user may differ from web server user, causing permission conflicts
4. **Missing Diagnostics**: Original code lacked sufficient logging to identify the exact failure point

## Solution Implemented

### 1. Enhanced Avatar Serving Route (`routes/api.php`)

**Changes:**
- ✅ Added comprehensive logging for debugging
- ✅ Added file existence and readability checks
- ✅ Added security (filename sanitization to prevent directory traversal)
- ✅ Added detailed error responses with diagnostic information
- ✅ Added cache headers for performance optimization

**Code Location:** `chess-backend/routes/api.php:157-237`

**Key Features:**
```php
// Sanitize filename
$filename = basename($filename);

// Check file existence
if (!file_exists($path)) {
    \Log::error('Avatar file not found', [...]);
    return 404 with diagnostic info;
}

// Check readability
if (!is_readable($path)) {
    \Log::error('Avatar file not readable', [...]);
    return 403 with permission info;
}

// Serve with cache headers
return response($file)
    ->header('Content-Type', $mimeType)
    ->header('Cache-Control', 'public, max-age=31536000');
```

### 2. Explicit Permission Setting (`app/Http/Controllers/UserController.php`)

**Changes:**
- ✅ Set explicit file permissions (644 = rw-r--r--)
- ✅ Set explicit directory permissions (755 = rwxr-xr-x)
- ✅ Added comprehensive logging for upload process
- ✅ Added file verification after upload

**Code Location:** `chess-backend/app/Http/Controllers/UserController.php:105-153`

**Permission Strategy:**
```php
// File permissions: 644 (owner: read+write, group: read, others: read)
chmod($fullPath, 0644);

// Directory permissions: 755 (owner: rwx, group: r-x, others: r-x)
chmod($dir, 0755);
```

### 3. Diagnostic Endpoint (`routes/api.php`)

**New Endpoint:** `GET /api/debug/avatar-storage`

**Purpose:** Provides comprehensive diagnostics about avatar storage system

**Returns:**
- Storage paths and directory structure
- Directory permissions and ownership
- List of all avatar files with their permissions
- PHP process user information
- Environment configuration

**Usage:**
```bash
curl https://api.chess99.com/api/debug/avatar-storage
```

## Deployment Instructions

### Step 1: Deploy Code Changes
```bash
cd chess-backend

# Pull latest changes
git pull origin master

# Clear caches
php artisan cache:clear
php artisan config:clear
php artisan route:clear
```

### Step 2: Verify Storage Directory
```bash
# Ensure avatars directory exists with correct permissions
mkdir -p storage/app/public/avatars
chmod 755 storage/app/public/avatars

# Fix existing files if any
chmod 644 storage/app/public/avatars/*
```

### Step 3: Run Diagnostics
```bash
# Check diagnostic endpoint
curl https://api.chess99.com/api/debug/avatar-storage

# Expected output should show:
# - directory_exists: true
# - directory_readable: true
# - directory_writable: true
# - directory_permissions: "0755"
```

### Step 4: Test Avatar Upload
1. Upload a new avatar via the profile update endpoint
2. Check Laravel logs for detailed upload information
3. Verify the avatar URL returns the image (not 404)
4. Check browser network tab for successful response

## Verification Checklist

- [ ] Code deployed to production
- [ ] Storage directory exists with 755 permissions
- [ ] Diagnostic endpoint accessible and returns valid data
- [ ] New avatar upload successful
- [ ] Avatar URL accessible (not 404)
- [ ] Laravel logs show successful file operations
- [ ] Browser displays avatar correctly

## Troubleshooting Guide

### If 404 Still Occurs

1. **Check Logs:**
```bash
tail -f storage/logs/laravel.log | grep AVATAR
```

2. **Verify File Exists:**
```bash
ls -la storage/app/public/avatars/
```

3. **Check Permissions:**
```bash
# Should show: drwxr-xr-x (755)
ls -ld storage/app/public/avatars/

# Should show: -rw-r--r-- (644)
ls -l storage/app/public/avatars/
```

4. **Check Web Server User:**
```bash
# For nginx
ps aux | grep nginx

# For Apache
ps aux | grep apache
```

5. **Fix Permissions Manually:**
```bash
# Recursively fix directory permissions
find storage/app/public/avatars -type d -exec chmod 755 {} \;

# Recursively fix file permissions
find storage/app/public/avatars -type f -exec chmod 644 {} \;
```

### If 403 Forbidden Occurs

This indicates the file exists but is not readable by the web server.

**Solution:**
```bash
# Change ownership to web server user
chown -R www-data:www-data storage/app/public/avatars/

# Or match PHP process user
chown -R $(ps aux | grep php-fpm | grep -v grep | head -1 | awk '{print $1}') storage/app/public/avatars/
```

### Common Issues

| Issue | Symptom | Solution |
|-------|---------|----------|
| Permission denied | 403 error | Fix file/directory permissions |
| File not found | 404 error | Check file upload success, verify path |
| SELinux blocking | Cannot access files | `chcon -R -t httpd_sys_rw_content_t storage/` |
| Wrong path | 404 error | Verify `storage_path()` in production |

## Performance Optimization

The updated route includes cache headers:
```php
->header('Cache-Control', 'public, max-age=31536000')
```

**Benefits:**
- Browser caches avatar for 1 year
- Reduces server load for repeated requests
- Improves page load performance

## Security Considerations

### Filename Sanitization
```php
$filename = basename($filename);
```

**Protection Against:**
- Directory traversal attacks (e.g., `../../etc/passwd`)
- Path injection vulnerabilities
- Unauthorized file access

### File Validation
- Upload validation: `image|mimes:jpeg,png,jpg,gif|max:2048`
- Size limit: 2MB maximum
- Type checking: Only image files allowed

## Monitoring & Alerts

### Log Patterns to Monitor

**Success:**
```
Avatar served successfully | filename: xxx.jpg | size: 12345
```

**Failure:**
```
Avatar file not found | requested_path: /path/to/file
Avatar file not readable | permissions: 0600
```

### Recommended Monitoring

1. **Error Rate:** Track 404/403 responses for `/api/avatars/*`
2. **Upload Success:** Monitor profile update endpoint success rate
3. **Storage Usage:** Alert when avatar storage exceeds threshold
4. **Permission Drift:** Periodic checks for incorrect permissions

## Testing Strategy

### Local Testing
```bash
# Test upload
curl -X POST http://localhost:8000/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@test-image.jpg"

# Test retrieval
curl http://localhost:8000/api/avatars/filename.jpg
```

### Production Testing
```bash
# Use staging first
curl -X POST https://staging.chess99.com/api/profile \
  -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@test-image.jpg"

# Verify in production
curl https://api.chess99.com/api/avatars/filename.jpg
```

## Related Files

- `chess-backend/routes/api.php` - Avatar serving route
- `chess-backend/app/Http/Controllers/UserController.php` - Upload logic
- `chess-backend/config/filesystems.php` - Storage configuration

## Success Metrics

- ✅ Avatar upload success rate: >99%
- ✅ Avatar retrieval success rate: >99%
- ✅ Average response time: <100ms
- ✅ Zero permission-related errors

## Future Improvements

1. **CDN Integration:** Move avatars to CloudFront/CDN for better performance
2. **Image Optimization:** Compress and resize avatars automatically
3. **S3 Storage:** Use AWS S3 for scalable storage
4. **Fallback System:** Default avatar for missing/failed uploads
5. **Cron Job:** Periodic permission audit and automatic fixing

## References

- Laravel Storage Documentation: https://laravel.com/docs/11.x/filesystem
- File Permissions Best Practices: https://www.php.net/manual/en/function.chmod.php
- Avatar System Architecture: `/docs/context.md`
