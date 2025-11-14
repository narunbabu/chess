<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\User;
use App\Models\Game;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class ChampionshipMatchSchedulingService
{
    /**
     * Create a schedule proposal for a championship match
     */
    public function proposeMatchSchedule(ChampionshipMatch $match, User $proposer, Carbon $proposedTime, string $message = null): ChampionshipMatchSchedule
    {
        // Validate that proposer is one of the players
        if ($match->player1_id !== $proposer->id && $match->player2_id !== $proposer->id) {
            throw new \Exception('Only match participants can propose schedules');
        }

        // Validate proposed time is before match deadline
        if ($proposedTime->gt($match->deadline)) {
            throw new \Exception('Proposed time must be before match deadline');
        }

        // Check if there's already a pending proposal
        $existingProposal = ChampionshipMatchSchedule::where('championship_match_id', $match->id)
            ->where('status', 'proposed')
            ->first();

        if ($existingProposal) {
            throw new \Exception('There is already a pending proposal for this match');
        }

        return DB::transaction(function () use ($match, $proposer, $proposedTime, $message) {
            // Create schedule proposal
            $schedule = ChampionshipMatchSchedule::create([
                'championship_match_id' => $match->id,
                'proposer_id' => $proposer->id,
                'proposed_time' => $proposedTime,
                'status' => 'proposed',
                'proposer_message' => $message,
            ]);

            // Update match scheduling status
            $match->update([
                'scheduling_status' => 'proposed',
                'scheduled_time' => $proposedTime,
            ]);

            return $schedule;
        });
    }

    /**
     * Accept a schedule proposal
     */
    public function acceptScheduleProposal(ChampionshipMatchSchedule $schedule, User $responder, string $message = null): ChampionshipMatchSchedule
    {
        // Validate that responder is the other player
        $match = $schedule->championshipMatch;
        $proposerId = $schedule->proposer_id;
        $responderId = $responder->id;

        if ($proposerId === $responderId) {
            throw new \Exception('You cannot accept your own proposal');
        }

        if ($match->player1_id !== $responderId && $match->player2_id !== $responderId) {
            throw new \Exception('Only match participants can respond to proposals');
        }

        return DB::transaction(function () use ($schedule, $responder, $message, $match) {
            $schedule->update([
                'status' => 'accepted',
                'responder_id' => $responder->id,
                'response_time' => now(),
                'responder_message' => $message,
            ]);

            // Update match scheduling status
            $match->update([
                'scheduling_status' => 'accepted',
                'scheduled_time' => $schedule->proposed_time,
                'game_timeout' => $schedule->proposed_time->addMinutes($match->championship->default_grace_period_minutes ?? 10),
            ]);

            return $schedule;
        });
    }

    /**
     * Propose an alternative time
     */
    public function proposeAlternativeTime(ChampionshipMatchSchedule $schedule, User $responder, Carbon $alternativeTime, string $message = null): ChampionshipMatchSchedule
    {
        // Validate that responder is the other player
        $match = $schedule->championshipMatch;
        $proposerId = $schedule->proposer_id;
        $responderId = $responder->id;

        if ($proposerId === $responderId) {
            throw new \Exception('You cannot propose an alternative to your own proposal');
        }

        if ($match->player1_id !== $responderId && $match->player2_id !== $responderId) {
            throw new \Exception('Only match participants can respond to proposals');
        }

        // Validate alternative time is before match deadline
        if ($alternativeTime->gt($match->deadline)) {
            throw new \Exception('Alternative time must be before match deadline');
        }

        return DB::transaction(function () use ($schedule, $responder, $alternativeTime, $message) {
            $schedule->update([
                'status' => 'alternative_proposed',
                'responder_id' => $responder->id,
                'response_time' => now(),
                'responder_message' => $message,
                'alternative_time' => $alternativeTime,
                'alternative_message' => $message,
            ]);

            return $schedule;
        });
    }

    /**
     * Confirm a match schedule (after both parties agree)
     */
    public function confirmMatchSchedule(ChampionshipMatch $match, Carbon $scheduledTime): ChampionshipMatch
    {
        return DB::transaction(function () use ($match, $scheduledTime) {
            $match->update([
                'scheduling_status' => 'confirmed',
                'scheduled_time' => $scheduledTime,
                'game_timeout' => $scheduledTime->addMinutes($match->championship->default_grace_period_minutes ?? 10),
            ]);

            return $match;
        });
    }

    /**
     * Create an immediate game if both players are online and available
     */
    public function createImmediateGame(ChampionshipMatch $match, User $initiator): Game
    {
        // Validate that initiator is one of the players
        if ($match->player1_id !== $initiator->id && $match->player2_id !== $initiator->id) {
            throw new \Exception('Only match participants can initiate immediate games');
        }

        // Check if early play is allowed
        if (!$match->championship->allow_early_play) {
            throw new \Exception('Early play is not allowed for this championship');
        }

        // Check if opponent is online
        $opponent = $this->getOpponent($match, $initiator);
        if (!$this->isUserOnline($opponent)) {
            throw new \Exception('Opponent is not online');
        }

        return DB::transaction(function () use ($match, $initiator, $opponent) {
            // Create the game
            $game = $this->createChampionshipGame($match, $initiator);

            // Update match status
            $match->update([
                'scheduling_status' => 'confirmed',
                'game_id' => $game->id,
                'status_id' => 2, // In Progress
            ]);

            return $game;
        });
    }

    /**
     * Check for match timeouts and award forfeits
     */
    public function checkMatchTimeouts(): array
    {
        $timeoutMatches = ChampionshipMatch::where('scheduling_status', 'confirmed')
            ->whereNotNull('game_timeout')
            ->where('game_timeout', '<', now())
            ->whereNull('game_id')
            ->with(['player1', 'player2', 'championship'])
            ->get();

        $processed = [];

        foreach ($timeoutMatches as $match) {
            $winner = $this->determineTimeoutWinner($match);
            if ($winner) {
                $this->awardForfeit($match, $winner);
                $processed[] = [
                    'match_id' => $match->id,
                    'action' => 'forfeit',
                    'winner' => $winner->id,
                    'reason' => 'timeout'
                ];
            }
        }

        return $processed;
    }

    /**
     * Get all matches for a user in a specific championship
     */
    public function getUserMatches(Championship $championship, User $user): array
    {
        return ChampionshipMatch::where('championship_id', $championship->id)
            ->where(function($query) use ($user) {
                $query->where('player1_id', $user->id)
                      ->orWhere('player2_id', $user->id);
            })
            ->with(['player1', 'player2', 'championship', 'schedules'])
            ->orderBy('deadline')
            ->get()
            ->map(function ($match) use ($user) {
                return [
                    'match' => $match,
                    'opponent' => $this->getOpponent($match, $user),
                    'can_propose_time' => $this->canUserProposeTime($match, $user),
                    'can_play_immediate' => $this->canPlayImmediate($match, $user),
                    'scheduling_status' => $match->scheduling_status,
                    'deadline' => $match->deadline,
                    'scheduled_time' => $match->scheduled_time,
                ];
            })
            ->toArray();
    }

    /**
     * Get match statistics for a championship
     */
    public function getChampionshipSchedulingStats(Championship $championship): array
    {
        $matches = ChampionshipMatch::where('championship_id', $championship->id)->get();

        return [
            'total_matches' => $matches->count(),
            'pending_scheduling' => $matches->where('scheduling_status', 'pending')->count(),
            'proposed' => $matches->where('scheduling_status', 'proposed')->count(),
            'accepted' => $matches->where('scheduling_status', 'accepted')->count(),
            'confirmed' => $matches->where('scheduling_status', 'confirmed')->count(),
            'games_created' => $matches->whereNotNull('game_id')->count(),
            'completed' => $matches->where('status_id', 3)->count(), // Completed
            'forfeits' => $matches->whereNotNull('result_type_id')
                ->whereHas('resultType', function($query) {
                    $query->whereIn('code', ['forfeit_player1', 'forfeit_player2', 'double_forfeit']);
                })
                ->count(),
        ];
    }

    /**
     * Helper methods
     */
    private function getOpponent(ChampionshipMatch $match, User $player): ?User
    {
        if ($match->player1_id === $player->id) {
            return $match->player2;
        } elseif ($match->player2_id === $player->id) {
            return $match->player1;
        }
        return null;
    }

    private function isUserOnline(User $user): bool
    {
        // Check last activity within last 5 minutes
        return $user->last_activity_at && $user->last_activity_at->gt(now()->subMinutes(5));
    }

    private function createChampionshipGame(ChampionshipMatch $match, User $initiator): Game
    {
        $whitePlayer = $match->player1_id;
        $blackPlayer = $match->player2_id;

        // Create game with championship context
        $game = Game::create([
            'white_player_id' => $whitePlayer,
            'black_player_id' => $blackPlayer,
            'status' => 'waiting',
            'fen' => 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
            'moves' => [],
            'turn' => 'white',
            'move_count' => 0,
        ]);

        return $game;
    }

    private function canUserProposeTime(ChampionshipMatch $match, User $user): bool
    {
        // Cannot propose if match already has a pending proposal or is confirmed
        if (in_array($match->scheduling_status, ['proposed', 'accepted', 'confirmed'])) {
            return false;
        }

        // Can only propose if user is a participant
        return $match->player1_id === $user->id || $match->player2_id === $user->id;
    }

    private function canPlayImmediate(ChampionshipMatch $match, User $user): bool
    {
        // Can only play immediately if early play is allowed and no game exists yet
        if (!$match->championship->allow_early_play || $match->game_id) {
            return false;
        }

        // Can only play if user is a participant
        return $match->player1_id === $user->id || $match->player2_id === $user->id;
    }

    private function determineTimeoutWinner(ChampionshipMatch $match): ?User
    {
        // In a timeout scenario, we need to determine who was present
        // This is a simplified implementation - in practice, you'd track who showed up
        // For now, we'll default to player1 as winner

        // In a real implementation, you would:
        // 1. Check who actually connected to the game lobby
        // 2. Track presence at scheduled time
        // 3. Consider any communication or activity logs

        return $match->player1;
    }

    private function awardForfeit(ChampionshipMatch $match, User $winner): void
    {
        $loser = $this->getOpponent($match, $winner);

        // Determine result type based on who forfeited
        $resultTypeCode = ($match->player1_id === $winner->id) ? 'forfeit_player2' : 'forfeit_player1';
        $resultType = DB::table('championship_result_types')->where('code', $resultTypeCode)->first();

        DB::transaction(function () use ($match, $winner, $resultType) {
            $match->update([
                'status_id' => 3, // Completed
                'winner_id' => $winner->id,
                'result_type_id' => $resultType->id,
                'scheduling_status' => 'forfeit',
            ]);
        });
    }
}