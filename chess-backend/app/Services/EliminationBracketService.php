<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\Enums\ChampionshipRoundType;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Exception;

class EliminationBracketService
{
    /**
     * Generate elimination bracket
     */
    public function generateBracket(Championship $championship): Collection
    {
        $participants = $this->getEligibleParticipants($championship);
        $seeding = $this->generateSeeding($participants, $championship);

        $rounds = $this->calculateRounds($participants->count());
        $bracket = $this->createBracketStructure($seeding, $rounds, $championship);

        return $bracket;
    }

    /**
     * Generate bracket for a specific round
     */
    public function generateBracketRound(Championship $championship, int $roundNumber): Collection
    {
        if ($roundNumber === 1) {
            return $this->generateFirstRound($championship);
        } else {
            return $this->generateSubsequentRound($championship, $roundNumber);
        }
    }

    /**
     * Generate elimination pairings
     */
    public function generateEliminationPairings(Championship $championship, int $roundNumber): array
    {
        if ($roundNumber === 1) {
            return $this->generateFirstRoundPairings($championship);
        } else {
            return $this->generateSubsequentRoundPairings($championship, $roundNumber);
        }
    }

    /**
     * Get eligible participants for elimination
     */
    private function getEligibleParticipants(Championship $championship): Collection
    {
        if ($championship->getFormatEnum()->isHybrid()) {
            // For hybrid format, get top qualifiers from Swiss stage
            return $this->getSwissQualifiers($championship);
        } else {
            // For pure elimination, get all paid participants
            return $championship->participants()
                ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
                ->where('dropped', false)
                ->with('user')
                ->get();
        }
    }

    /**
     * Get top qualifiers from Swiss stage
     */
    private function getSwissQualifiers(Championship $championship): Collection
    {
        $topQualifiers = $championship->top_qualifiers;

        return $championship->standings()
            ->with('user')
            ->orderBy('score', 'desc')
            ->orderBy('buchholz', 'desc')
            ->orderBy('sonneborn_berger', 'desc')
            ->limit($topQualifiers)
            ->get()
            ->map(function ($standing) {
                return (object)[
                    'user_id' => $standing->user_id,
                    'user' => $standing->user,
                    'seed' => $standing->rank ?? 1,
                ];
            });
    }

    /**
     * Generate seeding for participants
     */
    private function generateSeeding(Collection $participants, Championship $championship): array
    {
        // Sort by rating for seeding
        $sorted = $participants->sortByDesc(function ($participant) {
            return $participant->user->rating ?? 1200;
        })->values();

        // For hybrid format, use Swiss standings for seeding
        if ($championship->getFormatEnum()->isHybrid()) {
            $sorted = $participants->sortBy(function ($participant) {
                $standing = $championship->standings()
                    ->where('user_id', $participant->user_id)
                    ->first();

                return [
                    -($standing->score ?? 0),           // Negative for descending
                    -($standing->buchholz ?? 0),
                    -($standing->sonneborn_berger ?? 0),
                ];
            })->values();
        }

        $seeding = [];
        foreach ($sorted as $index => $participant) {
            $seeding[] = [
                'user_id' => $participant->user_id,
                'user' => $participant->user,
                'seed' => $index + 1,
            ];
        }

        return $seeding;
    }

    /**
     * Calculate number of rounds needed
     */
    private function calculateRounds(int $participantCount): int
    {
        // Find next power of 2
        $nextPowerOf2 = 1;
        while ($nextPowerOf2 < $participantCount) {
            $nextPowerOf2 *= 2;
        }

        return log2($nextPowerOf2);
    }

    /**
     * Create bracket structure
     */
    private function createBracketStructure(array $seeding, int $rounds, Championship $championship): Collection
    {
        $bracket = collect();
        $participantCount = count($seeding);

        // Add byes if needed
        $nextPowerOf2 = 1;
        while ($nextPowerOf2 < $participantCount) {
            $nextPowerOf2 *= 2;
        }

        $byeCount = $nextPowerOf2 - $participantCount;
        if ($byeCount > 0) {
            $seeding = $this->addByes($seeding, $byeCount);
        }

        // Generate bracket using standard tournament seeding
        for ($round = 1; $round <= $rounds; $round++) {
            $roundMatches = $this->generateRoundMatchups($seeding, $round, $rounds);
            $bracket->put($round, $roundMatches);
        }

        return $bracket;
    }

    /**
     * Add byes to seeding
     */
    private function addByes(array $seeding, int $byeCount): array
    {
        // Add byes at the end (they will be matched against top seeds)
        for ($i = 0; $i < $byeCount; $i++) {
            $seeding[] = [
                'user_id' => null, // Bye
                'user' => null,
                'seed' => 'bye',
                'is_bye' => true,
            ];
        }

        return $seeding;
    }

    /**
     * Generate matchups for a specific round
     */
    private function generateRoundMatchups(array $seeding, int $currentRound, int $totalRounds): array
    {
        $matchesInRound = pow(2, $totalRounds - $currentRound);
        $matchups = [];

        for ($i = 0; $i < $matchesInRound; $i++) {
            $seed1 = $this->getSeedForMatch($seeding, $i, $currentRound, $totalRounds, true);
            $seed2 = $this->getSeedForMatch($seeding, $i, $currentRound, $totalRounds, false);

            $matchups[] = [
                'match_number' => $i + 1,
                'seed1' => $seed1,
                'seed2' => $seed2,
                'round' => $currentRound,
            ];
        }

        return $matchups;
    }

    /**
     * Get seed for a specific match position
     */
    private function getSeedForMatch(array $seeding, int $matchIndex, int $currentRound, int $totalRounds, bool $isFirstSeed): int
    {
        $participantsCount = count($seeding);
        $roundSize = pow(2, $totalRounds - $currentRound + 1);

        $position = $matchIndex * 2 + ($isFirstSeed ? 1 : 2);

        // This is a simplified seed calculation
        // In reality, you'd use a proper bracket seeding algorithm
        $seed = (($position - 1) % $participantsCount) + 1;

        return min($seed, $participantsCount);
    }

    /**
     * Generate first round pairings
     */
    private function generateFirstRoundPairings(Championship $championship): array
    {
        $participants = $this->getEligibleParticipants($championship);
        $seeding = $this->generateSeeding($participants, $championship);

        $pairings = [];
        $participantCount = count($seeding);

        // Handle byes
        $nextPowerOf2 = 1;
        while ($nextPowerOf2 < $participantCount) {
            $nextPowerOf2 *= 2;
        }

        $byeCount = $nextPowerOf2 - $participantCount;
        if ($byeCount > 0) {
            $seeding = $this->addByes($seeding, $byeCount);
        }

        // Pair seeds (1 vs last, 2 vs second last, etc.)
        for ($i = 0; $i < count($seeding) / 2; $i++) {
            $seed1 = $seeding[$i];
            $seed2 = $seeding[count($seeding) - 1 - $i];

            if ($seed1['is_bye']) {
                // Seed 2 gets bye
                continue;
            } elseif ($seed2['is_bye']) {
                // Seed 1 gets bye
                continue;
            }

            $pairings[] = [
                'player1_id' => $seed1['user_id'],
                'player2_id' => $seed2['user_id'],
                'round_number' => 1,
                'round_type' => ChampionshipRoundType::ELIMINATION,
                'seed1' => $seed1['seed'],
                'seed2' => $seed2['seed'],
                'scheduled_at' => now(),
                'deadline' => now()->addHours($championship->match_time_window_hours),
            ];
        }

        return $pairings;
    }

    /**
     * Generate subsequent round pairings
     */
    private function generateSubsequentRoundPairings(Championship $championship, int $roundNumber): array
    {
        $previousRoundMatches = $championship->matches()
            ->where('round_number', $roundNumber - 1)
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->where('status', ChampionshipMatchStatus::COMPLETED)
            ->get();

        if ($previousRoundMatches->count() < 2) {
            throw new \InvalidArgumentException('Not enough completed matches from previous round');
        }

        $pairings = [];
        $winners = $previousRoundMatches->map(function ($match) {
            return $match->winner_id;
        })->filter()->values();

        // Pair winners in order (first half vs second half)
        $halfSize = ceil($winners->count() / 2);

        for ($i = 0; $i < $halfSize; $i++) {
            if (isset($winners[$i]) && isset($winners[$i + $halfSize])) {
                $pairings[] = [
                    'player1_id' => $winners[$i],
                    'player2_id' => $winners[$i + $halfSize],
                    'round_number' => $roundNumber,
                    'round_type' => ChampionshipRoundType::ELIMINATION,
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                ];
            }
        }

        // Handle single winner (champion)
        if ($winners->count() === 1) {
            Log::info("Tournament winner determined", [
                'championship_id' => $championship->id,
                'winner_id' => $winners->first(),
            ]);
        }

        return $pairings;
    }

    /**
     * Generate first round
     */
    private function generateFirstRound(Championship $championship): Collection
    {
        $pairings = $this->generateFirstRoundPairings($championship);
        $matches = collect();

        DB::transaction(function () use ($championship, $pairings, $matches) {
            foreach ($pairings as $pairing) {
                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $pairing['round_number'],
                    'round_type' => $pairing['round_type'],
                    'player1_id' => $pairing['player1_id'],
                    'player2_id' => $pairing['player2_id'],
                    'scheduled_at' => $pairing['scheduled_at'],
                    'deadline' => $pairing['deadline'],
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);

                $matches->push($match);
            }
        });

        return $matches;
    }

    /**
     * Generate subsequent round
     */
    private function generateSubsequentRound(Championship $championship, int $roundNumber): Collection
    {
        $pairings = $this->generateSubsequentRoundPairings($championship, $roundNumber);
        $matches = collect();

        DB::transaction(function () use ($championship, $pairings, $matches) {
            foreach ($pairings as $pairing) {
                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $pairing['round_number'],
                    'round_type' => $pairing['round_type'],
                    'player1_id' => $pairing['player1_id'],
                    'player2_id' => $pairing['player2_id'],
                    'scheduled_at' => $pairing['scheduled_at'],
                    'deadline' => $pairing['deadline'],
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);

                $matches->push($match);
            }
        });

        return $matches;
    }

    /**
     * Get bracket visualization data
     */
    public function getBracketVisualization(Championship $championship): array
    {
        $matches = $championship->matches()
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->orderBy('round_number')
            ->orderBy('id')
            ->get()
            ->groupBy('round_number');

        $bracket = [];
        $totalRounds = $matches->keys()->max() ?? 0;

        foreach ($matches as $roundNumber => $roundMatches) {
            $roundData = [
                'round_number' => $roundNumber,
                'round_name' => $this->getRoundName($roundNumber, $totalRounds),
                'matches' => []
            ];

            foreach ($roundMatches as $match) {
                $matchData = [
                    'id' => $match->id,
                    'player1' => $match->player1,
                    'player2' => $match->player2,
                    'winner' => $match->winner,
                    'status' => $match->status,
                    'result_type' => $match->result_type,
                    'scheduled_at' => $match->scheduled_at,
                    'deadline' => $match->deadline,
                ];

                $roundData['matches'][] = $matchData;
            }

            $bracket[] = $roundData;
        }

        return $bracket;
    }

    /**
     * Get round name based on tournament stage
     */
    private function getRoundName(int $roundNumber, int $totalRounds): string
    {
        if ($roundNumber === $totalRounds) {
            return 'Final';
        } elseif ($roundNumber === $totalRounds - 1) {
            return 'Semifinal';
        } elseif ($roundNumber === $totalRounds - 2) {
            return 'Quarterfinal';
        } else {
            $participants = pow(2, $totalRounds - $roundNumber + 1);
            return "Round of {$participants}";
        }
    }

    /**
     * Determine tournament winner
     */
    public function determineWinner(Championship $championship): ?int
    {
        $finalMatch = $championship->matches()
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->orderBy('round_number', 'desc')
            ->where('status', ChampionshipMatchStatus::COMPLETED)
            ->first();

        return $finalMatch?->winner_id;
    }

    /**
     * Get final standings for elimination tournament
     */
    public function getFinalStandings(Championship $championship): Collection
    {
        $matches = $championship->matches()
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->orderBy('round_number', 'desc')
            ->get();

        $standings = collect();

        // Winner
        $winner = $this->determineWinner($championship);
        if ($winner) {
            $standings->push([
                'user_id' => $winner,
                'rank' => 1,
                'placement' => 'Champion',
            ]);
        }

        // Runner-up (lost in final)
        $finalMatch = $matches->where('round_number', $matches->max('round_number'))->first();
        if ($finalMatch && $finalMatch->winner_id) {
            $runnerUp = $finalMatch->player1_id === $finalMatch->winner_id
                ? $finalMatch->player2_id
                : $finalMatch->player1_id;

            if ($runnerUp) {
                $standings->push([
                    'user_id' => $runnerUp,
                    'rank' => 2,
                    'placement' => 'Runner-up',
                ]);
            }
        }

        // Semi-finalists
        $semiFinalMatches = $matches->where('round_number', $matches->max('round_number') - 1);
        foreach ($semiFinalMatches as $match) {
            if ($match->winner_id) {
                $loser = $match->player1_id === $match->winner_id
                    ? $match->player2_id
                    : $match->player1_id;

                if ($loser && !$standings->contains('user_id', $loser)) {
                    $standings->push([
                        'user_id' => $loser,
                        'rank' => 3, // Tied for 3rd
                        'placement' => 'Semi-finalist',
                    ]);
                }
            }
        }

        // All other participants get positions based on when they were eliminated
        $eliminatedParticipants = $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->whereNotIn('user_id', $standings->pluck('user_id'))
            ->get();

        foreach ($eliminatedParticipants as $participant) {
            $eliminationRound = $this->getEliminationRound($championship, $participant->user_id);
            $placement = $this->getPlacementForRound($eliminationRound, $matches->max('round_number'));

            $standings->push([
                'user_id' => $participant->user_id,
                'rank' => $placement['rank'],
                'placement' => $placement['name'],
            ]);
        }

        return $standings->sortBy('rank')->values();
    }

    /**
     * Get the round where a participant was eliminated
     */
    private function getEliminationRound(Championship $championship, int $userId): ?int
    {
        $lostMatch = $championship->matches()
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->where(function ($query) use ($userId) {
                $query->where('player1_id', $userId)
                      ->orWhere('player2_id', $userId);
            })
            ->where('winner_id', '!=', $userId)
            ->where('status', ChampionshipMatchStatus::COMPLETED)
            ->orderBy('round_number', 'desc')
            ->first();

        return $lostMatch?->round_number;
    }

    /**
     * Get placement name and rank for elimination round
     */
    private function getPlacementForRound(?int $eliminationRound, int $totalRounds): array
    {
        if ($eliminationRound === null) {
            return ['rank' => 999, 'name' => 'Did not participate'];
        }

        $roundsRemaining = $totalRounds - $eliminationRound;
        $position = pow(2, $roundsRemaining + 1);

        return [
            'rank' => $position,
            'name' => $this->getPlacementName($position),
        ];
    }

    /**
     * Get placement name based on position
     */
    private function getPlacementName(int $position): string
    {
        switch ($position) {
            case 1:
                return 'Champion';
            case 2:
                return 'Runner-up';
            case 3:
            case 4:
                return 'Semi-finalist';
            case 5:
            case 6:
            case 7:
            case 8:
                return 'Quarter-finalist';
            default:
                return "Top {$position}";
        }
    }

    /**
     * Validate bracket integrity
     */
    public function validateBracket(Championship $championship): array
    {
        $errors = [];
        $matches = $championship->matches()
            ->where('round_type', ChampionshipRoundType::ELIMINATION)
            ->get()
            ->groupBy('round_number');

        // Check if bracket follows proper structure
        $expectedMatches = [];
        $totalRounds = $matches->keys()->max() ?? 0;

        for ($round = 1; $round <= $totalRounds; $round++) {
            $expectedMatches[$round] = pow(2, $totalRounds - $round);
        }

        foreach ($expectedMatches as $round => $expectedCount) {
            $actualCount = $matches->get($round, collect())->count();
            if ($actualCount !== $expectedCount) {
                $errors[] = "Round {$round}: Expected {$expectedCount} matches, found {$actualCount}";
            }
        }

        // Check if all matches have valid participants
        foreach ($matches as $round => $roundMatches) {
            foreach ($roundMatches as $match) {
                if (!$match->player1_id || !$match->player2_id) {
                    $errors[] = "Match {$match->id}: Missing participants";
                }

                if ($match->player1_id === $match->player2_id) {
                    $errors[] = "Match {$match->id}: Player cannot play against themselves";
                }
            }
        }

        return $errors;
    }
}