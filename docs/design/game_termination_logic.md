# Game Termination & Inactivity Logic Design

**Date:** 2025-10-03
**Status:** Design Proposal
**Priority:** Critical - Affects game fairness

---

## Business Requirements

### 1. Abort/Kill Game Rules
**Current Problem:** "Kill Game" button doesn't specify winner/loser

**New Rule:** **The player who aborts/kills SHALL LOSE the game**

**Rationale:** Prevents abuse (players killing games they're losing to avoid a loss record)

---

### 2. Inactivity Handling
**Current Problem:** Browser close/mobile screen off ends game immediately

**New Rules:**
1. **Initial inactivity (60 seconds):** Show "Are You There?" dialog to inactive player
2. **No response (10 seconds):** Game PAUSES, stays in lobby, other player can wait
3. **Extended pause (30 min):** Inactive player LOSES by timeout
4. **Player returns:** Game auto-resumes when heartbeat received

**Rationale:** Accommodate temporary disconnections (network issues, phone calls) while preventing indefinite stalling

---

### 3. Mutual Abort Agreement
**Current Problem:** No way for both players to agree to cancel a game

**New Rule:** If both players agree, game ends as **No Result** (draw-like, but doesn't count as draw for ratings)

**Flow:**
1. Player A clicks "Request Abort"
2. Player B sees notification: "Player A wants to abort. Agree?"
3. If Player B agrees → No Result
4. If Player B declines → Game continues, Player A can forfeit unilaterally (and lose)

---

## Database Schema Changes

### Add New Status Value

```sql
-- Add 'paused' to game_statuses lookup table
INSERT INTO game_statuses (code, label) VALUES ('paused', 'Paused (waiting for player)');
```

### Add New End Reasons

```sql
-- Add forfeit and mutual abort reasons
INSERT INTO game_end_reasons (code, label) VALUES
    ('forfeit', 'Forfeit (unilateral abort)'),
    ('abandoned_mutual', 'Abandoned by mutual agreement'),
    ('timeout_inactivity', 'Timeout due to inactivity');
```

### Result Values (PGN Standard)

| Result | Meaning | When Used |
|--------|---------|-----------|
| `1-0` | White wins | Checkmate, resignation, forfeit by black, timeout by black |
| `0-1` | Black wins | Checkmate, resignation, forfeit by white, timeout by white |
| `1/2-1/2` | Draw | Stalemate, agreement, threefold, fifty-move, insufficient material |
| `*` | No result | Mutual abort, game canceled before moves |

---

## Game Termination Scenarios

### Scenario 1: Unilateral Abort (Forfeit)

**Trigger:** Player clicks "Forfeit Game" (rename "Kill Game" to this)

**Logic:**
```javascript
// Frontend
async function forfeitGame(gameId) {
    const confirmation = confirm(
        "Forfeiting will result in a LOSS for you. Are you sure?"
    );
    if (!confirmation) return;

    await wsService.forfeitGame(gameId);
}
```

**Backend Logic:**
```php
// GameRoomService::forfeitGame()
public function forfeitGame(int $gameId, int $userId): array
{
    $game = Game::lockForUpdate()->findOrFail($gameId);

    // Determine winner (opponent of forfeiter)
    $forfeiterColor = $game->getPlayerColor($userId);
    $result = ($forfeiterColor === 'white') ? '0-1' : '1-0';
    $winnerUserId = ($forfeiterColor === 'white')
        ? $game->black_player_id
        : $game->white_player_id;

    $game->update([
        'status' => 'finished',
        'result' => $result,
        'end_reason' => 'forfeit',
        'winner_user_id' => $winnerUserId,
        'winner_player' => ($forfeiterColor === 'white') ? 'black' : 'white',
        'ended_at' => now()
    ]);

    broadcast(new GameEndedEvent($game->id, $this->getGameData($game)));

    return ['success' => true, 'result' => $result];
}
```

**Status/Result:**
- `status='finished'`
- `result='0-1'` or `'1-0'` (forfeiter loses)
- `end_reason='forfeit'`

---

### Scenario 2: Inactivity Detection

**Trigger:** No heartbeat or move for 60 seconds

**Phase 1: Initial Inactivity (60 seconds)**
```php
// Frontend - triggered by client-side timer
public function checkInactivity(Game $game): void
{
    $lastActivity = max(
        $game->last_move_at,
        $game->last_heartbeat_at ?? $game->updated_at
    );

    $inactiveSeconds = now()->diffInSeconds($lastActivity);

    // At 60 seconds - trigger "Are You There?" dialog on client
    if ($inactiveSeconds >= 60 && $inactiveSeconds < 70 && $game->status === 'active') {
        broadcast(new ShowAreYouThereDialogEvent($game->id, [
            'inactive_player' => $this->getInactivePlayer($game),
            'seconds_remaining' => 10
        ]));
    }

    // At 70 seconds - no response, pause game
    if ($inactiveSeconds >= 70 && $game->status === 'active') {
        $game->update([
            'status' => 'paused',
            'paused_at' => now(),
            'paused_reason' => 'inactivity'
        ]);

        broadcast(new GamePausedEvent($game->id, [
            'reason' => 'Player inactive',
            'inactive_player' => $this->getInactivePlayer($game)
        ]));
    }
}
```

**Phase 2: Extended Inactivity (30 min from pause)**
```php
if ($game->status === 'paused' && $game->paused_at) {
    $pausedSeconds = now()->diffInSeconds($game->paused_at);

    if ($pausedSeconds > 1800) { // 30 minutes
        // Timeout - inactive player loses
        $this->forfeitByTimeout($game);
    }
}
```

**New Database Fields Needed:**
```php
// Add to games table migration
$table->timestamp('paused_at')->nullable();
$table->string('paused_reason')->nullable();
$table->timestamp('last_heartbeat_at')->nullable();
```

**Status/Result:**
- Phase 1: `status='paused'`
- Phase 3: `status='finished'`, `result='0-1'` or `'1-0'`, `end_reason='timeout_inactivity'`

---

### Scenario 3: Mutual Abort Agreement

**Trigger:** Player A requests abort, Player B accepts

**Flow:**

**Step 1: Player A Requests**
```javascript
// Frontend
async function requestAbort(gameId) {
    await wsService.send('game.abort.request', { game_id: gameId });
}
```

**Backend:**
```php
// WebSocketController
public function requestAbort(Request $request, int $gameId): JsonResponse
{
    $game = Game::findOrFail($gameId);

    // Store pending abort request
    Cache::put("abort_request_{$gameId}_{Auth::id()}", true, 300); // 5 min expiry

    // Notify opponent
    $opponentId = $game->getOpponent(Auth::id())->id;
    broadcast(new AbortRequestEvent($gameId, [
        'requester_id' => Auth::id(),
        'requester_name' => Auth::user()->name
    ]))->toOthers();

    return response()->json(['success' => true, 'status' => 'pending']);
}
```

**Step 2: Player B Responds**
```php
public function respondToAbort(Request $request, int $gameId): JsonResponse
{
    $request->validate(['accept' => 'required|boolean']);

    $game = Game::lockForUpdate()->findOrFail($gameId);
    $opponentId = $game->getOpponent(Auth::id())->id;

    // Check if request still valid
    if (!Cache::has("abort_request_{$gameId}_{$opponentId}")) {
        return response()->json(['error' => 'No pending abort request'], 400);
    }

    if ($request->accept) {
        // Mutual agreement - No Result
        $game->update([
            'status' => 'finished',
            'result' => '*',  // No result
            'end_reason' => 'abandoned_mutual',
            'ended_at' => now()
        ]);

        Cache::forget("abort_request_{$gameId}_{$opponentId}");

        broadcast(new GameEndedEvent($game->id, $this->getGameData($game)));

        return response()->json(['success' => true, 'result' => 'mutual_abort']);
    } else {
        // Declined - game continues
        Cache::forget("abort_request_{$gameId}_{$opponentId}");

        broadcast(new AbortDeclinedEvent($gameId))->toOthers();

        return response()->json(['success' => true, 'result' => 'declined']);
    }
}
```

**Status/Result:**
- `status='finished'`
- `result='*'` (No result - doesn't count for ratings)
- `end_reason='abandoned_mutual'`

---

## Heartbeat System

**Purpose:** Detect when player goes inactive (browser closed, screen off, network lost)

**Frontend Implementation:**
```javascript
// wsService.js
class WebSocketService {
    startHeartbeat(gameId) {
        this.heartbeatInterval = setInterval(() => {
            this.send('game.heartbeat', {
                game_id: gameId,
                timestamp: Date.now()
            });
        }, 30000); // Every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
        }
    }

    // On visibility change
    handleVisibilityChange() {
        if (document.hidden) {
            this.send('game.visibility', { visible: false });
        } else {
            this.send('game.visibility', { visible: true });
            this.send('game.heartbeat', { resumed: true });
        }
    }
}

// Listen for visibility changes
document.addEventListener('visibilitychange', () => {
    wsService.handleVisibilityChange();
});
```

**Backend Handler:**
```php
public function heartbeat(Request $request): JsonResponse
{
    $gameId = $request->input('game_id');
    $game = Game::find($gameId);

    if ($game && $game->status === 'active') {
        $game->update(['last_heartbeat_at' => now()]);

        // If game was paused due to inactivity, resume it
        if ($game->paused_reason === 'inactivity') {
            $game->update([
                'status' => 'active',
                'paused_at' => null,
                'paused_reason' => null
            ]);

            broadcast(new GameResumedEvent($game->id));
        }
    }

    return response()->json(['success' => true]);
}
```

---

## Background Job: Inactivity Monitor

**Purpose:** Check all active/paused games for inactivity

**Implementation:**
```php
// app/Console/Commands/MonitorGameInactivity.php
class MonitorGameInactivity extends Command
{
    protected $signature = 'games:monitor-inactivity';

    public function handle()
    {
        $games = Game::whereIn('status', ['active', 'paused'])
            ->get();

        foreach ($games as $game) {
            $this->checkGameInactivity($game);
        }
    }

    private function checkGameInactivity(Game $game)
    {
        $lastActivity = max(
            $game->last_move_at,
            $game->last_heartbeat_at ?? $game->updated_at
        );

        $inactiveSeconds = now()->diffInSeconds($lastActivity);

        if ($game->status === 'active' && $inactiveSeconds > 300) {
            // Pause after 5 min
            app(GameRoomService::class)->pauseGame($game->id, 'inactivity');
        } elseif ($game->status === 'paused' && $inactiveSeconds > 1800) {
            // Forfeit after 30 min total (15 min paused + 15 min warning)
            app(GameRoomService::class)->forfeitByTimeout($game->id);
        }
    }
}
```

**Schedule in Kernel:**
```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    $schedule->command('games:monitor-inactivity')
        ->everyMinute();
}
```

---

## UI/UX Changes

### 1. Rename "Kill Game" → "Forfeit Game"

**Button Text:**
```
OLD: "Kill Game"
NEW: "Forfeit Game" (with warning icon)
```

**Confirmation Dialog:**
```
Title: "Forfeit Game?"
Message: "Forfeiting will count as a LOSS. Your opponent will win.
         Do you want to request a mutual abort instead?"
Buttons:
  - "Forfeit (I lose)" [Red, destructive]
  - "Request Mutual Abort" [Yellow, secondary]
  - "Cancel" [Gray, default]
```

### 2. Add "Request Abort" Option

**New Button:** "Request Abort" (next to "Forfeit Game")

**When clicked:**
- Sends request to opponent
- Shows "Waiting for opponent response..." toast
- Disables button for 5 minutes (expiry time)

**Opponent sees:**
```
Notification: "Your opponent wants to abort this game."
Buttons:
  - "Agree (No Result)" [Yellow]
  - "Decline (Continue Playing)" [Green]
```

### 3. Inactivity Indicators

**During Pause:**
```
Banner: "⏸️ Game Paused - Waiting for [Player Name]"
Timer: "Resuming in 15:00 or when player returns"
```

**During Warning:**
```
Banner: "⚠️ [Player Name] inactive - 5:00 remaining before timeout"
```

**After Timeout:**
```
Result: "[Player Name] lost by inactivity timeout"
```

---

## Migration Plan

### Step 1: Schema Updates (New Migration)

```php
// database/migrations/2025_10_03_120000_add_game_termination_features.php
public function up()
{
    // Add new status
    DB::table('game_statuses')->insert([
        'code' => 'paused',
        'label' => 'Paused',
        'created_at' => now(),
        'updated_at' => now()
    ]);

    // Add new end reasons
    DB::table('game_end_reasons')->insert([
        ['code' => 'forfeit', 'label' => 'Forfeit', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'abandoned_mutual', 'label' => 'Abandoned by agreement', 'created_at' => now(), 'updated_at' => now()],
        ['code' => 'timeout_inactivity', 'label' => 'Timeout', 'created_at' => now(), 'updated_at' => now()],
    ]);

    // Add new columns to games table
    Schema::table('games', function (Blueprint $table) {
        $table->timestamp('paused_at')->nullable()->after('ended_at');
        $table->string('paused_reason')->nullable()->after('paused_at');
        $table->timestamp('last_heartbeat_at')->nullable()->after('last_move_at');
    });
}
```

### Step 2: Update Enums

```php
// app/Enums/GameStatus.php - add PAUSED
case PAUSED = 'paused';

// app/Enums/EndReason.php - add new reasons
case FORFEIT = 'forfeit';
case ABANDONED_MUTUAL = 'abandoned_mutual';
case TIMEOUT_INACTIVITY = 'timeout_inactivity';
```

### Step 3: Implement Services

- `GameRoomService::forfeitGame()`
- `GameRoomService::requestAbort()`
- `GameRoomService::respondToAbort()`
- `GameRoomService::pauseGame()`
- `GameRoomService::resumeGame()`
- `GameRoomService::forfeitByTimeout()`

### Step 4: Update Frontend

- Rename "Kill Game" → "Forfeit Game"
- Add "Request Abort" button
- Add abort request/response UI
- Implement heartbeat system
- Add inactivity indicators

### Step 5: Deploy Background Job

- `MonitorGameInactivity` command
- Schedule every minute
- Monitor and test

---

## Testing Scenarios

### Test 1: Unilateral Forfeit
1. Start game with 2 players
2. Player A clicks "Forfeit Game"
3. **Expected:** Player B wins, result shows Player A forfeited

### Test 2: Mutual Abort
1. Start game
2. Player A clicks "Request Abort"
3. Player B accepts
4. **Expected:** Game ends with No Result (`result='*'`)

### Test 3: Mutual Abort Declined
1. Player A requests abort
2. Player B declines
3. **Expected:** Game continues, notification shown

### Test 4: Inactivity Pause
1. Start game
2. Player A stops sending heartbeats for 5 min
3. **Expected:** Game pauses, other player sees waiting message

### Test 5: Inactivity Timeout
1. Game paused due to inactivity
2. Wait 15 more minutes
3. **Expected:** Inactive player loses by timeout

### Test 6: Resume After Pause
1. Game paused
2. Inactive player returns, sends heartbeat
3. **Expected:** Game resumes automatically

---

## Configuration (ENV Variables)

```env
# Inactivity timeouts (seconds)
GAME_INACTIVITY_DIALOG_TIMEOUT=60      # 1 minute - show "Are You There?" dialog
GAME_INACTIVITY_PAUSE_TIMEOUT=70       # 70 seconds - pause if no response
GAME_INACTIVITY_FORFEIT_TIMEOUT=1800   # 30 minutes paused - then forfeit
GAME_HEARTBEAT_INTERVAL=30             # 30 seconds

# Abort request expiry
GAME_ABORT_REQUEST_EXPIRY=300          # 5 minutes
```

---

## Summary

| Feature | Status | Result | Winner |
|---------|--------|--------|--------|
| **Forfeit Game** | finished | 0-1 or 1-0 | Opponent wins |
| **Mutual Abort** | finished | * (No Result) | None |
| **Inactivity (short)** | paused | - | Wait for return |
| **Inactivity (timeout)** | finished | 0-1 or 1-0 | Active player wins |
| **Resignation** | finished | 0-1 or 1-0 | Opponent wins |
| **Checkmate** | finished | 0-1 or 1-0 | Winning player |

**Key Principle:** The player who causes the game to end abnormally (forfeit, timeout) SHALL LOSE, unless both players agree (mutual abort).
