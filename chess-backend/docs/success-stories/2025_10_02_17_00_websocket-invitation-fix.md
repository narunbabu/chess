# WebSocket Real-Time Invitation Broadcasting Fix

**Date:** 2025-10-02 17:00
**Status:** ✅ Resolved
**Impact:** High - Core multiplayer functionality restored

---

## Problem

Real-time game invitations were not being relayed between players via WebSocket. While game moves were broadcasting successfully, invitation events (sent, accepted, cancelled) were not reaching the recipient in real-time, forcing users to rely on slow HTTP polling fallback.

**Symptoms:**
- Players saw "Mock channel" logs instead of real WebSocket connections for invitations
- Invitation events weren't appearing in Reverb server logs for user channels
- Frontend showed `isConnected: false, socketId: null` despite Reverb running
- One player could see the game board opening on acceptance, but the inviter couldn't
- CORS errors blocked localhost development
- 500 errors from `getRoomState` endpoint due to type mismatch

---

## Root Causes

### 1. **CORS Configuration (Backend)**
- `config/cors.php` only allowed production domain `https://chess99.com`
- Local development from `http://localhost:3000` was blocked
- Preflight OPTIONS requests were failing

### 2. **Type Mismatch in WebSocketController (Backend)**
- `getRoomState()` declared return type as `JsonResponse`
- Method returned plain `Response` for 304 Not Modified status
- PHP 8+ strict typing threw fatal error: `Return value must be of type JsonResponse`

### 3. **Missing Authorization Guards (Backend)**
- `getRoomState()` didn't verify user authentication
- No check if user was participant in the requested game
- Potential security vulnerability for game state access

### 4. **Reverb Configuration (Backend)**
- `REVERB_HOST="localhost"` had unnecessary quotes in `.env`
- Backend tried connecting to Reverb via `https://0.0.0.0:8080` instead of `http://localhost:8080`
- SSL connection timeout errors on invitation broadcasts

### 5. **Echo Singleton Initialization Timing (Frontend)**
- Lobby page initialized WebSocketGameService before Echo singleton was ready
- `subscribeToUserChannel()` returned mock channels instead of real WebSocket connections
- No validation that Echo was available before setting up listeners

### 6. **Missing Cleanup on Logout (Frontend)**
- Echo connections persisted across logout/login cycles
- Stale connections prevented new subscriptions
- Users had to clear localStorage manually

---

## Resolution

### Backend Fixes

#### 1. CORS Configuration (`config/cors.php`)
```php
'allowed_origins' => array_filter([
    'https://chess99.com',
    env('FRONTEND_URL'),
    env('APP_ENV') === 'local' ? 'http://localhost:3000' : null,
    env('APP_ENV') === 'local' ? 'http://localhost:8000' : null,
]),
```

#### 2. WebSocketController Return Type (`app/Http/Controllers/WebSocketController.php`)
```php
use Symfony\Component\HttpFoundation\Response;

public function getRoomState(Request $request): Response
{
    // Guard: Check if user is authenticated
    $user = Auth::user();
    if (!$user) {
        return response()->json(['message' => 'Unauthenticated'], 401);
    }

    // Validate inputs up front
    $request->validate([
        'game_id' => 'required|integer|exists:games,id',
        'compact' => 'nullable|boolean',
        'since_move' => 'nullable|integer|min:0'
    ]);

    // Check if user is involved in this game
    if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
        return response()->json(['message' => 'Forbidden'], 403);
    }

    // Return 304 or JSON response - both are valid Response types
    if ($noChange) {
        return response('', 304)->header('ETag', $etag);
    }
    return response()->json($data)->header('ETag', $etag);
}
```

#### 3. Reverb Configuration (`.env`)
```bash
# Removed quotes from REVERB_HOST
REVERB_HOST=localhost
REVERB_PORT=8080
REVERB_SCHEME=http
```

### Frontend Fixes

#### 1. Echo Cleanup on Logout (`src/contexts/AuthContext.js`)
```javascript
import { initEcho, disconnectEcho } from '../services/echoSingleton';

const logout = async () => {
    // Disconnect Echo WebSocket before logout
    disconnectEcho();
    console.log('[Auth] Echo disconnected on logout');

    localStorage.removeItem("auth_token");
    delete api.defaults.headers.common['Authorization'];
    setIsAuthenticated(false);
    setUser(null);
};
```

#### 2. Proper Echo Initialization Validation (`src/pages/LobbyPage.js`)
```javascript
useEffect(() => {
    if (user && !webSocketService) {
        // Get the Echo singleton that was initialized in AuthContext
        const echo = getEcho();

        if (!echo) {
            console.error('[Lobby] Echo singleton not initialized!');
            return;
        }

        console.log('[Lobby] Echo singleton available, initializing WebSocket service');
        const service = new WebSocketGameService();

        service.initialize(null, user).then(() => {
            console.log('[Lobby] WebSocket service initialized successfully');
            setWebSocketService(service);
        }).catch(err => {
            console.error('[Lobby] WebSocket initialization failed:', err);
            setWebSocketService(service); // Allow polling fallback
        });
    }
}, [user, webSocketService]);
```

#### 3. Enhanced Logging for Debugging
```javascript
const echoInstance = initEcho({ token, wsConfig });
if (echoInstance) {
    console.log('[Auth] ✅ Echo singleton initialized successfully');
} else {
    console.error('[Auth] ❌ Echo singleton initialization failed!');
}
```

---

## Verification Steps

### Backend Verification
```bash
# Clear config cache
php artisan config:clear
php artisan cache:clear

# Verify broadcasting config
php artisan config:show broadcasting.connections.reverb

# Start servers
php artisan serve --host=0.0.0.0 --port=8000
php artisan reverb:start --debug
```

### Frontend Verification
```bash
# Clear build cache
npm start
```

### Expected Console Output
```
[Auth] Initializing Echo with config: {key: "anrdh24nppf3obfupvqw", ...}
[Auth] ✅ Echo singleton initialized successfully
[Echo] Successfully connected. Socket ID: XXXXX.XXXXX
[Lobby] Echo singleton available, initializing WebSocket service
[Lobby] WebSocket service initialized successfully
```

### Expected Reverb Logs
```
Connection Established ... XXXXX.XXXXX
Message Received ... "event": "pusher:subscribe", "channel": "private-App.Models.User.2"
Broadcasting To ... private-App.Models.User.3
  "event": "invitation.sent"
Broadcasting To ... private-App.Models.User.2
  "event": "invitation.accepted"
```

---

## Impact

### Before Fix
- ❌ Real-time invitations non-functional
- ❌ Users relied on 5-10 second HTTP polling
- ❌ Poor user experience with delayed notifications
- ❌ CORS errors blocked local development
- ❌ Security vulnerability in game state access

### After Fix
- ✅ Instant invitation notifications via WebSocket
- ✅ Sub-second latency for invitation events
- ✅ Seamless multiplayer game creation flow
- ✅ Local development fully functional
- ✅ Proper authentication and authorization

---

## Lessons Learned

1. **Strict Type Checking:** PHP 8+ requires exact return type matches. Use base `Response` type when returning mixed response types (304, JSON, etc.)

2. **Environment-Specific CORS:** Always configure CORS for both production and development environments using env-based conditionals

3. **Singleton Initialization Order:** Frontend services depending on singletons must verify availability before use, not assume initialization

4. **Cleanup on Logout:** WebSocket connections must be explicitly closed to prevent stale connections across sessions

5. **Configuration Syntax:** Avoid unnecessary quotes in `.env` files - they can cause parsing issues

6. **Comprehensive Logging:** Add debug logs at initialization boundaries to quickly diagnose timing issues

7. **Security by Default:** Always add authentication/authorization guards to API endpoints, even internal ones

---

## Related Files

**Backend:**
- `app/Http/Controllers/WebSocketController.php`
- `config/cors.php`
- `.env` (REVERB_HOST configuration)

**Frontend:**
- `src/contexts/AuthContext.js`
- `src/pages/LobbyPage.js`
- `src/services/echoSingleton.js`
- `src/services/WebSocketGameService.js`

---

## Testing Checklist

- [x] Send invitation - recipient sees notification instantly
- [x] Accept invitation - inviter navigates to game immediately
- [x] Cancel invitation - notification removed from recipient's list
- [x] Logout/login cycle - Echo reconnects properly
- [x] Multiple concurrent connections - all users receive events
- [x] CORS works for localhost:3000
- [x] Unauthorized users cannot access game states
- [x] Reverb server logs show proper channel subscriptions

---

**Fixed by:** Claude Code
**Reviewed by:** User Testing
**Deployment:** Local Development Environment
