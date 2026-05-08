<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTrainingDrillProgress extends Model
{
    protected $table = 'user_training_drill_progress';

    protected $fillable = [
        'user_id',
        'training_drill_id',
        'attempts',
        'solved_count',
        'first_try_solves',
        'hints_used',
        'total_time_seconds',
        'best_time_seconds',
        'current_streak',
        'mastery_score',
        'is_mastered',
        'last_failure_reason',
        'last_attempted_at',
        'mastered_at',
        'review_due_at',
    ];

    protected $casts = [
        'attempts' => 'integer',
        'solved_count' => 'integer',
        'first_try_solves' => 'integer',
        'hints_used' => 'integer',
        'total_time_seconds' => 'integer',
        'best_time_seconds' => 'integer',
        'current_streak' => 'integer',
        'mastery_score' => 'integer',
        'is_mastered' => 'boolean',
        'last_attempted_at' => 'datetime',
        'mastered_at' => 'datetime',
        'review_due_at' => 'date',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function drill(): BelongsTo
    {
        return $this->belongsTo(TrainingDrill::class, 'training_drill_id');
    }
}
