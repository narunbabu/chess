# Tournament Configuration Fix - Swiss + Elimination Format

## Problem Identified

The 10-player tournament is being created with **6 rounds using the "Small Tournament" preset** which uses a progressive elimination structure, NOT a proper Swiss + Elimination format.

### Current (Incorrect) Structure for 10 Players, 6 Rounds:

```
Round 1: Dense (all 10 players, 2 matches/player) - NOT Swiss
Round 2: Normal (all 10 players, 2 matches/player) - NOT Swiss
Round 3: Selective (top_k calculated) - 4 matches (8 players) ❌
Round 4: Selective/Semi-final (top 4) - 2 matches ✅
Round 5: Final (top 4) - 2 matches ❌ Should be 1 match with top 2
Round 6: Final (top 2-4) - 1-2 matches ❌ Unnecessary
```

**Issues:**
1. Round 3 only has 4 matches instead of 5 (missing 2 players)
2. Using `top_k` selection which triggers `generatePlaceholderPairings()` instead of Swiss algorithm
3. Round 5 should be finals with only 2 players
4. Round 6 is unnecessary

## Root Cause

File: `app/ValueObjects/TournamentConfig.php`

**Line 219-262**: The `fromPreset()` method with `PRESET_SMALL` calls:
```php
$config->roundStructure = self::generateSmallTournamentStructure($totalRounds, $participantCount);
```

**Line 279-355**: `generateSmallTournamentStructure()` creates a progressive structure that:
- Uses `top_k` participant selection for rounds 3+
- This triggers `isSelectiveRound()` = true
- Which calls `generatePlaceholderPairings()` with `top_k`
- Instead of Swiss pairing algorithm

## Correct Structure for Swiss + Elimination (10 Players)

### Option 1: Pure Swiss (Recommended for 10 players)
**5 Rounds Total:**
```
Round 1: Swiss (all 10 players, 5 matches)
Round 2: Swiss (all 10 players, 5 matches)
Round 3: Swiss (all 10 players, 5 matches)
Round 4: Semi-finals (Top 4 by standings, 2 matches)
Round 5: Finals (Top 2 from semis, 1 match)
```

### Option 2: Extended Swiss + Elimination
**6 Rounds Total:**
```
Round 1: Swiss (all 10 players, 5 matches)
Round 2: Swiss (all 10 players, 5 matches)
Round 3: Swiss (all 10 players, 5 matches)
Round 4: Swiss (all 10 players, 5 matches)
Round 5: Semi-finals (Top 4 by standings, 2 matches)
Round 6: Finals (Top 2 from semis, 1 match)
```

## Solution: Create Hybrid Structure Generator

Add a new method to `TournamentConfig.php`:

```php
/**
 * Generate Swiss + Elimination structure
 *
 * @param int $participantCount Total participants
 * @param int $swissRounds Number of Swiss rounds (default: ceil(log2(N)))
 * @return array Round structure configuration
 */
public static function generateSwissEliminationStructure(int $participantCount, ?int $swissRounds = null): array
{
    // Calculate optimal Swiss rounds if not specified
    if ($swissRounds === null) {
        $swissRounds = (int) ceil(log($participantCount, 2));
    }

    $structure = [];

    // Phase 1: Swiss Rounds (all players)
    for ($round = 1; $round <= $swissRounds; $round++) {
        $structure[] = [
            'round' => $round,
            'type' => 'swiss',  // Mark as Swiss type
            'participant_selection' => 'all',  // All players participate
            'matches_per_player' => 1,
            'pairing_method' => $round === 1 ? self::PAIRING_RANDOM_SEEDED : self::PAIRING_SWISS,
        ];
    }

    // Phase 2: Elimination Rounds (Top 4)

    // Semi-finals (Top 4)
    $structure[] = [
        'round' => $swissRounds + 1,
        'type' => 'semi_final',  // Explicit type
        'participant_selection' => ['top_k' => 4],
        'matches_per_player' => 1,
        'pairing_method' => self::PAIRING_DIRECT,  // 1v4, 2v3
        'round_description' => 'Semi-finals (Top 4 from Swiss rounds)',
    ];

    // Finals (Top 2 from semi-finals)
    $structure[] = [
        'round' => $swissRounds + 2,
        'type' => 'final',  // Explicit type
        'participant_selection' => ['top_k' => 2],
        'matches_per_player' => 1,
        'pairing_method' => self::PAIRING_DIRECT,  // Winner of each semi
        'round_description' => 'Finals (Winners of semi-finals)',
    ];

    return $structure;
}
```

## Fix Implementation

### Step 1: Add the new method to TournamentConfig.php

Insert the method above after line 606 (after `generateSwissStructure()`).

### Step 2: Update fromPreset() to use Swiss+Elimination

Modify `fromPreset()` around line 235-260:

```php
case self::PRESET_SMALL:
    // For 10 or fewer players, use Swiss + Elimination
    $config->mode = self::MODE_SWISS;
    if ($participantCount <= 10) {
        $config->roundStructure = self::generateSwissEliminationStructure($participantCount);
    } else {
        $config->roundStructure = self::generateSmallTournamentStructure($totalRounds, $participantCount);
    }
    break;
```

### Step 3: Update Round Type Detection

In `app/Services/RoundTypeDetectionService.php`, ensure:

```php
public function determineRoundType(Championship $championship, int $roundNumber): string
{
    $config = $championship->tournament_configuration ?? [];

    // Check round structure for explicit type
    if (isset($config['rounds'][$roundNumber]['type'])) {
        return $config['rounds'][$roundNumber]['type'];
    }

    // Fallback to checking participant_selection
    $roundConfig = $config['rounds'][$roundNumber] ?? [];
    if (isset($roundConfig['participant_selection']) &&
        is_array($roundConfig['participant_selection']) &&
        isset($roundConfig['participant_selection']['top_k'])) {
        // Selective round with top_k means elimination
        return 'elimination';
    }

    return 'swiss';  // Default
}
```

### Step 4: Fix TournamentGenerationService Logic

In `app/Services/TournamentGenerationService.php` around line 275-294:

```php
$isSelectiveRound = $this->isSelectiveRound($roundConfig);

// 🎯 CRITICAL: Check round type FIRST before checking selective
$roundType = $roundConfig['type'] ?? 'swiss';

// For elimination rounds (semi-final, final), use selective pairing
if (in_array($roundType, ['semi_final', 'final', 'elimination'])) {
    return $this->generatePlaceholderPairings($roundConfig);
}

// For Swiss rounds, ALWAYS use Swiss algorithm regardless of $isSelectiveRound
if ($roundType === 'swiss') {
    if ($roundNumber > 1) {
        return $this->generateSwissPlaceholderPairings($participants->count());
    }
    // Round 1 uses actual Swiss pairing
    return $this->swissService->generatePairings($championship, $roundNumber);
}

// Fallback to old logic for backward compatibility
if ($isSelectiveRound) {
    return $this->generatePlaceholderPairings($roundConfig);
}
```

## Testing Checklist

### Create new 10-player tournament:

1. **Verify Configuration**:
   ```php
   $config = TournamentConfig::generateSwissEliminationStructure(10);
   // Should return 5 rounds (3 Swiss + 2 Elimination)
   ```

2. **Verify Round Structure**:
   - Round 1: 5 matches, all 10 players
   - Round 2: 5 matches, all 10 players
   - Round 3: 5 matches, all 10 players
   - Round 4: 2 matches, top 4 players (semi-finals)
   - Round 5: 1 match, top 2 players (finals)

3. **Verify Round Types**:
   - Rounds 1-3: Type = "swiss"
   - Round 4: Type = "semi_final"
   - Round 5: Type = "final"

4. **Verify Pairing Logic**:
   - Rounds 1-3: Use SwissPairingService
   - Round 4-5: Use elimination bracket logic

## Migration Path for Existing Tournaments

For Tournament #62 currently in progress:

### Option A: Fix Configuration (Recommended)
Update the championship's `tournament_configuration` JSON:

```php
$championship = Championship::find(62);
$championship->tournament_configuration = [
    'mode' => 'swiss',
    'rounds' => [
        1 => ['type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
        2 => ['type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'swiss'],
        3 => ['type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'swiss'],
        4 => ['type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'direct'],
        5 => ['type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'direct'],
    ],
    'swiss_rounds' => 3,
];
$championship->save();
```

### Option B: Delete and Recreate
Delete tournament #62 and create new one with correct configuration.

## Summary

**Root Cause**: Using `PRESET_SMALL` which creates progressive elimination, not Swiss+Elimination

**Fix**:
1. Add `generateSwissEliminationStructure()` method
2. Update `fromPreset()` to use it for ≤10 players
3. Fix `TournamentGenerationService` to respect `type` field
4. Update round type detection logic

**Result**:
- Rounds 1-3: Proper Swiss with all 10 players (5 matches each)
- Round 4: Semi-finals with Top 4 (2 matches)
- Round 5: Finals with Top 2 (1 match)
- Total: 5 rounds, 19 matches
