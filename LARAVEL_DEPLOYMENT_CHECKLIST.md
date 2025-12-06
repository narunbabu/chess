# Laravel Deployment - Quick Action Checklist

## 🎯 Your Specific Situation

- **Backend**: Laravel (PHP)
- **Frontend**: React
- **Database**: PostgreSQL on Render
- **Hosting**: Render.com
- **Changes**: Tournament generation feature + visualizer
- **Migration**: Add `championship_id` column to `tournament_rounds`
- **Risk Level**: **LOW** (additive changes only)

## ⏱️ Timeline: ~1.5 hours

- Preparation: 20 min
- Deployment: 10 min
- Testing: 45 min
- Monitoring: 15 min

## 📋 Pre-Deployment (20 minutes)

### 1. Backup Database (5 min)
- [ ] Log into Render Dashboard
- [ ] Navigate to PostgreSQL database
- [ ] Click "Backups" → "Create Manual Backup"
- [ ] **Wait for completion**
- [ ] Note backup timestamp: _______________

### 2. Test Locally (10 min)
```bash
cd chess-backend

# Clear caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear

# Check migration status
php artisan migrate:status

# Run migration locally
php artisan migrate

# Test application
php artisan serve
# Open: http://localhost:8000

# Test rollback
php artisan migrate:rollback --step=1

# Re-run
php artisan migrate
```

- [ ] Migration runs successfully
- [ ] Application works correctly
- [ ] Rollback works
- [ ] Re-migration works

### 3. Choose Security Option (5 min)

**Option A: Quick HTML Token** (5 min setup)
- Add security script to visualizer HTML
- Choose a secure token
- Store token in password manager

**Option B: Laravel Middleware** (15 min setup)
- Create AdminAuthMiddleware
- Register in Kernel
- Protect routes
- Add ADMIN_TOKEN to .env

**My Recommendation: Start with Option A** (faster)
You can upgrade to Option B later if needed.

## 🚀 Deployment (10 minutes)

### 1. Implement Security (5 min)

If using **Option A** (Quick HTML Token):

Edit `chess-backend/public/tournament_db_visualizer.html`, add after `<body>`:

```html
<script>
(function() {
    const isProduction = !window.location.hostname.includes('localhost') &&
                        !window.location.hostname.includes('127.0.0.1');
    if (isProduction) {
        const stored = sessionStorage.getItem('admin_verified');
        if (!stored) {
            const token = prompt('🔒 Enter admin token:');
            // Generate token: php artisan tinker >>> Str::random(32)
            if (token !== 'REPLACE_WITH_YOUR_SECURE_TOKEN') {
                document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px;">🚫 Access Denied</h1>';
                throw new Error('Unauthorized');
            }
            sessionStorage.setItem('admin_verified', 'true');
        }
    }
})();
</script>
```

Generate your token:
```bash
php artisan tinker
>>> use Illuminate\Support\Str;
>>> Str::random(32)
# Use the output above
```

- [ ] Security script added
- [ ] Token generated and saved securely
- [ ] Token replaced in script

### 2. Commit and Push (5 min)

```bash
cd /mnt/c/ArunApps/Chess-Web

git add .
git commit -m "feat: add tournament generation and admin visualizer

- Add tournament generation API endpoint
- Add visualizer enhancements for championship selection
- Add admin access control for visualizer
- Migration: add championship_id to tournament_rounds table

Safe migration: adds nullable column, no data loss risk"

git push origin main
```

- [ ] Changes committed
- [ ] Pushed to GitHub
- [ ] Render deployment started (check dashboard)

### 3. Monitor Render Deployment

Watch Render Dashboard:
- [ ] Build started
- [ ] `composer install` completed
- [ ] Migrations running
- [ ] Build successful
- [ ] Service restarting
- [ ] Deployment complete

## ✅ Post-Deployment Testing (45 minutes)

### Immediate Checks (5 min)

- [ ] Site loads: https://your-app.onrender.com
- [ ] No 500 errors in logs
- [ ] Database connection working

### Critical User Flows (20 min)

**Existing Features:**
- [ ] User can log in
- [ ] User can register
- [ ] Games load correctly
- [ ] Can create/join games
- [ ] Can view championships
- [ ] Existing tournaments visible (if any)

**Data Integrity:**
```bash
# Via Render Shell or local connection
php artisan tinker

>>> DB::table('users')->count()
# Should match your user count

>>> DB::table('championships')->count()
# Should include your championships

>>> DB::table('tournament_rounds')->count()
# Should show existing rounds

>>> Schema::hasColumn('tournament_rounds', 'championship_id')
# Should return: true
```

- [ ] User data intact
- [ ] Championships intact
- [ ] Games intact
- [ ] Migration applied successfully

### New Features (15 min)

**Tournament Generation:**
- [ ] Can access visualizer: https://your-app.onrender.com/tournament_db_visualizer.html
- [ ] Security prompt appears (if in production)
- [ ] Can load championships
- [ ] Can select championship from dropdown
- [ ] "Generate Tournament" button works
- [ ] Tournament structure created correctly
- [ ] Rounds and matches displayed

**API Endpoints:**
```bash
# Test with token if secured
curl https://your-app.onrender.com/api/championships

curl -X POST https://your-app.onrender.com/api/championships/101/generate-tournament

curl https://your-app.onrender.com/api/championships/101/tournament
```

- [ ] GET championships works
- [ ] POST generate-tournament works
- [ ] GET tournament data works

### Performance Check (5 min)

- [ ] Page load times normal (<3s)
- [ ] API response times normal (<500ms)
- [ ] No database slow query warnings
- [ ] Memory usage normal

## 📊 Monitoring (15 minutes)

### Laravel Logs

Via Render Dashboard → Logs, watch for:
- ❌ Fatal errors
- ❌ Database connection errors
- ❌ Migration failures
- ❌ 500 status codes
- ⚠️ Warning messages
- ✅ Successful requests

### Database Queries

```bash
php artisan tinker

# Check for slow queries
>>> DB::getQueryLog()

# Monitor active connections
>>> DB::select("SELECT count(*) FROM pg_stat_activity WHERE datname = 'your_db'")
```

- [ ] No slow queries (>1s)
- [ ] Connection pool healthy
- [ ] No connection leaks

## 🚨 If Something Goes Wrong

### Immediate Rollback

```bash
# Option 1: Git revert
git revert HEAD
git push origin main
# Render auto-deploys previous version

# Option 2: Render Dashboard
# Go to: Service → Deploys → Click "Rollback" on previous deploy
```

### Database Rollback

```bash
# Via Render Shell
php artisan migrate:rollback --step=1

# Or restore from backup
# Render Dashboard → Database → Backups → Restore
```

### Emergency Contacts

- Render Status: https://status.render.com
- Render Support: https://render.com/support

## ✅ Success Criteria

After 1 hour, you should see:

- ✅ **Zero** increase in error rate
- ✅ All existing features working
- ✅ New tournament generation working
- ✅ Visualizer accessible (with token if production)
- ✅ Migration applied: `championship_id` column exists
- ✅ No user complaints
- ✅ Database performing normally
- ✅ Laravel logs clean

## 📝 Post-Deployment Notes

Update `docs/context.md`:

```markdown
## Recent Changes (YYYY-MM-DD)

### Tournament Generation Feature
- Added tournament structure generation API
- Enhanced visualizer for championship management
- Migration: Added championship_id to tournament_rounds (nullable)
- Security: Admin token protection for visualizer

### Deployment Notes
- Deployed: [DATE/TIME]
- Migration batch: [BATCH_NUMBER]
- Backup ID: [BACKUP_ID]
- Issues: [NONE / LIST ANY]
```

## 🎉 Final Recommendation

**Deploy with:**
- ✅ Option A security (Quick HTML token)
- ✅ Manual database backup
- ✅ **NO offline time** (not needed)
- ✅ Monitor for 1 hour
- ✅ Test thoroughly

**Why this is safe:**
- Migration is non-destructive (adds nullable column)
- New features don't affect existing code
- Can rollback instantly via Git
- Laravel migrations are transactional
- Render deployment is atomic

**Risk Level: LOW** 🟢

You're ready to deploy! 🚀

## Quick Commands Reference

```bash
# Laravel
php artisan migrate                    # Run migrations
php artisan migrate:status            # Check status
php artisan migrate:rollback --step=1 # Rollback last
php artisan config:clear              # Clear config cache
php artisan route:clear               # Clear routes
php artisan tinker                    # Database shell

# Git
git status                            # Check changes
git add .                             # Stage all
git commit -m "message"               # Commit
git push origin main                  # Deploy

# Testing
curl https://your-app.onrender.com/api/championships
php artisan serve                     # Local server
```
