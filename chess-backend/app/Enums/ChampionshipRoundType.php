<?php

namespace App\Enums;

enum ChampionshipRoundType: string
{
    case SWISS = 'swiss';
    case ROUND_OF_16 = 'round_of_16';
    case QUARTER_FINAL = 'quarter_final';
    case SEMI_FINAL = 'semi_final';
    case FINAL = 'final';
    case THIRD_PLACE = 'third_place';

    /**
     * Get the database ID for this round type
     */
    public function getId(): int
    {
        return match($this) {
            self::SWISS => 1,
            self::ROUND_OF_16 => 2,
            self::QUARTER_FINAL => 3,
            self::SEMI_FINAL => 4,
            self::FINAL => 5,
            self::THIRD_PLACE => 6,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::SWISS => 'Swiss Round',
            self::ROUND_OF_16 => 'Round of 16',
            self::QUARTER_FINAL => 'Quarter Final',
            self::SEMI_FINAL => 'Semi Final',
            self::FINAL => 'Final',
            self::THIRD_PLACE => 'Third Place',
        };
    }

    /**
     * Check if this is a Swiss round
     */
    public function isSwiss(): bool
    {
        return $this === self::SWISS;
    }

    /**
     * Check if this is an elimination round
     */
    public function isElimination(): bool
    {
        return !$this->isSwiss();
    }

    /**
     * Get the expected number of matches for this round type
     */
    public function expectedMatches(): ?int
    {
        return match($this) {
            self::SWISS => null, // Depends on number of participants
            self::ROUND_OF_16 => 8,
            self::QUARTER_FINAL => 4,
            self::SEMI_FINAL => 2,
            self::FINAL => 1,
            self::THIRD_PLACE => 1,
        };
    }
}
