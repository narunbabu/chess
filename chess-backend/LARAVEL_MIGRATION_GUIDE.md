# Laravel Migration Safety Guide

## Understanding Laravel Migrations

Laravel migrations are **transactional** and provide built-in safety features:
- Automatic rollback on failure
- Migration tracking in `migrations` table
- Batch tracking for grouped rollbacks
- Built-in schema builder

## Before Running Migrations in Production

### 1. Create Database Backup

#### Via Render Dashboard (Recommended)
1. Log into Render Dashboard
2. Navigate to PostgreSQL database
3. Click "Backups" tab
4. Click "Create Manual Backup"
5. Note backup ID and timestamp
6. ⚠️ **Wait for backup to complete**

#### Via Laravel Package (Optional)

```bash
# Install spatie/laravel-backup if not installed
composer require spatie/laravel-backup

# Create backup
php artisan backup:run --only-db
```

### 2. Check Current Migration Status

```bash
cd chess-backend

# Show which migrations have run
php artisan migrate:status

# Output example:
# +---------+----------------------------------------------------+-------+
# | Ran?    | Migration                                          | Batch |
# +---------+----------------------------------------------------+-------+
# | Yes     | 2024_01_01_create_users_table                      | 1     |
# | Yes     | 2024_02_15_create_championships_table              | 2     |
# | Pending | 2024_12_05_add_championship_id_to_tournament_rounds| -     |
# +---------+----------------------------------------------------+-------+
```

### 3. Review Migration Files

Check the migration file in `database/migrations/`:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tournament_rounds', function (Blueprint $table) {
            $table->foreignId('championship_id')
                  ->nullable()
                  ->constrained('championships')
                  ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tournament_rounds', function (Blueprint $table) {
            $table->dropForeign(['championship_id']);
            $table->dropColumn('championship_id');
        });
    }
};
```

**Analysis:**
- ✅ **Safe**: Adds new nullable column
- ✅ **Safe**: Has proper `down()` method for rollback
- ✅ **Safe**: No data loss risk
- ✅ **Safe**: Won't affect existing rows

## Local Testing

### Step 1: Test Migration Locally

```bash
cd chess-backend

# Clear caches
php artisan config:clear
php artisan cache:clear

# Run migration
php artisan migrate

# Check it worked
php artisan tinker
>>> Schema::hasColumn('tournament_rounds', 'championship_id')
>>> true
```

### Step 2: Test Application

```bash
# Start local server
php artisan serve

# Test in browser
# - Visit championship pages
# - Try creating tournament
# - Verify existing data intact
```

### Step 3: Test Rollback

```bash
# Rollback last migration
php artisan migrate:rollback --step=1

# Verify column removed
php artisan tinker
>>> Schema::hasColumn('tournament_rounds', 'championship_id')
>>> false

# Re-run migration
php artisan migrate
```

## Production Migration

### Method 1: Automatic via Render (Recommended)

**Configure Render Build Command:**
```bash
composer install --optimize-autoloader --no-dev && php artisan migrate --force
```

When you push to GitHub:
1. Render pulls new code
2. Runs composer install
3. **Automatically runs migrations**
4. Restarts application

### Method 2: Manual via Artisan

```bash
# SSH into production or use Render shell
php artisan migrate --force

# The --force flag is REQUIRED in production
# Without it, migration will ask for confirmation
```

### Method 3: Via Render Dashboard

1. Go to Render Dashboard
2. Select your web service
3. Go to "Shell" tab
4. Run: `php artisan migrate --force`

## Migration Best Practices

### ✅ Safe Operations

```php
// Adding new tables
Schema::create('new_table', function (Blueprint $table) {
    $table->id();
    $table->timestamps();
});

// Adding nullable columns
$table->string('new_column')->nullable();

// Adding columns with defaults
$table->boolean('is_active')->default(true);

// Adding indexes
$table->index('column_name');

// Adding foreign keys (nullable)
$table->foreignId('user_id')->nullable()->constrained();
```

### ⚠️ Risky Operations (Require Care)

```php
// Renaming columns (might break existing code)
$table->renameColumn('old_name', 'new_name');

// Changing column types
$table->string('age')->change(); // was integer

// Adding non-nullable columns (need default or data population)
$table->string('required_field'); // ❌ Will fail if table has rows
$table->string('required_field')->default('value'); // ✅ OK
```

### ❌ Dangerous Operations (Avoid in Production)

```php
// Dropping tables with data
Schema::dropIfExists('important_table'); // ❌ Data loss!

// Dropping columns
$table->dropColumn('column_name'); // ❌ Might break existing code

// Deleting data
DB::table('users')->delete(); // ❌ Never in migration!
```

## Your Current Migration Analysis

**Migration:** Add `championship_id` to `tournament_rounds`

**Safety Assessment:**
- ✅ **Risk Level**: Very Low
- ✅ **Data Loss**: None
- ✅ **Breaking Changes**: None
- ✅ **Rollback**: Simple and safe
- ✅ **Production Ready**: Yes

**Impact:**
- Existing `tournament_rounds` rows: Unaffected (column is nullable)
- Existing championships: Unaffected
- Existing games: Unaffected
- User data: Unaffected
- New tournament_rounds: Can have `championship_id` set

**Recommendation:** Safe to deploy without offline time

## Rollback Procedures

### Immediate Rollback (Last Migration)

```bash
# Rollback last batch of migrations
php artisan migrate:rollback

# Rollback specific number of migrations
php artisan migrate:rollback --step=1

# Rollback to beginning (⚠️ DANGEROUS - only in emergency)
php artisan migrate:reset
```

### Rollback with Re-migration

```bash
# Rollback and re-run (useful for testing)
php artisan migrate:refresh

# Rollback specific steps and re-migrate
php artisan migrate:refresh --step=1
```

### Database Restore from Backup

If migration causes data issues:

```bash
# 1. Stop application (via Render dashboard)

# 2. Restore database
psql $DATABASE_URL < backup_file.sql

# 3. Verify data
php artisan tinker
>>> DB::table('users')->count()
>>> DB::table('championships')->count()

# 4. Restart application
```

## Monitoring After Migration

### Check Migration Success

```bash
# View migration status
php artisan migrate:status

# Check logs
tail -f storage/logs/laravel.log

# Test database connection
php artisan tinker
>>> DB::connection()->getPdo()
```

### Verify Data Integrity

```bash
php artisan tinker

# Check new column exists
>>> Schema::hasColumn('tournament_rounds', 'championship_id')
=> true

# Check existing data intact
>>> DB::table('tournament_rounds')->count()
=> 42  // Your actual count

>>> DB::table('championships')->count()
=> 15  // Your actual count

# Check new column values (should be null for old rows)
>>> DB::table('tournament_rounds')->whereNull('championship_id')->count()
=> 42  // Old rows without championship_id
```

### Performance Check

```bash
# Enable query log temporarily
DB::enableQueryLog();

# Run some operations
// Test your API endpoints

# Check queries
dd(DB::getQueryLog());
```

## Common Issues and Solutions

### Issue 1: Migration Fails with Foreign Key Constraint

**Error:**
```
SQLSTATE[23000]: Integrity constraint violation
```

**Solution:**
```php
// In migration, make foreign key nullable
$table->foreignId('championship_id')->nullable()->constrained();

// Or disable constraints temporarily (not recommended)
Schema::disableForeignKeyConstraints();
// ... migration code ...
Schema::enableForeignKeyConstraints();
```

### Issue 2: Column Already Exists

**Error:**
```
SQLSTATE[42701]: Duplicate column
```

**Solution:**
```php
// Check if column exists before adding
if (!Schema::hasColumn('tournament_rounds', 'championship_id')) {
    Schema::table('tournament_rounds', function (Blueprint $table) {
        $table->foreignId('championship_id')->nullable()->constrained();
    });
}
```

### Issue 3: Migration Stuck

**Symptoms:**
- Migration hangs or times out
- Database locked

**Solution:**
```bash
# Check database connections
php artisan tinker
>>> DB::select("SELECT * FROM pg_stat_activity WHERE datname = 'your_db_name';")

# Kill stuck queries if needed (PostgreSQL)
>>> DB::select("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE state = 'idle in transaction';")
```

## Emergency Protocols

### High Severity Issue After Migration

1. **Immediate Response**
   ```bash
   # Rollback migration
   php artisan migrate:rollback --step=1

   # Clear all caches
   php artisan cache:clear
   php artisan config:clear
   php artisan route:clear
   php artisan view:clear
   ```

2. **If Rollback Fails**
   ```bash
   # Restore from backup
   # Via Render dashboard: Database → Backups → Restore

   # Or via command line
   psql $DATABASE_URL < backup_file.sql
   ```

3. **Revert Code**
   ```bash
   git revert HEAD
   git push origin main
   # Render auto-deploys previous version
   ```

## Pre-Deployment Checklist

Before deploying:

- [ ] Database backup created and verified
- [ ] Migration tested locally
- [ ] Rollback tested locally
- [ ] Migration file has `up()` and `down()` methods
- [ ] No destructive operations (DROP, DELETE)
- [ ] Foreign keys are nullable or have defaults
- [ ] Application code compatible with both states (with/without column)
- [ ] Render build command includes `php artisan migrate --force`
- [ ] Environment variables set correctly
- [ ] Team notified (if applicable)

## Post-Deployment Checklist

After deploying:

- [ ] Migration ran successfully (check `php artisan migrate:status`)
- [ ] Application logs show no errors
- [ ] Database queries performing normally
- [ ] Existing features working correctly
- [ ] New features working correctly
- [ ] No user reports of issues
- [ ] Data integrity verified
- [ ] Performance metrics normal
- [ ] Monitor for 1 hour minimum

## Laravel-Specific Tools

### Useful Artisan Commands

```bash
# Database
php artisan db:show              # Show database info
php artisan db:table users       # Show table structure
php artisan db:monitor           # Monitor database

# Migrations
php artisan migrate:fresh        # Drop all tables and re-migrate (⚠️ DANGER)
php artisan migrate:refresh      # Rollback and re-migrate
php artisan migrate:reset        # Rollback all migrations

# Schema
php artisan schema:dump          # Dump current schema
php artisan migrate:install      # Create migrations table
```

### Tinker for Verification

```bash
php artisan tinker

# Check schema
>>> Schema::hasTable('tournament_rounds')
>>> Schema::hasColumn('tournament_rounds', 'championship_id')
>>> Schema::getColumnType('tournament_rounds', 'championship_id')

# Check data
>>> \App\Models\TournamentRound::count()
>>> \App\Models\Championship::count()
>>> \App\Models\TournamentRound::whereNotNull('championship_id')->count()

# Test relationships
>>> $round = \App\Models\TournamentRound::first()
>>> $round->championship  // Test relationship
```

## Conclusion

Your migration is **SAFE** and **LOW-RISK**:
- ✅ Non-destructive (adds column only)
- ✅ Nullable (no data required)
- ✅ Has rollback method
- ✅ No breaking changes
- ✅ Can deploy without downtime

**Recommendation:** Proceed with confidence, but follow the checklist!
