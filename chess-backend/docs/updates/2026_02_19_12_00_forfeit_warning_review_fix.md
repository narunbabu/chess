# Fix: Forfeit Warning Showing on Game Review Pages

**Date**: 2026-02-19
**Type**: Bug Fix
**Scope**: Frontend

## Problem

Visiting `/play/review/50` (or any game review URL) showed a "RATED GAME FORFEIT WARNING" popup, even though review pages are read-only with no active game state.

## Root Causes

1. **`registerActiveGame` called before finished-game check** — In `PlayMultiplayer.js`, the init flow called `registerActiveGame()` unconditionally at line 496, BEFORE checking if the game was already finished at line 501. This set `gameActiveRef.current = true` even for completed games, triggering navigation guards globally.

2. **`unregisterActiveGame` never called on game end** — `handleGameEnd` set `gameComplete(true)` but never called `unregisterActiveGame()`, so the navigation guard persisted even after a game finished naturally during the session.

3. **`isGamePage()` didn't exclude review paths** — `GameNavigationContext.isGamePage()` returned `true` for any path starting with `/play/`, which incorrectly included `/play/review/*` paths.

## Changes

### `chess-frontend/src/components/play/PlayMultiplayer.js`
- **Fix 1**: Moved finished-game status check (`finished`, `aborted`, `resigned`) BEFORE `registerActiveGame()` call. Only active/in-progress games are now registered with the navigation guard.
- **Fix 2**: Added `unregisterActiveGame()` call in `handleGameEnd` when a game completes, so the navigation guard is properly cleared.
- **Fix 3**: Added `unregisterActiveGame` to `handleGameEnd`'s `useCallback` dependency array.

### `chess-frontend/src/contexts/GameNavigationContext.js`
- **Fix 4**: Updated `isGamePage()` to return `false` for paths starting with `/play/review/`, preventing review pages from being treated as active game pages.

## Verification
- Frontend builds with no errors
- `GameReview` component (used for `/play/review/:id`) does NOT call `registerActiveGame` — confirmed read-only
- Review paths now explicitly excluded from game page detection
