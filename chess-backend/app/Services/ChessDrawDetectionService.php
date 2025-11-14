<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\Log;
use Chess\Chess as ChessPHP;

class ChessDrawDetectionService
{
    /**
     * Check for all possible draw conditions
     */
    public function checkDrawConditions(Game $game): array
    {
        $drawConditions = [
            'stalemate' => $this->checkStalemate($game),
            'insufficient_material' => $this->checkInsufficientMaterial($game),
            'fifty_move_rule' => $this->checkFiftyMoveRule($game),
            'seventy_five_move_rule' => $this->checkSeventyFiveMoveRule($game),
            'threefold_repetition' => $this->checkThreefoldRepetition($game),
            'fivefold_repetition' => $this->checkFivefoldRepetition($game),
            'sixteen_queen_moves' => $this->checkQueenOnlyMoves($game),
        ];

        $anyDraw = false;
        $drawReason = null;

        foreach ($drawConditions as $condition => $isDraw) {
            if ($isDraw) {
                $anyDraw = true;
                $drawReason = $condition;
                break;
            }
        }

        return [
            'is_draw' => $anyDraw,
            'reason' => $drawReason,
            'conditions' => $drawConditions,
        ];
    }

    /**
     * Check for stalemate
     */
    public function checkStalemate(Game $game): bool
    {
        try {
            $chess = new ChessPHP($game->fen);

            // Check if side to move has no legal moves
            if ($chess->gameOver()) {
                $gameOverResult = $chess->gameOver();
                return isset($gameOverResult['stalemate']) && $gameOverResult['stalemate'];
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Error checking stalemate', [
                'game_id' => $game->id,
                'fen' => $game->fen,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Check for insufficient material draws
     */
    public function checkInsufficientMaterial(Game $game): bool
    {
        try {
            $chess = new ChessPHP($game->fen);

            // Get the current position pieces
            $pieces = $this->getPiecesFromFEN($game->fen);

            return $this->hasInsufficientMaterial($pieces);
        } catch (\Exception $e) {
            Log::error('Error checking insufficient material', [
                'game_id' => $game->id,
                'fen' => $game->fen,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Check 50-move rule (50 moves = 100 half-moves without capture or pawn move)
     */
    public function checkFiftyMoveRule(Game $game): bool
    {
        // Use the halfmove_clock field from the game if available
        if (isset($game->halfmove_clock)) {
            return $game->halfmove_clock >= 100;
        }

        // Extract from FEN as fallback
        try {
            $fenParts = explode(' ', $game->fen);
            if (isset($fenParts[3])) {
                $halfmoveClock = (int)$fenParts[3];
                return $halfmoveClock >= 100;
            }
        } catch (\Exception $e) {
            Log::error('Error checking 50-move rule', [
                'game_id' => $game->id,
                'fen' => $game->fen,
                'error' => $e->getMessage()
            ]);
        }

        return false;
    }

    /**
     * Check 75-move rule (mandatory draw)
     */
    public function checkSeventyFiveMoveRule(Game $game): bool
    {
        // Use the halfmove_clock field from the game if available
        if (isset($game->halfmove_clock)) {
            return $game->halfmove_clock >= 150;
        }

        // Extract from FEN as fallback
        try {
            $fenParts = explode(' ', $game->fen);
            if (isset($fenParts[3])) {
                $halfmoveClock = (int)$fenParts[3];
                return $halfmoveClock >= 150;
            }
        } catch (\Exception $e) {
            Log::error('Error checking 75-move rule', [
                'game_id' => $game->id,
                'fen' => $game->fen,
                'error' => $e->getMessage()
            ]);
        }

        return false;
    }

    /**
     * Check for threefold repetition
     */
    public function checkThreefoldRepetition(Game $game): bool
    {
        return $this->checkRepetition($game, 3);
    }

    /**
     * Check for fivefold repetition (mandatory draw)
     */
    public function checkFivefoldRepetition(Game $game): bool
    {
        return $this->checkRepetition($game, 5);
    }

    /**
     * Check for 16 consecutive queen moves rule
     */
    public function checkQueenOnlyMoves(Game $game): bool
    {
        try {
            $moves = $game->moves ?? [];
            if (count($moves) < 32) { // Need at least 16 moves by each side
                return false;
            }

            // Check the last 32 moves (16 moves by each player)
            $last32Moves = array_slice($moves, -32);

            foreach ($last32Moves as $move) {
                if (!$this->isQueenMove($move)) {
                    return false;
                }
            }

            return true;
        } catch (\Exception $e) {
            Log::error('Error checking queen-only moves', [
                'game_id' => $game->id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Generic repetition checker
     */
    private function checkRepetition(Game $game, int $threshold): bool
    {
        try {
            $positionHistory = $game->position_history ?? [];
            if (empty($positionHistory)) {
                // Build position history from moves if not available
                $positionHistory = $this->buildPositionHistory($game);
            }

            $positionCounts = array_count_values($positionHistory);

            foreach ($positionCounts as $count) {
                if ($count >= $threshold) {
                    return true;
                }
            }

            return false;
        } catch (\Exception $e) {
            Log::error('Error checking repetition', [
                'game_id' => $game->id,
                'error' => $e->getMessage()
            ]);
            return false;
        }
    }

    /**
     * Build position history from game moves
     */
    private function buildPositionHistory(Game $game): array
    {
        $positions = [];
        $moves = $game->moves ?? [];

        $chess = new ChessPHP();

        // Add initial position
        $positions[] = $chess->fen();

        // Apply each move and record position
        foreach ($moves as $move) {
            if (isset($move['from']) && isset($move['to'])) {
                $chess->move([
                    'from' => $move['from'],
                    'to' => $move['to'],
                    'promotion' => $move['promotion'] ?? null
                ]);
                $positions[] = $chess->fen();
            }
        }

        return $positions;
    }

    /**
     * Get pieces from FEN string
     */
    private function getPiecesFromFEN(string $fen): array
    {
        $fenParts = explode(' ', $fen);
        $boardPart = $fenParts[0] ?? '';

        $pieces = [];
        $ranks = explode('/', $boardPart);

        foreach ($ranks as $rankIndex => $rank) {
            $fileIndex = 0;
            for ($i = 0; $i < strlen($rank); $i++) {
                $char = $rank[$i];

                if (is_numeric($char)) {
                    // Skip empty squares
                    $fileIndex += (int)$char;
                } else {
                    // Piece found
                    $pieces[] = [
                        'type' => strtolower($char),
                        'color' => ctype_lower($char) ? 'black' : 'white',
                        'square' => $this->indexToSquare($fileIndex, 7 - $rankIndex)
                    ];
                    $fileIndex++;
                }
            }
        }

        return $pieces;
    }

    /**
     * Convert board index to algebraic notation
     */
    private function indexToSquare(int $file, int $rank): string
    {
        $files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
        return $files[$file] . ($rank + 1);
    }

    /**
     * Check if position has insufficient material for checkmate
     */
    private function hasInsufficientMaterial(array $pieces): bool
    {
        $whitePieces = [];
        $blackPieces = [];

        foreach ($pieces as $piece) {
            if ($piece['color'] === 'white') {
                $whitePieces[] = $piece['type'];
            } else {
                $blackPieces[] = $piece['type'];
            }
        }

        // King vs King
        if (count($whitePieces) === 1 && count($blackPieces) === 1) {
            return true;
        }

        // King and Bishop vs King
        if ((count($whitePieces) === 2 && in_array('b', $whitePieces) && count($blackPieces) === 1) ||
            (count($blackPieces) === 2 && in_array('b', $blackPieces) && count($whitePieces) === 1)) {
            return true;
        }

        // King and Knight vs King
        if ((count($whitePieces) === 2 && in_array('n', $whitePieces) && count($blackPieces) === 1) ||
            (count($blackPieces) === 2 && in_array('n', $blackPieces) && count($whitePieces) === 1)) {
            return true;
        }

        // King and Bishop vs King and Bishop of same color
        if (count($whitePieces) === 2 && count($blackPieces) === 2 &&
            in_array('b', $whitePieces) && in_array('b', $blackPieces)) {
            // Check if bishops are on same color squares
            return $this->areBishopsSameColor($pieces);
        }

        return false;
    }

    /**
     * Check if bishops are on same colored squares
     */
    private function areBishopsSameColor(array $pieces): bool
    {
        $whiteBishopSquare = null;
        $blackBishopSquare = null;

        foreach ($pieces as $piece) {
            if ($piece['type'] === 'b') {
                if ($piece['color'] === 'white') {
                    $whiteBishopSquare = $piece['square'];
                } else {
                    $blackBishopSquare = $piece['square'];
                }
            }
        }

        if (!$whiteBishopSquare || !$blackBishopSquare) {
            return false;
        }

        // Check if squares are same color (both light or both dark)
        $whiteSquareColor = $this->getSquareColor($whiteBishopSquare);
        $blackSquareColor = $this->getSquareColor($blackBishopSquare);

        return $whiteSquareColor === $blackSquareColor;
    }

    /**
     * Get square color (light/dark)
     */
    private function getSquareColor(string $square): string
    {
        $file = ord(substr($square, 0, 1)) - ord('a');
        $rank = (int)substr($square, 1, 1) - 1;

        return (($file + $rank) % 2 === 0) ? 'light' : 'dark';
    }

    /**
     * Check if a move is a queen move
     */
    private function isQueenMove(array $move): bool
    {
        // Check if the piece moved is a queen
        if (isset($move['piece']) && strtolower($move['piece']) === 'q') {
            return true;
        }

        // Check from the move notation
        if (isset($move['san'])) {
            return strpos(strtolower($move['san']), 'q') === 0;
        }

        // Check from the move string in older format
        if (isset($move['move']) && is_string($move['move'])) {
            return strpos(strtolower($move['move']), 'q') === 0;
        }

        return false;
    }

    /**
     * Record a position in the game's position history
     */
    public function recordPosition(Game $game, string $fen): void
    {
        $positionHistory = $game->position_history ?? [];
        $positionHistory[] = $fen;

        // Update the game's position history
        $game->position_history = $positionHistory;
        $game->save();
    }

    /**
     * Update the halfmove clock after a move
     */
    public function updateHalfmoveClock(Game $game, array $move): void
    {
        $currentClock = $game->halfmove_clock ?? 0;

        // Reset clock if pawn move or capture
        if ($this->isPawnMove($move) || $this->isCapture($move)) {
            $currentClock = 0;
        } else {
            $currentClock++;
        }

        $game->halfmove_clock = $currentClock;
        $game->save();
    }

    /**
     * Update consecutive queen moves counter
     */
    public function updateQueenMovesCounter(Game $game, array $move): void
    {
        $currentCount = $game->consecutive_queen_moves ?? 0;

        if ($this->isQueenMove($move)) {
            $currentCount++;
        } else {
            $currentCount = 0;
        }

        $game->consecutive_queen_moves = $currentCount;
        $game->save();
    }

    /**
     * Check if move is a pawn move
     */
    private function isPawnMove(array $move): bool
    {
        if (isset($move['piece'])) {
            return strtolower($move['piece']) === 'p';
        }

        if (isset($move['san'])) {
            return !in_array(substr($move['san'], 0, 1), ['K', 'Q', 'R', 'B', 'N', 'k', 'q', 'r', 'b', 'n']);
        }

        return false;
    }

    /**
     * Check if move is a capture
     */
    private function isCapture(array $move): bool
    {
        if (isset($move['captured'])) {
            return !empty($move['captured']);
        }

        if (isset($move['san'])) {
            return strpos($move['san'], 'x') !== false;
        }

        return false;
    }
}