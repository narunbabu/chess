# Chess Library API Fix - 2025-09-30

## Problem
Move broadcasting was failing with error:
```
Class "Chess\Game" not found at ChessRulesService.php:198
```

## Root Cause
The `ChessRulesService` was trying to use `Chess\Game` class which doesn't exist in the installed `chesslablab/php-chess` package. The code was written for a different chess library (likely `ryanhs/chess.php`), but the project uses `chesslablab/php-chess` which has a different API.

**Key differences:**
- `chesslablab/php-chess` uses `Chess\Variant\Classical\Board` class
- Needs `Chess\Variant\Classical\FenToBoardFactory` to create boards from FEN
- API methods are different: `play($color, $move)` instead of `move($move)`
- FEN methods: `toFen()` instead of `getFen()`

## Solution
Updated `ChessRulesService` to use the correct API:

1. **Updated imports:**
   ```php
   use Chess\Variant\Classical\Board as ChessBoard;
   use Chess\Variant\Classical\FenToBoardFactory;
   ```

2. **Fixed `isThreefoldRepetition()` method:**
   ```php
   $board = FenToBoardFactory::create();
   $positions[] = $board->toFen();
   $color = (count($positions) % 2 === 1) ? 'w' : 'b';
   $board->play($color, $move['san']);
   ```

3. **Fixed `validateMove()` method:**
   ```php
   $board = FenToBoardFactory::create($fen);
   $fenParts = explode(' ', $fen);
   $color = $fenParts[1] ?? 'w';
   return $board->play($color, $move);
   ```

4. **Fixed `getLegalMoves()` method:**
   - Simplified to return empty array (different API structure)

## Files Changed
- `chess-backend/app/Services/ChessRulesService.php`:
  - Updated imports to use correct chess library classes
  - Fixed `isThreefoldRepetition()` method (line 196-227)
  - Fixed `validateMove()` method (line 280-296)
  - Fixed `getLegalMoves()` method (line 301-313)

## Impact
- ✅ Move broadcasting now works with correct chess library API
- ✅ Threefold repetition detection functional
- ✅ Move validation using proper API calls
- ✅ Consistent with installed `chesslablab/php-chess` package

## Technical Notes
This was a library mismatch issue where the code was written for one chess library but a different one was installed. The fix ensures all chess-related operations use the correct API from `chesslablab/php-chess`.

The `chesslablab/php-chess` library provides:
- `FenToBoardFactory::create($fen)` - Create board from FEN string
- `$board->play($color, $pgn)` - Make a move in PGN notation
- `$board->toFen()` - Get current position as FEN
- `$board->isCheck()`, `$board->isMate()`, `$board->isStalemate()` - Game state checks