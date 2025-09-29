<?php

namespace App\Services;

use App\Models\Game;

class ChessRulesService
{
    /**
     * Analyze game state to determine if the game has ended
     */
    public function analyzeGameState(Game $game): array
    {
        $fen = $game->fen;
        $moves = $game->moves ?? [];

        return [
            'is_checkmate' => $this->isCheckmate($fen, $moves),
            'is_stalemate' => $this->isStalemate($fen),
            'is_insufficient_material' => $this->isInsufficientMaterial($fen),
            'is_threefold_repetition' => $this->isThreefoldRepetition($moves),
            'is_fifty_move_rule' => $this->isFiftyMoveRule($fen, $moves),
            'current_turn' => $this->getCurrentTurn($fen)
        ];
    }

    /**
     * Check if current position is checkmate
     * For MVP, we'll use a simple approach based on chess.js validation from frontend
     */
    private function isCheckmate(string $fen, array $moves): bool
    {
        // For now, we'll rely on the frontend chess.js validation
        // In a production system, you'd want a proper PHP chess engine

        // Check if the last move put the opponent in checkmate
        // This is a simplified check - in production use a proper chess library
        return $this->containsCheckmatePattern($fen, $moves);
    }

    /**
     * Check if current position is stalemate
     */
    private function isStalemate(string $fen): bool
    {
        // Simplified stalemate detection
        // In production, use a proper chess engine

        // Basic pattern: King has no legal moves but not in check
        return false; // Placeholder for Phase 2
    }

    /**
     * Check for insufficient material
     */
    private function isInsufficientMaterial(string $fen): bool
    {
        // Extract piece placement from FEN
        $pieces = explode(' ', $fen)[0];

        // Remove numbers and slashes, convert to uppercase
        $pieceString = preg_replace('/[0-8\/]/', '', strtoupper($pieces));

        // Count pieces (excluding kings)
        $whitePieces = preg_replace('/[KB]/', '', preg_replace('/[a-z]/', '', $pieceString));
        $blackPieces = preg_replace('/[KB]/', '', preg_replace('/[A-Z]/', '', strtoupper($pieceString)));

        // Basic insufficient material patterns
        $totalPieces = strlen($whitePieces) + strlen($blackPieces);

        // King vs King
        if ($totalPieces === 0) return true;

        // King and Bishop/Knight vs King
        if ($totalPieces === 1) {
            return preg_match('/[BN]/', $whitePieces . $blackPieces);
        }

        // King and Bishop vs King and Bishop (same color squares)
        // This is simplified - in production, check bishop square colors
        if ($totalPieces === 2) {
            return strlen($whitePieces) === 1 && strlen($blackPieces) === 1
                   && preg_match('/B/', $whitePieces) && preg_match('/B/', $blackPieces);
        }

        return false;
    }

    /**
     * Check for threefold repetition
     */
    private function isThreefoldRepetition(array $moves): bool
    {
        // For now, return false - implement in Phase 2
        // Would need to track FEN positions throughout the game
        return false;
    }

    /**
     * Check for fifty-move rule
     */
    private function isFiftyMoveRule(string $fen, array $moves): bool
    {
        // Extract halfmove clock from FEN
        $fenParts = explode(' ', $fen);
        if (count($fenParts) >= 5) {
            $halfmoveClock = (int) $fenParts[4];
            return $halfmoveClock >= 50;
        }

        return false;
    }

    /**
     * Get current turn from FEN
     */
    private function getCurrentTurn(string $fen): string
    {
        $fenParts = explode(' ', $fen);
        return $fenParts[1] === 'w' ? 'white' : 'black';
    }

    /**
     * Simple checkmate pattern detection
     * This is a placeholder - in production use a proper chess engine
     */
    private function containsCheckmatePattern(string $fen, array $moves): bool
    {
        // For MVP, we'll mostly rely on frontend validation
        // But we can add some basic patterns

        // Check if it's a back-rank mate pattern
        if ($this->isBackRankMate($fen)) {
            return true;
        }

        // Add more patterns as needed
        return false;
    }

    /**
     * Detect back-rank mate pattern
     */
    private function isBackRankMate(string $fen): bool
    {
        $ranks = explode('/', explode(' ', $fen)[0]);

        // Check if kings are on back ranks with potential mate patterns
        // This is simplified - proper implementation would need full position analysis

        $rank1 = $ranks[7] ?? ''; // White's back rank
        $rank8 = $ranks[0] ?? ''; // Black's back rank

        // Basic pattern: king trapped on back rank
        return (strpos($rank1, 'k') !== false && $this->isKingTrapped($rank1, 'black')) ||
               (strpos($rank8, 'K') !== false && $this->isKingTrapped($rank8, 'white'));
    }

    /**
     * Check if king is trapped (simplified)
     */
    private function isKingTrapped(string $rank, string $color): bool
    {
        // Very basic check - in production, analyze full position
        return strlen($rank) > 2; // King has pieces around it
    }

    /**
     * Validate a move using basic chess rules
     */
    public function isValidMove(Game $game, array $move): bool
    {
        // For MVP, we'll trust the frontend validation
        // In production, implement full server-side validation

        // Basic checks
        if (!isset($move['from']) || !isset($move['to'])) {
            return false;
        }

        // Check if it's the correct player's turn
        $userRole = $this->determineUserRole($game, auth()->id());
        if ($game->turn !== $userRole) {
            return false;
        }

        return true; // Trust frontend for now
    }

    /**
     * Determine user's role in the game
     */
    private function determineUserRole(Game $game, int $userId): string
    {
        if ($game->white_player_id === $userId) {
            return 'white';
        }
        if ($game->black_player_id === $userId) {
            return 'black';
        }
        return 'spectator';
    }

    /**
     * Generate PGN from move history
     */
    public function generatePGN(Game $game): string
    {
        $moves = $game->moves ?? [];
        $pgn = '';

        // PGN headers
        $pgn .= "[Event \"Online Chess Game\"]\n";
        $pgn .= "[Site \"Chess Web App\"]\n";
        $pgn .= "[Date \"" . $game->created_at->format('Y.m.d') . "\"]\n";
        $pgn .= "[Round \"1\"]\n";
        $pgn .= "[White \"" . ($game->whitePlayer->name ?? 'White') . "\"]\n";
        $pgn .= "[Black \"" . ($game->blackPlayer->name ?? 'Black') . "\"]\n";
        $pgn .= "[Result \"" . ($game->result ?? '*') . "\"]\n\n";

        // Move text
        $moveNumber = 1;
        for ($i = 0; $i < count($moves); $i += 2) {
            $whiteMove = $moves[$i]['san'] ?? '';
            $blackMove = ($i + 1 < count($moves)) ? ($moves[$i + 1]['san'] ?? '') : '';

            $pgn .= $moveNumber . '. ' . $whiteMove;
            if ($blackMove) {
                $pgn .= ' ' . $blackMove;
            }
            $pgn .= ' ';

            $moveNumber++;
        }

        // Result
        $pgn .= ($game->result ?? '*');

        return $pgn;
    }
}