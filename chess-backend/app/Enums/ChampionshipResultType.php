<?php

namespace App\Enums;

enum ChampionshipResultType: string
{
    case COMPLETED = 'completed';
    case FORFEIT_PLAYER1 = 'forfeit_player1';
    case FORFEIT_PLAYER2 = 'forfeit_player2';
    case DOUBLE_FORFEIT = 'double_forfeit';
    case DRAW = 'draw';

    /**
     * Get the database ID for this result type
     */
    public function getId(): int
    {
        return match($this) {
            self::COMPLETED => 1,
            self::FORFEIT_PLAYER1 => 2,
            self::FORFEIT_PLAYER2 => 3,
            self::DOUBLE_FORFEIT => 4,
            self::DRAW => 5,
        };
    }

    /**
     * Get human-readable label
     */
    public function label(): string
    {
        return match($this) {
            self::COMPLETED => 'Completed Normally',
            self::FORFEIT_PLAYER1 => 'Player 1 Forfeit',
            self::FORFEIT_PLAYER2 => 'Player 2 Forfeit',
            self::DOUBLE_FORFEIT => 'Double Forfeit',
            self::DRAW => 'Draw',
        };
    }

    /**
     * Check if match ended in a forfeit
     */
    public function isForfeit(): bool
    {
        return in_array($this, [
            self::FORFEIT_PLAYER1,
            self::FORFEIT_PLAYER2,
            self::DOUBLE_FORFEIT
        ]);
    }

    /**
     * Check if match was completed normally
     */
    public function isNormal(): bool
    {
        return $this === self::COMPLETED;
    }

    /**
     * Get points for player 1 based on result type
     */
    public function getPlayer1Points(): float
    {
        return match($this) {
            self::COMPLETED => throw new \LogicException('Cannot determine points without winner_id'),
            self::FORFEIT_PLAYER1 => 0.0,
            self::FORFEIT_PLAYER2 => 1.0,
            self::DOUBLE_FORFEIT => 0.0,
            self::DRAW => 0.5,
        };
    }

    /**
     * Get points for player 2 based on result type
     */
    public function getPlayer2Points(): float
    {
        return match($this) {
            self::COMPLETED => throw new \LogicException('Cannot determine points without winner_id'),
            self::FORFEIT_PLAYER1 => 1.0,
            self::FORFEIT_PLAYER2 => 0.0,
            self::DOUBLE_FORFEIT => 0.0,
            self::DRAW => 0.5,
        };
    }
}
