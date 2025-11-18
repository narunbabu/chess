# Championship Play Request Fix

## Problem
When clicking "🎮 Request Play" from championship matches (http://localhost:3000/championships/2), the opponent was not receiving any WebSocket notification. This was different from the lobby challenge system which properly sends invitations via WebSocket.

## Root Cause
The championship match challenge endpoint (`/api/championships/{championship}/matches/{match}/challenge`) was not creating an invitation record or broadcasting a WebSocket event like the lobby system does.

## Solution Implemented

### Backend Changes (ChampionshipMatchController.php)

1. **Added Invitation model import**
   ```php
   use App\Models\Invitation;
   ```

2. **Updated sendChallenge method to create invitation and broadcast WebSocket event**
   ```php
   // Create invitation similar to lobby system to send WebSocket notification
   // This works like the regular Challenge feature but for championship matches
   $colorPreference = $colorPreference === 'random' ? (random_int(0, 1) ? 'white' : 'black') : $colorPreference;

   $invitation = Invitation::create([
       'inviter_id' => $user->id,
       'invited_id' => $opponentId,
       'status' => 'pending',
       'inviter_preferred_color' => $colorPreference,
       'type' => 'game_invitation',
       'championship_match_id' => $match->id
   ]);

   // Broadcast invitation sent event to recipient in real-time (same as lobby)
   $freshInvitation = $invitation->fresh(['inviter', 'invited']);
   Log::info('📨 Broadcasting Championship InvitationSent event', [
       'invitation_id' => $freshInvitation->id,
       'championship_id' => $championship->id,
       'match_id' => $match->id,
       'invited_user_id' => $opponentId,
       'channel' => "App.Models.User.{$opponentId}",
       'event' => 'invitation.sent'
   ]);
   broadcast(new \App\Events\InvitationSent($freshInvitation));
   ```

3. **Updated response to include invitation data**
   ```php
   return response()->json([
       'success' => true,
       'message' => "Challenge sent to {$opponent->name}",
       'match_id' => $match->id,
       'opponent' => [
           'id' => $opponent->id,
           'name' => $opponent->name
       ],
       'settings' => [
           'color_preference' => $colorPreference,
           'time_control' => $timeControl
       ],
       'invitation' => $freshInvitation
   ]);
   ```

## How It Works Now

1. **User clicks "🎮 Request Play"** in championship match
2. **Frontend sends POST request** to `/api/championships/{championship}/matches/{match}/challenge`
3. **Backend creates invitation record** with `championship_match_id` reference
4. **Backend broadcasts InvitationSent event** to opponent's private channel: `App.Models.User.{opponentId}`
5. **Opponent receives WebSocket notification** (same as lobby challenge)
6. **Opponent can accept invitation** from lobby or notifications

## Database Schema
The `invitations` table already has the `championship_match_id` column thanks to the migration:
- `2025_11_13_140002_enhance_invitations_for_championship_matches.php`

## Testing
To verify the fix works:

1. Open championship page with active matches: http://localhost:3000/championships/2
2. Click "🎮 Request Play" on any match where opponent is online
3. Opponent should receive WebSocket notification in their browser console:
   ```
   [Lobby] 📨 New invitation received: {invitation: {...}}
   ```
4. The invitation should appear in opponent's lobby pending invitations

## Files Changed
- `chess-backend/app/Http/Controllers/ChampionshipMatchController.php`
  - Added Invitation model import
  - Updated sendChallenge method to create invitation and broadcast event
  - Updated JSON response to include invitation data

## Notes
- The route `POST /api/championships/{championship}/matches/{match}/challenge` already existed
- The database migration for `championship_match_id` was already applied
- Uses the same `InvitationSent` event and WebSocket channel as the lobby system
- Maintains backward compatibility with existing invitation handling