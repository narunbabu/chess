# Database Migration Safety Guide

## Before ANY Migration in Production

### 1. Create Backup

#### Via Render Dashboard (Recommended)
1. Log into Render Dashboard
2. Navigate to your PostgreSQL database
3. Click "Backups" tab
4. Click "Create Manual Backup"
5. Note the backup ID and timestamp
6. Wait for backup to complete before proceeding

#### Via Command Line (Alternative)
```bash
# If you have direct database access
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Render CLI
render pg:backups:create <database-name>
```

### 2. Check Current Migration Status

```bash
cd chess-backend
pnpm knex migrate:list

# Shows:
# - Completed migrations (batch number)
# - Pending migrations
```

### 3. Review Migration Files

Look at the migration files in `chess-backend/migrations/`:
- Check what tables/columns are being added/modified
- Ensure there's a `down()` function for rollback
- Look for destructive operations (DROP, DELETE)

## Running Migrations Safely

### Local Testing First

```bash
# 1. Copy production data to local (optional but recommended)
# Get a backup from Render, then:
psql your_local_db < production_backup.sql

# 2. Run migration locally
cd chess-backend
pnpm migrate:latest

# 3. Test the application
pnpm start
# Test all critical features

# 4. Test rollback
pnpm migrate:rollback
# Verify app still works

# 5. Re-run migration
pnpm migrate:latest
```

### Production Deployment

```bash
# Option A: Automatic (via Render)
# Migrations run automatically when you deploy
git push origin main
# Render will:
# 1. Pull new code
# 2. Run npm install
# 3. Run migrations (if configured in build command)
# 4. Start new version

# Option B: Manual Control
# Disable automatic migrations in Render
# Run manually after deployment:
render run pnpm migrate:latest
```

## Migration Best Practices

### ✅ Safe Operations
- Adding new tables
- Adding new columns with DEFAULT values
- Adding indexes (use CONCURRENTLY if possible)
- Adding constraints that are already satisfied

### ⚠️ Risky Operations
- Dropping columns (users might still reference them)
- Renaming columns (breaks existing code)
- Changing column types
- Adding NOT NULL without DEFAULT

### ❌ Destructive Operations (Avoid)
- Dropping tables with data
- Deleting data
- Removing foreign keys with dependencies

## Current Migration Analysis

Your latest migration (championship_id in tournament_rounds) is **SAFE**:

```javascript
exports.up = function(knex) {
  return knex.schema.table('tournament_rounds', (table) => {
    table.integer('championship_id').references('id').inTable('championships');
    // This is SAFE because:
    // - New column (not modifying existing)
    // - NULL allowed (no DEFAULT needed)
    // - Foreign key is optional reference
  });
};

exports.down = function(knex) {
  return knex.schema.table('tournament_rounds', (table) => {
    table.dropColumn('championship_id');
  });
};
```

**Impact:** None on existing data or functionality

## Rollback Procedure

If something goes wrong after migration:

### Immediate Rollback (Last Migration Only)

```bash
# Rollback the last batch of migrations
cd chess-backend
pnpm migrate:rollback

# Or via Render:
render run pnpm migrate:rollback
```

### Full Restore from Backup

```bash
# 1. Stop the application
# 2. Restore database
psql $DATABASE_URL < backup_file.sql

# 3. Verify data
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM championships;"

# 4. Restart application
```

### Emergency Rollback Checklist

- [ ] Stop incoming traffic (if possible)
- [ ] Run migration rollback
- [ ] Verify data integrity
- [ ] Test critical paths
- [ ] Check error logs
- [ ] Restart application
- [ ] Monitor for errors
- [ ] Communicate status to users (if needed)

## Monitoring After Migration

### Check These Within First 30 Minutes:

```bash
# 1. Application logs
render logs <service-name>

# 2. Database connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Error rates
# Check your monitoring dashboard

# 4. Response times
# Check application performance

# 5. Data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tournament_rounds WHERE championship_id IS NOT NULL;"
```

### Red Flags to Watch For:

- Spike in 500 errors
- Database connection errors
- Slow query warnings
- User reports of missing data
- Foreign key constraint violations

## Your Specific Situation

### Existing Production Data:
- Users: Active user accounts
- Championships: Including manually created Championship 101
- Games: Existing game history
- Tournament data: May or may not exist

### Migration Impact:
✅ **SAFE** - Your migration only adds a new optional column
- Won't affect existing users
- Won't modify existing championships
- Won't touch game data
- Existing tournament_rounds will have NULL championship_id (valid)

### Recommendation:
- ✅ No offline time needed
- ✅ Can deploy during normal hours
- ✅ Low risk of data loss
- ⚠️ Still create backup (best practice)
- ✅ Monitor for first hour after deployment

## Pre-Deployment Checklist

- [ ] Create database backup in Render
- [ ] Note backup ID/timestamp
- [ ] Review migration files
- [ ] Test locally with production-like data
- [ ] Verify rollback procedure works locally
- [ ] Check that down() functions exist
- [ ] Ensure no destructive operations
- [ ] Plan monitoring schedule
- [ ] Have rollback command ready
- [ ] Know how to restore from backup

## Post-Deployment Checklist

- [ ] Verify migration ran successfully
- [ ] Check application logs for errors
- [ ] Test existing features (5-10 min)
- [ ] Test new features (5 min)
- [ ] Run data integrity queries
- [ ] Monitor error rates
- [ ] Check database connection pool
- [ ] Verify no user reports of issues
- [ ] Document any unexpected behavior
- [ ] Update team if issues found

## Emergency Contacts

Keep these handy during deployment:
- Render dashboard URL
- Database connection string (secure!)
- Backup IDs
- Rollback commands
- Support contact (if needed)
