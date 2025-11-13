<?php

namespace App\Enums;

enum PaymentStatus: string
{
    case PENDING = 'pending';
    case COMPLETED = 'completed';
    case FAILED = 'failed';
    case REFUNDED = 'refunded';

    /**
     * Get the database ID for this status
     */
    public function getId(): int
    {
        return match($this) {
            self::PENDING => 1,
            self::COMPLETED => 2,
            self::FAILED => 3,
            self::REFUNDED => 4,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::PENDING => 'Pending',
            self::COMPLETED => 'Completed',
            self::FAILED => 'Failed',
            self::REFUNDED => 'Refunded',
        };
    }

    /**
     * Check if payment was successful
     */
    public function isSuccessful(): bool
    {
        return $this === self::COMPLETED;
    }

    /**
     * Check if payment failed or is pending
     */
    public function isNotCompleted(): bool
    {
        return !$this->isSuccessful();
    }
}
