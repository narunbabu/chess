<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTrainingDrillAttempt extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'user_id',
        'training_drill_id',
        'solved',
        'submitted_solution',
        'time_spent_seconds',
        'hints_used',
        'failure_reason',
        'created_at',
    ];

    protected $casts = [
        'solved' => 'boolean',
        'submitted_solution' => 'array',
        'time_spent_seconds' => 'integer',
        'hints_used' => 'integer',
        'created_at' => 'datetime',
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
