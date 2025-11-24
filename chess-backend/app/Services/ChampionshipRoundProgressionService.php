<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use App\Enums\ChampionshipStatus as ChampionshipStatusEnum;
use App\Enums\ChampionshipMatchStatus as MatchStatusEnum;
use App\Enums\ChampionshipResultType as ResultTypeEnum;
use App\Enums\ChampionshipFormat as FormatEnum;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;

class ChampionshipRoundProgressionService
{
    private PlaceholderMatchAssignmentService $placeholderService;

    public function __construct(PlaceholderMatchAssignmentService $placeholderService)
    {
        $this->placeholderService = $placeholderService;
    }

    /**
     * Check all active championships for round completion and progress if ready
     */
    public function checkAllChampionships(): array
    {
        $results = [];

        $activeChampionships = Championship::where('status', ChampionshipStatusEnum::IN_PROGRESS->value)
            ->where('start_date', '<=', now())
            ->with(['participants', 'matches'])
            ->get();

        foreach ($activeChampionships as $championship) {
            try {
                $result = $this->checkChampionshipRoundProgression($championship);
                if ($result) {
                    $results[] = $result;
                }
            } catch (\Exception $e) {
                Log::error('Error checking championship round progression', [
                    'championship_id' => $championship->id,
                    'error' => $e->getMessage()
                ]);
            }
        }

        return $results;
    }

    /**
     * Check if a specific championship's current round is complete and progress if needed
     */
    public function checkChampionshipRoundProgression(Championship $championship): ?array
    {
        $currentRound = $this->getCurrentRound($championship);

        if (!$currentRound) {
            return null;
        }

        if ($this->isRoundComplete($championship, $currentRound)) {
            return $this->progressToNextRound($championship, $currentRound);
        }

        return null;
    }

    /**
     * Get the current active round number for a championship
     * Current round = Highest completed round + 1, or 1 if no rounds exist
     */
    public function getCurrentRound(Championship $championship): ?int
    {
        // Get the highest round number that has all matches completed
        $highestCompletedRound = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('status_id', MatchStatusEnum::COMPLETED->getId())
            ->max('round_number');

        // If no completed rounds, current round is 1 (or null if no matches at all)
        if (!$highestCompletedRound) {
            $hasAnyMatches = ChampionshipMatch::where('championship_id', $championship->id)->exists();
            return $hasAnyMatches ? 1 : null;
        }

        // Check if the highest completed round is actually complete (all matches in that round are completed)
        $highestRoundMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $highestCompletedRound)
            ->get();

        $isRoundComplete = $highestRoundMatches->every(function ($match) {
            return $match->status_id === MatchStatusEnum::COMPLETED->getId();
        });

        if (!$isRoundComplete) {
            // If the highest round with matches is not complete, that's the current round
            return (int) $highestCompletedRound;
        }

        // Current round is the next one after the highest completed round
        return (int) $highestCompletedRound + 1;
    }

    /**
     * Check if a specific round is complete
     */
    public function isRoundComplete(Championship $championship, int $roundNumber): bool
    {
        $roundMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $roundNumber)
            ->get();

        // Round is complete if all matches are completed
        return $roundMatches->every(function ($match) {
            return $match->status_id === MatchStatusEnum::COMPLETED->getId();
        });
    }

    /**
     * Progress championship to the next round
     */
    public function progressToNextRound(Championship $championship, int $completedRound): array
    {
        return DB::transaction(function () use ($championship, $completedRound) {
            // Update standings for completed round
            $this->updateStandingsForRound($championship, $completedRound);

            // Assign players to any placeholder matches in the next round
            // This needs to happen after standings are updated but before round progression
            $nextRound = $completedRound + 1;
            $placeholderAssignments = $this->assignPlaceholderMatchesForRound($championship, $nextRound);

            // Check if this is the final round
            $format = $championship->getFormatEnum();
            $isFinalRound = $this->isFinalRound($championship, $completedRound, $format);

            if ($isFinalRound) {
                // Complete the championship
                $this->completeChampionship($championship);

                return [
                    'championship_id' => $championship->id,
                    'action' => 'championship_completed',
                    'completed_round' => $completedRound,
                    'final_standings' => $this->getFinalStandings($championship),
                    'placeholder_assignments' => $placeholderAssignments,
                ];
            } else {
                // Generate next round matches (if not already generated during tournament generation)
                $newMatches = $this->generateNextRoundMatches($championship, $nextRound);

                // Update championship status
                $championship->update([
                    'current_round' => $nextRound,
                    'status' => ChampionshipStatusEnum::IN_PROGRESS->value
                ]);

                return [
                    'championship_id' => $championship->id,
                    'action' => 'next_round_generated',
                    'completed_round' => $completedRound,
                    'next_round' => $nextRound,
                    'new_matches_count' => count($newMatches),
                    'placeholder_assignments' => $placeholderAssignments,
                    'updated_standings' => $this->getCurrentStandings($championship)
                ];
            }
        });
    }

    /**
     * Assign players to placeholder matches for the next round based on current standings
     */
    private function assignPlaceholderMatchesForRound(Championship $championship, int $roundNumber): array
    {
        // Check if there are unassigned placeholder matches for this round
        if (!$this->placeholderService->hasUnassignedPlaceholders($championship, $roundNumber)) {
            return [
                'assigned_count' => 0,
                'matches' => [],
            ];
        }

        // Assign players based on current standings
        return $this->placeholderService->assignPlayersToPlaceholderMatches($championship, $roundNumber);
    }

    /**
     * Update standings after a round is completed
     */
    private function updateStandingsForRound(Championship $championship, int $roundNumber): void
    {
        $roundMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $roundNumber)
            ->with(['game', 'winner', 'resultType'])
            ->get();

        foreach ($roundMatches as $match) {
            $this->updateMatchStandings($match);
        }

        Log::info('Updated standings for round', [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'matches_processed' => $roundMatches->count()
        ]);
    }

    /**
     * Update standings for a specific match
     */
    private function updateMatchStandings(ChampionshipMatch $match): void
    {
        $championship = $match->championship;
        $whitePlayer = $match->whitePlayer;
        $blackPlayer = $match->blackPlayer;

        if (!$whitePlayer || !$blackPlayer) {
            return;
        }

        // Get or create standings for both players
        $whiteStanding = $this->getOrCreateStanding($championship, $whitePlayer);
        $blackStanding = $this->getOrCreateStanding($championship, $blackPlayer);

        // Update scores based on match result and winner
        $resultType = $match->getResultTypeEnum();

        if ($resultType) {
            // For completed matches, determine winner based on winner_id
            if ($resultType->value === ResultTypeEnum::COMPLETED->value) {
                if ($match->winner_id === $whitePlayer->id) {
                    $whiteStanding->increment('points', 1);
                    $blackStanding->increment('points', 0);
                } elseif ($match->winner_id === $blackPlayer->id) {
                    $whiteStanding->increment('points', 0);
                    $blackStanding->increment('points', 1);
                } else {
                    // No winner recorded, give both players 0 points
                    $whiteStanding->increment('points', 0);
                    $blackStanding->increment('points', 0);
                }
            }
            // Handle forfeits and other result types
            else {
                switch ($resultType->value) {
                    case ResultTypeEnum::FORFEIT_PLAYER1->value:
                        $whiteStanding->increment('points', 0);
                        $blackStanding->increment('points', 1);
                        break;

                    case ResultTypeEnum::FORFEIT_PLAYER2->value:
                        $whiteStanding->increment('points', 1);
                        $blackStanding->increment('points', 0);
                        break;

                    case ResultTypeEnum::DOUBLE_FORFEIT->value:
                        $whiteStanding->increment('points', 0);
                        $blackStanding->increment('points', 0);
                        break;

                    case ResultTypeEnum::DRAW->value:
                        $whiteStanding->increment('points', 0.5);
                        $blackStanding->increment('points', 0.5);
                        break;

                    case ResultTypeEnum::BYE->value:
                        // Byes only affect one player
                        if ($match->winner_id === $whitePlayer->id) {
                            $whiteStanding->increment('points', 1);
                        } else {
                            $blackStanding->increment('points', 1);
                        }
                        break;
                }
            }

            // Update additional stats
            $whiteStanding->increment('matches_played');
            $blackStanding->increment('matches_played');
        }
    }

    /**
     * Get or create standing record for a player
     */
    private function getOrCreateStanding(Championship $championship, User $player): ChampionshipStanding
    {
        $standing = ChampionshipStanding::where('championship_id', $championship->id)
            ->where('user_id', $player->id)
            ->first();

        if (!$standing) {
            $standing = ChampionshipStanding::create([
                'championship_id' => $championship->id,
                'user_id' => $player->id,
                'score' => 0,
                'games_played' => 0,
                'tie_break_points' => 0,
                'position' => 0,
            ]);
        }

        return $standing;
    }

    /**
     * Update tie-break points based on opponent performance
     */
    // updateTieBreakPoints function removed - tie_break_points column doesn't exist
    // Tie-breaks are handled by buchholz_score and sonneborn_berger columns

    /**
     * Check if this is the final round based on championship format
     */
    private function isFinalRound(Championship $championship, int $currentRound, FormatEnum $format): bool
    {
        if ($format->isSwiss()) {
            return $currentRound >= ($championship->swiss_rounds ?? $championship->total_rounds);
        } elseif ($format->isElimination()) {
            return $this->hasEliminationWinner($championship);
        } else {
            // Hybrid format: check if we're in elimination phase
            return $currentRound > ($championship->swiss_rounds ?? 0) && $this->hasEliminationWinner($championship);
        }
    }

    /**
     * Check if elimination phase has a winner
     */
    private function hasEliminationWinner(Championship $championship): bool
    {
        $finalRound = ChampionshipMatch::where('championship_id', $championship->id)
            ->orderBy('round_number', 'desc')
            ->first();

        if (!$finalRound) {
            return false;
        }

        $finalMatch = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $finalRound->round_number)
            ->where('status_id', MatchStatusEnum::COMPLETED->getId())
            ->first();

        return $finalMatch && $finalMatch->winner_id !== null;
    }

    /**
     * Complete the championship and determine final results
     */
    private function completeChampionship(Championship $championship): void
    {
        // Update final positions
        $this->updateFinalPositions($championship);

        // Update championship status
        $championship->update([
            'status' => ChampionshipStatusEnum::COMPLETED->value,
            'completed_at' => now()
        ]);

        Log::info('Championship completed', [
            'championship_id' => $championship->id,
            'winner' => $this->getChampionshipWinner($championship)?->id
        ]);
    }

    /**
     * Update final positions based on standings
     */
    private function updateFinalPositions(Championship $championship): void
    {
        $standings = ChampionshipStanding::where('championship_id', $championship->id)
            ->orderBy('points', 'desc')
            ->orderBy('tie_break_points', 'desc')
            ->get();

        foreach ($standings as $index => $standing) {
            $standing->update(['position' => $index + 1]);
        }
    }

    /**
     * Get the championship winner
     */
    private function getChampionshipWinner(Championship $championship): ?User
    {
        $topStanding = ChampionshipStanding::where('championship_id', $championship->id)
            ->orderBy('points', 'desc')
            ->orderBy('tie_break_points', 'desc')
            ->first();

        return $topStanding?->user;
    }

    /**
     * Generate matches for the next round
     */
    private function generateNextRoundMatches(Championship $championship, int $nextRound): array
    {
        $format = $championship->getFormatEnum();

        if ($format->isSwiss() || ($format->isHybrid() && $nextRound <= ($championship->swiss_rounds ?? 0))) {
            return $this->generateSwissPairings($championship, $nextRound);
        } else {
            return $this->generateEliminationPairings($championship, $nextRound);
        }
    }

    /**
     * Generate Swiss pairings for next round
     */
    private function generateSwissPairings(Championship $championship, int $roundNumber): array
    {
        // For now, return empty array - the pairing services would be called here
        // In a full implementation, you would call the existing SwissPairingService
        Log::info('Swiss pairings requested', [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber
        ]);
        return [];
    }

    /**
     * Generate elimination bracket pairings
     */
    private function generateEliminationPairings(Championship $championship, int $roundNumber): array
    {
        // For now, return empty array - the pairing services would be called here
        // In a full implementation, you would call the existing EliminationPairingService
        Log::info('Elimination pairings requested', [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber
        ]);
        return [];
    }

    /**
     * Get current standings
     */
    public function getCurrentStandings(Championship $championship): array
    {
        return ChampionshipStanding::where('championship_id', $championship->id)
            ->with('user')
            ->orderBy('points', 'desc')
            ->orderBy('tie_break_points', 'desc')
            ->get()
            ->map(function ($standing) {
                return [
                    'position' => $standing->position,
                    'user_id' => $standing->user_id,
                    'username' => $standing->user->username,
                    'score' => $standing->score,
                    'games_played' => $standing->games_played,
                    'tie_break_points' => $standing->tie_break_points,
                ];
            })
            ->toArray();
    }

    /**
     * Get final standings
     */
    private function getFinalStandings(Championship $championship): array
    {
        return $this->getCurrentStandings($championship);
    }

    /**
     * Manually trigger round progression for a championship
     */
    public function forceRoundProgression(Championship $championship): ?array
    {
        $currentRound = $this->getCurrentRound($championship);

        if (!$currentRound) {
            throw new \Exception('No active round found for championship');
        }

        return $this->progressToNextRound($championship, $currentRound);
    }

    /**
     * Get round completion status
     */
    public function getRoundStatus(Championship $championship): array
    {
        $currentRound = $this->getCurrentRound($championship);

        if (!$currentRound) {
            return [
                'current_round' => null,
                'is_complete' => true,
                'total_matches' => 0,
                'completed_matches' => 0,
                'remaining_matches' => 0
            ];
        }

        $totalMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $currentRound)
            ->count();

        $completedMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $currentRound)
            ->where('status_id', MatchStatusEnum::COMPLETED->getId())
            ->count();

        return [
            'current_round' => $currentRound,
            'is_complete' => $totalMatches === $completedMatches,
            'total_matches' => $totalMatches,
            'completed_matches' => $completedMatches,
            'remaining_matches' => $totalMatches - $completedMatches
        ];
    }

    /**
     * Validate top-3 pairwise coverage for a championship
     *
     * Called during round progression to ensure top players have played each other
     */
    public function validateTop3Coverage(Championship $championship): array
    {
        $coverage = [
            'valid' => true,
            'warnings' => [],
            'top3_pairs_found' => [],
            'missing_pairs' => [],
            'coverage_percentage' => 0,
        ];

        try {
            // Get current standings
            $standings = $championship->standings()
                ->with('user')
                ->orderByDesc('points')
                ->orderByDesc('buchholz_score')
                ->limit(3)
                ->get();

            if ($standings->count() < 3) {
                $coverage['warnings'][] = 'Fewer than 3 players with standings found for coverage validation';
                return $coverage;
            }

            // Get all completed matches up to current round (excluding final rounds)
            $currentRound = $this->getCurrentRound($championship) ?: 0;

            $matches = $championship->matches()
                ->where('round_number', '<=', $currentRound)
                ->where('is_placeholder', false)
                ->whereNotIn('status_id', [MatchStatusEnum::PENDING->getId(), MatchStatusEnum::CANCELLED->getId()])
                ->with(['player1', 'player2'])
                ->get();

            // Extract top 3 player IDs
            $top3PlayerIds = $standings->pluck('user_id')->toArray();

            // Generate all required pairs for top 3 (1v2, 1v3, 2v3)
            $requiredPairs = [
                [$top3PlayerIds[0], $top3PlayerIds[1]], // 1v2
                [$top3PlayerIds[0], $top3PlayerIds[2]], // 1v3
                [$top3PlayerIds[1], $top3PlayerIds[2]], // 2v3
            ];

            // Check which pairs exist in completed matches
            foreach ($requiredPairs as $pair) {
                $pairExists = $matches->contains(function ($match) use ($pair) {
                    return (
                        ($match->player1_id === $pair[0] && $match->player2_id === $pair[1]) ||
                        ($match->player1_id === $pair[1] && $match->player2_id === $pair[0])
                    );
                });

                if ($pairExists) {
                    $coverage['top3_pairs_found'][] = $pair;
                } else {
                    $coverage['missing_pairs'][] = $pair;
                    $coverage['valid'] = false;
                }
            }

            // Calculate coverage percentage
            $totalRequiredPairs = count($requiredPairs);
            $foundPairs = count($coverage['top3_pairs_found']);
            $coverage['coverage_percentage'] = round(($foundPairs / $totalRequiredPairs) * 100, 1);

            // Add warnings for missing coverage
            if (!$coverage['valid']) {
                $coverage['warnings'][] = 'Missing top-3 pairwise coverage. Some top players have not played each other.';

                // Add specific missing pair information
                foreach ($coverage['missing_pairs'] as $missingPair) {
                    $player1 = $standings->where('user_id', $missingPair[0])->first();
                    $player2 = $standings->where('user_id', $missingPair[1])->first();

                    if ($player1 && $player2) {
                        $coverage['warnings'][] = sprintf(
                            'Missing match: %s (Rank 1) vs %s (Rank 2)',
                            $player1->user->username ?? 'Player ' . $player1->user_id,
                            $player2->user->username ?? 'Player ' . $player2->user_id
                        );
                    }
                }
            }

            // Log coverage validation results
            Log::info('Top-3 coverage validation completed', [
                'championship_id' => $championship->id,
                'current_round' => $currentRound,
                'coverage_valid' => $coverage['valid'],
                'coverage_percentage' => $coverage['coverage_percentage'],
                'pairs_found' => count($coverage['top3_pairs_found']),
                'pairs_missing' => count($coverage['missing_pairs']),
            ]);

            // If coverage is incomplete, check if there are placeholder matches that could be assigned
            if (!$coverage['valid'] && $currentRound < ($championship->total_rounds ?? 10)) {
                $nextRounds = range($currentRound + 1, min($currentRound + 2, $championship->total_rounds ?? 10));
                $hasPlaceholderPotential = false;

                foreach ($nextRounds as $round) {
                    if ($this->placeholderService->hasUnassignedPlaceholders($championship, $round)) {
                        $hasPlaceholderPotential = true;
                        $coverage['warnings'][] = "Round {$round} has unassigned placeholder matches that could provide missing coverage.";
                        break;
                    }
                }

                if (!$hasPlaceholderPotential) {
                    $coverage['warnings'][] = 'No remaining placeholder matches available to provide missing top-3 coverage.';
                }
            }

        } catch (\Exception $e) {
            Log::error('Error validating top-3 coverage', [
                'championship_id' => $championship->id,
                'error' => $e->getMessage(),
            ]);

            $coverage['valid'] = false;
            $coverage['warnings'][] = 'Error occurred during coverage validation: ' . $e->getMessage();
        }

        return $coverage;
    }

    /**
     * Enhanced round progression with top-3 coverage validation
     *
     * Extends the existing progressToNextRound method with coverage checks
     */
    public function progressToNextRoundWithCoverageValidation(Championship $championship, int $completedRound): array
    {
        // First, perform standard round progression
        $result = $this->progressToNextRound($championship, $completedRound);

        // Then validate top-3 coverage for tournaments that are not completed
        if ($result['action'] !== 'championship_completed') {
            $coverageValidation = $this->validateTop3Coverage($championship);
            $result['coverage_validation'] = $coverageValidation;

            // If coverage validation failed and this is getting close to finals, add a warning
            if (!$coverageValidation['valid'] && $completedRound >= ($championship->total_rounds - 3)) {
                $result['coverage_warning'] = 'Tournament is approaching finals with incomplete top-3 coverage.';
                Log::warning('Incomplete top-3 coverage near tournament end', [
                    'championship_id' => $championship->id,
                    'completed_round' => $completedRound,
                    'total_rounds' => $championship->total_rounds,
                    'coverage_percentage' => $coverageValidation['coverage_percentage'],
                ]);
            }
        }

        return $result;
    }
}