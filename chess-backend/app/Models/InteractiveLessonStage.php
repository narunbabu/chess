<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class InteractiveLessonStage extends Model
{
    use HasFactory;

    protected $fillable = [
        'lesson_id',
        'stage_order',
        'title',
        'instruction_text',
        'initial_fen',
        'orientation',
        'goals',
        'success_criteria',
        'hints',
        'visual_aids',
        'alternative_solutions',
        'auto_reset_on_success',
        'auto_reset_delay_ms',
        'feedback_messages',
        'is_active',
    ];

    protected $casts = [
        'goals' => 'array',
        'success_criteria' => 'array',
        'hints' => 'array',
        'visual_aids' => 'array',
        'alternative_solutions' => 'array',
        'feedback_messages' => 'array',
        'auto_reset_on_success' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Get the lesson this stage belongs to
     */
    public function lesson(): BelongsTo
    {
        return $this->belongsTo(TutorialLesson::class, 'lesson_id');
    }

    /**
     * Get user progress records for this stage
     */
    public function userProgress(): HasMany
    {
        return $this->hasMany(UserStageProgress::class, 'stage_id');
    }

    /**
     * Get specific user progress for this stage
     */
    public function getUserProgress($userId): ?UserStageProgress
    {
        return $this->userProgress()->where('user_id', $userId)->first();
    }

    /**
     * Get visual aids configuration
     */
    public function getVisualAidsAttribute($value): array
    {
        return $value ? json_decode($value, true) : [
            'arrows' => [],
            'highlights' => [],
            'ghost_pieces' => []
        ];
    }

    /**
     * Get goals configuration
     */
    public function getGoalsAttribute($value): array
    {
        return $value ? json_decode($value, true) : [];
    }

    /**
     * Get feedback messages with defaults
     */
    public function getFeedbackMessagesAttribute($value): array
    {
        $defaults = [
            'success' => '✅ Well done! Great move!',
            'partial' => '👍 Good try, but there\'s a better move.',
            'fail' => '❌ That\'s not quite right. Try again!',
            'hint' => '💡 Hint: Think about how pieces work together.',
        ];

        $custom = $value ? json_decode($value, true) : [];
        return array_merge($defaults, $custom);
    }

    /**
     * Check if move meets stage goals
     */
    public function validateMove(string $move, string $fenAfter): array
    {
        $result = [
            'success' => false,
            'feedback' => '',
            'feedback_type' => 'fail',
            'score_change' => 0,
            'next_stage_ready' => false,
        ];

        foreach ($this->goals as $goal) {
            $goalResult = $this->validateGoal($goal, $move, $fenAfter);

            if ($goalResult['success']) {
                $result['success'] = true;
                $result['feedback'] = $goalResult['feedback'] ?? $this->feedback_messages['success'];
                $result['feedback_type'] = 'success';

                // Calculate proportional score based on total stages in lesson
                // Each stage is worth 100 / total_stages points
                $totalStages = $this->lesson->interactiveStages()->active()->count();
                $proportionalScore = $totalStages > 0 ? round(100 / $totalStages, 2) : 10;

                $result['score_change'] = $goal['score_reward'] ?? $proportionalScore;
                $result['next_stage_ready'] = $this->auto_reset_on_success;
                break;
            } elseif (isset($goalResult['feedback'])) {
                $result['feedback'] = $goalResult['feedback'];
                if (isset($goalResult['feedback_type'])) {
                    $result['feedback_type'] = $goalResult['feedback_type'];
                }
                break;
            }
        }

        return $result;
    }

    /**
     * Validate individual goal
     */
    private function validateGoal(array $goal, string $move, string $fenAfter): array
    {
        return match($goal['type']) {
            'demonstration' => ['success' => true, 'feedback' => 'Stage completed!'],
            'reach_square' => $this->validateReachSquare($goal, $move),
            'capture_piece' => $this->validateCapturePiece($goal, $move, $fenAfter),
            'make_move' => $this->validateMakeMove($goal, $move),
            'move_piece' => $this->validateMovePiece($goal, $move),
            'capture' => $this->validateCapture($goal, $move, $fenAfter),
            'avoid_square' => $this->validateAvoidSquare($goal, $move),
            'check_threat' => $this->validateCheckThreat($goal, $fenAfter),
            'mate_in_n' => $this->validateMateInN($goal, $fenAfter),
            'castle' => $this->validateCastle($goal, $move),
            'escape_check' => $this->validateEscapeCheck($goal, $move),
            default => ['success' => false, 'feedback' => 'Unknown goal type: ' . ($goal['type'] ?? 'undefined')],
        };
    }

    /**
     * Check if this is a demonstration stage (view-only, no action required)
     */
    public function isDemonstrationStage(): bool
    {
        if (empty($this->goals)) {
            return false;
        }

        foreach ($this->goals as $goal) {
            if (isset($goal['type']) && $goal['type'] === 'demonstration' && ($goal['auto_complete'] ?? false)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Validate reaching a specific square
     */
    private function validateReachSquare(array $goal, string $move): array
    {
        $targetSquare = substr($move, -2, 2);

        if (in_array($targetSquare, $goal['target_squares'])) {
            return [
                'success' => true,
                'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['success']
            ];
        }

        return [
            'success' => false,
            'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['fail']
        ];
    }

    /**
     * Validate capturing a specific piece
     */
    private function validateCapturePiece(array $goal, string $move, string $fenAfter): array
    {
        // Parse move: e.g., "d4f6" -> from: d4, to: f6
        if (strlen($move) < 4) {
            return ['success' => false, 'feedback' => 'Invalid move format'];
        }

        $from = substr($move, 0, 2);
        $to = substr($move, 2, 2);

        // Parse initial FEN to check what piece was at the target square
        $fenParts = explode(' ', $this->initial_fen);
        $boardState = $fenParts[0];
        $squares = $this->parseFenToSquares($boardState);

        // Check if there was a piece at the target square
        $targetSquareLower = strtolower($to);
        $capturedPiece = $squares[$targetSquareLower] ?? null;

        if ($capturedPiece === null) {
            return ['success' => false, 'feedback' => 'No piece at target square to capture'];
        }

        // Get the moving piece and validate movement pattern
        $fromSquareLower = strtolower($from);
        $movingPiece = $squares[$fromSquareLower] ?? null;

        if ($movingPiece === null) {
            return ['success' => false, 'feedback' => 'No piece at the starting square'];
        }

        // Validate piece movement pattern
        $fromFile = ord($from[0]) - ord('a');
        $fromRank = intval($from[1]) - 1;
        $toFile = ord($to[0]) - ord('a');
        $toRank = intval($to[1]) - 1;

        $fileDiff = abs($toFile - $fromFile);
        $rankDiff = abs($toRank - $fromRank);

        $pieceType = strtolower($movingPiece);

        $isValidMovement = match($pieceType) {
            'b' => $fileDiff === $rankDiff && $fileDiff > 0,
            'r' => ($fileDiff === 0 && $rankDiff > 0) || ($rankDiff === 0 && $fileDiff > 0),
            'n' => ($fileDiff === 2 && $rankDiff === 1) || ($fileDiff === 1 && $rankDiff === 2),
            'q' => ($fileDiff === $rankDiff) || ($fileDiff === 0) || ($rankDiff === 0),
            'k' => $fileDiff <= 1 && $rankDiff <= 1 && ($fileDiff > 0 || $rankDiff > 0),
            'p' => true,
            default => false,
        };

        if (!$isValidMovement) {
            $pieceName = match($pieceType) {
                'b' => 'bishop',
                'r' => 'rook',
                'n' => 'knight',
                'q' => 'queen',
                'k' => 'king',
                'p' => 'pawn',
                default => 'piece',
            };

            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? "That move doesn't follow the {$pieceName}'s movement pattern."
            ];
        }

        // If specific target pieces are required, validate them
        if (isset($goal['target_pieces']) && !empty($goal['target_pieces'])) {
            $capturedPieceLower = strtolower($capturedPiece);
            $targetPiecesLower = array_map('strtolower', $goal['target_pieces']);

            if (!in_array($capturedPieceLower, $targetPiecesLower)) {
                return [
                    'success' => false,
                    'feedback' => $goal['feedback_fail'] ?? 'Wrong piece captured. Try capturing the correct piece.'
                ];
            }
        }

        // Verify the move resulted in a capture by checking FEN
        $fenAfterParts = explode(' ', $fenAfter);
        $boardStateAfter = $fenAfterParts[0];
        $squaresAfter = $this->parseFenToSquares($boardStateAfter);

        // Confirm piece moved and from square is empty
        $fromSquareLower = strtolower($from);
        $pieceAtTarget = $squaresAfter[$targetSquareLower] ?? null;
        $pieceAtFrom = $squaresAfter[$fromSquareLower] ?? null;

        if ($pieceAtTarget !== null && $pieceAtFrom === null) {
            return [
                'success' => true,
                'feedback' => $goal['feedback_success'] ?? 'Excellent capture!'
            ];
        }

        return ['success' => false, 'feedback' => 'Capture did not complete correctly'];
    }

    /**
     * Validate making a specific move
     */
    private function validateMakeMove(array $goal, string $move): array
    {
        $validMoves = $goal['valid_moves'] ?? [];

        if (in_array($move, $validMoves)) {
            return [
                'success' => true,
                'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['success']
            ];
        }

        return [
            'success' => false,
            'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['fail']
        ];
    }

    /**
     * Validate moving a piece (accepts any valid chess move)
     * For piece-specific validation (e.g., only diagonal moves for bishop)
     */
    private function validateMovePiece(array $goal, string $move): array
    {
        // Parse move: e.g., "d4f6" -> from: d4, to: f6
        if (strlen($move) < 4) {
            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['incorrect'] ?? 'Invalid move format'
            ];
        }

        $from = substr($move, 0, 2);
        $to = substr($move, 2, 2);

        // Convert squares to coordinates (a1=0,0 to h8=7,7)
        $fromFile = ord($from[0]) - ord('a');
        $fromRank = intval($from[1]) - 1;
        $toFile = ord($to[0]) - ord('a');
        $toRank = intval($to[1]) - 1;

        // Check if coordinates are valid
        if ($fromFile < 0 || $fromFile > 7 || $fromRank < 0 || $fromRank > 7 ||
            $toFile < 0 || $toFile > 7 || $toRank < 0 || $toRank > 7) {
            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? 'Invalid square'
            ];
        }

        // If piece is specified, validate movement pattern
        if (isset($goal['piece'])) {
            $piece = strtolower($goal['piece']);
            $fileDiff = abs($toFile - $fromFile);
            $rankDiff = abs($toRank - $fromRank);

            $isValid = match($piece) {
                'bishop' => $fileDiff === $rankDiff && $fileDiff > 0, // Diagonal
                'rook' => ($fileDiff === 0 && $rankDiff > 0) || ($rankDiff === 0 && $fileDiff > 0), // Straight
                'knight' => ($fileDiff === 2 && $rankDiff === 1) || ($fileDiff === 1 && $rankDiff === 2), // L-shape
                'queen' => ($fileDiff === $rankDiff) || ($fileDiff === 0) || ($rankDiff === 0), // Diagonal or straight
                'king' => $fileDiff <= 1 && $rankDiff <= 1 && ($fileDiff > 0 || $rankDiff > 0), // One square any direction
                'pawn' => true, // Simplified - pawn movement is complex
                default => true, // Accept any move if piece not specified
            };

            if ($isValid) {
                return [
                    'success' => true,
                    'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['correct'] ?? 'Great move!'
                ];
            }

            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['incorrect'] ?? 'That move doesn\'t follow the piece\'s movement pattern'
            ];
        }

        // If no piece specified, accept any valid move
        return [
            'success' => true,
            'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['correct'] ?? 'Move validated'
        ];
    }

    /**
     * Validate capture (simplified version of validateCapturePiece)
     */
    private function validateCapture(array $goal, string $move, string $fenAfter): array
    {
        // Parse move: e.g., "d4f6" -> from: d4, to: f6
        if (strlen($move) < 4) {
            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? 'Invalid move format'
            ];
        }

        $from = substr($move, 0, 2);
        $to = substr($move, 2, 2);

        // Parse initial FEN to check if there was a piece at the target square
        $fenParts = explode(' ', $this->initial_fen);
        $boardState = $fenParts[0]; // Get the board state part of FEN

        // Convert FEN board state to square-piece mapping
        $squares = $this->parseFenToSquares($boardState);

        // Check if there was a piece at the target square BEFORE the move
        // The target square should have had an enemy piece
        $targetSquareLower = strtolower($to);
        $hadPieceAtTarget = isset($squares[$targetSquareLower]) && $squares[$targetSquareLower] !== null;

        // Get the piece that's moving to validate movement pattern
        $fromSquareLower = strtolower($from);
        $movingPiece = $squares[$fromSquareLower] ?? null;

        if ($movingPiece === null) {
            return [
                'success' => false,
                'feedback' => 'No piece at the starting square'
            ];
        }

        // Validate piece movement pattern
        $fromFile = ord($from[0]) - ord('a');
        $fromRank = intval($from[1]) - 1;
        $toFile = ord($to[0]) - ord('a');
        $toRank = intval($to[1]) - 1;

        $fileDiff = abs($toFile - $fromFile);
        $rankDiff = abs($toRank - $fromRank);

        // Determine piece type (lowercase to handle both white and black pieces)
        $pieceType = strtolower($movingPiece);

        // Validate movement pattern based on piece type
        $isValidMovement = match($pieceType) {
            'b' => $fileDiff === $rankDiff && $fileDiff > 0, // Bishop: Diagonal
            'r' => ($fileDiff === 0 && $rankDiff > 0) || ($rankDiff === 0 && $fileDiff > 0), // Rook: Straight
            'n' => ($fileDiff === 2 && $rankDiff === 1) || ($fileDiff === 1 && $rankDiff === 2), // Knight: L-shape
            'q' => ($fileDiff === $rankDiff) || ($fileDiff === 0) || ($rankDiff === 0), // Queen: Diagonal or straight
            'k' => $fileDiff <= 1 && $rankDiff <= 1 && ($fileDiff > 0 || $rankDiff > 0), // King: One square
            'p' => true, // Pawn: Complex, handled by chess.js validation
            default => false,
        };

        if (!$isValidMovement) {
            $pieceName = match($pieceType) {
                'b' => 'bishop',
                'r' => 'rook',
                'n' => 'knight',
                'q' => 'queen',
                'k' => 'king',
                'p' => 'pawn',
                default => 'piece',
            };

            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['incorrect'] ?? "That move doesn't follow the {$pieceName}'s movement pattern. Try again!"
            ];
        }

        // Parse the final FEN to confirm the piece moved
        $fenAfterParts = explode(' ', $fenAfter);
        $boardStateAfter = $fenAfterParts[0];
        $squaresAfter = $this->parseFenToSquares($boardStateAfter);

        // Verify that:
        // 1. There was a piece at the target square before the move
        // 2. The piece moved from 'from' to 'to'
        // 3. The 'from' square is now empty
        $pieceMovedToTarget = isset($squaresAfter[$targetSquareLower]) && $squaresAfter[$targetSquareLower] !== null;
        $fromSquareEmptyAfter = !isset($squaresAfter[$fromSquareLower]) || $squaresAfter[$fromSquareLower] === null;

        if ($hadPieceAtTarget && $pieceMovedToTarget && $fromSquareEmptyAfter) {
            // Valid capture occurred with correct piece movement
            return [
                'success' => true,
                'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['correct'] ?? 'Perfect capture! 🎯'
            ];
        }

        // No capture occurred - provide helpful feedback
        return [
            'success' => false,
            'feedback' => $goal['feedback_fail'] ?? $this->feedback_messages['incorrect'] ?? 'That move didn\'t capture the piece. Try moving to where the enemy piece is located.'
        ];
    }

    /**
     * Parse FEN board state to square-piece mapping
     *
     * @param string $boardState FEN board state (e.g., "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")
     * @return array Associative array [square => piece] (e.g., ['e2' => 'P', 'e7' => 'p', 'a1' => 'R'])
     */
    private function parseFenToSquares(string $boardState): array
    {
        $squares = [];
        $ranks = explode('/', $boardState);

        // FEN ranks are from 8 to 1 (top to bottom)
        foreach ($ranks as $rankIndex => $rankString) {
            $rank = 8 - $rankIndex; // Convert to chess rank (8, 7, 6, ..., 1)
            $file = 0; // Start from 'a' (0)

            for ($i = 0; $i < strlen($rankString); $i++) {
                $char = $rankString[$i];

                if (is_numeric($char)) {
                    // Empty squares - skip ahead
                    $file += intval($char);
                } else {
                    // Piece found - store it
                    $fileChar = chr(ord('a') + $file);
                    $square = $fileChar . $rank;
                    $squares[$square] = $char; // Store piece (e.g., 'P', 'n', 'R')
                    $file++;
                }
            }
        }

        return $squares;
    }

    /**
     * Validate avoiding a specific square
     */
    private function validateAvoidSquare(array $goal, string $move): array
    {
        $targetSquare = substr($move, -2, 2);
        $forbiddenSquares = $goal['forbidden_squares'] ?? [];

        if (in_array($targetSquare, $forbiddenSquares)) {
            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? '❌ That square is dangerous!'
            ];
        }

        return [
            'success' => false,
            'feedback' => 'Keep looking for the right move...'
        ];
    }

    /**
     * Validate check threat
     */
    private function validateCheckThreat(array $goal, string $fenAfter): array
    {
        // This would need chess engine integration to check for check
        // For now, return a placeholder
        return ['success' => false, 'feedback' => 'Check validation not implemented yet'];
    }

    /**
     * Validate mate in N moves
     */
    private function validateMateInN(array $goal, string $fenAfter): array
    {
        // This would need chess engine integration to check for mate
        // For now, return a placeholder
        return ['success' => false, 'feedback' => 'Mate validation not implemented yet'];
    }

    /**
     * Scope to get only active stages
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get stages in order
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('stage_order');
    }

    /**
     * Validate castling move
     */
    private function validateCastle(array $goal, string $move): array
    {
        // Castling moves in algebraic notation: e1g1 (kingside), e1c1 (queenside)
        // For black: e8g8 (kingside), e8c8 (queenside)
        $castlingMoves = ['e1g1', 'e1c1', 'e8g8', 'e8c8'];

        if (in_array($move, $castlingMoves)) {
            return [
                'success' => true,
                'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['success']
            ];
        }

        return [
            'success' => false,
            'feedback' => $goal['feedback_fail'] ?? 'Move your king two squares toward the rook to castle.'
        ];
    }

    /**
     * Validate escaping check
     *
     * Note: This is a simplified validation that checks if the king moved to a valid square.
     * Full chess engine integration would verify the king is truly out of check.
     */
    private function validateEscapeCheck(array $goal, string $move): array
    {
        // Parse move
        if (strlen($move) < 4) {
            return ['success' => false, 'feedback' => 'Invalid move format'];
        }

        $from = substr($move, 0, 2);
        $to = substr($move, 2, 2);

        // Basic validation: check if this is a king move (moved 1 square)
        $fromFile = ord($from[0]) - ord('a');
        $fromRank = intval($from[1]) - 1;
        $toFile = ord($to[0]) - ord('a');
        $toRank = intval($to[1]) - 1;

        $fileDiff = abs($toFile - $fromFile);
        $rankDiff = abs($toRank - $fromRank);

        // King moves one square in any direction
        $isKingMove = $fileDiff <= 1 && $rankDiff <= 1 && ($fileDiff > 0 || $rankDiff > 0);

        if (!$isKingMove) {
            return [
                'success' => false,
                'feedback' => $goal['feedback_fail'] ?? 'The king must move to escape check.'
            ];
        }

        // If specific safe squares are provided, validate against them
        if (isset($goal['safe_squares']) && !empty($goal['safe_squares'])) {
            if (!in_array($to, $goal['safe_squares'])) {
                return [
                    'success' => false,
                    'feedback' => $goal['feedback_fail'] ?? 'That square is still under attack. Try a different square.'
                ];
            }
        }

        // King moved validly
        return [
            'success' => true,
            'feedback' => $goal['feedback_success'] ?? $this->feedback_messages['success'] ?? 'Safe! Always protect your king.'
        ];
    }
}