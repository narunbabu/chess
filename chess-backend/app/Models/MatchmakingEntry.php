<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MatchmakingEntry extends Model
{
    protected $table = 'matchmaking_queue';

    protected $fillable = [
        'user_id',
        'rating',
        'rating_range',
        'status',
        'matched_with_user_id',
        'matched_with_synthetic_id',
        'game_id',
        'queued_at',
        'matched_at',
        'expires_at',
    ];

    protected $casts = [
        'rating' => 'integer',
        'rating_range' => 'integer',
        'queued_at' => 'datetime',
        'matched_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function matchedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'matched_with_user_id');
    }

    public function matchedSynthetic(): BelongsTo
    {
        return $this->belongsTo(SyntheticPlayer::class, 'matched_with_synthetic_id');
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    /**
     * Scope for searching entries
     */
    public function scopeSearching($query)
    {
        return $query->where('status', 'searching');
    }

    /**
     * Check if this entry has expired
     */
    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
