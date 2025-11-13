<?php

namespace App\Enums;

enum ChampionshipMatchStatus: string
{
    case PENDING = 'pending';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';

    /**
     * Get the database ID for this status
     */
    public function getId(): int
    {
        return match($this) {
            self::PENDING => 1,
            self::IN_PROGRESS => 2,
            self::COMPLETED => 3,
            self::CANCELLED => 4,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::PENDING => 'Pending',
            self::IN_PROGRESS => 'In Progress',
            self::COMPLETED => 'Completed',
            self::CANCELLED => 'Cancelled',
        };
    }

    /**
     * Check if match is finished
     */
    public function isFinished(): bool
    {
        return in_array($this, [self::COMPLETED, self::CANCELLED]);
    }

    /**
     * Check if match can be played
     */
    public function canPlay(): bool
    {
        return in_array($this, [self::PENDING, self::IN_PROGRESS]);
    }
}
