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
            $totalParticipants = $championship->participants()->count();
            $paidParticipants = $participants->count();

            throw new \InvalidArgumentException(
                "Not enough eligible participants for pairings. " .
                "Total registered: {$totalParticipants}, Paid: {$paidParticipants}. " .
                "At least 2 paid participants are required to generate matches."
            );
        }

        // Sort participants by score (descending) and tiebreakers
        $sortedParticipants = $this->sortParticipantsByScore($championship, $participants);

        // Generate pairings using Dutch algorithm (FIDE standard)
        $pairings = $this->dutchAlgorithm($championship, $sortedParticipants, $roundNumber);

        return $pairings;
    }

    /**
     * Create matches from pairings (enhanced with color assignment and event broadcasting)
     */
    public function createMatches(Championship $championship, array $pairings, int $roundNumber): Collection
    {
        $matches = collect();
        $byePlayers = collect();

        DB::transaction(function () use ($championship, $pairings, $roundNumber, $matches, $byePlayers) {
            foreach ($pairings as $pairing) {
                // Check if this is a bye pairing (player2_id is null)
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $byeInfo = $pairing['user_info'] ?? [
                        'user_id' => $pairing['player1_id'],
                        'points_awarded' => $pairing['bye_points'] ?? $championship->getByePoints(),
                        'user' => \App\Models\User::find($pairing['player1_id'])
                    ];
                    $byePlayers->push($byeInfo);
                    continue;
                }

                // Use enhanced color assignment method
                $colorMethod = $championship->getColorAssignmentMethod();
                $colors = $this->assignColorsByMethod($championship, $pairing['player1_id'], $pairing['player2_id'], $colorMethod);

                $match = ChampionshipMatch::create([
                    'championship_id' => $championship->id,
                    'round_number' => $roundNumber,
                    'round_type' => ChampionshipRoundType::SWISS,
                    'player1_id' => $pairing['player1_id'], // Legacy support
                    'player2_id' => $pairing['player2_id'], // Legacy support
                    'white_player_id' => $colors['white'], // New color assignment
                    'black_player_id' => $colors['black'], // New color assignment
                    'color_assignment_method' => $colorMethod,
                    'auto_generated' => true,
                    'scheduled_at' => $pairing['scheduled_at'] ?? now(),
                    'deadline' => $pairing['deadline'] ?? now()->addHours($championship->match_time_window_hours),
                    'status' => ChampionshipMatchStatus::PENDING,
                ]);

                // Load relationships for the match
                $match->load(['whitePlayer', 'blackPlayer']);
                $matches->push($match);
                Log::info("Created enhanced Swiss pairing match", [
                    'championship_id' => $championship->id,
                    'round' => $roundNumber,
                    'white_player_id' => $colors['white'],
                    'black_player_id' => $colors['black'],
                    'color_method' => $colorMethod,
                    'match_id' => $match->id,
                ]);
            }
        });

        // Broadcast round generation event
        broadcast(new \App\Events\ChampionshipRoundGenerated(
            $championship,
            $roundNumber,
            $matches,
            $byePlayers->toArray()
        ));

        Log::info("Round generation broadcast", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'matches' => $matches->count(),
            'byes' => $byePlayers->count(),
        ]);

        return $matches;
    }

    /**
     * Get participants eligible for pairing (paid)
     */
    private function getEligibleParticipants(Championship $championship): Collection
    {
        // All registered participants are eligible for pairings
        // Admin controls tournament structure and advancement rules
        return $championship->participants()
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

            $score = $standing?->points ?? 0; // Database uses 'points'
            $buchholz = $standing?->buchholz_score ?? 0; // Database uses 'buchholz_score'
            $sonnebornBerger = $standing?->sonneborn_berger ?? 0;
            $tRating = $participant->user->rating ?? 1200; // Use user's rating directly

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
     * Enhanced Dutch pairing algorithm with optimal bye handling
     */
    private function dutchAlgorithm(Championship $championship, Collection $participants, int $roundNumber): array
    {
        $pairings = [];
        $unpaired = $participants->collect();

        // Handle odd number of participants with optimal bye assignment
        if ($unpaired->count() % 2 === 1) {
            $byeRecipient = $this->selectOptimalByeRecipient($championship, $unpaired);
            $unpaired = $unpaired->reject(function ($participant) use ($byeRecipient) {
                return $participant->user_id === $byeRecipient->user_id;
            });

            $byeInfo = $this->handleBye($championship, $byeRecipient, $roundNumber);

            // Add bye pairing to the pairings array for broadcasting
            $pairings[] = [
                'is_bye' => true,
                'player1_id' => $byeRecipient->user_id,
                'player2_id' => null,
                'bye_points' => $championship->getByePoints(),
                'round_number' => $roundNumber,
                'user_info' => $byeInfo,
            ];

            Log::info("Optimal bye assignment", [
                'championship_id' => $championship->id,
                'round' => $roundNumber,
                'bye_recipient_id' => $byeRecipient->user_id,
                'remaining_participants' => $unpaired->count(),
            ]);
        }

        // Group participants by score
        $scoreGroups = $this->createScoreGroups($championship, $unpaired);

        foreach ($scoreGroups as $score => $group) {
            $pairs = $this->pairScoreGroup($championship, $group, $roundNumber);
            $pairings = array_merge($pairings, $pairs);
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

            $score = $standing?->points ?? 0; // Database uses 'points'
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
                // Use enhanced color assignment based on tournament settings
                $colorMethod = $championship->getColorAssignmentMethod();
                $colors = $this->assignColorsByMethod($championship, $player1->user_id, $player2->user_id, $colorMethod);

                $pairings[] = [
                    'player1_id' => $colors['white'],
                    'player2_id' => $colors['black'],
                    'scheduled_at' => now(),
                    'deadline' => now()->addHours($championship->match_time_window_hours),
                    'color_assignment_method' => $colorMethod,
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
     * Enhanced color balance using new color assignment fields
     */
    private function getEnhancedColorBalance(Championship $championship, int $userId): array
    {
        $completedMatches = $championship->matches()
            ->completed()
            ->where(function ($query) use ($userId) {
                $query->where('white_player_id', $userId)
                      ->orWhere('black_player_id', $userId);
            })
            ->get();

        // Try new color assignment fields first
        $white = $completedMatches->where('white_player_id', $userId)->count();
        $black = $completedMatches->where('black_player_id', $userId)->count();

        // If no new fields found, fall back to legacy
        if ($white === 0 && $black === 0) {
            return $this->getColorBalance($championship, $userId);
        }

        return ['white' => $white, 'black' => $black];
    }

    /**
     * Assign colors using championship's preferred method
     */
    private function assignColorsByMethod(Championship $championship, int $userId1, int $userId2, string $method): array
    {
        switch ($method) {
            case 'balanced':
                return $this->assignColorsBalanced($championship, $userId1, $userId2);
            case 'alternate':
                return $this->assignColorsAlternate($championship, $userId1, $userId2);
            case 'random':
                return $this->assignColorsRandom($userId1, $userId2);
            default:
                return $this->assignColorsBalanced($championship, $userId1, $userId2);
        }
    }

    /**
     * Balanced color assignment (Swiss system standard)
     */
    private function assignColorsBalanced(Championship $championship, int $userId1, int $userId2): array
    {
        $balance1 = $this->getEnhancedColorBalance($championship, $userId1);
        $balance2 = $this->getEnhancedColorBalance($championship, $userId2);

        $float1 = $balance1['black'] - $balance1['white'];
        $float2 = $balance2['black'] - $balance2['white'];

        // Player with higher float (more black games) gets white
        if ($float1 > $float2) {
            return ['white' => $userId1, 'black' => $userId2];
        } elseif ($float2 > $float1) {
            return ['white' => $userId2, 'black' => $userId1];
        } else {
            // If floats are equal, consider rating difference
            $user1 = User::find($userId1);
            $user2 = User::find($userId2);

            if ($user1 && $user2) {
                // Higher rated player gets black as slight disadvantage
                return $user1->rating > $user2->rating
                    ? ['white' => $userId2, 'black' => $userId1]
                    : ['white' => $userId1, 'black' => $userId2];
            }

            // Random assignment if all else equal
            return rand(0, 1) === 0
                ? ['white' => $userId1, 'black' => $userId2]
                : ['white' => $userId2, 'black' => $userId1];
        }
    }

    /**
     * Alternate color assignment (strict alternation)
     */
    private function assignColorsAlternate(Championship $championship, int $userId1, int $userId2): array
    {
        $balance1 = $this->getEnhancedColorBalance($championship, $userId1);
        $balance2 = $this->getEnhancedColorBalance($championship, $userId2);

        // Strict alternation - prioritize minimizing color imbalance
        if ($balance1['white'] > $balance1['black']) {
            return ['white' => $userId2, 'black' => $userId1];
        } elseif ($balance2['white'] > $balance2['black']) {
            return ['white' => $userId1, 'black' => $userId2];
        } else {
            // If both have balanced colors, alternate based on previous round
            return $this->assignColorsBalanced($championship, $userId1, $userId2);
        }
    }

    /**
     * Random color assignment
     */
    private function assignColorsRandom(int $userId1, int $userId2): array
    {
        return rand(0, 1) === 0
            ? ['white' => $userId1, 'black' => $userId2]
            : ['white' => $userId2, 'black' => $userId1];
    }

    /**
     * Legacy color assignment method (for backward compatibility)
     */
    private function assignColors(Championship $championship, int $userId1, int $userId2): array
    {
        return $this->assignColorsBalanced($championship, $userId1, $userId2);
    }

    /**
     * Public color assignment method for external services
     */
    public function assignColorsPub(Championship $championship, int $userId1, int $userId2): array
    {
        return $this->assignColorsBalanced($championship, $userId1, $userId2);
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
     * Enhanced bye handling with configurable points and optimal assignment
     */
    private function handleBye(Championship $championship, $participant, int $roundNumber): array
    {
        $byePoints = $championship->getByePoints();

        // Award bye points from tournament settings
        $standing = $championship->standings()
            ->where('user_id', $participant->user_id)
            ->first();

        if ($standing) {
            $standing->increment('points', $byePoints);
            // Note: byes_received column doesn't exist - tracking removed
        } else {
            $championship->standings()->create([
                'user_id' => $participant->user_id,
                'points' => $byePoints,
                'matches_played' => 0,
                'wins' => 0,
                'draws' => 0,
                'losses' => 0,
                'buchholz_score' => 0,
                'sonneborn_berger' => 0,
                // Note: byes_received column doesn't exist - tracking removed
            ]);
        }

        // Create a "bye match" record for tracking purposes
        ChampionshipMatch::create([
            'championship_id' => $championship->id,
            'round_number' => $roundNumber,
            'round_type' => ChampionshipRoundType::SWISS,
            'player1_id' => $participant->user_id,
            'player2_id' => null, // No opponent for bye
            'white_player_id' => null, // No color assignment for bye
            'black_player_id' => $participant->user_id,
            'color_assignment_method' => 'bye',
            'auto_generated' => true,
            'scheduled_at' => now(),
            'deadline' => now()->addHours($championship->match_time_window_hours),
            'status' => ChampionshipMatchStatus::COMPLETED,
            'result_type' => 'bye',
            'winner_id' => $participant->user_id,
        ]);

        Log::info("Enhanced bye assignment", [
            'championship_id' => $championship->id,
            'round' => $roundNumber,
            'user_id' => $participant->user_id,
            'bye_points' => $byePoints,
            'total_byes_received' => ($standing->byes_received ?? 0) + 1,
        ]);

        // Return bye information for broadcasting
        return [
            'user_id' => $participant->user_id,
            'user' => $participant->user,
            'points_awarded' => $byePoints,
            'total_byes_received' => ($standing->byes_received ?? 0) + 1,
            'round_number' => $roundNumber
        ];
    }

    /**
     * Optimal bye assignment - select player with lowest score who hasn't had bye recently
     */
    private function selectOptimalByeRecipient(Championship $championship, Collection $participants): mixed
    {
        // Get bye statistics from standings
        $standings = $championship->standings()
            ->whereIn('user_id', $participants->pluck('user_id'))
            ->get()
            ->keyBy('user_id');

        // Sort by: 1) Lowest score, 2) Fewest byes received, 3) Lowest rating
        return $participants->sortBy(function ($participant) use ($standings, $championship) {
            $standing = $standings->get($participant->user_id);
            $score = $standing?->points ?? 0; // Database uses 'points'
            $byes = $standing?->byes_received ?? 0;
            $rating = $participant->user->rating ?? 1200;

            // Higher priority = lower number in sorting
            return [
                $score,           // Lowest score first
                $byes,            // Fewest byes first
                $rating,          // Lowest rating first (give advantage to weaker players)
            ];
        })->first();
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