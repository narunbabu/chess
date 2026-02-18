<?php

namespace App\Enums;

enum SubscriptionTier: string
{
    case FREE = 'free';
    case STANDARD = 'standard';
    case PREMIUM = 'premium';

    public function label(): string
    {
        return match($this) {
            self::FREE => 'Free',
            self::STANDARD => 'Standard',
            self::PREMIUM => 'Premium',
        };
    }

    public function level(): int
    {
        return match($this) {
            self::FREE => 0,
            self::STANDARD => 1,
            self::PREMIUM => 2,
        };
    }

    public function isAtLeast(self $tier): bool
    {
        return $this->level() >= $tier->level();
    }

    public function isPaid(): bool
    {
        return $this !== self::FREE;
    }

    public static function fromString(string $value): self
    {
        return self::from(strtolower($value));
    }
}
