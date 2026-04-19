<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTacticalStats extends Model
{
    protected $table = 'user_tactical_stats';

    protected $fillable = [
        'user_id',
        'rating',
        'total_attempted',
        'total_solved',
        'streak',
        'best_streak',
        'peak_rating',
        'last_solved_at',
    ];

    protected $casts = [
        'rating' => 'integer',
        'total_attempted' => 'integer',
        'total_solved' => 'integer',
        'streak' => 'integer',
        'best_streak' => 'integer',
        'peak_rating' => 'integer',
        'last_solved_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
