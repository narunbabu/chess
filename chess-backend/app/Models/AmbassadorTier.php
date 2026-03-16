<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AmbassadorTier extends Model
{
    protected $fillable = [
        'name',
        'min_paid_referrals',
        'commission_rate',
        'sort_order',
    ];

    protected $casts = [
        'min_paid_referrals' => 'integer',
        'commission_rate' => 'float',
        'sort_order' => 'integer',
    ];

    /**
     * Get the tier for a given number of paid referrals.
     * Returns the highest tier whose threshold the user has met.
     */
    public static function getTierForCount(int $paidReferrals): ?self
    {
        return static::where('min_paid_referrals', '<=', $paidReferrals)
            ->orderByDesc('min_paid_referrals')
            ->first();
    }

    /**
     * Get the next tier above the given count, or null if already at max.
     */
    public static function getNextTier(int $paidReferrals): ?self
    {
        return static::where('min_paid_referrals', '>', $paidReferrals)
            ->orderBy('min_paid_referrals')
            ->first();
    }

    /**
     * Get all tiers ordered by threshold.
     */
    public static function allOrdered()
    {
        return static::orderBy('sort_order')->get();
    }
}
