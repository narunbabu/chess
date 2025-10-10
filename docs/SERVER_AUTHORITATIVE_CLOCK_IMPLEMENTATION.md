# Server-Authoritative Chess Clock Implementation Guide

## Overview

This document describes the implementation of server-authoritative chess clocks for the Chess-Web multiplayer platform. The implementation ensures perfect synchronization between players by making the server the single source of truth for all clock state.

## Architecture

### Core Principles

1. **Server Authority**: Server decides running side and remaining milliseconds
2. **No Drift**: Clients only render from server snapshots; one lightweight local tick for display
3. **No Race Conditions**: Server snapshots are authoritative; revision-based ordering prevents stale updates
4. **Low Server Load**: Lazy timing (diff math only on events/heartbeats)

### Component Diagram

```
┌──────────────────────────────────────────────────────┐
│                    Laravel Backend                    │
├──────────────────────────────────────────────────────┤
│  ClockService       │  Server-side clock logic       │
│  ClockStore         │  Redis + DB persistence        │
│  GameClockUpdated   │  WebSocket broadcast event     │
│  ActiveGamesHeartbeat│ Scheduled heartbeat (2s)      │
└──────────────────────────────────────────────────────┘
                         ▼ WebSocket
┌──────────────────────────────────────────────────────┐
│                   React Frontend                      │
├──────────────────────────────────────────────────────┤
│  useGameTimer       │  Server-synced timer hook      │
│  onClockUpdate      │  Snapshot receiver             │
│  Single interval    │  200ms display tick            │
└──────────────────────────────────────────────────────┘
```

## Backend Implementation

### 1. Database Migration

**File**: `chess-backend/database/migrations/2025_10_10_000000_add_server_authoritative_clock_fields.php`

Adds the following fields to `games` table:
- `white_ms` (bigint): White's remaining time in milliseconds
- `black_ms` (bigint): Black's remaining time in milliseconds
- `running` (enum): Active timer ('white', 'black', or NULL)
- `last_server_ms` (bigint): Server timestamp for elapsed time calculation
- `increment_ms` (int): Time increment per move (Fischer time control)
- `revision` (unsigned bigint): Monotonic version counter

**Run migration**:
```bash
cd chess-backend
php artisan migrate
```

### 2. ClockService.php

**File**: `chess-backend/app/Services/ClockService.php`

Core clock logic methods:
- `nowMs()`: Get current server time in milliseconds
- `applyElapsed(clock, now)`: Calculate elapsed time and update clock
- `onMove(clock, mover)`: Process move (flip timer, add increment)
- `pause(clock)`: Pause game clock
- `resume(clock, turn)`: Resume game clock
- `getSnapshot(clock)`: Get broadcast-ready snapshot

**Example usage**:
```php
$clockService = app(ClockService::class);
$clock = $clockService->applyElapsed($clock);
$clock = $clockService->onMove($clock, 'white'); // White made a move
```

### 3. ClockStore.php

**File**: `chess-backend/app/Services/ClockStore.php`

Redis-based clock state management:
- `load(gameId)`: Load clock from Redis (with DB fallback)
- `save(gameId, clock, persistToDb)`: Save to Redis (optional DB write)
- `updateWithRevision(gameId, clock, persist)`: Save with incremented revision
- `getActiveGameIds()`: Get all active game IDs for heartbeat

**Redis key structure**:
```
game:{id}:clock -> Hash {white_ms, black_ms, running, last_server_ms, ...}
```

### 4. GameClockUpdated Event

**File**: `chess-backend/app/Events/GameClockUpdated.php`

WebSocket broadcast event types:
- `TURN_UPDATE`: Regular move or heartbeat update
- `GAME_OVER`: Game ended (checkmate, flag, resignation)
- `GAME_PAUSED`: Game paused by player
- `GAME_RESUMED`: Game resumed after pause

**Broadcast payload**:
```json
{
  "type": "TURN_UPDATE",
  "game_id": 123,
  "revision": 42,
  "clock": {
    "white_ms": 354233,
    "black_ms": 318772,
    "running": "black",
    "last_server_ms": 1736451785123,
    "increment_ms": 0,
    "status": "active",
    "reason": null
  },
  "server_ms": 1736451785123,
  "turn": "black"
}
```

### 5. GameRoomService Integration

**File**: `chess-backend/app/Services/GameRoomService.php`

**Updated `broadcastMove()` method**:
```php
// After move validation and game state update...

// Load clock from Redis
$clock = $this->clockStore->load($gameId);

// Apply move to clock (flip timer, add increment)
$clock = $this->clockService->onMove($clock, $userRole);

// Save with incremented revision
$clock = $this->clockStore->updateWithRevision($gameId, $clock, true);

// Broadcast clock update
broadcast(new GameClockUpdated(
    $gameId,
    $clock,
    $newTurn,
    'TURN_UPDATE',
    null,
    ['move' => $move, 'fen' => $newFen, ...]
))->toOthers();
```

### 6. ActiveGamesHeartbeat Command

**File**: `chess-backend/app/Console/Commands/ActiveGamesHeartbeat.php`

Scheduled task that runs every 2 seconds:
```bash
php artisan games:heartbeat
```

**Registered in**: `chess-backend/routes/console.php`
```php
Schedule::command('games:heartbeat')
    ->everyTwoSeconds()
    ->withoutOverlapping()
    ->runInBackground();
```

**What it does**:
1. Gets all active game IDs from Redis
2. For each game: `applyElapsed()` to update clock
3. If time changed, increment revision and broadcast update
4. If flag (time's up), mark game as over and broadcast GAME_OVER

**Running the scheduler**:
```bash
# Development (single process)
php artisan schedule:work

# Production (add to crontab)
* * * * * cd /path/to/chess-backend && php artisan schedule:run >> /dev/null 2>&1
```

## Frontend Implementation

### 1. Updated timerUtils.js

**File**: `chess-frontend/src/utils/timerUtils.js`

**New API**:
```javascript
const {
  whiteMs,           // White's time in milliseconds
  blackMs,           // Black's time in milliseconds
  activeTimer,       // 'white', 'black', or null
  isTimerRunning,    // Boolean
  onClockUpdate,     // Function to call with server snapshots
  pauseTimer,        // Pause local rendering
  resetTimer,        // Reset for new game
} = useGameTimer(playerColor, game, setGameStatus);
```

**Key differences from old implementation**:
- ❌ **OLD**: `playerTime`, `computerTime` (confusing role-based naming)
- ✅ **NEW**: `whiteMs`, `blackMs` (color-based, clear mapping)
- ❌ **OLD**: Local timer flipping on `makeMove()`
- ✅ **NEW**: Server flips timer, client receives snapshot
- ❌ **OLD**: Multiple intervals with stale closure issues
- ✅ **NEW**: Single interval with offset-corrected server time

### 2. PlayMultiplayer.js Integration

**File**: `chess-frontend/src/components/play/PlayMultiplayer.js`

#### Step 1: Update timer hook usage

**OLD CODE** (lines ~98-115):
```javascript
const {
  playerTime,
  computerTime,
  activeTimer,
  isTimerRunning,
  setActiveTimer,
  handleTimer: startTimerInterval,
  switchTimer
} = useGameTimer(playerColor, game, handleTimerStatusChange);
```

**NEW CODE**:
```javascript
const {
  whiteMs,
  blackMs,
  activeTimer,
  isTimerRunning,
  onClockUpdate,   // NEW: function to sync with server
  pauseTimer,
  resetTimer
} = useGameTimer(playerColor, game, handleTimerStatusChange);
```

#### Step 2: Add WebSocket listener for clock updates

**Add this around line ~400 (where other echo listeners are)**:
```javascript
useEffect(() => {
  if (!echo || !gameInfo?.id) return;

  // Listen for server clock updates (TURN_UPDATE events)
  const clockChannel = echo.private(`game.${gameInfo.id}`);

  clockChannel.listen('.clock.updated', (data) => {
    console.log('🕐 Clock update received:', data);

    // Sync timer with server snapshot
    onClockUpdate(data.clock, data.server_ms);

    // Update turn indicator
    if (data.turn) {
      setGameInfo(prev => ({ ...prev, turn: data.turn }));
    }

    // Handle game over from flag
    if (data.type === 'GAME_OVER' && data.clock.reason === 'flag') {
      const winner = data.winner === 'white' ? 'White' : 'Black';
      setGameStatus(`Time's up! ${winner} wins!`);
      setGameInfo(prev => ({ ...prev, status: 'finished' }));
    }
  });

  return () => {
    clockChannel.stopListening('.clock.updated');
  };
}, [echo, gameInfo?.id, onClockUpdate]);
```

#### Step 3: Update timer display mapping

**OLD CODE** (lines ~1427-1466):
```javascript
const opponentTime = gameInfo.playerColor === 'white' ? computerTime : playerTime;
const yourTime = gameInfo.playerColor === 'white' ? playerTime : computerTime;
```

**NEW CODE**:
```javascript
// Color-mapped timer display
const yourColor = gameInfo.playerColor; // 'white' or 'black'
const opponentColor = yourColor === 'white' ? 'black' : 'white';

const yourTime = yourColor === 'white' ? whiteMs : blackMs;
const opponentTime = opponentColor === 'white' ? whiteMs : blackMs;

// Timer active state
const yourTimerActive = activeTimer === yourColor;
const opponentTimerActive = activeTimer === opponentColor;
```

#### Step 4: Update TimerDisplay components

**OLD CODE**:
```javascript
<TimerDisplay
  time={opponentTime}
  active={activeTimer === opponentColor}
  label={gameInfo.opponentName}
/>

<TimerDisplay
  time={yourTime}
  active={activeTimer === yourColor}
  label="You"
/>
```

**NEW CODE** (use `formatTime` from timerUtils):
```javascript
import { formatTime } from '../../utils/timerUtils';

<TimerDisplay
  time={formatTime(opponentTime)}
  active={opponentTimerActive}
  label={gameInfo.opponentName}
/>

<TimerDisplay
  time={formatTime(yourTime)}
  active={yourTimerActive}
  label="You"
/>
```

#### Step 5: Initialize clock on game start

**Add this where game initializes (around line ~200)**:
```javascript
useEffect(() => {
  if (gameInfo?.status === 'active' && gameInfo?.white_ms !== undefined) {
    // Initialize clock from game state on load/reconnect
    onClockUpdate({
      white_ms: gameInfo.white_ms,
      black_ms: gameInfo.black_ms,
      running: gameInfo.running,
      last_server_ms: gameInfo.last_server_ms || Date.now(),
      increment_ms: gameInfo.increment_ms || 0,
      status: gameInfo.status,
      revision: gameInfo.revision || 0
    }, Date.now());
  }
}, [gameInfo?.id, gameInfo?.status, onClockUpdate]);
```

#### Step 6: Remove local timer flipping logic

**DELETE** any code that calls `setActiveTimer()` or `switchTimer()` after making moves. The server now controls timer flipping.

**Example - REMOVE these lines**:
```javascript
// ❌ DELETE: Don't flip locally anymore
setActiveTimer(newTurn);
switchTimer(newTurn);
```

## Testing Checklist

### Local Development Setup

1. **Start Redis**:
```bash
redis-server
```

2. **Run migrations**:
```bash
cd chess-backend
php artisan migrate
```

3. **Start Laravel scheduler** (for heartbeat):
```bash
php artisan schedule:work
```

4. **Start Reverb WebSocket server**:
```bash
php artisan reverb:start
```

5. **Start Laravel backend**:
```bash
php artisan serve
```

6. **Start React frontend**:
```bash
cd chess-frontend
npm start
```

### Manual Testing

Open two browsers (or incognito + normal) side-by-side:

#### Test 1: Basic Timer Synchronization
- ✅ Start a new game
- ✅ Verify "Your turn" appears on correct player
- ✅ Verify active player's timer counts down
- ✅ Verify opponent's timer is static
- ✅ Make a move
- ✅ Verify timer switches to opponent immediately (<200ms)
- ✅ Verify both clients show same times (within ~200ms tolerance)

#### Test 2: Page Reload (Reconnection)
- ✅ Start a game, make several moves
- ✅ Hard reload one browser (Ctrl+Shift+R)
- ✅ Verify timer resumes with exact times from server
- ✅ Verify active timer is correct

#### Test 3: Tab Sleep/Wake
- ✅ Start a game
- ✅ Switch to another tab for 30 seconds
- ✅ Switch back
- ✅ Verify timer "catches up" correctly
- ✅ Verify next snapshot aligns with opponent's view

#### Test 4: Time Forfeit (Flag)
- ✅ Set a short time control (e.g., 10 seconds per side)
- ✅ Let one player's clock run out
- ✅ Verify "Time's up! [Winner] wins!" appears on both clients
- ✅ Verify game status changes to 'finished'
- ✅ Verify both clients show same end state

#### Test 5: Pause/Resume
- ✅ Start a game
- ✅ Pause the game (if pause feature implemented)
- ✅ Verify `running=null` (no timer active)
- ✅ Verify neither timer counts down
- ✅ Resume the game
- ✅ Verify correct player's timer resumes

#### Test 6: Opponent Disconnect
- ✅ Close one browser tab
- ✅ Verify remaining client shows "Opponent disconnected"
- ✅ Verify timer continues running (or pauses, depending on game rules)
- ✅ Reconnect opponent
- ✅ Verify timer sync remains accurate

### Debugging Tools

#### Enable verbose logging

**Backend** (config/logging.php):
```php
'channels' => [
    'stack' => [
        'driver' => 'stack',
        'channels' => ['daily'],
        'level' => 'debug', // Set to 'debug'
    ],
],
```

**Frontend** (add to PlayMultiplayer.js):
```javascript
useEffect(() => {
  console.log('🕐 Timer state:', {
    whiteMs,
    blackMs,
    activeTimer,
    isTimerRunning,
    yourColor: gameInfo.playerColor,
    turn: gameInfo.turn
  });
}, [whiteMs, blackMs, activeTimer, isTimerRunning, gameInfo]);
```

#### Check Redis clock state

```bash
redis-cli
> HGETALL game:1:clock
1) "white_ms"
2) "354233"
3) "black_ms"
4) "318772"
5) "running"
6) "black"
7) "last_server_ms"
8) "1736451785123"
9) "revision"
10) "42"
```

#### Monitor heartbeat logs

```bash
tail -f storage/logs/laravel.log | grep "Heartbeat"
```

## Performance Characteristics

### Server Load

- **Heartbeat frequency**: 2 seconds
- **Active games**: 1,000 games
- **Messages per second**: ~500 (1 per game every 2s)
- **CPU per game**: O(1) - simple diff math
- **Memory per game**: ~400 bytes (Redis hash)

### Network Bandwidth

- **Payload size**: ~400 bytes per TURN_UPDATE message
- **Bandwidth (1,000 games)**: ~200 KB/s
- **Per-player bandwidth**: ~0.2 KB/s (negligible)

### Client Performance

- **Single interval**: 200ms tick (5 fps)
- **State updates**: Only on server events (moves, heartbeats)
- **No CPU when paused**: Timer stops when `running=null`

## Troubleshooting

### Problem: Timers not syncing

**Symptoms**: Players see different times (>1 second difference)

**Causes**:
1. Scheduler not running (`php artisan schedule:work`)
2. Redis connection failed
3. WebSocket disconnected

**Fix**:
```bash
# Check scheduler
ps aux | grep "schedule:work"

# Check Redis
redis-cli ping

# Check WebSocket
curl http://localhost:8080
```

### Problem: Timer counts down on wrong side

**Symptoms**: Your timer runs when it's opponent's turn

**Causes**:
1. `playerColor` mapping incorrect
2. Old code still flipping timer locally
3. Server `running` state wrong

**Fix**:
```javascript
// Verify color mapping
console.log('Your color:', gameInfo.playerColor);
console.log('Active timer:', activeTimer);
console.log('Your timer active:', activeTimer === gameInfo.playerColor);

// Ensure no local flipping
// Search codebase for setActiveTimer, switchTimer - remove all calls
```

### Problem: Clock doesn't start on game begin

**Causes**:
1. Clock not initialized in database
2. `running` is NULL
3. WebSocket listener not attached

**Fix**:
```php
// In GameController::create() or game start logic
$game->white_ms = 600000; // 10 minutes
$game->black_ms = 600000;
$game->running = 'white'; // Start white's clock
$game->last_server_ms = now()->timestamp * 1000;
$game->increment_ms = 0;
$game->revision = 0;
$game->save();

// Broadcast initial clock state
broadcast(new GameClockUpdated($game->id, [...], 'white', 'TURN_UPDATE'));
```

## Migration from Old System

### Backward Compatibility

The implementation maintains backward compatibility:
- Old `GameMoveEvent` still broadcasts alongside `GameClockUpdated`
- Old timer code continues to work (client-side fallback)
- Database columns retain old `time_control_minutes`, `increment_seconds`

### Gradual Rollout

1. **Deploy backend** (clock service, heartbeat, events)
2. **Test with feature flag** (enable for 10% of games)
3. **Monitor metrics** (clock sync errors, flag victories)
4. **Full rollout** (enable for all games)
5. **Cleanup** (remove old timer code after 2 weeks)

## Future Enhancements

### 1. Hybrid Mode (Lower Server Load)

Skip heartbeats, only update on moves + reconnect:
- **Pros**: 80% lower server messages
- **Cons**: Drift accumulates during long think times
- **Use case**: Very high scale (10,000+ concurrent games)

### 2. Clock Skew Smoothing

Rolling average of `serverClientOffset` per session:
```javascript
const avgOffset = offsets.reduce((a, b) => a + b) / offsets.length;
```

### 3. Latency Budget UI

Display sync quality indicator:
```javascript
<div className="sync-indicator">
  Synced • ~{Math.round(serverClientOffset)}ms
</div>
```

### 4. Spectator Mode

Same clock snapshots, hide controls:
```javascript
const isSpectator = !['white', 'black'].includes(gameInfo.playerColor);
```

## References

- **Original Implementation Brief**: See root context in this file
- **Laravel Reverb Docs**: https://laravel.com/docs/11.x/reverb
- **Redis Hashes**: https://redis.io/docs/data-types/hashes/
- **Chess Clock Standards**: FIDE Handbook (time controls)

---

**Document Version**: 1.0
**Last Updated**: 2025-10-10
**Implemented By**: Claude Code AI Assistant
**Status**: ✅ Backend Complete | 🟡 Frontend Integration Required
