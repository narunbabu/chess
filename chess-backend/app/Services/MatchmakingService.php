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
    public function joinQueue(User $user): MatchmakingEntry
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

            // Create a multiplayer game
            $game = $this->createMultiplayerGame($lockedEntry->user_id, $opponent->user_id);

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

        // Random color assignment
        $isUserWhite = rand(0, 1) === 1;

        $game = Game::create([
            'white_player_id' => $isUserWhite ? $user->id : null,
            'black_player_id' => $isUserWhite ? null : $user->id,
            'computer_player_id' => $computerPlayer->id,
            'computer_level' => $bot->computer_level,
            'player_color' => $isUserWhite ? 'white' : 'black',
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
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
    private function createMultiplayerGame(int $userId1, int $userId2): Game
    {
        $isUser1White = rand(0, 1) === 1;

        return Game::create([
            'white_player_id' => $isUser1White ? $userId1 : $userId2,
            'black_player_id' => $isUser1White ? $userId2 : $userId1,
            'status' => 'active',
            'result' => 'ongoing',
            'turn' => 'white',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
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
