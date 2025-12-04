# 🏆 Tournament Bracket Visualizer - Usage Guide

## Overview
This interactive HTML tool allows you to visually test tournament bracket generation across different player configurations.

## Files Generated
- `tournament_visualizer.html` - Main interactive visualizer
- `tournament_test_3_players.json` - 3-player tournament data
- `tournament_test_5_players.json` - 5-player tournament data
- `tournament_test_10_players.json` - 10-player tournament data
- `tournament_test_50_players.json` - 50-player tournament data
- `tournament_tests_all.json` - Combined data for all configurations

## 🚀 How to Use

### Step 1: Start the Server

**Windows:**
```cmd
cd chess-backend
START_VISUALIZER.bat
```

**Linux/Mac:**
```bash
cd chess-backend
./START_VISUALIZER.sh
```

**Manual (any platform):**
```bash
cd chess-backend/public
php -S localhost:8080 serve.php
```

Then open in browser: **http://localhost:8080**

> **Why?** The visualizer uses a standalone static file server (`serve.php`) to bypass Laravel/Vite dependencies and avoid timeout issues.

### 2. Select a Configuration
- Use the dropdown menu to select a tournament configuration
- Options: 3, 5, 10, or 50 players
- Each configuration has different round structures

### 3. Set Match Winners
- **Click on a player's name** to mark them as the winner
- Winner will be highlighted in green
- Loser will be grayed out with strikethrough
- Click again to toggle selection

### 4. Progressive Round Activation
- **Round 1** is always active (unlocked)
- **Subsequent rounds** unlock automatically when previous round completes
- Locked rounds show 🔒 icon
- Unlocked rounds show 🔓 icon
- Active round pulses to indicate it's ready for input

### 5. View Results
- When all matches are complete, the **podium** appears automatically
- Shows:
  - 🥇 Champion (1st place)
  - 🥈 Runner-up (2nd place)
  - 🥉 Third place (if applicable)

### 6. Controls
- **Reset Winners** (🔄) - Clear all winner selections and start over
- **Export Results** (💾) - Download JSON file with your selections

## Tournament Configurations

### 3-Player Tournament
- **Rounds**: 3
- **Structure**:
  - Round 1: Swiss (all players)
  - Round 2: Swiss (all players)
  - Round 3: Final (top 2)
- **Total Matches**: 6

### 5-Player Tournament
- **Rounds**: 4
- **Structure**:
  - Round 1: Swiss (all players)
  - Round 2: Swiss (all players)
  - Round 3: Semi-Final (top 4)
  - Round 4: Final (top 2)
- **Total Matches**: 11

### 10-Player Tournament
- **Rounds**: 5
- **Structure**:
  - Round 1: Swiss (all players)
  - Round 2: Swiss (all players)
  - Round 3: Quarter-Final (top 8)
  - Round 4: Semi-Final (top 4)
  - Round 5: Final (top 2)
- **Total Matches**: 25

### 50-Player Tournament
- **Rounds**: 7
- **Structure**:
  - Round 1-3: Swiss (all players)
  - Round 4: Round of 16 (top 16)
  - Round 5: Quarter-Final (top 8)
  - Round 6: Semi-Final (top 4)
  - Round 7: Final (top 2)
- **Total Matches**: 163

## Testing Checklist

Use this checklist to verify the elimination bracket system:

### ✅ Basic Functionality
- [ ] All configurations load without errors
- [ ] Player data displays correctly (name, rating)
- [ ] Winner selection works (click to select/deselect)
- [ ] Statistics update in real-time

### ✅ Round Activation Logic
- [ ] Round 1 is always unlocked
- [ ] Round 2+ locked until previous round completes
- [ ] Locked rounds show correct icon (🔒)
- [ ] Unlocked rounds show correct icon (🔓)
- [ ] Active round pulses visually

### ✅ Match Count Verification
- [ ] **3-Player - Round 3 (Final)**: Should have **1 match** with 2 players
- [ ] **5-Player - Round 3 (Semi)**: Should have **2 matches** with 4 players
- [ ] **5-Player - Round 4 (Final)**: Should have **1 match** with 2 players
- [ ] **10-Player - Round 3 (Quarter)**: Should have **4 matches** with 8 players
- [ ] **10-Player - Round 4 (Semi)**: Should have **2 matches** with 4 players
- [ ] **10-Player - Round 5 (Final)**: Should have **1 match** with 2 players
- [ ] **50-Player - Round 4 (R16)**: Should have **8 matches** with 16 players
- [ ] **50-Player - Round 5 (Quarter)**: Should have **4 matches** with 8 players
- [ ] **50-Player - Round 6 (Semi)**: Should have **2 matches** with 4 players
- [ ] **50-Player - Round 7 (Final)**: Should have **1 match** with 2 players

### ✅ Bracket Seeding
- [ ] Semi-Final: 1st vs 4th, 2nd vs 3rd
- [ ] Quarter-Final: 1v8, 4v5, 2v7, 3v6
- [ ] Round of 16: Proper seeding (1v16, 8v9, etc.)

### ✅ Podium Display
- [ ] Podium appears after final match complete
- [ ] Shows correct champion (final winner)
- [ ] Shows correct runner-up (final loser)
- [ ] Shows correct 3rd place (semi-final loser)

### ✅ Export Functionality
- [ ] Export button creates valid JSON file
- [ ] JSON contains all match results
- [ ] File can be re-imported for verification

## Expected Results

### Semi-Final Pairing Example (4 players)
```
Match 1: 1st Seed vs 4th Seed
Match 2: 2nd Seed vs 3rd Seed
```

### Quarter-Final Pairing Example (8 players)
```
Match 1: 1st Seed vs 8th Seed
Match 2: 4th Seed vs 5th Seed
Match 3: 2nd Seed vs 7th Seed
Match 4: 3rd Seed vs 6th Seed
```

### Final Match (2 players)
```
Match 1: Winner Semi 1 vs Winner Semi 2
```

## Troubleshooting

### JSON Files Not Loading
- Ensure you're running from a web server (not file:// protocol)
- Check browser console for CORS errors
- Verify JSON files exist in the same directory

### Rounds Not Unlocking
- Ensure all matches in previous round have winners selected
- Check for bye matches (automatically complete)
- Try Reset Winners button and start over

### Podium Not Showing
- Verify all rounds are complete
- Check that final match has a winner
- Ensure semi-final matches completed (for 3rd place)

## Regenerating Test Data

If you need to regenerate the test data:

```bash
cd chess-backend
php generate_tournament_test_data.php
```

This will create fresh JSON files with new test data.

## Browser Compatibility
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ✅ Safari
- ⚠️ Internet Explorer (Not Supported)
