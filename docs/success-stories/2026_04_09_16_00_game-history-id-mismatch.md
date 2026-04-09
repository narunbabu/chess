# Game History ID Mismatch Bug Fix

**Date:** 2026-04-09
**Severity:** Critical
**Impact:** Reviewing multiplayer games from dashboard showed wrong game data
**Status:** ✅ Fixed

## Problem Description

When clicking "Review" on a multiplayer game from the game history list, the wrong game was loaded for review.

### Example Case

- Game history shows: "Win vs Vedansh N (1273)" with game_history ID 414
- This record has `game_id = 477` (the actual games table entry)
- Clicking Review navigated to `/play/review/414`
- This fetched `/api/games/414` → returned a completely different game (vs Pooja Deshmukh)
- Expected: Should have fetched `/api/games/477` → correct game (vs Vedansh N)

### Root Cause

Two separate tables with conflicting IDs:
- `game_histories.id` (auto-increment, e.g., 414) - history records
- `games.id` (auto-increment, e.g., 477) - actual games
- `game_histories.game_id` (foreign key, e.g., 477) - reference to games table

The frontend was using `game_histories.id` instead of `game_histories.game_id` for navigation.

## Changes Made

### 1. Dashboard.js (Line 317-322)

**Before:**
```javascript
const handleReviewGame = (game) => {
  navigate(`/play/review/${game.id}`);  // ❌ Uses game_histories.id
};
```

**After:**
```javascript
const handleReviewGame = (game) => {
  // For multiplayer games, use game_id (actual games table ID)
  // For computer games, use id (game_histories table ID)
  const reviewId = (game.game_mode === 'multiplayer' && game.game_id) ? game.game_id : game.id;
  navigate(`/play/review/${reviewId}`);
};
```

### 2. GameReview.js (Lines 884, 966, 893)

**Before:**
```javascript
const reviewUrl = gameHistory.id ? `https://chess99.com/play/review/${gameHistory.id}` : 'https://chess99.com';
const reviewLink = gameHistory.id ? `https://chess99.com/play/review/${gameHistory.id}` : null;
// ...
}, [playerInfo.topName, gameHistory.result, gameHistory.id]);
```

**After:**
```javascript
const reviewUrl = gameId ? `https://chess99.com/play/review/${gameId}` : 'https://chess99.com';
const reviewLink = gameId ? `https://chess99.com/play/review/${gameId}` : null;
// ...
}, [playerInfo.topName, gameHistory.result, gameId]);
```

## Why This Fix Works

1. **Multiplayer games:** Use `game.game_id` which references the actual game in the `games` table
2. **Computer games:** Use `game.id` (game_histories table) since computer games may not have a games table entry
3. **Share URLs:** Use `gameId` from URL params (what was used to load the page) instead of potentially ambiguous `gameHistory.id`

## Testing

```bash
cd chess-frontend && pnpm build
# ✅ Compiled successfully
```

### Manual Testing Steps

1. Play a multiplayer game that ends
2. Go to Dashboard → Game History
3. Click "Review" on the game
4. Verify correct opponent name, rating, and moves are displayed
5. Test share/copy link functionality
6. Test with computer games (should still work)

## Related Files

- `chess-frontend/src/components/Dashboard.js` - Fixed review navigation
- `chess-frontend/src/components/GameReview.js` - Fixed share URLs
- `chess-backend/app/Http/Controllers/Api/GameHistoryController.php` - No changes needed (API returns correct data)

## Prevention

To prevent similar issues:
1. Be aware of dual ID systems (history records vs actual games)
2. Use descriptive variable names: `gameHistoryId` vs `gameId`
3. Document foreign key relationships in API contracts
4. Add integration tests for review navigation flow
