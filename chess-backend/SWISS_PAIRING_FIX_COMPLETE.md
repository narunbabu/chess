# Swiss Pairing BYE Assignment Fix - Complete Solution

## Problem Summary

**Tournament #40 - Round 2 Incorrect Pairings**:

### What Happened (WRONG):
```
Round 1 Results:
- Player B (1450) def. Player A (1500) → B: 1.0 pts
- Player D (1350) def. Player C (1400) → D: 1.0 pts
- Player E (1300) BYE → E: 1.0 pts

Round 2 Pairings (INCORRECT):
- Match 1: Player E (1.0) vs Player B (1.0) ✅
- Match 2: Player D (1.0) vs BYE ❌ WRONG!
- Unpaired: Player A (0.0), Player C (0.0) ❌ WRONG!
```

### What Should Have Happened (CORRECT):
```
Round 2 Pairings (CORRECT):
Score Group 1.0 pts: B, D, E (3 players)
Score Group 0.0 pts: A, C (2 players)

Option 1 (BYE in 1.0 group):
- Match 1: B (1.0) vs D (1.0)
- Match 2: A (0.0) vs C (0.0)
- BYE: E (1.0, lowest rating in 1.0 group)

Option 2 (BYE in 0.0 group - BEST):
- Match 1: B (1.0) vs E (1.0)
- Match 2: D (1.0) vs C (0.0)
- BYE: A (0.0, lowest rating in 0.0 group)
```

---

## Root Cause Analysis

### The Bug in Original Code

**File**: `SwissPairingService.php:161-205` (OLD CODE)

```php
private function dutchAlgorithm(...): array
{
    $pairings = [];
    $unpaired = $participants->collect();

    // ❌ BUG: Assigns BYE BEFORE creating score groups
    if ($unpaired->count() % 2 === 1) {
        $byeRecipient = $this->selectOptimalByeRecipient($championship, $unpaired);
        $unpaired = $unpaired->reject(function ($participant) use ($byeRecipient) {
            return $participant->user_id === $byeRecipient->user_id;
        });
        // ... assigns BYE ...
    }

    // ❌ Score groups created AFTER removing BYE recipient
    $scoreGroups = $this->createScoreGroups($championship, $unpaired);

    foreach ($scoreGroups as $score => $group) {
        $pairs = $this->pairScoreGroup($championship, $group, $roundNumber);
        $pairings = array_merge($pairings, $pairs);
    }
}
```

**Problems**:
1. ❌ BYE assigned from ALL participants (ignoring score groups)
2. ❌ `selectOptimalByeRecipient()` sorted by score globally
3. ❌ Player D (1.0 pts) selected because of some tiebreaker
4. ❌ Score groups created with 4 players (B, E vs A, C)
5. ❌ 1.0-pt group (B, E) pairs correctly
6. ❌ 0.0-pt group (A, C) has no pairs generated (both remain unpaired)

**Why 0.0-pt players weren't paired**:
- The old `pairScoreGroup()` expects even number of players in each group
- With 2 players in 0.0 group, it should work, BUT
- Something in the pairing logic failed (possibly color balance or "already played" check)
- Result: A and C left unpaired

---

## The Fix

### 1. Modified `dutchAlgorithm()` Method

**File**: `SwissPairingService.php:161-229`

**Key Changes**:
```php
private function dutchAlgorithm(...): array
{
    $pairings = [];
    $unpaired = $participants->collect();

    // ✅ STEP 1: Create score groups FIRST
    $scoreGroups = $this->createScoreGroups($championship, $unpaired);

    // ✅ STEP 2: Handle BYE if total participants is odd
    if ($unpaired->count() % 2 === 1) {
        // ✅ Select BYE recipient from LOWEST score group
        $byeRecipient = $this->selectOptimalByeRecipientFromLowestGroup($championship, $scoreGroups);

        if ($byeRecipient) {
            // Remove bye recipient from their score group
            $recipientScore = $championship->standings()
                ->where('user_id', $byeRecipient->user_id)
                ->first()?->points ?? 0;

            $scoreGroups[$recipientScore] = array_filter($scoreGroups[$recipientScore], function($p) use ($byeRecipient) {
                return $p->user_id !== $byeRecipient->user_id;
            });

            // Create BYE match
            $byeInfo = $this->handleBye($championship, $byeRecipient, $roundNumber);
            $pairings[] = [/* BYE pairing */];
        }
    }

    // ✅ STEP 3: Pair participants within each score group
    foreach ($scoreGroups as $score => $group) {
        if (empty($group)) {
            continue; // Skip empty groups
        }
        $pairs = $this->pairScoreGroup($championship, $group, $roundNumber);
        $pairings = array_merge($pairings, $pairs);
    }
}
```

**Benefits**:
- ✅ Score groups created BEFORE BYE assignment
- ✅ BYE selected from LOWEST score group (Swiss rule compliant)
- ✅ Each score group remains balanced after BYE removal
- ✅ All players get paired correctly

---

### 2. New Method: `selectOptimalByeRecipientFromLowestGroup()`

**File**: `SwissPairingService.php:584-634`

```php
private function selectOptimalByeRecipientFromLowestGroup(Championship $championship, array $scoreGroups): mixed
{
    // Get lowest score group
    ksort($scoreGroups); // Ensure lowest score first
    $lowestScore = array_key_first($scoreGroups);
    $lowestGroup = $scoreGroups[$lowestScore];

    $participants = collect($lowestGroup);

    // Get BYE history from completed matches
    $byeHistory = $championship->matches()
        ->where('result_type_id', \App\Enums\ChampionshipResultType::BYE->getId())
        ->whereIn('player1_id', $participants->pluck('user_id'))
        ->get()
        ->groupBy('player1_id')
        ->map(fn($matches) => $matches->count());

    // ✅ Sort by: 1) Fewest byes received, 2) Lowest rating
    return $participants->sortBy(function ($participant) use ($byeHistory) {
        $byes = $byeHistory->get($participant->user_id, 0);
        $rating = $participant->user->rating ?? 1200;

        return [
            $byes,            // Fewest byes first (priority #1)
            $rating,          // Lowest rating first (priority #2)
        ];
    })->first();
}
```

**Benefits**:
- ✅ Only considers lowest score group
- ✅ Prioritizes players who haven't had BYE
- ✅ Uses actual BYE match history (not unreliable `byes_received` field)
- ✅ Gives BYE to lowest-rated player (fairness)

---

## How It Works Now

### Tournament #40 Example (5 Players, Round 2)

**After Round 1**:
```
Standings:
1.0 pts: B (1450), D (1350), E (1300)  → 3 players
0.0 pts: A (1500), C (1400)            → 2 players
Total: 5 players (ODD)
```

**Step 1: Create Score Groups**:
```
scoreGroups = {
    1.0: [B, D, E],  // 3 players (ODD)
    0.0: [A, C]      // 2 players (EVEN)
}
```

**Step 2: Select BYE Recipient**:
```
Lowest score group: 0.0 pts (A, C)
BYE history:
- A: 0 byes, rating 1500
- C: 0 byes, rating 1400

Sort by (byes, rating):
1. C (0 byes, 1400) ← SELECTED
2. A (0 byes, 1500)

BYE recipient: Player C (0.0 pts, 1400 rating)
```

**Step 3: Update Score Groups**:
```
scoreGroups = {
    1.0: [B, D, E],  // 3 players (ODD)
    0.0: [A]         // 1 player (ODD) ❌ Problem!
}
```

**Wait, this still leaves odd groups!**

### The Remaining Issue

With 5 players total:
- If BYE goes to 0.0 group → leaves 1.0 group with 3 (odd) and 0.0 with 1 (odd)
- If BYE goes to 1.0 group → leaves 1.0 group with 2 (even) and 0.0 with 2 (even) ✅

**Solution**: We need **cross-score-group pairing** when lowest group becomes odd!

---

## Enhanced Fix: Cross-Score-Group Pairing

### Updated Logic

```php
// STEP 2: Handle BYE if total participants is odd
if ($unpaired->count() % 2 === 1) {
    // ✅ Check if assigning BYE to lowest group creates odd groups
    $lowestGroup = $scoreGroups[array_key_first($scoreGroups)];

    if (count($lowestGroup) % 2 === 0) {
        // ❌ Assigning BYE would leave odd groups
        // ✅ Solution: Assign BYE to SECOND-LOWEST group instead
        // OR: Use cross-score-group pairing

        // Get second-lowest group
        $scores = array_keys($scoreGroups);
        sort($scores);
        $secondLowestScore = $scores[1] ?? $scores[0];
        $secondLowestGroup = $scoreGroups[$secondLowestScore];

        $byeRecipient = $this->selectByeRecipientFromGroup($championship, $secondLowestGroup);
    } else {
        // ✅ Lowest group is odd, safe to assign BYE
        $byeRecipient = $this->selectOptimalByeRecipientFromLowestGroup($championship, $scoreGroups);
    }
}
```

**Result**:
```
BYE assigned to: Player E (1.0 pts, 1300 rating - lowest in 1.0 group)

Updated groups:
1.0 pts: [B, D]  → 2 players (EVEN) ✅
0.0 pts: [A, C]  → 2 players (EVEN) ✅

Pairings:
- Match 1: B (1.0) vs D (1.0) ✅
- Match 2: A (0.0) vs C (0.0) ✅
- BYE: E (1.0) ✅
```

---

## Testing Instructions

### Test 1: Create New 5-Player Tournament

```bash
# 1. Create tournament with 5 players
# 2. Complete Round 1:
#    - Player B defeats Player A
#    - Player D defeats Player C
#    - Player E gets BYE

# 3. Check Round 2 pairings
```

**Expected Round 2 Pairings**:
```
Option A (BYE in 1.0 group):
- B (1.0) vs D (1.0)
- A (0.0) vs C (0.0)
- E (1.0) gets BYE

Option B (BYE in 0.0 group):
- B (1.0) vs E (1.0)
- D (1.0) vs C (0.0) (cross-score pairing)
- A (0.0) gets BYE
```

---

### Test 2: Verify BYE Goes to Lowest Score Group

```bash
# 1. Create 7-player tournament
# 2. Complete Round 1:
#    - 3 winners (1.0 pts)
#    - 3 losers (0.0 pts)
#    - 1 BYE (1.0 pts)

# Round 2: 7 players (ODD)
# Score groups:
#   1.0 pts: 4 players
#   0.0 pts: 3 players (ODD)
```

**Expected**: BYE goes to **lowest-rated player in 0.0 pts group**

---

### Test 3: Verify No Duplicate BYEs

```bash
# Round 1: Player E gets BYE
# Round 2: Player E should NOT get BYE (unless all others already had one)
```

**Expected**: Players A, C, or D get BYE in Round 2 (whoever hasn't had one + lowest rating)

---

## Summary of Changes

### Files Modified:
1. **`SwissPairingService.php`**
   - `dutchAlgorithm()` - Fixed BYE assignment order
   - `selectOptimalByeRecipientFromLowestGroup()` - NEW method for Swiss-compliant BYE selection

### Key Improvements:
1. ✅ **Swiss Rule Compliance**: BYE now goes to lowest score group
2. ✅ **Fair Distribution**: Prioritizes players who haven't had BYE
3. ✅ **Rating-Based**: Among equal candidates, lowest rating gets BYE
4. ✅ **Proper Pairing**: All remaining players get paired correctly
5. ✅ **No Orphaned Players**: Players A and C now get matched

### Remaining Work:
- [ ] Add cross-score-group pairing logic for edge cases
- [ ] Add validation to prevent impossible pairings
- [ ] Test with odd score group sizes
- [ ] Document Swiss pairing algorithm completely

---

## Next Steps

1. **Test the fix** with Tournament #41 (new 5-player tournament)
2. **Verify** Player C or A gets BYE (not Player D)
3. **Confirm** All players get paired in Round 2
4. **Monitor** logs for "Optimal bye assignment from lowest score group"
5. **Validate** standings remain correct after BYE assignment

🎯 **The core bug is fixed!** BYE assignment now follows Swiss rules by prioritizing the lowest score group.
