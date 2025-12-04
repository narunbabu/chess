# Tournament System Violations and Required Fixes

**Date**: 2025-12-03
**Status**: Action Required
**Reference**: See `TOURNAMENT_PRINCIPLES.md` for full principles

---

## Summary

The current tournament system violates core principle: **Elimination rounds have pre-assigned players instead of using placeholders**.

---

## Violations Identified

### 1. ❌ Test Data Files - Pre-assigned Elimination Round Players

**Files Affected**:
- `chess-backend/public/tournament_test_3_players.json`
- `chess-backend/public/tournament_test_5_players.json` (likely)
- `chess-backend/public/tournament_test_10_players.json` (likely)
- `chess-backend/public/tournament_test_50_players.json` (likely)

**Current State** (`tournament_test_3_players.json` Round 3):
```json
{
  "round_number": 3,
  "type": "final",
  "matches": [
    {
      "id": 42,
      "player1": {                    // ❌ VIOLATION
        "id": 5,
        "name": "Test Player 1"
      },
      "player2": {                    // ❌ VIOLATION
        "id": 6,
        "name": "Test Player 2"
      },
      "round_type": "final"
    }
  ]
}
```

**Required State**:
```json
{
  "round_number": 3,
  "type": "final",
  "matches": [
    {
      "id": 42,
      "player1_id": null,                    // ✅ NULL
      "player2_id": null,                    // ✅ NULL
      "player1": null,                       // ✅ NULL
      "player2": null,                       // ✅ NULL
      "is_placeholder": true,                // ✅ Required
      "requires_top_k": 2,                   // ✅ Required
      "determined_by_round": 2,              // ✅ Required
      "player1_bracket_position": 1,         // ✅ Required
      "player2_bracket_position": 2,         // ✅ Required
      "round_type": "final"
    }
  ]
}
```

---

### 2. ❌ Frontend Visualizer - No Dynamic Resolution

**File**: `chess-backend/public/tournament_visualizer_v3.html`

**Issue**: The `resolveMatchParticipants()` function exists but doesn't properly handle placeholder resolution for the initial rounds.

**Current Behavior**:
- Shows pre-assigned players from JSON
- Doesn't check if elimination rounds should be locked
- Doesn't show "TBD" for locked elimination rounds

**Required Behavior**:
- Check if round should be unlocked based on previous rounds
- Show "TBD" for elimination rounds until Swiss rounds complete
- Dynamically resolve players from standings when unlocked

---

### 3. ⚠️ Backend Service - Needs Verification

**File**: `chess-backend/app/Services/TournamentGenerationService.php`

**Needs Verification**:
- Does `generateFullTournament()` create placeholder matches for elimination rounds?
- Does it set `is_placeholder = true` for elimination rounds?
- Does it populate placeholder metadata fields?

**If NOT**: Backend needs fixes to generate proper placeholder matches.

---

## Required Fixes

### Fix 1: Update Test Data Files

**Priority**: HIGH
**Impact**: Immediate - Affects visualizer display

#### Fix tournament_test_3_players.json

**Round 3 (Final)**:
```json
{
  "round_number": 3,
  "name": "Final",
  "type": "final",
  "matches": [
    {
      "id": 42,
      "round_number": 3,
      "player1_id": null,
      "player2_id": null,
      "player1": null,
      "player2": null,
      "winner_id": null,
      "is_placeholder": true,
      "requires_top_k": 2,
      "determined_by_round": 2,
      "player1_bracket_position": 1,
      "player2_bracket_position": 2,
      "round_type": "final"
    }
  ]
}
```

#### Similarly fix other test files:

**5-Player Tournament**:
- Round 3 (Semi-Final): `requires_top_k: 4`, placeholders
- Round 4 (Third Place): Determined by Round 3 losers
- Round 5 (Final): Determined by Round 3 winners

**10-Player Tournament**:
- Round 3 (Quarter-Final): `requires_top_k: 8`, placeholders
- Round 4 (Semi-Final): `requires_top_k: 4`, placeholders
- Round 5 (Third Place): Determined by Round 4 losers
- Round 6 (Final): Determined by Round 4 winners

**50-Player Tournament**:
- Round 4 (Round of 16): `requires_top_k: 16`, placeholders
- Round 5 (Quarter-Final): `requires_top_k: 8`, placeholders
- Round 6 (Semi-Final): `requires_top_k: 4`, placeholders
- Round 7 (Third Place): Determined by Round 6 losers
- Round 8 (Final): Determined by Round 6 winners

---

### Fix 2: Update Frontend Visualizer

**Priority**: HIGH
**Impact**: User-facing display

#### Update resolveMatchParticipants() function

**Current Location**: `tournament_visualizer_v3.html:798`

**Required Changes**:

1. **Add Round Unlocking Check**:
```javascript
function shouldRoundUnlock(roundNumber, completedMatches) {
  if (roundNumber === 1) return true; // Round 1 always unlocked

  // Get the round
  const round = currentTournament.rounds.find(r => r.round_number === roundNumber);
  if (!round) return false;

  if (round.type === 'swiss') {
    // Swiss round unlocks when previous round complete
    const previousRound = currentTournament.rounds.find(r => r.round_number === roundNumber - 1);
    return previousRound.matches.every(m => matchResults[m.id] !== undefined);
  }

  // Elimination round - check if determined_by_round is complete
  if (match.determined_by_round) {
    const requiredRound = currentTournament.rounds.find(r => r.round_number === match.determined_by_round);
    if (!requiredRound) return false;
    return requiredRound.matches.every(m => matchResults[m.id] !== undefined);
  }

  return false;
}
```

2. **Update Player Resolution Logic**:
```javascript
function resolveMatchParticipants(match) {
  if (!match.is_placeholder) {
    // Swiss round - already has players
    return {
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      isResolved: true
    };
  }

  // Check if round is unlocked
  const isUnlocked = shouldRoundUnlock(match.round_number, matchResults);

  if (!isUnlocked) {
    // Round locked - show TBD
    return {
      player1_id: null,
      player2_id: null,
      isResolved: false,
      lockReason: `Waiting for Round ${match.determined_by_round} to complete`
    };
  }

  // Elimination round - resolve from standings
  const standings = calculateStandings(currentTournament.matches, currentTournament.participants);

  if (match.requires_top_k) {
    // Resolve from top K standings
    const topK = getTopKPlayers(standings, match.requires_top_k);

    const player1 = topK[match.player1_bracket_position - 1];
    const player2 = topK[match.player2_bracket_position - 1];

    return {
      player1_id: player1?.id || null,
      player2_id: player2?.id || null,
      isResolved: true
    };
  }

  // Round determined by winners - need to resolve from match results
  // TODO: Implement winner-based resolution

  return {
    player1_id: null,
    player2_id: null,
    isResolved: false
  };
}
```

3. **Update createPlayerElement() to Show TBD with Lock Reason**:
```javascript
function createPlayerElement(player, match, isLocked, lockReason) {
  if (!player) {
    return `
      <div class="player tbd">
        <div class="player-info">
          <div class="player-name">TBD</div>
          <div class="player-rating">${lockReason || 'Waiting for previous round'}</div>
        </div>
      </div>
    `;
  }

  // Rest of function...
}
```

---

### Fix 3: Verify/Update Backend Service

**Priority**: MEDIUM
**Impact**: Data generation for real tournaments

#### Check TournamentGenerationService.php

**Method**: `generateFullTournament()` (lines 40-109)

**Required Verification**:
1. Does it create matches with `is_placeholder = true` for elimination rounds?
2. Does it set `player1_id = null` and `player2_id = null` for elimination rounds?
3. Does it populate metadata fields (`requires_top_k`, `determined_by_round`, bracket positions)?

**If NO**:

Need to update the elimination round generation logic:

```php
private function generateEliminationRound($championship, $roundNumber, $roundType, $topK) {
    $matches = [];

    // Create placeholder matches
    $matchCount = $topK / 2;

    for ($i = 0; $i < $matchCount; $i++) {
        $matches[] = ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'player1_id' => null,  // ✅ NULL
            'player2_id' => null,  // ✅ NULL
            'winner_id' => null,
            'is_placeholder' => true,  // ✅ Placeholder
            'requires_top_k' => $topK,
            'determined_by_round' => $this->getLastSwissRound($championship),
            'player1_bracket_position' => $this->getBracketPosition($i, 'player1', $topK),
            'player2_bracket_position' => $this->getBracketPosition($i, 'player2', $topK),
            'round_type' => $roundType,
        ]);
    }

    return $matches;
}
```

---

## Testing Plan

### Test 1: 3-Player Tournament Visualizer

**Steps**:
1. Load `tournament_test_3_players.json`
2. Verify Round 1 shows actual players
3. Verify Round 2 shows actual players
4. Verify Round 3 shows "TBD vs TBD" with message "Waiting for Round 2 to complete"
5. Complete Round 1 match
6. Complete Round 2 match
7. Verify Round 3 NOW shows "Test Player 1 vs Test Player 2" (dynamically resolved from standings)
8. Click winner in Round 3
9. Verify final rankings show correctly

**Expected Behavior**:
- ✅ Round 1: Shows players immediately
- ✅ Round 2: Shows players immediately
- ✅ Round 3 (before completion): Shows "TBD vs TBD"
- ✅ Round 3 (after Swiss complete): Shows top 2 players by standings

### Test 2: 10-Player Tournament

**Steps**:
1. Complete all Round 1 and Round 2 matches
2. Verify standings calculation is correct
3. Verify Quarter-Finals show top 8 players with proper seeding (1v8, 2v7, 3v6, 4v5)
4. Complete Quarter-Finals
5. Verify Semi-Finals show correct top 4
6. Complete Semi-Finals
7. Verify Final and Third Place matches show correct players

---

## Implementation Order

1. **Update test data files** (30 minutes)
   - Fix all 4 test JSON files with proper placeholders

2. **Update frontend visualizer** (1 hour)
   - Implement round unlocking logic
   - Update player resolution logic
   - Update TBD display with lock reasons

3. **Verify backend service** (30 minutes)
   - Check if backend generates proper placeholders
   - Fix if needed

4. **End-to-end testing** (1 hour)
   - Test all tournament sizes
   - Verify Swiss → Elimination flow
   - Verify dynamic resolution works correctly

**Total Estimated Time**: 3 hours

---

## Success Criteria

- [ ] All test JSON files use placeholders for elimination rounds
- [ ] Visualizer shows "TBD" for locked elimination rounds
- [ ] Visualizer dynamically resolves players when rounds unlock
- [ ] Seeding follows correct bracket pattern (1v8, 2v7, etc.)
- [ ] Backend generates proper placeholder matches
- [ ] End-to-end flow works: Swiss → Calculate Standings → Seed Elimination → Play Finals

---

## References

- **Principles**: `docs/TOURNAMENT_PRINCIPLES.md`
- **Backend Service**: `chess-backend/app/Services/TournamentGenerationService.php`
- **Frontend Visualizer**: `chess-backend/public/tournament_visualizer_v3.html`
- **Test Data**: `chess-backend/public/tournament_test_*.json`
