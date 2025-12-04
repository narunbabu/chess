# How to Generate Tournament Test Data

**Quick Guide** to generate JSON test files for tournament visualizer

---

## 🎯 Option 1: Use v3 Generator (Recommended - With Backend Fix)

**File**: `chess-backend/generate_tournament_test_data_v3.php`

### Run It:
```bash
cd chess-backend
php generate_tournament_test_data_v3.php
```

### What It Generates:
```
✅ tournament_test_3_players_v3.json   (3 players, 2 rounds)
✅ tournament_test_5_players_v3.json   (5 players, 3 rounds)
✅ tournament_test_10_players_v3.json  (10 players, 6 rounds)
✅ tournament_test_50_players_v3.json  (50 players, 7 rounds)
✅ tournament_tests_all_v3.json        (combined file)
```

### Key Features (v3):
- ✅ Includes `determined_by_round` for backend fix
- ✅ Proper `round_type` for elimination detection
- ✅ Fair Buchholz tiebreaker in standings
- ✅ Compatible with fixed `PlaceholderMatchAssignmentService`

---

## 📁 Output Location

All files saved to:
```
chess-backend/public/tournament_test_*.json
```

Use in visualizer:
```
http://localhost:8000/tournament_visualizer_v3.html
→ Click "Load JSON File" button
→ Select generated file
```

---

## 🔧 Option 2: Use v2 Generator (Legacy)

**File**: `chess-backend/generate_tournament_test_data_v2.php`

```bash
cd chess-backend
php generate_tournament_test_data_v2.php
```

⚠️ **Note**: v2 does NOT include `determined_by_round` metadata, so backend fix won't work properly.

---

## 🎨 Customizing Tournament Structure

Edit `generate_tournament_test_data_v3.php`, modify the `$configurations` array:

```php
[
    'players' => 8,  // Number of players
    'name' => '8-Player Tournament v3',
    'rounds' => [
        // Round 1: Swiss
        [
            'round' => 1,
            'name' => 'Round 1',
            'type' => 'swiss',
            'participant_selection' => 'all',
            'pairing_method' => 'random_seeded'
        ],
        // Round 2: Quarter Finals
        [
            'round' => 2,
            'name' => 'Quarter Final',
            'type' => 'quarter_final',
            'participant_selection' => ['top_k' => 8],
            'pairing_method' => 'standings_based',
            'determined_by' => 1  // 🎯 Determined by Round 1
        ],
        // Round 3: Semi Finals
        [
            'round' => 3,
            'name' => 'Semi Final',
            'type' => 'semi_final',
            'participant_selection' => ['top_k' => 4],
            'pairing_method' => 'standings_based',
            'determined_by' => 2  // 🎯 Determined by Round 2 (elimination winners)
        ],
        // Round 4: Final
        [
            'round' => 4,
            'name' => 'Final',
            'type' => 'final',
            'participant_selection' => ['top_k' => 2],
            'pairing_method' => 'standings_based',
            'determined_by' => 3  // 🎯 Determined by Round 3 (semi winners)
        ],
    ],
]
```

### Important Fields:

| Field | Description | Example |
|-------|-------------|---------|
| `type` | Round type for backend detection | `'swiss'`, `'semi_final'`, `'final'` |
| `participant_selection` | How to select players | `'all'` or `['top_k' => 4]` |
| `determined_by` | Which round determines this round | `1` (Round 1 results) |
| `pairing_method` | How to pair players | `'random_seeded'`, `'standings_based'` |

---

## 🧪 Testing Generated Files

### Test in Visualizer:
```bash
cd chess-backend/public
php -S localhost:8000
```

Open: `http://localhost:8000/tournament_visualizer_v3.html`

### Quick Load Buttons:
The visualizer has quick load buttons for v3 files:
```
[3 Players] [5 Players] [10 Players] [50 Players]
```

### Manual Load:
1. Click "Load JSON File" button
2. Select `tournament_test_X_players_v3.json`
3. Verify:
   - ✅ Round 2+ shows TBD placeholders
   - ✅ Complete Round 1 → Round 2 unlocks
   - ✅ Complete Round 2 → Round 3 shows winners

---

## 🎯 What Each File Contains

### Example: `tournament_test_5_players_v3.json`

```json
{
  "tournament_info": {
    "name": "5-Player Tournament v3",
    "players": 5,
    "rounds": 3,
    "format": "Swiss + Elimination",
    "version": "3.0"
  },
  "participants": [
    {"id": 201, "name": "Player A", "rating": 1500},
    {"id": 202, "name": "Player B", "rating": 1450},
    ...
  ],
  "initial_standings": [
    {
      "player_id": 201,
      "points": 0,
      "buchholz": 0,  // ← Fair tiebreaker
      "rank": 1
    },
    ...
  ],
  "rounds": [
    {
      "round_number": 1,
      "name": "Round 1",
      "round_type": "swiss",
      "matches": [
        {
          "is_placeholder": false,
          "player1_id": 201,
          "player2_id": 202,
          "status": "pending"
        }
      ]
    },
    {
      "round_number": 2,
      "name": "Semi Final",
      "round_type": "semi_final",  // ← Backend detects elimination
      "matches": [
        {
          "is_placeholder": true,
          "player1_id": null,
          "player2_id": null,
          "player1_bracket_position": 1,
          "player2_bracket_position": 4,
          "determined_by_round": 1,  // ← Backend uses Round 1 standings
          "requires_top_k": 4
        }
      ]
    },
    {
      "round_number": 3,
      "name": "Final",
      "round_type": "final",  // ← Elimination round
      "matches": [
        {
          "is_placeholder": true,
          "determined_by_round": 2,  // ← 🎯 Backend uses Round 2 WINNERS!
          "requires_top_k": 2
        }
      ]
    }
  ]
}
```

---

## 🔍 Troubleshooting

### Error: "Class not found"
```bash
# Solution: Run composer install
cd chess-backend
composer install
```

### Error: "Database connection failed"
```bash
# Solution: Configure .env file
cp .env.example .env
php artisan key:generate

# Or use SQLite for testing
# Edit .env:
DB_CONNECTION=sqlite
DB_DATABASE=/path/to/database.sqlite
```

### Error: "Permission denied"
```bash
# Solution: Make script executable
chmod +x generate_tournament_test_data_v3.php

# Or run with PHP directly
php generate_tournament_test_data_v3.php
```

---

## 📚 Related Files

- `chess-backend/public/tournament_visualizer_v3.html` - Visualizer UI
- `chess-backend/public/tournament-helpers.js` - Helper functions
- `docs/BACKEND_TOURNAMENT_FIX_COMPLETE.md` - Backend fix documentation
- `chess-backend/public/V3_TESTING_GUIDE.md` - Testing guide

---

## ✅ Quick Start

```bash
# 1. Generate test files
cd chess-backend
php generate_tournament_test_data_v3.php

# 2. Start server
cd public
php -S localhost:8000

# 3. Open visualizer
# http://localhost:8000/tournament_visualizer_v3.html

# 4. Click "5 Players" button to quick load
```

---

**Status**: Ready to use! 🚀
