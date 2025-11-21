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
                $result['score_change'] = $goal['score_reward'] ?? 10;
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
            'reach_square' => $this->validateReachSquare($goal, $move),
            'capture_piece' => $this->validateCapturePiece($goal, $move, $fenAfter),
            'make_move' => $this->validateMakeMove($goal, $move),
            'avoid_square' => $this->validateAvoidSquare($goal, $move),
            'check_threat' => $this->validateCheckThreat($goal, $fenAfter),
            'mate_in_n' => $this->validateMateInN($goal, $fenAfter),
            default => ['success' => false, 'feedback' => 'Unknown goal type'],
        };
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
        // Simplified logic - in real implementation, would parse FEN to check captures
        if (isset($goal['target_pieces'])) {
            // This would need actual board state parsing
            return ['success' => true, 'feedback' => 'Capture validated'];
        }

        return ['success' => false, 'feedback' => 'No capture detected'];
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
}