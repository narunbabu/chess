# EXECUTIVE SUMMARY: Authentication & Authorization Architecture

## Current State: HIGH RISK - NOT PRODUCTION READY

### Key Findings

**✅ What Exists:**
- Laravel Sanctum token-based authentication
- User registration/login system
- Social OAuth integration (Google, GitHub)
- Basic user model with chess rating fields
- Empty middleware hooks for authorization
- Routes reference authorization but it's not implemented

**❌ Critical Missing Components:**
1. **NO ROLE TRACKING** - Users have no roles (all equal)
2. **NO CHAMPIONSHIP OWNERSHIP** - Tournaments aren't linked to creators
3. **NO PERMISSION SYSTEM** - Authorization middleware references non-existent gates/policies
4. **NO AUDIT TRAILS** - Can't track who did what
5. **NO ORGANIZATION SUPPORT** - Can't handle multi-org scenarios

### Impact on Championship System

**Tournament Creation:**
- ❌ Anyone can create tournaments (no permission check)
- ❌ Creator not recorded (can't identify ownership)
- ❌ No way to restrict who can create them
- ❌ Orphaned tournaments with no owner

**Tournament Management:**
- ❌ Unauthorized users can edit any tournament
- ❌ Broken middleware (gates don't exist)
- ❌ No ownership validation
- ❌ No role-based access control

**Match Management:**
- ❌ Anyone can report results (should be monitor only)
- ❌ Anyone can reschedule matches
- ❌ No arbiter/monitor role tracking

**Payments:**
- ❌ No permission to verify payment authority
- ❌ Anyone can process refunds
- ❌ No validation of who can collect fees

---

## What Needs to Be Built

### Database Structure (6 new tables)

```
roles                 → Define 6 roles (admin, org_admin, organizer, monitor, player, guest)
permissions          → Define ~30 permissions (create_championship, manage_tournament, report_result, etc)
role_permissions     → Map permissions to roles
user_roles           → Track which roles users have (with organization scoping)
championship_roles   → Track organizers/monitors per championship
users                → Add: created_by, organization_id, visibility fields to championships
```

### Authorization Layer

```
Gates                 → Simple checks (e.g., can create championship)
Policies             → Resource-based checks (e.g., can edit THIS tournament)
Middleware           → Role/permission enforcement on routes
Model Methods        → Ownership validation (Championship::isOwnedBy())
Helper Methods       → User::hasRole(), User::hasPermission(), etc.
```

### Controller Updates

```
ChampionshipController::store()      → Check permission + set created_by
ChampionshipController::update()     → Validate ownership before updating
ChampionshipController::destroy()    → Validate ownership + status
ChampionshipMatchController::*()     → Validate organizer/monitor role
ChampionshipPaymentController::*()   → Validate payment authority
TournamentAdminController::*()       → Enforce platform_admin role
```

---

## Security Gaps

**Currently Exposed:**
1. Any authenticated user can create unlimited tournaments
2. Any user can modify any tournament (owner or not)
3. Any user can delete tournaments
4. Any user can report match results
5. Any user can process refunds
6. Admin dashboard accessible to everyone (middleware broken)

---

## Required Roles & Permissions

```
ROLES:
├─ Platform Admin       → Full system access + user management
├─ Organization Admin   → Manage organization + tournaments
├─ Tournament Organizer → Create/manage their own tournaments
├─ Monitor/Arbiter      → Report results in assigned tournaments
├─ Player               → Register + play in tournaments
└─ Guest                → Read-only access to public tournaments

PERMISSIONS (by role):
├─ create_championship       (platform_admin, org_admin, organizer)
├─ manage_championship       (platform_admin, org_admin, organizer)
├─ edit_championship        (platform_admin, org_admin, creator)
├─ delete_championship      (platform_admin, org_admin, creator)
├─ generate_next_round      (platform_admin, org_admin, organizer)
├─ report_match_result      (platform_admin, org_admin, organizer, monitor)
├─ reschedule_match         (platform_admin, org_admin, organizer, monitor)
├─ process_refund           (platform_admin, org_admin, organizer)
├─ view_all_tournaments     (platform_admin, org_admin)
└─ access_admin_dashboard   (platform_admin only)
```

---

## Championship Ownership Model

```
BEFORE (Broken):
┌─ Championship created
└─ No creator recorded
   ├─ Can't validate ownership
   ├─ Can't prevent unauthorized edits
   └─ Can't enforce deletion rules

AFTER (Proposed):
┌─ User (organizer role) creates Championship
├─ Championship.created_by = user.id
├─ ChampionshipRole(championship, user, 'organizer') created
└─ Authorization checks:
   ├─ Only creator/admin can edit
   ├─ Only creator can delete (before registration)
   ├─ Only organizer/monitor can report results
   └─ Only creator/admin can manage participants
```

---

## Database Schema Changes

```sql
-- Add to users table
ALTER TABLE users ADD COLUMN (
    created_by BIGINT,         -- For org admin tracking
    organization_id BIGINT,    -- Organization membership
    is_active BOOLEAN DEFAULT 1,
    is_banned BOOLEAN DEFAULT 0,
    FOREIGN KEY (organization_id) REFERENCES organizations(id)
);

-- Add to championships table
ALTER TABLE championships ADD COLUMN (
    created_by BIGINT NOT NULL,           -- CRITICAL
    organization_id BIGINT,
    visibility ENUM('public', 'private', 'invite_only') DEFAULT 'public',
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- New tables
CREATE TABLE roles (...)
CREATE TABLE permissions (...)
CREATE TABLE role_permissions (...)
CREATE TABLE user_roles (...)
CREATE TABLE championship_roles (...)
CREATE TABLE organizations (...)  -- If adding multi-org support
```

---

## Implementation Priority

**PHASE 1 (Must Have - Blocks everything else):**
- Add roles/permissions tables
- Add user_roles pivot table
- Add created_by to championships
- Implement User::hasRole() method
- Add Championship::isOwnedBy() method
- Fix middleware references (create-tournaments gate)

**PHASE 2 (Critical - Needed for production):**
- Implement ChampionshipPolicy
- Add authorization checks to all controller methods
- Add championship_roles table for monitor/organizer tracking
- Store created_by when creating tournament
- Validate ownership on update/delete

**PHASE 3 (Important - Completes system):**
- Implement custom middleware
- Add audit logging
- Add organization scoping
- Implement permission checks in API responses

**PHASE 4 (Nice to have - Polish):**
- Role assignment UI
- Permission management dashboard
- Audit trail visualization
- Organization management

---

## Quick Reference: File Changes Needed

```
BACKEND CHANGES:
├─ Database:
│  ├─ Create migration: add_roles_and_permissions_tables.php
│  ├─ Create migration: add_created_by_to_championships.php
│  └─ Create migration: create_championship_roles_table.php
│
├─ Models:
│  ├─ User.php                      (Add role relationships & methods)
│  ├─ Championship.php              (Add creator, role relationships)
│  ├─ ChampionshipRole.php          (NEW)
│  ├─ Role.php                      (NEW)
│  └─ Permission.php                (NEW)
│
├─ Controllers:
│  ├─ ChampionshipController.php    (Add authorization checks)
│  ├─ ChampionshipMatchController.php (Add organizer/monitor checks)
│  ├─ ChampionshipPaymentController.php (Add payment auth)
│  └─ TournamentAdminController.php (Add platform_admin checks)
│
├─ Authorization:
│  ├─ app/Providers/AuthServiceProvider.php (Define gates)
│  ├─ app/Policies/ChampionshipPolicy.php (NEW)
│  └─ app/Middleware/CheckChampionshipAccess.php (NEW)
│
└─ Routes:
   └─ routes/api.php               (Fix middleware references)
```

---

## Estimated Effort

```
Database & Models       → 3-4 hours
Gates & Policies        → 2-3 hours  
Controller Updates      → 4-5 hours
Middleware & Routes     → 1-2 hours
Testing                 → 3-4 hours
─────────────────────────────────
Total                   → 13-18 hours
```

---

## Before You Deploy

❌ **DO NOT deploy championship features until:**
- [ ] Roles table populated with 6 role types
- [ ] User role assignment working
- [ ] Championships track created_by
- [ ] Authorization checks in all controller methods
- [ ] Middleware authorization gates defined
- [ ] Championship ownership validation working
- [ ] Integration tests passing
- [ ] No security audit issues

---

## Next Steps

1. **Review this analysis** with team
2. **Get approval** for implementation roadmap
3. **Schedule Phase 1 work** (roles + permissions setup)
4. **Create migration** for new tables
5. **Update models** with relationships
6. **Implement authorization** in controllers
7. **Test thoroughly** before enabling features

