<?php

namespace App\Services;

use App\Models\ComputerPlayer;
use App\Models\Game;
use App\Models\MatchmakingEntry;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class MatchmakingService
{
    /**
     * Add a user to the matchmaking queue.
     */
    public function joinQueue(User $user, array $preferences = []): MatchmakingEntry
    {
        // Cancel any existing searching entries for this user
        MatchmakingEntry::where('user_id', $user->id)
            ->where('status', 'searching')
            ->update(['status' => 'cancelled']);

        $now = now();

        return MatchmakingEntry::create([
            'user_id' => $user->id,
            'rating' => $user->rating ?? 1200,
            'rating_range' => 200,
            'status' => 'searching',
            'queued_at' => $now,
            'expires_at' => $now->copy()->addSeconds(20),
            'preferred_color' => $preferences['preferred_color'] ?? 'random',
            'time_control_minutes' => $preferences['time_control_minutes'] ?? 10,
            'increment_seconds' => $preferences['increment_seconds'] ?? 0,
        ]);
    }

    /**
     * Check the status of a matchmaking entry and try to find a match.
     */
    public function checkStatus(MatchmakingEntry $entry): MatchmakingEntry
    {
        // Already matched or cancelled — return as-is
        if ($entry->status !== 'searching') {
            return $entry->load(['matchedUser', 'matchedSynthetic', 'game']);
        }

        // Try to find a human opponent first
        $humanMatch = $this->findHumanMatch($entry);
        if ($humanMatch) {
            return $entry->fresh()->load(['matchedUser', 'game']);
        }

        // If expired, match with a synthetic player
        if ($entry->isExpired()) {
            return $this->matchWithSynthetic($entry);
        }

        return $entry;
    }

    /**
     * Try to find a human opponent in the queue.
     *
     * Uses DB transaction with locking to prevent race conditions.
     */
    private function findHumanMatch(MatchmakingEntry $entry): ?MatchmakingEntry
    {
        return DB::transaction(function () use ($entry) {
            // Re-fetch with lock to prevent race conditions
            $lockedEntry = MatchmakingEntry::where('id', $entry->id)
                ->where('status', 'searching')
                ->lockForUpdate()
                ->first();

            if (!$lockedEntry) {
                return null; // Entry was already matched by another request
            }

            // Find another searching player within rating range
            $opponent = MatchmakingEntry::where('status', 'searching')
                ->where('user_id', '!=', $lockedEntry->user_id)
                ->whereBetween('rating', [
                    $lockedEntry->rating - $lockedEntry->rating_range,
                    $lockedEntry->rating + $lockedEntry->rating_range,
                ])
                ->orderBy('queued_at')
                ->lockForUpdate()
                ->first();

            if (!$opponent) {
                return null;
            }

            // Create a multiplayer game with color and time preferences
            $game = $this->createMultiplayerGame(
                $lockedEntry->user_id,
                $opponent->user_id,
                $lockedEntry->preferred_color ?? 'random',
                $opponent->preferred_color ?? 'random',
                $lockedEntry->time_control_minutes ?? 10,
                $lockedEntry->increment_seconds ?? 0
            );

            $matchedAt = now();

            // Update both entries
            $lockedEntry->update([
                'status' => 'matched',
                'matched_with_user_id' => $opponent->user_id,
                'game_id' => $game->id,
                'matched_at' => $matchedAt,
            ]);

            $opponent->update([
                'status' => 'matched',
                'matched_with_user_id' => $lockedEntry->user_id,
                'game_id' => $game->id,
                'matched_at' => $matchedAt,
            ]);

            return $opponent;
        });
    }

    /**
     * Match with a synthetic player when the queue expires.
     */
    private function matchWithSynthetic(MatchmakingEntry $entry): MatchmakingEntry
    {
        $bot = SyntheticPlayer::findClosestToRating($entry->rating);

        if (!$bot) {
            // No bots available — mark expired
            $entry->update(['status' => 'expired']);
            return $entry;
        }

        // Create a computer game using the bot's level
        $user = $entry->user;
        $computerPlayer = $bot->getComputerPlayer();

        // Color assignment from user preference
        $colorPref = $entry->preferred_color ?? 'random';
        if ($colorPref === 'random') {
            $isUserWhite = rand(0, 1) === 1;
        } else {
            $isUserWhite = $colorPref === 'white';
        }

        $game = Game::create([
            'white_player_id' => $isUserWhite ? $user->id : null,
            'black_player_id' => $isUserWhite ? null : $user->id,
            'computer_player_id' => $computerPlayer->id,
            'computer_level' => $bot->computer_level,
            'synthetic_player_id' => $bot->id,
            'player_color' => $isUserWhite ? 'white' : 'black',
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
            'time_control_minutes' => $entry->time_control_minutes ?? 10,
            'increment_seconds' => $entry->increment_seconds ?? 0,
        ]);

        $entry->update([
            'status' => 'matched',
            'matched_with_synthetic_id' => $bot->id,
            'game_id' => $game->id,
            'matched_at' => now(),
        ]);

        // Increment bot's cosmetic game count
        $bot->increment('games_played_count');

        return $entry->fresh()->load(['matchedSynthetic', 'game']);
    }

    /**
     * Create a multiplayer game between two users.
     */
    private function createMultiplayerGame(
        int $userId1,
        int $userId2,
        string $color1 = 'random',
        string $color2 = 'random',
        int $timeControl = 10,
        int $increment = 0
    ): Game {
        // Resolve colors: honor explicit preferences, randomize otherwise
        if ($color1 === 'white' || $color2 === 'black') {
            $whiteId = $userId1;
            $blackId = $userId2;
        } elseif ($color1 === 'black' || $color2 === 'white') {
            $whiteId = $userId2;
            $blackId = $userId1;
        } else {
            $isUser1White = rand(0, 1) === 1;
            $whiteId = $isUser1White ? $userId1 : $userId2;
            $blackId = $isUser1White ? $userId2 : $userId1;
        }

        return Game::create([
            'white_player_id' => $whiteId,
            'black_player_id' => $blackId,
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
            'time_control_minutes' => $timeControl,
            'increment_seconds' => $increment,
        ]);
    }

    /**
     * Cancel a matchmaking entry.
     */
    public function cancelQueue(MatchmakingEntry $entry): MatchmakingEntry
    {
        if ($entry->status === 'searching') {
            $entry->update(['status' => 'cancelled']);
        }

        return $entry;
    }
}
