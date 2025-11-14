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
     */
    public function getCurrentRound(Championship $championship): ?int
    {
        // Find the highest round number that has incomplete matches
        $latestRound = ChampionshipMatch::where('championship_id', $championship->id)
            ->whereNotIn('status_id', [MatchStatusEnum::COMPLETED->getId()])
            ->max('round_number');

        // If no incomplete rounds, get the highest round number overall
        if (!$latestRound) {
            $latestRound = ChampionshipMatch::where('championship_id', $championship->id)
                ->max('round_number');
        }

        return $latestRound ? (int) $latestRound : null;
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
        foreach ($roundMatches as $match) {
            if ($match->getStatusEnum()->value !== 'completed') {
                return false;
            }
        }

        return true;
    }

    /**
     * Progress championship to the next round
     */
    public function progressToNextRound(Championship $championship, int $completedRound): array
    {
        return DB::transaction(function () use ($championship, $completedRound) {
            // Update standings for completed round
            $this->updateStandingsForRound($championship, $completedRound);

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
                    'final_standings' => $this->getFinalStandings($championship)
                ];
            } else {
                // Generate next round matches
                $nextRound = $completedRound + 1;
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
                    'updated_standings' => $this->getCurrentStandings($championship)
                ];
            }
        });
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

        // Update scores based on match result
        $resultType = $match->getResultTypeEnum();

        if ($resultType) {
            switch ($resultType->value) {
                case ResultTypeEnum::WIN_WHITE->value:
                    $whiteStanding->increment('points', 1);
                    $blackStanding->increment('points', 0);
                    break;

                case ResultTypeEnum::WIN_BLACK->value:
                    $whiteStanding->increment('points', 0);
                    $blackStanding->increment('points', 1);
                    break;

                case ResultTypeEnum::DRAW->value:
                    $whiteStanding->increment('points', 0.5);
                    $blackStanding->increment('points', 0.5);
                    break;

                case ResultTypeEnum::FORFEIT_WHITE->value:
                    $whiteStanding->increment('points', 0);
                    $blackStanding->increment('points', 1);
                    break;

                case ResultTypeEnum::FORFEIT_BLACK->value:
                    $whiteStanding->increment('points', 1);
                    $blackStanding->increment('points', 0);
                    break;

                case ResultTypeEnum::DOUBLE_FORFEIT->value:
                    $whiteStanding->increment('points', 0);
                    $blackStanding->increment('points', 0);
                    break;
            }

            // Update additional stats
            $whiteStanding->increment('matches_played');
            $blackStanding->increment('matches_played');

            // Note: updateTieBreakPoints function removed as tie_break_points column doesn't exist
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
            ->orderBy('score', 'desc')
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
            ->orderBy('score', 'desc')
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
            ->orderBy('score', 'desc')
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
}