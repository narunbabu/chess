<?php

namespace App\Enums;

enum GameStatus: string
{
    case WAITING = 'waiting';
    case ACTIVE = 'active';
    case FINISHED = 'finished';
    case ABORTED = 'aborted';
    case PAUSED = 'paused';

    /**
     * Map legacy status values to canonical values
     * Provides backward compatibility during transition period
     */
    public static function fromLegacy(string $value): self
    {
        return match($value) {
            'completed' => self::FINISHED,
            'abandoned' => self::ABORTED,  // Kill game feature uses 'abandoned'
            'killed' => self::ABORTED,      // Legacy end_reason value
            default => self::from($value),
        };
    }

    /**
     * Get the database ID for this status
     */
    public function getId(): int
    {
        return match($this) {
            self::WAITING => 1,
            self::ACTIVE => 2,
            self::FINISHED => 3,
            self::ABORTED => 4,
            self::PAUSED => 5,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::WAITING => 'Waiting for opponent',
            self::ACTIVE => 'In progress',
            self::FINISHED => 'Finished',
            self::ABORTED => 'Aborted',
            self::PAUSED => 'Paused',
        };
    }

    /**
     * Check if this is a terminal status (game ended)
     */
    public function isTerminal(): bool
    {
        return in_array($this, [self::FINISHED, self::ABORTED]);
    }
}
