<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipMatchSchedule;
use App\Models\User;
use App\Events\ChampionshipTimeoutWarning;
use App\Events\ChampionshipMatchForfeited;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use App\Enums\ChampionshipResultType as ResultTypeEnum;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ChampionshipGameTimeoutService
{
    /**
     * Check all championships for timeout scenarios and process them
     */
    public function checkAllTimeouts(): array
    {
        $results = [];

        // Check for timeout warnings
        $warningResults = $this->checkTimeoutWarnings();
        $results['warnings'] = $warningResults;

        // Check for actual timeouts
        $timeoutResults = $this->processTimeouts();
        $results['timeouts'] = $timeoutResults;

        return $results;
    }

    /**
     * Check for matches that need timeout warnings
     */
    public function checkTimeoutWarnings(): array
    {
        $warnings = [];

        // Find matches scheduled to start within the warning period (5 minutes)
        $warningWindow = now()->addMinutes(5);
        $scheduledMatches = ChampionshipMatch::where('scheduling_status', 'confirmed')
            ->whereNotNull('scheduled_time')
            ->where('scheduled_time', '<=', $warningWindow)
            ->where('scheduled_time', '>', now())
            ->whereNull('game_id')
            ->with(['player1', 'player2', 'championship'])
            ->get();

        foreach ($scheduledMatches as $match) {
            $warning = $this->sendTimeoutWarning($match);
            if ($warning) {
                $warnings[] = $warning;
            }
        }

        return $warnings;
    }

    /**
     * Send timeout warning for a match
     */
    private function sendTimeoutWarning(ChampionshipMatch $match): ?array
    {
        // Check if we've already sent a warning recently (within last hour)
        $recentWarning = ChampionshipMatchSchedule::where('championship_match_id', $match->id)
            ->where('warning_sent_at', '>', now()->subHour())
            ->exists();

        if ($recentWarning) {
            return null;
        }

        // Send warning to both players
        $players = [$match->player1, $match->player2];
        $warningSent = false;

        foreach ($players as $player) {
            if ($player) {
                // Fire event for WebSocket notification
                ChampionshipTimeoutWarning::dispatch($match, $player, 'approaching');

                // Update schedule record to track warning
                ChampionshipMatchSchedule::updateOrCreate(
                    ['championship_match_id' => $match->id],
                    [
                        'proposer_id' => $match->player1_id,
                        'proposed_time' => $match->scheduled_time ?? now(),
                        'status' => 'accepted',
                        'warning_sent_at' => now(),
                        'warning_type' => 'game_start',
                        'warning_sent_to' => $player->id,
                    ]
                );

                $warningSent = true;

                Log::info('Timeout warning sent', [
                    'match_id' => $match->id,
                    'player_id' => $player->id,
                    'scheduled_time' => $match->scheduled_time,
                ]);
            }
        }

        if ($warningSent) {
            return [
                'match_id' => $match->id,
                'action' => 'warning_sent',
                'scheduled_time' => $match->scheduled_time,
                'players_notified' => collect($players)->pluck('id')->filter()->toArray()
            ];
        }

        return null;
    }

    /**
     * Process actual timeouts and award forfeits
     */
    public function processTimeouts(): array
    {
        $processed = [];

        // Find matches that have timed out
        $timeoutMatches = ChampionshipMatch::where('scheduling_status', 'confirmed')
            ->whereNotNull('game_timeout')
            ->where('game_timeout', '<', now())
            ->whereNull('game_id')
            ->with(['player1', 'player2', 'championship'])
            ->get();

        foreach ($timeoutMatches as $match) {
            $result = $this->processMatchTimeout($match);
            if ($result) {
                $processed[] = $result;
            }
        }

        return $processed;
    }

    /**
     * Process timeout for a specific match
     */
    public function processMatchTimeout(ChampionshipMatch $match): ?array
    {
        // Check if match is already completed
        if ($match->getStatusEnum()->isFinished()) {
            return null;
        }

        $winner = $this->determineTimeoutWinner($match);

        if (!$winner) {
            // Double forfeit if no clear winner
            return $this->awardDoubleForfeit($match);
        }

        return $this->awardForfeit($match, $winner);
    }

    /**
     * Determine who should win in a timeout scenario
     */
    private function determineTimeoutWinner(ChampionshipMatch $match): ?User
    {
        // In a real implementation, you would check:
        // 1. Who actually connected to the game lobby
        // 2. Who was present at scheduled time
        // 3. Any communication or activity logs
        // 4. System logs showing player presence

        // For now, we'll use a simplified approach:
        // Check which player was more recently active

        $player1LastActivity = $match->player1?->last_activity_at;
        $player2LastActivity = $match->player2?->last_activity_at;

        if (!$player1LastActivity && !$player2LastActivity) {
            return null; // Both inactive - double forfeit
        }

        if (!$player1LastActivity) {
            return $match->player2;
        }

        if (!$player2LastActivity) {
            return $match->player1;
        }

        // Compare last activity - more recent activity wins
        if ($player1LastActivity->gt($player2LastActivity)) {
            return $match->player1;
        } elseif ($player2LastActivity->gt($player1LastActivity)) {
            return $match->player2;
        }

        // If activity times are equal, default to null for double forfeit
        return null;
    }

    /**
     * Award forfeit to winner
     */
    private function awardForfeit(ChampionshipMatch $match, User $winner): array
    {
        return DB::transaction(function () use ($match, $winner) {
            $loser = $this->getOpponent($match, $winner);

            // Determine result type based on who forfeited
            $resultTypeCode = ($match->player1_id === $winner->id)
                ? ResultTypeEnum::FORFEIT_PLAYER2->value
                : ResultTypeEnum::FORFEIT_PLAYER1->value;

            $resultType = DB::table('championship_result_types')
                ->where('code', $resultTypeCode)
                ->first();

            // Update match
            $match->update([
                'status_id' => MatchStatusEnum::COMPLETED->getId(),
                'winner_id' => $winner->id,
                'result_type_id' => $resultType->id,
                'scheduling_status' => 'forfeit',
                'completed_at' => now(),
            ]);

            // Fire event for notifications
            ChampionshipMatchForfeited::dispatch($match, $winner, $loser);

            Log::info('Match forfeited due to timeout', [
                'match_id' => $match->id,
                'winner_id' => $winner->id,
                'loser_id' => $loser?->id,
                'result_type' => $resultTypeCode,
            ]);

            return [
                'match_id' => $match->id,
                'action' => 'forfeit',
                'winner_id' => $winner->id,
                'loser_id' => $loser?->id,
                'result_type' => $resultTypeCode,
                'reason' => 'timeout'
            ];
        });
    }

    /**
     * Award double forfeit
     */
    private function awardDoubleForfeit(ChampionshipMatch $match): array
    {
        return DB::transaction(function () use ($match) {
            $resultType = DB::table('championship_result_types')
                ->where('code', ResultTypeEnum::DOUBLE_FORFEIT->value)
                ->first();

            // Update match
            $match->update([
                'status_id' => MatchStatusEnum::COMPLETED->getId(),
                'winner_id' => null,
                'result_type_id' => $resultType->id,
                'scheduling_status' => 'double_forfeit',
                'completed_at' => now(),
            ]);

            // Fire event for notifications
            ChampionshipMatchForfeited::dispatch($match, null, null);

            Log::info('Double forfeit awarded due to timeout', [
                'match_id' => $match->id,
                'result_type' => ResultTypeEnum::DOUBLE_FORFEIT->value,
            ]);

            return [
                'match_id' => $match->id,
                'action' => 'double_forfeit',
                'result_type' => ResultTypeEnum::DOUBLE_FORFEIT->value,
                'reason' => 'timeout'
            ];
        });
    }

    /**
     * Get opponent for a given player
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

    /**
     * Set timeout for a scheduled match
     */
    public function setMatchTimeout(ChampionshipMatch $match, Carbon $scheduledTime): void
    {
        $gracePeriodMinutes = $match->championship->default_grace_period_minutes ?? 10;
        $timeoutTime = $scheduledTime->addMinutes($gracePeriodMinutes);

        $match->update([
            'game_timeout' => $timeoutTime,
            'scheduling_status' => 'confirmed',
        ]);

        Log::info('Match timeout set', [
            'match_id' => $match->id,
            'scheduled_time' => $scheduledTime,
            'timeout_time' => $timeoutTime,
            'grace_period_minutes' => $gracePeriodMinutes,
        ]);
    }

    /**
     * Check if a match is in timeout status
     */
    public function isMatchTimedOut(ChampionshipMatch $match): bool
    {
        return $match->game_timeout && now()->greaterThan($match->game_timeout);
    }

    /**
     * Get time remaining before timeout
     */
    public function getTimeRemaining(ChampionshipMatch $match): ?int
    {
        if (!$match->game_timeout) {
            return null;
        }

        $remaining = now()->diffInSeconds($match->game_timeout, false);

        return $remaining > 0 ? $remaining : 0;
    }

    /**
     * Get timeout status for all matches in a championship
     */
    public function getChampionshipTimeoutStatus(Championship $championship): array
    {
        $matches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('scheduling_status', 'confirmed')
            ->whereNull('game_id')
            ->with(['player1', 'player2'])
            ->get();

        $status = [];

        foreach ($matches as $match) {
            $timeRemaining = $this->getTimeRemaining($match);
            $isTimedOut = $this->isMatchTimedOut($match);
            $needsWarning = $match->scheduled_time &&
                           $match->scheduled_time->diffInSeconds(now(), false) <= 300 && // Within 5 minutes
                           $match->scheduled_time->greaterThan(now());

            $status[] = [
                'match_id' => $match->id,
                'scheduled_time' => $match->scheduled_time,
                'game_timeout' => $match->game_timeout,
                'time_remaining_seconds' => $timeRemaining,
                'is_timed_out' => $isTimedOut,
                'needs_warning' => $needsWarning,
                'players' => [
                    'player1' => $match->player1 ? [
                        'id' => $match->player1->id,
                        'username' => $match->player1->username,
                        'last_activity' => $match->player1->last_activity_at,
                    ] : null,
                    'player2' => $match->player2 ? [
                        'id' => $match->player2->id,
                        'username' => $match->player2->username,
                        'last_activity' => $match->player2->last_activity_at,
                    ] : null,
                ]
            ];
        }

        return $status;
    }

    /**
     * Manually process timeout for a specific match
     */
    public function forceTimeout(ChampionshipMatch $match): ?array
    {
        if ($match->getStatusEnum()->isFinished()) {
            throw new \Exception('Cannot process timeout for completed match');
        }

        return $this->processMatchTimeout($match);
    }

    /**
     * Extend timeout for a match (admin function)
     */
    public function extendTimeout(ChampionshipMatch $match, int $additionalMinutes): void
    {
        if (!$match->game_timeout) {
            throw new \Exception('Match has no timeout set');
        }

        $newTimeout = $match->game_timeout->addMinutes($additionalMinutes);
        $match->update(['game_timeout' => $newTimeout]);

        Log::info('Match timeout extended', [
            'match_id' => $match->id,
            'previous_timeout' => $match->game_timeout,
            'new_timeout' => $newTimeout,
            'additional_minutes' => $additionalMinutes,
        ]);
    }
}