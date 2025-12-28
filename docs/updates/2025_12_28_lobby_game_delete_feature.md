# Lobby Game Delete Feature

**Date**: December 28, 2025
**Status**: ✅ Complete - Ready for Testing

---

## Overview

Added ability to delete paused games from the lobby to prevent accumulation of idle games.

### User Request
> "In lobby we have resume game button for each non rated game. Can you keep another button next to it to remove/delete the game? Why because, games are accumulating and it is not possible to have n number of games sitting idle"

---

## Changes Made

### 1. Frontend: Active Games List Component

**File**: `chess-frontend/src/components/lobby/ActiveGamesList.jsx`

**Changes**:
- Added `onDeleteGame` prop parameter (Line 12)
- Added delete button next to resume button (Lines 67-73)

```jsx
<button
  className="unified-card-btn danger"
  onClick={() => onDeleteGame(game.id, opponent?.name)}
  title="Delete this game"
>
  🗑️ Delete
</button>
```

**Visual**: Red delete button with trash icon, uses existing `.danger` CSS class

---

### 2. Frontend: Lobby Page Handler

**File**: `chess-frontend/src/pages/LobbyPage.js`

**Changes Added** (Lines 747-774):

```javascript
// Handler for deleting game
const handleDeleteGame = async (gameId, opponentName) => {
  const confirmed = window.confirm(
    `⚠️ Delete Game?\n\n` +
    `Are you sure you want to delete this game vs ${opponentName}?\n\n` +
    `This action cannot be undone.`
  );

  if (!confirmed) {
    return;
  }

  try {
    const response = await api.delete(`/games/${gameId}/unfinished`);

    if (response.data.message) {
      // Remove from local state
      setActiveGames(activeGames.filter(g => g.id !== gameId));
      alert(`✅ ${response.data.message}`);
    }
  } catch (error) {
    console.error('Failed to delete game:', error);
    const message = error.response?.data?.message || error.response?.data?.error || 'Failed to delete game';
    alert(`❌ Error: ${message}`);
  }
};
```

**Passed to Component** (Line 870):
```javascript
<ActiveGamesList
  activeGames={activeGames}
  currentUserId={user.id}
  onResumeGame={handleResumeGame}
  onDeleteGame={handleDeleteGame}  // ✅ Added
/>
```

**Features**:
- Confirmation dialog before deletion
- Shows opponent name in confirmation
- Updates local state immediately after successful deletion
- Error handling with user feedback
- Success message display

---

### 3. Backend: Existing Endpoint Used

**No Backend Changes Required** - Used existing endpoint:

**File**: `chess-backend/app/Http/Controllers/GameController.php` (Lines 627-651)
**Route**: `DELETE /api/games/{id}/unfinished` (Registered in `routes/api.php:76`)

**Method**: `deleteUnfinished($id)`

**Functionality**:
1. ✅ Validates game exists
2. ✅ Checks user authorization (must be white or black player)
3. ✅ Only allows deletion of paused games
4. ✅ Deletes game from database
5. ✅ Returns success message

**Authorization**:
```php
// Check if user is part of this game
if ($game->white_player_id !== $user->id && $game->black_player_id !== $user->id) {
    return response()->json(['error' => 'Unauthorized'], 403);
}
```

**Validation**:
```php
// Only allow deletion of paused games
$status = $game->statusRelation;
if ($status && $status->code !== 'paused') {
    return response()->json(['error' => 'Can only delete paused games'], 400);
}
```

---

## User Flow

### Deleting a Paused Game

1. **Navigate to Lobby** → Click "Active Games" tab
2. **View Games** → See list of active/paused games
3. **Each Game Shows**:
   - Opponent name and avatar
   - Game status (active/paused)
   - Player color
   - Last move time
   - **Resume Game** button (existing)
   - **Delete** button (new, red)

4. **Click Delete Button**:
   ```
   ⚠️ Delete Game?

   Are you sure you want to delete this game vs John Doe?

   This action cannot be undone.

   [Cancel] [OK]
   ```

5. **Confirm Deletion**:
   - If **OK**: Game deleted, success message shown, game removed from list
   - If **Cancel**: No action, dialog closes

6. **Success**:
   ```
   ✅ Game deleted successfully
   ```

7. **Error Scenarios**:
   - Game not found: `❌ Error: Game not found`
   - Not authorized: `❌ Error: Unauthorized`
   - Game active: `❌ Error: Can only delete paused games`
   - Network error: `❌ Error: Failed to delete game`

---

## Security & Validation

### Backend Validation

**Authorization Check**:
- User must be either white_player or black_player
- Cannot delete other players' games

**Status Check**:
- Can only delete games with status = 'paused'
- Cannot delete active games
- Cannot delete completed games

### Frontend Safety

**Confirmation Dialog**:
- Prevents accidental deletion
- Shows opponent name for clarity
- Warns action is irreversible

**Error Handling**:
- Network errors caught and displayed
- Backend validation errors shown to user
- Failed deletions don't update UI state

---

## Edge Cases Handled

### Edge Case 1: Active Game
**Scenario**: User tries to delete an active (not paused) game
**Backend Response**: `400 Bad Request - Can only delete paused games`
**Frontend**: Shows error alert, game remains in list

### Edge Case 2: Unauthorized User
**Scenario**: User tries to delete someone else's game
**Backend Response**: `403 Forbidden - Unauthorized`
**Frontend**: Shows error alert

### Edge Case 3: Game Not Found
**Scenario**: Game was already deleted by opponent or doesn't exist
**Backend Response**: `404 Not Found - Game not found`
**Frontend**: Shows error alert

### Edge Case 4: Network Failure
**Scenario**: Request fails due to network issue
**Frontend**: Catches error, shows generic error message, game remains in list

### Edge Case 5: User Cancels Confirmation
**Scenario**: User clicks delete but cancels in confirmation dialog
**Result**: No action taken, game remains, no API call made

---

## UI Design

### Button Styling

**Delete Button**:
- **Class**: `unified-card-btn danger`
- **Color**: Red background (`#f04747`)
- **Hover**: Darker red (`#d73c3c`)
- **Icon**: 🗑️ (trash bin emoji)
- **Text**: "Delete"
- **Position**: Right side of card, next to Resume button

**Visual Hierarchy**:
- Resume button: Teal/secondary (primary action)
- Delete button: Red/danger (destructive action)

---

## Testing Guide

### Test Scenario 1: Delete Paused Game (Success)

**Steps**:
1. Start a casual game
2. Pause the game
3. Return to lobby → Active Games tab
4. Find the paused game in list
5. Click "🗑️ Delete" button
6. **Verify**: Confirmation dialog shows opponent name
7. Click "OK"
8. **Expected**:
   - Success message: "✅ Game deleted successfully"
   - Game removed from list
   - Game deleted from database

**✅ Success Criteria**:
- Confirmation dialog appears with correct opponent name
- Game disappears from lobby after deletion
- Success message shown
- No errors in console

---

### Test Scenario 2: Delete Active Game (Should Fail)

**Steps**:
1. Start a casual game (don't pause)
2. Try to delete via API directly (simulating bug or race condition)
3. **Expected**: Backend returns error
4. **Response**: `400 - Can only delete paused games`

**Note**: Frontend only shows delete button for all games, but backend enforces paused-only rule.

---

### Test Scenario 3: Cancel Deletion

**Steps**:
1. Have a paused game
2. Click "🗑️ Delete" button
3. **Verify**: Confirmation dialog shows
4. Click "Cancel"
5. **Expected**:
   - Dialog closes
   - Game remains in list
   - No API call made
   - No state changes

**✅ Success Criteria**:
- Canceling prevents deletion
- No error messages
- Game still visible

---

### Test Scenario 4: Delete As Non-Player (Should Fail)

**Steps**:
1. User A has paused game with User B
2. User C tries to delete the game (via API)
3. **Expected**: `403 Forbidden - Unauthorized`

**Note**: Frontend doesn't show other players' games, but backend validates anyway.

---

### Test Scenario 5: Network Error Handling

**Steps**:
1. Have a paused game
2. Disconnect network
3. Click "🗑️ Delete" button
4. Confirm deletion
5. **Expected**:
   - Error message: "❌ Error: Failed to delete game"
   - Game remains in list
   - Reconnect and try again → succeeds

**✅ Success Criteria**:
- Error shown to user
- State not corrupted
- Can retry after reconnection

---

### Test Scenario 6: Both Players Delete Simultaneously

**Steps**:
1. User A and User B both pause game
2. Both go to lobby
3. Both click delete at same time
4. **Expected**:
   - First request succeeds
   - Second request fails with "Game not found"
   - Both see game removed from their lists

**✅ Success Criteria**:
- No errors or crashes
- Game deleted properly
- Both users see updated state

---

## Files Modified

**Frontend** (2 files):
1. `chess-frontend/src/components/lobby/ActiveGamesList.jsx`
   - Added `onDeleteGame` prop (Line 12)
   - Added delete button UI (Lines 67-73)

2. `chess-frontend/src/pages/LobbyPage.js`
   - Added `handleDeleteGame` function (Lines 747-774)
   - Passed `onDeleteGame` to ActiveGamesList (Line 870)

**Backend** (0 files):
- No changes required - Used existing endpoint

**CSS** (0 files):
- Used existing `.unified-card-btn.danger` class

---

## API Reference

### Delete Game Endpoint

**Endpoint**: `DELETE /api/games/{id}/unfinished`

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Path Parameters**:
- `id` (integer): Game ID to delete

**Success Response** (200):
```json
{
  "message": "Game deleted successfully"
}
```

**Error Responses**:

**404 Not Found**:
```json
{
  "error": "Game not found"
}
```

**403 Forbidden**:
```json
{
  "error": "Unauthorized"
}
```

**400 Bad Request**:
```json
{
  "error": "Can only delete paused games"
}
```

---

## Performance Impact

- ✅ **Minimal**: Single DELETE request per deletion
- ✅ **Efficient**: Removes game immediately from local state
- ✅ **No Polling**: One-time action, no background updates needed
- ✅ **Optimistic UI**: Could be improved with optimistic update (future enhancement)

---

## Future Enhancements

### 1. Bulk Delete
Allow selecting multiple paused games and deleting in one action
```
[✓] Game 1 vs Alice
[✓] Game 2 vs Bob
[ ] Game 3 vs Charlie (active - disabled)

[Delete Selected Games]
```

### 2. Auto-Delete Old Paused Games
Backend job to automatically delete games paused for > 30 days
```sql
DELETE FROM games
WHERE status = 'paused'
AND paused_at < NOW() - INTERVAL 30 DAY
```

### 3. Soft Delete Instead of Hard Delete
Keep record in database but mark as deleted
```php
$game->update(['deleted_at' => now(), 'deleted_by' => $userId]);
```

### 4. Undo Delete (with soft delete)
Allow recovery within 24 hours
```
Game deleted ✓  [Undo]
```

### 5. Archive Instead of Delete
Move to archived games section instead of permanent deletion
```
Move to archive? [Archive] [Cancel]
```

---

## Backward Compatibility

- ✅ **Existing Games**: All existing paused games can be deleted
- ✅ **API Stable**: Used existing endpoint, no breaking changes
- ✅ **UI Progressive**: New button doesn't affect existing functionality
- ✅ **No Migration**: No database changes required

---

## Rollback Plan

If issues occur, revert these changes:

**Frontend**:
```bash
git checkout HEAD~1 chess-frontend/src/components/lobby/ActiveGamesList.jsx
git checkout HEAD~1 chess-frontend/src/pages/LobbyPage.js
```

**Alternative**: Hide delete button via CSS:
```css
.unified-card-btn.danger {
  display: none;
}
```

---

## Success Criteria

✅ **Functional**:
- Delete button appears next to resume button
- Confirmation dialog shows before deletion
- Game deleted from database
- Game removed from lobby list
- Success/error messages shown

✅ **Security**:
- Only players can delete their games
- Only paused games can be deleted
- Unauthorized attempts blocked

✅ **UX**:
- Clear visual distinction (red delete button)
- Confirmation prevents accidents
- Immediate feedback (success/error)
- Opponent name shown in confirmation

---

## Status: Ready for Testing

All implementation tasks complete:
- ✅ Delete button added to lobby UI
- ✅ Confirmation dialog implemented
- ✅ Backend endpoint validated
- ✅ Error handling complete
- ✅ Documentation complete

**Next Step**: Test using scenarios above.

---

**Implementation Complete**: ✅
**Ready for Testing**: ✅
**Production Ready**: ⏳ (After testing)
