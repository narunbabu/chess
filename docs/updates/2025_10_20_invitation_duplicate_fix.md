# Fix: Duplicate Invitation Error (400 Bad Request)

**Date**: 2025-10-20
**Issue**: Users getting "Invitation already sent" error when trying to challenge players
**Status**: ✅ Fixed

---

## Problem

Users were encountering a 400 Bad Request error when trying to send game invitations from the Lobby page:

```
Error: Invitation already sent
Status: 400 Bad Request
```

This occurred when:
1. A pending invitation already existed between the two users
2. The frontend state was stale and didn't reflect the current backend state
3. Users could click the "Challenge" button even when an invitation was pending

---

## Root Cause

1. **Missing Frontend Validation**: The frontend didn't check if a pending invitation already existed before attempting to send a new one
2. **Incorrect Status Filtering**: The PlayersList component checked for ANY invitation (including accepted/declined), not just pending ones
3. **State Synchronization**: The frontend state could become stale between polling intervals

---

## Solution

### 1. Frontend Validation (LobbyPage.js)

**Added pre-flight check in `handleInvite` function (Lines 476-489):**
```javascript
const handleInvite = (player) => {
  // Check if there's already a pending invitation to this player
  const existingInvitation = sentInvitations.find(inv =>
    inv.invited_id === player.id && inv.status === 'pending'
  );

  if (existingInvitation) {
    alert(`You already have a pending invitation to ${player.name}.
           Please wait for them to respond or cancel the existing invitation first.`);
    return;
  }

  setSelectedPlayer(player);
  setShowColorModal(true);
};
```

### 2. Enhanced Error Logging (LobbyPage.js)

**Added comprehensive logging in `sendInvitation` function (Lines 494-506, 539-544):**
```javascript
console.log('📤 Sending invitation with data:', {
  invited_user_id: selectedPlayer.id,
  preferred_color: colorChoice,
  current_user_id: user?.id
});

// After error:
console.error('❌ Failed to send invitation:', error);
console.error('Error response data:', error.response?.data);
console.error('Error status:', error.response?.status);
```

### 3. Smart Error Recovery (LobbyPage.js)

**Added automatic data refresh on duplicate errors (Lines 546-554):**
```javascript
if (errorMessage === 'Invitation already sent') {
  console.log('🔄 Duplicate invitation detected - refreshing data...');
  fetchData(true);
  alert(`You already have a pending invitation to ${player.name}.
         The page will refresh to show the current status.`);
}
```

### 4. UI State Management (PlayersList.jsx)

**Fixed invitation status check to only consider pending invitations (Lines 19-22, 42-44):**
```javascript
// Only check for PENDING invitations (not accepted/declined)
const hasPendingInvitation = sentInvitations.some(
  (inv) => inv.invited_id === player.id && inv.status === 'pending'
);

// Then show "⏳ Invited" button for pending invitations
{hasPendingInvitation ? (
  <button className="unified-card-btn neutral" disabled>
    ⏳ Invited
  </button>
) : (
  <button className="unified-card-btn primary" onClick={() => onChallenge(player)}>
    ⚡ Challenge
  </button>
)}
```

### 5. Backend Logging (InvitationController.php)

**Added comprehensive backend logging (Lines 16-49):**
```php
Log::info('📤 Invitation send request received', [
    'request_data' => $request->all(),
    'inviter_id' => Auth::id(),
    'auth_user' => Auth::user()?->email ?? 'unknown'
]);

// Validation logging
Log::info('✅ Invitation data validated', [
    'inviter_id' => $inviterId,
    'invited_id' => $invitedId,
    'preferred_color' => $validated['preferred_color'] ?? 'not specified'
]);
```

---

## Files Modified

### Frontend
1. **chess-frontend/src/pages/LobbyPage.js**
   - Lines 476-489: Added duplicate invitation check in `handleInvite()`
   - Lines 494-506: Added request logging in `sendInvitation()`
   - Lines 539-561: Enhanced error handling with auto-refresh

2. **chess-frontend/src/components/lobby/PlayersList.jsx**
   - Lines 19-22: Fixed status check to only consider pending invitations
   - Line 42: Updated variable name to `hasPendingInvitation`

### Backend
3. **chess-backend/app/Http/Controllers/InvitationController.php**
   - Lines 16-49: Added comprehensive logging for debugging

---

## Testing Instructions

### Test Case 1: Normal Invitation Flow
1. Navigate to Lobby page
2. Select a player who doesn't have a pending invitation
3. Click "⚡ Challenge" button
4. Select color preference (White/Black/Random)
5. **Expected**: Invitation sends successfully, button changes to "⏳ Invited"

### Test Case 2: Duplicate Invitation Prevention
1. Send an invitation to a player
2. Wait for the button to change to "⏳ Invited"
3. Try to click the "⏳ Invited" button again
4. **Expected**: Button is disabled, cannot send duplicate invitation

### Test Case 3: Stale State Recovery
1. Open two browser windows (different users)
2. User A sends invitation to User B
3. User B accepts the invitation in their window
4. User A tries to send another invitation (before polling updates)
5. **Expected**: Error message shown, page refreshes automatically to show current state

### Test Case 4: Cancel and Resend
1. Send an invitation to a player
2. Go to "Invitations" tab
3. Cancel the sent invitation
4. Go back to "Players" tab
5. Try to send a new invitation to the same player
6. **Expected**: New invitation sends successfully

---

## Logs to Monitor

### Frontend Console Logs
```javascript
📤 Sending invitation with data: {invited_user_id: X, preferred_color: "white", current_user_id: Y}
✅ Invitation sent successfully: {message: "...", invitation: {...}}
```

### Backend Laravel Logs
```php
📤 Invitation send request received {request_data: {...}, inviter_id: X, auth_user: "..."}
✅ Invitation data validated {inviter_id: X, invited_id: Y, preferred_color: "white"}
📨 Broadcasting InvitationSent event {invitation_id: Z, invited_user_id: Y, ...}
```

### Error Cases
```javascript
❌ Failed to send invitation: AxiosError {...}
Error response data: {error: "Invitation already sent"}
🔄 Duplicate invitation detected - refreshing data...
```

---

## Prevention Measures

1. **Frontend Validation**: Check for existing pending invitations before showing modal
2. **UI Feedback**: Disabled "⏳ Invited" button for players with pending invitations
3. **Auto-Recovery**: Automatic data refresh when duplicate errors are detected
4. **Status Filtering**: Only check `status === 'pending'` (not accepted/declined)
5. **Comprehensive Logging**: Detailed logs on both frontend and backend for debugging

---

## Impact

- ✅ **User Experience**: Users can no longer send duplicate invitations
- ✅ **Error Prevention**: Frontend validation prevents 400 errors
- ✅ **State Synchronization**: Automatic refresh on stale state detection
- ✅ **Debugging**: Comprehensive logging for future issues
- ✅ **UI Clarity**: Clear visual indication of pending invitations

---

## Future Improvements

1. **Real-time Updates**: Use WebSocket events to update invitation status instantly (instead of polling)
2. **Toast Notifications**: Replace alerts with better UI notifications
3. **Optimistic UI**: Show "sending..." state while request is in flight
4. **Invitation Expiry**: Auto-expire old pending invitations after 24 hours

---

## Related Issues

- New Game Challenge System (2025-01-20)
- WebSocket Broadcasting (InvitationSent event)
- Lobby Polling Optimization

---

## References

- Backend: `app/Http/Controllers/InvitationController.php`
- Frontend: `chess-frontend/src/pages/LobbyPage.js`
- UI Component: `chess-frontend/src/components/lobby/PlayersList.jsx`
- API Route: `POST /api/invitations/send`
- Database: `invitations` table with `status` enum
