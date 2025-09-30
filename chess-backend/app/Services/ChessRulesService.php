<?php

namespace App\Services;

use App\Models\Game;
use Illuminate\Support\Facades\Log;

class ChessRulesService
{
    /**
     * Analyze game state to determine if the game has ended
     */
    public function analyzeGameState(Game $game): array
    {
        $fen = $game->fen;
        $moves = $game->moves ?? [];

        Log::info('ChessRulesService: Analyzing game state', [
            'game_id' => $game->id,
            'moves_count' => count($moves),
            'current_fen' => $fen
        ]);

        // Use enhanced fallback analysis with basic checkmate detection
        return $this->enhancedAnalysis($game, $fen, $moves);

        // try {
        //     // Create a chess game from the FEN position
        //     $chessGame = new ChessGame($fen);

        //     $analysis = [
        //         'is_check' => method_exists($chessGame, 'isCheck') ? $chessGame->isCheck() : false,
        //         'is_checkmate' => method_exists($chessGame, 'isMate') ? $chessGame->isMate() : false,
        //         'is_stalemate' => method_exists($chessGame, 'isStalemate') ? $chessGame->isStalemate() : false,
        //         'is_insufficient_material' => method_exists($chessGame, 'isInsufficientMaterial') ? $chessGame->isInsufficientMaterial() : false,
        //         'is_threefold_repetition' => $this->isThreefoldRepetition($moves),
        //         'is_fifty_move_rule' => $this->isFiftyMoveRule($fen, $moves),
        //         'current_turn' => $this->getCurrentTurn($fen),
        //         'game_over' => false,
        //         'winner' => null,
        //         'result' => null
        //     ];

        //     // Determine if game is over
        //     if ($analysis['is_checkmate']) {
        //         $analysis['game_over'] = true;
        //         $analysis['winner'] = $this->getWinnerFromCheckmate($fen);
        //         $analysis['result'] = $analysis['winner'] === 'white' ? '1-0' : '0-1';
        //     } elseif ($analysis['is_stalemate'] || $analysis['is_insufficient_material'] ||
        //               $analysis['is_threefold_repetition'] || $analysis['is_fifty_move_rule']) {
        //         $analysis['game_over'] = true;
        //         $analysis['result'] = '1/2-1/2';
        //     }

        //     Log::info('ChessRulesService: Analysis complete', [
        //         'game_id' => $game->id,
        //         'analysis' => $analysis
        //     ]);

        //     return $analysis;

        // } catch (\Exception $e) {
        //     Log::error('ChessRulesService: Error analyzing game state', [
        //         'game_id' => $game->id,
        //         'error' => $e->getMessage(),
        //         'fen' => $fen
        //     ]);

        //     // Fallback to basic analysis if chess library fails
        //     return $this->fallbackAnalysis($game, $fen, $moves);
        // }
    }

    /**
     * Enhanced analysis with basic checkmate detection
     */
    private function enhancedAnalysis(Game $game, string $fen, array $moves): array
    {
        $last = end($moves) ?: [];
        $san  = $last['san'] ?? null;
        $mateHint = (bool)($last['is_mate_hint'] ?? false);

        $isCheckmate = false;

        // 1) strongest signal: SAN contains '#'
        if (is_string($san) && strpos($san, '#') !== false) {
            $isCheckmate = true;
            Log::info('Mate by SAN hash detected', ['san' => $san, 'fen' => $fen]);
        }
        // 2) second signal: client hint
        elseif ($mateHint) {
            $isCheckmate = true;
            Log::info('Mate by client hint', ['fen' => $fen]);
        }
        // 3) (optional) your existing simple patterns
        elseif ($this->detectEndgamePatterns($fen, $moves)) {
            $isCheckmate = true;
            Log::info('Mate by simple pattern', ['fen' => $fen]);
        }

        $analysis = [
            'is_check' => false,
            'is_checkmate' => $isCheckmate,
            'is_stalemate' => false,
            'is_insufficient_material' => $this->isInsufficientMaterial($fen),
            'is_threefold_repetition' => $this->isThreefoldRepetition($moves),
            'is_fifty_move_rule' => $this->isFiftyMoveRule($fen, $moves),
            'current_turn' => $this->getCurrentTurn($fen), // 'w'|'b'
            'game_over' => false,
            'winner' => null,
            'result' => null,
        ];

        if ($analysis['is_checkmate']) {
            $analysis['game_over'] = true;
            $analysis['winner'] = $this->winnerFromMate($fen); // opposite of side-to-move
            $analysis['result'] = $analysis['winner'] === 'white' ? '1-0' : '0-1';
        } elseif ($analysis['is_stalemate'] || $analysis['is_insufficient_material'] || $analysis['is_threefold_repetition'] || $analysis['is_fifty_move_rule']) {
            $analysis['game_over'] = true;
            $analysis['result'] = '1/2-1/2';
        }

        return $analysis;
    }

    /**
     * Fallback analysis when chess library fails
     */
    private function fallbackAnalysis(Game $game, string $fen, array $moves): array
    {
        Log::warning('ChessRulesService: Using fallback analysis', [
            'game_id' => $game->id
        ]);

        return [
            'is_check' => false,
            'is_checkmate' => false,
            'is_stalemate' => false,
            'is_insufficient_material' => $this->isInsufficientMaterial($fen),
            'is_threefold_repetition' => false,
            'is_fifty_move_rule' => $this->isFiftyMoveRule($fen, $moves),
            'current_turn' => $this->getCurrentTurn($fen),
            'game_over' => false,
            'winner' => null,
            'result' => null
        ];
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
     * Check for threefold repetition by analyzing move history
     */
    private function isThreefoldRepetition(array $moves): bool
    {
        // TODO: Implement threefold repetition detection using frontend chess.js
        // The frontend already handles this, so for now we return false
        // and rely on client-side detection
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

    private function winnerFromMate(string $fen): string
    {
        $active = $this->getCurrentTurn($fen); // returns 'w' or 'b'
        // Side to move is the side *in mate*; winner is the opposite
        return $active === 'w' ? 'black' : 'white';
    }

    /**
     * Determine winner from checkmate position
     */
    private function getWinnerFromCheckmate(string $fen): ?string
    {
        // Extract active color from FEN
        $fenParts = explode(' ', $fen);
        if (count($fenParts) >= 2) {
            $activeColor = $fenParts[1];
            // If it's white's turn and they're in checkmate, black wins
            return $activeColor === 'w' ? 'black' : 'white';
        }

        return null;
    }

    /**
     * Validate a move in algebraic notation
     */
    public function validateMove(string $fen, string $move): bool
    {
        // Move validation happens on frontend with chess.js
        // Backend trusts the client's move validation
        // This method is kept for potential future server-side validation
        return true;
    }

    /**
     * Get all legal moves from a position
     */
    public function getLegalMoves(string $fen): array
    {
        // Legal moves are calculated on frontend with chess.js
        // Backend doesn't need to recalculate them
        return [];
    }

    /**
     * Basic checkmate detection using pattern recognition
     * This is a simplified approach until the full chess library is integrated
     */
    private function detectBasicCheckmate(string $fen, array $moves): bool
    {
        // If we have recent moves, check for common checkmate patterns
        if (count($moves) < 4) {
            return false; // Too early for most checkmates
        }

        // Get the last move to analyze the current position
        $lastMove = end($moves);
        if (!$lastMove || !isset($lastMove['san'])) {
            return false;
        }

        $lastMoveSan = $lastMove['san'];

        // Look for checkmate indicators in algebraic notation
        // Most chess engines/frontends add '#' for checkmate
        if (strpos($lastMoveSan, '#') !== false) {
            Log::info('ChessRulesService: Checkmate detected via algebraic notation', [
                'last_move' => $lastMoveSan,
                'fen' => $fen
            ]);
            return true;
        }

        // Additional pattern-based detection can be added here
        // For now, we'll also check for some basic endgame patterns
        return $this->detectEndgamePatterns($fen, $moves);
    }

    /**
     * Detect basic endgame patterns that might indicate checkmate
     */
    private function detectEndgamePatterns(string $fen, array $moves): bool
    {
        // Parse FEN to get board position
        $fenParts = explode(' ', $fen);
        if (count($fenParts) < 2) {
            return false;
        }

        $boardPosition = $fenParts[0];
        $activeColor = $fenParts[1];

        // Count pieces to see if we're in an endgame
        $pieceCount = preg_replace('/[0-8\/]/', '', $boardPosition);
        $totalPieces = strlen($pieceCount);

        // If very few pieces remain, this might be a simple mate
        if ($totalPieces <= 6) {
            // Check for back-rank mate patterns
            if ($this->isBackRankMatePattern($boardPosition, $activeColor)) {
                Log::info('ChessRulesService: Back-rank mate pattern detected', [
                    'fen' => $fen,
                    'active_color' => $activeColor
                ]);
                return true;
            }
        }

        return false;
    }

    /**
     * Check for back-rank mate patterns
     */
    private function isBackRankMatePattern(string $boardPosition, string $activeColor): bool
    {
        $ranks = explode('/', $boardPosition);

        if (count($ranks) !== 8) {
            return false;
        }

        // Check for typical back-rank mate scenarios
        $rank1 = $ranks[7]; // White's back rank
        $rank8 = $ranks[0]; // Black's back rank

        // Look for patterns where a king is trapped on the back rank
        // This is a very basic check - in practice, you'd need full position analysis

        if ($activeColor === 'w') {
            // If it's white's turn and they're in potential mate
            return $this->hasTrappedKing($rank1, 'white') && $this->hasAttackingPieces($ranks, 'black');
        } else {
            // If it's black's turn and they're in potential mate
            return $this->hasTrappedKing($rank8, 'black') && $this->hasAttackingPieces($ranks, 'white');
        }
    }

    /**
     * Check if a king appears trapped on its back rank
     */
    private function hasTrappedKing(string $rank, string $color): bool
    {
        $kingSymbol = ($color === 'white') ? 'K' : 'k';

        // King must be present on the rank
        if (strpos($rank, $kingSymbol) === false) {
            return false;
        }

        // Very basic check: if there are pawns blocking escape
        $blockingPieces = ($color === 'white') ? 'P' : 'p';
        return strpos($rank, $blockingPieces) !== false;
    }

    /**
     * Check if there are attacking pieces that could deliver mate
     */
    private function hasAttackingPieces(array $ranks, string $attackingColor): bool
    {
        $attackingSymbols = ($attackingColor === 'white') ? 'QRBN' : 'qrbn';

        foreach ($ranks as $rank) {
            for ($i = 0; $i < strlen($attackingSymbols); $i++) {
                if (strpos($rank, $attackingSymbols[$i]) !== false) {
                    return true;
                }
            }
        }

        return false;
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