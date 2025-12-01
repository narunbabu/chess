# 🎮 Play Now vs Request Play - Visual Guide

## Match States and Button Visibility

```
┌─────────────────────────────────────────────────────────────────────┐
│                        MATCH STATE DIAGRAM                           │
└─────────────────────────────────────────────────────────────────────┘

State 1: Fresh Match (No Game)
┌────────────────────────────────────┐
│ Match                               │
│ ├─ status: 'pending'               │
│ ├─ game_id: NULL                   │
│ └─ result: NULL                    │
└────────────────────────────────────┘
         │
         │ User sees: 🎮 Request Play
         │ (Online indicator required)
         ↓
    [User clicks]
         │
         ↓
   Creates Game + Sends Challenge
         │
         ↓
State 2: Game Created (Not Started)
┌────────────────────────────────────┐
│ Match                               │
│ ├─ status: 'pending'               │
│ ├─ game_id: 123                    │  ← Game exists!
│ ├─ game.paused_at: NULL            │
│ └─ result: NULL                    │
└────────────────────────────────────┘
         │
         │ User sees: 🎮 Play Now
         │ (Pulsing animation)
         ↓
    [User clicks]
         │
         ↓
   Sends Resume Request to Opponent
         │
         ↓
   Opponent Accepts
         │
         ↓
State 3: Game Active
┌────────────────────────────────────┐
│ Match                               │
│ ├─ status: 'active'                │
│ ├─ game_id: 123                    │
│ ├─ game.paused_at: NULL            │
│ └─ result: NULL                    │
└────────────────────────────────────┘
         │
         │ User sees: (No button)
         │ Game is in progress
         │
         │ [User exits game]
         ↓
State 4: Game Paused
┌────────────────────────────────────┐
│ Match                               │
│ ├─ status: 'pending'               │
│ ├─ game_id: 123                    │
│ ├─ game.paused_at: '2025-11-21'   │  ← Paused!
│ └─ result: NULL                    │
└────────────────────────────────────┘
         │
         │ User sees: ⏸️ Resume Game
         │
         ↓
    [User clicks]
         │
         ↓
   Sends Resume Request to Opponent
         │
         ↓
State 5: Game Completed
┌────────────────────────────────────┐
│ Match                               │
│ ├─ status: 'completed'             │
│ ├─ game_id: 123                    │
│ └─ result: 'white_win'             │
└────────────────────────────────────┘
         │
         │ User sees: Review Game
         │
```

## Button Comparison

### 🎮 Request Play (Fresh Match)

**Visibility Conditions**:
```javascript
userOnly &&
canUserRequestPlay(match) &&  // See function below
isOpponentOnline(match)
```

**canUserRequestPlay() logic**:
```javascript
isUserParticipantInMatch(match) &&     // You're white or black player
(match.status === 'scheduled' ||       // Match scheduled or pending
 match.status === 'pending') &&
!match.game_id &&                       // No game exists yet
!match.result                           // No result yet
```

**What it does**:
1. Checks if opponent is online (required!)
2. Validates round progression (can you play this round?)
3. Creates a new game via `/championships/{id}/matches/{matchId}/challenge`
4. Sends WebSocket notification to opponent
5. Waits for opponent to accept challenge

**Card Display**:
```
┌────────────────────────────────────────┐
│ Arun Babu (You)                        │
│ Rating: 1172                           │
│                                        │
│ VS                                     │
│                                        │
│ Arun Nalamara                          │
│ Rating: 1154                           │
│                                        │
│ Status: pending                        │
│ Round 2                                │
│                                        │
│ Complete by: Nov 21, 19:30            │
│ ⏰ 2 hours remaining                  │
│                                        │
│ [🎮 Request Play]  ← Online required  │
└────────────────────────────────────────┘
```

---

### 🎮 Play Now (Game Created, Not Started)

**Visibility Conditions**:
```javascript
userOnly &&
isUserParticipantInMatch(match) &&     // You're white or black player
match.game_id &&                        // Game exists!
match.status === 'pending' &&           // Still pending (not active)
!match.game?.paused_at &&               // Not paused
!pendingRequests[match.id]              // No pending request already
```

**What it does**:
1. Sends resume request to `/championships/{id}/matches/{matchId}/notify-start`
2. Creates `ChampionshipGameResumeRequest` (expires in 5 minutes)
3. Broadcasts WebSocket event to opponent
4. Shows "Request sent" notification
5. Waits for opponent to accept

**Card Display**:
```
┌────────────────────────────────────────┐
│ Arun Nalamara (You)                    │
│ Rating: 1348                           │
│                                        │
│ VS                                     │
│                                        │
│ Arun Nalamara                          │
│ Rating: 1154                           │
│                                        │
│ Status: pending                        │
│ Round 1                                │
│                                        │
│ Complete by: Nov 24, 00:46            │
│ ⏰ 2 days remaining                   │
│                                        │
│ [🎮 Play Now]  ← Pulsing animation!   │
└────────────────────────────────────────┘
```

---

### ⏸️ Resume Game (Paused Game)

**Visibility Conditions**:
```javascript
userOnly &&
isUserParticipantInMatch(match) &&     // You're white or black player
match.game_id &&                        // Game exists!
match.game?.paused_at                   // Game is paused!
```

**What it does**:
- Same as "Play Now" (calls same `handlePlayNow()` function)
- Just different styling and icon

**Card Display**:
```
┌────────────────────────────────────────┐
│ Arun Nalamara (You)                    │
│ Rating: 1348                           │
│                                        │
│ VS                                     │
│                                        │
│ Arun Nalamara                          │
│ Rating: 1154                           │
│                                        │
│ Status: pending                        │
│ Round 1                                │
│                                        │
│ Game paused at: Nov 21, 15:30         │
│                                        │
│ [⏸️ Resume Game]                       │
└────────────────────────────────────────┘
```

## Flow Comparison

### Request Play Flow (Fresh Match)
```
User A (Your Card)                    User B (Opponent)
─────────────────                     ─────────────────
See "🎮 Request Play"
(Opponent online: ●)
         │
         ↓
[Click Request Play]
         │
         ↓
POST /championships/{id}/
     matches/{matchId}/challenge
         │
         ↓
Backend:
- Creates Game (game_id)
- Links game to match
- Broadcasts challenge event
         │
         ├───────────────────────────→ WebSocket Event
         │                             "Challenge from User A"
         │                                     │
         │                                     ↓
         │                             See Dialog:
         │                             "User A challenges you!"
         │                             [Accept] [Decline]
         │                                     │
         │                                     ↓
         │                             [Click Accept]
         │                                     │
         ←───────────────────────────┘ POST /accept-challenge
         │
         ↓
Both navigate to:
/play/{game_id}
```

### Play Now Flow (Game Already Created)
```
User A (Your Card)                    User B (Opponent)
─────────────────                     ─────────────────
See "🎮 Play Now"
(Pulsing animation)
         │
         ↓
[Click Play Now]
         │
         ↓
POST /championships/{id}/
     matches/{matchId}/notify-start
         │
         ↓
Backend:
- Creates ResumeRequest
- Sets expires_at (+5 min)
- Broadcasts resume event
         │
         ├───────────────────────────→ WebSocket Event
         │                             "Resume request from User A"
         │                                     │
         │                                     ↓
         │                             See Dialog:
         │                             "User A wants to start!"
         │                             [Accept & Play] [Decline]
         │                                     │
         │                                     ↓
         │                             [Click Accept & Play]
         │                                     │
         ←───────────────────────────┘ POST /resume-request/accept
         │
         ↓
Both navigate to:
/play/{game_id}
```

## Key Differences

| Aspect | Request Play | Play Now |
|--------|-------------|----------|
| **Game State** | No game exists | Game already created |
| **match.game_id** | NULL | Has value (e.g., 123) |
| **Online Check** | Required ✅ | Not required* |
| **Backend Endpoint** | `/challenge` | `/notify-start` |
| **What it Creates** | Game + Request | Resume Request only |
| **Button Style** | Standard green | Pulsing animation |
| **Icon** | 🎮 | 🎮 (same) |
| **Request Type** | Challenge | Resume Request |
| **Database Record** | Game + Match link | ChampionshipGameResumeRequest |
| **Expiration** | N/A | 5 minutes |

*Note: While not technically required, checking online status for "Play Now" would improve UX.

## Why Two Different Buttons?

### Use Case 1: First Time Playing
- Match created, no game yet
- Need to create game + notify opponent
- Use "Request Play" button

### Use Case 2: Game Interrupted
- Game was created but players didn't start
- Or game was paused and exited
- Game already exists in database
- Just need to notify opponent to resume
- Use "Play Now" button

## Database State Comparison

### Fresh Match
```sql
-- championship_matches table
id: 1
championship_id: 5
player1_id: 1
player2_id: 3
white_player_id: 1
black_player_id: 3
status: 'pending'
game_id: NULL           ← No game yet!
result: NULL
round_number: 2

-- games table
(No record yet)
```

### After "Request Play" → Game Created
```sql
-- championship_matches table
id: 1
championship_id: 5
player1_id: 1
player2_id: 3
white_player_id: 1
black_player_id: 3
status: 'pending'
game_id: 123            ← Game created!
result: NULL
round_number: 2

-- games table
id: 123
white_player_id: 1
black_player_id: 3
status: 'pending'
fen_string: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
current_turn: 'white'
paused_at: NULL
```

### After "Play Now" Click
```sql
-- Same as above, plus:

-- championship_game_resume_requests table
id: 1
championship_match_id: 1
game_id: 123
requester_id: 3         ← User who clicked "Play Now"
recipient_id: 1         ← Opponent
status: 'pending'
expires_at: '2025-11-21 16:35:00'  ← 5 minutes from now
created_at: '2025-11-21 16:30:00'
```

## Troubleshooting Quick Reference

| Symptom | Check This | Expected Value |
|---------|-----------|----------------|
| "Request Play" not showing | match.game_id | NULL |
| "Play Now" not showing | match.game_id | NOT NULL |
| "Play Now" not showing | match.status | 'pending' |
| "Play Now" not showing | match.game?.paused_at | NULL |
| Button click does nothing | Browser console | Check for errors |
| Opponent not notified | Reverb terminal | Should show broadcast |
| Can't click "Request Play" | Opponent online status | Must be online (green dot) |

## Console Log Patterns

### Successful "Play Now" Click
```
🎯 [Play Now Button] Clicked for match: 1
🎯 [Play Now] Button clicked: { matchId: 1, gameId: 123 }
📋 [Play Now] Match found: { id: 1, status: "pending", ... }
👥 [Play Now] Opponent found: { id: 1, name: "Arun Babu" }
🔍 [Play Now] Pending requests check: { matchId: 1, hasPendingRequest: false }
📤 [Play Now] Sending request to backend: { url: "http://localhost:8000/api/..." }
✅ [Play Now] Request sent successfully: { success: true, ... }
📝 [Play Now] Updated pending requests: { matchId: 1, type: "outgoing" }
```

### Failed "Play Now" Click (Already Pending)
```
🎯 [Play Now Button] Clicked for match: 1
🎯 [Play Now] Button clicked: { matchId: 1, gameId: 123 }
📋 [Play Now] Match found: { id: 1, status: "pending", ... }
👥 [Play Now] Opponent found: { id: 1, name: "Arun Babu" }
🔍 [Play Now] Pending requests check: { matchId: 1, hasPendingRequest: true }
⏳ [Play Now] Request already sent (outgoing)
```

### Opponent Receives Request
```
🎮 [Resume] Request received: {
  request_id: 1,
  match_id: 1,
  game_id: 123,
  requester: { id: 3, name: "Arun Nalamara", email: "..." },
  expires_at: "2025-11-21T16:35:00.000000Z"
}
```
