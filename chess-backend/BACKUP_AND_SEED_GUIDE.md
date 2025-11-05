# Database Backup and Seeding Guide

Complete guide for backing up your production database and running specific seeders.

## 🚨 Step 1: Fix Laravel Dusk Error

If you're getting the "Class Laravel\Dusk\DuskServiceProvider not found" error, run:

### On Linux/Mac/WSL:
```bash
bash fix_dusk_error.sh
```

### On Windows PowerShell:
```powershell
php artisan config:clear
php artisan route:clear
php artisan view:clear
php artisan cache:clear
php artisan clear-compiled
composer dump-autoload
```

## 💾 Step 2: Backup Your Database

**IMPORTANT: Always backup before seeding!**

### Database Credentials (from .env):
- **Host:** mysql.hostinger.in
- **Port:** 3306
- **Database:** u441069787_togata
- **Username:** u441069787_togata
- **Password:** Arun@123

### On Linux/Mac/WSL:
```bash
bash backup_database.sh
```

### On Windows PowerShell:
```powershell
.\backup_database.ps1
```

### Manual Backup (if scripts fail):
```bash
mysqldump -h mysql.hostinger.in -P 3306 -u u441069787_togata -p u441069787_togata > backup_$(date +%Y%m%d_%H%M%S).sql
# Enter password when prompted: Arun@123
```

**Backup Location:** `database/backups/`

## 🌱 Step 3: Run Seeders Starting with "vana"

### Quick Method:
```bash
php run_vana_seeders.php
```

This will automatically find and run all seeders in `database/seeders/` whose filenames start with "vana".

### Manual Method (run individual seeders):
```bash
php artisan db:seed --class=VanaUsersSeeder
php artisan db:seed --class=VanaGamesSeeder
php artisan db:seed --class=VanaSettingsSeeder
```

## 📝 Created Seeders

Three example seeders have been created for you:

### 1. VanaUsersSeeder.php
Seeds sample users for testing.

**Default data:**
- Admin User (admin@chess99.com)
- Test Player (player@chess99.com)

### 2. VanaGamesSeeder.php
Seeds sample game data (currently commented out - customize as needed).

### 3. VanaSettingsSeeder.php
Seeds application settings (currently commented out - customize as needed).

## 🔧 Customizing Seeders

Edit the seeder files in `database/seeders/` to match your database schema:

```bash
# Edit seeders
nano database/seeders/VanaUsersSeeder.php
nano database/seeders/VanaGamesSeeder.php
nano database/seeders/VanaSettingsSeeder.php
```

## 📊 Restore Database Backup

If something goes wrong, restore your backup:

### From compressed backup (.gz):
```bash
gunzip database/backups/backup_u441069787_togata_TIMESTAMP.sql.gz
mysql -h mysql.hostinger.in -P 3306 -u u441069787_togata -p u441069787_togata < database/backups/backup_u441069787_togata_TIMESTAMP.sql
# Enter password: Arun@123
```

### From compressed backup (.zip) - Windows:
```powershell
Expand-Archive database/backups/backup_u441069787_togata_TIMESTAMP.sql.zip
mysql -h mysql.hostinger.in -P 3306 -u u441069787_togata -p u441069787_togata < database/backups/backup_u441069787_togata_TIMESTAMP.sql
# Enter password: Arun@123
```

## ✅ Complete Workflow

1. **Clear Laravel caches** (fix Dusk error):
   ```bash
   bash fix_dusk_error.sh
   ```

2. **Backup database** (ALWAYS do this first!):
   ```bash
   bash backup_database.sh
   ```

3. **Customize seeders** (edit the files as needed):
   ```bash
   nano database/seeders/VanaUsersSeeder.php
   nano database/seeders/VanaGamesSeeder.php
   nano database/seeders/VanaSettingsSeeder.php
   ```

4. **Run seeders**:
   ```bash
   php run_vana_seeders.php
   ```

5. **Verify the data** in your database

6. **If something goes wrong**, restore from backup:
   ```bash
   mysql -h mysql.hostinger.in -u u441069787_togata -p u441069787_togata < database/backups/backup_TIMESTAMP.sql
   ```

## 🔒 Security Notes

- ⚠️ **Never commit** database credentials to git
- ⚠️ **Always backup** before running seeders on production
- ⚠️ Keep backup files in a secure location
- ⚠️ Test seeders on a development environment first

## 🆘 Troubleshooting

### mysqldump command not found
**Solution:** Install MySQL client tools:
- **Ubuntu/Debian:** `sudo apt install mysql-client`
- **Mac:** `brew install mysql-client`
- **Windows:** Download from [MySQL Downloads](https://dev.mysql.com/downloads/mysql/)

### Cannot connect to database
**Solution:** Check:
1. Database credentials are correct
2. Your IP is whitelisted in Hostinger MySQL Remote Access
3. Firewall allows connections to port 3306

### Seeder fails
**Solution:**
1. Check seeder code for syntax errors
2. Verify database schema matches seeder expectations
3. Check Laravel logs: `tail -f storage/logs/laravel.log`

## 📞 Need Help?

Check Laravel logs for detailed error messages:
```bash
tail -100 storage/logs/laravel.log
```
