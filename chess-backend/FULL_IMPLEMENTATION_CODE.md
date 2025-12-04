# Full Implementation Code - Tournament Structure Fixes

## Overview

This document contains ALL the code changes needed to implement the comprehensive tournament structure formulas.

---

## File 1: Create New Calculator Service

**File**: `app/Services/TournamentStructureCalculator.php` (NEW FILE)

```php
<?php

namespace App\Services;

/**
 * Tournament Structure Calculator
 *
 * Calculates optimal Swiss + Elimination tournament structures
 * based on player count using mathematical formulas.
 */
class TournamentStructureCalculator
{
    /**
     * Calculate optimal tournament structure
     *
     * @param int $playerCount Total number of players
     * @return array ['swiss_rounds' => int, 'top_k' => int, 'elimination_rounds' => int, 'total_rounds' => int, 'structure_name' => string]
     */
    public static function calculateStructure(int $playerCount): array
    {
        // Step 1: Calculate Swiss Rounds
        $swissRounds = self::calculateSwissRounds($playerCount);

        // Step 2: Calculate Top K for elimination
        $topK = self::calculateTopK($playerCount);

        // Step 3: Calculate Elimination Rounds
        $eliminationRounds = $topK > 0 ? (int) log($topK, 2) : 0;

        // Step 4: Calculate Total
        $totalRounds = $swissRounds + $eliminationRounds;

        return [
            'swiss_rounds' => $swissRounds,
            'top_k' => $topK,
            'elimination_rounds' => $eliminationRounds,
            'total_rounds' => $totalRounds,
            'structure_name' => self::generateStructureName($swissRounds, $topK),
        ];
    }

    /**
     * Calculate optimal number of Swiss rounds
     *
     * @param int $playerCount
     * @return int
     */
    private static function calculateSwissRounds(int $playerCount): int
    {
        if ($playerCount <= 4) {
            return 2; // Minimum for very small tournaments
        }

        if ($playerCount <= 8) {
            return 3; // Standard minimum for fair seeding
        }

        if ($playerCount <= 16) {
            return 4;
        }

        if ($playerCount <= 32) {
            return 5;
        }

        if ($playerCount <= 64) {
            return 6;
        }

        // For very large tournaments (65-128)
        return 7;
    }

    /**
     * Calculate Top K players for elimination (must be power of 2)
     *
     * @param int $playerCount
     * @return int
     */
    private static function calculateTopK(int $playerCount): int
    {
        // Minimum tournament size
        if ($playerCount < 4) {
            return $playerCount; // Too small for elimination
        }

        // Aim for roughly 25-50% of players in elimination
        // But must be power of 2 and at least 4

        if ($playerCount <= 8) {
            return 4; // Minimum bracket size
        }

        if ($playerCount <= 16) {
            return min(8, self::nearestPowerOf2($playerCount / 2));
        }

        if ($playerCount <= 32) {
            return 8;
        }

        if ($playerCount <= 48) {
            return 16;
        }

        if ($playerCount <= 100) {
            return 32;
        }

        // For very large tournaments
        return 32; // Cap at 32 for practical reasons
    }

    /**
     * Find nearest power of 2
     *
     * @param float $number
     * @return int
     */
    private static function nearestPowerOf2(float $number): int
    {
        $power = (int) ceil(log($number, 2));
        return (int) pow(2, $power);
    }

    /**
     * Generate human-readable structure name
     *
     * @param int $swissRounds
     * @param int $topK
     * @return string
     */
    private static function generateStructureName(int $swissRounds, int $topK): string
    {
        $parts = ["{$swissRounds} Swiss Rounds"];

        // Generate elimination stage names
        if ($topK < 4) {
            return $parts[0]; // No elimination
        }

        $eliminationRounds = (int) log($topK, 2);

        $stageNames = [
            5 => 'Round of 32',
            4 => 'Round of 16',
            3 => 'Quarterfinals',
            2 => 'Semifinals',
            1 => 'Final',
        ];

        for ($i = $eliminationRounds; $i >= 1; $i--) {
            if (isset($stageNames[$i])) {
                $parts[] = $stageNames[$i];
            }
        }

        return implode(' → ', $parts);
    }

    /**
     * Generate complete round structure for tournament
     *
     * @param int $playerCount Total players
     * @return array Array of round configurations
     */
    public static function generateRoundStructure(int $playerCount): array
    {
        $structure = self::calculateStructure($playerCount);
        $rounds = [];

        // Generate Swiss Rounds
        for ($i = 1; $i <= $structure['swiss_rounds']; $i++) {
            $rounds[] = [
                'round_number' => $i,
                'round_type' => 'swiss',
                'format' => 'swiss',
                'participant_count' => $playerCount,
                'matches_per_participant' => 1,
                'match_count' => (int) ceil($playerCount / 2),
                'top_k' => null, // All players participate
                'description' => "Swiss Round {$i}",
            ];
        }

        // Generate Elimination Rounds
        if ($structure['top_k'] >= 4) {
            $currentTopK = $structure['top_k'];
            $roundNumber = $structure['swiss_rounds'] + 1;

            while ($currentTopK >= 2) {
                $stageName = self::getEliminationStageName($currentTopK);

                $rounds[] = [
                    'round_number' => $roundNumber,
                    'round_type' => 'elimination',
                    'format' => $currentTopK == 2 ? 'final' : 'bracket',
                    'participant_count' => $currentTopK,
                    'matches_per_participant' => 1,
                    'match_count' => (int) ($currentTopK / 2),
                    'top_k' => $currentTopK,
                    'description' => $stageName,
                ];

                $currentTopK /= 2;
                $roundNumber++;
            }
        }

        return $rounds;
    }

    /**
     * Get elimination stage name based on participant count
     *
     * @param int $participantCount
     * @return string
     */
    private static function getEliminationStageName(int $participantCount): string
    {
        $names = [
            2 => 'Final',
            4 => 'Semifinals',
            8 => 'Quarterfinals',
            16 => 'Round of 16',
            32 => 'Round of 32',
            64 => 'Round of 64',
        ];

        return $names[$participantCount] ?? "Top {$participantCount}";
    }

    /**
     * Generate custom structure with overrides
     *
     * @param int $playerCount
     * @param int|null $swissRounds Override Swiss rounds
     * @param int|null $topK Override Top K (must be power of 2)
     * @return array
     */
    public static function generateCustomStructure(
        int $playerCount,
        ?int $swissRounds = null,
        ?int $topK = null
    ): array {
        $default = self::calculateStructure($playerCount);

        // Override Swiss rounds if specified
        if ($swissRounds !== null) {
            $default['swiss_rounds'] = max(2, min(10, $swissRounds));
        }

        // Override Top K if specified (must be power of 2)
        if ($topK !== null) {
            // Validate power of 2
            if (($topK & ($topK - 1)) === 0 && $topK >= 4 && $topK <= $playerCount) {
                $default['top_k'] = $topK;
                $default['elimination_rounds'] = (int) log($default['top_k'], 2);
            }
        }

        $default['total_rounds'] = $default['swiss_rounds'] + $default['elimination_rounds'];
        $default['structure_name'] = self::generateStructureName(
            $default['swiss_rounds'],
            $default['top_k']
        );

        return $default;
    }

    /**
     * Validate if a structure is valid
     *
     * @param array $structure
     * @return bool
     */
    public static function validateStructure(array $structure): bool
    {
        // Check required fields
        $required = ['swiss_rounds', 'top_k', 'elimination_rounds', 'total_rounds'];
        foreach ($required as $field) {
            if (!isset($structure[$field])) {
                return false;
            }
        }

        // Check top_k is power of 2
        $topK = $structure['top_k'];
        if ($topK > 0 && ($topK & ($topK - 1)) !== 0) {
            return false;
        }

        // Check elimination rounds match top_k
        if ($topK > 0) {
            $expectedElimination = (int) log($topK, 2);
            if ($structure['elimination_rounds'] !== $expectedElimination) {
                return false;
            }
        }

        // Check total rounds
        if ($structure['total_rounds'] !== $structure['swiss_rounds'] + $structure['elimination_rounds']) {
            return false;
        }

        return true;
    }
}
```

---

## File 2: Update TournamentConfig.php

**File**: `app/ValueObjects/TournamentConfig.php`

**Changes**: Add new method `generateSwissEliminationStructure()` and update `fromPreset()` method

### Add this new method to the class:

```php
/**
 * Generate Swiss + Elimination structure using formulas
 *
 * @param int $playerCount Total number of players
 * @param int|null $customSwissRounds Override Swiss rounds (optional)
 * @param int|null $customTopK Override Top K (optional, must be power of 2)
 * @return array
 */
private static function generateSwissEliminationStructure(
    int $playerCount,
    ?int $customSwissRounds = null,
    ?int $customTopK = null
): array {
    // Use the calculator to generate structure
    if ($customSwissRounds !== null || $customTopK !== null) {
        return \App\Services\TournamentStructureCalculator::generateCustomStructure(
            $playerCount,
            $customSwissRounds,
            $customTopK
        );
    }

    return \App\Services\TournamentStructureCalculator::generateRoundStructure($playerCount);
}
```

### Update the `fromPreset()` method:

Replace the switch statement section with this:

```php
switch ($preset) {
    case self::PRESET_SMALL:
        // Use formula-based Swiss + Elimination structure
        $config->roundStructure = self::generateSwissEliminationStructure($participantCount);
        break;

    case self::PRESET_MEDIUM:
        // Use formula-based Swiss + Elimination structure
        $config->roundStructure = self::generateSwissEliminationStructure($participantCount);
        break;

    case self::PRESET_LARGE:
        // Use formula-based Swiss + Elimination structure
        $config->roundStructure = self::generateSwissEliminationStructure($participantCount);
        break;

    case self::PRESET_PURE_SWISS:
        // Pure Swiss (no elimination)
        $config->roundStructure = self::generateSwissStructure($totalRounds);
        break;

    case self::PRESET_UNIVERSAL:
        // Legacy universal structure
        $config->roundStructure = self::generateUniversalTournamentStructure($totalRounds, $participantCount);
        break;

    default:
        throw new \InvalidArgumentException("Unknown preset: {$preset}");
}
```

---

## File 3: Update RoundTypeDetectionService.php

**File**: `app/Services/RoundTypeDetectionService.php` (Already created earlier)

**Action**: Ensure this file exists with the following content:

```php
<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\Round;
use Illuminate\Support\Facades\Log;

/**
 * Service to intelligently detect if a round is Swiss or Elimination
 *
 * Used to fix the round type confusion bug where rounds were marked
 * as "swiss" but had top_k selection (making them elimination rounds)
 */
class RoundTypeDetectionService
{
    /**
     * Detect if a round is actually Swiss or Elimination based on configuration
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return string 'swiss' or 'elimination'
     */
    public static function detectRoundType(Championship $championship, int $roundNumber): string
    {
        $roundConfig = $championship->getRoundConfig($roundNumber);

        // Primary detection: Check explicit round_type field
        if (isset($roundConfig['round_type'])) {
            $explicitType = strtolower($roundConfig['round_type']);

            // Validate it matches actual configuration
            $hasTopK = isset($roundConfig['top_k']) && $roundConfig['top_k'] !== null;

            if ($explicitType === 'swiss' && $hasTopK) {
                Log::warning("Round {$roundNumber} marked as 'swiss' but has top_k={$roundConfig['top_k']}. Using 'elimination'.");
                return 'elimination';
            }

            if ($explicitType === 'elimination' && !$hasTopK) {
                Log::warning("Round {$roundNumber} marked as 'elimination' but has no top_k. Using 'swiss'.");
                return 'swiss';
            }

            return $explicitType;
        }

        // Fallback detection: Use top_k presence
        $hasTopK = isset($roundConfig['top_k']) && $roundConfig['top_k'] !== null;

        if ($hasTopK) {
            Log::info("Round {$roundNumber} has top_k={$roundConfig['top_k']}. Detected as 'elimination'.");
            return 'elimination';
        }

        // Default to Swiss
        Log::info("Round {$roundNumber} has no top_k. Detected as 'swiss'.");
        return 'swiss';
    }

    /**
     * Check if a round is a Swiss round
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return bool
     */
    public static function isSwissRound(Championship $championship, int $roundNumber): bool
    {
        return self::detectRoundType($championship, $roundNumber) === 'swiss';
    }

    /**
     * Check if a round is an Elimination round
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return bool
     */
    public static function isEliminationRound(Championship $championship, int $roundNumber): bool
    {
        return self::detectRoundType($championship, $roundNumber) === 'elimination';
    }

    /**
     * Get all Swiss round numbers for a championship
     *
     * @param Championship $championship
     * @return array
     */
    public static function getSwissRounds(Championship $championship): array
    {
        $swissRounds = [];

        for ($i = 1; $i <= $championship->total_rounds; $i++) {
            if (self::isSwissRound($championship, $i)) {
                $swissRounds[] = $i;
            }
        }

        return $swissRounds;
    }

    /**
     * Get all Elimination round numbers for a championship
     *
     * @param Championship $championship
     * @return array
     */
    public static function getEliminationRounds(Championship $championship): array
    {
        $eliminationRounds = [];

        for ($i = 1; $i <= $championship->total_rounds; $i++) {
            if (self::isEliminationRound($championship, $i)) {
                $eliminationRounds[] = $i;
            }
        }

        return $eliminationRounds;
    }

    /**
     * Get the first elimination round number
     *
     * @param Championship $championship
     * @return int|null Null if no elimination rounds exist
     */
    public static function getFirstEliminationRound(Championship $championship): ?int
    {
        $eliminationRounds = self::getEliminationRounds($championship);

        return !empty($eliminationRounds) ? min($eliminationRounds) : null;
    }

    /**
     * Analyze and log championship structure
     *
     * @param Championship $championship
     * @return array Structure analysis
     */
    public static function analyzeStructure(Championship $championship): array
    {
        $analysis = [
            'total_rounds' => $championship->total_rounds,
            'swiss_rounds' => self::getSwissRounds($championship),
            'elimination_rounds' => self::getEliminationRounds($championship),
            'first_elimination_round' => self::getFirstEliminationRound($championship),
            'rounds' => [],
        ];

        for ($i = 1; $i <= $championship->total_rounds; $i++) {
            $config = $championship->getRoundConfig($i);
            $analysis['rounds'][$i] = [
                'round_number' => $i,
                'detected_type' => self::detectRoundType($championship, $i),
                'config_type' => $config['round_type'] ?? 'not_set',
                'top_k' => $config['top_k'] ?? null,
                'participant_count' => $config['participant_count'] ?? null,
            ];
        }

        Log::info("Championship {$championship->id} structure analysis", $analysis);

        return $analysis;
    }
}
```

---

## File 4: Update Championship Model

**File**: `app/Models/Championship.php`

**Changes**: Add helper methods for round type detection

### Add these methods to the Championship class:

```php
/**
 * Check if a round is a Swiss round using intelligent detection
 *
 * @param int $roundNumber
 * @return bool
 */
public function isSwissRound(int $roundNumber): bool
{
    return \App\Services\RoundTypeDetectionService::isSwissRound($this, $roundNumber);
}

/**
 * Check if a round is an Elimination round using intelligent detection
 *
 * @param int $roundNumber
 * @return bool
 */
public function isEliminationRound(int $roundNumber): bool
{
    return \App\Services\RoundTypeDetectionService::isEliminationRound($this, $roundNumber);
}

/**
 * Get all Swiss round numbers
 *
 * @return array
 */
public function getSwissRounds(): array
{
    return \App\Services\RoundTypeDetectionService::getSwissRounds($this);
}

/**
 * Get all Elimination round numbers
 *
 * @return array
 */
public function getEliminationRounds(): array
{
    return \App\Services\RoundTypeDetectionService::getEliminationRounds($this);
}

/**
 * Get the first elimination round number
 *
 * @return int|null
 */
public function getFirstEliminationRound(): ?int
{
    return \App\Services\RoundTypeDetectionService::getFirstEliminationRound($this);
}
```

---

## File 5: Update ChampionshipRoundProgressionService.php

**File**: `app/Services/ChampionshipRoundProgressionService.php`

**Changes**: Use round type detection for progression logic

### Find the section where it checks if a round is Swiss (around line 150-200)

Replace this pattern:
```php
// Old code
$currentRoundConfig = $championship->getRoundConfig($currentRoundNumber);
$format = $currentRoundConfig['format'] ?? 'swiss';

if ($format === 'swiss') {
    // Swiss logic
} else {
    // Elimination logic
}
```

With this pattern:
```php
// New code using detection service
use App\Services\RoundTypeDetectionService;

$isSwissRound = RoundTypeDetectionService::isSwissRound($championship, $currentRoundNumber);

if ($isSwissRound) {
    // Swiss logic - generate Swiss pairings
    $this->generateSwissPlaceholderPairings($nextRound, $championship);
} else {
    // Elimination logic - generate bracket pairings
    $this->generateBracketPlaceholderPairings($nextRound, $championship);
}
```

---

## File 6: Update TournamentGenerationService.php

**File**: `app/Services/TournamentGenerationService.php`

**Changes**: Use round type detection when generating placeholder matches

### Around line 800-900 in createPlaceholderMatches() method:

Replace:
```php
// Old
$roundConfig = $championship->getRoundConfig($round->round_number);
$format = $roundConfig['format'] ?? 'swiss';

if ($format === 'swiss') {
    $this->generateSwissPlaceholderPairings($round, $championship);
} else {
    $this->generatePlaceholderPairings($round, $championship);
}
```

With:
```php
// New
use App\Services\RoundTypeDetectionService;

$isSwissRound = RoundTypeDetectionService::isSwissRound($championship, $round->round_number);

if ($isSwissRound) {
    $this->generateSwissPlaceholderPairings($round, $championship);
} else {
    // Elimination round - generate bracket pairings
    $this->generatePlaceholderPairings($round, $championship);
}
```

---

## File 7: Create Test for Calculator

**File**: `tests/Unit/Services/TournamentStructureCalculatorTest.php` (NEW FILE)

```php
<?php

namespace Tests\Unit\Services;

use App\Services\TournamentStructureCalculator;
use Tests\TestCase;

class TournamentStructureCalculatorTest extends TestCase
{
    /** @test */
    public function it_calculates_structure_for_10_players()
    {
        $structure = TournamentStructureCalculator::calculateStructure(10);

        $this->assertEquals(3, $structure['swiss_rounds']);
        $this->assertEquals(4, $structure['top_k']);
        $this->assertEquals(2, $structure['elimination_rounds']);
        $this->assertEquals(5, $structure['total_rounds']);
        $this->assertEquals('3 Swiss Rounds → Semifinals → Final', $structure['structure_name']);
    }

    /** @test */
    public function it_calculates_structure_for_24_players()
    {
        $structure = TournamentStructureCalculator::calculateStructure(24);

        $this->assertEquals(5, $structure['swiss_rounds']);
        $this->assertEquals(8, $structure['top_k']);
        $this->assertEquals(3, $structure['elimination_rounds']);
        $this->assertEquals(8, $structure['total_rounds']);
        $this->assertStringContainsString('Quarterfinals', $structure['structure_name']);
    }

    /** @test */
    public function it_calculates_structure_for_64_players()
    {
        $structure = TournamentStructureCalculator::calculateStructure(64);

        $this->assertEquals(6, $structure['swiss_rounds']);
        $this->assertEquals(32, $structure['top_k']);
        $this->assertEquals(5, $structure['elimination_rounds']);
        $this->assertEquals(11, $structure['total_rounds']);
    }

    /** @test */
    public function it_generates_correct_round_structure()
    {
        $rounds = TournamentStructureCalculator::generateRoundStructure(10);

        // Should have 5 rounds total
        $this->assertCount(5, $rounds);

        // First 3 should be Swiss
        for ($i = 0; $i < 3; $i++) {
            $this->assertEquals('swiss', $rounds[$i]['round_type']);
            $this->assertEquals(10, $rounds[$i]['participant_count']);
            $this->assertEquals(5, $rounds[$i]['match_count']);
        }

        // Round 4 should be Semifinals (4 players, 2 matches)
        $this->assertEquals('elimination', $rounds[3]['round_type']);
        $this->assertEquals(4, $rounds[3]['participant_count']);
        $this->assertEquals(2, $rounds[3]['match_count']);
        $this->assertEquals('Semifinals', $rounds[3]['description']);

        // Round 5 should be Final (2 players, 1 match)
        $this->assertEquals('elimination', $rounds[4]['round_type']);
        $this->assertEquals(2, $rounds[4]['participant_count']);
        $this->assertEquals(1, $rounds[4]['match_count']);
        $this->assertEquals('Final', $rounds[4]['description']);
    }

    /** @test */
    public function it_allows_custom_structure()
    {
        $structure = TournamentStructureCalculator::generateCustomStructure(
            playerCount: 10,
            swissRounds: 4, // Override to 4 Swiss rounds
            topK: 8         // Override to Top 8
        );

        $this->assertEquals(4, $structure['swiss_rounds']);
        $this->assertEquals(8, $structure['top_k']);
        $this->assertEquals(3, $structure['elimination_rounds']);
        $this->assertEquals(7, $structure['total_rounds']);
    }

    /** @test */
    public function it_validates_structure_correctly()
    {
        $validStructure = [
            'swiss_rounds' => 3,
            'top_k' => 4,
            'elimination_rounds' => 2,
            'total_rounds' => 5,
        ];

        $this->assertTrue(TournamentStructureCalculator::validateStructure($validStructure));

        $invalidStructure = [
            'swiss_rounds' => 3,
            'top_k' => 5, // Not a power of 2
            'elimination_rounds' => 2,
            'total_rounds' => 5,
        ];

        $this->assertFalse(TournamentStructureCalculator::validateStructure($invalidStructure));
    }
}
```

---

## Summary of Changes

### New Files to Create:
1. `app/Services/TournamentStructureCalculator.php` - Formula-based calculator
2. `app/Services/RoundTypeDetectionService.php` - Intelligent round type detection
3. `tests/Unit/Services/TournamentStructureCalculatorTest.php` - Unit tests

### Files to Modify:
1. `app/ValueObjects/TournamentConfig.php`
   - Add `generateSwissEliminationStructure()` method
   - Update `fromPreset()` to use new structure generation

2. `app/Models/Championship.php`
   - Add helper methods: `isSwissRound()`, `isEliminationRound()`, etc.

3. `app/Services/ChampionshipRoundProgressionService.php`
   - Replace format checking with `RoundTypeDetectionService`

4. `app/Services/TournamentGenerationService.php`
   - Replace format checking with `RoundTypeDetectionService`

---

## Testing Plan

After implementation, test with:

```php
// Test 10 players
$structure = TournamentStructureCalculator::calculateStructure(10);
print_r($structure);

// Test round generation
$rounds = TournamentStructureCalculator::generateRoundStructure(10);
foreach ($rounds as $round) {
    echo "Round {$round['round_number']}: {$round['description']} - {$round['round_type']} - {$round['participant_count']} players\n";
}

// Test with existing championship
$championship = Championship::find(62);
$analysis = RoundTypeDetectionService::analyzeStructure($championship);
print_r($analysis);
```

---

## Migration Path for Existing Tournaments

For tournaments already created with wrong structure:

```php
// Artisan command to fix existing tournaments
php artisan tournament:fix-structure {championship_id}

// This would:
// 1. Analyze current structure
// 2. Recalculate using formulas
// 3. Update round configurations
// 4. Regenerate placeholder matches if needed
```

