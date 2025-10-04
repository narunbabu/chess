<?php

namespace App\Enums;

enum EndReason: string
{
    case CHECKMATE = 'checkmate';
    case RESIGNATION = 'resignation';
    case STALEMATE = 'stalemate';
    case TIMEOUT = 'timeout';
    case DRAW_AGREED = 'draw_agreed';
    case THREEFOLD = 'threefold';
    case FIFTY_MOVE = 'fifty_move';
    case INSUFFICIENT_MATERIAL = 'insufficient_material';
    case ABORTED = 'aborted';
    case FORFEIT = 'forfeit';
    case ABANDONED_MUTUAL = 'abandoned_mutual';
    case TIMEOUT_INACTIVITY = 'timeout_inactivity';

    /**
     * Map legacy end reason values to canonical values
     * Provides backward compatibility during transition period
     */
    public static function fromLegacy(?string $value): ?self
    {
        if ($value === null) {
            return null;
        }

        return match($value) {
            'killed' => self::ABORTED,
            default => self::from($value),
        };
    }

    /**
     * Get the database ID for this end reason
     */
    public function getId(): int
    {
        return match($this) {
            self::CHECKMATE => 1,
            self::RESIGNATION => 2,
            self::STALEMATE => 3,
            self::TIMEOUT => 4,
            self::DRAW_AGREED => 5,
            self::THREEFOLD => 6,
            self::FIFTY_MOVE => 7,
            self::INSUFFICIENT_MATERIAL => 8,
            self::ABORTED => 9,
            self::FORFEIT => 10,
            self::ABANDONED_MUTUAL => 11,
            self::TIMEOUT_INACTIVITY => 12,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::CHECKMATE => 'Checkmate',
            self::RESIGNATION => 'Resignation',
            self::STALEMATE => 'Stalemate',
            self::TIMEOUT => 'Timeout',
            self::DRAW_AGREED => 'Draw by agreement',
            self::THREEFOLD => 'Threefold repetition',
            self::FIFTY_MOVE => 'Fifty-move rule',
            self::INSUFFICIENT_MATERIAL => 'Insufficient material',
            self::ABORTED => 'Game aborted',
            self::FORFEIT => 'Forfeit',
            self::ABANDONED_MUTUAL => 'Abandoned by agreement',
            self::TIMEOUT_INACTIVITY => 'Timeout (inactivity)',
        };
    }

    /**
     * Check if this reason results in a draw
     */
    public function isDraw(): bool
    {
        return in_array($this, [
            self::STALEMATE,
            self::DRAW_AGREED,
            self::THREEFOLD,
            self::FIFTY_MOVE,
            self::INSUFFICIENT_MATERIAL,
        ]);
    }

    /**
     * Check if this reason results in a decisive outcome
     */
    public function isDecisive(): bool
    {
        return in_array($this, [
            self::CHECKMATE,
            self::RESIGNATION,
            self::TIMEOUT,
            self::FORFEIT,
            self::TIMEOUT_INACTIVITY,
        ]);
    }
}
