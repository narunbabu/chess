# Manual Database Fix Steps

Run these commands one by one in PowerShell at `C:\ArunApps\Chess-Web\chess-backend>`:

## 1. Stop any running PHP servers
```powershell
Stop-Process -Name "php" -Force -ErrorAction SilentlyContinue
```

## 2. Remove old database
```powershell
Remove-Item database\database.sqlite -Force -ErrorAction SilentlyContinue
```

## 3. Create fresh database
```powershell
New-Item -Path database\database.sqlite -ItemType File -Force
```

## 4. Clear Laravel caches
```powershell
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

## 5. Run migrations with seed data
```powershell
php artisan migrate:fresh --seed --force
```

**Expected output:**
- You should see multiple migration files being run
- Tables being created including: `personal_access_tokens`, `users`, `championships`, etc.
- Seeders running (if any)

## 6. Verify database tables
```powershell
sqlite3 database\database.sqlite ".tables"
```

**Expected output:**
Should show a list of tables including:
- personal_access_tokens
- users
- championships
- games
- invitations
- etc.

## 7. Start the server
```powershell
php artisan serve
```

**Expected output:**
```
Starting Laravel development server: http://127.0.0.1:8000
```

## 8. In a NEW PowerShell window, start Reverb
```powershell
cd C:\ArunApps\Chess-Web\chess-backend
php artisan reverb:start
```

**Expected output:**
```
Starting server on 0.0.0.0:8080
Server running...
```

## 9. Test the API
Open browser to: http://localhost:8000/api/users

You should see a JSON response (empty array or user data).

## Troubleshooting

### If migrations fail:
Check `storage/logs/laravel.log` for errors

### If "personal_access_tokens" table missing:
The migration file might be missing. Check:
```powershell
ls database\migrations\*_personal_access_tokens*
```

### If you see "disk I/O error":
The database file might be locked. Restart PowerShell and try again.
