<?php

namespace App\Jobs;

use App\Models\ChampionshipMatch;
use App\Models\Championship;
use App\Models\ChampionshipStanding;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\Services\MatchSchedulerService;
use App\Services\StandingsCalculatorService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class CheckExpiredMatchesJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 300;

    /**
     * Create a new job instance.
     */
    public function __construct()
    {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        Log::info("Starting check for expired matches");

        $expiredMatches = $this->getExpiredMatches();
        $processedCount = 0;

        foreach ($expiredMatches as $match) {
            try {
                $this->processExpiredMatch($match);
                $processedCount++;

                Log::info("Processed expired match", [
                    'match_id' => $match->id,
                    'championship_id' => $match->championship_id,
                    'player1_id' => $match->player1_id,
                    'player2_id' => $match->player2_id,
                    'deadline' => $match->deadline,
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to process expired match", [
                    'match_id' => $match->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                ]);
            }
        }

        Log::info("Completed check for expired matches", [
            'total_expired' => $expiredMatches->count(),
            'processed' => $processedCount,
        ]);

        // Trigger next round scheduling if applicable
        $this->checkAndScheduleNextRounds();
    }

    /**
     * Get expired matches
     */
    private function getExpiredMatches(): \Illuminate\Database\Eloquent\Collection
    {
        return ChampionshipMatch::where('deadline', '<', now())
            ->where('status', '!=', ChampionshipMatchStatus::COMPLETED->value)
            ->with(['championship', 'player1', 'player2'])
            ->get();
    }

    /**
     * Process an expired match
     */
    private function processExpiredMatch(ChampionshipMatch $match): void
    {
        DB::transaction(function () use ($match) {
            $forfeitType = $this->determineForfeitType($match);

            switch ($forfeitType) {
                case 'player1_forfeit':
                    $this->processPlayerForfeit($match, $match->player1_id, $match->player2_id);
                    break;
                case 'player2_forfeit':
                    $this->processPlayerForfeit($match, $match->player2_id, $match->player1_id);
                    break;
                case 'double_forfeit':
                    $this->processDoubleForfeit($match);
                    break;
            }

            // Update match status
            $match->update([
                'status' => ChampionshipMatchStatus::COMPLETED,
                'result_type' => $this->getResultTypeForForfeit($forfeitType),
                'winner_id' => $this->getWinnerForForfeit($match, $forfeitType),
                'completed_at' => now(),
            ]);

            // Update standings
            $this->updateStandingsAfterForfeit($match, $forfeitType);

            // Check if player should be dropped from tournament
            $this->checkPlayerDropping($match, $forfeitType);
        });
    }

    /**
     * Determine forfeit type based on game activity
     */
    private function determineForfeitType(ChampionshipMatch $match): string
    {
        // If there's no game associated, double forfeit
        if (!$match->game_id) {
            return 'double_forfeit';
        }

        $game = $match->game;
        if (!$game) {
            return 'double_forfeit';
        }

        // Check game activity
        $lastMove = $game->moves()->latest()->first();
        if (!$lastMove) {
            // Game created but no moves - check who created it
            return $this->determineForfeitByGameCreator($match, $game);
        }

        // Check who made the last move
        $timeSinceLastMove = now()->diffInMinutes($lastMove->created_at);
        $deadlinePassedMinutes = now()->diffInMinutes($match->deadline);

        if ($timeSinceLastMove < $deadlinePassedMinutes / 2) {
            // Recent activity - opponent forfeits
            return $lastMove->user_id === $match->player1_id
                ? 'player2_forfeit'
                : 'player1_forfeit';
        } else {
            // No recent activity - double forfeit
            return 'double_forfeit';
        }
    }

    /**
     * Determine forfeit by game creator
     */
    private function determineForfeitByGameCreator(ChampionshipMatch $match, $game): string
    {
        // If player 1 created the game but player 2 didn't join, player 2 forfeits
        if ($game->white_player_id === $match->player1_id && !$game->black_player_id) {
            return 'player2_forfeit';
        }

        // If player 2 created the game but player 1 didn't join, player 1 forfeits
        if ($game->white_player_id === $match->player2_id && !$game->black_player_id) {
            return 'player1_forfeit';
        }

        // Default to double forfeit if unclear
        return 'double_forfeit';
    }

    /**
     * Process single player forfeit
     */
    private function processPlayerForfeit(ChampionshipMatch $match, int $loserId, int $winnerId): void
    {
        // Update winner's standing
        $this->addResultToStandings($match->championship_id, $winnerId, 'win');

        // Update loser's standing
        $this->addResultToStandings($match->championship_id, $loserId, 'loss');

        Log::info("Processed player forfeit", [
            'match_id' => $match->id,
            'winner_id' => $winnerId,
            'loser_id' => $loserId,
        ]);
    }

    /**
     * Process double forfeit
     */
    private function processDoubleForfeit(ChampionshipMatch $match): void
    {
        // Both players get a loss
        $this->addResultToStandings($match->championship_id, $match->player1_id, 'loss');
        $this->addResultToStandings($match->championship_id, $match->player2_id, 'loss');

        Log::info("Processed double forfeit", [
            'match_id' => $match->id,
            'player1_id' => $match->player1_id,
            'player2_id' => $match->player2_id,
        ]);
    }

    /**
     * Add result to standings
     */
    private function addResultToStandings(int $championshipId, int $userId, string $result): void
    {
        $standing = ChampionshipStanding::firstOrCreate(
            ['championship_id' => $championshipId, 'user_id' => $userId],
            [
                'score' => 0,
                'games_played' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
                'buchholz' => 0,
                'sonneborn_berger' => 0,
                't_rating' => 0,
            ]
        );

        switch ($result) {
            case 'win':
                $standing->increment('score');
                $standing->increment('wins');
                break;
            case 'draw':
                $standing->increment('score', 0.5);
                $standing->increment('draws');
                break;
            case 'loss':
                $standing->increment('losses');
                break;
        }

        $standing->increment('games_played');
        $standing->save();
    }

    /**
     * Get result type enum value for forfeit
     */
    private function getResultTypeForForfeit(string $forfeitType): string
    {
        return match ($forfeitType) {
            'player1_forfeit' => ChampionshipResultType::FORFEIT_PLAYER1->value,
            'player2_forfeit' => ChampionshipResultType::FORFEIT_PLAYER2->value,
            'double_forfeit' => ChampionshipResultType::DOUBLE_FORFEIT->value,
            default => ChampionshipResultType::DOUBLE_FORFEIT->value,
        };
    }

    /**
     * Get winner ID for forfeit
     */
    private function getWinnerForForfeit(ChampionshipMatch $match, string $forfeitType): ?int
    {
        return match ($forfeitType) {
            'player1_forfeit' => $match->player2_id,
            'player2_forfeit' => $match->player1_id,
            'double_forfeit' => null,
            default => null,
        };
    }

    /**
     * Update standings after forfeit
     */
    private function updateStandingsAfterForfeit(ChampionshipMatch $match, string $forfeitType): void
    {
        // Recalculate tiebreakers if Swiss tournament
        $championship = $match->championship;
        if ($championship->getFormatEnum()->isSwiss()) {
            // Use standings calculator to update tiebreakers
            $calculator = new StandingsCalculatorService();
            $calculator->updateStandings($championship);
        }
    }

    /**
     * Check if players should be dropped from tournament
     */
    private function checkPlayerDropping(ChampionshipMatch $match, string $forfeitType): void
    {
        $championship = $match->championship;
        $maxForfeits = 2; // Configure based on tournament rules

        $playersToCheck = [];

        if ($forfeitType === 'player1_forfeit') {
            $playersToCheck[] = $match->player1_id;
        } elseif ($forfeitType === 'player2_forfeit') {
            $playersToCheck[] = $match->player2_id;
        } else {
            $playersToCheck[] = $match->player1_id;
            $playersToCheck[] = $match->player2_id;
        }

        foreach ($playersToCheck as $playerId) {
            $forfeitCount = $this->getPlayerForfeitCount($championship, $playerId);

            if ($forfeitCount >= $maxForfeits) {
                $this->dropPlayerFromChampionship($championship, $playerId);

                Log::info("Player dropped from championship due to forfeits", [
                    'championship_id' => $championship->id,
                    'player_id' => $playerId,
                    'forfeit_count' => $forfeitCount,
                    'max_forfeits' => $maxForfeits,
                ]);
            }
        }
    }

    /**
     * Get player's forfeit count in championship
     */
    private function getPlayerForfeitCount(Championship $championship, int $playerId): int
    {
        return $championship->matches()
            ->where('status', ChampionshipMatchStatus::COMPLETED)
            ->where(function ($query) use ($playerId) {
                $query->where('player1_id', $playerId)
                      ->orWhere('player2_id', $playerId);
            })
            ->whereIn('result_type', [
                ChampionshipResultType::FORFEIT_PLAYER1->value,
                ChampionshipResultType::FORFEIT_PLAYER2->value,
                ChampionshipResultType::DOUBLE_FORFEIT->value,
            ])
            ->where(function ($query) use ($playerId) {
                $query->where(function ($q) use ($playerId) {
                    $q->where('result_type', ChampionshipResultType::FORFEIT_PLAYER1->value)
                      ->where('player1_id', $playerId);
                })->orWhere(function ($q) use ($playerId) {
                    $q->where('result_type', ChampionshipResultType::FORFEIT_PLAYER2->value)
                      ->where('player2_id', $playerId);
                })->orWhere('result_type', ChampionshipResultType::DOUBLE_FORFEIT->value);
            })
            ->count();
    }

    /**
     * Drop player from championship
     */
    private function dropPlayerFromChampionship(Championship $championship, int $playerId): void
    {
        $participant = $championship->participants()
            ->where('user_id', $playerId)
            ->first();

        if ($participant) {
            $participant->update(['dropped' => true]);

            // Forfeit remaining matches
            $remainingMatches = $championship->matches()
                ->where('status', '!=', ChampionshipMatchStatus::COMPLETED)
                ->where(function ($query) use ($playerId) {
                    $query->where('player1_id', $playerId)
                          ->orWhere('player2_id', $playerId);
                })
                ->get();

            foreach ($remainingMatches as $match) {
                $opponentId = $match->player1_id === $playerId
                    ? $match->player2_id
                    : $match->player1_id;

                $match->update([
                    'status' => ChampionshipMatchStatus::COMPLETED,
                    'result_type' => ChampionshipResultType::FORFEIT_PLAYER1->value,
                    'winner_id' => $opponentId,
                    'completed_at' => now(),
                ]);

                // Update opponent's standing
                $this->addResultToStandings($championship->id, $opponentId, 'win');
            }
        }
    }

    /**
     * Check and schedule next rounds if conditions are met
     */
    private function checkAndScheduleNextRounds(): void
    {
        $activeChampionships = Championship::where('status', \App\Enums\ChampionshipStatus::IN_PROGRESS->value)
            ->get();

        $scheduler = new MatchSchedulerService();

        foreach ($activeChampionships as $championship) {
            try {
                if ($scheduler->autoScheduleNextRound($championship)) {
                    Log::info("Auto-scheduled next round", [
                        'championship_id' => $championship->id,
                    ]);
                }
            } catch (\Exception $e) {
                Log::error("Failed to auto-schedule next round", [
                    'championship_id' => $championship->id,
                    'error' => $e->getMessage(),
                ]);
            }
        }
    }

    /**
     * Get the tags that should be assigned to the job.
     */
    public function tags(): array
    {
        return ['championships', 'expired-matches'];
    }
}