<?php

namespace App\Models;

use App\Enums\PaymentStatus as PaymentStatusEnum;
use Illuminate\Database\Eloquent\Model;

class SubscriptionPayment extends Model
{
    protected $fillable = [
        'user_id',
        'subscription_plan_id',
        'razorpay_subscription_id',
        'razorpay_payment_id',
        'razorpay_order_id',
        'razorpay_signature',
        'payment_status',
        'payment_status_id',
        'amount',
        'currency',
        'interval',
        'paid_at',
        'period_start',
        'period_end',
    ];

    protected $casts = [
        'user_id' => 'integer',
        'subscription_plan_id' => 'integer',
        'payment_status_id' => 'integer',
        'amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'period_start' => 'datetime',
        'period_end' => 'datetime',
    ];

    protected $appends = [
        'payment_status',
    ];

    // Relationships

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function plan()
    {
        return $this->belongsTo(SubscriptionPlan::class, 'subscription_plan_id');
    }

    public function paymentStatusRelation()
    {
        return $this->belongsTo(PaymentStatus::class, 'payment_status_id');
    }

    // Mutators & Accessors (follows ChampionshipParticipant pattern)

    public function setPaymentStatusAttribute($value)
    {
        if ($value instanceof PaymentStatusEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['payment_status_id'] = PaymentStatus::getIdByCode($code);
    }

    public function getPaymentStatusAttribute(): string
    {
        if (isset($this->attributes['payment_status_id'])) {
            return $this->paymentStatusRelation?->code ??
                   PaymentStatus::find($this->attributes['payment_status_id'])?->code ??
                   'pending';
        }

        return 'pending';
    }

    // Scopes

    public function scopeCompleted($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::COMPLETED->getId());
    }

    public function scopeForUser($query, int $userId)
    {
        return $query->where('user_id', $userId);
    }

    // Helpers

    public function isPaid(): bool
    {
        return $this->payment_status === 'completed';
    }

    public function markAsPaid(): void
    {
        $this->update([
            'payment_status' => PaymentStatusEnum::COMPLETED->value,
            'paid_at' => now(),
        ]);
    }
}
