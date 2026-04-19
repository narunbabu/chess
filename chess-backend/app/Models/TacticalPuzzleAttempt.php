<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TacticalPuzzleAttempt extends Model
{
    protected $table = 'tactical_puzzle_attempts';

    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'stage_id',
        'puzzle_id',
        'puzzle_rating',
        'success',
        'wrong_count',
        'solution_shown',
        'cct_my_found',
        'cct_my_total',
        'cct_opp_found',
        'cct_opp_total',
        'cct_attempted',
        'cct_quality',
        'puzzle_score',
        'score_breakdown',
        'rating_delta',
        'rating_before',
        'rating_after',
        'time_spent_ms',
        'created_at',
    ];

    protected $casts = [
        'stage_id' => 'integer',
        'puzzle_rating' => 'integer',
        'success' => 'boolean',
        'wrong_count' => 'integer',
        'solution_shown' => 'boolean',
        'cct_my_found' => 'integer',
        'cct_my_total' => 'integer',
        'cct_opp_found' => 'integer',
        'cct_opp_total' => 'integer',
        'cct_attempted' => 'boolean',
        'cct_quality' => 'integer',
        'puzzle_score' => 'integer',
        'score_breakdown' => 'array',
        'rating_delta' => 'integer',
        'rating_before' => 'integer',
        'rating_after' => 'integer',
        'time_spent_ms' => 'integer',
        'created_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
