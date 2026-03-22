# Admin Dashboard — Implementation Plan

**Date:** 2025-01-XX
**Status:** PLAN — awaiting approval
**Scope:** Backend API + Frontend SPA for platform administration

---

## 1. Objective

Build a full admin dashboard for Chess99 platform management. The dashboard provides:
- Real-time platform overview (active users, games, revenue)
- User management with activity stats
- Game monitoring with status filters
- Subscription/revenue analytics
- Historical trend charts

---

## 2. Existing Infrastructure (What We Already Have)

### Auth & RBAC
| Asset | Location | Notes |
|-------|----------|-------|
| `CheckRole` middleware | `app/Http/Middleware/CheckRole.php` | Checks `hasAnyRole()` — accepts comma-separated roles |
| `AdminAuthMiddleware` | `app/Http/Middleware/AdminAuthMiddleware.php` | Token-based, skips in local/testing env |
| `roles` table | Seeded with `platform_admin` (hierarchy 100) | Already in prod DB |
| `user_roles` table | Maps users → roles | ab@ameyem.com needs `platform_admin` row |
| `User::isPlatformAdmin()` | `app/Models/User.php` | Checks `hasRole('platform_admin')` |
| Middleware alias `role` | `bootstrap/app.php:93` | Already registered |

### Activity Tracking
| Asset | Location | Notes |
|-------|----------|-------|
| `TrackUserActivity` middleware | `app/Http/Middleware/TrackUserActivity.php` | Global middleware, updates `users.last_activity_at` every 1 min + Redis |
| `users.last_login_at` | Migration `2025_11_12_110006` | Set on login |
| `users.last_activity_at` | Migration `2025_11_15_093118` | Updated by middleware |
| `sessions` table | Laravel default | Has `user_id`, `ip_address`, `user_agent`, `last_activity` |
| `user_presence` table | Tracks online/away/offline | Has `last_activity`, `device_info` |
| `personal_access_tokens.last_used_at` | Sanctum built-in | Token-level last used |

### Existing Admin Routes (Tournament Only)
```
GET  /api/admin/tournaments/overview
GET  /api/admin/tournaments/analytics
GET  /api/admin/tournaments/health
POST /api/admin/tournaments/{id}/start|pause|resume|complete|validate
POST /api/admin/tournaments/maintenance
```
Protected by: `middleware(['role:platform_admin,platform_manager,tournament_organizer'])`

### Key Tables for Dashboard Queries
- `users` — registrations, ratings, subscriptions, activity timestamps
- `games` + `game_statuses` — game lifecycle, player pairs, time controls
- `game_histories` — completed game summaries
- `subscription_plans` — plan definitions (free/silver/gold)
- `subscription_payments` — payment records with `paid_at`, `period_start/end`
- `user_subscriptions` — active subscription state
- `championships` — tournament records
- `matchmaking_queue` — matchmaking activity

---

## 3. Backend Plan

### 3.1 Admin Gate Strategy

**Decision:** Use existing `CheckRole` middleware with `platform_admin` role. No new middleware needed.

**One-time setup:** Assign `platform_admin` role to ab@ameyem.com via a seeder/migration:
```php
// In a migration or tinker:
$user = User::where('email', 'ab@ameyem.com')->first();
$adminRole = Role::where('name', 'platform_admin')->first();
$user->roles()->syncWithoutDetaching([$adminRole->id]);
```

**Route protection pattern:**
```php
Route::prefix('admin')
    ->middleware(['auth:sanctum', 'role:platform_admin'])
    ->group(function () { ... });
```

### 3.2 New Migration: `user_login_history`

**Why:** `users.last_login_at` is overwritten on every login — no history. We need login frequency, session tracking, and IP/device auditing.

```php
Schema::create('user_login_history', function (Blueprint $table) {
    $table->id();
    $table->foreignId('user_id')->constrained()->cascadeOnDelete();
    $table->string('ip_address', 45)->nullable();
    $table->text('user_agent')->nullable();
    $table->string('login_method', 20)->default('password'); // password|google|apple|facebook
    $table->timestamp('logged_in_at');
    $table->timestamp('logged_out_at')->nullable();
    $table->integer('duration_seconds')->nullable(); // computed on logout
    $table->timestamps();

    $table->index(['user_id', 'logged_in_at']);
    $table->index('logged_in_at');
});
```

**Risk:** LOW — additive table, no existing data modified. Production migration is safe.

### 3.3 Record Login Events

**Modify:** `AuthController::login()`, `AuthController::googleMobileLogin()`, `AuthController::appleMobileLogin()`, `SocialAuthController::callback()`

**Logic:** After successful authentication, insert a `user_login_history` row with IP, user-agent, and method.

**Logout tracking:** On `AuthController::logout()`, find the most recent unclosed login record and set `logged_out_at` + compute `duration_seconds`.

### 3.4 Admin API Routes

All under `/api/v1/admin/*` with `auth:sanctum` + `role:platform_admin`.

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/dashboard/overview` | GET | Today's KPIs: active users, games played, avg session, revenue |
| `/admin/users` | GET | Paginated user list with search, sort, activity stats |
| `/admin/users/{id}` | GET | User detail: profile, game history, login history, subscription |
| `/admin/games` | GET | Games list with filters: status, date range, time control |
| `/admin/games/{id}` | GET | Single game detail with moves, connections, performance |
| `/admin/subscriptions` | GET | Subscription breakdown: plan counts, revenue, recent signups |
| `/admin/analytics/daily` | GET | Daily trend data for charts: users, games, subscriptions |
| `/admin/analytics/retention` | GET | Retention metrics: DAU/WAU/MAU, return rates |

### 3.5 Controller: `AdminDashboardController`

Single controller with methods for each endpoint. All queries use Eloquent aggregations — no raw SQL.

#### `overview()` — Dashboard KPI Cards
```php
return [
    'today' => [
        'active_users'      => users where last_activity_at >= today,
        'new_registrations'  => users where created_at >= today,
        'games_completed'    => games where ended_at >= today,
        'games_in_progress'  => games where status = 'active',
        'avg_game_duration'  => avg(ended_at - created_at) for today's finished games,
    ],
    'subscriptions' => [
        'total_paid'        => user_subscriptions where plan != 'free' AND status = 'active',
        'revenue_this_month' => sum(subscription_payments.amount) where paid_at >= month start,
    ],
    'totals' => [
        'total_users'       => users count,
        'total_games'       => games count,
        'online_now'        => users where last_activity_at >= 5 min ago,
    ],
];
```

#### `users()` — Paginated User List
Query params: `?search=`, `?sort=rating|games_played|created_at`, `?order=asc|desc`, `?per_page=25`, `?subscription_tier=`, `?is_active=`

Returns: id, name, email, rating, games_played, subscription_tier, last_login_at, last_activity_at, created_at, is_active, organization name.

#### `userDetail($id)` — Single User Deep View
Returns: full user profile + recent games (last 20) + login history (last 20) + subscription history + rating history (last 30 entries) + tutorial progress summary.

#### `games()` — Game List
Query params: `?status=waiting|active|finished|aborted`, `?date_from=`, `?date_to=`, `?per_page=25`, `?search=` (player name)

Returns: id, white player, black player, status, result, time_control, created_at, ended_at, move_count, end_reason.

#### `subscriptions()` — Subscription Analytics
```php
return [
    'plan_breakdown' => [
        // group by plan_name: count of active subscriptions per tier
        ['plan' => 'free', 'count' => X],
        ['plan' => 'silver', 'count' => Y],
        ['plan' => 'gold', 'count' => Z],
    ],
    'revenue' => [
        'this_month' => sum(amount) from subscription_payments this month,
        'last_month' => sum(amount) from subscription_payments last month,
        'total'      => sum(amount) from subscription_payments all time,
    ],
    'recent_signups' => last 10 user_subscriptions where plan != 'free',
    'churn' => cancelled subscriptions this month,
];
```

#### `dailyAnalytics()` — Trend Data for Charts
Query param: `?days=30` (default 30, max 90)

Returns array of daily data points:
```json
[
    {
        "date": "2025-01-15",
        "new_users": 5,
        "active_users": 42,
        "games_played": 18,
        "games_completed": 15,
        "revenue": 1500.00
    },
    ...
]
```

Built with:
- `users` grouped by `DATE(created_at)` for new_users
- `users` grouped by `DATE(last_activity_at)` for active_users
- `games` grouped by `DATE(created_at)` for games_played
- `games` grouped by `DATE(ended_at)` for games_completed
- `subscription_payments` grouped by `DATE(paid_at)` for revenue

### 3.6 Model: `UserLoginHistory`

Standard Eloquent model with `user()` belongsTo relationship.

---

## 4. Frontend Plan

### 4.1 New Dependencies

```bash
pnpm add recharts @mui/x-data-grid
```

**Why recharts:** Lightweight (125KB gzip), React-native, composable, well-maintained. No heavy charting framework needed for line/bar/pie charts.

**Why @mui/x-data-grid:** Already using MUI — DataGrid gives sorting, filtering, pagination for free. Community (free) edition is sufficient.

### 4.2 Route & Auth Guard

**File:** `src/App.js` — add route:
```jsx
<Route path="/admin/*" element={
    <AdminGuard>
        <AdminDashboard />
    </AdminGuard>
} />
```

**AdminGuard component:** Checks `user.role === 'platform_admin'` or `user.roles?.includes('platform_admin')`. Redirects to `/` if not admin. Shows nothing while loading auth state.

### 4.3 Admin Service

**File:** `src/services/adminService.js`

API client wrapping all `/api/v1/admin/*` endpoints. Uses existing `api.js` axios instance with Sanctum auth headers.

```js
export const adminService = {
    getOverview: ()           => api.get('/api/v1/admin/dashboard/overview'),
    getUsers: (params)        => api.get('/api/v1/admin/users', { params }),
    getUserDetail: (id)       => api.get(`/api/v1/admin/users/${id}`),
    getGames: (params)        => api.get('/api/v1/admin/games', { params }),
    getGameDetail: (id)       => api.get(`/api/v1/admin/games/${id}`),
    getSubscriptions: ()      => api.get('/api/v1/admin/subscriptions'),
    getDailyAnalytics: (days) => api.get('/api/v1/admin/analytics/daily', { params: { days } }),
};
```

### 4.4 Page Structure

```
src/pages/admin/
├── AdminDashboard.js        # Main layout with tab navigation
├── AdminGuard.js            # Auth guard component
├── OverviewTab.js           # KPI cards + daily trend chart
├── UsersTab.js              # DataGrid with search, click-to-expand
├── UserDetailModal.js       # Modal with game history, login history
├── GamesTab.js              # DataGrid with status filters
├── SubscriptionsTab.js      # Plan breakdown chart + revenue + table
└── admin.css                # Scoped styles
```

### 4.5 Component Details

#### OverviewTab (Dashboard Home)
- **4 KPI Cards** (MUI Card): Today's Active Users, Games Completed, Online Now, Monthly Revenue
- **Daily Trends Line Chart** (recharts LineChart): 30-day trend of users + games + revenue
- **Quick Stats Row**: Total Users, Total Games, Paid Subscribers
- Auto-refresh every 60 seconds

#### UsersTab
- **MUI DataGrid** with columns: Name, Email, Rating, Games Played, Subscription, Last Active, Joined
- **Search bar** filtering by name/email
- **Filters**: Subscription tier dropdown, Active/Inactive toggle
- **Click row** → opens UserDetailModal
- Server-side pagination (25 per page)

#### UserDetailModal
- **Profile section**: Avatar, name, email, rating, games played, subscription info
- **Game History table**: Last 20 games with opponent, result, date
- **Login History table**: Last 20 logins with IP, device, duration
- **Rating chart**: Rating over last 30 changes (recharts LineChart)
- **Actions**: (future) Ban user, change role, gift subscription

#### GamesTab
- **MUI DataGrid**: White Player, Black Player, Status, Result, Time Control, Duration, Date
- **Filter chips**: All / Active / Completed / Aborted
- **Date range picker**: From/To date inputs
- Server-side pagination

#### SubscriptionsTab
- **Pie chart** (recharts PieChart): Plan distribution (Free vs Silver vs Gold)
- **Revenue cards**: This Month, Last Month, All Time
- **Recent signups table**: Last 10 paid subscriptions with user, plan, date, amount
- **Month-over-month revenue bar chart** (recharts BarChart)

### 4.6 Date Range Picker

Simple MUI TextField type="date" pair (from/to) — no heavy date picker library. Used in GamesTab and OverviewTab for historical queries.

### 4.7 Navigation

Add "Admin" link to the existing navbar/sidebar — only visible when `user.isPlatformAdmin` or role check passes. Uses existing nav patterns.

---

## 5. Files to Create/Modify

### Backend — New Files
| File | Purpose |
|------|---------|
| `database/migrations/XXXX_create_user_login_history_table.php` | Login history table |
| `app/Models/UserLoginHistory.php` | Eloquent model |
| `app/Http/Controllers/Admin/AdminDashboardController.php` | All admin API endpoints |

### Backend — Modified Files
| File | Change |
|------|--------|
| `routes/api_v1.php` | Add admin route group (~15 lines) |
| `app/Http/Controllers/Auth/AuthController.php` | Record login event on login/OAuth methods |
| `app/Http/Controllers/Auth/SocialAuthController.php` | Record login event on callback |
| `app/Models/User.php` | Add `loginHistory()` hasMany relationship |

### Frontend — New Files
| File | Purpose |
|------|---------|
| `src/pages/admin/AdminDashboard.js` | Main admin page with tabs |
| `src/pages/admin/AdminGuard.js` | Auth guard (role check + redirect) |
| `src/pages/admin/OverviewTab.js` | KPI cards + trend charts |
| `src/pages/admin/UsersTab.js` | User management DataGrid |
| `src/pages/admin/UserDetailModal.js` | User detail modal |
| `src/pages/admin/GamesTab.js` | Game list DataGrid |
| `src/pages/admin/SubscriptionsTab.js` | Subscription analytics |
| `src/pages/admin/admin.css` | Admin-specific styles |
| `src/services/adminService.js` | Admin API client |

### Frontend — Modified Files
| File | Change |
|------|--------|
| `src/App.js` | Add `/admin/*` route (~5 lines) |
| `src/components/LobbyPage.js` or nav component | Add admin link for admin users |
| `package.json` | Add `recharts`, `@mui/x-data-grid` |

### Total: 3 backend new + 4 backend modified + 9 frontend new + 3 frontend modified = **19 files**

---

## 6. Migration Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| `user_login_history` migration on prod DB | **LOW** | Additive CREATE TABLE — no data modification, no FK to alter existing tables. Run `--pretend` first. |
| Assigning admin role to ab@ameyem.com | **LOW** | Simple INSERT into `user_roles`. Reversible with DELETE. |
| New admin routes exposed | **MEDIUM** | Protected by `auth:sanctum` + `role:platform_admin`. Only ab@ameyem.com has access. Test 403 for non-admins. |
| Heavy aggregation queries on large tables | **MEDIUM** | Use DB indexes (already exist on `created_at`, `ended_at`, `last_activity_at`). Add `DATE()` index if needed. Paginate all list endpoints. Cache overview for 60s. |
| Frontend bundle size increase | **LOW** | recharts ~125KB gzip, @mui/x-data-grid ~90KB gzip. Lazy-load admin route. |
| Login history table growth | **LOW** | ~1 row per login. At 1000 users × 2 logins/day = 2K rows/day. Trivial for MySQL. Add cleanup job later if needed. |

---

## 7. Testing Approach

### Backend Tests
| Test | Type | File |
|------|------|------|
| Admin middleware blocks non-admin users | Feature | `tests/Feature/AdminDashboardTest.php` |
| Admin middleware allows platform_admin | Feature | Same file |
| Overview endpoint returns correct structure | Feature | Same file |
| Users endpoint pagination + search | Feature | Same file |
| Games endpoint filters work correctly | Feature | Same file |
| Subscriptions endpoint aggregations correct | Feature | Same file |
| Daily analytics returns correct date range | Feature | Same file |
| Login history recorded on login | Feature | `tests/Feature/LoginHistoryTest.php` |
| Login history duration computed on logout | Feature | Same file |

**Test strategy:** Use SQLite in-memory (existing test setup). Seed test users with various roles, games, subscriptions. Assert JSON structure and HTTP status codes.

### Frontend Tests
| Test | Type |
|------|------|
| AdminGuard redirects non-admins | Unit (React Testing Library) |
| OverviewTab renders KPI cards | Unit |
| DataGrid renders user rows | Unit |
| Admin route lazy-loads correctly | Integration |

### Manual Testing Checklist
- [ ] Login as ab@ameyem.com → admin link visible in nav
- [ ] Login as regular user → admin link NOT visible, /admin returns redirect
- [ ] Dashboard overview loads with real data
- [ ] Users tab: search by name, filter by subscription, click to expand
- [ ] Games tab: filter by status, date range picker works
- [ ] Subscriptions tab: pie chart renders, revenue numbers match DB
- [ ] Daily trends chart: 30-day view, data points correct

---

## 8. Implementation Order

```
Phase 1: Backend Foundation (estimated: 1 session)
  1. Create user_login_history migration
  2. Create UserLoginHistory model
  3. Modify AuthController to record logins/logouts
  4. Assign platform_admin role to ab@ameyem.com
  5. Create admin route group in api_v1.php
  6. Create AdminDashboardController with overview() + users()

Phase 2: Backend Complete (estimated: 1 session)
  7. Add userDetail(), games(), gameDetail() methods
  8. Add subscriptions(), dailyAnalytics() methods
  9. Write backend feature tests
  10. Run php artisan test — all green

Phase 3: Frontend Foundation (estimated: 1 session)
  11. Install recharts + @mui/x-data-grid
  12. Create AdminGuard + AdminDashboard layout
  13. Create adminService.js
  14. Build OverviewTab with KPI cards + trend chart
  15. Add /admin route to App.js

Phase 4: Frontend Complete (estimated: 1 session)
  16. Build UsersTab with DataGrid + search
  17. Build UserDetailModal
  18. Build GamesTab with filters
  19. Build SubscriptionsTab with charts
  20. Add admin nav link (visible to admins only)
  21. Manual end-to-end testing

Phase 5: Deploy (via ServerMigrationAgent)
  22. Run migration --pretend on VPS
  23. Run migration on VPS
  24. Deploy backend (composer install, config:clear, etc.)
  25. Build + deploy frontend
  26. Verify admin dashboard on chess99.com
```

---

## 9. Future Enhancements (Not in Scope)

- Real-time WebSocket updates on admin dashboard
- User management actions (ban, role change, gift subscription)
- Export data as CSV
- Tournament management from admin dashboard (already exists at /api/admin/tournaments/)
- Alerts/notifications for anomalies (spike in errors, mass signups)
- Login history cleanup job (auto-delete entries older than 90 days)

---

## 10. Decision Points for Review

1. **Should admin routes be under `/api/v1/admin/*` or `/api/admin/*`?**
   - Recommendation: `/api/v1/admin/*` to keep consistent with mobile API versioning
   - Existing tournament admin routes are under `/api/admin/tournaments/*` (different prefix)
   - Could consolidate both under `/api/v1/admin/` for consistency

2. **Login history: record every API token use or just explicit login events?**
   - Recommendation: Only explicit logins (login, OAuth callback). Token refresh is not a login.
   - `last_used_at` on `personal_access_tokens` already tracks token activity

3. **Cache admin queries?**
   - Recommendation: Cache `overview()` response for 60 seconds. Other endpoints are paginated and filtered, so caching is less useful.

4. **Should we add `duration_seconds` to the `games` table?**
   - Recommendation: Compute from `ended_at - created_at` in queries for now. Add computed column later if query performance becomes an issue.
