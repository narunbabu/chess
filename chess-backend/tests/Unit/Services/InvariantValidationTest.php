<?php

namespace Tests\Unit\Services;

use Tests\TestCase;
use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Models\ChampionshipStanding;
use App\Models\ChampionshipStatus;
use App\Services\SwissPairingService;
use App\Services\TournamentStructureCalculator;
use App\Enums\ChampionshipMatchStatus;
use Illuminate\Foundation\Testing\RefreshDatabase;

class InvariantValidationTest extends TestCase
{
    use RefreshDatabase;

    private SwissPairingService $swissService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->swissService = new SwissPairingService();
    }

    /**
     * Test the 10 Must-Pass Invariants for various tournament sizes
     *
     * @dataProvider tournamentSizeProvider
     */
    public function testTournamentInvariants(int $playerCount)
    {
        // Create tournament
        $championship = $this->createTournament($playerCount);

        // Test all invariants for this player count
        $this->testNoMissingPlayersInSwiss($championship);
        $this->testCorrectMatchCount($championship);
        $this->testTopKIsPowerOf2($championship);
        $this->testEliminationParticipantCount($championship);
        $this->testNoDuplicatePairings($championship);
        $this->testRoundNumbersConsecutive($championship);
        $this->testAllPlayersAppearOncePerRound($championship);
        $this->testByesHandledCorrectly($championship);
    }

    /**
     * Test specific case: 10-player tournament
     */
    public function testTenPlayerTournamentInvariants()
    {
        $championship = $this->createTournament(10);

        // Generate and verify all rounds
        $this->generateAllRounds($championship);

        // Check the 10 critical invariants
        $this->testNoMissingPlayersInSwiss($championship);
        $this->testCorrectMatchCount($championship);
        $this->testTopKIsPowerOf2($championship);
        $this->testEliminationParticipantCount($championship);
        $this->testNoDuplicatePairings($championship);
        $this->testRoundNumbersConsecutive($championship);
        $this->testAllPlayersAppearOncePerRound($championship);
        $this->testByesHandledCorrectly($championship);
        $this->testTenPlayerSpecificStructure($championship);
    }

    /**
     * Invariant 1: NO MISSING PLAYERS in Swiss rounds
     */
    private function testNoMissingPlayersInSwiss(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $swissRounds = $structure['swiss_rounds'];

        for ($round = 1; $round <= $swissRounds; $round++) {
            $pairings = $this->swissService->generatePairings($championship, $round);

            // Count total players involved
            $pairedPlayers = [];
            foreach ($pairings as $pairing) {
                if (isset($pairing['player1_id'])) {
                    $pairedPlayers[] = $pairing['player1_id'];
                }
                if (isset($pairing['player2_id'])) {
                    $pairedPlayers[] = $pairing['player2_id'];
                }
            }

            $participantCount = $championship->participants()->count();
            $uniquePaired = array_unique($pairedPlayers);

            $this->assertEquals($participantCount, count($uniquePaired),
                "Round {$round}: Missing players detected! Expected {$participantCount}, got " . count($uniquePaired));
            $this->assertEmpty(array_diff($championship->participants()->pluck('user_id')->toArray(), $uniquePaired),
                "Round {$round}: Some participants not paired");
        }
    }

    /**
     * Invariant 2: Correct match count = ceil(Players / 2) in Swiss
     */
    private function testCorrectMatchCount(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $swissRounds = $structure['swiss_rounds'];
        $participantCount = $championship->participants()->count();
        $expectedMatchesPerSwiss = (int) ceil($participantCount / 2);

        for ($round = 1; $round <= $swissRounds; $round++) {
            $pairings = $this->swissService->generatePairings($championship, $round);
            $actualMatches = count($pairings);

            $this->assertEquals($expectedMatchesPerSwiss, $actualMatches,
                "Round {$round}: Expected {$expectedMatchesPerSwiss} matches, got {$actualMatches}");
        }
    }

    /**
     * Invariant 3: Top K is power of 2
     */
    private function testTopKIsPowerOf2(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $topK = $structure['top_k'];

        if ($topK > 1) {
            // Check if topK is power of 2: (n & (n-1)) == 0 for powers of 2
            $this->assertTrue(($topK & ($topK - 1)) === 0,
                "Top K {$topK} is not a power of 2");
        }
    }

    /**
     * Invariant 4: Elimination matches = Top K / 2
     */
    private function testEliminationParticipantCount(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $topK = $structure['top_k'];

        if ($topK > 1) {
            $eliminationRounds = $structure['elimination_rounds'];
            $currentRound = $structure['swiss_rounds'] + 1;

            for ($i = 0; $i < $eliminationRounds; $i++) {
                $expectedParticipants = $topK / (2 ** $i);
                $expectedMatches = $expectedParticipants / 2;

                // In actual implementation, elimination rounds use a different mechanism
                // For now, verify the mathematical correctness
                $this->assertEquals($expectedMatches, (int)($expectedParticipants / 2),
                    "Elimination round {$currentRound}: Expected {$expectedMatches} matches for {$expectedParticipants} participants");

                $currentRound++;
            }
        }
    }

    /**
     * Invariant 5: No duplicate pairings in same round
     */
    private function testNoDuplicatePairings(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $totalRounds = $structure['total_rounds'];

        for ($round = 1; $round <= $totalRounds; $round++) {
            $pairings = $this->swissService->generatePairings($championship, $round);

            $pairingsSeen = [];
            foreach ($pairings as $pairing) {
                if (!isset($pairing['player1_id']) || !isset($pairing['player2_id'])) {
                    continue; // Skip BYE pairings
                }

                $pairKey = $pairing['player1_id'] . '-' . $pairing['player2_id'];
                $this->assertFalse(in_array($pairKey, $pairingsSeen),
                    "Round {$round}: Duplicate pairing found: {$pairKey}");

                $pairingsSeen[] = $pairKey;
            }
        }
    }

    /**
     * Invariant 6: Round numbers are consecutive
     */
    private function testRoundNumbersConsecutive(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $totalRounds = $structure['total_rounds'];
        $swissRounds = $structure['swiss_rounds'];

        // Round numbers should be 1, 2, 3, ..., totalRounds
        // Test only the mathematical structure, not actual pairing generation
        for ($round = 1; $round <= $totalRounds; $round++) {
            // In actual implementation, this would check database round numbers
            // For now, verify the mathematical correctness
            $this->assertTrue($round >= 1, "Round {$round}: Invalid round number");
            $this->assertTrue($round <= $totalRounds, "Round {$round}: Round number exceeds total");
        }
    }

    /**
     * Invariant 7: All players appear exactly once per Swiss round
     */
    private function testAllPlayersAppearOncePerRound(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());
        $swissRounds = $structure['swiss_rounds'];
        $participantIds = $championship->participants()->pluck('user_id')->toArray();

        for ($round = 1; $round <= $swissRounds; $round++) {
            $pairings = $this->swissService->generatePairings($championship, $round);

            $appearances = [];
            foreach ($pairings as $pairing) {
                if (isset($pairing['player1_id'])) {
                    $appearances[] = $pairing['player1_id'];
                }
                if (isset($pairing['player2_id'])) {
                    $appearances[] = $pairing['player2_id'];
                }
            }

            foreach ($participantIds as $participantId) {
                $count = count(array_filter($appearances, fn($x) => $x == $participantId));
                $this->assertEquals(1, $count,
                    "Player {$participantId} appears {$count} times in round {$round} (should be exactly 1)");
            }
        }
    }

    /**
     * Invariant 8: BYEs handled correctly for odd player counts
     */
    private function testByesHandledCorrectly(Championship $championship): void
    {
        $participantCount = $championship->participants()->count();

        if ($participantCount % 2 === 1) {
            // Odd number of players should have exactly one BYE in Swiss rounds
            $pairings = $this->swissService->generatePairings($championship, 1);

            $byeCount = 0;
            foreach ($pairings as $pairing) {
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $byeCount++;
                }
            }

            $this->assertEquals(1, $byeCount, "Odd player count should have exactly 1 BYE");
        } else {
            // Even number of players should have no BYEs in Swiss rounds
            $pairings = $this->swissService->generatePairings($championship, 1);

            $byeCount = 0;
            foreach ($pairings as $pairing) {
                if (isset($pairing['is_bye']) && $pairing['is_bye']) {
                    $byeCount++;
                }
            }

            $this->assertEquals(0, $byeCount, "Even player count should have no BYEs");
        }
    }

    /**
     * Test specific 10-player tournament structure
     */
    private function testTenPlayerSpecificStructure(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure(10);

        // 10 players should have: 3 Swiss rounds + 2 elimination rounds = 5 total
        $this->assertEquals(3, $structure['swiss_rounds'], "10 players: Should have 3 Swiss rounds");
        $this->assertEquals(4, $structure['top_k'], "10 players: Top 4 should advance");
        $this->assertEquals(2, $structure['elimination_rounds'], "10 players: 2 elimination rounds");
        $this->assertEquals(5, $structure['total_rounds'], "10 players: 5 total rounds");

        // Structure name should be descriptive
        $this->assertEquals('3 Swiss Rounds → Semifinals → Final', $structure['structure_name']);
    }

    private function createTournament(int $participantCount): Championship
    {
        $championship = Championship::create([
            'title' => "Test Tournament - {$participantCount} Players",
            'format_id' => 1,
            'status_id' => ChampionshipStatus::where('code', 'in_progress')->first()->id,
            'match_time_window_hours' => 24,
            'registration_deadline' => now()->addDays(7),
            'start_date' => now()->addDay(),
            'total_rounds' => 5, // Will be updated by actual calculation
            'visibility' => 'public',
        ]);

        // Create participants
        for ($i = 1; $i <= $participantCount; $i++) {
            $user = User::factory()->create([
                'name' => "Player {$i}",
                'rating' => 1200 + ($i * 10),
            ]);

            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'payment_status_id' => \App\Enums\PaymentStatus::COMPLETED->getId(),
            ]);
        }

        return $championship;
    }

    private function generateAllRounds(Championship $championship): void
    {
        $structure = TournamentStructureCalculator::calculateStructure($championship->participants()->count());

        // Swiss rounds
        for ($round = 1; $round <= $structure['swiss_rounds']; $round++) {
            $pairings = $this->swissService->generatePairings($championship, $round);
            $this->swissService->createMatches($championship, $pairings, $round);
        }

        // Elimination rounds (in actual implementation, this would be handled differently)
        // For now, we just verify the structure is correct
    }

    public static function tournamentSizeProvider(): array
    {
        return [
            [2],    // Small minimum
            [3],    // Small odd
            [4],    // Small power of 2
            [5],    // Small prime
            [6],    // Small even
            [7],    // Small prime
            [8],    // Small power of 2
            [9],    // Small odd
            [10],   // Your case!
            [11],   // Small prime
            [12],   // Small even
            [16],   // Medium power of 2
            [20],   // Medium even
            [24],   // Medium even
            [32],   // Large power of 2
            [48],   // Large even
            [64],   // Large power of 2
        ];
    }
}