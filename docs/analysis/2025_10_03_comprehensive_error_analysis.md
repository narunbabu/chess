# Comprehensive Production Error Analysis & Remediation Plan

**Date:** 2025-10-03
**Environment:** Production Server (chessab.site)
**Analysis Period:** Last 50 error entries
**Risk Assessment:** Medium-High (functionality impaired, no data loss)

---

## Executive Summary

**Total Error Categories:** 5
**Critical Issues:** 2 (ENUM mismatches)
**High Priority:** 2 (Migration/FK integrity, Reverb port conflicts)
**Low Priority:** 2 (Bot traffic, Business logic validation)

**Current Impact:**
- ❌ "Kill Game" feature completely broken (3+ failures)
- ✅ Core gameplay (moves, resignation via button) working
- ⚠️ Database integrity concerns (FK constraints)
- ⚠️ Reverb instability (port conflicts)

---

# Category 1: Schema ENUM Mismatches (CRITICAL)

## 1.1 Status Value Mismatch

### Error Details
```
SQLSTATE[01000]: Warning: 1265 Data truncated for column 'status' at row 1
SQL: update `games` set `status` = abandoned, `ended_at` = 2025-10-03 10:02:47,
     `end_reason` = killed, `games`.`updated_at` = 2025-10-03 10:02:47 where `id` = 2
```

**Occurrences:** 3 instances (games #1, #2, #9)
**Affected Feature:** "Kill Game" button in multiplayer UI
**User Impact:** Players cannot forcefully abort/delete games

### Root Cause Analysis

**Database Schema (Migration: 2025_09_27_124000_create_games_table.php:22)**
```php
$table->enum('status', ['waiting', 'active', 'finished', 'aborted'])->default('waiting');
```

**Frontend Code (PlayMultiplayer.js:872)**
```javascript
await wsService.current.updateGameStatus('abandoned', null, 'killed');
```

**Backend Validation (WebSocketController.php:605)**
```php
'status' => 'required|string|in:waiting,active,completed,paused,abandoned'
```

**Backend Logic (GameRoomService.php:548)**
```php
if ($status === 'completed' || $status === 'abandoned') {
    $updateData['ended_at'] = now();
}
```

### Mismatch Matrix

| Layer | Allows 'abandoned' | Allows 'aborted' | Allows 'completed' | Allows 'finished' |
|-------|-------------------|------------------|-------------------|-------------------|
| **Database ENUM** | ❌ | ✅ | ❌ | ✅ |
| **Frontend** | ✅ Sends | ❌ | ❌ | ❌ |
| **Controller Validation** | ✅ Accepts | ❌ Blocks | ✅ Accepts | ❌ Blocks |
| **Service Logic** | ✅ Checks | ❌ | ✅ Checks | ❌ |

**Result:** Frontend → Validation Pass → Service Pass → **Database Reject** 💥

### Impact Assessment

**Broken Functionality:**
- ✅ **Working:** Normal game flow (waiting → active → finished via checkmate/resignation)
- ❌ **Broken:** "Kill Game" button (manual game abortion)
- ✅ **Working:** Resignation via resign button (uses 'finished' status correctly in GameController)
- ⚠️ **Risky:** Any code checking `status === 'abandoned'` or `'completed'` will never match DB reality

**Data Integrity:**
- Games that fail to update remain in previous status (likely 'active')
- Error logged but game state inconsistent
- Users see game as active but can't make moves

---

## 1.2 End Reason Value Mismatch

### Error Details
```
SQLSTATE[01000]: Warning: 1265 Data truncated for column 'end_reason' at row 1
SQL: ... `end_reason` = killed ...
```

**Occurrences:** 3 instances (same as status errors)
**Affected Feature:** Same - "Kill Game" button

### Root Cause Analysis

**Database Schema (Migration: 2025_09_27_124000_create_games_table.php:30-40)**
```php
$table->enum('end_reason', [
    'checkmate',
    'resignation',
    'stalemate',
    'timeout',
    'draw_agreed',
    'threefold',
    'fifty_move',
    'insufficient_material',
    'aborted'
])->nullable();
```

**Frontend Code (PlayMultiplayer.js:872)**
```javascript
await wsService.current.updateGameStatus('abandoned', null, 'killed');
//                                                           ^^^^^^^^ NOT IN ENUM
```

**Backend:** No validation on 'reason' field (line 607: `'reason' => 'nullable|string'`)

### Impact Assessment

- ❌ `'killed'` not in ENUM → always fails
- ✅ Valid reasons work: 'resignation', 'checkmate', etc.
- ⚠️ No backend validation means any invalid reason passes controller but fails at DB

---

## Remediation Options for Category 1

### Option A: Expand Database Schema (Recommended - Safest)

**Action:** Add missing values to ENUMs

**Migration:**
```php
// New migration: 2025_10_03_add_missing_enum_values.php
public function up()
{
    DB::statement("ALTER TABLE games MODIFY COLUMN status ENUM(
        'waiting', 'active', 'finished', 'aborted',
        'abandoned', 'completed', 'paused'
    ) DEFAULT 'waiting'");

    DB::statement("ALTER TABLE games MODIFY COLUMN end_reason ENUM(
        'checkmate', 'resignation', 'stalemate', 'timeout',
        'draw_agreed', 'threefold', 'fifty_move',
        'insufficient_material', 'aborted', 'killed'
    ) NULL");
}
```

**Pros:**
- ✅ Zero code changes to working functionality
- ✅ Immediate fix - deploy migration and feature works
- ✅ Backward compatible - all existing queries still work
- ✅ No risk to move broadcasting or resignation features

**Cons:**
- ⚠️ Schema now has redundant values ('aborted' vs 'abandoned', 'finished' vs 'completed')
- ⚠️ Future confusion - which value to use?

**Risk:** **VERY LOW** - Only adds values, doesn't change existing data or code

---

### Option B: Standardize on Schema Values (Cleanest, Higher Risk)

**Action:** Change frontend and backend to use DB values

**Changes Required:**

1. **Frontend (PlayMultiplayer.js:872)**
   ```javascript
   // Before
   await wsService.current.updateGameStatus('abandoned', null, 'killed');

   // After
   await wsService.current.updateGameStatus('aborted', null, 'aborted');
   ```

2. **Backend Validation (WebSocketController.php:605)**
   ```php
   // Before
   'status' => 'required|string|in:waiting,active,completed,paused,abandoned'

   // After
   'status' => 'required|string|in:waiting,active,finished,aborted'
   ```

3. **Backend Logic (GameRoomService.php:548)**
   ```php
   // Before
   if ($status === 'completed' || $status === 'abandoned') {

   // After
   if ($status === 'finished' || $status === 'aborted') {
   ```

4. **Search & Replace All:**
   ```bash
   # Backend
   rg -l "status.*===.*'(completed|abandoned)'" app/ | xargs sed -i "s/'completed'/'finished'/g; s/'abandoned'/'aborted'/g"

   # Frontend
   rg -l "(completed|abandoned)" src/ | xargs sed -i "s/'abandoned'/'aborted'/g; s/'completed'/'finished'/g"
   ```

**Pros:**
- ✅ Schema consistency - one source of truth
- ✅ No redundant values
- ✅ Future-proof - prevents similar issues

**Cons:**
- ❌ Changes 3+ files across frontend/backend
- ❌ Must test ALL status-related flows
- ❌ Risk of breaking working resignation/game-end logic
- ❌ Requires frontend rebuild + backend deployment coordination

**Risk:** **MEDIUM-HIGH** - Touches working code paths

---

### Option C: Value Mapping Layer (Most Robust, Most Complex)

**Action:** Add translation layer in backend controller

**Implementation:**
```php
// WebSocketController.php - NEW method
private function normalizeGameStatus(string $clientStatus): string
{
    $statusMap = [
        'abandoned' => 'aborted',
        'completed' => 'finished',
        'paused' => 'finished', // or handle separately
    ];
    return $statusMap[$clientStatus] ?? $clientStatus;
}

private function normalizeEndReason(?string $clientReason): ?string
{
    if (!$clientReason) return null;

    $reasonMap = [
        'killed' => 'aborted',
    ];
    return $reasonMap[$clientReason] ?? $clientReason;
}

// In updateGameStatus() method
$status = $this->normalizeGameStatus($request->input('status'));
$reason = $this->normalizeEndReason($request->input('reason'));

$result = $this->gameRoomService->updateGameStatus(
    $gameId, Auth::id(), $status, $request->input('result'), $reason, $socketId
);
```

**Update Validation:**
```php
'status' => 'required|string|in:waiting,active,completed,paused,abandoned,finished,aborted',
'reason' => 'nullable|string|in:killed,aborted,checkmate,resignation,stalemate,timeout,draw_agreed,threefold,fifty_move,insufficient_material',
```

**Pros:**
- ✅ Backward compatible with existing frontend
- ✅ Accepts both old and new values
- ✅ No frontend changes needed
- ✅ Isolated change - only touches one controller
- ✅ Easy to test

**Cons:**
- ⚠️ Adds abstraction layer
- ⚠️ Still need to update GameRoomService.php logic checks
- ⚠️ Frontend still sends "wrong" values

**Risk:** **LOW-MEDIUM** - Isolated change, but still modifies controller

---

### Recommended Approach: **Option A + C Combined**

**Phase 1: Immediate Fix (Option A - Zero Risk)**
```bash
# 1. Deploy migration to expand ENUMs
php artisan make:migration add_missing_game_status_values
# (Add DB::statement ALTER TABLE commands)
php artisan migrate

# 2. Test "Kill Game" feature
# Should work immediately with no code changes
```

**Phase 2: Technical Debt Reduction (Option C - Low Risk)**
```bash
# 3. Add value mapping in controller (safety net)
# Prevents future issues if new status values introduced

# 4. Add validation on 'reason' field
# Currently accepts any string - should validate against ENUM
```

**Phase 3: Gradual Migration (Optional - Future)**
```bash
# 5. Update frontend to use canonical values over time
# 6. Eventually remove redundant ENUM values
# 7. Remove mapping layer once migration complete
```

---

# Category 2: Migration & Foreign Key Integrity (HIGH PRIORITY)

## 2.1 Foreign Key Constraint Errors

### Error Details
```
Failed to open the referenced table 'games'
Cannot drop table 'users' ... referenced by ... game_histories_user_id_foreign
Table 'game_histories' already exists
```

### Root Cause Analysis

**Migration Order (Correct):**
```
0001_01_01_000000_create_users_table.php
2025_09_27_124000_create_games_table.php
2025_09_27_125000_create_game_histories_table.php  ← FKs to users + games
```

**Possible Scenarios:**

1. **Partial Migration Failure**
   - Migration started but failed mid-execution
   - Table created but FK constraints failed
   - `migrations` table shows incomplete state

2. **Manual SQL Execution**
   - Developer ran SQL manually out of order
   - FKs attempted before parent tables ready

3. **Database State Corruption**
   - Migrations ran in wrong environment
   - Database restored from partial backup

4. **Re-running Migrations**
   - `php artisan migrate:fresh` attempted on production (dangerous)
   - `migrate:rollback` failed mid-operation

### Impact Assessment

**Current State Unknown - Need Diagnosis:**
```bash
# Check what actually exists
mysql -u root -p chess_production -e "
    SELECT TABLE_NAME, TABLE_TYPE
    FROM information_schema.TABLES
    WHERE TABLE_SCHEMA = 'chess_production'
    ORDER BY TABLE_NAME;
"

# Check FK constraints
mysql -u root -p chess_production -e "
    SELECT
        TABLE_NAME, CONSTRAINT_NAME, REFERENCED_TABLE_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'chess_production'
    AND REFERENCED_TABLE_NAME IS NOT NULL;
"

# Check migration status
php artisan migrate:status
```

---

## 2.2 Cache Table Missing

### Error Details
```
Table 'chess_production.cache' doesn't exist
```

### Root Cause
- Cache migration (0001_01_01_000001_create_cache_table.php) never ran
- Or table was manually dropped

### Quick Fix
```bash
php artisan migrate --path=database/migrations/0001_01_01_000001_create_cache_table.php
```

**Risk:** **VERY LOW** - Independent table, no FKs

---

## Remediation Plan for Category 2

### Step 1: Diagnosis (Read-Only, Zero Risk)

```bash
# Save current state
mysqldump -u root -p chess_production --no-data > /tmp/schema_backup_$(date +%Y%m%d_%H%M%S).sql

# Check table existence
mysql -u root -p chess_production -e "
    SHOW TABLES;
    SHOW CREATE TABLE users\G
    SHOW CREATE TABLE games\G
    SHOW CREATE TABLE game_histories\G
"

# Check FK constraints
mysql -u root -p chess_production -e "
    SELECT * FROM information_schema.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = 'chess_production'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY';
"

# Check Laravel migration status
php artisan migrate:status
```

### Step 2: Fix Based on Findings

**Scenario A: Tables exist, FKs missing**
```sql
-- Safe: Just add missing FKs
ALTER TABLE game_histories
  ADD CONSTRAINT game_histories_user_id_foreign
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  ADD CONSTRAINT game_histories_game_id_foreign
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE SET NULL;
```

**Scenario B: Tables exist, wrong FKs**
```sql
-- Drop bad constraints
ALTER TABLE game_histories
  DROP FOREIGN KEY game_histories_user_id_foreign;

ALTER TABLE game_histories
  DROP FOREIGN KEY game_histories_game_id_foreign;

-- Re-add correct ones (as in Scenario A)
```

**Scenario C: Table doesn't exist**
```bash
# Run specific migration
php artisan migrate --path=database/migrations/2025_09_27_125000_create_game_histories_table.php
```

**Scenario D: Migrations table corrupted**
```bash
# Check migrations table
mysql -u root -p chess_production -e "SELECT * FROM migrations ORDER BY id;"

# If needed, manually insert/update migration records
# (Advanced - requires careful handling)
```

### Step 3: Verification

```bash
# Verify all FKs present
mysql -u root -p chess_production -e "
    SELECT
        TABLE_NAME,
        CONSTRAINT_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME
    FROM information_schema.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = 'chess_production'
    AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME;
"

# Should show:
# game_histories | game_histories_game_id_foreign | games | id
# game_histories | game_histories_user_id_foreign | users | id
# games | games_white_player_id_foreign | users | id
# games | games_black_player_id_foreign | users | id
# ... etc
```

**Risk:** **LOW** (if following Scenario A/B), **MEDIUM** (if Scenario C/D)

---

# Category 3: Reverb / WebSocket Process Issues (HIGH PRIORITY)

## 3.1 Port Conflict - EADDRINUSE

### Error Details
```
EADDRINUSE 0.0.0.0:8080
```

### Root Cause
Multiple Reverb processes fighting for port 8080, or Nginx stream proxy binding the port.

### Diagnosis

```bash
# Find what's using port 8080
sudo lsof -i :8080 -sTCP:LISTEN -Pn
sudo netstat -tlnp | grep :8080

# Check Reverb service
sudo systemctl status laravel-reverb
sudo journalctl -u laravel-reverb -n 100 --no-pager

# Check for zombie processes
ps aux | grep reverb | grep -v grep
```

### Remediation

**Option 1: Kill Duplicate Processes**
```bash
# Find all Reverb processes
ps aux | grep reverb

# Kill specific PID (from output above)
sudo kill -9 <PID>

# Or kill all
sudo pkill -9 -f "artisan reverb"

# Restart service cleanly
sudo systemctl restart laravel-reverb
```

**Option 2: Change Port**
```bash
# In .env
REVERB_PORT=8081

# Update Nginx proxy
sudo nano /etc/nginx/sites-available/chessab.site
# Change: proxy_pass http://127.0.0.1:8081;

# Restart both
sudo systemctl restart laravel-reverb
sudo systemctl reload nginx
```

**Option 3: Use Systemd Exclusively**
```bash
# Ensure only systemd manages Reverb
# Remove any manual `php artisan reverb:start` from cron/startup scripts

# Systemd unit should be sole source of truth:
cat /etc/systemd/system/laravel-reverb.service
```

**Risk:** **LOW** - Infrastructure fix, doesn't touch code

---

## 3.2 Invalid Artisan Commands

### Error Details
```
Command "reverb:stop" is not defined
The "--debug" option does not exist
```

### Root Cause
User executed non-existent commands.

### Solution
**Documentation - Correct Commands:**
```bash
# Valid Reverb commands
php artisan reverb:start         # Start (foreground)
php artisan reverb:start --host=127.0.0.1 --port=8080

# Systemd management (preferred)
sudo systemctl start laravel-reverb
sudo systemctl stop laravel-reverb
sudo systemctl restart laravel-reverb
sudo systemctl status laravel-reverb

# Logs
journalctl -u laravel-reverb -f
tail -f storage/logs/laravel.log
```

**Risk:** **NONE** - Just education

---

# Category 4: Bot Traffic & Route Noise (LOW PRIORITY)

## 4.1 WordPress Probes

### Error Details
```
The route wordpress could not be found
Requests to: /wordpress, /wp-admin, /wp-login.php
```

### Root Cause
Internet scanners probing for WordPress installations (automated bots).

### Impact
- No functional impact
- Clutters logs
- Minimal server load

### Remediation Options

**Option 1: Ignore (Recommended)**
- These are normal on public servers
- Not affecting functionality

**Option 2: Reduce Log Noise**
```php
// app/Exceptions/Handler.php
public function register()
{
    $this->renderable(function (NotFoundHttpException $e, $request) {
        // Don't log common bot probes
        if ($request->is('wordpress') ||
            $request->is('wp-admin') ||
            $request->is('wp-login.php')) {
            return response('', 404);
        }
    });
}
```

**Option 3: Rate Limit**
```php
// routes/web.php
Route::fallback(function() {
    return response('Not Found', 404);
})->middleware('throttle:10,1'); // 10 requests per minute
```

**Risk:** **VERY LOW**

---

## 4.2 Invalid Method on IP

### Error Details
```
The POST method is not supported for route / ...
POST requests to https://69.62.73.225/
```

### Root Cause
Bots sending POST to root URL (raw IP instead of domain).

### Remediation

**Option 1: Nginx Block**
```nginx
# In /etc/nginx/sites-available/chessab.site
server {
    listen 80;
    server_name 69.62.73.225;  # Your IP
    return 444;  # Close connection without response
}
```

**Option 2: Laravel Middleware**
```php
// app/Http/Middleware/ValidateHostname.php
public function handle($request, Closure $next)
{
    $allowedHosts = ['chessab.site', 'www.chessab.site'];

    if (!in_array($request->getHost(), $allowedHosts)) {
        abort(403, 'Invalid host');
    }

    return $next($request);
}
```

**Risk:** **VERY LOW**

---

# Category 5: Business Logic Validation (EXPECTED BEHAVIOR)

## 5.1 "Game is Already Finished"

### Error Details
```
Failed to resign game {"error":"Game is already finished"}
```

### Root Cause
```php
// GameRoomService.php:737-739
if ($game->status === 'finished') {
    throw new \Exception('Game is already finished');
}
```

### Analysis
This is **CORRECT** validation:
- User tried to resign an already-ended game
- Proper error handling
- Returns 400 with clear message

### Impact
- No fix needed
- User experience consideration: UI should disable resign button when game finished

### Optional UX Enhancement
```javascript
// Frontend: PlayMultiplayer.js
const canResign = gameState?.status === 'active' && !gameState?.game_over;

<button
  disabled={!canResign}
  onClick={handleResign}
>
  Resign
</button>
```

**Risk:** **NONE** - This is working as designed

---

# Complete Implementation Plan

## Phase 1: Immediate Fixes (Deploy Today)

**Priority: Critical - Zero Risk**

### 1.1 Fix ENUM Mismatches (Option A)
```bash
# 1. Create migration
php artisan make:migration add_missing_game_enum_values --path=database/migrations

# 2. Add to migration:
# DB::statement("ALTER TABLE games MODIFY COLUMN status ...")
# DB::statement("ALTER TABLE games MODIFY COLUMN end_reason ...")

# 3. Deploy
git add database/migrations/*add_missing_game_enum_values.php
git commit -m "Fix: Add missing status/end_reason ENUM values for kill game feature"
git push origin master

# 4. On server
cd /var/www/chessab.site
git pull
php artisan migrate --force
php artisan config:clear && php artisan cache:clear
```

**Test:** Click "Kill Game" button → should work without errors

**Rollback Plan:**
```bash
php artisan migrate:rollback --step=1
```

---

### 1.2 Fix Cache Table
```bash
# On server
php artisan migrate --path=database/migrations/0001_01_01_000001_create_cache_table.php --force
```

**Risk:** None

---

### 1.3 Fix Reverb Port Conflicts
```bash
# On server
sudo systemctl stop laravel-reverb
sudo pkill -9 -f reverb
sudo lsof -i :8080  # Should show nothing
sudo systemctl start laravel-reverb
sudo systemctl status laravel-reverb
journalctl -u laravel-reverb -n 20
```

**Test:** Check WebSocket connections still work

---

## Phase 2: Database Integrity Audit (Next 24 Hours)

**Priority: High - Read-Only Investigation**

```bash
# Run diagnostic queries (from Category 2, Step 1)
# Document findings
# Create repair plan based on actual state
```

**Deliverable:** Document with FK status and repair SQL if needed

---

## Phase 3: Technical Debt Reduction (Next Week)

**Priority: Medium - Gradual Improvements**

### 3.1 Add Value Mapping Layer (Option C)
- Implement normalization methods in WebSocketController
- Add validation on 'reason' field
- Test thoroughly

### 3.2 Reduce Log Noise
- Add exception handling for bot routes
- Implement rate limiting

### 3.3 Frontend UX Improvements
- Disable buttons based on game state
- Add loading states during WebSocket calls
- Better error messages

---

## Testing Checklist

### Before Deployment
- [ ] Backup production database
- [ ] Test migration on local copy of production data
- [ ] Verify ENUM values added correctly
- [ ] Check no existing data affected

### After Phase 1 Deployment
- [ ] Test "Kill Game" feature (2 browsers, different users)
- [ ] Verify error disappeared from logs
- [ ] Test normal game flow (moves, resignation)
- [ ] Check WebSocket connections stable
- [ ] Monitor logs for 30 minutes

### After Phase 2
- [ ] Verify all FK constraints present
- [ ] Test cascading deletes (if applicable)
- [ ] Check migration status clean

---

## Monitoring & Alerts

### Post-Deployment Monitoring

```bash
# Terminal 1: Watch errors
tail -f storage/logs/laravel.log | grep -Ei "error|exception|failed"

# Terminal 2: Watch Reverb
journalctl -u laravel-reverb -f

# Terminal 3: Watch database
mysql -u root -p chess_production -e "SHOW PROCESSLIST;" --table

# Check every 10 minutes for first hour
watch -n 600 'tail -n 100 storage/logs/laravel.log | grep -c ERROR'
```

### Success Metrics
- Zero "Data truncated" errors in 24 hours
- "Kill Game" feature successful (check via user testing)
- Reverb uptime 100% for 24 hours
- No FK constraint errors

---

## Rollback Procedures

### If Phase 1 Migration Fails
```bash
php artisan migrate:rollback --step=1
php artisan config:clear
sudo systemctl restart laravel-reverb
```

### If Functionality Breaks
```bash
# Revert code changes
git revert <commit-hash>
git push origin master

# On server
git pull
php artisan config:clear && php artisan cache:clear
sudo systemctl restart laravel-reverb
```

### If Database Corrupted
```bash
# Restore from backup
mysql -u root -p chess_production < /path/to/backup.sql
```

---

## Risk Matrix

| Phase | Change Type | Risk Level | Rollback Time | Testing Required |
|-------|-------------|------------|---------------|------------------|
| 1.1 ENUM Migration | Schema (additive) | **VERY LOW** | < 1 min | Manual testing |
| 1.2 Cache Table | Schema (new table) | **VERY LOW** | < 1 min | None |
| 1.3 Reverb Restart | Infrastructure | **LOW** | < 30 sec | Connection test |
| 2 FK Integrity | Schema (repair) | **MEDIUM** | 5-10 min | Full regression |
| 3.1 Value Mapping | Code (controller) | **MEDIUM** | 2-3 min | Full regression |
| 3.2 Log Reduction | Code (exception handler) | **LOW** | 2-3 min | None |
| 3.3 Frontend UX | Code (UI) | **LOW** | 2-3 min | UI testing |

---

## Conclusion

**Immediate Action Required:**
1. ✅ Deploy ENUM migration (fixes critical feature)
2. ✅ Fix cache table (removes errors)
3. ✅ Stabilize Reverb (prevents future issues)

**Follow-Up Required:**
4. 📋 Database FK audit
5. 📋 Add value mapping layer
6. 📋 Reduce log noise

**Timeline:**
- **Today:** Phase 1 (30 min deployment + 1 hour monitoring)
- **This Week:** Phase 2 (2 hours investigation)
- **Next Week:** Phase 3 (4-6 hours development + testing)

**Confidence Level:** High - All fixes are well-understood, low-risk, and independently reversible.
