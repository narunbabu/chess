# Online Status Detection Fix

**Date**: 2025-01-17
**Status**: ✅ Fixed
**Priority**: High

## Problem Description

Users were not showing as online (green dot) in championship match cards, despite the contextual presence system being implemented. The console logs showed:

```
❌ Arun Nalamara is offline
```

Even when the user should have been detected as online.

## Root Causes Identified

### 1. **Critical Bug in ContextualPresenceController** (Line 169-170)
The controller was retrieving the **wrong player** when building the opponent object:

```php
// BEFORE (WRONG):
$opponent = $match->player1_id == $user->id
    ? $match->player1  // ❌ Returns same user instead of opponent
    : $match->player2; // ❌ Returns same user instead of opponent

// AFTER (CORRECT):
$opponent = $match->player1_id == $user->id
    ? $match->player2  // ✅ Returns the OTHER player
    : $match->player1; // ✅ Returns the OTHER player
```

**Impact**: This caused the system to check the current user's own status instead of their opponent's status, always returning offline.

### 2. **Missing white_player and black_player Relationships**
The `ChampionshipMatch` model had `white_player_id` and `black_player_id` columns but no relationships defined. The frontend expected `match.white_player` and `match.black_player` objects.

### 3. **Match Loading Missing white_player and black_player**
The ChampionshipController methods (`matches()` and `myMatches()`) were not eager-loading the `white_player` and `black_player` relationships, causing them to be `null` in the frontend.

### 4. **Redis Not Tracking User Activity**
The `TrackUserActivity` middleware only updated the database, not Redis. This meant real-time status tracking wasn't working efficiently.

## Fixes Applied

### 1. Fixed ContextualPresenceController Opponent Detection
**File**: `chess-backend/app/Http/Controllers/ContextualPresenceController.php`

```php
// Line 169-171
$opponent = $match->player1_id == $user->id
    ? $match->player2  // Fixed: Get the OTHER player
    : $match->player1; // Fixed: Get the OTHER player
```

### 2. Added white_player and black_player Relationships
**File**: `chess-backend/app/Models/ChampionshipMatch.php`

```php
/**
 * The white player for this match
 */
public function white_player()
{
    return $this->belongsTo(User::class, 'white_player_id');
}

/**
 * The black player for this match
 */
public function black_player()
{
    return $this->belongsTo(User::class, 'black_player_id');
}
```

### 3. Updated Match Loading to Include white_player and black_player
**File**: `chess-backend/app/Http/Controllers/ChampionshipController.php`

Updated both `matches()` (line 661-668) and `myMatches()` (line 780-787) methods:

```php
->with([
    'player1:id,name,email,avatar_url,rating,last_activity_at',
    'player2:id,name,email,avatar_url,rating,last_activity_at',
    'white_player:id,name,email,avatar_url,rating,last_activity_at',  // Added
    'black_player:id,name,email,avatar_url,rating,last_activity_at',  // Added
    'winner:id,name,email,avatar_url',
    'game:id,status,result,pgn',
])
```

### 4. Enhanced TrackUserActivity Middleware with Redis
**File**: `chess-backend/app/Http/Middleware/TrackUserActivity.php`

```php
protected RedisStatusService $redisStatus;

public function __construct(RedisStatusService $redisStatus)
{
    $this->redisStatus = $redisStatus;
}

public function handle(Request $request, Closure $next): Response
{
    if (Auth::check()) {
        $user = Auth::user();

        // Update database (throttled to 1 minute intervals)
        $lastActivity = $user->last_activity_at;
        if (!$lastActivity || $lastActivity->diffInMinutes(now()) >= 1) {
            $user->update(['last_activity_at' => now()]);
        }

        // Always update Redis for real-time tracking (fast, no DB overhead)
        $this->redisStatus->markOnline($user->id);
    }

    return $next($request);
}
```

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    CONTEXTUAL PRESENCE SYSTEM                │
└─────────────────────────────────────────────────────────────┘

Frontend (React)
├── useContextualPresence hook
│   ├── loadOpponents() → API: /api/presence/opponents
│   ├── isUserOnline(userId) → Checks local state
│   └── Auto-refresh every 30 seconds
│
└── ChampionshipMatches.jsx
    ├── Uses isUserOnline() to check opponent status
    └── Displays green dot for online opponents

Backend (Laravel)
├── TrackUserActivity Middleware (Global)
│   ├── Updates last_activity_at every 1 minute (DB)
│   └── Updates Redis on every request (Real-time)
│
├── ContextualPresenceController
│   ├── getCurrentRoundOpponents()
│   │   ├── Finds active championship matches
│   │   ├── Extracts opponent IDs
│   │   ├── Batch checks Redis for online status
│   │   └── Returns opponents with is_online flag
│   │
│   ├── getFriendsStatus()
│   └── getLobbyUsers()
│
└── RedisStatusService
    ├── markOnline(userId) - TTL: 5 minutes
    ├── isOnline(userId) - O(1) lookup
    ├── batchCheck(userIds[]) - O(n) pipeline
    └── getOnlineUsers() - O(log n) sorted set
```

## Testing Verification

To verify the fix works:

1. **Check Opponent Loading**:
   ```bash
   # In browser console, check API response
   # Should see opponents with correct user_id and is_online status
   ```

2. **Check Redis Status**:
   ```bash
   redis-cli
   > EXISTS user:activity:1
   > ZRANGE users:online 0 -1 WITHSCORES
   ```

3. **Check Database**:
   ```sql
   SELECT id, name, last_activity_at
   FROM users
   WHERE last_activity_at >= NOW() - INTERVAL 5 MINUTE;
   ```

4. **Frontend Console Logs**:
   - Should see: `✅ [Opponent Name] is online` for online opponents
   - Should see: `❌ [Opponent Name] is offline` for offline opponents

## Performance Impact

- **Database**: No additional overhead (already tracking last_activity_at)
- **Redis**: Minimal overhead (~50 bytes per user, TTL auto-expiration)
- **Network**: No additional API calls (uses existing endpoints)
- **Real-time Updates**: 30-second auto-refresh interval

## Related Files

### Backend
- `chess-backend/app/Http/Controllers/ContextualPresenceController.php`
- `chess-backend/app/Http/Controllers/ChampionshipController.php`
- `chess-backend/app/Models/ChampionshipMatch.php`
- `chess-backend/app/Http/Middleware/TrackUserActivity.php`
- `chess-backend/app/Services/RedisStatusService.php`

### Frontend
- `chess-frontend/src/hooks/useContextualPresence.js`
- `chess-frontend/src/components/championship/ChampionshipMatches.jsx`
- `chess-frontend/src/services/presenceService.js`

## Future Enhancements

1. **WebSocket Real-time Updates**: Use Laravel Reverb presence channels for instant status changes
2. **Typing Indicators**: Show when opponent is actively viewing the match
3. **Last Seen Timestamp**: Display "Last seen X minutes ago" for offline users
4. **Activity Status**: Show "Playing a game", "Idle", "Away" statuses

## Rollback Plan

If issues occur, revert these commits in order:
1. Revert TrackUserActivity middleware changes
2. Revert ChampionshipController eager loading changes
3. Revert ChampionshipMatch model relationship additions
4. Revert ContextualPresenceController fix

The system will fall back to database-only tracking (5-minute window).
