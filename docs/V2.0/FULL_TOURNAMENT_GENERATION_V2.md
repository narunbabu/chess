# Full Tournament Generation System (v2.0) - REVISED

**Status**: 🔄 **REQUIRES BACKEND UPDATES** (Phase 1-3 Partial)
**Date**: December 3, 2025
**Version**: 2.0.0 - FIDE-Compliant

---

## 🎯 Overview

Enhanced Tournament Generation System with **FIDE-compliant Swiss rounds** and improved elimination bracket logic. This revision addresses limitations in v1.0 and aligns with official chess tournament standards.

### Key Improvements

✅ **Minimum 3 Swiss Rounds** - Up from 2 (for 5+ players)
✅ **Score Bracket Pairing** - FIDE-compliant vs global ranking
✅ **Color Balance Enforcement** - ±2 difference + no 3x consecutive same
✅ **Bye Consecutive Prevention** - Same player can't get bye 2x in a row
✅ **Enhanced Tiebreakers** - Buchholz Cut 1 + Sonneborn-Berger
✅ **Stable Seeding** - More Swiss rounds before elimination

---

## 📊 Architecture Updates

### Database Layer Enhancements

```sql
-- New fields for color tracking and bye management
ALTER TABLE championship_matches ADD COLUMN player1_color VARCHAR(10) NULL;
ALTER TABLE championship_matches ADD COLUMN player2_color VARCHAR(10) NULL;
ALTER TABLE championship_matches ADD COLUMN bye_player_id BIGINT NULL;

-- Track bye history per championship
ALTER TABLE championships ADD COLUMN bye_history JSON NULL COMMENT 'Track bye allocation per round';

-- Color difference tracking
ALTER TABLE user_championship_participation ADD COLUMN 
  color_balance JSON NULL COMMENT '{"white": 0, "black": 0, "difference": 0}';
```

### Value Objects (Updated)

#### TournamentConfig v2.0
```php
class TournamentConfig {
    public int $total_rounds;
    public int $swiss_rounds;           // NEW: Minimum 3 for 5+
    public int $bye_points;              // NEW: 0, 0.5, or 1.0
    public bool $enforce_color_balance; // NEW: Strict enforcement
    public bool $prevent_consecutive_byes; // NEW
    public array $round_structure;      // Enhanced
    public array $pairing_methods;      // Enhanced
}
```

---

## 🎮 Revised Tournament Presets

### Small Tournament (3-10 participants) - REVISED

```json
{
  "preset": "small_tournament",
  "mode": "swiss_with_elimination",
  "swiss_rounds": 3,           // Increased from 2
  "total_rounds": 6,
  "bye_points": 0.5,           // Changed from 1.0
  "structure": [
    {
      "round": 1,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "rating_seeded",  // NEW
      "color_strategy": "alternate"
    },
    {
      "round": 2,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket",  // NEW: FIDE-compliant
      "color_strategy": "balanced"
    },
    {
      "round": 3,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket",
      "color_strategy": "balanced"
    },
    {
      "round": 4,
      "type": "semi_final",
      "participants": {"top_k": 4},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded",
      "color_strategy": "balanced"
    },
    {
      "round": 5,
      "type": "third_place",
      "participants": "semi_final_losers",
      "matches_per_player": 1,
      "pairing_method": "direct"
    },
    {
      "round": 6,
      "type": "final",
      "participants": "semi_final_winners",
      "matches_per_player": 1,
      "pairing_method": "direct"
    }
  ]
}
```

**Example (5 participants)**:
- Round 1: 3 matches (5 players, 1 bye) - Swiss
- Round 2: 3 matches (5 players, 1 bye) - Swiss, standings-based
- Round 3: 3 matches (5 players, 1 bye) - Swiss, standings-based
- Round 4: 2 matches (top 4) - Semi-finals
- Round 5: 1 match (SF losers) - Third place
- Round 6: 1 match (SF winners) - Final
- **Total: 13 matches** (1 increase due to bye.5 points)

### Medium Tournament (11-30 participants) - REVISED

```json
{
  "preset": "medium_tournament",
  "swiss_rounds": 3,
  "total_rounds": 7,
  "bye_points": 0.5,
  "structure": [
    {
      "round": 1,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "rating_pools",      // NEW: Pool-based
      "color_strategy": "alternate"
    },
    {
      "round": 2,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket",
      "color_strategy": "balanced"
    },
    {
      "round": 3,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket",
      "color_strategy": "balanced"
    },
    {
      "round": 4,
      "type": "quarter_final",
      "participants": {"top_k": 8},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded"
    },
    {
      "round": 5,
      "type": "semi_final",
      "participants": {"top_k": 4},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded"
    },
    {
      "round": 6,
      "type": "third_place",
      "participants": "semi_final_losers",
      "matches_per_player": 1,
      "pairing_method": "direct"
    },
    {
      "round": 7,
      "type": "final",
      "participants": "semi_final_winners",
      "matches_per_player": 1,
      "pairing_method": "direct"
    }
  ]
}
```

**Example (16 participants)**:
- Rounds 1-3: Swiss (3 rounds, all 16 players)
- Round 4: Quarter-finals (top 8)
- Round 5: Semi-finals (top 4)
- Round 6: Third place match
- Round 7: Final
- **Total: 24 matches**

### Large Tournament (>30 participants) - REVISED

```json
{
  "preset": "large_tournament",
  "swiss_rounds": 4,           // Increased from 3
  "total_rounds": 9,
  "bye_points": 0.5,
  "structure": [
    {
      "round": 1,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "rating_pools"
    },
    {
      "round": 2,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket"
    },
    {
      "round": 3,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket"
    },
    {
      "round": 4,
      "type": "swiss",
      "participants": "all",
      "matches_per_player": 1,
      "pairing_method": "score_bracket"
    },
    {
      "round": 5,
      "type": "round_of_16",
      "participants": {"top_k": 16},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded"
    },
    {
      "round": 6,
      "type": "quarter_final",
      "participants": {"top_k": 8},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded"
    },
    {
      "round": 7,
      "type": "semi_final",
      "participants": {"top_k": 4},
      "matches_per_player": 1,
      "pairing_method": "bracket_seeded"
    },
    {
      "round": 8,
      "type": "third_place",
      "participants": "semi_final_losers",
      "matches_per_player": 1,
      "pairing_method": "direct"
    },
    {
      "round": 9,
      "type": "final",
      "participants": "semi_final_winners",
      "matches_per_player": 1,
      "pairing_method": "direct"
    }
  ]
}
```

---

## 🧠 Pairing Methods (Enhanced)

### 1. `rating_seeded`
**For**: Round 1 (initial seeding)
- Divide players into rating pools (Top 25%, 25-50%, 50-75%, 75-100%)
- Pair randomly within pools
- Ensures balanced first-round matchups

### 2. `rating_pools`
**For**: Round 1 with 20+ players
- Create 4 pools by rating
- Pair top vs bottom within pools
- Prevents all top players meeting early

### 3. `score_bracket` ⭐ NEW - FIDE COMPLIANT
**For**: Swiss rounds 2+
- **Process**:
  1. Group players by exact score (score brackets)
  2. Split each bracket: upper half vs lower half
  3. Pair: upper1 vs lower1, upper2 vs lower2, etc.
  4. Check for repeat matches, transpose if needed
  5. If bracket unpaired, drop to next bracket
- **Advantages**: Fairness, prevents lopsided matches
- **Implementation**: See section "Score Bracket Pairing Algorithm"

### 4. `bracket_seeded`
**For**: Elimination rounds
- 1v8, 2v7, 3v6, 4v5 (for 8 players)
- 1v4, 2v3 (for 4 players)
- Direct seeding from standings

### 5. `direct`
**For**: Finals
- Exactly 2 players
- No algorithm needed

---

## 🔄 Score Bracket Pairing Algorithm - NEW SECTION

### Step-by-Step Process

**Input**: Tournament standings after Round N-1

**Output**: Pairings for Round N

#### Step 1: Group into Score Brackets

```python
score_brackets = {}
for player in standings:
    score = player.total_points
    if score not in score_brackets:
        score_brackets[score] = []
    score_brackets[score].append(player)

# Result: {3.0: [P1, P2], 2.5: [P3, P4, P5], 2.0: [P6, P7, P8]}
```

#### Step 2: Process Each Bracket

```python
def pair_score_bracket(bracket, previous_pairings, bye_history):
    if len(bracket) == 1:
        # Single player - assign bye if not consecutive
        if can_receive_bye(bracket[0], bye_history):
            return (bracket[0], BYE)
        else:
            # Move to next bracket
            return MOVE_TO_NEXT_BRACKET
    
    if len(bracket) == 2:
        # Two players - check repeat
        if has_played_before(bracket[0], bracket[1], previous_pairings):
            return CANNOT_PAIR_IN_BRACKET
        else:
            return (bracket[0], bracket[1])
    
    if len(bracket) > 2:
        # Split upper/lower
        mid = len(bracket) // 2
        upper = bracket[:mid]
        lower = bracket[mid:]
        
        pairings = []
        for i in range(len(upper)):
            p1 = upper[i]
            p2 = lower[i]
            
            # Check repeat match
            if has_played_before(p1, p2):
                # Transpose in lower half
                p2 = transpose_in_lower(lower, i, p1, previous_pairings)
            
            pairings.append((p1, p2))
        
        return pairings
```

#### Step 3: Handle Unpaired Players

```python
def handle_unpaired(unpaired_player, next_bracket):
    # Move unpaired player to next bracket
    # Pair them first before normal bracket pairing
    # Allows them to play up (slightly lower score)
    # More fair than forcing bye
```

#### Step 4: Apply Color Constraints

```python
def assign_colors(pairing, color_history):
    p1, p2 = pairing
    
    # Get color balance for each player
    p1_balance = get_color_balance(p1)
    p2_balance = get_color_balance(p2)
    
    # Rule 1: Check if anyone MUST get opposite color
    if p1_balance.difference >= 2:    # P1 has 2+ extra White
        return (p1, "black"), (p2, "white")
    
    if p2_balance.difference >= 2:    # P2 has 2+ extra White
        return (p1, "white"), (p2, "black")
    
    # Rule 2: Prevent 3 consecutive same colors
    if has_3_consecutive_white(p1):
        return (p1, "black"), (p2, "white")
    
    if has_3_consecutive_black(p1):
        return (p1, "white"), (p2, "black")
    
    # Rule 3: Preference (if no absolute violations)
    # Try to give opposite color from last round
    last_color_p1 = get_last_color(p1)
    if last_color_p1 == "white":
        return (p1, "black"), (p2, "white")
    
    # Default: P1 gets white (by convention)
    return (p1, "white"), (p2, "black")
```

#### Step 5: Handle Byes

```python
def assign_bye(bracket, bye_history):
    # Preferences (in order):
    # 1. Player who never had bye
    # 2. Player with lowest rating (handicap)
    # 3. Random (if tied)
    
    # Never: Same player consecutive rounds
    
    candidates = [p for p in bracket if not had_bye_last_round(p)]
    
    if not candidates:
        # Emergency: All had bye? Allow if 3+ rounds since last
        candidates = [p for p in bracket if not had_bye_within_2_rounds(p)]
    
    if candidates:
        # Pick lowest rated
        bye_recipient = min(candidates, key=lambda p: p.rating)
        bye_recipient.points += bye_points  # 0.5 or 1.0
        return bye_recipient
    else:
        # Should never reach - log error
        return random.choice(bracket)
```

---

## 🎯 Elimination Round Seeding - ENHANCED

### Bracket Seeding Pattern

```
8 Players (Quarter-Finals):
1. Alice (2.5 pts) ─┐
                    ├─ SF1 Winner → Final (1v4)
8. Henry (0.5 pts) ┘
                                    ┌─ Champion
4. David (1.5 pts) ─┐              ├─
                    ├─ SF2 Winner  └─ Runner-up
5. Eve (1.5 pts) ──┘

2. Bob (2.0 pts) ──┐
                   ├─ SF3 Winner → Final (2v3)
7. Grace (1.0 pts)┘
                                  ┌─ Third Place
3. Charlie (2.0 pts)─┐           ├─
                     ├─ SF4 Winner┘
6. Frank (1.0 pts) ─┘
```

### Seeding Formula

```
For N players advancing:
- Seed 1: Highest points
- Seed N: Lowest points
- Seed 2: Second highest
- Seed N-1: Second lowest
- Pattern: 1, 2, 3, ... N/2 on one side
           N, N-1, N-2, ... (N/2)+1 on other side

Matchups:
- 1 vs N
- 2 vs N-1
- 3 vs N-2
- 4 vs N-3
```

---

## 🔒 Round Locking Logic - REVISED

### Unlocking Conditions (Critical Change)

| Phase | Round | Unlocks When | Status |
|-------|-------|------------|--------|
| **Swiss** | 1 | Tournament starts | Unlocked |
| **Swiss** | 2 | Round 1 **100% complete** | When all matches done |
| **Swiss** | 3 | Round 2 **100% complete** | When all matches done |
| **Swiss** | 3+ | Round N-1 **100% complete** | When all matches done |
| **Elimination** | Any | **ALL Swiss rounds complete** + Previous elim complete | After complete Swiss |

**Key Change**: Eliminat cannot start until ALL Swiss are done (not just "after 2 rounds")

### Lock Enforcement

```php
function canUnlockRound($round) {
    $championship = $round->championship;
    
    // Round 1 always unlocked
    if ($round->round_number === 1) {
        return true;
    }
    
    // Swiss rounds: Previous must be 100% complete
    if ($round->is_swiss_round()) {
        $previousRound = $round->championship->rounds()
            ->where('round_number', $round->round_number - 1)
            ->first();
        
        return $previousRound->isComplete();  // ALL matches done
    }
    
    // Elimination rounds: ALL Swiss must be complete
    if ($round->is_elimination_round()) {
        $swissRounds = $championship->rounds()
            ->where('round_type', 'swiss')
            ->get();
        
        foreach ($swissRounds as $swissRound) {
            if (!$swissRound->isComplete()) {
                return false;  // Still waiting for Swiss
            }
        }
        
        // Previous elimination also complete
        $previousElim = $championship->rounds()
            ->where('round_number', '<', $round->round_number)
            ->where('round_type', '!=', 'swiss')
            ->orderByDesc('round_number')
            ->first();
        
        return $previousElim ? $previousElim->isComplete() : true;
    }
    
    return false;
}
```

---

## 🎲 Configuration Presets - Quick Reference

### Preset Selection Guide

```
Tournament Size | Recommended Preset
3-5 players    | small_tournament
6-15 players   | medium_tournament  
16-50 players  | large_tournament
51+ players    | custom (need to design)
```

### Customization Options

```json
{
  "swiss_rounds": 3,              // 2-5, default 3
  "bye_points": 0.5,              // 0, 0.5, or 1.0
  "color_balance_strict": true,   // Enforce ±2 limit
  "prevent_consecutive_byes": true,
  "pairing_methods": {
    "round_1": "rating_seeded",
    "round_2": "score_bracket",
    "round_3": "score_bracket"
  }
}
```

---

## 📋 Migration Checklist - BACKEND REQUIRED

### ✅ Already Complete

- [x] Basic tournament generation framework
- [x] Elimination bracket logic
- [x] Third place match

### 🔴 CRITICAL - Must Implement

- [ ] Score bracket pairing algorithm
- [ ] Color balance tracking and enforcement
- [ ] Consecutive bye prevention
- [ ] Minimum 3 Swiss rounds validation
- [ ] Lock elimination until ALL Swiss complete
- [ ] Tiebreaker update (Buchholz Cut 1)

### 🟡 Important - Should Implement

- [ ] Color assignment at match creation
- [ ] Bye history tracking
- [ ] Rating pools for Round 1
- [ ] Enhanced standings calculation

### 🟢 Optional - Nice to Have

- [ ] Color balance UI visualization
- [ ] Bye history display
- [ ] Tournament statistics dashboard
- [ ] Export bracket as PDF

---

## 🚀 Implementation Priority

### Phase 1 (CRITICAL - 1-2 weeks)
1. Score bracket pairing algorithm
2. Update round locking logic (ALL Swiss required)
3. Color balance enforcement (±2, no 3x same)
4. Minimum 3 Swiss rounds validation

### Phase 2 (Important - 1 week)
1. Consecutive bye prevention
2. Bye history tracking
3. Tiebreaker updates (Buchholz Cut 1)
4. API endpoint updates

### Phase 3 (Enhancement - 1 week)
1. UI for color constraints
2. Standings visualization
3. Tournament statistics
4. Test suite completion

---

## 🧪 Test Cases - Updated

### Test 1: Score Bracket Pairing
```
5 players after Round 1:
- A: 1.0 pt
- B: 1.0 pt
- C: 0.5 pt
- D: 0.5 pt
- E: 0.5 pt (previously had bye)

Expected Round 2 pairing (score bracket):
├─ 1.0 bracket: A vs B (only pair in this bracket)
├─ 0.5 bracket: (C, D, E - odd count)
│  └─ C vs D (higher ratings)
│  └─ E: BYE (but not consecutive if had bye R1)
```

### Test 2: Color Balance Enforcement
```
Player X color history after Round 3:
- R1: White
- R2: Black
- R3: White
- Balance: +1 White (1-0 difference)

Round 4 assignment:
- X has W, B, W → Next MUST be Black
- Enforce: X gets Black in R4 ✅
```

### Test 3: Lock Timing
```
5-Player Tournament:
- R1 Swiss: 2 matches (3 players, 1 bye)
  - Status: Play in progress
  - R2 locked? YES ✅
  
- R1 Swiss: Complete
  - R2 locked? NO ✅ (Can unlock)
  
- R1, R2, R3 Swiss: All complete
  - R4 Semi-final locked? NO ✅ (Can unlock)
  
- R1 or R2 Swiss: NOT complete
  - R4 Semi-final locked? YES ✅ (Waiting for Swiss)
```

---

## 📖 References

- **FIDE Handbook**: C.04 Swiss System Rules
- **FIDE Laws of Chess**: Part A (Laws of Chess)
- **Tournament Principles (v2.0)**: See separate document

---

## Summary of Changes from v1.0 to v2.0

| Feature | v1.0 | v2.0 | Impact |
|---------|------|------|--------|
| Swiss rounds | 2 minimum | 3 minimum | Better seeding |
| Pairing method | Global ranking | Score brackets | FIDE compliant |
| Color constraints | Basic | Strict (±2, no 3x) | Fairer distribution |
| Bye handling | Allow consecutive | Prevent consecutive | More player choice |
| Elimination lock | After 2 Swiss | After ALL Swiss | Stable brackets |
| Bye points | 1.0 default | 0.5 default | Less distortion |
| Tiebreakers | Standard | Buchholz Cut 1 | Better ranking |

---

**Created**: December 3, 2025
**Status**: REQUIRES BACKEND IMPLEMENTATION
**Priority**: HIGH (FIDE compliance mandatory)