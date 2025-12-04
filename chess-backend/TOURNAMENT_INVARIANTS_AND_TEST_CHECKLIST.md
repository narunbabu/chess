# Tournament System Invariants and Test Checklist

## Universal Rules and Invariants

These rules MUST hold true for ANY tournament with ANY number of players, regardless of tournament size.

---

## Section 1: Core Mathematical Invariants

### INVARIANT 1.1: All Players Must Be Paired in Swiss Rounds
```
For ANY Swiss round:
- Total participants = P
- Total matches = M
- MUST: M = ceil(P / 2)
- MUST: Every player appears in EXACTLY 1 match
- MUST: Sum of all player IDs in matches = Sum of all participant IDs
- MUST: No player appears twice in same round
- MUST: No player is missing from the round
```

**Test Cases**:
```
P=10 → M=5 (5 matches, all 10 players)
P=11 → M=6 (6 matches, 11 players, 1 bye)
P=24 → M=12 (12 matches, all 24 players)
P=33 → M=17 (17 matches, 33 players, 1 bye)
```

### INVARIANT 1.2: Elimination Rounds Must Have Power-of-2 Participants
```
For ANY Elimination round:
- Participants = K
- MUST: K ∈ {2, 4, 8, 16, 32, 64, 128}
- MUST: K is power of 2 (K & (K-1) == 0)
- MUST: Matches = K / 2
- MUST: All K players appear exactly once
- MUST: No byes in elimination rounds
```

**Test Cases**:
```
K=2 → M=1 (Final)
K=4 → M=2 (Semifinals)
K=8 → M=4 (Quarterfinals)
K=16 → M=8 (Round of 16)
K=32 → M=16 (Round of 32)
```

### INVARIANT 1.3: Round Number Sequence
```
For ANY tournament:
- Total rounds = T
- MUST: Rounds numbered 1, 2, 3, ..., T (consecutive, no gaps)
- MUST: Round N can only start after Round N-1 is complete
- MUST: No round can be skipped
- MUST: Round numbers are immutable once created
```

### INVARIANT 1.4: Player Participation Rules
```
Swiss Rounds:
- MUST: All registered players participate in every Swiss round
- MUST: Each player plays exactly 1 match per Swiss round
- EXCEPTION: Odd number of players → 1 player gets bye (still counts as participation)

Elimination Rounds:
- MUST: Only Top K players participate (where K = power of 2)
- MUST: Top K determined by Swiss standings
- MUST: No player outside Top K can participate
- MUST: All Top K players must participate (no missing players)
```

---

## Section 2: Tournament Structure Rules

### RULE 2.1: Minimum Tournament Requirements
```
MUST: Total players P >= 2
MUST: Total rounds T >= 1
MUST: Swiss rounds S >= 0
MUST: Elimination rounds E >= 0
MUST: T = S + E

For competitive tournaments:
RECOMMENDED: S >= 3 (for fair seeding)
RECOMMENDED: P >= 4 (for meaningful brackets)
```

### RULE 2.2: Swiss Round Count Formula
```
Given P players:
MUST: S >= floor(log₂(P)) (minimum for meaningful differentiation)
RECOMMENDED: S = f(P) where:
  P <= 4:    S = 2
  P <= 8:    S = 3
  P <= 16:   S = 4
  P <= 32:   S = 5
  P <= 64:   S = 6
  P <= 128:  S = 7
  P > 128:   S = 8

Maximum reasonable: S <= 10 (diminishing returns)
```

### RULE 2.3: Top K Selection Formula
```
Given P players and S Swiss rounds:
MUST: K is power of 2
MUST: K >= 4 (minimum bracket size) OR K = 2 (finals only)
MUST: K <= P (cannot exceed total players)
RECOMMENDED: K = 2^⌈log₂(P/4)⌉ (roughly 25-50% of players)

Constraints:
- MUST: 2 <= K <= 64 (practical limits)
- MUST: K <= min(32, P/2) (avoid too many in elimination)
```

### RULE 2.4: Elimination Round Count
```
Given K players in elimination:
MUST: E = log₂(K)
MUST: E ∈ {1, 2, 3, 4, 5, 6} (for K ∈ {2, 4, 8, 16, 32, 64})

Examples:
K=2  → E=1 (Final only)
K=4  → E=2 (Semi → Final)
K=8  → E=3 (Quarter → Semi → Final)
K=16 → E=4 (R16 → Quarter → Semi → Final)
```

---

## Section 3: Match Generation Rules

### RULE 3.1: Swiss Pairing Algorithm
```
For each Swiss round after Round 1:
MUST: Pair players by current standings (Swiss system)
MUST: Avoid repeat pairings when possible
MUST: Use score groups (players with same score paired together)
MUST: Handle odd-sized groups with floating mechanism
MUST: Never drop a player (critical safety net)

Algorithm Requirements:
1. Sort players by score (descending)
2. Create score groups
3. Within each group:
   - If even size: pair top-half with bottom-half
   - If odd size: float lowest player to next group
4. Validate: All players paired
5. Fail loudly if ANY player missing
```

### RULE 3.2: Elimination Bracket Generation
```
For each elimination round:
MUST: Use seeding from Swiss standings (1 vs K, 2 vs K-1, etc.)
MUST: Single elimination (losers are eliminated)
MUST: Winners advance to next round
MUST: Maintain bracket structure (standard seeding)

Bracket Structure:
K=4:  [1v4, 2v3] → [Winner1 v Winner2]
K=8:  [1v8, 4v5, 2v7, 3v6] → [Quarters] → [Semis] → [Final]
K=16: Standard 16-player bracket
```

### RULE 3.3: Bye Handling
```
Swiss Rounds with odd P:
MUST: Assign 1 bye per round
MUST: Bye counts as win (player gets points)
MUST: Avoid giving same player bye twice (when possible)
MUST: Prefer giving bye to lowest-ranked player

Elimination Rounds:
MUST: No byes (K is always power of 2)
```

---

## Section 4: Data Integrity Rules

### RULE 4.1: Match Data Integrity
```
For EVERY match in ANY round:
MUST: match.round_id references valid round
MUST: match.championship_id references valid championship
MUST: match.white_player_id references valid participant (or NULL for placeholder)
MUST: match.black_player_id references valid participant (or NULL for placeholder)
MUST: white_player_id != black_player_id (player cannot play themselves)
MUST: Match number unique within round
```

### RULE 4.2: Round Data Integrity
```
For EVERY round:
MUST: round.championship_id references valid championship
MUST: round.round_number ∈ {1, 2, ..., T}
MUST: round.matches_count = expected match count
MUST: round.status ∈ {pending, active, completed}
```

### RULE 4.3: Score Consistency
```
After each round completion:
MUST: Sum of all match results = Total points distributed
MUST: Each player's total score = Sum of individual match results
MUST: Wins + Losses + Draws = Matches played
MUST: Standings sorted by: Score DESC, Tiebreaks DESC
```

---

## Section 5: State Transition Rules

### RULE 5.1: Round Status Progression
```
Round lifecycle:
pending → active → completed

MUST: Cannot activate round N until round N-1 is completed
MUST: Cannot complete round until all matches have results
MUST: Cannot modify completed rounds
```

### RULE 5.2: Swiss → Elimination Transition
```
At transition point:
MUST: All Swiss rounds must be completed
MUST: Calculate final standings
MUST: Select Top K based on standings
MUST: Generate elimination bracket with Top K
MUST: Notify players not in Top K (eliminated)
```

---

## Section 6: Edge Cases and Boundary Conditions

### EDGE 6.1: Minimum Tournament (2 players)
```
P=2:
MUST: T >= 1 (at least 1 round)
OPTION 1: 1 Swiss round (1 match)
OPTION 2: 1 Elimination round (1 match = Final)
```

### EDGE 6.2: Odd Number of Players
```
P is odd (e.g., 7, 9, 11, 13):
MUST: 1 bye per Swiss round
MUST: All other players paired
MUST: Total matches = (P-1)/2
MUST: Bye player still appears in standings
```

### EDGE 6.3: Non-Power-of-2 Players
```
P not power of 2 (e.g., 10, 24, 48):
MUST: Swiss rounds accommodate all P players
MUST: Top K is power of 2 (K < P)
MUST: Some players eliminated after Swiss (did not make Top K)
```

### EDGE 6.4: Exact Power-of-2 Players
```
P is power of 2 (e.g., 8, 16, 32):
OPTION 1: Swiss + Elimination (recommended)
OPTION 2: Pure single-elimination bracket
MUST: Choose structure based on tournament goals
```

---

## Section 7: Performance and Quality Rules

### RULE 7.1: Pairing Performance
```
MUST: Generate pairings in < 5 seconds for P <= 128
MUST: Generate pairings in < 30 seconds for P <= 1000
MUST: Algorithm complexity O(P log P) or better
```

### RULE 7.2: Validation Performance
```
MUST: Validate round in < 1 second for any size
MUST: Check all invariants before saving
MUST: Fail fast with clear error messages
```

---

## Developer Test Checklist

### TEST SUITE 1: Small Tournaments (2-16 players)

#### Test 1.1: 2 Players
```
Input: P=2
Expected:
- Total rounds: 1
- Structure: 1 Final (1 match)
- All players participate: TRUE
- Match count: 1
```

#### Test 1.2: 4 Players
```
Input: P=4
Expected:
- Swiss rounds: 2
- Top K: 4
- Elimination rounds: 2
- Total rounds: 4
- Round 1: 2 matches (all 4 players)
- Round 2: 2 matches (all 4 players)
- Round 3: Semifinals (2 matches, 4 players)
- Round 4: Final (1 match, 2 players)
- NO MISSING PLAYERS in any round
```

#### Test 1.3: 6 Players
```
Input: P=6
Expected:
- Swiss rounds: 3
- Top K: 4
- Elimination rounds: 2
- Total rounds: 5
- Rounds 1-3: 3 matches each (all 6 players)
- Round 4: Semifinals (2 matches, Top 4)
- Round 5: Final (1 match, Top 2)
- 2 players eliminated after Swiss
- NO MISSING PLAYERS in Swiss rounds
```

#### Test 1.4: 7 Players (ODD NUMBER)
```
Input: P=7
Expected:
- Swiss rounds: 3
- Top K: 4
- Total rounds: 5
- Rounds 1-3: 3 matches + 1 bye (all 7 players)
- MUST: Different player gets bye each round (if possible)
- MUST: Bye player still in standings
- Round 4: Semifinals (2 matches, Top 4)
- Round 5: Final (1 match, Top 2)
- NO MISSING PLAYERS
```

#### Test 1.5: 10 Players (YOUR CURRENT CASE)
```
Input: P=10
Expected:
- Swiss rounds: 3
- Top K: 4
- Elimination rounds: 2
- Total rounds: 5
- Round 1: 5 matches (all 10 players)
- Round 2: 5 matches (all 10 players)
- Round 3: 5 matches (all 10 players)
- Round 4: Semifinals (2 matches, Top 4)
- Round 5: Final (1 match, Top 2)
- 6 players eliminated after Round 3
- NO MISSING PLAYERS in Rounds 1-3
```

#### Test 1.6: 16 Players
```
Input: P=16
Expected:
- Swiss rounds: 4
- Top K: 8
- Elimination rounds: 3
- Total rounds: 7
- Rounds 1-4: 8 matches each (all 16 players)
- Round 5: Quarterfinals (4 matches, Top 8)
- Round 6: Semifinals (2 matches, Top 4)
- Round 7: Final (1 match, Top 2)
- NO MISSING PLAYERS in Swiss
```

---

### TEST SUITE 2: Medium Tournaments (17-32 players)

#### Test 2.1: 20 Players
```
Input: P=20
Expected:
- Swiss rounds: 4
- Top K: 8
- Total rounds: 7
- Rounds 1-4: 10 matches each (all 20 players)
- Round 5: Quarterfinals (4 matches, Top 8)
- Round 6: Semifinals (2 matches, Top 4)
- Round 7: Final (1 match, Top 2)
```

#### Test 2.2: 24 Players
```
Input: P=24
Expected:
- Swiss rounds: 5
- Top K: 8
- Total rounds: 8
- Rounds 1-5: 12 matches each (all 24 players)
- Round 6: Quarterfinals (4 matches, Top 8)
- Round 7: Semifinals (2 matches, Top 4)
- Round 8: Final (1 match, Top 2)
```

#### Test 2.3: 32 Players
```
Input: P=32
Expected:
- Swiss rounds: 5
- Top K: 16
- Elimination rounds: 4
- Total rounds: 9
- Rounds 1-5: 16 matches each (all 32 players)
- Round 6: Round of 16 (8 matches, Top 16)
- Round 7: Quarterfinals (4 matches, Top 8)
- Round 8: Semifinals (2 matches, Top 4)
- Round 9: Final (1 match, Top 2)
```

---

### TEST SUITE 3: Large Tournaments (33-64 players)

#### Test 3.1: 48 Players
```
Input: P=48
Expected:
- Swiss rounds: 6
- Top K: 16
- Total rounds: 10
- Rounds 1-6: 24 matches each (all 48 players)
- Rounds 7-10: Elimination bracket (16→8→4→2)
```

#### Test 3.2: 64 Players
```
Input: P=64
Expected:
- Swiss rounds: 6
- Top K: 32
- Elimination rounds: 5
- Total rounds: 11
- Rounds 1-6: 32 matches each (all 64 players)
- Rounds 7-11: Elimination (32→16→8→4→2)
```

---

### TEST SUITE 4: Edge Cases

#### Test 4.1: Odd Numbers
```
Test with: P ∈ {3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25}
For EACH:
- MUST: 1 bye per Swiss round
- MUST: Matches = (P-1)/2
- MUST: All players accounted for
- MUST: No player gets bye more than once (if rounds >= P)
```

#### Test 4.2: Prime Numbers
```
Test with: P ∈ {3, 5, 7, 11, 13, 17, 19, 23, 29, 31}
MUST: Same rules as odd numbers
MUST: Top K calculation correct
```

#### Test 4.3: Non-Standard Sizes
```
Test with: P ∈ {6, 10, 12, 14, 18, 20, 22, 26, 28, 30}
MUST: All players in Swiss
MUST: Top K is power of 2
MUST: Correct number of eliminations
```

---

### TEST SUITE 5: Invariant Validation Tests

#### Test 5.1: No Missing Players in Swiss
```php
function testNoMissingPlayersInSwiss($playerCount) {
    $championship = createTournament($playerCount);

    foreach ($championship->getSwissRounds() as $roundNumber) {
        $round = Round::where('round_number', $roundNumber)->first();
        $matches = $round->matches;

        // Collect all player IDs in matches
        $playersInMatches = [];
        foreach ($matches as $match) {
            $playersInMatches[] = $match->white_player_id;
            $playersInMatches[] = $match->black_player_id;
        }
        $playersInMatches = array_filter($playersInMatches); // Remove NULLs

        // Get all registered participants
        $allParticipants = $championship->participants->pluck('id')->toArray();

        // Validate
        assertEquals(
            count($playersInMatches),
            count($allParticipants),
            "Round {$roundNumber}: Missing players detected!"
        );

        assertEquals(
            sort($playersInMatches),
            sort($allParticipants),
            "Round {$roundNumber}: Player mismatch detected!"
        );
    }
}
```

#### Test 5.2: Correct Match Count
```php
function testCorrectMatchCount($playerCount) {
    $championship = createTournament($playerCount);

    foreach ($championship->rounds as $round) {
        $roundConfig = $championship->getRoundConfig($round->round_number);
        $expectedMatches = $roundConfig['match_count'];
        $actualMatches = $round->matches->count();

        assertEquals(
            $expectedMatches,
            $actualMatches,
            "Round {$round->round_number}: Match count mismatch!"
        );
    }
}
```

#### Test 5.3: Top K is Power of 2
```php
function testTopKIsPowerOf2($playerCount) {
    $structure = TournamentStructureCalculator::calculateStructure($playerCount);
    $topK = $structure['top_k'];

    if ($topK > 0) {
        // Check if power of 2
        assertTrue(
            ($topK & ($topK - 1)) === 0,
            "Top K ({$topK}) is not a power of 2!"
        );

        assertTrue(
            $topK >= 4 || $topK === 2,
            "Top K ({$topK}) must be >= 4 or exactly 2!"
        );
    }
}
```

#### Test 5.4: Elimination Participant Count
```php
function testEliminationParticipantCount($playerCount) {
    $championship = createTournament($playerCount);

    foreach ($championship->getEliminationRounds() as $roundNumber) {
        $roundConfig = $championship->getRoundConfig($roundNumber);
        $expectedParticipants = $roundConfig['top_k'];
        $round = Round::where('round_number', $roundNumber)->first();

        // Count unique participants in elimination round
        $participants = [];
        foreach ($round->matches as $match) {
            if ($match->white_player_id) $participants[] = $match->white_player_id;
            if ($match->black_player_id) $participants[] = $match->black_player_id;
        }
        $uniqueParticipants = array_unique($participants);

        assertEquals(
            $expectedParticipants,
            count($uniqueParticipants),
            "Round {$roundNumber}: Participant count mismatch in elimination!"
        );
    }
}
```

#### Test 5.5: No Duplicate Pairings in Same Round
```php
function testNoDuplicatePairings($playerCount) {
    $championship = createTournament($playerCount);

    foreach ($championship->rounds as $round) {
        $pairings = [];

        foreach ($round->matches as $match) {
            $pair = [
                min($match->white_player_id, $match->black_player_id),
                max($match->white_player_id, $match->black_player_id)
            ];
            $pairKey = implode('-', $pair);

            assertFalse(
                in_array($pairKey, $pairings),
                "Round {$round->round_number}: Duplicate pairing detected ({$pairKey})!"
            );

            $pairings[] = $pairKey;
        }
    }
}
```

---

## Comprehensive Test Execution Plan

### Phase 1: Unit Tests
```bash
# Test calculator for all sizes
php artisan test --filter TournamentStructureCalculatorTest

# Test for specific sizes
for P in 2 4 6 7 8 10 12 16 20 24 32 48 64; do
    php artisan test:tournament-structure $P
done
```

### Phase 2: Integration Tests
```bash
# Create actual tournaments and validate
php artisan test --filter TournamentGenerationTest

# Test Swiss pairing for all sizes
php artisan test --filter SwissPairingServiceTest
```

### Phase 3: Edge Case Tests
```bash
# Test odd numbers
php artisan test --filter OddPlayerCountTest

# Test prime numbers
php artisan test --filter PrimePlayerCountTest
```

### Phase 4: Invariant Validation
```bash
# Run all invariant checks
php artisan test --filter InvariantValidationTest
```

---

## Success Criteria

### ALL tests MUST pass for ALL player counts in range [2, 128]

**Critical Success Metrics**:
- ✅ No missing players in any Swiss round
- ✅ Correct match count in every round
- ✅ Top K is always power of 2
- ✅ Correct participant count in elimination rounds
- ✅ No duplicate pairings in same round
- ✅ Round numbers are consecutive (1, 2, 3, ...)
- ✅ Total rounds = Swiss rounds + Elimination rounds
- ✅ All invariants hold for ALL player counts

**Performance Metrics**:
- ⚡ Structure calculation < 100ms
- ⚡ Pairing generation < 5s for P <= 128
- ⚡ Validation < 1s for any size

---

## Developer Action Items

1. **Implement** all code from `FULL_IMPLEMENTATION_CODE.md`
2. **Create** unit tests in `TournamentStructureCalculatorTest.php`
3. **Run** Test Suite 1 (2-16 players) - MUST pass 100%
4. **Run** Test Suite 2 (17-32 players) - MUST pass 100%
5. **Run** Test Suite 3 (33-64 players) - MUST pass 100%
6. **Run** Test Suite 4 (Edge cases) - MUST pass 100%
7. **Run** Test Suite 5 (Invariants) - MUST pass 100%
8. **Validate** with visualizer at `/tournament_db_visualizer.html`
9. **Document** any failures with exact reproduction steps
10. **Fix** all failures before deployment

---

## Failure Reporting Template

```
Test Failed: [Test Name]
Player Count: [P]
Expected: [What should happen]
Actual: [What actually happened]
Round Number: [N]
Error Message: [Full error]
Data Dump: [Relevant data]
Reproduction Steps: [How to reproduce]
```

