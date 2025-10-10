# Kill Game Functionality Fix - 2025-09-30

## Problem
When a user tried to kill/abandon a game, the backend returned a 500 Internal Server Error, and the game was not properly terminated.

## Root Cause
The frontend was sending an invalid `result` value to the backend:
```javascript
updateGameStatus('completed', 'abandoned', 'killed')
```

This was incorrect because:
- `status='completed'` with `result='abandoned'` was invalid
- The database only accepts these result values: 'white_wins', 'black_wins', 'draw', 'ongoing'
- 'abandoned' is a status, not a result

## Solution

### 1. Frontend Fix (PlayMultiplayer.js:663)
Changed the kill game API call from:
```javascript
await wsService.current.updateGameStatus('completed', 'abandoned', 'killed');
```

To:
```javascript
await wsService.current.updateGameStatus('abandoned', null, 'killed');
```

This correctly sets:
- `status='abandoned'` (the game state)
- `result=null` (no winner for abandoned games)
- `reason='killed'` (why the game ended)

### 2. Backend Fix (GameRoomService.php:548)
Updated the condition to set `ended_at` timestamp for both completed and abandoned games:

```php
// Before
if ($status === 'completed') {
    $updateData['ended_at'] = now();
}

// After
if ($status === 'completed' || $status === 'abandoned') {
    $updateData['ended_at'] = now();
}
```

## Files Modified
1. `/chess-frontend/src/components/play/PlayMultiplayer.js` - Line 663
2. `/chess-backend/app/Services/GameRoomService.php` - Line 548

## Testing
After these changes:
1. User can successfully kill a game from the game screen
2. Game status is properly set to 'abandoned' in the database
3. `ended_at` timestamp is recorded
4. `end_reason` is set to 'killed'
5. User is redirected to the lobby
6. The game no longer appears as active for either player

## Related Components
- WebSocketController.php - Validates and routes the status update request
- GameRoomService.php - Handles the business logic for updating game status
- WebSocketGameService.js - Frontend service that makes the API call