<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserTacticalBadge extends Model
{
    protected $table = 'user_tactical_badges';

    protected $fillable = [
        'user_id',
        'badge_id',
        'awarded_at',
        'progress_snapshot',
    ];

    protected $casts = [
        'awarded_at' => 'datetime',
        'progress_snapshot' => 'array',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function badge(): BelongsTo
    {
        return $this->belongsTo(TacticalBadge::class, 'badge_id');
    }
}
