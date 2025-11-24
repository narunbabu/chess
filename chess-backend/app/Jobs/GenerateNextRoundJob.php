<?php

namespace App\Jobs;

use App\Models\Championship;
use App\Models\ChampionshipStanding;
use App\Enums\ChampionshipStatus;
use App\Services\MatchSchedulerService;
use App\Services\StandingsCalculatorService;
use App\Services\SwissPairingService;
use App\Services\EliminationBracketService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class GenerateNextRoundJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The championship instance.
     *
     * @var \App\Models\Championship
     */
    public $championship;

    /**
     * Whether to force round generation (bypass some checks).
     *
     * @var bool
     */
    public $force;

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
    public function __construct(Championship $championship, bool $force = false)
    {
        $this->championship = $championship;
        $this->force = $force;
    }

    /**
     * Execute the job.
     */
    public function handle(
        MatchSchedulerService $scheduler,
        StandingsCalculatorService $standingsCalculator
    ): void {
        Log::info("Starting next round generation", [
            'championship_id' => $this->championship->id,
            'championship_title' => $this->championship->title,
            'force' => $this->force,
        ]);

        try {
            // Validate championship state
            $this->validateChampionshipState();

            // Check if round can be generated
            if (!$this->canGenerateNextRound()) {
                Log::info("Cannot generate next round - conditions not met", [
                    'championship_id' => $this->championship->id,
                ]);
                return;
            }

            // Update standings before generating next round
            $this->updateStandings($standingsCalculator);

            // Generate next round
            $nextRoundNumber = $this->getNextRoundNumber();
            $matchesScheduled = $this->generateNextRound($scheduler, $nextRoundNumber);

            // Update championship status if needed
            $this->updateChampionshipStatus();

            // Send notifications about new round
            $this->sendNewRoundNotifications($nextRoundNumber, $matchesScheduled);

            Log::info("Successfully generated next round", [
                'championship_id' => $this->championship->id,
                'round_number' => $nextRoundNumber,
                'matches_scheduled' => $matchesScheduled,
            ]);

        } catch (Exception $e) {
            Log::error("Failed to generate next round", [
                'championship_id' => $this->championship->id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            throw $e;
        }
    }

    /**
     * Validate championship state
     */
    private function validateChampionshipState(): void
    {
        if ($this->championship->getStatusEnum()->isFinished()) {
            throw new Exception('Championship is already finished');
        }

        if ($this->championship->getStatusEnum()->isUpcoming() && !$this->force) {
            throw new Exception('Championship has not started yet');
        }

        if (!$this->hasEnoughParticipants()) {
            throw new Exception('Not enough participants to generate next round');
        }
    }

    /**
     * Check if there are enough participants
     */
    private function hasEnoughParticipants(): bool
    {
        $eligibleCount = $this->championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        return $eligibleCount >= 2;
    }

    /**
     * Check if next round can be generated
     */
    private function canGenerateNextRound(): bool
    {
        // Check if previous round is complete
        if (!$this->isPreviousRoundComplete() && !$this->force) {
            return false;
        }

        // Check if championship should continue
        return $this->shouldContinueChampionship();
    }

    /**
     * Check if previous round is complete
     */
    private function isPreviousRoundComplete(): bool
    {
        $currentRound = $this->getCurrentRoundNumber();

        if ($currentRound === 0) {
            return true; // First round can always be generated
        }

        $totalMatches = $this->championship->matches()
            ->where('round_number', $currentRound)
            ->count();

        $completedMatches = $this->championship->matches()
            ->where('round_number', $currentRound)
            ->completed() // Use model scope instead of direct status query
            ->count();

        return $completedMatches === $totalMatches;
    }

    /**
     * Get current round number
     * Returns the highest round number that exists (completed or not)
     */
    private function getCurrentRoundNumber(): int
    {
        $lastRound = $this->championship->matches()
            ->max('round_number');

        return $lastRound ?: 0;
    }

    /**
     * Get next round number
     */
    private function getNextRoundNumber(): int
    {
        return $this->getCurrentRoundNumber() + 1;
    }

    /**
     * Check if championship should continue
     */
    private function shouldContinueChampionship(): bool
    {
        $format = $this->championship->getFormatEnum();
        $currentRound = $this->getCurrentRoundNumber();

        switch ($format->value) {
            case 'swiss_only':
                return $currentRound < $this->championship->swiss_rounds;

            case 'elimination_only':
                // Continue until we have a winner
                return !$this->hasEliminationWinner();

            case 'hybrid':
                $totalSwissRounds = $this->championship->swiss_rounds;

                if ($currentRound < $totalSwissRounds) {
                    return true; // Still in Swiss phase
                } else {
                    return !$this->hasEliminationWinner(); // In elimination phase
                }

            default:
                return false;
        }
    }

    /**
     * Check if elimination has a winner
     */
    private function hasEliminationWinner(): bool
    {
        $activeParticipants = $this->championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        return $activeParticipants <= 1;
    }

    /**
     * Update standings before generating next round
     */
    private function updateStandings(StandingsCalculatorService $calculator): void
    {
        if ($this->championship->getFormatEnum()->isSwiss()) {
            $calculator->updateStandings($this->championship);

            Log::info("Updated standings before next round", [
                'championship_id' => $this->championship->id,
            ]);
        }
    }

    /**
     * Generate next round
     */
    private function generateNextRound(MatchSchedulerService $scheduler, int $roundNumber): int
    {
        return DB::transaction(function () use ($scheduler, $roundNumber) {
            $matchesScheduled = $scheduler->scheduleRound($this->championship, $roundNumber);

            Log::info("Generated next round", [
                'championship_id' => $this->championship->id,
                'round_number' => $roundNumber,
                'matches_scheduled' => $matchesScheduled,
            ]);

            return $matchesScheduled;
        });
    }

    /**
     * Update championship status based on progress
     */
    private function updateChampionshipStatus(): void
    {
        $status = $this->championship->getStatusEnum();

        // Move from upcoming to in_progress if first round is scheduled
        if ($status->isUpcoming() && $this->getCurrentRoundNumber() >= 1) {
            $this->championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);

            Log::info("Updated championship status to IN_PROGRESS", [
                'championship_id' => $this->championship->id,
            ]);
        }

        // Check if championship should be completed
        if ($status->isActive() && $this->isChampionshipComplete()) {
            $this->completeChampionship();
        }
    }

    /**
     * Check if championship is complete
     */
    private function isChampionshipComplete(): bool
    {
        $format = $this->championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                $currentRound = $this->getCurrentRoundNumber();
                return $currentRound >= $this->championship->swiss_rounds &&
                       $this->isPreviousRoundComplete();

            case 'elimination_only':
            case 'hybrid':
                return $this->hasEliminationWinner();

            default:
                return false;
        }
    }

    /**
     * Complete championship
     */
    private function completeChampionship(): void
    {
        DB::transaction(function () {
            // Update status
            $this->championship->update(['status' => ChampionshipStatus::COMPLETED->value]);

            // Generate final standings
            $this->generateFinalStandings();

            // Award prizes if applicable
            $this->awardPrizes();

            Log::info("Completed championship", [
                'championship_id' => $this->championship->id,
                'final_standings_generated' => true,
            ]);
        });
    }

    /**
     * Generate final standings
     */
    private function generateFinalStandings(): void
    {
        $format = $this->championship->getFormatEnum();

        if ($format->isElimination()) {
            $eliminationService = new EliminationBracketService();
            $finalStandings = $eliminationService->getFinalStandings($this->championship);

            // Save final standings
            foreach ($finalStandings as $standing) {
                $existingStanding = ChampionshipStanding::firstOrCreate(
                    [
                        'championship_id' => $this->championship->id,
                        'user_id' => $standing['user_id'],
                    ],
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

                $existingStanding->update([
                    'rank' => $standing['rank'],
                    'final_placement' => $standing['placement'],
                ]);
            }
        }
    }

    /**
     * Award prizes to winners (placeholder for payment/prize system)
     */
    private function awardPrizes(): void
    {
        // This would integrate with your payment/prize system
        // For now, just log that prizes would be awarded

        $winner = $this->determineWinner();
        if ($winner) {
            Log::info("Championship winner determined", [
                'championship_id' => $this->championship->id,
                'winner_id' => $winner->id,
                'winner_name' => $winner->name,
            ]);
        }

        // TODO: Implement prize distribution logic
    }

    /**
     * Determine championship winner
     */
    private function determineWinner(): ?\App\Models\User
    {
        $format = $this->championship->getFormatEnum();

        if ($format->isElimination()) {
            $eliminationService = new EliminationBracketService();
            $winnerId = $eliminationService->determineWinner($this->championship);
            return $winnerId ? \App\Models\User::find($winnerId) : null;
        } else {
            // For Swiss, get top of standings
            return $this->championship->standings()
                ->with('user')
                ->orderBy('points', 'desc')
                ->orderBy('buchholz_score', 'desc')
                ->orderBy('sonneborn_berger', 'desc')
                ->first()?->user;
        }
    }

    /**
     * Send notifications about new round
     */
    private function sendNewRoundNotifications(int $roundNumber, int $matchesScheduled): void
    {
        $participants = $this->championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->with('user')
            ->get();

        foreach ($participants as $participant) {
            try {
                // Send notification about new round
                // You could create a NewRoundNotification here
                // $participant->user->notify(new NewRoundNotification($this->championship, $roundNumber));

                Log::info("Would send new round notification", [
                    'user_id' => $participant->user_id,
                    'championship_id' => $this->championship->id,
                    'round_number' => $roundNumber,
                ]);
            } catch (\Exception $e) {
                Log::error("Failed to send new round notification", [
                    'user_id' => $participant->user_id,
                    'championship_id' => $this->championship->id,
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
        return ['championships', 'round-generation', "championship-{$this->championship->id}"];
    }
}