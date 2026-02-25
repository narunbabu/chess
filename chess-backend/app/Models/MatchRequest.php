<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MatchRequest extends Model
{
    protected $fillable = [
        'token',
        'requester_id',
        'status',
        'preferred_color',
        'time_control_minutes',
        'increment_seconds',
        'game_mode',
        'game_id',
        'accepted_by_user_id',
        'expires_at',
    ];

    protected $casts = [
        'time_control_minutes' => 'integer',
        'increment_seconds' => 'integer',
        'expires_at' => 'datetime',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function targets(): HasMany
    {
        return $this->hasMany(MatchRequestTarget::class);
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by_user_id');
    }

    public function game(): BelongsTo
    {
        return $this->belongsTo(Game::class);
    }

    public function scopeSearching($query)
    {
        return $query->where('status', 'searching');
    }

    public function isExpired(): bool
    {
        return $this->expires_at->isPast();
    }
}
