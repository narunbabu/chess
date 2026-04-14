---
name: Synthetic Players & Companion System Research
description: Full research on how synthetic players work, difficulty mapping, and companion mode architecture
type: project
originSessionId: 3b4e74dd-30c3-4434-87f3-a07d4fa509d4
---
## Synthetic Player System Architecture

### Database (chess-backend)
- **Table**: `synthetic_players` — columns: id, name, avatar_seed, rating, computer_level (6-16), personality, bio, is_active, games_played_count, wins_count
- **Model**: `chess-backend/app/Models/SyntheticPlayer.php` — has `findClosestToRating()`, `getForLobby()`, `getRandomizedForLobby()` methods
- **Seeder**: `chess-backend/database/seeders/SyntheticPlayerSeeder.php` — 35 players across levels 6-16
- **Rating formula**: 800 + (level * 100) ± 50 random offset
- **Migration for companion column**: `2026_02_18_100000_add_synthetic_player_id_to_games.php`

### Current Player Distribution (35 total)
| Level | Rating Range | Count | Players |
|-------|-------------|-------|---------|
| 6 | 1370-1440 | 4 | Priya, Kiran, Ravi, Ananya |
| 7 | 1470-1540 | 4 | Vikram, Sneha, Aditya, Meera |
| 8 | 1570-1640 | 4 | Rohan, Deepa, Sanjay, Kavita |
| 9 | 1680-1750 | 4 | Arjun, Lakshmi, Nikhil, Pooja |
| 10 | 1780-1850 | 4 | Suresh, Divya, Rajesh, Isha |
| 11 | 1880-1950 | 4 | Amit, Nandini, Gaurav, Swati |
| 12 | 1970-2050 | 4 | Manish, Shruti, Harish, Tanvi |
| 13 | 2080-2140 | 3 | Ashwin, Rekha, Vivek |
| 14 | 2180-2240 | 3 | Arun, Sunita, Pranav |
| 15 | 2280-2320 | 2 | Krithika, Dhruv |
| 16 | 2370-2440 | 3 | Siddharth, Anisha, Vishal |

### Stockfish Difficulty Mapping
**Why**: Stockfish doesn't use ELO directly. The system maps `computer_level` (1-16) → `movetime` (ms) for the engine.

**Why it's capped at ~2440 rating**: Level 16 = 2500ms think time. Stockfish at 2.5s/move is roughly ~2400-2500 ELO equivalent. To reach 2600+, we need either:
1. Higher movetime (3000-5000ms) at the cost of user wait time
2. Increase MultiPV depth (currently top 10 moves at level's movetime)
3. Use `setoption name UCI_LimitStrength value true` + `setoption name UCI_Elo value 2600` — Stockfish has a built-in strength limiter

**Current movetime mapping** (`computerMoveUtils.js`):
- Level 6 → 400ms, Level 10 → 800ms, Level 14 → 1800ms, Level 16 → 2500ms

### How Companions Work In-Game
- **CompanionControls.jsx**: Uses companion's `computer_level` to call local Stockfish for hints/moves
- Calls `getStockfishTopMoves(fen, 1, timeMs)` — gets only the TOP 1 move (not ranked selection)
- This means companions always suggest the BEST move at their level — they don't make suboptimal choices like opponents do
- **Continuous play mode**: Companion can auto-play all moves for the player

### How Opponents Work (for comparison)
- `computerMoveUtils.js → getComputerMove()`: Gets top 10 moves via MultiPV, then `selectMoveFromRankedList()` picks based on depth
- Lower levels: random among all 10 moves (play weaker)
- Higher levels: picks the best move (play stronger)
- This is why opponents at level 16 ≈ 2400 but companions at level 16 suggest only the best move

### How to Create 2600+ Companions
The user wants 4 high-rated companions (~2600) and 1 lower rated. Options:

**Option A — Increase movetime**: Add levels 17-18 with movetime 3000-5000ms. Rating = 800 + (level * 100) ≈ 2500-2600.

**Option B — Stockfish UCI_LimitStrength**: Set `UCI_Elo 2600` directly. More accurate ELO simulation. Stockfish internally adjusts its play to match that ELO.

**Option C — Use `go depth X` instead of `go movetime X`**: Stockfish at depth 20-22 ≈ 2600-2800 ELO. More deterministic than time-based.

### Frontend Companion Flow (from MatchmakingQueue)
1. User selects "Game Mode" (was Rated/Casual, removed Companion option in latest edit)
2. Companion dropdown shows `Name — Rating` format
3. Selected companion → `navigate('/play', { state: { ratedMode: 'companion', syntheticPlayer: companion } })`
4. PlayComputer.js receives state → sets `selectedCompanion` → CompanionControls panel appears in-game
5. Companion's `computer_level` is used for both the OPPONENT strength AND the companion hint strength

**Key issue**: Currently the opponent and companion use the SAME `computer_level`. To make companions stronger than opponents, they need separate levels.

**Why**: The user specifically said "companions need to be more capable" — meaning the AI helper should play at a higher level than the opponent it faces. This requires splitting: `companion.computer_level` (for hints) vs `opponent.computer_level` (the bot being played against).
