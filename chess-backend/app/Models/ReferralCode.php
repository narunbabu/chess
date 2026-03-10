<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReferralCode extends Model
{
    protected $fillable = [
        'user_id',
        'code',
        'label',
        'max_uses',
        'used_count',
        'is_active',
        'expires_at',
    ];

    protected $casts = [
        'max_uses' => 'integer',
        'used_count' => 'integer',
        'is_active' => 'boolean',
        'expires_at' => 'datetime',
    ];

    // Relationships

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function earnings()
    {
        return $this->hasMany(ReferralEarning::class);
    }

    public function referredUsers()
    {
        return $this->hasManyThrough(
            User::class,
            ReferralEarning::class,
            'referral_code_id',
            'id',
            'id',
            'referred_user_id'
        );
    }

    // Scopes

    public function scopeActive($query)
    {
        return $query->where('is_active', true)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            });
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    // Helpers

    public function isUsable(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        if ($this->max_uses && $this->used_count >= $this->max_uses) {
            return false;
        }

        return true;
    }

    public function incrementUsage(): void
    {
        $this->increment('used_count');
    }
}
