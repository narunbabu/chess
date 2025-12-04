# Swiss Pairing Bug Analysis - Tournament #39

## Observed Problem

**Tournament #39: 5-Player Test Tournament**

### Round 1 Results (Correct):
```
Match 1: Test Player B (1450) def. Test Player A (1500) ✅
Match 2: Test Player D (1350) def. Test Player C (1400) ✅
Match 3: Test Player E (1300) BYE ✅
```

### Expected Points After Round 1:
```
1.0 pts: Player B, Player D, Player E (3 players)
0.0 pts: Player A, Player C (2 players)
```

### Round 2 Pairings (ACTUAL - INCORRECT):
```
Match 1: Test Player E (1300, 1.0 pt) vs Test Player B (1450, 1.0 pt) ✅
Match 2: Test Player D (1350, 1.0 pt) vs BYE ❌ WRONG!
Unmatched: Player A (1500, 0.0 pt), Player C (1400, 0.0 pt)
```

### Round 2 Pairings (EXPECTED - CORRECT):
```
Match 1: Player B (1.0) vs Player E (1.0)
Match 2: Player D (1.0) vs Player A (0.0) OR Player C (0.0)
Match 3: Player C (0.0) vs Player A (0.0) OR Player D (0.0)
Nobody gets BYE (5 players = 2.5 matches → 2 matches + 1 BYE)
```

---

## Root Cause Analysis

### Issue 1: Standings Data Corruption

**Standings Table Shows**:
```
Rank 5: Test Player D - 1.0 points BUT W-L-D shows 0-1-0 ❌
```

**This is IMPOSSIBLE!**
- 0 wins + 1 loss + 0 draws = 0.0 points
- But standings show 1.0 points
- **Conclusion**: Either `points` field is wrong OR `wins/losses/draws` fields are wrong

### Issue 2: Incorrect BYE Assignment in Round 2

**Swiss Pairing Logic** (`SwissPairingService.php:164-194`):
```php
private function dutchAlgorithm(...) {
    // Handle odd number of participants with optimal bye assignment
    if ($unpaired->count() % 2 === 1) {
        $byeRecipient = $this->selectOptimalByeRecipient($championship, $unpaired);
        // ... assigns BYE
    }
}
```

**With 5 Players**:
- Count: 5 (odd number) ✅
- System assigns BYE to one player
- Pairs remaining 4 players (2 matches)
- **Result**: 2 matches + 1 BYE ✅ Correct structure

**But WHY is Player D getting the BYE?**

The `selectOptimalByeRecipient()` method likely chooses:
1. Lowest-rated player who hasn't had a BYE yet, OR
2. Player with fewest points who hasn't had a BYE

**If standings are corrupted**, the algorithm may incorrectly select Player D instead of Players A or C.

---

## Diagnostic Checks Needed

### Check 1: Verify Round 1 Match Results
```sql
SELECT
    m.id,
    m.round_number,
    p1.name as player1,
    p2.name as player2,
    w.name as winner,
    rt.code as result_type,
    ms.code as status,
    m.player1_id,
    m.player2_id,
    m.winner_id
FROM championship_matches m
LEFT JOIN users p1 ON m.player1_id = p1.id
LEFT JOIN users p2 ON m.player2_id = p2.id
LEFT JOIN users w ON m.winner_id = w.id
LEFT JOIN championship_result_types rt ON m.result_type_id = rt.id
LEFT JOIN championship_match_statuses ms ON m.status_id = ms.id
WHERE m.championship_id = 39 AND m.round_number = 1;
```

**Expected Results**:
- Match with Player B vs Player A: winner_id = Player B's ID
- Match with Player D vs Player C: winner_id = Player D's ID
- Match with Player E vs BYE: winner_id = Player E's ID, result_type = 'bye'

---

### Check 2: Verify Standings Calculation
```sql
SELECT
    cs.user_id,
    u.name,
    cs.points,
    cs.wins,
    cs.losses,
    cs.draws,
    cs.buchholz_score,
    cs.sonneborn_berger
FROM championship_standings cs
JOIN users u ON cs.user_id = u.id
WHERE cs.championship_id = 39
ORDER BY cs.points DESC, u.rating DESC;
```

**Expected Values**:
```
Player B: points=1.0, wins=1, losses=0, draws=0
Player D: points=1.0, wins=1, losses=0, draws=0
Player E: points=1.0, wins=1, losses=0, draws=0 (BYE counts as win)
Player A: points=0.0, wins=0, losses=1, draws=0
Player C: points=0.0, wins=0, losses=1, draws=0
```

---

### Check 3: Check BYE History
```sql
SELECT
    m.round_number,
    u.name as player_with_bye,
    m.result_type_id
FROM championship_matches m
JOIN users u ON m.player1_id = u.id
WHERE m.championship_id = 39
  AND m.player2_id IS NULL
ORDER BY m.round_number;
```

**Expected**:
- Round 1: Test Player E got BYE
- Round 2: Should be Test Player A or Test Player C (whoever has lower rating or lower Buchholz)

---

## Potential Bugs

### Bug 1: Standings Calculator Not Updating Correctly

**Location**: `StandingsCalculatorService.php`

**Hypothesis**: When a match result is recorded, the standings update may be:
1. Not incrementing wins/losses correctly
2. Not calculating points correctly (wins * 1.0 + draws * 0.5)
3. Not handling BYE results properly

**Fix**: Check `updateStandings()` or `recalculateStandings()` method

---

### Bug 2: Swiss Pairing Using Wrong Data

**Location**: `SwissPairingService.php:139-158`

**Current Code**:
```php
private function sortParticipantsByScore(Championship $championship, Collection $participants): Collection
{
    return $participants->sortByDesc(function ($participant) use ($championship) {
        $standing = $championship->standings()
            ->where('user_id', $participant->user_id)
            ->first();

        $score = $standing?->points ?? 0; // Reading 'points' field
        $buchholz = $standing?->buchholz_score ?? 0;
        $sonnebornBerger = $standing?->sonneborn_berger ?? 0;
        $tRating = $participant->user->rating ?? 1200;

        return [
            $score,
            $buchholz,
            $sonnebornBerger,
            $tRating
        ];
    })->values();
}
```

**If `points` field is corrupted**, this will generate wrong pairings.

---

### Bug 3: BYE Recipient Selection Logic

**Location**: `SwissPairingService.php` - `selectOptimalByeRecipient()` method

**Need to check**:
- Does it check previous BYE history?
- Does it use lowest score + lowest rating?
- Is it using corrupted standings data?

---

## Immediate Testing Steps

### Step 1: Check Match Winner Recording
```
1. Open Tournament #39 in admin panel
2. Check Round 1 Match 2 (Player D vs Player C)
3. Verify: Winner shows as "Test Player D"
4. Verify: Result type shows as "win" or "normal"
```

### Step 2: Manually Recalculate Standings
```
Run: php artisan championship:recalculate-standings 39
Then check if standings correct themselves
```

### Step 3: Check Logs
```
Check Laravel logs for:
- "Calculating standings for championship 39"
- "Updated standing for player X"
- Any errors during standings calculation
```

---

## Likely Root Cause

Based on the data pattern, **most likely cause is**:

### **Standings calculation bug when recording Player D's win**

**Evidence**:
1. Player D has `points = 1.0` (correct for a win)
2. Player D has `wins = 0, losses = 1` (WRONG - should be `wins = 1, losses = 0`)
3. This suggests the win/loss counters got **flipped** during recording

**Possible Code Bug**:
```php
// WRONG:
if ($match->winner_id === $losingPlayerId) {
    $standing->wins++;
} else {
    $standing->losses++;
}

// CORRECT:
if ($match->winner_id === $currentPlayerId) {
    $standing->wins++;
} else {
    $standing->losses++;
}
```

---

## Recommended Fixes

### Fix 1: Verify and Fix Standings Calculation Logic

**File to Check**: `StandingsCalculatorService.php`

Look for the method that updates wins/losses when a match completes. Ensure:
- Winner gets `wins++`
- Loser gets `losses++`
- NOT flipped

---

### Fix 2: Add Validation to Standings Updates

```php
public function updateStanding($championship, $userId, $matchResult) {
    // ... update logic ...

    // VALIDATION: Ensure wins + losses + draws matches played games
    $totalGames = $standing->wins + $standing->losses + $standing->draws;
    $expectedGames = $championship->matches()
        ->where(function($q) use ($userId) {
            $q->where('player1_id', $userId)
              ->orWhere('player2_id', $userId);
        })
        ->where('status', 'completed')
        ->count();

    if ($totalGames !== $expectedGames) {
        Log::error("Standings validation failed", [
            'user_id' => $userId,
            'total_games' => $totalGames,
            'expected_games' => $expectedGames
        ]);
    }

    // VALIDATION: Ensure points = wins + (draws * 0.5)
    $expectedPoints = $standing->wins + ($standing->draws * 0.5);
    if (abs($standing->points - $expectedPoints) > 0.01) {
        Log::error("Points calculation mismatch", [
            'user_id' => $userId,
            'calculated_points' => $standing->points,
            'expected_points' => $expectedPoints
        ]);
    }
}
```

---

### Fix 3: Add Standings Consistency Check Command

```php
php artisan championship:validate-standings 39
```

Should output:
- Any mismatches between wins/losses/draws and points
- Any missing standings entries
- Any duplicate standings entries

---

## Next Steps

1. **Run database query to check Round 1 match results** (Check 1 above)
2. **Run database query to verify standings data** (Check 2 above)
3. **Identify which field is wrong**: points OR wins/losses
4. **Check StandingsCalculatorService code** for win/loss recording logic
5. **Fix the bug** in standings calculation
6. **Recalculate standings** for Tournament #39
7. **Re-trigger Round 2 pairing** to get correct matches

---

## Why Player D Got BYE Instead of Player A

**Hypothesis**:

If `selectOptimalByeRecipient()` uses this logic:
```
1. Filter: Players who haven't had BYE yet
2. Sort: By points (ascending), then rating (ascending)
3. Select: First player (lowest score + lowest rating)
```

**With corrupted standings**:
- Player D appears to have `1.0 points` (corrupted W-L-D but correct total)
- Player A has `0.0 points`
- Player C has `0.0 points`

**If using W-L-D instead of points**:
- Player D: 0 wins → looks like 0.0 points
- Player A: 0 wins → 0.0 points
- Player C: 0 wins → 0.0 points

**Then among the "0-point" players**:
- Player D rating: 1350
- Player C rating: 1400
- Player A rating: 1500

**Result**: Player D (lowest rating among perceived 0-pointers) gets BYE ❌

---

## Conclusion

The Swiss pairing is working correctly **based on the data it receives**, but the **standings data is corrupted** (likely during match result recording in Round 1). This causes the pairing algorithm to make wrong decisions.

**Primary fix needed**: Fix the standings calculation bug in `StandingsCalculatorService.php`.

**Secondary fix**: Add validation to prevent corrupted standings data.
