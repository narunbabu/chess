<?php

namespace App\Services;

use App\Models\ChampionshipMatch;
use App\Models\User;

/**
 * Service to handle player ID logic and eliminate dual field confusion
 *
 * This service provides a single source of truth for player identification
 * in championship matches, eliminating the confusion between legacy
 * player1_id/player2_id and new white_player_id/black_player_id fields.
 */
class ChampionshipMatchPlayerService
{
    /**
     * Get the white player ID from a match (single source of truth)
     */
    public static function getWhitePlayerId(ChampionshipMatch $match): ?int
    {
        return $match->white_player_id ?? $match->player1_id;
    }

    /**
     * Get the black player ID from a match (single source of truth)
     */
    public static function getBlackPlayerId(ChampionshipMatch $match): ?int
    {
        return $match->black_player_id ?? $match->player2_id;
    }

    /**
     * Get all player IDs from a match (both colors)
     */
    public static function getAllPlayerIds(ChampionshipMatch $match): array
    {
        $white = self::getWhitePlayerId($match);
        $black = self::getBlackPlayerId($match);

        return array_filter([$white, $black]);
    }

    /**
     * Check if a user is a player in this match
     */
    public static function isPlayerInMatch(ChampionshipMatch $match, int $userId): bool
    {
        return in_array($userId, self::getAllPlayerIds($match));
    }

    /**
     * Get the opponent for a given player
     */
    public static function getOpponent(ChampionshipMatch $match, int $userId): ?User
    {
        if (self::getWhitePlayerId($match) === $userId) {
            return $match->blackPlayer;
        }

        if (self::getBlackPlayerId($match) === $userId) {
            return $match->whitePlayer;
        }

        return null;
    }

    /**
     * Get the color for a player in this match
     */
    public static function getPlayerColor(ChampionshipMatch $match, int $userId): ?string
    {
        if (self::getWhitePlayerId($match) === $userId) {
            return 'white';
        }

        if (self::getBlackPlayerId($match) === $userId) {
            return 'black';
        }

        return null;
    }

    /**
     * Assign players to match with colors (updates all fields for consistency)
     */
    public static function assignPlayers(ChampionshipMatch $match, int $whitePlayerId, int $blackPlayerId): void
    {
        $match->update([
            // Primary color-aware fields
            'white_player_id' => $whitePlayerId,
            'black_player_id' => $blackPlayerId,

            // Legacy fields for backward compatibility
            'player1_id' => $whitePlayerId,
            'player2_id' => $blackPlayerId,
        ]);
    }

    /**
     * Update a match to use only color-aware fields
     *
     * This method ensures data consistency between legacy and new fields
     */
    public static function syncLegacyFields(ChampionshipMatch $match): void
    {
        $whitePlayerId = self::getWhitePlayerId($match);
        $blackPlayerId = self::getBlackPlayerId($match);

        if ($whitePlayerId && $blackPlayerId) {
            $match->update([
                'player1_id' => $whitePlayerId,
                'player2_id' => $blackPlayerId,
            ]);
        }
    }

    /**
     * Check if a match has complete player assignments
     */
    public static function hasCompletePlayers(ChampionshipMatch $match): bool
    {
        $white = self::getWhitePlayerId($match);
        $black = self::getBlackPlayerId($match);

        return !is_null($white) && !is_null($black);
    }

    /**
     * Build query for matches where user is a player
     */
    public static function wherePlayer($query, int $userId)
    {
        return $query->where(function ($q) use ($userId) {
            // Check color-aware fields first
            $q->where('white_player_id', $userId)
              ->orWhere('black_player_id', $userId)
              // Include legacy fields for backward compatibility
              ->orWhere('player1_id', $userId)
              ->orWhere('player2_id', $userId);
        });
    }

    /**
     * Get participant user relationships (prefers color-aware relationships)
     */
    public static function getParticipants(ChampionshipMatch $match): array
    {
        $participants = [];

        // Get white player
        $whiteId = self::getWhitePlayerId($match);
        if ($whiteId) {
            $participants['white'] = $match->whitePlayer ?? $match->player1;
        }

        // Get black player
        $blackId = self::getBlackPlayerId($match);
        if ($blackId) {
            $participants['black'] = $match->blackPlayer ?? $match->player2;
        }

        return $participants;
    }

    /**
     * Validate match data consistency
     */
    public static function validateConsistency(ChampionshipMatch $match): array
    {
        $issues = [];

        $white = $match->white_player_id;
        $black = $match->black_player_id;
        $player1 = $match->player1_id;
        $player2 = $match->player2_id;

        // Check if color and legacy fields don't match
        if ($white && $player1 && $white !== $player1) {
            $issues[] = "white_player_id ({$white}) doesn't match player1_id ({$player1})";
        }

        if ($black && $player2 && $black !== $player2) {
            $issues[] = "black_player_id ({$black}) doesn't match player2_id ({$player2})";
        }

        // Check for same player assigned to both colors
        if ($white && $black && $white === $black) {
            $issues[] = "Same player ({$white}) assigned to both white and black";
        }

        // Check for duplicates across all fields
        $allIds = array_filter([$white, $black, $player1, $player2]);
        if (count($allIds) !== count(array_unique($allIds))) {
            $issues[] = "Duplicate player IDs found across player fields";
        }

        return $issues;
    }
}