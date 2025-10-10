# Server-Authoritative Clock Quick Start

## TL;DR - What Was Done

✅ **Backend (Complete)**:
- Database migration for clock fields (`white_ms`, `black_ms`, `running`, `revision`)
- `ClockService.php` - Server-side clock logic (O(1) lazy timing)
- `ClockStore.php` - Redis-backed clock state with DB persistence
- `GameClockUpdated` event - WebSocket broadcast for TURN_UPDATE
- `ActiveGamesHeartbeat` command - Scheduled task (every 2s)
- Integrated into `GameRoomService::broadcastMove()`

🟡 **Frontend (Manual Integration Required)**:
- New `timerUtils.js` - Server-synced hook with `onClockUpdate()` function
- **Requires**: Update `PlayMultiplayer.js` to use new timer API

## Developer Quick Setup (5 Steps)

### 1. Run Migration
```bash
cd chess-backend
php artisan migrate
```

### 2. Start Scheduler (for Heartbeat)
```bash
# Terminal 1
php artisan schedule:work
```

### 3. Start WebSocket Server
```bash
# Terminal 2
php artisan reverb:start
```

### 4. Update PlayMultiplayer.js

**Find and replace** in `chess-frontend/src/components/play/PlayMultiplayer.js`:

#### A. Update hook destructuring (~line 98)
```javascript
// OLD
const { playerTime, computerTime, activeTimer, ... } = useGameTimer(...);

// NEW
const { whiteMs, blackMs, activeTimer, onClockUpdate, ... } = useGameTimer(...);
```

#### B. Add WebSocket listener (~line 400)
```javascript
useEffect(() => {
  if (!echo || !gameInfo?.id) return;

  const clockChannel = echo.private(`game.${gameInfo.id}`);
  clockChannel.listen('.clock.updated', (data) => {
    onClockUpdate(data.clock, data.server_ms);
    if (data.turn) setGameInfo(prev => ({ ...prev, turn: data.turn }));
  });

  return () => clockChannel.stopListening('.clock.updated');
}, [echo, gameInfo?.id, onClockUpdate]);
```

#### C. Update timer display mapping (~line 1427)
```javascript
// OLD
const opponentTime = gameInfo.playerColor === 'white' ? computerTime : playerTime;
const yourTime = gameInfo.playerColor === 'white' ? playerTime : computerTime;

// NEW
const yourColor = gameInfo.playerColor;
const opponentColor = yourColor === 'white' ? 'black' : 'white';
const yourTime = yourColor === 'white' ? whiteMs : blackMs;
const opponentTime = opponentColor === 'white' ? whiteMs : blackMs;
```

#### D. Use formatTime helper
```javascript
import { formatTime } from '../../utils/timerUtils';

<TimerDisplay time={formatTime(yourTime)} active={activeTimer === yourColor} />
<TimerDisplay time={formatTime(opponentTime)} active={activeTimer === opponentColor} />
```

#### E. Remove local timer flipping
**DELETE** any code that calls:
- `setActiveTimer(newTurn)`
- `switchTimer(newTurn)`

The server now controls timer flipping via `GameClockUpdated` events.

### 5. Test with Two Browsers

Open two browsers (Chrome + Firefox or Incognito):

1. Start a game
2. **Expected**: Active player's timer counts down
3. Make a move
4. **Expected**: Timer switches to opponent (<200ms)
5. Reload one browser
6. **Expected**: Timer resumes with exact server time

## Verification Checklist

| Test | Expected Behavior | Status |
|------|------------------|--------|
| Timer starts on game begin | Active player's timer counts down | ⬜ |
| Timer switches on move | Opponent's timer starts within 200ms | ⬜ |
| Timer sync across clients | Both clients show same time (±200ms) | ⬜ |
| Page reload | Timer resumes with exact server time | ⬜ |
| Tab sleep/wake | Timer "catches up" correctly | ⬜ |
| Time forfeit | "Time's up! [Winner] wins!" on both clients | ⬜ |

## Troubleshooting

### Timers not moving?

1. **Check scheduler**: `ps aux | grep schedule:work`
2. **Check Redis**: `redis-cli ping`
3. **Check logs**: `tail -f chess-backend/storage/logs/laravel.log`

### Wrong timer counting down?

1. **Verify color mapping**:
```javascript
console.log('Your color:', gameInfo.playerColor);
console.log('Active timer:', activeTimer);
console.log('Match:', activeTimer === gameInfo.playerColor);
```

2. **Check for local flipping**: Search for `setActiveTimer`, `switchTimer` - should not be called after moves

### Clock doesn't start?

Initialize clock on game creation (in `GameController::create()`):
```php
$game->white_ms = 600000; // 10 min
$game->black_ms = 600000;
$game->running = 'white';
$game->last_server_ms = now()->timestamp * 1000;
$game->save();
```

## Architecture Diagram

```
┌─────────────────────────────────────────┐
│          Laravel Backend                │
│  ┌─────────────────────────────────┐   │
│  │ ClockService (lazy timing)      │   │
│  │ ClockStore (Redis + DB)         │   │
│  │ GameClockUpdated (WebSocket)    │   │
│  └─────────────────────────────────┘   │
│            ▼ Every 2s                   │
│  ┌─────────────────────────────────┐   │
│  │ ActiveGamesHeartbeat Command    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
                 │
                 │ WebSocket (TURN_UPDATE)
                 ▼
┌─────────────────────────────────────────┐
│          React Frontend                 │
│  ┌─────────────────────────────────┐   │
│  │ useGameTimer (server-synced)    │   │
│  │ - onClockUpdate(snapshot)       │   │
│  │ - Single 200ms interval         │   │
│  │ - Offset-corrected rendering    │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

## Key Files

### Backend
- `database/migrations/2025_10_10_000000_add_server_authoritative_clock_fields.php`
- `app/Services/ClockService.php`
- `app/Services/ClockStore.php`
- `app/Events/GameClockUpdated.php`
- `app/Console/Commands/ActiveGamesHeartbeat.php`
- `routes/console.php` (scheduler registration)

### Frontend
- `src/utils/timerUtils.js` (✅ Complete - new implementation)
- `src/components/play/PlayMultiplayer.js` (🟡 Requires manual integration)

## Next Steps

1. ✅ Run migration
2. ✅ Start scheduler + Reverb
3. 🟡 Update `PlayMultiplayer.js` (see Step 4 above)
4. 🟡 Test with two browsers (see checklist)
5. 🟡 Deploy to production

## Full Documentation

See `docs/SERVER_AUTHORITATIVE_CLOCK_IMPLEMENTATION.md` for:
- Complete architecture details
- Performance characteristics
- Advanced troubleshooting
- Migration strategy
- Future enhancements

---

**Status**: ✅ Backend Ready | 🟡 Frontend Integration Required
**Estimated Integration Time**: 30-60 minutes
**Testing Time**: 15-30 minutes
