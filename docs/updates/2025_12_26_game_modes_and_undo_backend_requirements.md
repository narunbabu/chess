# Backend Requirements for Game Modes and Undo Functionality

**Date**: December 26, 2025
**Status**: Implementation Required
**Related Frontend**: PlayMultiplayer.js, PlayComputer.js

## Overview

This document outlines the backend implementation requirements to support Casual and Rated game modes with undo functionality in multiplayer chess games.

## Game Modes

### 1. Casual Mode
- **game_mode**: `'casual'`
- **Features**:
  - Allows pausing/resuming
  - Allows undo moves (3 chances per player)
  - Auto-save on pause/navigation
  - No rating impact
  - Forfeit on browser close is optional

### 2. Rated Mode
- **game_mode**: `'rated'`
- **Features**:
  - No pausing allowed
  - No undo moves allowed
  - Browser close/refresh = automatic forfeit
  - Affects player rating (ELO)
  - Requires pre-game confirmation dialog

## Database Schema Requirements

### Games Table
Ensure the following fields exist:

```sql
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'casual';
ALTER TABLE games ADD COLUMN IF NOT EXISTS undo_white_remaining INTEGER DEFAULT 3;
ALTER TABLE games ADD COLUMN IF NOT EXISTS undo_black_remaining INTEGER DEFAULT 3;
```

**Fields**:
- `game_mode`: 'casual' | 'rated' (default: 'casual')
- `undo_white_remaining`: INT (default: 3 for casual, 0 for rated)
- `undo_black_remaining`: INT (default: 3 for casual, 0 for rated)

### Game Moves Table
No changes required - existing structure supports undo rollback.

## API Endpoints

### 1. Undo Request Endpoint

**POST** `/websocket/games/{gameId}/undo/request`

**Purpose**: Request to undo the last move (casual mode only)

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "socket_id": "string (optional)"
}
```

**Validation**:
1. Verify game exists and user is a player
2. Verify game_mode is 'casual' (reject if rated)
3. Verify requesting player has undo chances remaining (>0)
4. Verify game status is 'active'
5. Verify at least 2 moves have been made (1 complete turn)
6. Verify it's the requesting player's turn
7. Verify no pending undo request exists

**Success Response** (200):
```json
{
  "success": true,
  "message": "Undo request sent",
  "undo_chances_remaining": 2
}
```

**Error Responses**:
- **400**: Game not in casual mode
- **400**: No undo chances remaining
- **400**: Not your turn
- **400**: Not enough moves to undo
- **403**: Unauthorized

**WebSocket Event** (sent to opponent):
```javascript
// Channel: game.{gameId}
// Event: .undo.request
{
  "from_user": {
    "id": 123,
    "name": "Player Name"
  },
  "from_player": "white" | "black",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

### 2. Accept Undo Endpoint

**POST** `/websocket/games/{gameId}/undo/accept`

**Purpose**: Accept opponent's undo request

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "socket_id": "string (optional)"
}
```

**Validation**:
1. Verify game exists and user is a player
2. Verify pending undo request exists from opponent
3. Verify game status is 'active'

**Business Logic**:
1. Remove last 2 moves from game_moves table
2. Update game FEN to state before those moves
3. Update turn to the player who requested undo
4. Decrement undo_remaining for requesting player
5. Clear pending undo request flag

**Success Response** (200):
```json
{
  "success": true,
  "message": "Undo accepted",
  "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  "history": [
    {
      "move": "e4",
      "from": "e2",
      "to": "e4",
      "fen": "...",
      "user_id": 123
    }
  ],
  "turn": "w",
  "undo_chances_remaining": 2
}
```

**Error Responses**:
- **400**: No pending undo request
- **403**: Unauthorized

**WebSocket Events** (sent to both players):
```javascript
// Channel: game.{gameId}
// Event: .undo.accepted
{
  "fen": "...",
  "history": [...],
  "turn": "w" | "b",
  "undo_chances_remaining": 2,
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

### 3. Decline Undo Endpoint

**POST** `/websocket/games/{gameId}/undo/decline`

**Purpose**: Decline opponent's undo request

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body**:
```json
{
  "socket_id": "string (optional)"
}
```

**Validation**:
1. Verify game exists and user is a player
2. Verify pending undo request exists from opponent
3. Verify game status is 'active'

**Business Logic**:
1. Clear pending undo request flag
2. No game state changes

**Success Response** (200):
```json
{
  "success": true,
  "message": "Undo request declined"
}
```

**Error Responses**:
- **400**: No pending undo request
- **403**: Unauthorized

**WebSocket Events** (sent to requester):
```javascript
// Channel: game.{gameId}
// Event: .undo.declined
{
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

### 4. Pause Game Endpoint (Enhanced)

**POST** `/websocket/games/{gameId}/pause`

**Existing endpoint needs enhancement**:

**Additional Validation**:
1. Verify game_mode is 'casual' (reject if rated)
2. Return clear error message: "Pausing is not allowed in rated games"

**Error Response for Rated Games** (400):
```json
{
  "success": false,
  "error": "Rated games cannot be paused",
  "message": "Pausing is not allowed in rated games. If you leave, you will forfeit."
}
```

---

### 5. Forfeit Game Endpoint (Enhanced)

**POST** `/websocket/games/{gameId}/forfeit`

**Existing endpoint needs enhancement**:

**Business Logic for Rated Games**:
1. If game_mode is 'rated':
   - Award full rating points to opponent
   - Deduct rating points from forfeiting player
   - Mark result as 'forfeit'
   - Update player statistics

**Request Body**:
```json
{
  "reason": "navigation" | "timeout" | "manual"
}
```

---

## WebSocket Events

All events are sent on channel: `game.{gameId}`

### Event: `.undo.request`
**When**: Player requests undo
**Sent to**: Opponent only

```javascript
{
  "from_user": {
    "id": 123,
    "name": "Player Name"
  },
  "from_player": "white" | "black",
  "timestamp": "2025-12-26T10:30:00Z"
}
```

### Event: `.undo.accepted`
**When**: Opponent accepts undo request
**Sent to**: Both players

```javascript
{
  "fen": "rnbqkbnr/...",
  "history": [...],
  "turn": "w" | "b",
  "undo_chances_remaining": 2,
  "timestamp": "2025-12-26T10:30:00Z"
}
```

### Event: `.undo.declined`
**When**: Opponent declines undo request
**Sent to**: Requester only

```javascript
{
  "timestamp": "2025-12-26T10:30:00Z"
}
```

---

## Game State Management

### Undo State Tracking

Add to game state cache/session:
```php
// Example structure
$gameState = [
    'pending_undo_request' => [
        'from_player' => 'white',
        'from_user_id' => 123,
        'requested_at' => '2025-12-26 10:30:00',
        'expires_at' => '2025-12-26 10:31:00' // 1 minute expiry
    ] ?? null
];
```

### Undo Expiration

Implement automatic expiration of undo requests after 60 seconds:
1. Store `expires_at` timestamp with request
2. Auto-decline expired requests
3. Emit `.undo.expired` event if needed

---

## Business Rules

### Casual Mode Rules
1. Each player starts with 3 undo chances
2. Undo can only be requested on player's own turn
3. Undo requires opponent approval
4. Undo removes last 2 moves (yours + opponent's response)
5. Undo is blocked if <2 moves have been played
6. Only one undo request can be pending at a time

### Rated Mode Rules
1. Undo is completely disabled (undo_remaining = 0)
2. Pausing is not allowed
3. Navigation/browser close triggers automatic forfeit
4. Rating changes apply immediately on game end
5. Pre-game confirmation required before game starts

### Rating Impact

**Rated Game Results**:
- Checkmate: Standard ELO calculation
- Resignation: Standard ELO calculation
- Forfeit: Full rating penalty (treat as resignation)
- Draw: Standard ELO calculation (no impact if equal rating)

---

## Security Considerations

1. **Undo Abuse Prevention**:
   - Enforce undo chance limits server-side
   - Prevent undo in rated games
   - Rate-limit undo requests (max 1 per 5 seconds)

2. **Game Mode Tampering**:
   - Never trust client-side game_mode value
   - Always read from database
   - Validate all mode-specific actions server-side

3. **WebSocket Security**:
   - Verify socket_id matches authenticated user
   - Prevent cross-game event spoofing
   - Rate-limit WebSocket events

---

## Testing Requirements

### Unit Tests
- [ ] Undo request validation (game mode, turn, chances)
- [ ] Undo accept/decline logic
- [ ] Undo state rollback (FEN, history, turn)
- [ ] Pause validation for rated games
- [ ] Forfeit rating calculation

### Integration Tests
- [ ] Complete undo flow (request → accept → state update)
- [ ] Undo expiration handling
- [ ] WebSocket event delivery
- [ ] Rated game pause rejection
- [ ] Forfeit with rating updates

### E2E Tests
- [ ] Casual game with successful undo
- [ ] Casual game with declined undo
- [ ] Rated game undo blocked
- [ ] Rated game pause blocked
- [ ] Rated game forfeit on navigation

---

## Migration Script

```sql
-- Migration: Add game mode and undo tracking
-- Date: 2025-12-26

-- Add game_mode column if not exists
ALTER TABLE games
ADD COLUMN IF NOT EXISTS game_mode VARCHAR(20) DEFAULT 'casual';

-- Add undo tracking columns
ALTER TABLE games
ADD COLUMN IF NOT EXISTS undo_white_remaining INTEGER DEFAULT 3;

ALTER TABLE games
ADD COLUMN IF NOT EXISTS undo_black_remaining INTEGER DEFAULT 3;

-- Create index for game mode filtering
CREATE INDEX IF NOT EXISTS idx_games_game_mode ON games(game_mode);

-- Update existing games to casual mode
UPDATE games
SET game_mode = 'casual',
    undo_white_remaining = 3,
    undo_black_remaining = 3
WHERE game_mode IS NULL;

-- Set rated games to 0 undo chances
UPDATE games
SET undo_white_remaining = 0,
    undo_black_remaining = 0
WHERE game_mode = 'rated';
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Run migration script
- [ ] Verify indexes created
- [ ] Test data integrity

### Phase 2: Undo Endpoints
- [ ] Implement `/undo/request` endpoint
- [ ] Implement `/undo/accept` endpoint
- [ ] Implement `/undo/decline` endpoint
- [ ] Add validation logic
- [ ] Add WebSocket event broadcasting

### Phase 3: Game Mode Validation
- [ ] Enhance pause endpoint validation
- [ ] Add rated game forfeit logic
- [ ] Implement rating calculations
- [ ] Add pre-game confirmation data

### Phase 4: Testing
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Manual E2E testing
- [ ] Performance testing

### Phase 5: Deployment
- [ ] Deploy to staging
- [ ] Run smoke tests
- [ ] Deploy to production
- [ ] Monitor logs and metrics

---

## API Error Codes Reference

| Code | Message | Scenario |
|------|---------|----------|
| 400 | "Undo not allowed in rated games" | Rated game undo attempt |
| 400 | "No undo chances remaining" | Player exhausted undo limit |
| 400 | "Not your turn" | Undo requested on opponent's turn |
| 400 | "Not enough moves to undo" | <2 moves played |
| 400 | "Pausing not allowed in rated games" | Rated game pause attempt |
| 400 | "No pending undo request" | Accept/decline without request |
| 403 | "Unauthorized" | User not in game |
| 404 | "Game not found" | Invalid game ID |

---

## Monitoring and Metrics

### Metrics to Track
- Undo request success/decline rate
- Average undo requests per game (casual)
- Rated game forfeit rate
- Pause rejection rate (rated games)
- Rating update success rate

### Logs to Monitor
- Undo request validation failures
- WebSocket event delivery failures
- Game state rollback errors
- Rating calculation anomalies

---

## Future Enhancements

1. **Undo History**: Track undo usage per player for analytics
2. **Custom Undo Limits**: Allow tournament organizers to set custom limits
3. **Undo Cooldown**: Add time-based cooldown between undo requests
4. **Provisional Ratings**: Implement separate rating system for new players
5. **Undo Reasons**: Optional reason field for undo requests (misclick, etc.)

---

## Related Documentation

- [Game Modes Implementation](./2025_12_24_game_modes_and_undo_fix.md)
- [Rated Game Navigation Protection](./2025_12_24_rated_game_navigation_protection.md)
- [WebSocket API Documentation](../api/websocket.md)

---

**Last Updated**: December 26, 2025
**Author**: Development Team
**Review Status**: Pending Backend Implementation
