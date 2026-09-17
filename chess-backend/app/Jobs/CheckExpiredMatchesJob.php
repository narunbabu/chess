<?php

namespace App\Jobs;

use App\Models\ChampionshipMatch;
use App\Models\Championship;
use App\Models\ChampionshipStanding;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
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
            ->whereNotCompleted() // Use model scope instead of direct status query
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

        // Check game activity. Moves are a JSON array column on games (there is
        // no moves relation); each entry carries the mover's user_id.
        $moves = is_array($game->moves) ? $game->moves : [];
        if (empty($moves)) {
            // Game created but no moves - check who created it
            return $this->determineForfeitByGameCreator($match, $game);
        }

        $lastMoverId = $this->getLastMoverId($game, end($moves));
        $lastMoveAt = $game->last_move_at ?? $game->updated_at;
        if (!$lastMoverId || !$lastMoveAt) {
            return 'double_forfeit';
        }

        // Check who made the last move
        // Measure past -> now(): Carbon 3 diffs are signed, and both negated
        // flipped the comparison below.
        $timeSinceLastMove = $lastMoveAt->diffInMinutes(now());
        $deadlinePassedMinutes = $match->deadline->diffInMinutes(now());

        if ($timeSinceLastMove < $deadlinePassedMinutes / 2) {
            // Recent activity - opponent forfeits
            if ($lastMoverId === (int) $match->player1_id) {
                return 'player2_forfeit';
            }
            if ($lastMoverId === (int) $match->player2_id) {
                return 'player1_forfeit';
            }
        }

        // No recent activity (or last mover is not a match player) - double forfeit
        return 'double_forfeit';
    }

    /**
     * Resolve who made the last move: the stored user_id, or - for legacy
     * entries without one - the side that is not on turn.
     */
    private function getLastMoverId($game, $lastMove): ?int
    {
        if (is_array($lastMove) && isset($lastMove['user_id']) && is_numeric($lastMove['user_id'])) {
            return (int) $lastMove['user_id'];
        }

        $moverId = match ($game->turn) {
            'white' => $game->black_player_id,
            'black' => $game->white_player_id,
            default => null,
        };

        return $moverId ? (int) $moverId : null;
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
                $standing->increment('points');
                $standing->increment('wins');
                break;
            case 'draw':
                $standing->increment('points', 0.5);
                $standing->increment('draws');
                break;
            case 'loss':
                $standing->increment('losses');
                break;
        }

        $standing->increment('matches_played');
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
            ->completed() // Use model scope instead of direct status query
            ->where(function ($query) use ($playerId) {
                $query->where('player1_id', $playerId)
                      ->orWhere('player2_id', $playerId);
            })
            // The column is result_type_id; 'result_type' is only a model mutator
            // (MySQL rejects it, SQLite silently reads it as a string literal).
            ->whereIn('result_type_id', [
                ChampionshipResultType::FORFEIT_PLAYER1->getId(),
                ChampionshipResultType::FORFEIT_PLAYER2->getId(),
                ChampionshipResultType::DOUBLE_FORFEIT->getId(),
            ])
            ->where(function ($query) use ($playerId) {
                $query->where(function ($q) use ($playerId) {
                    $q->where('result_type_id', ChampionshipResultType::FORFEIT_PLAYER1->getId())
                      ->where('player1_id', $playerId);
                })->orWhere(function ($q) use ($playerId) {
                    $q->where('result_type_id', ChampionshipResultType::FORFEIT_PLAYER2->getId())
                      ->where('player2_id', $playerId);
                })->orWhere('result_type_id', ChampionshipResultType::DOUBLE_FORFEIT->getId());
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

        if (!$participant) {
            return;
        }

        // championship_participants.dropped_at (see the 2026_09_15 migration);
        // the old update(['dropped' => true]) hit no column and was discarded,
        // so the player stayed pairable in later rounds.
        $participant->markAsDropped('forfeit_limit');

        // Forfeit remaining matches
        $remainingMatches = $championship->matches()
            ->whereNotCompleted() // Use model scope instead of direct status query
            ->where(function ($query) use ($playerId) {
                $query->where('player1_id', $playerId)
                      ->orWhere('player2_id', $playerId);
            })
            ->get();

        foreach ($remainingMatches as $match) {
            // The result type says which SIDE forfeited, so it depends on where
            // the dropped player sits in this match - it was always
            // FORFEIT_PLAYER1, which credited the loss to the wrong player (and
            // contradicted winner_id) whenever they were player2.
            $droppedIsPlayer1 = (int) $match->player1_id === $playerId;
            $opponentId = $droppedIsPlayer1 ? $match->player2_id : $match->player1_id;

            $match->update([
                'status' => ChampionshipMatchStatus::COMPLETED,
                'result_type' => $droppedIsPlayer1
                    ? ChampionshipResultType::FORFEIT_PLAYER1->value
                    : ChampionshipResultType::FORFEIT_PLAYER2->value,
                // A bye row has no opponent: nobody wins it.
                'winner_id' => $opponentId,
                'completed_at' => now(),
            ]);

            // Both sides of the forfeit have to land in the standings: only the
            // opponent's win was recorded, so the dropped player kept the score
            // and matches_played they had before the drop and their remaining
            // matches simply vanished from their record.
            if ($opponentId) {
                $this->processPlayerForfeit($match, $playerId, (int) $opponentId);
            } else {
                // Bye row: nobody to credit the win to, but the dropped player
                // still loses the match they will never play.
                $this->addResultToStandings($championship->id, $playerId, 'loss');
            }
        }
    }

    /**
     * Check and schedule next rounds if conditions are met
     */
    private function checkAndScheduleNextRounds(): void
    {
        $activeChampionships = Championship::where('status_id', ChampionshipStatusEnum::IN_PROGRESS->getId())
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
