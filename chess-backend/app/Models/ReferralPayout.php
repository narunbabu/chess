<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReferralPayout extends Model
{
    protected $fillable = [
        'referrer_user_id',
        'period',
        'total_amount',
        'currency',
        'earnings_count',
        'status',
        'paid_at',
        'paid_by',
        'notes',
    ];

    protected $casts = [
        'total_amount' => 'decimal:2',
        'earnings_count' => 'integer',
        'paid_at' => 'datetime',
    ];

    // Relationships

    public function referrer()
    {
        return $this->belongsTo(User::class, 'referrer_user_id');
    }

    public function earnings()
    {
        return $this->hasMany(ReferralEarning::class, 'payout_id');
    }

    // Scopes

    public function scopePending($query)
    {
        return $query->where('status', 'pending');
    }

    public function scopePaid($query)
    {
        return $query->where('status', 'paid');
    }

    public function scopeForPeriod($query, string $period)
    {
        return $query->where('period', $period);
    }

    // Helpers

    public function markAsPaid(string $adminEmail, ?string $notes = null): void
    {
        $this->update([
            'status' => 'paid',
            'paid_at' => now(),
            'paid_by' => $adminEmail,
            'notes' => $notes,
        ]);

        // Also mark all linked earnings as paid
        $this->earnings()->update(['status' => 'paid']);
    }
}
