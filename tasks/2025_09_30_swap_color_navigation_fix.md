# Swap Color Navigation Fix - 2025-09-30

## Problem
When an invited user chose "swap color" option, the inviting user did not get the chess board opened. The user remained stuck in the lobby with repeated log messages saying "Accepted invitation already processed or game finished, skipping navigation".

### Log Evidence
```
LobbyPage.js:141 Found accepted invitation, checking if already processed: {id: 1, ...}
LobbyPage.js:165 Accepted invitation already processed or game finished, skipping navigation
```

This repeated every 5 seconds (during lobby polling).

## Root Cause
The previous fix for the lobby navigation loop was tracking **invitation IDs** in `processedInvitations` array. However:

1. When a user accepts an invitation and chooses **"Accept their choice"**, a game is created immediately
2. When a user accepts an invitation and chooses **"Swap colors"**, the backend creates a **new game with a different game_id**
3. Both games are associated with the **same invitation_id**

The old logic was:
```javascript
const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');
const invitationId = acceptedData.invitation?.id;

if (acceptedData.game && !processedInvitations.includes(invitationId)) {
  // Navigate to game
}
```

**Problem:** Once invitation ID was marked as processed (from first game), any new games from the same invitation were blocked from navigation.

## Solution Applied

### Changed from Invitation-Based to Game-Based Tracking
**File:** `chess-frontend/src/pages/LobbyPage.js:143-171`

Instead of tracking processed invitation IDs, now we track processed **game IDs**:

```javascript
// OLD: Track invitation IDs
const processedInvitations = JSON.parse(sessionStorage.getItem('processedInvitations') || '[]');
const invitationId = acceptedData.invitation?.id;
if (!processedInvitations.includes(invitationId)) { ... }

// NEW: Track game IDs
const processedGames = JSON.parse(sessionStorage.getItem('processedGames') || '[]');
const gameId = acceptedData.game?.id;
if (!processedGames.includes(gameId)) { ... }
```

### Updated Both Navigation Paths

**1. Normal Auto-Navigation (lines 143-172)**
```javascript
const processedGames = JSON.parse(sessionStorage.getItem('processedGames') || '[]');
const gameId = acceptedData.game?.id;
const hasProcessedThisGame = processedGames.includes(gameId);

if (acceptedData.game && !hasProcessedThisGame && !isGameFinished) {
  // Mark this specific game as processed (not the invitation)
  processedGames.push(gameId);
  sessionStorage.setItem('processedGames', JSON.stringify(processedGames));

  console.log('Navigating to NEW game from accepted invitation:', acceptedData.game.id);
  navigate(`/play/multiplayer/${acceptedData.game.id}`);
}
```

**2. Intentional Lobby Visit (lines 126-136)**
```javascript
// Mark any accepted games as processed
if (acceptedRes.data && acceptedRes.data.length > 0) {
  const processedGames = JSON.parse(sessionStorage.getItem('processedGames') || '[]');
  acceptedRes.data.forEach(acceptedData => {
    const gameId = acceptedData.game?.id;
    if (gameId && !processedGames.includes(gameId)) {
      processedGames.push(gameId);
    }
  });
  sessionStorage.setItem('processedGames', JSON.stringify(processedGames));
}
```

## Changes Summary

### Modified Files
1. **chess-frontend/src/pages/LobbyPage.js**
   - Changed tracking from `processedInvitations` (invitation IDs) to `processedGames` (game IDs)
   - Updated auto-navigation logic to check `processedGames` instead of `processedInvitations`
   - Updated intentional lobby visit logic to mark games instead of invitations

## Testing Scenarios

### Before Fix
❌ User 1 sends invitation with preferred color: White
❌ User 2 accepts and chooses "Swap colors" (wants to play White)
❌ Backend creates new game (game_id: 2) with swapped colors
❌ User 1 stays stuck in lobby - invitation_id already in `processedInvitations`
❌ Logs show: "Accepted invitation already processed, skipping navigation"

### After Fix
✅ User 1 sends invitation with preferred color: White
✅ User 2 accepts and chooses "Swap colors" (wants to play White)
✅ Backend creates new game (game_id: 2) with swapped colors
✅ User 1 auto-navigates to the new game board
✅ Both users can play with swapped colors

## Technical Details

### Session Storage Keys Changed
- **Removed/Replaced:** `processedInvitations` - Array of invitation IDs
- **Added:** `processedGames` - Array of game IDs

### Behavior Matrix
| Scenario | Invitation ID | Game ID | Navigation Behavior |
|----------|--------------|---------|---------------------|
| Accept (same color) | 1 | 1 | ✅ Navigates (game_id 1 not in processedGames) |
| Accept (swap color) | 1 | 2 | ✅ Navigates (game_id 2 not in processedGames) |
| Return to lobby | 1 | 1 | ❌ Blocked (game_id 1 in processedGames) |
| Return to lobby | 1 | 2 | ❌ Blocked (game_id 2 in processedGames) |

### Legacy Session Storage
The old `processedInvitations` key remains in session storage but is no longer used. It will naturally clear when the browser session ends or when the 24-hour cleanup runs.

## Related Issues
- **Previous Fix:** 2025_09_30_lobby_navigation_fix.md
- **Root Issue:** Invitation reuse for multiple games with different configurations

## Todo Completed
✅ Fix invitation processing logic to handle new games from same invitation