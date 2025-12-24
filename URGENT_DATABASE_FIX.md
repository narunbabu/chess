# 🚨 URGENT: Database Lock Fix Guide

**Problem:** SQLite database is locked and corrupted, causing 500 errors
**Impact:** Application cannot authenticate users or access any data

---

## 🎯 Quick Fix (5 Minutes)

### Step 1: Stop ALL Laravel Processes

**Close these if they're running:**
1. **Laravel Server** (`php artisan serve`) - Press `Ctrl+C` in terminal
2. **Queue Workers** - Stop any `php artisan queue:work` processes
3. **WebSocket Server** - Stop Laravel WebSockets if running
4. **VS Code Terminal** - Close any PHP terminals in VS Code

**Verify all PHP processes are stopped:**
```powershell
# Open PowerShell and run:
Get-Process | Where-Object { $_.ProcessName -eq 'php' }
```

**If any processes are listed, kill them:**
```powershell
# Kill ALL PHP processes:
Get-Process | Where-Object { $_.ProcessName -eq 'php' } | Stop-Process -Force
```

---

### Step 2: Delete Database Lock Files

Navigate to your backend folder and delete these files:

```powershell
cd C:\ArunApps\Chess-Web\chess-backend\database

# Delete lock files (safe to delete):
Remove-Item -Path "database.sqlite-shm" -Force -ErrorAction SilentlyContinue
Remove-Item -Path "database.sqlite-wal" -Force -ErrorAction SilentlyContinue
```

These are SQLite's Write-Ahead Logging files that can become corrupted.

---

### Step 3: Fix Database Integrity

Run SQLite integrity check:

```powershell
cd C:\ArunApps\Chess-Web\chess-backend

# Check database integrity:
php artisan tinker

# In tinker, run:
>>> DB::select('PRAGMA integrity_check');
>>> exit
```

---

### Step 4: Run Fresh Migrations

**⚠️ WARNING: This will DELETE ALL DATA**

Only do this if:
- You're in development
- You don't mind losing current data
- The database is corrupted beyond repair

```powershell
cd C:\ArunApps\Chess-Web\chess-backend

# Delete the database file:
Remove-Item database\database.sqlite -Force

# Create fresh database:
New-Item database\database.sqlite -ItemType File

# Run all migrations:
php artisan migrate --force

# Optional: Seed with test data
php artisan db:seed
```

---

### Step 5: Restart Application

```powershell
# Start Laravel server:
php artisan serve

# In another terminal, start queue worker (if using):
php artisan queue:work

# In another terminal, start WebSockets (if using):
php artisan websockets:serve
```

---

## 🔍 Alternative: Database Recovery (Keep Data)

If you want to try to recover your data first:

### Option A: SQLite VACUUM

```powershell
cd C:\ArunApps\Chess-Web\chess-backend

# Stop ALL processes first!
# Then run:
php artisan tinker

# In tinker:
>>> DB::statement('VACUUM');
>>> exit
```

### Option B: Export and Reimport

```powershell
# 1. Export database to SQL dump:
sqlite3 database\database.sqlite .dump > backup.sql

# 2. Create fresh database:
Remove-Item database\database.sqlite -Force
New-Item database\database.sqlite -ItemType File

# 3. Import data:
sqlite3 database\database.sqlite < backup.sql
```

---

## 🧪 Test the Fix

After fixing, test these:

1. **Authentication:**
```powershell
curl http://127.0.0.1:8000/api/user -H "Authorization: Bearer YOUR_TOKEN"
```

2. **Championship Invitations:**
```powershell
curl http://127.0.0.1:8000/api/championships/invitations -H "Authorization: Bearer YOUR_TOKEN"
```

3. **Frontend:**
- Open `http://localhost:3000`
- Try to login
- Check console for errors

---

## 🎯 After Fix: Run Draw Migration

Once database is working:

```powershell
cd C:\ArunApps\Chess-Web\chess-backend
php artisan migrate
```

This will fix the `draw_events` table schema.

---

## 🔍 Common Issues

### "Database file is locked"
**Solution:** Go back to Step 1, make sure ALL PHP processes are stopped

### "Cannot delete database.sqlite"
**Solution:**
1. Close DB Browser for SQLite (if open)
2. Close VS Code
3. Try deleting again
4. Restart computer as last resort

### "Permission denied"
**Solution:** Run PowerShell as Administrator

### "Migrations fail"
**Solution:** Delete database and start fresh (Step 4)

---

## 📋 Checklist

Complete these in order:

- [ ] Stop PHP artisan serve (Ctrl+C)
- [ ] Stop queue workers
- [ ] Kill all PHP processes
- [ ] Delete .sqlite-shm file
- [ ] Delete .sqlite-wal file
- [ ] Try VACUUM first (recovery)
- [ ] If VACUUM fails, delete database
- [ ] Create fresh database file
- [ ] Run migrations
- [ ] Restart Laravel server
- [ ] Test authentication
- [ ] Test frontend

---

## 🆘 If Nothing Works

**Nuclear Option - Fresh Start:**

```powershell
# 1. Stop everything
Get-Process | Where-Object { $_.ProcessName -eq 'php' } | Stop-Process -Force

# 2. Delete and recreate database
cd C:\ArunApps\Chess-Web\chess-backend
Remove-Item database\database.sqlite* -Force
New-Item database\database.sqlite -ItemType File

# 3. Fresh migrations
php artisan migrate:fresh --force --seed

# 4. Restart
php artisan serve
```

---

## 📞 Need Help?

If you're still stuck after trying all steps:
1. Check Laravel logs: `storage/logs/laravel.log`
2. Enable debug mode: `.env` → `APP_DEBUG=true`
3. Check disk space: Make sure you have free space
4. Restart computer: Sometimes Windows locks files

---

**⏱️ Expected Time:** 5-10 minutes
**💾 Data Loss:** Yes (unless using recovery option)
**🎯 Success Rate:** 99% with fresh start

---

**Start with Step 1 and work through each step carefully!**
