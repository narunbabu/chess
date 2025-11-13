<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Enums\PaymentStatus as PaymentStatusEnum;

class ChampionshipParticipant extends Model
{
    use HasFactory;

    protected $fillable = [
        'championship_id',
        'user_id',
        'razorpay_order_id',
        'razorpay_payment_id',
        'razorpay_signature',
        'payment_status',    // Virtual attribute (mutator converts to payment_status_id)
        'payment_status_id', // FK to payment_statuses table
        'amount_paid',
        'registered_at',
        'seed_number',
    ];

    protected $casts = [
        'championship_id' => 'integer',
        'user_id' => 'integer',
        'payment_status_id' => 'integer',
        'amount_paid' => 'decimal:2',
        'registered_at' => 'datetime',
        'seed_number' => 'integer',
    ];

    /**
     * Append accessor attributes to JSON serialization
     */
    protected $appends = [
        'payment_status',
    ];

    // Relationships

    /**
     * The championship this participant is in
     */
    public function championship()
    {
        return $this->belongsTo(Championship::class);
    }

    /**
     * The user participating
     */
    public function user()
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Relationship to PaymentStatus lookup table
     */
    public function paymentStatusRelation()
    {
        return $this->belongsTo(PaymentStatus::class, 'payment_status_id');
    }

    // Mutators & Accessors

    /**
     * Mutator: Convert payment status string/enum to payment_status_id FK
     */
    public function setPaymentStatusAttribute($value)
    {
        if ($value instanceof PaymentStatusEnum) {
            $code = $value->value;
        } else {
            $code = $value;
        }

        $this->attributes['payment_status_id'] = PaymentStatus::getIdByCode($code);
    }

    /**
     * Accessor: Read payment status code from relationship
     */
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

    /**
     * Scope: Paid participants
     */
    public function scopePaid($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::COMPLETED->getId());
    }

    /**
     * Scope: Pending payment participants
     */
    public function scopePending($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::PENDING->getId());
    }

    /**
     * Scope: Failed payment participants
     */
    public function scopeFailed($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::FAILED->getId());
    }

    // Helper Methods

    /**
     * Get payment status as enum
     */
    public function getPaymentStatusEnum(): PaymentStatusEnum
    {
        return PaymentStatusEnum::from($this->payment_status);
    }

    /**
     * Check if payment is completed
     */
    public function isPaid(): bool
    {
        return $this->getPaymentStatusEnum()->isSuccessful();
    }

    /**
     * Check if payment is pending
     */
    public function isPending(): bool
    {
        return $this->payment_status === 'pending';
    }

    /**
     * Mark payment as completed
     */
    public function markAsPaid(string $razorpayPaymentId, string $razorpaySignature): void
    {
        $this->update([
            'razorpay_payment_id' => $razorpayPaymentId,
            'razorpay_signature' => $razorpaySignature,
            'payment_status' => PaymentStatusEnum::COMPLETED->value,
        ]);
    }

    /**
     * Mark payment as failed
     */
    public function markAsFailed(): void
    {
        $this->update([
            'payment_status' => PaymentStatusEnum::FAILED->value,
        ]);
    }

    /**
     * Mark payment as refunded
     */
    public function markAsRefunded(): void
    {
        $this->update([
            'payment_status' => PaymentStatusEnum::REFUNDED->value,
        ]);
    }
}
