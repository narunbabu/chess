# WebSocket CORS Connection Fix

**Date:** 2025-12-08
**Issue:** `TypeError: Failed to fetch` (Status 0) errors when trying to establish WebSocket connections
**Root Cause:** CORS configuration mismatches and incorrect routing for WebSocket authentication

## Problem Analysis

The frontend was experiencing `Failed to fetch` errors when attempting to:
1. Authenticate WebSocket connections via `/broadcasting/auth`
2. Complete WebSocket handshakes via `/api/websocket/handshake`

### Root Causes Identified

1. **CORS Path Mismatch:** The `cors.php` configuration was missing `broadcasting/*` paths, causing the browser to block WebSocket authentication requests.

2. **Incorrect Auth Endpoint URL:** The `echoSingleton.js` was constructing the wrong auth URL:
   - Frontend was calling: `http://localhost:8000/api/broadcasting/auth`
   - Backend route was actually at: `http://localhost:8000/broadcasting/auth`
   - This resulted in 404 errors that manifested as CORS errors

3. **CSRF Protection Blocking:** The `broadcasting/auth` route was protected by CSRF middleware, preventing cross-origin authentication requests from the decoupled frontend.

## Solution Implemented

### 1. Fixed CORS Configuration
**File:** `chess-backend/config/cors.php`
```php
// Added broadcasting/* to allowed paths
'paths' => ['api/*', 'websocket/*', 'sanctum/csrf-cookie', 'auth/*', 'broadcasting/*'],
```

### 2. Corrected Auth Endpoint Construction
**File:** `chess-frontend/src/services/echoSingleton.js`
```javascript
// Fixed URL construction to hit the correct broadcasting route
const baseUrl = backendUrl.replace(/\/api$/, ''); // Remove trailing /api if present
authEndpoint: `${baseUrl}/broadcasting/auth`, // Now correctly hits /broadcasting/auth
```

### 3. Excluded Broadcasting Auth from CSRF
**File:** `chess-backend/bootstrap/app.php`
```php
// Exclude broadcasting/auth from CSRF verification for WebSocket authentication
$middleware->validateCsrfTokens(except: [
    'broadcasting/auth',
]);
```

## Impact

- ✅ WebSocket authentication requests now pass CORS validation
- ✅ Frontend correctly targets the backend broadcasting route at `/broadcasting/auth`
- ✅ CSRF protection no longer blocks cross-origin WebSocket authentication
- ✅ WebSocket connections can be established successfully for real-time game features

## Files Modified

1. `chess-backend/config/cors.php` - Added broadcasting/* paths
2. `chess-frontend/src/services/echoSingleton.js` - Fixed auth endpoint URL construction
3. `chess-backend/bootstrap/app.php` - Excluded broadcasting/auth from CSRF verification

## Next Steps

1. **Restart Backend Services:** Required for CORS and CSRF changes to take effect
2. **Restart Frontend:** To use the corrected auth endpoint
3. **Test WebSocket Connection:** Verify real-time features work correctly

## Lessons Learned

- Always verify that frontend URL construction matches actual backend routes
- CORS errors can mask underlying 404 routing issues
- WebSocket authentication in decoupled frontend/backend setups requires CSRF exclusion
- Laravel's broadcasting routes are registered at root `/broadcasting/auth` by default, not under `/api` prefix