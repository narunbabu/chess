<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReferralEarning extends Model
{
    protected $fillable = [
        'referral_code_id',
        'referrer_user_id',
        'referred_user_id',
        'subscription_payment_id',
        'payment_amount',
        'commission_rate',
        'earning_amount',
        'currency',
        'status',
        'payout_id',
    ];

    protected $casts = [
        'payment_amount' => 'decimal:2',
        'commission_rate' => 'decimal:4',
        'earning_amount' => 'decimal:2',
    ];

    // Relationships

    public function referralCode()
    {
        return $this->belongsTo(ReferralCode::class);
    }

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }

    public function referredUser()
    {
        return $this->belongsTo(User::class, 'referred_user_id');
    }

    public function subscriptionPayment()
    {
        return $this->belongsTo(SubscriptionPayment::class);
    }

    public function payout()
    {
        return $this->belongsTo(ReferralPayout::class, 'payout_id');
    }

    // Scopes

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopeApproved($query)
    {
        return $query->where('status', 'approved');
    }

    public function scopeUnpaid($query)
    {
        return $query->whereIn('status', ['pending', 'approved']);
    }

    public function scopeForReferrer($query, int $userId)
    {
        return $query->where('referrer_user_id', $userId);
    }
}
