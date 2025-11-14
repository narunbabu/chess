<?php

namespace App\Enums;

enum ChampionshipStatus: string
{
    case UPCOMING = 'upcoming';
    case REGISTRATION_OPEN = 'registration_open';
    case IN_PROGRESS = 'in_progress';
    case COMPLETED = 'completed';
    case CANCELLED = 'cancelled';

    /**
     * Get the database ID for this status
     */
    public function getId(): int
    {
        return match($this) {
            self::UPCOMING => 1,
            self::REGISTRATION_OPEN => 2,
            self::IN_PROGRESS => 3,
            self::COMPLETED => 4,
            self::CANCELLED => 5,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::UPCOMING => 'Upcoming',
            self::REGISTRATION_OPEN => 'Registration Open',
            self::IN_PROGRESS => 'In Progress',
            self::COMPLETED => 'Completed',
            self::CANCELLED => 'Cancelled',
        };
    }

    /**
     * Check if registration is allowed
     */
    public function canRegister(): bool
    {
        return $this === self::REGISTRATION_OPEN;
    }

    /**
     * Check if championship is active
     */
    public function isActive(): bool
    {
        return $this === self::IN_PROGRESS;
    }

    /**
     * Check if championship is terminal (ended)
     */
    public function isTerminal(): bool
    {
        return in_array($this, [self::COMPLETED, self::CANCELLED]);
    }

    /**
     * Check if championship is finished (alias for isTerminal)
     */
    public function isFinished(): bool
    {
        return $this->isTerminal();
    }

    /**
     * Check if championship is upcoming
     */
    public function isUpcoming(): bool
    {
        return $this === self::UPCOMING;
    }

    /**
     * Check if registration is currently open
     */
    public function isRegistrationOpen(): bool
    {
        return $this === self::REGISTRATION_OPEN;
    }
}
