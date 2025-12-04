# Complete TBD Placeholder System Fix

## Problem Statement

Subsequent round matches were showing assigned players even when the previous round was incomplete, violating tournament rules that require:
- **ALL matches in a round must complete before next round becomes playable**
- **TBD placeholder state must persist until prerequisites are met**

### Example Issue (Tournament #24)
```
Round 1: 3 matches (2 completed, 1 pending) ❌
Round 2: 2 matches (players already assigned!) ❌ WRONG!
```

Expected:
```
Round 1: 3 matches (2 completed, 1 pending) ✅
Round 2: 2 matches (TBD - not playable yet) ✅ CORRECT!
```

## Root Cause

The `TournamentGenerationService` was calling `swissService->generatePairings()` for **ALL** Swiss rounds at tournament creation time, which generated actual player assignments instead of TBD placeholders.

## Solution: Complete TBD Placeholder System

### Architecture Overview

**3-Tier TBD System:**
1. **Tournament Generation**: Create ALL rounds with placeholders
2. **Round Progression**: Detect round completion and trigger assignment
3. **Placeholder Assignment**: Assign players using appropriate algorithm

### Implementation Details

#### 1. Tournament Generation (TournamentGenerationService.php)

**Lines 76-104:** Generate all rounds upfront
```php
DB::transaction(function () use ($championship, $config, $participants, &$pairHistory, &$summary) {
    // Generate ALL rounds upfront
    // Swiss rounds: Create placeholder matches (except Round 1)
    // Elimination rounds: Create placeholder matches with rank positions
    foreach ($config->roundStructure as $roundConfig) {
        $roundNumber = $roundConfig['round'];

        $roundSummary = $this->generateRound(
            $championship,
            $roundNumber,
            $roundConfig,
            $participants,
            $pairHistory
        );

        $summary['rounds'][] = $roundSummary;
        $summary['total_matches'] += $roundSummary['matches_created'];
    }
});
```

**Lines 282-290:** Swiss placeholder detection
```php
// 🎯 CRITICAL FIX: For Swiss rounds beyond Round 1, create placeholder pairings
// These will be assigned dynamically when the previous round completes
if ($method === TournamentConfig::PAIRING_SWISS && $roundNumber > 1) {
    Log::info("Creating placeholder pairings for Swiss round", [
        'championship_id' => $championship->id,
        'round_number' => $roundNumber,
    ]);
    return $this->generateSwissPlaceholderPairings($participants->count());
}
```

**Lines 343-364:** Generate Swiss placeholder pairings
```php
private function generateSwissPlaceholderPairings(int $participantCount): array
{
    $matchCount = (int)floor($participantCount / 2);
    $pairings = [];

    // Create placeholder matches (will be assigned based on Swiss pairings later)
    for ($i = 0; $i < $matchCount; $i++) {
        $pairings[] = [
            'is_placeholder' => true,
            'player1_rank' => null, // Will be determined by Swiss algorithm
            'player2_rank' => null,
            'match_index' => $i + 1,
        ];
    }

    return $pairings;
}
```

#### 2. Round Progression (ChampionshipRoundProgressionService.php)

**Lines 180-242:** Smart placeholder assignment with prerequisite checking
```php
private function assignPlaceholderMatchesForRound(Championship $championship, int $roundNumber): array
{
    // Check if placeholders exist
    if (!$this->placeholderService->hasUnassignedPlaceholders($championship, $roundNumber)) {
        return ['assigned_count' => 0, 'matches' => []];
    }

    // 🎯 ELIMINATION ROUNDS: Only assign after ALL Swiss rounds complete
    if ($this->isEliminationRound($championship, $roundNumber)) {
        if (!$this->areAllSwissRoundsComplete($championship)) {
            return [
                'assigned_count' => 0,
                'matches' => [],
                'reason' => 'swiss_rounds_incomplete',
            ];
        }
    }
    // 🎯 SWISS ROUNDS: Only assign after previous round completes
    else {
        $previousRound = $roundNumber - 1;
        if ($previousRound > 0) {
            if (!$this->isRoundComplete($championship, $previousRound)) {
                return [
                    'assigned_count' => 0,
                    'matches' => [],
                    'reason' => 'previous_round_incomplete',
                ];
            }
        }
    }

    // Prerequisites met - assign players
    return $this->placeholderService->assignPlayersToPlaceholderMatches($championship, $roundNumber);
}
```

#### 3. Placeholder Assignment (PlaceholderMatchAssignmentService.php)

**Lines 57-67:** Detect Swiss vs Elimination rounds
```php
// 🎯 NEW: Check if this is a Swiss round - use Swiss pairing algorithm
$firstMatch = $placeholderMatches->first();
$roundType = $firstMatch->getRoundTypeEnum();

if ($roundType && $roundType->value === 'swiss') {
    Log::info("Swiss round placeholder detected - using Swiss pairing algorithm");
    return $this->assignSwissRoundPlaceholders($championship, $roundNumber, $placeholderMatches);
}

// For elimination rounds, use rank-based assignment
$standings = $this->getCurrentStandings($championship);
```

**Lines 236-330:** Swiss round placeholder assignment
```php
private function assignSwissRoundPlaceholders(
    Championship $championship,
    int $roundNumber,
    Collection $placeholderMatches
): array {
    // Generate Swiss pairings for this round
    $pairings = $this->swissService->generatePairings($championship, $roundNumber);

    $assignedCount = 0;
    $assignmentDetails = [];

    // Assign pairings to placeholder matches
    foreach ($placeholderMatches as $index => $match) {
        $pairing = $pairings[$index];

        $player1Id = $pairing['player1_id'];
        $player2Id = $pairing['player2_id'];

        // Assign colors
        $colors = $this->swissService->assignColorsPub($championship, $player1Id, $player2Id);

        // Assign players to the match
        $match->assignPlaceholderPlayers(
            $player1Id,
            $player2Id,
            $colors['white'],
            $colors['black']
        );

        $assignedCount++;
    }

    return [
        'assigned_count' => $assignedCount,
        'matches' => $assignmentDetails,
    ];
}
```

## Expected Behavior

### Tournament Creation (5 players, 3 Swiss rounds)

```
✅ Tournament Created
  Round 1 (Swiss): 3 matches with assigned players (playable immediately)
  Round 2 (Swiss): 2 placeholder matches (TBD - not playable)
  Round 3 (Swiss): 1 placeholder match (TBD - not playable)
```

### Round 1: Partial Completion (2 out of 3 matches)

```
Round 1: ⚠️ 2/3 complete (1 pending)
Round 2: ❌ Still TBD (previous round incomplete)
Round 3: ❌ Still TBD
```

**System Check:**
- `assignPlaceholderMatchesForRound(championship, 2)` called
- `isRoundComplete(championship, 1)` → returns `false`
- Assignment skipped with reason: `previous_round_incomplete`

### Round 1: Full Completion (all 3 matches)

```
Round 1: ✅ 3/3 complete
Round 2: ✅ Players assigned via Swiss algorithm (now playable!)
Round 3: ❌ Still TBD (Round 2 incomplete)
```

**System Check:**
- `assignPlaceholderMatchesForRound(championship, 2)` called
- `isRoundComplete(championship, 1)` → returns `true`
- `assignSwissRoundPlaceholders()` called
- `swissService->generatePairings(championship, 2)` generates pairings based on Round 1 results
- Players assigned to Round 2 placeholder matches

### Round 2: Full Completion (all 2 matches)

```
Round 1: ✅ Complete
Round 2: ✅ Complete
Round 3: ✅ Players assigned (now playable!)
```

**System Check:**
- `assignPlaceholderMatchesForRound(championship, 3)` called
- `isRoundComplete(championship, 2)` → returns `true`
- Round 3 placeholder matches assigned via Swiss algorithm

## Key Design Principles

### 1. Pre-Generation with Deferred Assignment
- **All rounds created at tournament start** (structure is known)
- **Assignments happen dynamically** (pairings depend on results)

### 2. Round Type Awareness
- **Swiss Rounds**: Use Swiss pairing algorithm (based on standings)
- **Elimination Rounds**: Use rank-based assignment (top K players)

### 3. Prerequisite Validation
- **Swiss Rounds**: Previous round must complete
- **Elimination Rounds**: ALL Swiss rounds must complete

### 4. Atomic Round Completion
- Round is NOT complete until **every match** has `status = COMPLETED`
- Partial completion does NOT trigger next round assignment

## Benefits

✅ **Tournament Rules Compliance**: Next round only becomes playable when current round completes
✅ **TBD State Preservation**: Matches stay as TBD until prerequisites met
✅ **Fair Pairings**: Swiss algorithm uses complete round results, not partial
✅ **Clear User Experience**: Users see TBD placeholders, know matches aren't ready
✅ **Flexible Architecture**: Supports multiple tournament formats
✅ **Backward Compatible**: Existing elimination round logic preserved

## Testing Checklist

### Test Case 1: 5-Player Tournament (3 Swiss Rounds)

1. **Create Tournament**
   - ✅ Round 1: 3 matches assigned
   - ✅ Round 2: 2 TBD matches
   - ✅ Round 3: 1 TBD match

2. **Complete 2 out of 3 Round 1 Matches**
   - ✅ Round 2 stays TBD
   - ✅ Round 3 stays TBD

3. **Complete Final Round 1 Match**
   - ✅ Round 2 assigned via Swiss algorithm
   - ✅ Round 3 stays TBD

4. **Complete All Round 2 Matches**
   - ✅ Round 3 assigned via Swiss algorithm
   - ✅ Final match playable

### Test Case 2: 10-Player Tournament (2 Swiss + Quarter Final)

1. **Create Tournament**
   - ✅ Round 1 (Swiss): 5 matches assigned
   - ✅ Round 2 (Swiss): 5 TBD matches
   - ✅ Round 3 (Quarter Final): 4 TBD matches

2. **Complete Round 1**
   - ✅ Round 2 assigned via Swiss
   - ✅ Round 3 stays TBD (elimination)

3. **Complete Round 2**
   - ✅ All Swiss complete
   - ✅ Round 3 assigned (top 8 players)
   - ✅ Quarter Final playable

## Files Modified

1. **chess-backend/app/Services/TournamentGenerationService.php**
   - Lines 76-104: Restored all-rounds generation
   - Lines 282-290: Swiss placeholder detection
   - Lines 343-364: `generateSwissPlaceholderPairings()` method

2. **chess-backend/app/Services/ChampionshipRoundProgressionService.php**
   - Lines 180-242: Enhanced `assignPlaceholderMatchesForRound()` with prerequisite checking

3. **chess-backend/app/Services/PlaceholderMatchAssignmentService.php**
   - Lines 57-67: Swiss vs elimination detection
   - Lines 111-121: Swiss placeholder handling
   - Lines 236-330: `assignSwissRoundPlaceholders()` method

## Success Criteria

✅ All rounds pre-generated at tournament creation
✅ Swiss Round 2+ shows TBD until previous round completes
✅ Elimination rounds show TBD until all Swiss rounds complete
✅ TBD matches assigned using correct algorithm (Swiss vs rank-based)
✅ No premature round assignments
✅ Clear logging for debugging
✅ Backward compatible with existing tournaments
