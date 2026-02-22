<?php

namespace App\Services;

use App\Events\MatchRequestAccepted;
use App\Events\MatchRequestCancelled;
use App\Events\MatchRequestDeclined;
use App\Events\MatchRequestReceived;
use App\Models\ComputerPlayer;
use App\Models\Game;
use App\Models\MatchmakingEntry;
use App\Models\MatchRequest;
use App\Models\MatchRequestTarget;
use App\Models\SyntheticPlayer;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

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
            'expires_at' => $now->copy()->addSeconds(15),
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
            'game_mode' => 'casual', // AI games never affect leaderboard
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
    public function createMultiplayerGame(
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

    // ─── Smart Real-User Matchmaking ────────────────────────────────────────

    /**
     * Find online players and broadcast match requests to them.
     */
    public function findAndBroadcastPlayers(User $user, array $prefs): MatchRequest
    {
        // Cancel any existing searching match requests for this user
        MatchRequest::where('requester_id', $user->id)
            ->where('status', 'searching')
            ->update(['status' => 'cancelled']);

        $token = Str::random(32);
        $expiresAt = now()->addSeconds(15);

        $matchRequest = MatchRequest::create([
            'token' => $token,
            'requester_id' => $user->id,
            'status' => 'searching',
            'preferred_color' => $prefs['preferred_color'] ?? 'random',
            'time_control_minutes' => $prefs['time_control_minutes'] ?? 10,
            'increment_seconds' => $prefs['increment_seconds'] ?? 0,
            'expires_at' => $expiresAt,
        ]);

        $userRating = $user->rating ?? 1200;

        // IDs of users currently in an active game
        $inActiveGame = Game::where('status', 'active')
            ->selectRaw('white_player_id as uid')
            ->whereNotNull('white_player_id')
            ->union(
                Game::where('status', 'active')
                    ->selectRaw('black_player_id as uid')
                    ->whereNotNull('black_player_id')
            );
        $busyUserIds = DB::table(DB::raw("({$inActiveGame->toSql()}) as active_players"))
            ->mergeBindings($inActiveGame->getQuery())
            ->pluck('uid')
            ->toArray();

        // Find suitable online players: active within 2 min, within rating range, not in active game
        $candidates = User::where('id', '!=', $user->id)
            ->where('last_activity_at', '>=', now()->subMinutes(2))
            ->whereBetween('rating', [$userRating - 200, $userRating + 200])
            ->whereNotIn('id', $busyUserIds)
            ->inRandomOrder()
            ->limit(3)
            ->get();

        // If fewer than 3 candidates with ±200, expand to ±400
        if ($candidates->count() < 3) {
            $existingIds = $candidates->pluck('id')->toArray();

            $extraCandidates = User::where('id', '!=', $user->id)
                ->whereNotIn('id', array_merge($existingIds, $busyUserIds))
                ->where('last_activity_at', '>=', now()->subMinutes(2))
                ->whereBetween('rating', [$userRating - 400, $userRating + 400])
                ->inRandomOrder()
                ->limit(3 - $candidates->count())
                ->get();

            $candidates = $candidates->merge($extraCandidates);
        }

        // Create target rows and broadcast to each
        foreach ($candidates as $candidate) {
            MatchRequestTarget::create([
                'match_request_id' => $matchRequest->id,
                'target_user_id' => $candidate->id,
                'status' => 'pending',
            ]);

            broadcast(new MatchRequestReceived($matchRequest, $candidate->id));
        }

        // If no targets found, immediately expire
        if ($candidates->isEmpty()) {
            $matchRequest->update(['status' => 'expired']);
        }

        return $matchRequest->load('targets');
    }

    /**
     * Accept a match request — create game, notify requester, dismiss other targets.
     */
    public function acceptMatchRequest(string $token, User $acceptor): array
    {
        return DB::transaction(function () use ($token, $acceptor) {
            $matchRequest = MatchRequest::where('token', $token)
                ->lockForUpdate()
                ->firstOrFail();

            // Validate state
            if ($matchRequest->status !== 'searching') {
                throw new \RuntimeException('This match request is no longer available.');
            }

            if ($matchRequest->isExpired()) {
                $matchRequest->update(['status' => 'expired']);
                throw new \RuntimeException('This match request has expired.');
            }

            // Verify acceptor is one of the targets
            $target = MatchRequestTarget::where('match_request_id', $matchRequest->id)
                ->where('target_user_id', $acceptor->id)
                ->where('status', 'pending')
                ->first();

            if (!$target) {
                throw new \RuntimeException('You are not a valid target for this match request.');
            }

            // Create the game
            $game = $this->createMultiplayerGame(
                $matchRequest->requester_id,
                $acceptor->id,
                $matchRequest->preferred_color ?? 'random',
                'random',
                $matchRequest->time_control_minutes ?? 10,
                $matchRequest->increment_seconds ?? 0
            );

            // Update match request
            $matchRequest->update([
                'status' => 'accepted',
                'game_id' => $game->id,
                'accepted_by_user_id' => $acceptor->id,
            ]);

            // Update target statuses
            $target->update([
                'status' => 'accepted',
                'responded_at' => now(),
            ]);

            // Expire other targets
            $otherTargets = MatchRequestTarget::where('match_request_id', $matchRequest->id)
                ->where('id', '!=', $target->id)
                ->where('status', 'pending')
                ->get();

            MatchRequestTarget::where('match_request_id', $matchRequest->id)
                ->where('id', '!=', $target->id)
                ->where('status', 'pending')
                ->update(['status' => 'expired', 'responded_at' => now()]);

            // Broadcast accepted to requester
            broadcast(new MatchRequestAccepted($matchRequest->fresh(), $game));

            // Broadcast cancelled to other targets
            foreach ($otherTargets as $otherTarget) {
                broadcast(new MatchRequestCancelled($matchRequest->token, $otherTarget->target_user_id));
            }

            return ['game' => $game];
        });
    }

    /**
     * Decline a match request — notify requester, check if all declined.
     */
    public function declineMatchRequest(string $token, User $decliner): void
    {
        $matchRequest = MatchRequest::where('token', $token)
            ->where('status', 'searching')
            ->firstOrFail();

        $target = MatchRequestTarget::where('match_request_id', $matchRequest->id)
            ->where('target_user_id', $decliner->id)
            ->where('status', 'pending')
            ->firstOrFail();

        $target->update([
            'status' => 'declined',
            'responded_at' => now(),
        ]);

        // Count remaining pending targets
        $remaining = MatchRequestTarget::where('match_request_id', $matchRequest->id)
            ->where('status', 'pending')
            ->count();

        // Broadcast decline to requester
        broadcast(new MatchRequestDeclined($matchRequest->token, $matchRequest->requester_id, $remaining));

        // If all targets have declined, expire the request
        if ($remaining === 0) {
            $matchRequest->update(['status' => 'expired']);
        }
    }

    /**
     * Cancel a match request (by requester) — notify all pending targets.
     */
    public function cancelMatchRequest(string $token, User $user): void
    {
        $matchRequest = MatchRequest::where('token', $token)
            ->where('requester_id', $user->id)
            ->where('status', 'searching')
            ->firstOrFail();

        $matchRequest->update(['status' => 'cancelled']);

        // Get pending targets before expiring them
        $pendingTargets = MatchRequestTarget::where('match_request_id', $matchRequest->id)
            ->where('status', 'pending')
            ->get();

        MatchRequestTarget::where('match_request_id', $matchRequest->id)
            ->where('status', 'pending')
            ->update(['status' => 'expired', 'responded_at' => now()]);

        // Broadcast cancellation to all pending targets
        foreach ($pendingTargets as $target) {
            broadcast(new MatchRequestCancelled($matchRequest->token, $target->target_user_id));
        }
    }
}
