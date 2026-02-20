<?php

namespace App\Enums;

enum SubscriptionTier: string
{
    case FREE   = 'free';
    case SILVER = 'silver';
    case GOLD   = 'gold';

    public function label(): string
    {
        return match($this) {
            self::FREE   => 'Free',
            self::SILVER => 'Silver',
            self::GOLD   => 'Gold',
        };
    }

    public function level(): int
    {
        return match($this) {
            self::FREE   => 0,
            self::SILVER => 1,
            self::GOLD   => 2,
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
