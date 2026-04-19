<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTacticalStageProgress extends Model
{
    protected $table = 'user_tactical_stage_progress';

    protected $fillable = [
        'user_id',
        'stage_id',
        'attempted',
        'solved',
        'unlocked',
        'last_index',
        'completed_puzzle_ids',
        'puzzle_scores',
        'completed_at',
    ];

    protected $casts = [
        'stage_id' => 'integer',
        'attempted' => 'integer',
        'solved' => 'integer',
        'unlocked' => 'boolean',
        'last_index' => 'integer',
        'completed_puzzle_ids' => 'array',
        'puzzle_scores' => 'array',
        'completed_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
