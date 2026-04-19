<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TacticalBadge extends Model
{
    protected $table = 'tactical_badges';

    protected $fillable = [
        'slug',
        'name',
        'description',
        'category',
        'tier',
        'icon',
        'criteria',
        'sort_order',
        'is_active',
    ];

    protected $casts = [
        'criteria' => 'array',
        'sort_order' => 'integer',
        'is_active' => 'boolean',
    ];

    public function userBadges(): HasMany
    {
        return $this->hasMany(UserTacticalBadge::class, 'badge_id');
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_tactical_badges', 'badge_id', 'user_id')
            ->withPivot(['awarded_at', 'progress_snapshot'])
            ->withTimestamps();
    }
}
