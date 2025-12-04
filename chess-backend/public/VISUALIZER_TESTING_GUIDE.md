# 🧪 Tournament Visualizer v2 - Testing Guide

## Quick Start

### 1. Start Local Server
```powershell
cd C:\ArunApps\Chess-Web\chess-backend\public
php -S localhost:8080
```

### 2. Open Visualizer
Navigate to: **http://localhost:8080/tournament_visualizer_v2.html**

---

## 🎯 Test Scenarios

### Scenario 1: 5-Player Tournament (Quick Test)

**Objective**: Verify all three requirements in ~5 minutes

#### Step 1: Check Equal Contribution (Objective 1)
1. Select "5-Player Tournament" from dropdown
2. Click "Toggle Standings" to show live rankings
3. **Verify Round 1**:
   - Count: Should have 2-3 matches
   - Check: Each player appears in exactly 1 match
   - ✅ Pass if no player appears twice

#### Step 2: Test Ranker Progression (Objective 2)
1. **Round 1**: Click on players to set winners
   - Example: Player 1 wins, Player 2 wins, Player 4 wins
2. **Check Standings**: After completing Round 1
   - Winners should have 1 point
   - Losers should have 0 points
   - Verify ranking updates
3. **Round 2**: Complete all matches
4. **Verify Semi-Final (Round 3)**:
   - Should unlock after Round 2 complete
   - Should show exactly 2 matches (4 players)
   - ✅ Pass if top 4 players by points advance

#### Step 3: Verify Third Place & Rankings (Objective 3)
1. Complete Semi-Final matches
2. **Check Round 4**: Third Place Match
   - Should appear after Semi-Final
   - Should have 2 players (semi-final losers)
3. **Check Round 5**: Final
   - Should have 2 players (semi-final winners)
4. Complete both Round 4 and Round 5
5. **Verify Final Rankings**:
   - 🥇 Champion (final winner)
   - 🥈 Runner-up (final loser)
   - 🥉 Third Place (third place match winner)
   - 4th Place (third place match loser)
   - 5th Place (lowest ranked player not in semi-finals)
   - ✅ Pass if all positions correct

---

### Scenario 2: 10-Player Tournament (Comprehensive Test)

**Objective**: Verify bracket logic and seeding

#### Expected Round Structure:
```
Round 1: Swiss (10 players) → 5 matches
Round 2: Swiss (10 players) → 5 matches
Round 3: Quarter-Final (top 8) → 4 matches
Round 4: Semi-Final (top 4) → 2 matches
Round 5: Third Place (semi losers) → 1 match
Round 6: Final (semi winners) → 1 match
```

#### Test Checklist:
- [ ] Round 1: All 10 players play once
- [ ] Round 2: All 10 players play once (different pairings)
- [ ] Round 3: Exactly 8 players (verify by standings)
- [ ] Round 3: Bracket seeding correct (1v8, 4v5, 2v7, 3v6)
- [ ] Round 4: Top 4 from quarter-finals
- [ ] Round 5: Semi-final losers compete
- [ ] Round 6: Semi-final winners compete
- [ ] Final Rankings: All 10 players ranked 1-10

---

### Scenario 3: Standings Validation

**Objective**: Verify standings calculation logic

#### Test Points Calculation:
1. Start any tournament
2. Complete matches with known winners
3. **Verify Standings After Each Round**:
   - Winner gets +1 point
   - Loser gets 0 points
   - Wins/Losses count increments
   - Matches played increments

#### Example Test Case (5-Player Round 1):
```
Match 1: Player 1 vs Player 2 → Player 1 wins
  Expected: Player 1: 1 point, 1W-0L-0D
            Player 2: 0 points, 0W-1L-0D

Match 2: Player 3 vs Player 4 → Player 3 wins
  Expected: Player 3: 1 point, 1W-0L-0D
            Player 4: 0 points, 0W-1L-0D

Match 3: Player 5 gets BYE
  Expected: Player 5: 0 points, 0W-0L-0D
```

#### Verify Ranking:
- [ ] Players sorted by points (descending)
- [ ] Ties broken by rating (higher rating first)
- [ ] Rank numbers 1, 2, 3, etc. assigned correctly

---

### Scenario 4: Export & Reset

**Objective**: Test utility functions

#### Export Results:
1. Complete any tournament
2. Click "💾 Export Results"
3. **Verify JSON file contains**:
   - Tournament name
   - Player count
   - All match results
   - Final standings
   - Round completion status

#### Reset Functionality:
1. Complete some matches (don't finish tournament)
2. Click "🔄 Reset Winners"
3. Confirm dialog
4. **Verify**:
   - All winners cleared
   - Standings reset to 0
   - Rounds locked again (except Round 1)
   - Podium hidden

---

## 🐛 Edge Cases to Test

### Edge Case 1: Odd Number of Players
- **Tournament**: 5 players
- **Expected**: Some rounds may have BYE
- **Verify**: BYE matches marked correctly, not clickable

### Edge Case 2: Toggle Standings During Play
1. Complete 2-3 matches
2. Click "Toggle Standings" multiple times
3. **Verify**: Standings show/hide correctly, no data loss

### Edge Case 3: Incomplete Tournament
- Complete only first 2 rounds
- **Verify**:
  - Later rounds stay locked
  - No podium displayed
  - Can still export partial results

### Edge Case 4: Rapid Winner Changes
1. Click to set Player 1 as winner
2. Immediately click Player 2 as winner (toggle)
3. **Verify**:
  - Standings update correctly
  - UI reflects current state
  - No duplicate counting

---

## ✅ Validation Criteria

### Objective 1: Equal Contribution ✅
```
✓ Each player plays exactly 1 match per Swiss round
✓ No player appears twice in same round
✓ Match count matches expected value
```

### Objective 2: Ranker Progression ✅
```
✓ Standings calculated correctly (points, W-L-D)
✓ Top-K players advance to elimination rounds
✓ Bracket seeding follows proper format
✓ Semi-final has top 4 players
```

### Objective 3: Final Rankings ✅
```
✓ Third place match exists
✓ All players receive final ranking
✓ Top 4 determined by match results
✓ Remaining players ranked by standings
✓ Podium displays correctly (🥇🥈🥉)
```

---

## 📊 Expected Results Summary

### 3-Player Tournament
| Round | Type | Players | Matches |
|-------|------|---------|---------|
| 1 | Swiss | 3 | 1-2 |
| 2 | Swiss | 3 | 1-2 |
| 3 | Final | 2 | 1 |

### 5-Player Tournament
| Round | Type | Players | Matches |
|-------|------|---------|---------|
| 1 | Swiss | 5 | 2-3 |
| 2 | Swiss | 5 | 2-3 |
| 3 | Semi-Final | 4 | 2 |
| 4 | Third Place | 2 | 1 |
| 5 | Final | 2 | 1 |

### 10-Player Tournament
| Round | Type | Players | Matches |
|-------|------|---------|---------|
| 1 | Swiss | 10 | 5 |
| 2 | Swiss | 10 | 5 |
| 3 | Quarter-Final | 8 | 4 |
| 4 | Semi-Final | 4 | 2 |
| 5 | Third Place | 2 | 1 |
| 6 | Final | 2 | 1 |

### 50-Player Tournament
| Round | Type | Players | Matches |
|-------|------|---------|---------|
| 1 | Swiss | 50 | 25 |
| 2 | Swiss | 50 | 25 |
| 3 | Swiss | 50 | 25 |
| 4 | Round of 16 | 16 | 8 |
| 5 | Quarter-Final | 8 | 4 |
| 6 | Semi-Final | 4 | 2 |
| 7 | Third Place | 2 | 1 |
| 8 | Final | 2 | 1 |

---

## 🚨 Known Issues & Limitations

### Current Limitations:
1. **Draws Not Supported**: Winner must be selected (no draw option)
2. **Manual Third Place Selection**: Third place participants currently selected by rating, not by semi-final losers tracking
3. **No Undo**: Once exported, cannot import results back

### Future Enhancements:
- [ ] Add draw support (0.5 points each)
- [ ] Track semi-final losers explicitly for third place
- [ ] Import previous results feature
- [ ] Real-time multi-user support
- [ ] Mobile-responsive improvements

---

## 💡 Tips for Testing

1. **Start Small**: Test 5-player tournament first to understand flow
2. **Check Standings**: Toggle standings after every round to verify calculations
3. **Screenshot Podium**: Capture final results for documentation
4. **Test Reset**: Use reset frequently to test different scenarios
5. **Export Early**: Export results mid-tournament to test partial data

---

## 🎯 Success Criteria

Your testing is successful if you can verify:

✅ **Objective 1**: Every player plays exactly once per Swiss round
✅ **Objective 2**: Only top-ranked players advance to elimination rounds
✅ **Objective 3**: Third place match exists AND full rankings displayed

If all three objectives pass, the implementation is correct! 🎉
