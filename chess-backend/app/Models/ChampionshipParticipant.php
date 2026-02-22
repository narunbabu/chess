<?php

namespace App\Models;

use App\Enums\PaymentStatus as PaymentStatusEnum;
use App\Exceptions\InvalidStateTransitionException;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class ChampionshipParticipant extends Model
{
    use HasFactory;

    /**
     * State machine transition table.
     *
     * Maps each current status to the set of statuses it may legally move to.
     * 'refunded' is a terminal state — no outbound transitions allowed.
     *
     * Valid flows:
     *   pending   → completed  (payment confirmed)
     *   pending   → failed     (payment failed)
     *   completed → refunded   (refund issued)
     *   failed    → pending    (user retries payment)
     */
    public const ALLOWED_TRANSITIONS = [
        'pending'   => ['completed', 'failed'],
        'completed' => ['refunded'],
        'failed'    => ['pending'],
        'refunded'  => [],  // terminal — no further transitions
    ];

    /**
     * Maps each PaymentStatus value to its corresponding registration_status string.
     *
     * registration_status provides a single, human-readable participant state that
     * combines payment information with lifecycle events (cancel) that have no
     * representation in the payment_status state machine.
     */
    public const PAYMENT_TO_REGISTRATION_STATUS = [
        'pending'   => 'payment_pending',
        'completed' => 'registered',
        'failed'    => 'payment_failed',
        'refunded'  => 'refunded',
    ];

    protected $fillable = [
        'championship_id',
        'user_id',
        'active_unique_key',
        'razorpay_order_id',
        'razorpay_payment_id',
        'razorpay_signature',
        'payment_status',     // Virtual attribute (mutator converts to payment_status_id)
        'payment_status_id',  // FK to payment_statuses table
        'registration_status',
        'amount_paid',
        'registered_at',
        'registration_date',  // Alias for registered_at (mutator)
        'is_paid',            // Alias for payment_status_id (mutator)
        'seed_number',
    ];

    protected $casts = [
        'championship_id' => 'integer',
        'user_id'         => 'integer',
        'payment_status_id' => 'integer',
        'amount_paid'     => 'decimal:2',
        'registered_at'   => 'datetime',
        'seed_number'     => 'integer',
    ];

    /**
     * Append accessor attributes to JSON serialization
     */
    protected $appends = [
        'payment_status',
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // Boot — keep active_unique_key in sync with registration_status (C2 fix)
    // ──────────────────────────────────────────────────────────────────────────

    protected static function booted(): void
    {
        static::saving(function (ChampionshipParticipant $participant) {
            $inactive = ['cancelled', 'refunded'];
            $participant->active_unique_key = in_array($participant->registration_status, $inactive)
                ? null
                : $participant->user_id;
        });
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Relationships
    // ──────────────────────────────────────────────────────────────────────────

    public function championship()
    {
        return $this->belongsTo(Championship::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function paymentStatusRelation()
    {
        return $this->belongsTo(PaymentStatus::class, 'payment_status_id');
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Mutators & Accessors
    // ──────────────────────────────────────────────────────────────────────────

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

    /**
     * Mutator: Allow setting 'registration_date' which maps to 'registered_at'
     */
    public function setRegistrationDateAttribute($value)
    {
        $this->attributes['registered_at'] = $value;
    }

    /**
     * Mutator: Allow setting 'is_paid' which maps to payment_status_id
     */
    public function setIsPaidAttribute($value)
    {
        if ($value) {
            $this->attributes['payment_status_id'] = PaymentStatusEnum::COMPLETED->getId();
        } else {
            $this->attributes['payment_status_id'] = PaymentStatusEnum::PENDING->getId();
        }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Scopes
    // ──────────────────────────────────────────────────────────────────────────

    public function scopePaid($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::COMPLETED->getId());
    }

    public function scopePending($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::PENDING->getId());
    }

    public function scopeFailed($query)
    {
        return $query->where('payment_status_id', PaymentStatusEnum::FAILED->getId());
    }

    /**
     * Scope: participants who are still active in the tournament.
     *
     * Excludes 'cancelled' and 'refunded' rows — the two terminal lifecycle
     * states where the participant has definitively left. Use this scope for
     * capacity counts, duplicate-registration guards, and any query that should
     * reflect the current roster (i.e. H2 fix).
     */
    public function scopeActive($query)
    {
        return $query->whereNotIn('registration_status', ['cancelled', 'refunded']);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // State Machine
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Transition to a new payment status, enforcing the state machine rules.
     *
     * Uses SELECT FOR UPDATE inside a DB transaction so that concurrent webhook
     * deliveries or duplicate requests cannot produce inconsistent states.
     *
     * @throws InvalidStateTransitionException when the transition is not allowed.
     */
    public function transitionTo(PaymentStatusEnum $newStatus): void
    {
        DB::transaction(function () use ($newStatus) {
            /** @var static $fresh */
            $fresh = static::lockForUpdate()->findOrFail($this->id);

            $current = $fresh->payment_status;
            $allowed = self::ALLOWED_TRANSITIONS[$current] ?? [];

            if (!in_array($newStatus->value, $allowed, true)) {
                throw new InvalidStateTransitionException($current, $newStatus->value);
            }

            $fresh->update([
                'payment_status'      => $newStatus->value,
                'registration_status' => self::PAYMENT_TO_REGISTRATION_STATUS[$newStatus->value],
            ]);
        });

        $this->refresh();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Helper Methods
    // ──────────────────────────────────────────────────────────────────────────

    public function getPaymentStatusEnum(): PaymentStatusEnum
    {
        return PaymentStatusEnum::from($this->payment_status);
    }

    public function isPaid(): bool
    {
        return $this->getPaymentStatusEnum()->isSuccessful();
    }

    public function isPending(): bool
    {
        return $this->payment_status === 'pending';
    }

    /**
     * Mark payment as completed.
     * Updates Razorpay IDs atomically within the same locked transaction.
     *
     * @throws InvalidStateTransitionException if not in a state that allows completion.
     */
    public function markAsPaid(string $razorpayPaymentId, string $razorpaySignature): void
    {
        DB::transaction(function () use ($razorpayPaymentId, $razorpaySignature) {
            /** @var static $fresh */
            $fresh = static::lockForUpdate()->findOrFail($this->id);

            $current = $fresh->payment_status;
            $allowed = self::ALLOWED_TRANSITIONS[$current] ?? [];

            if (!in_array(PaymentStatusEnum::COMPLETED->value, $allowed, true)) {
                throw new InvalidStateTransitionException($current, PaymentStatusEnum::COMPLETED->value);
            }

            $fresh->update([
                'razorpay_payment_id' => $razorpayPaymentId,
                'razorpay_signature'  => $razorpaySignature,
                'payment_status'      => PaymentStatusEnum::COMPLETED->value,
                'registration_status' => 'registered',
            ]);
        });

        $this->refresh();
    }

    /**
     * Mark payment as failed.
     *
     * @throws InvalidStateTransitionException if not in a state that allows failure.
     */
    public function markAsFailed(): void
    {
        $this->transitionTo(PaymentStatusEnum::FAILED);
    }

    /**
     * Mark payment as refunded.
     *
     * @throws InvalidStateTransitionException if not in a state that allows refund.
     */
    public function markAsRefunded(): void
    {
        $this->transitionTo(PaymentStatusEnum::REFUNDED);
    }

    /**
     * Cancel this registration.
     *
     * Cancellation is a lifecycle event independent of the payment state machine —
     * a participant can cancel regardless of whether payment succeeded, failed, or
     * is pending. The payment_status_id is intentionally left unchanged so that
     * any pending refund logic can still read the payment history.
     *
     * Uses SELECT FOR UPDATE to prevent concurrent double-cancels.
     */
    public function cancel(): void
    {
        DB::transaction(function () {
            /** @var static $fresh */
            $fresh = static::lockForUpdate()->findOrFail($this->id);
            $fresh->update(['registration_status' => 'cancelled']);
        });

        $this->refresh();
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Additional helpers
    // ──────────────────────────────────────────────────────────────────────────

    public function isRegistered(): bool
    {
        return $this->registration_status === 'registered';
    }

    public function isCancelled(): bool
    {
        return $this->registration_status === 'cancelled';
    }
}
