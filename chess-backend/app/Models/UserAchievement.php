<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAchievement extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'achievement_id',
        'earned_at',
    ];

    protected $casts = [
        'earned_at' => 'datetime',
    ];

    /**
     * Get the user
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * Get the achievement
     */
    public function achievement(): BelongsTo
    {
        return $this->belongsTo(TutorialAchievement::class, 'achievement_id');
    }

    /**
     * Scope to get recently earned achievements
     */
    public function scopeRecent($query, $days = 7)
    {
        return $query->where('earned_at', '>=', now()->subDays($days));
    }

    /**
     * Get formatted earned date
     */
    public function getFormattedEarnedAtAttribute(): string
    {
        return $this->earned_at->format('M j, Y');
    }

    /**
     * Get relative earned date
     */
    public function getRelativeEarnedAtAttribute(): string
    {
        return $this->earned_at->diffForHumans();
    }
}