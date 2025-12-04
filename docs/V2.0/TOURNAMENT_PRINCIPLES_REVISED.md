# Chess Tournament System Core Principles (v2.0)

**Version**: 2.0 - REVISED
**Last Updated**: December 3, 2025
**Status**: Authoritative Reference - Updated for FIDE Compliance

---

## Overview

This document defines authoritative principles for chess tournaments, **aligned with FIDE (Fédération Internationale des Échecs) official regulations** and enhanced with platform-specific features for online competitive play.

---

## 1. Core Tournament Structure - REVISED

### Tournament Phases (Now 3 Distinct Phases)

Every tournament consists of three phases:

1. **Swiss Phase (Rounds 1-3 for small/medium, 1-4 for large)**
   - **All participants play** each round
   - **Purpose**: Rank all players by overall performance with stable standings
   - **Determines seeding** for elimination phase
   - **Minimum 3 rounds** recommended (up from 2 in v1.0)

2. **Elimination Phase** (Remaining rounds)
   - **Top-K players only** advance based on Swiss standings
   - **Single elimination** with proper bracket seeding
   - **Uses Swiss standings** for seed assignments

3. **Final Rankings Phase** (Publication)
   - **Hybrid ranking**: Positions 1-4 by match results, 5+ by standings
   - **Third place match** includes bronze medal determination
   - **Complete transparency** of final standings

---

## 2. FIDE-Compliant Swiss System Rules - NEW

### Fundamental Principles (FIDE C.04.1)

✅ **a) Predetermined Rounds**
- Number of rounds declared **before tournament starts**
- Cannot be changed mid-tournament

✅ **b) No Repeat Matches**
- Two players play **at most once** in entire tournament
- Enforced by pairing algorithm

✅ **c) Bye Rules** (REVISED)
- Odd number of players: one unpaired player per round
- **NEW RULE**: Same player cannot receive bye consecutively (FIDE C.04.2.d)
- Bye recipient gets +1.0 or +0.5 points (configurable)

✅ **d) Score-Based Pairing**
- Players paired with **same or nearest score**
- Creates natural "score brackets"

✅ **e) Color Balance** (FIDE C.04.1.f) - ENHANCED

**Absolute Constraint**:
- Color difference must NOT exceed ±2 for any player
- **NEW**: No player receives same color 3+ times in a row

**Application**:
```
After Round 4:
- Player A: 2 White, 2 Black (difference: 0) ✅
- Player B: 3 White, 1 Black (difference: +2) ⚠️ LIMIT REACHED
  → Player B must get Black in Round 5+

- Player C: 2 White, 1 Black, 1 White (last 3: W-B-W)
  → Player C must get White next (can't do 3 same colors)
```

---

## 3. Score Brackets - NEW SECTION

### Score Bracket System (FIDE C.04.2.A)

**Process** (must follow in order):

1. **Sort all players** by cumulative score
2. **Group into score brackets** (exact score groups)
   - All players with 5 points → Bracket A
   - All players with 4.5 points → Bracket B
   - All players with 4 points → Bracket C
   - etc.

3. **Split each bracket** into upper/lower halves
   - Bracket A (4 players): Top 2 (upper) vs Bottom 2 (lower)
   - Match 1: Upper1 vs Lower1
   - Match 2: Upper2 vs Lower2

4. **Transposition** (if pairing violations occur)
   - Swap within lower half to avoid repeat matches
   - Then swap with upper half if needed

5. **If bracket can't pair internally**:
   - Drop lowest-scored unpaired players to next bracket
   - Pair them there first (before normal bracket pairing)

**Example - 6 Players after Round 2**:

```
Score Distribution:
- 4.0 points: Players A, B (Bracket A)
- 3.0 points: Players C, D, E (Bracket B)
- 1.0 points: Player F (Bracket C)

Bracket A Pairing:
├─ Upper: A
├─ Lower: B
├─ Match: A vs B ✅

Bracket B Pairing (3 players - odd):
├─ Player E gets bye (lowest rated or random)
├─ Upper: C (higher rating in bracket)
├─ Lower: D
├─ Match: C vs D ✅

Bracket C:
└─ Player F (no one to pair with)
   → Will be "dropped" to pair with E's bye replacement
```

---

## 4. Swiss Round Pairings - REVISED

### Absolute Criteria (Must Always Enforce)

| Priority | Rule | Violation | Fix |
|----------|------|-----------|-----|
| 1 | **No repeat matches** | Players paired before | Transpose in lower half |
| 2 | **No consecutive byes** | Player had bye last round | Swap unpaired player |
| 3 | **Color balance ±2** | Difference exceeds ±2 | Force opposite color |
| 4 | **No 3 consecutive same color** | Player had same color 3x | Force opposite color |

### Relative Criteria (Apply in Order When Possible)

| Priority | Rule | Application |
|----------|------|-------------|
| 1 | **Pairing with equal score** | Primary goal |
| 2 | **Color preference** | Alternate colors if possible |
| 3 | **Transposition** | Reorder to avoid absolute violations |
| 4 | **Avoiding lopsided matches** | Top vs mid-bracket (only if necessary) |

### Pairing Algorithm Steps

1. ✅ Create score brackets (exact score grouping)
2. ✅ Check repeat matches in bracket
3. ✅ Check color balance and bye history
4. ✅ Apply color preference
5. ✅ Check for 3-color-in-a-row violations
6. ✅ Transpose within lower half (if needed)
7. ✅ Transpose across halves (if needed)
8. ✅ Drop to next bracket if unpaired

---

## 5. Tiebreaker Order - UNCHANGED (Already Correct)

### Ranking System

Players are ranked using this priority:

1. **Points** (primary)
   - Win = 1 point
   - Draw = 0.5 points
   - Loss = 0 points

2. **Buchholz Score** (first tiebreaker)
   - **Definition**: Sum of all opponents' points (only completed matches)
   - **Purpose**: Rewards strength of schedule
   - **Variation**: Buchholz Cut 1 (drop lowest opponent score)

3. **Sonneborn-Berger** (second tiebreaker)
   - **Definition**: (Defeated opponents' score) + (0.5 × Drawn opponents' score)
   - **Purpose**: Rewards beating/drawing strong opponents
   - **Formula**: Σ(opponent score when you scored)

4. **Direct Result** (third tiebreaker)
   - If tied players have played: winner of head-to-head
   - If not played yet: move to next tiebreaker

5. **Rating** (final tiebreaker)
   - Player's current Elo rating
   - Only used if all above tied

**Example - Buchholz vs Sonneborn-Berger**:

```
Tournament Results (4 rounds):
- All players on 2.5 points

Player A:
├─ Won vs Player D (1.5 pts) → +1.5
├─ Drew vs Player B (2.5 pts) → +0.5 × 2.5 = +1.25
├─ Won vs Player F (1.0 pts) → +1.0
└─ Lost vs Player C (3.0 pts) → +0 (loss)
Sonneborn-Berger: 1.5 + 1.25 + 1.0 = 3.75

Player B:
├─ Drew vs Player A (2.5 pts) → +0.5 × 2.5 = +1.25
├─ Won vs Player E (2.0 pts) → +2.0
├─ Drew vs Player F (1.0 pts) → +0.5 × 1.0 = +0.5
└─ Lost vs Player C (3.0 pts) → +0
Sonneborn-Berger: 1.25 + 2.0 + 0.5 = 3.75

Buchholz for both: 1.5 + 2.5 + 1.0 + 3.0 = 8.0

→ Need Buchholz Cut 1: Remove lowest opponent
→ A: 1.5 + 2.5 + 1.0 = 5.0 ✓ (higher)
→ B: 1.25 + 2.0 + 0.5 = 3.75 ✗ (lower)
→ A ranks higher
```

---

## 6. Swiss Phase Duration - REVISED

### Recommended Round Counts

| Tournament Size | Swiss Rounds | Reason |
|-----------------|-------------|--------|
| 3-4 players | 2 rounds | Minimal (not ideal) |
| 5-10 players | 3 rounds | **Standard** - More stable seeding |
| 11-30 players | 3-4 rounds | Allows more separation |
| 31+ players | 4-5 rounds | Multiple rating pools |

**NEW RULE**: Minimum 3 Swiss rounds for tournaments with 5+ players (changed from 2)

**Rationale**: 
- After 2 rounds: Possible for 2 players to have same score by chance
- After 3 rounds: Natural performance differences emerge
- Better seeding → More exciting elimination matches

---

## 7. Elimination Phase Structure - CLARIFIED

### When Players Are Determined

#### ✅ Swiss Rounds: FIXED Players (No Changes)

**Database storage**: Player IDs stored at generation time
- All participants confirmed
- No placeholders needed
- Immediate display

#### ✅ Elimination Rounds: PLACEHOLDER System (Unchanged)

**Database storage**: Player IDs = NULL initially
- Resolved at display time
- Based on current standings
- Dynamic bracket adjustment

### Elimination Round Types

| Round | Players | Seeding Pattern | Notes |
|-------|---------|-----------------|-------|
| **Round of 16** | 16 (top-16) | 1v16, 2v15, ..., 8v9 | Strongest vs Weakest |
| **Quarter-Final** | 8 (top-8) | 1v8, 2v7, 3v6, 4v5 | Winners of R16 |
| **Semi-Final** | 4 (top-4) | 1v4, 2v3 | Winners of QF |
| **Third Place** | 2 (losers of SF) | Direct | Bronze medal |
| **Final** | 2 (winners of SF) | 1v2 | Championship |

---

## 8. Round Locking and Unlocking - REVISED

### Unlocking Conditions

| Round Type | Unlocks When | Status |
|------------|--------------|--------|
| **Round 1** | Tournament starts | Always unlocked |
| **Swiss Round 2+** | Previous Swiss round **100% complete** | After 100% completion |
| **Elimination Round** | **ALL Swiss rounds complete** + Previous elim round complete | After all Swiss done |

**NEW REQUIREMENT**: Swiss must be completely finished before any elimination starts
(Changed from "after 2 rounds" to "after 3+ rounds")

### Display Logic - "TBD" States

```
Swiss in Progress → Elimination locked:
"TBD - Waiting for Swiss Round X to complete"

Swiss Complete → Elimination "TBD":
"TBD - Will show top-N after Swiss finishes"

Elimination in Progress → Future elimination locked:
"TBD - Waiting for Winner of Match X"

All matches complete:
Shows actual players or "Champion X" / "Runner-up Y"
```

---

## 9. Standard Tournament Configurations - REVISED

### Recommended Structures (with 3+ Swiss)

| Players | Swiss | Elim | Structure | Total Rounds | Total Matches |
|---------|-------|------|-----------|--------------|---------------|
| 3 | 3 | 1 | Swiss (3) → Final | 4 | 6 |
| 5 | 3 | 2 | Swiss (3) → Semi (4) → Final | 6 | 11 |
| 10 | 3 | 3 | Swiss (3) → QF (8) → Semi (4) → Final | 7 | 22 |
| 16 | 3 | 4 | Swiss (3) → R16 (16) → QF (8) → Semi (4) → Final | 8 | 35 |
| 50 | 4 | 5 | Swiss (4) → R16 (16) → QF (8) → Semi (4) → Final | 9 | 52 |

**Changes from v1.0**:
- Minimum 3 Swiss rounds (not 2)
- More conservative elimination advancement
- Better ranking stability

---

## 10. Bye Points Configuration - NEW SECTION

### Bye Point Values

| Configuration | Use Case | Formula |
|---------------|----------|---------|
| **1.0 point** (Default) | Standard tournament | Bye = Win |
| **0.5 points** | Conservative | Bye = Draw |
| **0 points** | Rare | Bye = Loss (not recommended) |

**Recommendation**: Use **0.5 points** for clearer separation

**Example - 5 Players, Round 1**:
```
Matches:
- Player A vs Player B
- Player C vs Player D
- Player E: BYE (0.5 pts)

If Player E gets 0.5 pts:
- Likely ranks 3rd-4th after Round 1
- More room for winners (A,B,C,D) to rank 1-4

If Player E gets 1.0 pts:
- Could tie for 1st-2nd after Round 1
- Skews early standings
```

---

## 11. Data Contracts - UPDATED

### Backend (Database) - ChampionshipMatch Table

**Swiss Round Match**:
```json
{
  "id": 37,
  "championship_id": 5,
  "round_number": 1,
  "round_type": "swiss",
  "player1_id": 5,              // ✅ STORED
  "player2_id": 6,              // ✅ STORED
  "winner_id": null,
  "is_placeholder": false,      // ✅ NOT placeholder
  "player1_color": "white",     // ✅ Color assigned
  "player2_color": "black",     // ✅ Color assigned
  "created_at": "2025-12-03T10:00:00Z"
}
```

**Elimination Round Match (Placeholder)**:
```json
{
  "id": 42,
  "championship_id": 5,
  "round_number": 4,
  "round_type": "semi_final",
  "player1_id": null,                    // ❌ NULL
  "player2_id": null,                    // ❌ NULL
  "winner_id": null,
  "is_placeholder": true,                // ✅ Placeholder
  "determined_by_round": 3,              // ✅ After Round 3
  "requires_top_k": 4,                   // ✅ Select top 4
  "player1_bracket_position": 1,         // ✅ Seed 1
  "player2_bracket_position": 4,         // ✅ Seed 4
  "player1_color": null,                 // Color assigned at resolution
  "player2_color": null,
  "created_at": "2025-12-03T10:00:00Z"
}
```

### Frontend Response Structure

```json
{
  "championship": { ... },
  "participants": [ ... ],
  "rounds": [
    {
      "round_number": 1,
      "type": "swiss",
      "status": "unlocked",
      "matches": [
        {
          "id": 37,
          "player1": {
            "id": 5,
            "name": "Alice",
            "rating": 1800
          },
          "player2": {
            "id": 6,
            "name": "Bob",
            "rating": 1750
          },
          "player1_color": "white",
          "player2_color": "black",
          "is_placeholder": false,
          "winner": null,
          "status": "awaiting"
        }
      ]
    },
    {
      "round_number": 4,
      "type": "semi_final",
      "status": "locked",
      "message": "Waiting for Round 3 to complete",
      "matches": [
        {
          "id": 42,
          "player1": null,           // Shows "TBD" in UI
          "player2": null,           // Shows "TBD" in UI
          "is_placeholder": true,
          "player1_seed": 1,         // UI shows "#1 Seed"
          "player2_seed": 4,         // UI shows "#4 Seed"
          "status": "pending_bracket"
        }
      ]
    }
  ],
  "standings": {
    "current_round": 2,
    "players": [ ... ]
  }
}
```

---

## 12. Critical Invariants - ENHANCED

These rules **MUST NEVER** be violated:

1. ✅ **Swiss rounds have fixed players** (stored in database)
2. ✅ **Elimination rounds use placeholders** (null player IDs until resolved)
3. ✅ **Equal contribution**: Exactly 1 match per player per Swiss round
4. ✅ **No duplicates**: No player appears twice in same round
5. ✅ **Proper seeding**: 1v8, 2v7, 3v6, 4v5 pattern in eliminations
6. ✅ **Round locking**: Elimination rounds locked until ALL Swiss complete
7. ✅ **Color balance**: ±2 difference maximum, no 3 consecutive same
8. ✅ **No repeat matches**: Players meet at most once
9. ✅ **Score bracket pairing**: Use score brackets, not global ranking
10. ✅ **Minimum Swiss rounds**: 3 rounds for 5+ players (minimum 2 for <5)
11. ✅ **Final rankings**: Complete standings with all players ranked

---

## 13. Implementation Checklist - UPDATED

### Backend Services

- [ ] Implement FIDE score bracket pairing system
- [ ] Add color tracking (white/black per player per round)
- [ ] Implement color balance validation (±2, no 3x same)
- [ ] Add bye consecutive round prevention
- [ ] Enforce minimum 3 Swiss rounds for 5+ players
- [ ] Update tiebreaker calculation (Buchholz Cut 1)
- [ ] Lock eliminations until ALL Swiss complete

### Frontend Components

- [ ] Display score brackets visualization
- [ ] Show color balance indicators
- [ ] Display bye history for each player
- [ ] Show Swiss round locks until 3 complete
- [ ] Update standings display with Buchholz scores
- [ ] TBD display for locked eliminations

### Testing

- [ ] Test score bracket pairing correctness
- [ ] Verify color balance across tournament
- [ ] Test bye handling (consecutive prevention)
- [ ] Verify lock timing (3 Swiss → Elim)
- [ ] Validate tiebreaker calculations
- [ ] Test with odd/even player counts

---

## 14. Common Mistakes to Avoid - UPDATED

### ❌ WRONG: Moving to Elimination After 2 Swiss Rounds
```
❌ Bad:
Round 1: Swiss ✓
Round 2: Swiss ✓
Round 3: Elimination (top 8) ✗ TOO EARLY

✅ Better:
Round 1: Swiss ✓
Round 2: Swiss ✓
Round 3: Swiss ✓
Round 4+: Elimination (top 8)
```

### ❌ WRONG: Global Ranking for Pairing
```json
❌ Wrong (current system):
{
  "round": 2,
  "pairing_method": "standings_based",
  "process": "Sort all players globally, pair top half with bottom half"
}

✅ Correct (FIDE):
{
  "round": 2,
  "pairing_method": "score_bracket_based",
  "process": [
    "Create score brackets (exact score grouping)",
    "Pair within bracket upper vs lower",
    "Only drop to next bracket if needed"
  ]
}
```

### ❌ WRONG: Ignoring Color Constraints
```
❌ Bad:
Player A: W, B, W, B, W ← 5 rounds, color changes
Final round: Give W ← Player A gets W again? No problem?

✅ Correct:
Track cumulative color balance per player
Enforce ±2 max difference
If Player A has +2 White difference, MUST give Black next round
```

### ❌ WRONG: Allowing Consecutive Byes
```
❌ Bad:
Round 1: Player E gets bye ← No issue
Round 2: Player E gets bye ← FIDE violation!

✅ Correct:
If Player E had bye, swap them to paired match next round
Different player gets bye instead
```

---

## 15. Resolution Algorithm - ENHANCED

### Frontend Dynamic Resolution

```javascript
function resolveMatchParticipants(match, completedMatches, standings) {
  // Swiss round - already has players
  if (!match.is_placeholder) {
    return {
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      player1_color: match.player1_color,
      player2_color: match.player2_color
    };
  }

  // Check if prerequisites met
  if (!allSwissComplete(standings)) {
    return {
      status: 'tbd',
      message: 'Waiting for Swiss Rounds to complete'
    };
  }

  // Elimination round - resolve from standings
  const topK = getTopKPlayers(standings, match.requires_top_k);
  const player1 = topK[match.player1_bracket_position - 1];
  const player2 = topK[match.player2_bracket_position - 1];

  if (!player1 || !player2) {
    return { status: 'tbd', message: 'Bracket not yet determined' };
  }

  // Assign colors for elimination
  const colors = assignEliminationColors(player1, player2);

  return {
    player1_id: player1.id,
    player2_id: player2.id,
    player1_color: colors.player1,
    player2_color: colors.player2
  };
}
```

---

## 16. Differences from v1.0

| Aspect | v1.0 | v2.0 | Reason |
|--------|------|------|--------|
| **Swiss Rounds** | 2 minimum | 3 minimum | Stable seeding |
| **Pairing System** | Global ranking | Score brackets | FIDE compliance |
| **Color Constraints** | Basic tracking | ±2 limit + no 3x same | Chess standards |
| **Bye Rules** | Allow consecutive | Prevent consecutive | FIDE C.04.2.d |
| **Elimination Lock** | After 2 Swiss | After ALL Swiss | Better stability |
| **Bye Points** | 1.0 (default) | 0.5 (recommended) | Less ranking skew |

---

## Conclusion

This revised system provides:

✅ **FIDE Compliance** - Aligns with official chess tournament standards
✅ **Fairness** - Score brackets ensure balanced pairings
✅ **Stability** - Longer Swiss phase improves seeding quality
✅ **Transparency** - Clear rules prevent disputes
✅ **Scalability** - Works for 3 to 1000+ player tournaments

**All code changes must comply with this v2.0 document.**

---

**Version History**:
- v1.0 (Nov 2025): Initial implementation
- v2.0 (Dec 3, 2025): FIDE alignment, revised Swiss duration, score brackets