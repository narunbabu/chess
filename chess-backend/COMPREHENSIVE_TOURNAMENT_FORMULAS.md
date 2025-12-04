# Comprehensive Tournament Structure Formulas

## Mathematical Foundation for Swiss + Elimination Tournaments

### Core Principles

1. **Swiss Rounds**: Give all players multiple games for fair seeding
2. **Elimination Rounds**: Create exciting bracket playoffs with top performers
3. **Total Rounds**: Balance between fairness and tournament length

---

## Tournament Size Formulas

### Formula Components

```
Total Players (P): Number of participants
Swiss Rounds (S): Rounds where all players compete
Elimination Rounds (E): Bracket-style playoff rounds
Total Rounds (T): S + E
Top Players (K): Players advancing to elimination
```

### Universal Formula

```
For P players:

1. Swiss Rounds (S):
   - Minimum: 3 rounds (ensures fair seeding)
   - Maximum: log₂(P) rounded up
   - Optimal: min(3-5, ⌈log₂(P)⌉)

2. Top Players for Elimination (K):
   - Must be power of 2 (4, 8, 16, 32...)
   - K = 2^⌈log₂(P/2)⌉ (roughly half, rounded to power of 2)
   - Min K = 4, Max K = min(32, P/2)

3. Elimination Rounds (E):
   - E = log₂(K)
   - Creates: Quarter → Semi → Final structure

4. Total Rounds (T):
   - T = S + E
```

---

## Tournament Size Matrix

### Small Tournaments (4-16 players)

| Players | Swiss Rounds | Top K | Elimination Rounds | Total | Structure |
|---------|--------------|-------|-------------------|-------|-----------|
| 4       | 2            | 4     | 2                 | 4     | 2 Swiss → Semi → Final |
| 6       | 3            | 4     | 2                 | 5     | 3 Swiss → Semi → Final |
| 8       | 3            | 4     | 2                 | 5     | 3 Swiss → Semi → Final |
| 10      | 3            | 4     | 2                 | 5     | 3 Swiss → Semi → Final |
| 12      | 3            | 8     | 3                 | 6     | 3 Swiss → Quarter → Semi → Final |
| 14      | 4            | 8     | 3                 | 7     | 4 Swiss → Quarter → Semi → Final |
| 16      | 4            | 8     | 3                 | 7     | 4 Swiss → Quarter → Semi → Final |

### Medium Tournaments (18-32 players)

| Players | Swiss Rounds | Top K | Elimination Rounds | Total | Structure |
|---------|--------------|-------|-------------------|-------|-----------|
| 18      | 4            | 8     | 3                 | 7     | 4 Swiss → Quarter → Semi → Final |
| 20      | 4            | 8     | 3                 | 7     | 4 Swiss → Quarter → Semi → Final |
| 24      | 5            | 8     | 3                 | 8     | 5 Swiss → Quarter → Semi → Final |
| 28      | 5            | 16    | 4                 | 9     | 5 Swiss → Round of 16 → Quarter → Semi → Final |
| 32      | 5            | 16    | 4                 | 9     | 5 Swiss → Round of 16 → Quarter → Semi → Final |

### Large Tournaments (34-64 players)

| Players | Swiss Rounds | Top K | Elimination Rounds | Total | Structure |
|---------|--------------|-------|-------------------|-------|-----------|
| 40      | 5            | 16    | 4                 | 9     | 5 Swiss → R16 → Quarter → Semi → Final |
| 48      | 6            | 16    | 4                 | 10    | 6 Swiss → R16 → Quarter → Semi → Final |
| 56      | 6            | 32    | 5                 | 11    | 6 Swiss → R32 → R16 → Quarter → Semi → Final |
| 64      | 6            | 32    | 5                 | 11    | 6 Swiss → R32 → R16 → Quarter → Semi → Final |

### Very Large Tournaments (65-128 players)

| Players | Swiss Rounds | Top K | Elimination Rounds | Total | Structure |
|---------|--------------|-------|-------------------|-------|-----------|
| 80      | 7            | 32    | 5                 | 12    | 7 Swiss → R32 → R16 → Quarter → Semi → Final |
| 100     | 7            | 32    | 5                 | 12    | 7 Swiss → R32 → R16 → Quarter → Semi → Final |
| 128     | 7            | 32    | 5                 | 12    | 7 Swiss → R32 → R16 → Quarter → Semi → Final |

---

## Implementation Formula (Code)

```php
class TournamentStructureCalculator
{
    /**
     * Calculate optimal tournament structure
     *
     * @param int $playerCount Total number of players
     * @return array ['swiss_rounds' => int, 'top_k' => int, 'elimination_rounds' => int, 'total_rounds' => int]
     */
    public static function calculateStructure(int $playerCount): array
    {
        // Step 1: Calculate Swiss Rounds
        $swissRounds = self::calculateSwissRounds($playerCount);

        // Step 2: Calculate Top K for elimination
        $topK = self::calculateTopK($playerCount);

        // Step 3: Calculate Elimination Rounds
        $eliminationRounds = (int) log($topK, 2);

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
     */
    private static function calculateSwissRounds(int $playerCount): int
    {
        if ($playerCount <= 8) {
            return 3; // Minimum for fair seeding
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

        // For very large tournaments
        return 7;
    }

    /**
     * Calculate Top K players for elimination (must be power of 2)
     */
    private static function calculateTopK(int $playerCount): int
    {
        // Aim for roughly 25-50% of players in elimination
        // But must be power of 2 and at least 4

        if ($playerCount <= 8) {
            return 4; // Minimum bracket size
        }

        if ($playerCount <= 16) {
            return min(8, $playerCount);
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
     * Generate human-readable structure name
     */
    private static function generateStructureName(int $swissRounds, int $topK): string
    {
        $parts = ["{$swissRounds} Swiss Rounds"];

        // Generate elimination stage names
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
}
```

---

## Detailed Round Structure Generation

```php
/**
 * Generate complete round structure for tournament
 *
 * @param int $playerCount Total players
 * @return array Array of round configurations
 */
public static function generateSwissEliminationStructure(int $playerCount): array
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
            'top_k' => null, // All players
            'description' => "Swiss Round {$i}",
        ];
    }

    // Generate Elimination Rounds
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

    return $rounds;
}

/**
 * Get elimination stage name based on participant count
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
```

---

## Examples

### Example 1: 10 Players
```
Structure: calculateStructure(10)
Result: {
    swiss_rounds: 3,
    top_k: 4,
    elimination_rounds: 2,
    total_rounds: 5,
    structure_name: "3 Swiss Rounds → Semifinals → Final"
}

Rounds:
1. Swiss Round 1 (10 players, 5 matches)
2. Swiss Round 2 (10 players, 5 matches)
3. Swiss Round 3 (10 players, 5 matches)
4. Semifinals (Top 4, 2 matches)
5. Final (Top 2, 1 match)
```

### Example 2: 24 Players
```
Structure: calculateStructure(24)
Result: {
    swiss_rounds: 5,
    top_k: 8,
    elimination_rounds: 3,
    total_rounds: 8,
    structure_name: "5 Swiss Rounds → Quarterfinals → Semifinals → Final"
}

Rounds:
1-5. Swiss Rounds 1-5 (24 players, 12 matches each)
6. Quarterfinals (Top 8, 4 matches)
7. Semifinals (Top 4, 2 matches)
8. Final (Top 2, 1 match)
```

### Example 3: 64 Players
```
Structure: calculateStructure(64)
Result: {
    swiss_rounds: 6,
    top_k: 32,
    elimination_rounds: 5,
    total_rounds: 11,
    structure_name: "6 Swiss Rounds → R32 → R16 → Quarterfinals → Semifinals → Final"
}

Rounds:
1-6. Swiss Rounds 1-6 (64 players, 32 matches each)
7. Round of 32 (Top 32, 16 matches)
8. Round of 16 (Top 16, 8 matches)
9. Quarterfinals (Top 8, 4 matches)
10. Semifinals (Top 4, 2 matches)
11. Final (Top 2, 1 match)
```

---

## Design Rationale

### Why These Numbers?

1. **Swiss Rounds (3-7)**
   - Fewer than 3: Not enough data for fair seeding
   - More than 7: Diminishing returns, tournament too long
   - Formula ensures all players get meaningful games

2. **Top K Powers of 2**
   - Single-elimination brackets require powers of 2
   - No byes needed in any round
   - Clean bracket structure

3. **25-50% in Elimination**
   - Rewards consistent Swiss performance
   - Creates competitive elimination rounds
   - Balances exclusivity with participation

4. **Total Rounds**
   - Small (4-16): 4-7 rounds (1-2 days)
   - Medium (18-32): 7-9 rounds (2-3 days)
   - Large (34-64): 9-11 rounds (3-4 days)
   - Very Large (65-128): 12 rounds (4-5 days)

---

## Configuration Override Options

Allow tournament organizers to customize:

```php
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
        if (($topK & ($topK - 1)) === 0 && $topK >= 4) {
            $default['top_k'] = min($topK, $playerCount);
            $default['elimination_rounds'] = (int) log($default['top_k'], 2);
        }
    }

    $default['total_rounds'] = $default['swiss_rounds'] + $default['elimination_rounds'];

    return $default;
}
```

