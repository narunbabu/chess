<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipRoundType;
use App\Enums\ChampionshipStatus;
use Carbon\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class MatchSchedulerService
{
    /**
     * Schedule matches for the next round
     */
    public function scheduleNextRound(Championship $championship): ?int
    {
        if ($championship->getStatusEnum()->isFinished()) {
            throw new \InvalidArgumentException('Championship is already finished');
        }

        $nextRoundNumber = $this->getNextRoundNumber($championship);

        if ($this->isRoundComplete($championship, $nextRoundNumber - 1)) {
            return $this->scheduleRound($championship, $nextRoundNumber);
        }

        throw new \InvalidArgumentException('Previous round is not complete');
    }

    /**
     * Schedule a specific round
     */
    public function scheduleRound(Championship $championship, int $roundNumber): int
    {
        $format = $championship->getFormatEnum();
        $matchesScheduled = 0;

        switch ($format->value) {
            case 'swiss_only':
                $matchesScheduled = $this->scheduleSwissRound($championship, $roundNumber);
                break;
            case 'elimination_only':
                $matchesScheduled = $this->scheduleEliminationRound($championship, $roundNumber);
                break;
            case 'hybrid':
                $matchesScheduled = $this->scheduleHybridRound($championship, $roundNumber);
                break;
        }

        // Update championship status if needed
        $this->updateChampionshipStatus($championship);

        Log::info("Scheduled round", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'matches' => $matchesScheduled,
            'format' => $format->value,
        ]);

        return $matchesScheduled;
    }

    /**
     * Schedule Swiss tournament round
     */
    private function scheduleSwissRound(Championship $championship, int $roundNumber): int
    {
        $swissService = new SwissPairingService();

        try {
            $pairings = $swissService->generatePairings($championship, $roundNumber);
            $matches = $swissService->createMatches($championship, $pairings, $roundNumber);

            return $matches->count();
        } catch (\Exception $e) {
            Log::error("Failed to schedule Swiss round", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Schedule elimination tournament round
     */
    private function scheduleEliminationRound(Championship $championship, int $roundNumber): int
    {
        $eliminationService = new EliminationBracketService();

        try {
            $matches = $eliminationService->generateBracketRound($championship, $roundNumber);

            return $matches->count();
        } catch (\Exception $e) {
            Log::error("Failed to schedule elimination round", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Schedule hybrid tournament round
     */
    private function scheduleHybridRound(Championship $championship, int $roundNumber): int
    {
        $totalSwissRounds = $championship->swiss_rounds;

        if ($roundNumber <= $totalSwissRounds) {
            // Swiss phase
            return $this->scheduleSwissRound($championship, $roundNumber);
        } else {
            // Elimination phase
            $eliminationRound = $roundNumber - $totalSwissRounds;
            return $this->scheduleEliminationRound($championship, $eliminationRound);
        }
    }

    /**
     * Get next round number
     */
    public function getNextRoundNumber(Championship $championship): int
    {
        $lastRound = $championship->matches()
            ->max('round_number');

        return $lastRound ? $lastRound + 1 : 1;
    }

    /**
     * Check if a round is complete
     */
    public function isRoundComplete(Championship $championship, ?int $roundNumber = null): bool
    {
        if ($roundNumber === null) {
            $roundNumber = $this->getCurrentRoundNumber($championship);
        }

        if ($roundNumber === 0) {
            return true; // No rounds started yet
        }

        $totalMatches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->count();

        $completedMatches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->where('status', ChampionshipMatchStatus::COMPLETED->value)
            ->count();

        return $totalMatches === 0 || $completedMatches === $totalMatches;
    }

    /**
     * Get current round number
     */
    public function getCurrentRoundNumber(Championship $championship): int
    {
        $pendingMatches = $championship->matches()
            ->where('status', '!=', ChampionshipMatchStatus::COMPLETED->value)
            ->exists();

        if (!$pendingMatches) {
            return $this->getNextRoundNumber($championship) - 1;
        }

        $currentRound = $championship->matches()
            ->where('status', '!=', ChampionshipMatchStatus::COMPLETED->value)
            ->min('round_number');

        return $currentRound ?: 0;
    }

    /**
     * Schedule matches with specific time windows
     */
    public function scheduleMatchesWithTimeWindows(
        Championship $championship,
        int $roundNumber,
        Carbon $startTime,
        Carbon $endTime
    ): int {
        $participants = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->where('dropped', false)
            ->get();

        if ($participants->count() < 2) {
            throw new \InvalidArgumentException('Not enough participants for scheduling');
        }

        $pairings = $this->generatePairings($championship, $roundNumber);
        $timeSlots = $this->generateTimeSlots($startTime, $endTime, count($pairings));

        $matchesScheduled = 0;

        DB::transaction(function () use ($championship, $pairings, $timeSlots, &$matchesScheduled) {
            foreach ($pairings as $index => $pairing) {
                if (isset($timeSlots[$index])) {
                    ChampionshipMatch::create([
                        'championship_id' => $championship->id,
                        'round_number' => $pairing['round_number'],
                        'round_type' => $pairing['round_type'],
                        'player1_id' => $pairing['player1_id'],
                        'player2_id' => $pairing['player2_id'],
                        'scheduled_at' => $timeSlots[$index]['start'],
                        'deadline' => $timeSlots[$index]['end'],
                        'status' => ChampionshipMatchStatus::PENDING,
                    ]);

                    $matchesScheduled++;
                }
            }
        });

        return $matchesScheduled;
    }

    /**
     * Generate time slots for matches
     */
    private function generateTimeSlots(Carbon $startTime, Carbon $endTime, int $matchCount): array
    {
        $totalMinutes = $startTime->diffInMinutes($endTime);
        $matchDuration = max(30, floor($totalMinutes / $matchCount)); // Minimum 30 minutes per match

        $slots = [];
        $currentStart = $startTime->copy();

        for ($i = 0; $i < $matchCount; $i++) {
            $slotEnd = $currentStart->copy()->addMinutes($matchDuration);

            if ($slotEnd->greaterThan($endTime)) {
                $slotEnd = $endTime->copy();
            }

            $slots[] = [
                'start' => $currentStart->copy(),
                'end' => $slotEnd,
            ];

            $currentStart = $slotEnd->copy()->addMinutes(5); // 5 minute break between matches

            if ($currentStart->greaterThanOrEqualTo($endTime)) {
                break;
            }
        }

        return $slots;
    }

    /**
     * Reschedule pending matches
     */
    public function reschedulePendingMatches(Championship $championship, Carbon $newStartTime): int
    {
        $pendingMatches = $championship->matches()
            ->where('status', ChampionshipMatchStatus::PENDING->value)
            ->get();

        $rescheduledCount = 0;

        DB::transaction(function () use ($pendingMatches, $newStartTime, &$rescheduledCount) {
            $currentStart = $newStartTime->copy();
            $matchDuration = 60; // 1 hour per match

            foreach ($pendingMatches as $match) {
                $deadline = $currentStart->copy()->addMinutes($matchDuration);

                $match->update([
                    'scheduled_at' => $currentStart,
                    'deadline' => $deadline,
                ]);

                $currentStart = $deadline->copy()->addMinutes(5);
                $rescheduledCount++;

                Log::info("Rescheduled match", [
                    'match_id' => $match->id,
                    'new_scheduled_at' => $currentStart,
                    'new_deadline' => $deadline,
                ]);
            }
        });

        return $rescheduledCount;
    }

    /**
     * Auto-schedule next round if conditions are met
     */
    public function autoScheduleNextRound(Championship $championship): ?int
    {
        // Check if auto-scheduling is enabled
        if (!$this->shouldAutoSchedule($championship)) {
            return null;
        }

        // Check if current round is complete
        if (!$this->isRoundComplete($championship)) {
            return null;
        }

        // Check if championship should continue
        if (!$this->shouldContinueChampionship($championship)) {
            return null;
        }

        return $this->scheduleNextRound($championship);
    }

    /**
     * Check if auto-scheduling should be enabled
     */
    private function shouldAutoSchedule(Championship $championship): bool
    {
        // Only auto-schedule active championships
        if (!$championship->getStatusEnum()->isActive()) {
            return false;
        }

        // Only auto-schedule if start date has passed
        if (!$championship->start_date || $championship->start_date->isFuture()) {
            return false;
        }

        return true;
    }

    /**
     * Check if championship should continue
     */
    private function shouldContinueChampionship(Championship $championship): bool
    {
        $format = $championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                $currentRound = $this->getCurrentRoundNumber($championship);
                return $currentRound < $championship->swiss_rounds;

            case 'elimination_only':
                // Continue until we have a winner
                return !$this->hasEliminationWinner($championship);

            case 'hybrid':
                $currentRound = $this->getCurrentRoundNumber($championship);
                $totalSwissRounds = $championship->swiss_rounds;

                if ($currentRound < $totalSwissRounds) {
                    return true; // Still in Swiss phase
                } else {
                    return !$this->hasEliminationWinner($championship); // In elimination phase
                }

            default:
                return false;
        }
    }

    /**
     * Check if elimination has a winner
     */
    private function hasEliminationWinner(Championship $championship): bool
    {
        // Check if there's only one participant left who hasn't been eliminated
        $activeParticipants = $championship->participants()
            ->where('dropped', false)
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->count();

        return $activeParticipants <= 1;
    }

    /**
     * Update championship status based on progress
     */
    private function updateChampionshipStatus(Championship $championship): void
    {
        $status = $championship->getStatusEnum();

        // Move from upcoming to in_progress if first round is scheduled
        if ($status->isUpcoming() && $championship->matches()->exists()) {
            $championship->update(['status' => ChampionshipStatus::IN_PROGRESS->value]);

            Log::info("Championship status updated to IN_PROGRESS", [
                'championship_id' => $championship->id,
            ]);
        }

        // Check if championship should be completed
        if ($status->isActive() && $this->isChampionshipComplete($championship)) {
            $championship->update(['status' => ChampionshipStatus::COMPLETED->value]);

            Log::info("Championship status updated to COMPLETED", [
                'championship_id' => $championship->id,
            ]);
        }
    }

    /**
     * Check if championship is complete
     */
    public function isChampionshipComplete(Championship $championship): bool
    {
        $format = $championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                $currentRound = $this->getCurrentRoundNumber($championship);
                return $currentRound >= $championship->swiss_rounds &&
                       $this->isRoundComplete($championship, $currentRound);

            case 'elimination_only':
            case 'hybrid':
                return $this->hasEliminationWinner($championship);

            default:
                return false;
        }
    }

    /**
     * Get scheduling summary
     */
    public function getSchedulingSummary(Championship $championship): array
    {
        $currentRound = $this->getCurrentRoundNumber($championship);
        $totalRounds = $this->getTotalRounds($championship);
        $isComplete = $this->isChampionshipComplete($championship);

        $pendingMatches = $championship->matches()
            ->where('status', ChampionshipMatchStatus::PENDING->value)
            ->count();

        $activeMatches = $championship->matches()
            ->where('status', ChampionshipMatchStatus::IN_PROGRESS->value)
            ->count();

        $completedMatches = $championship->matches()
            ->where('status', ChampionshipMatchStatus::COMPLETED->value)
            ->count();

        return [
            'current_round' => $currentRound,
            'total_rounds' => $totalRounds,
            'is_complete' => $isComplete,
            'matches' => [
                'pending' => $pendingMatches,
                'active' => $activeMatches,
                'completed' => $completedMatches,
                'total' => $pendingMatches + $activeMatches + $completedMatches,
            ],
            'can_schedule_next' => $this->isRoundComplete($championship) && !$isComplete,
            'next_round_number' => $this->getNextRoundNumber($championship),
        ];
    }

    /**
     * Get total number of rounds for championship
     */
    public function getTotalRounds(Championship $championship): int
    {
        $format = $championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                return $championship->swiss_rounds;

            case 'elimination_only':
                $participants = $championship->participants()
                    ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
                    ->count();
                return ceil(log2($participants));

            case 'hybrid':
                $swissRounds = $championship->swiss_rounds;
                $qualifiers = $championship->top_qualifiers;
                $eliminationRounds = ceil(log2($qualifiers));
                return $swissRounds + $eliminationRounds;

            default:
                return 0;
        }
    }

    /**
     * Helper method to generate pairings (used for time window scheduling)
     */
    private function generatePairings(Championship $championship, int $roundNumber): array
    {
        $format = $championship->getFormatEnum();

        switch ($format->value) {
            case 'swiss_only':
                $swissService = new SwissPairingService();
                return $swissService->generatePairings($championship, $roundNumber);

            case 'elimination_only':
                $eliminationService = new EliminationBracketService();
                return $eliminationService->generateEliminationPairings($championship, $roundNumber);

            case 'hybrid':
                if ($roundNumber <= $championship->swiss_rounds) {
                    $swissService = new SwissPairingService();
                    return $swissService->generatePairings($championship, $roundNumber);
                } else {
                    $eliminationService = new EliminationBracketService();
                    return $eliminationService->generateEliminationPairings($championship, $roundNumber);
                }

            default:
                throw new \InvalidArgumentException("Unknown championship format: {$format->value}");
        }
    }
}