<?php

namespace App\Enums;

enum ChampionshipFormat: string
{
    case SWISS_ELIMINATION = 'swiss_elimination';
    case SWISS_ONLY = 'swiss_only';
    case ELIMINATION_ONLY = 'elimination_only';

    /**
     * Get the database ID for this format
     */
    public function getId(): int
    {
        return match($this) {
            self::SWISS_ELIMINATION => 1,
            self::SWISS_ONLY => 2,
            self::ELIMINATION_ONLY => 3,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::SWISS_ELIMINATION => 'Swiss + Elimination',
            self::SWISS_ONLY => 'Swiss Only',
            self::ELIMINATION_ONLY => 'Single Elimination',
        };
    }

    /**
     * Check if format includes Swiss system
     */
    public function hasSwiss(): bool
    {
        return in_array($this, [self::SWISS_ELIMINATION, self::SWISS_ONLY]);
    }

    /**
     * Alias for hasSwiss() - check if this is a Swiss-based format
     */
    public function isSwiss(): bool
    {
        return $this->hasSwiss();
    }

    /**
     * Check if format includes elimination bracket
     */
    public function hasElimination(): bool
    {
        return in_array($this, [self::SWISS_ELIMINATION, self::ELIMINATION_ONLY]);
    }

    /**
     * Check if format is hybrid (Swiss + Elimination)
     */
    public function isHybrid(): bool
    {
        return $this === self::SWISS_ELIMINATION;
    }
}
