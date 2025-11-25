<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipStanding;
use App\Models\User;
use Illuminate\Support\Collection;
// use Illuminate\Support\Facades\Log;

/**
 * Comprehensive Tiebreak Policy Service
 *
 * Implements standard chess tournament tiebreak ordering:
 * 1. Points
 * 2. Buchholz
 * 3. Sonneborn-Berger
 * 4. Head-to-head (if exactly 2 tied)
 * 5. Rating
 * 6. Random (last resort)
 */
class TiebreakPolicyService
{
    /**
     * Tiebreak criteria in order of priority
     */
    private const TIEBREAK_ORDER = [
        'points',
        'buchholz_score',
        'sonneborn_berger',
        'head_to_head',
        'rating',
        'random'
    ];

    /**
     * Resolve ties and select top K participants from standings
     *
     * @param Collection $standings - Championship standings collection
     * @param int $K - Number of participants to select
     * @param array $options - Additional options for tie resolution
     * @return Collection - Top K participants with ties resolved
     */
    public function selectTopK(Collection $standings, int $K, array $options = []): Collection
    {
        $expandBandForTies = $options['expand_band_for_ties'] ?? false;
        $playoffForFirstPlace = $options['playoff_for_first_place'] ?? false;

        // Apply comprehensive tiebreak ordering
        $sortedStandings = $this->applyTiebreakOrdering($standings);

        if (!$expandBandForTies) {
            // Simple selection: take first K after sorting
            return $sortedStandings->take($K);
        }

        // Expand band for ties: include all tied at cutoff
        return $this->expandBandForTies($sortedStandings, $K);
    }

    /**
     * Apply complete tiebreak ordering to standings
     */
    public function applyTiebreakOrdering(Collection $standings): Collection
    {
        return $standings->sortByDesc(function ($standing) {
            return $this->calculateTiebreakScore($standing);
        })->values();
    }

    /**
     * Calculate composite tiebreak score for sorting
     */
    private function calculateTiebreakScore(ChampionshipStanding $standing): array
    {
        // Load relationships if not already loaded
        if (!$standing->relationLoaded('user')) {
            $standing->load('user');
        }

        return [
            'points' => $standing->points,
            'buchholz_score' => $standing->buchholz_score ?? 0,
            'sonneborn_berger' => $standing->sonneborn_berger ?? 0,
            'head_to_head' => $this->calculateHeadToHeadAdvantage($standing),
            'rating' => $standing->user->rating ?? 1200,
            'random' => $this->getStableRandom($standing->id),
        ];
    }

    /**
     * Calculate head-to-head advantage between tied players
     * Only applied when exactly 2 players are tied on all previous criteria
     */
    private function calculateHeadToHeadAdvantage(ChampionshipStanding $standing): float
    {
        // This would need tournament context to calculate properly
        // For now, return 0 - this is calculated in group contexts
        return 0;
    }

    /**
     * Get stable random value for consistent tiebreaking
     */
    private function getStableRandom(int $id): float
    {
        // Use deterministic random based on ID for consistency
        return fmod(sin($id) * 10000, 1);
    }

    /**
     * Expand band to include all participants tied at cutoff position
     */
    private function expandBandForTies(Collection $sortedStandings, int $K): Collection
    {
        if ($sortedStandings->count() <= $K) {
            return $sortedStandings;
        }

        $cutOffStanding = $sortedStandings->get($K - 1);
        $cutOffScore = $this->getComparisonScore($cutOffStanding);

        // Find all participants with the same score as cutoff
        $expandedGroup = $sortedStandings->takeWhile(function ($standing) use ($cutOffScore) {
            return $this->getComparisonScore($standing) >= $cutOffScore;
        });

        // Log::info("Expanded band for ties", [
        //     'requested_K' => $K,
        //     'actual_selected' => $expandedGroup->count(),
        //     'cutoff_score' => $cutOffScore
        // ]);

        return $expandedGroup;
    }

    /**
     * Get score for comparison at cutoff point
     */
    private function getComparisonScore(ChampionshipStanding $standing): float
    {
        // Use primary criteria (points) for cutoff comparison
        return $standing->points;
    }

    /**
     * Resolve ties within a specific group using complete tiebreak criteria
     */
    public function resolveTiesInGroup(Collection $tiedStandings, Championship $championship): Collection
    {
        if ($tiedStandings->count() <= 1) {
            return $tiedStandings;
        }

        // Log::info("Resolving ties in group", [
        //     'championship_id' => $championship->id,
        //     'tied_players' => $tiedStandings->count(),
        //     'points' => $tiedStandings->first()->points
        // ]);

        // Calculate head-to-head results for the tied group
        $headToHeadResults = $this->calculateGroupHeadToHead($tiedStandings, $championship);

        // Apply full tiebreak ordering including head-to-head
        return $tiedStandings->sortByDesc(function ($standing) use ($headToHeadResults) {
            $userId = $standing->user_id;

            return [
                'points' => $standing->points,
                'buchholz_score' => $standing->buchholz_score ?? 0,
                'sonneborn_berger' => $standing->sonneborn_berger ?? 0,
                'head_to_head' => $headToHeadResults[$userId] ?? 0,
                'rating' => $standing->user->rating ?? 1200,
                'random' => $this->getStableRandom($userId),
            ];
        })->values();
    }

    /**
     * Calculate head-to-head results among tied players
     */
    private function calculateGroupHeadToHead(Collection $tiedStandings, Championship $championship): array
    {
        $tiedUserIds = $tiedStandings->pluck('user_id')->toArray();
        $headToHead = [];

        foreach ($tiedUserIds as $userId) {
            $headToHead[$userId] = 0;
        }

        // Get matches between tied players
        $matches = $championship->matches()
            ->completed()
            ->where(function ($query) use ($tiedUserIds) {
                $query->whereIn('player1_id', $tiedUserIds)
                      ->whereIn('player2_id', $tiedUserIds);
            })
            ->get();

        // Calculate head-to-head scores
        foreach ($matches as $match) {
            $player1Id = $match->player1_id;
            $player2Id = $match->player2_id;

            // Only count if both players are in the tied group
            if (in_array($player1Id, $tiedUserIds) && in_array($player2Id, $tiedUserIds)) {
                if ($match->winner_id === $player1Id) {
                    $headToHead[$player1Id] += 1;
                    $headToHead[$player2Id] -= 1;
                } elseif ($match->winner_id === $player2Id) {
                    $headToHead[$player2Id] += 1;
                    $headToHead[$player1Id] -= 1;
                }
                // Draw: no change in head-to-head score
            }
        }

        return $headToHead;
    }

    /**
     * Get tournament standings with tiebreak resolution applied
     */
    public function getResolvedStandings(Championship $championship): Collection
    {
        $standings = $championship->standings()
            ->with('user')
            ->orderBy('rank')
            ->get();

        if ($standings->isEmpty()) {
            return $standings;
        }

        // Group by points and Buchholz to find tied groups
        $tiedGroups = $this->identifyTiedGroups($standings);

        $resolvedStandings = collect();
        $currentRank = 1;

        foreach ($tiedGroups as $group) {
            if ($group->count() === 1) {
                $standing = $group->first();
                $standing->rank = $currentRank;
                $resolvedStandings->push($standing);
                $currentRank++;
            } else {
                // Resolve ties in this group
                $resolvedGroup = $this->resolveTiesInGroup($group, $championship);

                foreach ($resolvedGroup as $index => $standing) {
                    $standing->rank = $currentRank + $index;
                    $resolvedStandings->push($standing);
                }
                $currentRank += $group->count();
            }
        }

        return $resolvedStandings;
    }

    /**
     * Identify groups of tied players based on primary criteria
     */
    private function identifyTiedGroups(Collection $standings): Collection
    {
        $groups = collect();
        $currentGroup = collect();

        foreach ($standings as $standing) {
            if ($currentGroup->isEmpty()) {
                $currentGroup->push($standing);
            } else {
                $lastStanding = $currentGroup->last();
                if ($this->arePrimaryTied($lastStanding, $standing)) {
                    $currentGroup->push($standing);
                } else {
                    $groups->push($currentGroup);
                    $currentGroup = collect([$standing]);
                }
            }
        }

        if ($currentGroup->isNotEmpty()) {
            $groups->push($currentGroup);
        }

        return $groups;
    }

    /**
     * Check if two players are tied on primary criteria
     */
    private function arePrimaryTied(ChampionshipStanding $standing1, ChampionshipStanding $standing2): bool
    {
        return $standing1->points === $standing2->points &&
               $standing1->buchholz_score === $standing2->buchholz_score &&
               $standing1->sonneborn_berger === $standing2->sonneborn_berger;
    }

    /**
     * Get tiebreak explanation for a specific player
     */
    public function getTiebreakExplanation(ChampionshipStanding $standing, Championship $championship): array
    {
        $explanation = [];

        $explanation[] = [
            'criteria' => 'Points',
            'value' => $standing->points,
            'description' => 'Tournament score (1 point for win, 0.5 for draw)'
        ];

        $explanation[] = [
            'criteria' => 'Buchholz',
            'value' => $standing->buchholz_score ?? 0,
            'description' => 'Sum of opponents\' scores'
        ];

        $explanation[] = [
            'criteria' => 'Sonneborn-Berger',
            'value' => $standing->sonneborn_berger ?? 0,
            'description' => 'Sum of defeated opponents\' scores + half of drawn opponents\' scores'
        ];

        // Calculate head-to-head if applicable
        $headToHead = $this->calculateHeadToHeadAgainstTied($standing, $championship);
        if ($headToHead['count'] > 0) {
            $explanation[] = [
                'criteria' => 'Head-to-Head',
                'value' => $headToHead['score'],
                'description' => "Results against tied players ({$headToHead['wins']}W-{$headToHead['draws']}D-{$headToHead['losses']}L)"
            ];
        }

        $explanation[] = [
            'criteria' => 'Rating',
            'value' => $standing->user->rating ?? 1200,
            'description' => 'Pre-tournament rating'
        ];

        return $explanation;
    }

    /**
     * Calculate head-to-head record against tied players
     */
    private function calculateHeadToHeadAgainstTied(ChampionshipStanding $standing, Championship $championship): array
    {
        // Find players tied on points, Buchholz, and Sonneborn-Berger
        $tiedPlayers = $championship->standings()
            ->where('id', '!=', $standing->id)
            ->where('points', $standing->points)
            ->where('buchholz_score', $standing->buchholz_score ?? 0)
            ->where('sonneborn_berger', $standing->sonneborn_berger ?? 0)
            ->pluck('user_id')
            ->toArray();

        if (empty($tiedPlayers)) {
            return ['count' => 0, 'score' => 0, 'wins' => 0, 'draws' => 0, 'losses' => 0];
        }

        $matches = $championship->matches()
            ->completed()
            ->where('player1_id', $standing->user_id)
            ->whereIn('player2_id', $tiedPlayers)
            ->orWhere(function ($query) use ($standing, $tiedPlayers) {
                $query->where('player2_id', $standing->user_id)
                      ->whereIn('player1_id', $tiedPlayers);
            })
            ->get();

        $wins = $draws = $losses = 0;
        foreach ($matches as $match) {
            if ($match->winner_id === $standing->user_id) {
                $wins++;
            } elseif ($match->winner_id === null) {
                $draws++;
            } else {
                $losses++;
            }
        }

        return [
            'count' => count($tiedPlayers),
            'score' => $wins - $losses,
            'wins' => $wins,
            'draws' => $draws,
            'losses' => $losses
        ];
    }
}