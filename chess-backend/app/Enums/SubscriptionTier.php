<?php

namespace App\Enums;

enum SubscriptionTier: string
{
    case FREE = 'free';
    case PREMIUM = 'premium';
    case PRO = 'pro';

    public function label(): string
    {
        return match($this) {
            self::FREE => 'Free',
            self::PREMIUM => 'Premium',
            self::PRO => 'Pro',
        };
    }

    public function level(): int
    {
        return match($this) {
            self::FREE => 0,
            self::PREMIUM => 1,
            self::PRO => 2,
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
