# Deployment Plan - Laravel Backend

## Laravel-Specific Deployment Strategy

### 1. Visualizer Security (Laravel)

#### Option 1: Middleware Protection (Recommended)

Create a middleware for admin access:

```bash
cd chess-backend
php artisan make:middleware AdminAuthMiddleware
```

**File: `app/Http/Middleware/AdminAuthMiddleware.php`**

```php
<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AdminAuthMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        // Allow in local development
        if (config('app.env') === 'local') {
            return $next($request);
        }

        // Check for admin token
        $token = $request->header('X-Admin-Token')
                 ?? $request->query('token')
                 ?? $request->input('token');

        $adminToken = config('app.admin_token');

        if ($token !== $adminToken) {
            abort(403, 'Forbidden - Admin access required');
        }

        return $next($request);
    }
}
```

**Register middleware in `app/Http/Kernel.php`:**

```php
protected $routeMiddleware = [
    // ... existing middleware
    'admin.auth' => \App\Http\Middleware\AdminAuthMiddleware::class,
];
```

**Protect routes in `routes/web.php` or `routes/api.php`:**

```php
// Protect visualizer page
Route::get('/tournament_db_visualizer.html', function () {
    return response()->file(public_path('tournament_db_visualizer.html'));
})->middleware('admin.auth');

// Protect admin API endpoints
Route::middleware('admin.auth')->group(function () {
    Route::post('/api/championships/{id}/generate-tournament', [TournamentController::class, 'generateTournament']);
});
```

**Add to `.env`:**

```env
ADMIN_TOKEN=your-secure-random-token-here
```

**Add to `config/app.php`:**

```php
'admin_token' => env('ADMIN_TOKEN', 'development-token'),
```

#### Option 2: Simple Token in HTML (Quick Setup)

Add this to the top of `public/tournament_db_visualizer.html`:

```html
<script>
(function() {
    const isProduction = !window.location.hostname.includes('localhost') &&
                        !window.location.hostname.includes('127.0.0.1');

    if (isProduction) {
        const stored = sessionStorage.getItem('admin_verified');
        if (!stored) {
            const token = prompt('Enter admin access token:');
            if (token !== 'YOUR_SECRET_TOKEN_HERE') {
                document.body.innerHTML = '<h1 style="color:red;text-align:center;margin-top:100px;">Access Denied</h1>';
                throw new Error('Unauthorized');
            }
            sessionStorage.setItem('admin_verified', 'true');
        }
    }
})();
</script>
```

### 2. Migration Safety (Laravel)

#### Check Migration Status

```bash
cd chess-backend
php artisan migrate:status
```

#### Test Migration Locally

```bash
# Run migration
php artisan migrate

# Test application
php artisan serve

# Rollback if needed
php artisan migrate:rollback

# Re-run
php artisan migrate
```

#### Production Migration

```bash
# Run on production (via Render or direct)
php artisan migrate --force

# The --force flag is required in production
```

### 3. Database Backup

#### Via Render Dashboard
1. Go to Render Dashboard
2. Navigate to PostgreSQL database
3. Click "Backups"
4. Create manual backup
5. Wait for completion

#### Via Command Line (if you have DB access)

```bash
# Backup
php artisan db:backup  # If you have a backup package installed

# Or direct PostgreSQL
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4. Deployment Process

#### Pre-Deployment Checklist

```bash
# 1. Test locally
cd chess-backend
php artisan config:clear
php artisan cache:clear
php artisan migrate:status

# 2. Run tests (if you have them)
php artisan test

# 3. Check for errors
php artisan route:list  # Verify routes exist
```

#### Deploy to Render

```bash
# Commit changes
git add .
git commit -m "feat: add tournament generation and admin tools

- Add tournament generation API
- Add visualizer enhancements
- Add admin authentication middleware
- Safe migration: add championship_id to tournament_rounds"

# Push to GitHub
git push origin main
```

Render will automatically:
1. Pull new code
2. Run `composer install`
3. Run migrations (if configured)
4. Clear cache
5. Restart PHP-FPM

### 5. Render Configuration

Ensure your Render service has:

**Build Command:**
```bash
composer install --optimize-autoloader --no-dev && php artisan config:cache && php artisan route:cache && php artisan migrate --force
```

**Start Command:**
```bash
php artisan serve --host=0.0.0.0 --port=$PORT
```

Or if using Apache/Nginx:
```bash
apache2-foreground
```

**Environment Variables:**
```
APP_ENV=production
APP_DEBUG=false
APP_KEY=base64:your-app-key
DB_CONNECTION=pgsql
DB_HOST=your-db-host
DB_DATABASE=your-db-name
DB_USERNAME=your-db-user
DB_PASSWORD=your-db-password
ADMIN_TOKEN=your-secure-admin-token
```

### 6. Post-Deployment Testing

#### Immediate Tests (5 minutes)

```bash
# Check logs
# In Render dashboard, view logs

# Test endpoints
curl https://your-app.onrender.com/api/health
curl https://your-app.onrender.com/api/championships
```

#### Critical User Flows (15 minutes)

- [ ] User login/registration
- [ ] View championships
- [ ] View existing games
- [ ] Play a game
- [ ] View tournament (if exists)

#### New Features (10 minutes)

- [ ] Create championship
- [ ] Generate tournament (with admin token)
- [ ] View tournament structure
- [ ] Start match

### 7. Rollback Procedure

#### Via Git

```bash
# Revert to previous version
git revert HEAD
git push origin main
# Render auto-deploys
```

#### Via Render Dashboard

1. Go to Render Dashboard
2. Click on your service
3. Go to "Deploys" tab
4. Click "Rollback" on previous successful deploy

#### Database Rollback

```bash
# Rollback last migration
php artisan migrate:rollback --step=1

# Or restore from backup
psql $DATABASE_URL < backup_file.sql
```

## Timeline & Risk Assessment

### Deployment Timeline
- **Preparation**: 20 minutes (backup, testing)
- **Deployment**: 5-10 minutes (git push + Render build)
- **Verification**: 45 minutes (testing, monitoring)
- **Total**: ~1.5 hours

### Risk Level: **LOW**

**Why:**
- Migration only adds new column (non-destructive)
- New features don't affect existing functionality
- Can rollback easily via Git or Render
- Laravel migrations are transactional

### Offline Time: **NOT NEEDED**

**Reasons:**
- Additive changes only
- No breaking API changes
- Existing features unchanged
- Fast deployment on Render

## Monitoring After Deployment

### Laravel-Specific Checks

```bash
# View logs
tail -f storage/logs/laravel.log

# Or via Render
render logs <service-name>

# Check database
php artisan tinker
>>> DB::table('tournament_rounds')->count()
>>> DB::table('championships')->count()
```

### What to Watch For

- ❌ 500 errors (check Laravel logs)
- ❌ Database connection errors
- ❌ Migration failures
- ❌ Middleware blocking legitimate requests
- ✅ Successful tournament generation
- ✅ API responses within normal ranges

## Quick Command Reference

```bash
# Laravel Commands
php artisan migrate                    # Run migrations
php artisan migrate:status            # Check status
php artisan migrate:rollback          # Rollback
php artisan config:clear              # Clear config cache
php artisan route:clear               # Clear route cache
php artisan cache:clear               # Clear application cache

# Database
php artisan tinker                    # Interactive shell
php artisan db:show                   # Show database info

# Logs
tail -f storage/logs/laravel.log     # Watch logs
php artisan log:clear                # Clear logs (if installed)
```

## Success Criteria

After 1 hour:
- ✅ Zero increase in error rate
- ✅ All existing features working
- ✅ New tournament generation working
- ✅ Visualizer accessible with token
- ✅ Migration applied successfully
- ✅ No database connection issues
- ✅ Laravel logs clean
