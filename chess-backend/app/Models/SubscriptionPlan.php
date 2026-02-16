<?php

namespace App\Models;

use App\Enums\SubscriptionTier;
use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'tier',
        'name',
        'interval',
        'price',
        'currency',
        'razorpay_plan_id',
        'undo_limit',
        'ad_free',
        'priority_matchmaking',
        'can_create_tournaments',
        'advanced_analytics',
        'synthetic_opponents',
        'features',
        'is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'undo_limit' => 'integer',
        'ad_free' => 'boolean',
        'priority_matchmaking' => 'boolean',
        'can_create_tournaments' => 'boolean',
        'advanced_analytics' => 'boolean',
        'synthetic_opponents' => 'boolean',
        'features' => 'array',
        'is_active' => 'boolean',
    ];

    // Scopes

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByTier($query, string $tier)
    {
        return $query->where('tier', $tier);
    }

    public function scopePaid($query)
    {
        return $query->where('tier', '!=', 'free');
    }

    // Helpers

    public function getTierEnum(): SubscriptionTier
    {
        return SubscriptionTier::from($this->tier);
    }

    public function isFree(): bool
    {
        return $this->tier === 'free';
    }

    public function hasUnlimitedUndos(): bool
    {
        return $this->undo_limit === null;
    }

    public function getFormattedPrice(): string
    {
        if ($this->isFree()) {
            return 'Free';
        }

        return '₹' . number_format($this->price);
    }

    public function getIntervalLabel(): string
    {
        return match($this->interval) {
            'monthly' => '/month',
            'yearly' => '/year',
            'lifetime' => '',
            default => '',
        };
    }

    // Relationships

    public function payments()
    {
        return $this->hasMany(SubscriptionPayment::class);
    }
}
