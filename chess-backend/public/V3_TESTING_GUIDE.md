# Tournament Visualizer v3 - Testing Guide

**Date**: 2025-12-03
**Version**: v3.0
**Purpose**: Guide for testing dynamic placeholder resolution in tournaments

---

## 🎯 Overview

This guide covers testing the v3 tournament system with proper placeholder match handling and dynamic player resolution based on standings.

### Key Features to Test

1. **Round 1 (Swiss)**: Pre-determined player matches
2. **Round 2+ (Elimination)**: Placeholder matches that resolve dynamically
3. **Dynamic Resolution**: Players assigned based on current standings
4. **Visual Indicators**: "TBD (Rank #N)" for locked matches
5. **Real-time Updates**: Match resolution when prerequisites complete

---

## 📂 Test Files

All test files are located in: `/chess-backend/public/`

### Available Test Configurations

| File | Players | Swiss Rounds | Elimination Rounds | Total Matches |
|------|---------|--------------|-------------------|---------------|
| `tournament_test_3_players_v3.json` | 3 | 1 | 1 (Final) | 3 |
| `tournament_test_5_players_v3.json` | 5 | 1 | 2 (Semi + Final) | 5 |
| `tournament_test_10_players_v3.json` | 10 | 2 | 4 (QF + SF + 3rd + Final) | 9 |
| `tournament_test_50_players_v3.json` | 50 | 2 | 6 (R32 + R16 + QF + SF + 3rd + Final) | 34 |

---

## 🚀 How to Test

### Method 1: Quick Load Buttons (Recommended)

1. Open the tournament visualizer:
   ```
   http://localhost:8000/tournament_visualizer_v3.html
   ```

2. Use the **Quick Load v3 Test Files** buttons:
   - Click "3 Players" for small tournament test
   - Click "5 Players" for medium tournament test
   - Click "10 Players" for comprehensive test
   - Click "50 Players" for large-scale test

### Method 2: Direct File Access

1. Navigate directly to test files:
   ```
   http://localhost:8000/tournament_test_3_players_v3.json
   http://localhost:8000/tournament_test_5_players_v3.json
   http://localhost:8000/tournament_test_10_players_v3.json
   http://localhost:8000/tournament_test_50_players_v3.json
   ```

2. Copy JSON and test with backend API

### Method 3: Old Selector (Still Works)

1. Use the dropdown selector at the top
2. Select tournament size (3, 5, 10, or 50)
3. Click "📊 Load Tournament"
4. Note: This loads v2 format, not the new v3 format

---

## 🧪 Test Scenarios

### Scenario 1: 3-Player Tournament (Basic)

**File**: `tournament_test_3_players_v3.json`

**Structure**:
```
Round 1 (Swiss):
  - Match 1: Alice vs Bob (COMPLETED - White wins)
  - Match 2: Charlie vs Bye (COMPLETED - Bye wins)

Round 2 (Final):
  - Match 1: TBD (Rank #1) vs TBD (Rank #2) [PLACEHOLDER]
```

**Expected Behavior**:
1. Load the 3-player tournament
2. Round 1 shows:
   - ✅ Alice vs Bob (completed, white won)
   - ✅ Charlie vs Bye (completed, bye won)
3. Round 2 shows:
   - 🔒 "TBD (Rank #1) vs TBD (Rank #2)"
   - Match is locked (gray background)
   - Can't select winner yet

**Test Actions**:
1. Check standings after Round 1
2. Verify Alice and Charlie are top 2
3. Complete any pending matches in Round 1
4. Check if Round 2 unlocks
5. Verify Round 2 now shows "Alice vs Charlie"
6. Select winner for final match
7. Verify tournament completion

---

### Scenario 2: 5-Player Tournament (Medium)

**File**: `tournament_test_5_players_v3.json`

**Structure**:
```
Round 1 (Swiss):
  - 3 matches with mixed completion states

Round 2 (Semi Finals):
  - 2 placeholder matches (top 4 players)

Round 3 (Final):
  - 1 placeholder match (top 2 from Round 2)
```

**Expected Behavior**:
1. Round 1 has some completed, some pending matches
2. Round 2 shows placeholder matches:
   - "TBD (Rank #1) vs TBD (Rank #4)"
   - "TBD (Rank #2) vs TBD (Rank #3)"
3. As you complete Round 1 matches, standings update
4. When Round 1 complete, Round 2 unlocks with actual names
5. Complete Round 2, Round 3 unlocks with finalists

**Test Actions**:
1. Load 5-player tournament
2. Complete all pending Round 1 matches
3. Verify Round 2 unlocks and shows correct top 4
4. Complete semi-final matches
5. Verify final shows correct top 2 from semi-finals
6. Complete final and verify winner

---

### Scenario 3: 10-Player Tournament (Complex)

**File**: `tournament_test_10_players_v3.json`

**Structure**:
```
Round 1 (Swiss): 5 matches (4 completed, 1 pending)
Round 2 (Swiss): 5 matches (all pending)
Round 3 (Quarter Finals): 4 placeholder matches (top 8)
Round 4 (Semi Finals): 2 placeholder matches (top 4)
Round 5 (Third Place): 1 placeholder match (semi losers)
Round 6 (Final): 1 placeholder match (semi winners)
```

**Expected Behavior**:
1. Round 1 mostly complete, Round 2 locked initially
2. Complete Round 1 → Round 2 unlocks
3. Round 3-6 remain locked (gray background)
4. Complete Round 2 → Round 3 unlocks with top 8
5. Complete Quarter Finals → Semis unlock with winners
6. Complete Semis → Both 3rd place and Final unlock
7. Third place shows losers from semis
8. Final shows winners from semis

**Test Actions**:
1. Load 10-player tournament
2. Verify progressive unlock mechanism
3. Test standings calculation across multiple Swiss rounds
4. Verify bracket position assignment (1-8 for quarters)
5. Test third-place match gets correct losers
6. Verify final gets correct winners
7. Complete all matches and verify final standings

---

### Scenario 4: 50-Player Tournament (Large Scale)

**File**: `tournament_test_50_players_v3.json`

**Structure**:
```
Round 1 (Swiss): 25 matches (10 completed, 15 pending)
Round 2 (Swiss): 25 matches (all pending)
Round 3 (Round of 32): 16 placeholder matches (top 32)
Round 4 (Round of 16): 8 placeholder matches
Round 5 (Quarter Finals): 4 placeholder matches
Round 6 (Semi Finals): 2 placeholder matches
Round 7 (Third Place): 1 placeholder match
Round 8 (Final): 1 placeholder match
```

**Expected Behavior**:
1. Large number of matches to test performance
2. Progressive unlock through multiple elimination rounds
3. Standings calculation with 50 players
4. Top 32 selection for Round of 32
5. Proper bracket progression through all elimination rounds

**Test Actions**:
1. Load 50-player tournament
2. Test performance with many matches
3. Complete Swiss rounds and verify top 32 calculation
4. Test progressive elimination bracket unlock
5. Verify performance of dynamic resolution
6. Complete tournament and verify all matches resolved correctly

---

## 🔍 Visual Indicators Reference

### Match States

| State | Visual Indicator | Description |
|-------|------------------|-------------|
| **Locked** | 🔒 Gray background, "TBD (Rank #N)" | Prerequisites not met |
| **Unlocked** | 🔓 White background, actual names | Ready to play |
| **Completed** | ✅ Green background, result shown | Match finished |
| **Pending** | ⏳ White background, no result | Ready but not played |

### Player Display

| Display | Meaning |
|---------|---------|
| **"Alice"** | Actual player (pre-determined or resolved) |
| **"TBD (Rank #1)"** | Placeholder - requires rank 1 player |
| **"Bye"** | Bye match (odd number of players) |

### Round States

| State | Color | Meaning |
|-------|-------|---------|
| **🔓 Unlocked** | Green/Blue | Can play matches |
| **🔒 Locked** | Red | Prerequisites not met |
| **✅ Completed** | Blue | All matches complete |

---

## 📊 Validation Checklist

Use this checklist when testing:

### Data Structure Validation
- [ ] Placeholder matches have `is_placeholder: true`
- [ ] Placeholder matches have `player1_id: null` and `player2_id: null`
- [ ] Bracket positions are set correctly (1-N)
- [ ] `requires_top_k` value is correct
- [ ] `determined_by_round` references correct round
- [ ] `match_type` is set appropriately

### Functionality Validation
- [ ] Round 1 shows actual player names
- [ ] Elimination rounds show "TBD (Rank #N)" when locked
- [ ] Standings update correctly after each match
- [ ] Placeholder matches resolve when prerequisites met
- [ ] Third-place match gets correct losers
- [ ] Final match gets correct winners
- [ ] Winner selection works correctly
- [ ] "Reset All Winners" button works

### Visual Validation
- [ ] Locked matches have gray background
- [ ] Unlocked matches have white background
- [ ] Completed matches have green background
- [ ] Player names display correctly
- [ ] Standings table updates in real-time
- [ ] Match numbers are sequential
- [ ] Round headers show correct type and status

### Performance Validation
- [ ] Large tournaments (50 players) load quickly
- [ ] Match resolution is instant
- [ ] No console errors
- [ ] Smooth scrolling and interaction
- [ ] Export functionality works

---

## 🐛 Common Issues and Solutions

### Issue 1: Placeholder Matches Show "null vs null"

**Cause**: Frontend not detecting placeholder matches
**Solution**: Verify `is_placeholder: true` in JSON

### Issue 2: Round Doesn't Unlock After Completion

**Cause**: Prerequisites not met or detection logic error
**Solution**: Check `determined_by_round` value and standings calculation

### Issue 3: Wrong Players in Elimination Rounds

**Cause**: Standings calculation or bracket position error
**Solution**: Verify Swiss round results and points calculation

### Issue 4: Third Place Match Has Wrong Players

**Cause**: Not using semi-final losers
**Solution**: Check `match_type: "third_place"` and loser detection

### Issue 5: "TBD" Not Showing Rank Numbers

**Cause**: Missing `player1_bracket_position` or `player2_bracket_position`
**Solution**: Add bracket position values to match metadata

---

## 📝 Testing Notes Template

Use this template to document your testing:

```markdown
## Test Session: [Date/Time]

### Configuration
- Test File: tournament_test_X_players_v3.json
- Browser: [Chrome/Firefox/Safari]
- Environment: [Local/Dev/Prod]

### Test Results

#### Round 1 (Swiss)
- [ ] All matches loaded correctly
- [ ] Completed matches show results
- [ ] Pending matches are playable
- [ ] Standings update correctly
- Notes:

#### Round 2+ (Elimination)
- [ ] Placeholder matches show "TBD"
- [ ] Locked state displays correctly
- [ ] Unlocking works when prerequisites met
- [ ] Player resolution is correct
- Notes:

#### Visual & UX
- [ ] Colors and styling correct
- [ ] Responsive design works
- [ ] No console errors
- [ ] Performance acceptable
- Notes:

### Issues Found
1.
2.
3.

### Recommendations
1.
2.
3.
```

---

## 🎯 Success Criteria

A test is considered successful when:

1. ✅ All placeholder matches load with "TBD (Rank #N)"
2. ✅ Locked matches have gray background and can't be interacted with
3. ✅ Unlocking happens automatically when prerequisites met
4. ✅ Dynamic resolution shows correct players from standings
5. ✅ Third-place match gets semi-final losers
6. ✅ Final match gets semi-final winners
7. ✅ No console errors
8. ✅ Visual indicators match expected states
9. ✅ Standings calculate correctly
10. ✅ Tournament can be completed end-to-end

---

## 🔗 Related Documentation

- **Backend Implementation**: `docs/BACKEND_FIXES_COMPLETED.md`
- **Tournament Principles**: `docs/TOURNAMENT_PRINCIPLES.md`
- **Frontend Integration**: `docs/Tournament_Frontend_Integration_Guide.md`
- **Complete Summary**: `docs/Tournament_Implementation_Complete.md`
- **Violations & Fixes**: `docs/TOURNAMENT_VIOLATIONS_AND_FIXES.md`

---

## 📞 Support

If you encounter issues:

1. Check browser console for errors
2. Verify JSON structure matches expected format
3. Review tournament principles in documentation
4. Compare with working test files
5. Create issue with reproduction steps

---

**Happy Testing! 🚀**
