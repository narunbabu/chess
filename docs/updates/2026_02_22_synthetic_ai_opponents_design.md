# Synthetic AI Opponents — Design Doc

**Date**: 2026-02-22
**Priority**: P0-2 (Churn prevention)
**Effort**: 3-4 days
**Impact**: +30% retention for new users

## Problem

New users visit chess99.com, see 0 online players in the lobby, and immediately churn. The "Play Online" button enters a matchmaking queue that times out after 20 seconds with no match, then dumps the user to `/play` with no context. This is the #1 retention blocker.

## Solution: Synthetic AI Opponents

Show AI-controlled players in the lobby that look like real users. When a human challenges one (or matchmaking times out), they play against Stockfish.js at a difficulty calibrated to the synthetic player's ELO rating.

## Architecture Decision: Stockfish.js in Browser

**Chosen**: Option 1 — Stockfish.js in the browser (already integrated)

**Why**:
- Stockfish.js web worker already works in PlayComputer.js
- No server load for AI move computation
- No latency (moves computed locally)
- Already has difficulty mapping (levels 1-16 → movetime 100-2500ms)
- Already has MultiPV top-10 move selection with difficulty-based weighting

**Rejected alternatives**:
- Server-side Stockfish: Adds server load, latency, complexity. Not needed when client-side works.
- Simple random-move bot: Too weak, not a satisfying chess experience.

## Current State (What Already Exists)

| Component | Status | Notes |
|-----------|--------|-------|
| `SyntheticPlayer` model (40 bots seeded) | Code exists | **Not seeded in production** |
| `MatchmakingService.matchWithSynthetic()` | Done | Creates game with bot after 20s timeout |
| `LobbyPage` shows synthetic players | Done | Unified list of real + synthetic |
| `LobbyPage.sendInvitation()` handles synthetic | Done | Simulates 2-5s acceptance delay |
| `PlayComputer` synthetic opponent setup | Done | Sets `computerDepth` from `bot.computer_level` |
| `MatchmakingQueue` matched→navigate flow | Done | Navigates to `/play` with synthetic data |
| `GameController.createComputerGame()` | Done | Accepts `synthetic_player_id` |
| Stockfish.js web worker | Done | Full difficulty mapping |
| `subscription_plans.synthetic_opponents` | Done | Gold-only gate (column exists) |

## What's Missing (Implementation Tasks)

### 1. Seed Synthetic Players in Production (Migration)
The `SyntheticPlayerSeeder` exists but hasn't run on VPS. Create a migration that seeds if the table is empty (same pattern as subscription plans).

### 2. Fix MatchmakingQueue Fallback Navigation
**File**: `chess-frontend/src/components/lobby/MatchmakingQueue.jsx` line 128-133

Current (broken):
```js
// status === 'expired' or 'cancelled'
setStatus('fallback');
setTimeout(() => {
  onClose();
  navigate('/play');  // ← No synthetic data! User lands on setup screen
}, 2000);
```

Fix: When queue expires and backend matched with synthetic, navigate with full synthetic data.

### 3. Enforce AI Games as Casual (No Leaderboard Impact)
**Backend**: `MatchmakingService.matchWithSynthetic()` already creates the game — ensure `game_mode: 'casual'` is always set regardless of user preference.

**Frontend**: When `syntheticOpponent` is set, force `ratedMode = 'casual'` and hide the rated toggle.

### 4. Show "AI Opponent" Badge in Lobby
Users should be able to distinguish synthetic players from real ones. Add a subtle "Bot" badge to synthetic player cards in `PlayersList`.

### 5. Subscription Gate for Synthetic Opponents
Gold-tier users get synthetic opponents. Free/Silver users should still see them but get an upsell modal when challenging. For MVP, make synthetic opponents available to ALL users (remove gate) since the primary goal is retention, not monetization.

**Decision**: Available to all users for now. Gate behind Gold tier later when user base grows.

## File Changes Required

### Backend
1. **New migration**: `2026_02_22_200000_seed_synthetic_players_if_empty.php`
   - Seeds 40 synthetic players if table is empty
   - Uses existing `SyntheticPlayerSeeder` data

2. **`MatchmakingService.php`** line 159-173
   - Force `game_mode: 'casual'` for synthetic games (add to `Game::create()` call)

### Frontend
3. **`MatchmakingQueue.jsx`** lines 104-133
   - When matched with synthetic (`entry.match_type === 'synthetic'`): navigate with full synthetic data
   - When expired/cancelled with no match: navigate to PlayComputer setup (current behavior is OK)

4. **`PlayComputer.js`** line ~1677
   - When `syntheticOpponent` is set, override `game_mode` to `'casual'`

5. **`PlayersList.js`** (or wherever player cards render)
   - Add "Bot" indicator for `player.type === 'synthetic'`

## Data Model (Existing — No Changes Needed)

```
synthetic_players:
  id, name, avatar_seed, rating (800-2400), computer_level (6-16),
  personality, bio, is_active, games_played_count, wins_count

games:
  synthetic_player_id (FK, nullable) — links game to bot identity

matchmaking_entries:
  matched_with_synthetic_id (FK, nullable) — tracks synthetic match
```

## ELO ↔ Difficulty Mapping (Existing)

| Level | Rating | Description |
|-------|--------|-------------|
| 6 | ~1400 | Medium |
| 8 | ~1800 | Expert |
| 10 | ~2200 | Master |
| 12 | ~2400 | IM |
| 14 | ~2800 | Super GM |
| 16 | ~3200 | Maximum |

## User Flow

### Flow A: Direct Challenge from Lobby
1. User opens lobby → sees mix of real + synthetic players
2. User clicks synthetic player → color/time modal
3. Modal shows acceptance after 2-5s delay
4. Navigate to `/play` with `gameMode: 'synthetic'`
5. PlayComputer sets `computerDepth = bot.computer_level`
6. Game plays out vs Stockfish.js
7. Result saved as `game_mode: 'casual'` — no ELO impact

### Flow B: Auto-Match via Matchmaking Queue
1. User clicks "Play Online" → matchmaking modal
2. Smart match: broadcasts to online users (15s)
3. No human responds → falls back to queue (20s)
4. Queue expires → `matchWithSynthetic()` finds closest-rated bot
5. Backend creates game, returns match data
6. Frontend navigates to `/play` with synthetic data
7. Same gameplay as Flow A

### Flow C: No Match at All (Edge Case)
1. Queue expires AND no bots available (shouldn't happen with 40 seeded)
2. User sees "No opponent found" → navigates to PlayComputer setup
3. User can manually start a game vs computer

## Testing Checklist

- [ ] Lobby shows synthetic players mixed with real users
- [ ] Challenging a synthetic player works end-to-end
- [ ] Matchmaking queue falls back to synthetic after timeout
- [ ] Synthetic games are always casual (no ELO change)
- [ ] Bot difficulty matches their listed rating
- [ ] Game end card shows synthetic player name/avatar
- [ ] Synthetic player `games_played_count` increments
- [ ] Production has 40 synthetic players after migration
