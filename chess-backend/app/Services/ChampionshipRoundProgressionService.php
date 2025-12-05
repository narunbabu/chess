<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\ChampionshipParticipant;
use App\Models\User;
use Illuminate\Support\Collection;
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
    private SwissPairingService $swissPairingService;
    private RoundTypeDetectionService $roundTypeDetectionService;

    public function __construct(
        PlaceholderMatchAssignmentService $placeholderService,
        SwissPairingService $swissPairingService,
        RoundTypeDetectionService $roundTypeDetectionService
    ) {
        $this->placeholderService = $placeholderService;
        $this->swissPairingService = $swissPairingService;
        $this->roundTypeDetectionService = $roundTypeDetectionService;
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
        Log::info("=== CHECKING ROUND PROGRESSION ===", [
            'championship_id' => $championship->id,
            'status' => $championship->status,
        ]);

        $currentRound = $this->getCurrentRound($championship);

        if (!$currentRound) {
            Log::info("No current round found", [
                'championship_id' => $championship->id,
            ]);
            return null;
        }

        $previousRound = $currentRound - 1;
        $previousComplete = $this->isRoundComplete($championship, $previousRound);
        $currentHasUnassigned = $this->placeholderService->hasUnassignedPlaceholders($championship, $currentRound);

        Log::info("Progression analysis", [
            'championship_id' => $championship->id,
            'current_round' => $currentRound,
            'previous_round' => $previousRound,
            'previous_complete' => $previousComplete,
            'current_unassigned_placeholders' => $currentHasUnassigned,
        ]);

        // Case 1: Current round is complete - progress normally
        if ($this->isRoundComplete($championship, $currentRound)) {
            Log::info("Current round complete - progressing", [
                'championship_id' => $championship->id,
                'round' => $currentRound,
            ]);
            return $this->progressToNextRound($championship, $currentRound);
        }

        // Case 2: Previous round complete + current has unassigned placeholders - assign and "progress"
        if ($previousComplete && $currentHasUnassigned) {
            Log::info("Previous complete + current unassigned - assigning placeholders", [
                'championship_id' => $championship->id,
                'previous_round' => $previousRound,
                'current_round' => $currentRound,
            ]);

            // Update standings for previous round (if not already)
            $this->updateStandingsForRound($championship, $previousRound);

            // Assign placeholders for current round
            $assignmentResult = $this->assignPlaceholderMatchesForRound($championship, $currentRound);

            // Update championship current_round if needed
            if ($championship->current_round < $currentRound) {
                $championship->update(['current_round' => $currentRound]);
            }

            Log::info("Placeholder assignment completed", [
                'championship_id' => $championship->id,
                'assigned_count' => $assignmentResult['assigned_count'],
            ]);

            return [
                'championship_id' => $championship->id,
                'action' => 'placeholders_assigned',
                'previous_round' => $previousRound,
                'current_round' => $currentRound,
                'assignment_result' => $assignmentResult,
                'updated_standings' => $this->getCurrentStandings($championship),
            ];
        }

        Log::info("No progression triggered", [
            'championship_id' => $championship->id,
            'current_round' => $currentRound,
            'reason' => 'neither current complete nor previous+unassigned',
        ]);

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
     *
     * A round is complete when all REAL matches (non-BYE) are completed.
     * Pending BYE matches are excluded from this check and will be completed
     * automatically when all real matches finish.
     */
    public function isRoundComplete(Championship $championship, int $roundNumber): bool
    {
        $roundMatches = ChampionshipMatch::where('championship_id', $championship->id)
            ->where('round_number', $roundNumber)
            ->get();

        // Separate real matches from BYE matches
        $realMatches = $roundMatches->filter(function ($match) {
            // A match is "real" if it's not a BYE OR if it's a completed BYE
            return $match->result_type_id !== ResultTypeEnum::BYE->getId()
                || $match->status_id === MatchStatusEnum::COMPLETED->getId();
        });

        $pendingByes = $roundMatches->filter(function ($match) {
            // Find pending BYE matches that need completion
            return $match->result_type_id === ResultTypeEnum::BYE->getId()
                && $match->status_id === MatchStatusEnum::PENDING->getId();
        });

        Log::debug("🔍 [ROUND COMPLETE CHECK] Analyzing round {$roundNumber}", [
            'championship_id' => $championship->id,
            'total_matches' => $roundMatches->count(),
            'real_matches' => $realMatches->count(),
            'pending_byes' => $pendingByes->count(),
        ]);

        // Check if all real matches are completed
        $allRealMatchesComplete = $realMatches->every(function ($match) {
            return $match->status_id === MatchStatusEnum::COMPLETED->getId();
        });

        // If all real matches are complete and there are pending BYEs, complete them now
        if ($allRealMatchesComplete && $pendingByes->count() > 0) {
            $this->completePendingByes($championship, $roundNumber, $pendingByes);

            // After completing BYEs, re-check all matches
            return $this->isRoundComplete($championship, $roundNumber);
        }

        return $allRealMatchesComplete;
    }

    /**
     * Complete all pending BYE matches for a round
     *
     * Called automatically when all real matches in a round are completed.
     * This ensures BYE points are awarded at the correct time.
     */
    private function completePendingByes(Championship $championship, int $roundNumber, $pendingByes): void
    {
        $byePoints = $championship->getByePoints();

        Log::info("✅ [BYE COMPLETION] Completing pending BYE matches for round {$roundNumber}", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'bye_count' => $pendingByes->count(),
            'bye_points' => $byePoints,
        ]);

        foreach ($pendingByes as $byeMatch) {
            // Complete the match
            $byeMatch->update([
                'status_id' => MatchStatusEnum::COMPLETED->getId(),
                'winner_id' => $byeMatch->player1_id, // Player1 always wins BYE
            ]);

            // Award bye points NOW (this is the fair timing!)
            $standing = $championship->standings()
                ->where('user_id', $byeMatch->player1_id)
                ->first();

            if ($standing) {
                $standing->increment('points', $byePoints);
            } else {
                // Create standing if doesn't exist
                $championship->standings()->create([
                    'user_id' => $byeMatch->player1_id,
                    'points' => $byePoints,
                    'matches_played' => 0,
                    'wins' => 0,
                    'draws' => 0,
                    'losses' => 0,
                    'buchholz_score' => 0,
                    'sonneborn_berger' => 0,
                ]);
            }

            Log::info("🎯 [BYE AWARDED] BYE match completed and points awarded", [
                'match_id' => $byeMatch->id,
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
                'player_id' => $byeMatch->player1_id,
                'points_awarded' => $byePoints,
                'timing' => 'after_all_real_matches_complete',
                'fairness' => 'bye_points_awarded_at_correct_time',
            ]);
        }
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
                // Determine round type and generate appropriate matches
                $roundType = $this->roundTypeDetectionService->determineRoundType($championship, $nextRound);

                Log::info("Generating next round with type detection", [
                    'championship_id' => $championship->id,
                    'next_round' => $nextRound,
                    'round_type' => $roundType,
                ]);

                if ($roundType === 'swiss') {
                    // 🎯 CRITICAL FIX: Delete placeholder matches before creating new Swiss pairings
                    // Swiss rounds 2+ need dynamic pairings based on standings, not pre-generated placeholders
                    $existingMatches = $championship->matches()->where('round_number', $nextRound)->get();

                    if ($existingMatches->count() > 0) {
                        Log::info("Deleting placeholder matches before Swiss pairing generation", [
                            'championship_id' => $championship->id,
                            'round' => $nextRound,
                            'existing_matches' => $existingMatches->count(),
                        ]);

                        // Delete the placeholder matches
                        $championship->matches()->where('round_number', $nextRound)->delete();
                    }

                    // Generate Swiss pairings
                    $pairings = $this->swissPairingService->generatePairings($championship, $nextRound);
                    $newMatches = $this->swissPairingService->createMatches($championship, $pairings, $nextRound);
                } else {
                    // Generate elimination bracket
                    $eliminationConfig = $this->roundTypeDetectionService->getEliminationConfig($championship, $nextRound);
                    $newMatches = $this->generateEliminationMatches($championship, $nextRound, $eliminationConfig);
                }

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
                    'round_type' => $roundType,
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

        // 🎯 CRITICAL FIX: Check if this round is an elimination round
        // Elimination rounds should only be assigned AFTER all Swiss rounds complete
        // Swiss rounds can be assigned as soon as the previous round completes
        if ($this->isEliminationRound($championship, $roundNumber)) {
            // Check if all Swiss rounds are completed
            if (!$this->areAllSwissRoundsComplete($championship)) {
                Log::info("Skipping elimination round assignment - Swiss rounds not complete", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                ]);

                return [
                    'assigned_count' => 0,
                    'matches' => [],
                    'reason' => 'swiss_rounds_incomplete',
                ];
            }

            Log::info("All Swiss rounds complete - assigning elimination round matches", [
                'championship_id' => $championship->id,
                'round_number' => $roundNumber,
            ]);
        } else {
            // For Swiss rounds, check if the immediately previous round is complete
            $previousRound = $roundNumber - 1;
            if ($previousRound > 0) {
                $previousRoundComplete = $this->isRoundComplete($championship, $previousRound);

                if (!$previousRoundComplete) {
                    Log::info("Skipping Swiss round assignment - previous round not complete", [
                        'championship_id' => $championship->id,
                        'round_number' => $roundNumber,
                        'previous_round' => $previousRound,
                    ]);

                    return [
                        'assigned_count' => 0,
                        'matches' => [],
                        'reason' => 'previous_round_incomplete',
                    ];
                }

                Log::info("Previous round complete - assigning Swiss round matches", [
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'previous_round' => $previousRound,
                ]);
            }
        }

        // Assign players based on current standings (or Swiss algorithm for Swiss rounds)
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
     *
     * NOTE: All rounds are now pre-generated during tournament creation
     * This method exists for compatibility but should rarely be called
     */
    private function generateNextRoundMatches(Championship $championship, int $nextRound): array
    {
        Log::info("Checking if next round matches already exist", [
            'championship_id' => $championship->id,
            'next_round' => $nextRound,
        ]);

        // Check if matches already exist for this round
        $existingMatches = $championship->matches()
            ->where('round_number', $nextRound)
            ->count();

        if ($existingMatches > 0) {
            Log::info("Matches already exist for round {$nextRound}, skipping generation", [
                'championship_id' => $championship->id,
                'existing_matches' => $existingMatches,
            ]);
            return [];
        }

        // If matches don't exist, log a warning (this shouldn't happen in normal flow)
        Log::warning("No matches found for next round - tournament may not have been fully generated", [
            'championship_id' => $championship->id,
            'next_round' => $nextRound,
        ]);

        return [];
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
     * Generate elimination matches based on top standings
     */
    private function generateEliminationMatches(Championship $championship, int $roundNumber, array $config): Collection
    {
        Log::info("Generating elimination matches", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'config' => $config,
        ]);

        $participantCount = $config['participants'] ?? 4;
        $eliminationType = $config['type'] ?? 'elimination';

        // Get top participants from standings
        $topParticipants = $championship->standings()
            ->orderBy('points', 'desc')
            ->orderBy('buchholz_score', 'desc')
            ->orderBy('sonneborn_berger', 'desc')
            ->orderBy('rating', 'desc')
            ->limit($participantCount)
            ->get();

        Log::info("Top participants for elimination", [
            'participants_count' => $topParticipants->count(),
            'expected_count' => $participantCount,
            'participant_ids' => $topParticipants->pluck('user_id')->toArray(),
        ]);

        $matches = collect();

        if ($eliminationType === 'semi_final' && $participantCount === 4) {
            // Semi-finals: 1st vs 4th, 2nd vs 3rd
            $pairings = [
                [0, 3], // 1st vs 4th
                [1, 2], // 2nd vs 3rd
            ];

            foreach ($pairings as [$index1, $index2]) {
                if (isset($topParticipants[$index1]) && isset($topParticipants[$index2])) {
                    $player1 = $topParticipants[$index1];
                    $player2 = $topParticipants[$index2];

                    $match = ChampionshipMatch::create([
                        'championship_id' => $championship->id,
                        'round_number' => $roundNumber,
                        'round_type' => \App\Enums\ChampionshipRoundType::ELIMINATION,
                        'player1_id' => $player1->user_id,
                        'player2_id' => $player2->user_id,
                        'white_player_id' => $player1->user_id, // Higher seed gets white
                        'black_player_id' => $player2->user_id,
                        'color_assignment_method' => 'elimination_seeding',
                        'auto_generated' => true,
                        'scheduled_at' => now(),
                        'deadline' => now()->addHours($championship->match_time_window_hours),
                        'status' => MatchStatusEnum::PENDING,
                    ]);

                    $match->load(['whitePlayer', 'blackPlayer']);
                    $matches->push($match);
                }
            }
        } elseif ($eliminationType === 'final' && $participantCount === 2) {
            // Finals: Top 2 remaining participants
            if ($topParticipants->count() >= 2) {
                $player1 = $topParticipants[0];
                $player2 = $topParticipants[1];

                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'round_type' => \App\Enums\ChampionshipRoundType::ELIMINATION,
                    'player1_id' => $player1->user_id,
                    'player2_id' => $player2->user_id,
                    'white_player_id' => $player1->user_id, // Higher seed gets white
                    'black_player_id' => $player2->user_id,
                    'color_assignment_method' => 'elimination_seeding',
                    'auto_generated' => true,
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                    'status' => MatchStatusEnum::PENDING,
                ]);

                $match->load(['whitePlayer', 'blackPlayer']);
                $matches->push($match);
            }
        }

        Log::info("Generated elimination matches", [
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'matches_created' => $matches->count(),
        ]);

        return $matches;
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

    /**
     * Check if a round is an elimination round (Quarter Final, Semi Final, Final, etc.)
     *
     * @param Championship $championship
     * @param int $roundNumber
     * @return bool
     */
    private function isEliminationRound(Championship $championship, int $roundNumber): bool
    {
        // Use RoundTypeDetectionService for accurate determination
        $roundType = $this->roundTypeDetectionService->determineRoundType($championship, $roundNumber);
        return $roundType === 'elimination';
    }

    /**
     * Check if all Swiss rounds in the tournament are completed
     *
     * @param Championship $championship
     * @return bool
     */
    private function areAllSwissRoundsComplete(Championship $championship): bool
    {
        // Get tournament configuration
        $config = $championship->getTournamentConfig();

        if (!$config) {
            // If no config, assume Swiss rounds are complete (fallback)
            Log::warning("No tournament config found, assuming Swiss rounds complete", [
                'championship_id' => $championship->id,
            ]);
            return true;
        }

        // Find all Swiss rounds from config
        $swissRounds = [];
        foreach ($config->roundStructure as $roundConfig) {
            $roundType = $roundConfig['type'] ?? 'swiss';
            if ($roundType === 'swiss') {
                $swissRounds[] = $roundConfig['round'];
            }
        }

        if (empty($swissRounds)) {
            // No Swiss rounds configured
            return true;
        }

        // Check if all Swiss rounds have all matches completed
        foreach ($swissRounds as $swissRoundNumber) {
            $incompleteMatches = $championship->matches()
                ->where('round_number', $swissRoundNumber)
                ->where('status_id', '!=', MatchStatusEnum::COMPLETED->getId())
                ->count();

            if ($incompleteMatches > 0) {
                Log::info("Swiss round {$swissRoundNumber} has incomplete matches", [
                    'championship_id' => $championship->id,
                    'round_number' => $swissRoundNumber,
                    'incomplete_count' => $incompleteMatches,
                ]);
                return false;
            }
        }

        Log::info("All Swiss rounds are complete", [
            'championship_id' => $championship->id,
            'swiss_rounds' => $swissRounds,
        ]);

        return true;
    }
}
