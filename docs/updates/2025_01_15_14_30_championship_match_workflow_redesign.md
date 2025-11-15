# Championship Match Workflow Redesign

**Date:** 2025-01-15 14:30
**Status:** ✅ COMPLETED (Frontend), 🚧 PARTIAL (Backend - needs WebSocket integration)

## Overview

Complete redesign of the championship match workflow to align with the Challenge system. Removed direct game creation, added online status detection, improved schedule dialog, and prepared groundwork for WebSocket-based challenges.

## Changes Implemented

### 1. Button Redesign (ChampionshipMatches.jsx)

**Removed:**
- ❌ "Start Game" button (was calling non-functional `/game` endpoint)

**Updated:**
- ✅ "Schedule" button - Now shows allowed time window in dialog
- ✅ "Request Play" button - Rebranded, now works like Challenge feature
  - Only enabled when opponent is online (green dot indicator)
  - Sends WebSocket challenge to opponent
  - Disabled with tooltip when opponent is offline

### 2. Online Status Detection (Lines 331-343)

**Added `isOpponentOnline()` function:**
```javascript
const isOpponentOnline = (match) => {
  const opponent = getOpponent(match);
  if (!opponent?.last_activity_at) return false;

  const lastActivity = new Date(opponent.last_activity_at);
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  return lastActivity > fiveMinutesAgo;
};
```

**Visual Indicator:**
- Green dot (●) appears next to "Request Play" when opponent is online
- Button is dimmed (opacity: 0.5) when offline
- Tooltip shows "Opponent is offline" when disabled

### 3. Schedule Dialog Enhancement (Lines 483-607)

**Added:**
- 📅 **Allowed Scheduling Window** info box showing:
  - Start time: Now (current timestamp)
  - End time: Match deadline
  - Time remaining in human-readable format (days/hours)

**Validation:**
- Client-side validation prevents times outside allowed window
- Input `min` and `max` attributes enforce HTML5 validation
- Clear error messages when validation fails

**UI Improvements:**
- Blue info box with clear formatting
- Changed button text from "Schedule Match" to "📤 Send Proposal"
- Help text: "Your opponent can accept or propose an alternative time"

### 4. Request Play Implementation (Lines 221-278)

**Workflow:**
1. Check if opponent is online (required)
2. Send POST to `/championships/{id}/matches/{matchId}/challenge`
3. Backend creates pending challenge (like regular Challenge feature)
4. Opponent receives WebSocket notification
5. When accepted, game is linked to championship match
6. Match completion tracked when game ends

**API Call:**
```javascript
POST /championships/{championshipId}/matches/{matchId}/challenge
Body: {
  color_preference: 'random',
  time_control: championship.time_control || 'blitz'
}
```

### 5. Backend API Endpoint (ChampionshipMatchController.php:936-1014)

**New Route:**
```php
Route::post('/{match}/challenge', [ChampionshipMatchController::class, 'sendChallenge']);
```

**Method: `sendChallenge()`**
- Validates user is participant
- Checks match doesn't have existing game
- Retrieves opponent details
- Validates color preference and time control
- **TODO:** Create game and send WebSocket notification
- **TODO:** Link game to championship match

### 6. Permission Function Updates (Lines 307-343)

**Updated `canUserScheduleMatch()`:**
- Now checks `!match.game_id` to hide when game exists

**Added `canUserRequestPlay()`:**
- Checks if user is participant
- Verifies status is 'pending' or 'scheduled'
- Confirms no game exists yet
- Ensures no result has been reported

## Workflow Diagram

```
[User sees match] → [Request Play button]
                          ↓
            [Check opponent online?]
                    ↙          ↘
              [Yes]              [No]
                ↓                  ↓
      [Send Challenge]    [Button disabled]
              ↓
  [WebSocket → Opponent]
              ↓
      [Opponent accepts]
              ↓
      [Game created & linked]
              ↓
      [Players play game]
              ↓
      [Game completes]
              ↓
      [Match marked complete]
```

## What Still Needs Implementation

### Backend (High Priority)

1. **WebSocket Challenge System** (sendChallenge method)
   - Create game with championship match link
   - Send real-time notification to opponent
   - Handle accept/decline responses
   - Update match status when game starts

2. **Game-Match Linking**
   - Store championship_match_id in games table
   - Update match.game_id when game created
   - Track game progress in match

3. **Match Completion Tracking**
   - Listen for game completion events
   - Update match result when game ends
   - Update match status to 'completed'
   - Calculate round completion status

### Frontend (Medium Priority)

1. **Schedule Proposal Notifications**
   - Add notification inbox for schedule proposals
   - Allow opponent to accept/modify proposals
   - Show pending proposals in UI

2. **Challenge Accept/Decline UI**
   - Notification popup when challenge received
   - Accept/Decline buttons
   - Navigate to game when accepted

3. **Real-time Match Updates**
   - WebSocket listeners for match status changes
   - Auto-refresh when game is created
   - Show "Game in progress" indicator

## Testing Checklist

### Frontend Tests
- [x] "Start Game" button removed
- [x] "Request Play" button shows with green dot when opponent online
- [x] Button disabled when opponent offline
- [x] Schedule dialog shows allowed window
- [x] Schedule validation works correctly
- [ ] Request Play sends API call (need backend)
- [ ] Error handling works for offline opponent

### Backend Tests
- [x] Route registered at `/championships/{id}/matches/{match}/challenge`
- [x] Authorization checks participant status
- [x] Validates no existing game
- [ ] WebSocket notification sent (TODO)
- [ ] Game created and linked (TODO)
- [ ] Match updated when game completes (TODO)

## Database Requirements

**May need migrations for:**
- `games.championship_match_id` (foreign key to championship_matches)
- `championship_matches.challenge_sent_at` (timestamp)
- `championship_matches.challenge_accepted_at` (timestamp)

## Files Modified

1. **Frontend:**
   - `chess-frontend/src/components/championship/ChampionshipMatches.jsx`
     - Lines 221-278: handleSendPlayRequest implementation
     - Lines 307-343: Permission and online status functions
     - Lines 483-607: Enhanced ScheduleMatchModal
     - Lines 567-604: Redesigned match action buttons

2. **Backend:**
   - `chess-backend/routes/api.php`
     - Line 185: Added challenge route
   - `chess-backend/app/Http/Controllers/ChampionshipMatchController.php`
     - Lines 936-1014: sendChallenge method (partial implementation)

## Success Metrics

- ✅ Users can see when opponent is online
- ✅ Schedule dialog shows clear time constraints
- ✅ Request Play button properly enabled/disabled
- ⏳ Challenge notifications work (pending backend)
- ⏳ Games properly linked to matches (pending backend)
- ⏳ Match completion tracked (pending backend)

## Next Steps

1. Implement WebSocket notification system in `sendChallenge()`
2. Add game-match linking in games table
3. Create game completion listener for match updates
4. Add frontend notification system for challenges
5. Test end-to-end workflow with two users
6. Add database migration for championship_match_id in games

## Notes

- The current implementation has the frontend ready but backend needs WebSocket integration
- Schedule proposals already have backend support via ChampionshipMatchSchedulingController
- Game completion tracking may need event listeners or observers
- Consider adding a "challenge_status" column to championship_matches table
