# Tournament System Core Principles

**Version**: 1.0
**Last Updated**: 2025-12-03
**Status**: Authoritative Reference

---

## Overview

This document defines the authoritative principles for how tournaments operate in the Chess Web application. All backend services, frontend components, and visualizers MUST follow these principles.

---

## 1. Core Tournament Structure

### Tournament Phases

Every tournament consists of two distinct phases:

1. **Swiss Phase** (Rounds 1-2 or 1-3)
   - ALL participants play
   - Purpose: Rank all players by overall performance
   - Determines seeding for elimination phase

2. **Elimination Phase** (Remaining rounds)
   - ONLY top-K players advance
   - Purpose: Determine champion through bracket play
   - Uses Swiss standings for seeding

---

## 2. CRITICAL PRINCIPLE: When Players Are Determined

### ✅ Swiss Rounds: PRE-DETERMINED (Fixed at Generation)

**Rule**: Players and matchups are **determined and stored in database** when the round is generated.

**Why**:
- All participants must play
- Pairings based on current standings
- No dynamic resolution needed

**Example - 3 Player Tournament, Round 1**:
```json
{
  "round_number": 1,
  "type": "swiss",
  "matches": [
    {
      "id": 37,
      "player1_id": 5,  // ✅ FIXED - Stored in database
      "player2_id": 6,  // ✅ FIXED - Stored in database
      "is_placeholder": false
    },
    {
      "id": 38,
      "player1_id": 6,  // ✅ FIXED - Stored in database
      "player2_id": 7,  // ✅ FIXED - Stored in database
      "is_placeholder": false
    }
  ]
}
```

**Backend Code**: `TournamentGenerationService.php:132-136`
```php
// Swiss rounds: Select ALL participants
$participants = $this->selectParticipantsForRound($championship, 'all', $roundNumber);
```

---

### ✅ Elimination Rounds: DYNAMICALLY DETERMINED (Placeholders)

**Rule**: Players are **NOT stored in database** at generation time. Matches are created as **placeholders** that resolve dynamically based on current standings.

**Why**:
- Players not known until Swiss rounds complete
- Seeding must reflect final Swiss standings
- Dynamic resolution ensures correct bracket

**Example - 3 Player Tournament, Round 3 (Final)**:
```json
{
  "round_number": 3,
  "type": "final",
  "matches": [
    {
      "id": 42,
      "player1_id": null,           // ❌ NULL - Not stored
      "player2_id": null,           // ❌ NULL - Not stored
      "is_placeholder": true,       // ✅ Placeholder flag
      "requires_top_k": 2,          // ✅ Resolve from top 2 standings
      "determined_by_round": 2,     // ✅ After Round 2 completes
      "player1_bracket_position": 1,  // ✅ Seed #1
      "player2_bracket_position": 2   // ✅ Seed #2
    }
  ]
}
```

**At Display/Play Time** (after Swiss rounds complete):
```javascript
// Frontend resolves dynamically:
const standings = calculateStandings(completedMatches);
const top2 = getTopKPlayers(standings, 2);

// Match NOW shows:
// Player1: top2[0] (e.g., "Alice" - Rank #1)
// Player2: top2[1] (e.g., "Bob" - Rank #2)
```

**Backend Code**: `TournamentGenerationService.php:186-254`
```php
// Elimination rounds: Select top-K based on standings
$participants = $this->selectParticipantsForRound($championship, 'top_k', $roundNumber);
```

---

## 3. Match Placeholder System

### Placeholder Match Attributes

All elimination round matches MUST have these attributes:

| Attribute | Type | Purpose | Example |
|-----------|------|---------|---------|
| `is_placeholder` | boolean | Indicates dynamic resolution needed | `true` |
| `player1_id` | null | No pre-assigned player | `null` |
| `player2_id` | null | No pre-assigned player | `null` |
| `requires_top_k` | integer | Number of top players needed | `4` (for semi-final) |
| `determined_by_round` | integer | Which round must complete first | `2` (after Round 2) |
| `player1_bracket_position` | integer | Seeding position for player 1 | `1` (top seed) |
| `player2_bracket_position` | integer | Seeding position for player 2 | `8` (8th seed) |

### Resolution Timing

Placeholder matches resolve at **view/play time**, NOT at generation time:

```
Generation Time (Tournament Created):
├─ Round 1: ✅ Players assigned (all participants)
├─ Round 2: ✅ Players assigned (all participants)
├─ Round 3: ❌ Players NULL (placeholder - top 4)
├─ Round 4: ❌ Players NULL (placeholder - top 2)
└─ Round 5: ❌ Players NULL (placeholder - round winners)

Display Time (User Views Tournament):
├─ Round 1: ✅ Shows actual players
├─ Round 2: ✅ Shows actual players
├─ Round 3: 🔄 RESOLVES from current standings → Shows top 4
├─ Round 4: 🔄 RESOLVES from Round 3 winners → Shows "TBD" until Round 3 done
└─ Round 5: 🔄 RESOLVES from Round 4 winners → Shows "TBD" until Round 4 done
```

---

## 4. Standings-Based Seeding

### Tiebreaker Order

Players are ranked using this priority:

1. **Points** (primary)
   - Win = 1 point
   - Draw = 0.5 points
   - Loss = 0 points

2. **Buchholz Score** (first tiebreaker)
   - Sum of all opponents' points
   - Rewards strength of schedule

3. **Sonneborn-Berger** (second tiebreaker)
   - Your score × opponent's score (only when you scored)
   - Rewards beating strong opponents

4. **Rating** (final tiebreaker)
   - Player's Elo rating

**Code**: `tournament-helpers.js:calculateStandings()`

### Bracket Seeding Patterns

Elimination rounds use standard tournament seeding:

| Round | Bracket Positions | Seeding Pattern |
|-------|------------------|-----------------|
| Quarter-Final (8 players) | 1v8, 2v7, 3v6, 4v5 | Top vs Bottom |
| Semi-Final (4 players) | 1v4, 2v3 | Winners of QF |
| Final (2 players) | 1v2 | Winners of SF |

**Example - 10 Player Tournament Quarter-Finals**:
```
After Swiss Rounds Complete (Standings):
1. Alice (3 points)
2. Bob (2.5 points)
3. Charlie (2.5 points, higher buchholz)
4. David (2 points)
5. Eve (2 points, higher buchholz)
6. Frank (1.5 points)
7. Grace (1 point)
8. Henry (0.5 points)

Quarter-Final Bracket:
├─ Match 1: Alice (#1) vs Henry (#8)
├─ Match 2: Bob (#2) vs Grace (#7)
├─ Match 3: Charlie (#3) vs Frank (#6)
└─ Match 4: David (#4) vs Eve (#5)
```

---

## 5. Round Locking and Unlocking

### Unlocking Rules

| Round Type | Unlocks When |
|------------|--------------|
| Round 1 (Swiss) | ✅ Always unlocked (starting round) |
| Round 2+ (Swiss) | ✅ Previous round complete |
| Elimination Rounds | ✅ ALL required Swiss rounds complete + previous elimination round complete |

### "TBD" Display Logic

Frontend must show "TBD" (To Be Determined) when:

1. **Swiss Round Not Complete**: Elimination round locked
   - Display: "TBD - Waiting for Round X"

2. **Previous Elimination Round Not Complete**: Winners unknown
   - Display: "TBD - Winner of Match X"

**Example - 3 Player Tournament**:
```
Initial State (No matches played):
├─ Round 1 (Swiss): ✅ Shows "Player 1 vs Player 2"
├─ Round 2 (Swiss): ✅ Shows "Player 1 vs Player 3"
└─ Round 3 (Final): ❌ Shows "TBD vs TBD" (locked until Round 2 complete)

After Round 1 Complete:
├─ Round 1 (Swiss): ✅ COMPLETED
├─ Round 2 (Swiss): ✅ Shows "Player 2 vs Player 3"
└─ Round 3 (Final): ❌ Shows "TBD vs TBD" (still locked - Round 2 not done)

After Round 2 Complete:
├─ Round 1 (Swiss): ✅ COMPLETED
├─ Round 2 (Swiss): ✅ COMPLETED
└─ Round 3 (Final): 🔄 Shows "Alice (#1) vs Bob (#2)" (resolved from standings)
```

---

## 6. Tournament Configurations

### Standard Configurations

| Players | Total Rounds | Swiss Rounds | Elimination Rounds | Top-K Advances |
|---------|--------------|--------------|-------------------|----------------|
| 3 | 3 | 2 | 1 (Final) | 2 |
| 5 | 5 | 2 | 3 (SF, 3rd, F) | 4 |
| 10 | 6 | 2 | 4 (QF, SF, 3rd, F) | 8 |
| 50 | 8 | 3 | 5 (R16, QF, SF, 3rd, F) | 16 |

### Equal Contribution Rule

**Swiss Phase**: Every player MUST play exactly 1 match per Swiss round.

**Why**: Ensures fair ranking and equal opportunity for all participants.

**Example - 5 Player Tournament, Round 1**:
```
5 players → 2 matches + 1 bye
- Match 1: Player A vs Player B
- Match 2: Player C vs Player D
- Bye: Player E (gets 0.5 points automatically)
```

**Code**: `TournamentGenerationService.php:132`
```php
'matches_per_player' => 1,  // Each player plays once per round
```

---

## 7. Third Place Match

All tournaments include a **third place match** to determine bronze medal.

### Configuration

| Attribute | Value |
|-----------|-------|
| Participants | Semi-final losers |
| Timing | After semi-finals, before final |
| Purpose | Distinguish 3rd vs 4th place |
| Type | `third_place` |

**Example**:
```
Round 4 (Semi-Finals):
├─ Match 1: Alice beats Charlie
└─ Match 2: Bob beats David

Round 5 (Third Place):
└─ Charlie vs David → Winner = 3rd Place, Loser = 4th Place

Round 6 (Final):
└─ Alice vs Bob → Winner = 1st Place, Loser = 2nd Place
```

---

## 8. Data Contracts

### Backend (Database) - ChampionshipMatch Table

**Swiss Round Match**:
```php
[
    'id' => 37,
    'championship_id' => 5,
    'round_number' => 1,
    'player1_id' => 5,              // ✅ STORED
    'player2_id' => 6,              // ✅ STORED
    'winner_id' => null,
    'is_placeholder' => false,      // ✅ Not a placeholder
    'round_type' => 'swiss',
]
```

**Elimination Round Match (Placeholder)**:
```php
[
    'id' => 42,
    'championship_id' => 5,
    'round_number' => 3,
    'player1_id' => null,                    // ❌ NULL
    'player2_id' => null,                    // ❌ NULL
    'winner_id' => null,
    'is_placeholder' => true,                // ✅ Placeholder
    'determined_by_round' => 2,              // ✅ Metadata
    'requires_top_k' => 2,                   // ✅ Metadata
    'player1_bracket_position' => 1,         // ✅ Metadata
    'player2_bracket_position' => 2,         // ✅ Metadata
    'round_type' => 'final',
]
```

### Frontend (JSON Response)

**Structure**:
```json
{
  "participants": [...],
  "rounds": [
    {
      "round_number": 1,
      "type": "swiss",
      "matches": [
        {
          "id": 37,
          "player1_id": 5,
          "player2_id": 6,
          "is_placeholder": false
        }
      ]
    },
    {
      "round_number": 3,
      "type": "final",
      "matches": [
        {
          "id": 42,
          "player1_id": null,
          "player2_id": null,
          "is_placeholder": true,
          "requires_top_k": 2,
          "determined_by_round": 2,
          "player1_bracket_position": 1,
          "player2_bracket_position": 2
        }
      ]
    }
  ]
}
```

---

## 9. Critical Invariants

These rules MUST NEVER be violated:

1. ✅ **Swiss rounds have fixed players** (stored in database)
2. ✅ **Elimination rounds use placeholders** (null player IDs)
3. ✅ **Equal contribution**: 1 match per player per Swiss round
4. ✅ **No duplicates**: No player appears twice in same round
5. ✅ **Proper seeding**: 1v8, 2v7, 3v6, 4v5 pattern
6. ✅ **Round locking**: Elimination rounds locked until prerequisites met
7. ✅ **Dynamic accuracy**: Placeholders always resolve to correct standings
8. ✅ **Final rankings**: Every player gets final position (1st through Nth)

---

## 10. Implementation Checklist

### Backend Services

- [ ] `TournamentGenerationService.php`: Create placeholder matches for elimination rounds
- [ ] `ChampionshipMatchController.php`: Never pre-assign players to elimination rounds
- [ ] Database migrations: Support placeholder metadata fields

### Frontend Components

- [ ] `tournament-helpers.js`: Implement `resolveMatchParticipants()` function
- [ ] `TournamentAdminDashboard.jsx`: Show "TBD" for locked elimination rounds
- [ ] `tournament_visualizer_v3.html`: Dynamic player resolution from standings

### Test Data

- [ ] `tournament_test_3_players.json`: Elimination rounds have `null` player IDs
- [ ] `tournament_test_5_players.json`: Elimination rounds have `null` player IDs
- [ ] `tournament_test_10_players.json`: Elimination rounds have `null` player IDs
- [ ] `tournament_test_50_players.json`: Elimination rounds have `null` player IDs

---

## 11. Common Mistakes to Avoid

### ❌ WRONG: Pre-assigning Players to Elimination Rounds

```json
// DON'T DO THIS
{
  "round_number": 3,
  "type": "final",
  "matches": [
    {
      "player1_id": 5,  // ❌ WRONG - Can't know this at generation time
      "player2_id": 6,  // ❌ WRONG - Depends on Swiss results
      "is_placeholder": false
    }
  ]
}
```

### ✅ CORRECT: Using Placeholders

```json
// DO THIS
{
  "round_number": 3,
  "type": "final",
  "matches": [
    {
      "player1_id": null,           // ✅ Correct - Will be resolved later
      "player2_id": null,           // ✅ Correct - Will be resolved later
      "is_placeholder": true,
      "requires_top_k": 2,
      "determined_by_round": 2
    }
  ]
}
```

---

## 12. Resolution Algorithm

### Frontend Dynamic Resolution

```javascript
function resolveMatchParticipants(match, completedMatches, participants) {
  if (!match.is_placeholder) {
    // Swiss round - already has players
    return {
      player1_id: match.player1_id,
      player2_id: match.player2_id
    };
  }

  // Elimination round - resolve from standings
  const standings = calculateStandings(completedMatches, participants);

  if (match.round_type === 'final' || match.round_type === 'semi_final') {
    // Resolve from standings
    const topK = getTopKPlayers(standings, match.requires_top_k);

    return {
      player1_id: topK[match.player1_bracket_position - 1]?.id || null,
      player2_id: topK[match.player2_bracket_position - 1]?.id || null
    };
  }

  // Default: show as TBD
  return {
    player1_id: null,
    player2_id: null
  };
}
```

---

## Conclusion

Following these principles ensures:

- ✅ Fair and transparent tournament progression
- ✅ Correct seeding based on actual Swiss performance
- ✅ Clear distinction between predetermined vs. dynamic rounds
- ✅ Consistent behavior across backend, frontend, and visualizer

**All code changes must comply with this document.**
