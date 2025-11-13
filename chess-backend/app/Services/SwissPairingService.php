<?php

namespace App\Services;

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipStanding;
use App\Models\User;
use App\Enums\ChampionshipMatchStatus;
use App\Enums\ChampionshipResultType;
use App\Enums\ChampionshipRoundType;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SwissPairingService
{
    /**
     * Generate pairings for a Swiss round
     */
    public function generatePairings(Championship $championship, int $roundNumber): array
    {
        // Validate championship format
        if (!$championship->getFormatEnum()->isSwiss()) {
            throw new \InvalidArgumentException('Championship format does not support Swiss pairings');
        }

        // Get eligible participants
        $participants = $this->getEligibleParticipants($championship);

        if ($participants->count() < 2) {
            throw new \InvalidArgumentException('Not enough participants for pairings');
        }

        // Sort participants by score (descending) and tiebreakers
        $sortedParticipants = $this->sortParticipantsByScore($championship, $participants);

        // Generate pairings using Dutch algorithm (FIDE standard)
        $pairings = $this->dutchAlgorithm($championship, $sortedParticipants, $roundNumber);

        return $pairings;
    }

    /**
     * Create matches from pairings
     */
    public function createMatches(Championship $championship, array $pairings, int $roundNumber): Collection
    {
        $matches = collect();

        DB::transaction(function () use ($championship, $pairings, $roundNumber, $matches) {
            foreach ($pairings as $pairing) {
                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'round_type' => ChampionshipRoundType::SWISS,
                    'player1_id' => $pairing['player1_id'],
                    'player2_id' => $pairing['player2_id'],
                    'scheduled_at' => $pairing['scheduled_at'] ?? now(),
                    'deadline' => $pairing['deadline'] ?? now()->addHours($championship->match_time_window_hours),
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);

                $matches->push($match);
                Log::info("Created Swiss pairing match", [
                    'championship_id' => $championship->id,
                    'round' => $roundNumber,
                    'player1_id' => $pairing['player1_id'],
                    'player2_id' => $pairing['player2_id'],
                    'match_id' => $match->id,
                ]);
            }
        });

        return $matches;
    }

    /**
     * Get participants eligible for pairing (paid and not dropped)
     */
    private function getEligibleParticipants(Championship $championship): Collection
    {
        return $championship->participants()
            ->where('payment_status_id', \App\Enums\PaymentStatus::COMPLETED->getId())
            ->where('dropped', false)
            ->with('user')
            ->get();
    }

    /**
     * Sort participants by score and tiebreakers
     */
    private function sortParticipantsByScore(Championship $championship, Collection $participants): Collection
    {
        return $participants->sortByDesc(function ($participant) use ($championship) {
            $standing = $championship->standings()
                ->where('user_id', $participant->user_id)
                ->first();

            $score = $standing?->score ?? 0;
            $buchholz = $standing?->buchholz ?? 0;
            $sonnebornBerger = $standing?->sonneborn_berger ?? 0;
            $tRating = $standing?->t_rating ?? 0;

            // Sort by: 1) Score, 2) Buchholz, 3) Sonneborn-Berger, 4) Tournament rating
            return [
                $score,
                $buchholz,
                $sonnebornBerger,
                $tRating
            ];
        })->values();
    }

    /**
     * Dutch pairing algorithm (FIDE standard)
     */
    private function dutchAlgorithm(Championship $championship, Collection $participants, int $roundNumber): array
    {
        $pairings = [];
        $unpaired = $participants->collect();

        // Group participants by score
        $scoreGroups = $this->createScoreGroups($championship, $unpaired);

        foreach ($scoreGroups as $score => $group) {
            $pairs = $this->pairScoreGroup($championship, $group, $roundNumber);
            $pairings = array_merge($pairings, $pairs);
        }

        // Handle odd participant (bye)
        if ($unpaired->count() === 1) {
            $byeParticipant = $unpaired->first();
            $this->handleBye($championship, $byeParticipant, $roundNumber);
            Log::info("Assigned bye to participant", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'user_id' => $byeParticipant->user_id,
            ]);
        }

        return $pairings;
    }

    /**
     * Create score groups for Dutch algorithm
     */
    private function createScoreGroups(Championship $championship, Collection $participants): array
    {
        $groups = [];

        foreach ($participants as $participant) {
            $standing = $championship->standings()
                ->where('user_id', $participant->user_id)
                ->first();

            $score = $standing?->score ?? 0;
            $groups[$score][] = $participant;
        }

        // Sort groups by score (descending)
        krsort($groups);

        return $groups;
    }

    /**
     * Pair participants within a score group
     */
    private function pairScoreGroup(Championship $championship, array $group, int $roundNumber): array
    {
        $pairings = [];
        $group = collect($group);

        // Sort by float (who had white/black more) for color balance
        $sortedGroup = $this->balanceColors($championship, $group);

        // Pair participants
        for ($i = 0; $i < $sortedGroup->count() - 1; $i += 2) {
            $player1 = $sortedGroup[$i];
            $player2 = $sortedGroup[$i + 1];

            // Check if they have already played
            if ($this->haveAlreadyPlayed($championship, $player1->user_id, $player2->user_id)) {
                // Try to find alternative pairing
                $alternativePairing = $this->findAlternativePairing($championship, $sortedGroup, $i, $roundNumber);
                if ($alternativePairing) {
                    $pairings[] = $alternativePairing;
                } else {
                    // Cross-score group pairing needed
                    $crossPairing = $this->crossScoreGroupPairing($championship, $player1, $roundNumber);
                    if ($crossPairing) {
                        $pairings[] = $crossPairing;
                    }
                }
            } else {
                // Determine colors based on balance
                $colors = $this->assignColors($championship, $player1->user_id, $player2->user_id);

                $pairings[] = [
                    'player1_id' => $colors['white'],
                    'player2_id' => $colors['black'],
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                ];
            }
        }

        return $pairings;
    }

    /**
     * Balance colors to ensure equal white/black games
     */
    private function balanceColors(Championship $championship, Collection $group): Collection
    {
        return $group->sortBy(function ($participant) use ($championship) {
            $colorBalance = $this->getColorBalance($championship, $participant->user_id);

            // Participants with more black games should get white
            return $colorBalance['black'] - $colorBalance['white'];
        })->values();
    }

    /**
     * Get color balance for a participant
     */
    private function getColorBalance(Championship $championship, int $userId): array
    {
        $completedMatches = $championship->matches()
            ->completed()
            ->where(function ($query) use ($userId) {
                $query->where('player1_id', $userId)
                      ->orWhere('player2_id', $userId);
            })
            ->get();

        $white = $completedMatches->where('player1_id', $userId)->count();
        $black = $completedMatches->where('player2_id', $userId)->count();

        return ['white' => $white, 'black' => $black];
    }

    /**
     * Assign colors to players
     */
    private function assignColors(Championship $championship, int $userId1, int $userId2): array
    {
        $balance1 = $this->getColorBalance($championship, $userId1);
        $balance2 = $this->getColorBalance($championship, $userId2);

        $float1 = $balance1['black'] - $balance1['white'];
        $float2 = $balance2['black'] - $balance2['white'];

        // Player with higher float (more black) gets white
        if ($float1 > $float2) {
            return ['white' => $userId1, 'black' => $userId2];
        } elseif ($float2 > $float1) {
            return ['white' => $userId2, 'black' => $userId1];
        } else {
            // Random assignment if floats are equal
            return rand(0, 1) === 0
                ? ['white' => $userId1, 'black' => $userId2]
                : ['white' => $userId2, 'black' => $userId1];
        }
    }

    /**
     * Check if two participants have already played each other
     */
    private function haveAlreadyPlayed(Championship $championship, int $player1Id, int $player2Id): bool
    {
        return $championship->matches()
            ->completed()
            ->where(function ($query) use ($player1Id, $player2Id) {
                $query->where(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player1Id)
                      ->where('player2_id', $player2Id);
                })->orWhere(function ($q) use ($player1Id, $player2Id) {
                    $q->where('player1_id', $player2Id)
                      ->where('player2_id', $player1Id);
                });
            })
            ->exists();
    }

    /**
     * Find alternative pairing within score group
     */
    private function findAlternativePairing(Championship $championship, Collection $group, int $currentIndex, int $roundNumber): ?array
    {
        $currentPlayer = $group[$currentIndex];

        for ($i = $currentIndex + 2; $i < $group->count(); $i++) {
            $potentialOpponent = $group[$i];

            if (!$this->haveAlreadyPlayed($championship, $currentPlayer->user_id, $potentialOpponent->user_id)) {
                // Swap opponents
                $originalOpponent = $group[$currentIndex + 1];
                $group[$currentIndex + 1] = $potentialOpponent;
                $group[$i] = $originalOpponent;

                $colors = $this->assignColors($championship, $currentPlayer->user_id, $potentialOpponent->user_id);

                return [
                    'player1_id' => $colors['white'],
                    'player2_id' => $colors['black'],
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                ];
            }
        }

        return null;
    }

    /**
     * Handle cross-score group pairing (when same-score pairing is impossible)
     */
    private function crossScoreGroupPairing(Championship $championship, $player, int $roundNumber): ?array
    {
        // This is a simplified implementation
        // In reality, you'd need to check lower score groups
        Log::warning("Cross-score group pairing needed - simplified implementation", [
            'championship_id' => $championship->id,
            'user_id' => $player->user_id,
            'round' => $roundNumber,
        ]);

        return null;
    }

    /**
     * Handle bye (odd number of participants)
     */
    private function handleBye(Championship $championship, $participant, int $roundNumber): void
    {
        // Award 1 point for bye
        $standing = $championship->standings()
            ->where('user_id', $participant->user_id)
            ->first();

        if ($standing) {
            $standing->increment('score');
        } else {
            $championship->standings()->create([
                'user_id' => $participant->user_id,
                'score' => 1,
                'games_played' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
                'buchholz' => 0,
                'sonneborn_berger' => 0,
                't_rating' => $participant->user->rating ?? 1200,
            ]);
        }
    }

    /**
     * Validate that pairings are valid
     */
    public function validatePairings(Championship $championship, array $pairings): array
    {
        $errors = [];
        $participantIds = [];

        foreach ($pairings as $index => $pairing) {
            // Check required fields
            if (!isset($pairing['player1_id']) || !isset($pairing['player2_id'])) {
                $errors[] = "Pairing {$index}: Missing player IDs";
                continue;
            }

            // Check for duplicate participants
            if (in_array($pairing['player1_id'], $participantIds)) {
                $errors[] = "Pairing {$index}: Player 1 appears in multiple pairings";
            }
            if (in_array($pairing['player2_id'], $participantIds)) {
                $errors[] = "Pairing {$index}: Player 2 appears in multiple pairings";
            }

            $participantIds[] = $pairing['player1_id'];
            $participantIds[] = $pairing['player2_id'];

            // Check if players have already faced each other
            if ($this->haveAlreadyPlayed($championship, $pairing['player1_id'], $pairing['player2_id'])) {
                $errors[] = "Pairing {$index}: Players have already faced each other";
            }

            // Check self-pairing
            if ($pairing['player1_id'] === $pairing['player2_id']) {
                $errors[] = "Pairing {$index}: Player cannot play against themselves";
            }
        }

        return $errors;
    }

    /**
     * Get pairings summary for debugging
     */
    public function getPairingsSummary(Championship $championship, array $pairings): array
    {
        $summary = [
            'total_pairings' => count($pairings),
            'participants_paired' => 0,
            'color_balance' => ['white' => 0, 'black' => 0],
            'pairings' => []
        ];

        foreach ($pairings as $pairing) {
            $summary['participants_paired'] += 2;
            $summary['color_balance']['white']++;
            $summary['color_balance']['black']++;

            $player1 = User::find($pairing['player1_id']);
            $player2 = User::find($pairing['player2_id']);

            $summary['pairings'][] = [
                'player1' => $player1?->name ?? 'Unknown',
                'player2' => $player2?->name ?? 'Unknown',
                'deadline' => $pairing['deadline'] ?? 'Not set',
            ];
        }

        return $summary;
    }
}