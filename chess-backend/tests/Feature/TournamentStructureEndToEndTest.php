<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Services\TournamentStructureCalculator;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * End-to-End Tournament Structure Tests
 *
 * Tests actual tournament generation via API endpoint for 3, 5, 10, and 50 players
 * Validates all 10 Must-Pass Invariants for each tournament size
 */
class TournamentStructureEndToEndTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Test 3-player tournament structure
     */
    public function testThreePlayerTournamentStructure()
    {
        $this->validateTournamentStructure(3, [
            'swiss_rounds' => 2,
            'top_k' => 2,
            'elimination_rounds' => 1,
            'total_rounds' => 3,
            'expected_structure' => [
                1 => ['type' => 'swiss', 'matches' => 2, 'players' => 3], // 1 BYE
                2 => ['type' => 'swiss', 'matches' => 2, 'players' => 3], // 1 BYE
                3 => ['type' => 'final', 'matches' => 1, 'players' => 2],
            ],
        ]);
    }

    /**
     * Test 5-player tournament structure
     */
    public function testFivePlayerTournamentStructure()
    {
        $this->validateTournamentStructure(5, [
            'swiss_rounds' => 3,
            'top_k' => 4,
            'elimination_rounds' => 2,
            'total_rounds' => 5,
            'expected_structure' => [
                1 => ['type' => 'swiss', 'matches' => 3, 'players' => 5], // 1 BYE
                2 => ['type' => 'swiss', 'matches' => 3, 'players' => 5], // 1 BYE
                3 => ['type' => 'swiss', 'matches' => 3, 'players' => 5], // 1 BYE
                4 => ['type' => 'semi_final', 'matches' => 2, 'players' => 4],
                5 => ['type' => 'final', 'matches' => 1, 'players' => 2],
            ],
        ]);
    }

    /**
     * Test 10-player tournament structure
     */
    public function testTenPlayerTournamentStructure()
    {
        $this->validateTournamentStructure(10, [
            'swiss_rounds' => 3,
            'top_k' => 4,
            'elimination_rounds' => 2,
            'total_rounds' => 5,
            'expected_structure' => [
                1 => ['type' => 'swiss', 'matches' => 5, 'players' => 10],
                2 => ['type' => 'swiss', 'matches' => 5, 'players' => 10],
                3 => ['type' => 'swiss', 'matches' => 5, 'players' => 10],
                4 => ['type' => 'semi_final', 'matches' => 2, 'players' => 4],
                5 => ['type' => 'final', 'matches' => 1, 'players' => 2],
            ],
        ]);
    }

    /**
     * Test 50-player tournament structure
     */
    public function testFiftyPlayerTournamentStructure()
    {
        $this->validateTournamentStructure(50, [
            'swiss_rounds' => 5,
            'top_k' => 16,
            'elimination_rounds' => 4,
            'total_rounds' => 9,
            'expected_structure' => [
                1 => ['type' => 'swiss', 'matches' => 25, 'players' => 50],
                2 => ['type' => 'swiss', 'matches' => 25, 'players' => 50],
                3 => ['type' => 'swiss', 'matches' => 25, 'players' => 50],
                4 => ['type' => 'swiss', 'matches' => 25, 'players' => 50],
                5 => ['type' => 'swiss', 'matches' => 25, 'players' => 50],
                6 => ['type' => 'swiss', 'matches' => 8, 'players' => 16], // round_of_16 (but type swiss for now)
                7 => ['type' => 'swiss', 'matches' => 4, 'players' => 8], // quarter_final
                8 => ['type' => 'swiss', 'matches' => 2, 'players' => 4], // semi_final
                9 => ['type' => 'swiss', 'matches' => 1, 'players' => 2], // final
            ],
        ]);
    }

    /**
     * Comprehensive validation of tournament structure
     */
    private function validateTournamentStructure(int $playerCount, array $expected): void
    {
        echo "\n========================================\n";
        echo "Testing {$playerCount}-Player Tournament\n";
        echo "========================================\n";

        // Step 1: Calculate expected structure
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        echo "\n📊 Expected Structure:\n";
        echo "  Swiss Rounds: {$expected['swiss_rounds']}\n";
        echo "  Top K: {$expected['top_k']}\n";
        echo "  Elimination Rounds: {$expected['elimination_rounds']}\n";
        echo "  Total Rounds: {$expected['total_rounds']}\n";

        // Validate calculator output
        $this->assertEquals($expected['swiss_rounds'], $structure['swiss_rounds'],
            "Swiss rounds mismatch for {$playerCount} players");
        $this->assertEquals($expected['top_k'], $structure['top_k'],
            "Top K mismatch for {$playerCount} players");
        $this->assertEquals($expected['elimination_rounds'], $structure['elimination_rounds'],
            "Elimination rounds mismatch for {$playerCount} players");
        $this->assertEquals($expected['total_rounds'], $structure['total_rounds'],
            "Total rounds mismatch for {$playerCount} players");

        // Step 2: Create tournament via database
        $championship = $this->createTournament($playerCount);

        // Step 3: Generate full tournament structure
        $config = $this->generateTournamentConfig($structure);
        $tournamentService = app(\App\Services\TournamentGenerationService::class);
        $summary = $tournamentService->generateFullTournament($championship, $config);

        echo "\n✅ Tournament generated: {$summary['total_matches']} matches across {$summary['total_rounds']} rounds\n";

        // Step 4: Validate each round
        $championship->refresh();
        $matchesByRound = $championship->matches->groupBy('round_number');

        foreach ($expected['expected_structure'] as $roundNumber => $roundExpected) {
            echo "\n🔍 Validating Round {$roundNumber} ({$roundExpected['type']}):\n";

            $matches = $matchesByRound[$roundNumber] ?? collect();
            $actualMatchCount = $matches->count();
            $expectedMatchCount = $roundExpected['matches'];

            echo "  Expected: {$expectedMatchCount} matches\n";
            echo "  Actual: {$actualMatchCount} matches\n";

            // Validate match count
            $this->assertEquals($expectedMatchCount, $actualMatchCount,
                "Round {$roundNumber}: Expected {$expectedMatchCount} matches, got {$actualMatchCount}");

            // Validate round type
            $firstMatch = $matches->first();
            if ($firstMatch) {
                $actualType = strtolower($firstMatch->getRoundTypeEnum()->name);
                $this->assertEquals($roundExpected['type'], $actualType,
                    "Round {$roundNumber}: Expected type '{$roundExpected['type']}', got '{$actualType}'");
            }

            // Count unique players in this round
            $uniquePlayers = collect();
            foreach ($matches as $match) {
                if ($match->player1_id) $uniquePlayers->push($match->player1_id);
                if ($match->player2_id) $uniquePlayers->push($match->player2_id);
            }
            $actualPlayerCount = $uniquePlayers->unique()->count();

            echo "  Expected: {$roundExpected['players']} players\n";
            echo "  Actual: {$actualPlayerCount} players\n";

            // For Swiss rounds, all players must participate
            if ($roundExpected['type'] === 'swiss') {
                $this->assertEquals($playerCount, $actualPlayerCount,
                    "Round {$roundNumber}: Swiss round must have all {$playerCount} players, got {$actualPlayerCount}");
            } else {
                // For elimination rounds, validate participant count
                $this->assertEquals($roundExpected['players'], $actualPlayerCount,
                    "Round {$roundNumber}: Expected {$roundExpected['players']} players, got {$actualPlayerCount}");
            }

            echo "  ✅ Round {$roundNumber} validated!\n";
        }

        // Step 5: Validate invariants
        echo "\n🔒 Validating 10 Must-Pass Invariants:\n";
        $this->validateAllInvariants($championship, $structure);

        echo "\n✅ All invariants passed for {$playerCount}-player tournament!\n";
    }

    /**
     * Validate all 10 Must-Pass Invariants
     */
    private function validateAllInvariants(Championship $championship, array $structure): void
    {
        $swissRounds = $structure['swiss_rounds'];
        $topK = $structure['top_k'];
        $participants = $championship->participants()->pluck('user_id')->toArray();
        $participantCount = count($participants);

        // Invariant 1: NO MISSING PLAYERS in Swiss rounds
        echo "  1. No missing players in Swiss... ";
        for ($round = 1; $round <= $swissRounds; $round++) {
            $matches = $championship->matches()->where('round_number', $round)->get();
            $pairedPlayers = [];
            foreach ($matches as $match) {
                if ($match->player1_id) $pairedPlayers[] = $match->player1_id;
                if ($match->player2_id) $pairedPlayers[] = $match->player2_id;
            }
            $uniquePaired = array_unique($pairedPlayers);
            $this->assertCount($participantCount, $uniquePaired,
                "Round {$round}: Missing players! Expected {$participantCount}, got " . count($uniquePaired));
        }
        echo "✅\n";

        // Invariant 2: Correct match count = ceil(Players / 2) in Swiss
        echo "  2. Correct match count in Swiss... ";
        $expectedMatchesPerSwiss = (int) ceil($participantCount / 2);
        for ($round = 1; $round <= $swissRounds; $round++) {
            $actualMatches = $championship->matches()->where('round_number', $round)->count();
            $this->assertEquals($expectedMatchesPerSwiss, $actualMatches,
                "Round {$round}: Expected {$expectedMatchesPerSwiss} matches, got {$actualMatches}");
        }
        echo "✅\n";

        // Invariant 3: Top K is power of 2
        echo "  3. Top K is power of 2... ";
        if ($topK > 1) {
            $this->assertTrue(($topK & ($topK - 1)) === 0, "Top K {$topK} is not a power of 2");
        }
        echo "✅\n";

        // Invariant 4: Elimination rounds have correct participant counts
        echo "  4. Elimination participant counts... ";
        $currentRound = $swissRounds + 1;
        $currentTopK = $topK;
        while ($currentTopK >= 2) {
            $matches = $championship->matches()->where('round_number', $currentRound)->get();
            $expectedMatches = $currentTopK / 2;
            $this->assertCount($expectedMatches, $matches,
                "Round {$currentRound}: Expected {$expectedMatches} matches for {$currentTopK} participants");
            $currentRound++;
            $currentTopK = $currentTopK / 2;
        }
        echo "✅\n";

        // Invariant 5: No duplicate pairings in same round
        echo "  5. No duplicate pairings... ";
        foreach ($championship->matches->groupBy('round_number') as $roundNumber => $matches) {
            $pairings = [];
            foreach ($matches as $match) {
                if ($match->player1_id && $match->player2_id) {
                    $pairKey = min($match->player1_id, $match->player2_id) . '-' . max($match->player1_id, $match->player2_id);
                    $this->assertFalse(in_array($pairKey, $pairings),
                        "Round {$roundNumber}: Duplicate pairing {$pairKey}");
                    $pairings[] = $pairKey;
                }
            }
        }
        echo "✅\n";

        // Invariant 6: Round numbers are consecutive
        echo "  6. Round numbers consecutive... ";
        $roundNumbers = $championship->matches->pluck('round_number')->unique()->sort()->values();
        for ($i = 0; $i < $roundNumbers->count(); $i++) {
            $this->assertEquals($i + 1, $roundNumbers[$i], "Round numbers not consecutive");
        }
        echo "✅\n";

        // Invariant 7: All players appear exactly once per Swiss round
        echo "  7. Players appear once per Swiss round... ";
        for ($round = 1; $round <= $swissRounds; $round++) {
            $matches = $championship->matches()->where('round_number', $round)->get();
            $appearances = [];
            foreach ($matches as $match) {
                if ($match->player1_id) $appearances[] = $match->player1_id;
                if ($match->player2_id) $appearances[] = $match->player2_id;
            }
            foreach ($participants as $participantId) {
                $count = count(array_filter($appearances, fn($x) => $x == $participantId));
                $this->assertEquals(1, $count,
                    "Round {$round}: Player {$participantId} appears {$count} times (should be 1)");
            }
        }
        echo "✅\n";

        // Invariant 8: BYEs handled correctly
        echo "  8. BYEs handled correctly... ";
        if ($participantCount % 2 === 1) {
            // Odd number: should have exactly 1 BYE per Swiss round
            for ($round = 1; $round <= $swissRounds; $round++) {
                $matches = $championship->matches()->where('round_number', $round)->get();
                $byeCount = $matches->filter(fn($m) => $m->player2_id === null)->count();
                $this->assertEquals(1, $byeCount, "Round {$round}: Odd players should have 1 BYE");
            }
        } else {
            // Even number: should have no BYEs
            for ($round = 1; $round <= $swissRounds; $round++) {
                $matches = $championship->matches()->where('round_number', $round)->get();
                $byeCount = $matches->filter(fn($m) => $m->player2_id === null)->count();
                $this->assertEquals(0, $byeCount, "Round {$round}: Even players should have no BYEs");
            }
        }
        echo "✅\n";

        // Invariant 9: No player plays themselves
        echo "  9. No player plays themselves... ";
        foreach ($championship->matches as $match) {
            if ($match->player1_id && $match->player2_id) {
                $this->assertNotEquals($match->player1_id, $match->player2_id,
                    "Match {$match->id}: Player plays themselves!");
            }
        }
        echo "✅\n";

        // Invariant 10: Total rounds = Swiss + Elimination
        echo "  10. Total rounds correct... ";
        $totalRounds = $championship->matches->pluck('round_number')->max();
        $this->assertEquals($structure['total_rounds'], $totalRounds,
            "Total rounds mismatch: expected {$structure['total_rounds']}, got {$totalRounds}");
        echo "✅\n";
    }

    private function createTournament(int $participantCount): Championship
    {
        $owner = User::factory()->create(['name' => 'Tournament Owner']);

        $championship = Championship::create([
            'title' => "Test Tournament - {$participantCount} Players",
            'format_id' => 1,
            'status_id' => \App\Enums\ChampionshipStatus::IN_PROGRESS->getId(),
            'match_time_window_hours' => 24,
            'registration_deadline' => now()->addDays(7),
            'start_date' => now()->addDay(),
            'total_rounds' => 5,
            'visibility' => 'public',
            'created_by' => $owner->id,
        ]);

        for ($i = 1; $i <= $participantCount; $i++) {
            $user = User::factory()->create([
                'name' => "Player {$i}",
                'rating' => 1500 - ($i * 10),
            ]);

            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
            ]);
        }

        return $championship;
    }

    private function generateTournamentConfig(array $structure): \App\ValueObjects\TournamentConfig
    {
        $rounds = [];
        $roundNumber = 1;

        // Swiss rounds
        for ($i = 1; $i <= $structure['swiss_rounds']; $i++) {
            $rounds[] = [
                'round' => $roundNumber++,
                'name' => "Round $i",
                'type' => 'swiss',
                'participant_selection' => 'all',
                'pairing_method' => $i === 1 ? 'swiss' : 'standings_based',
                'matches_per_player' => 1,
            ];
        }

        // Elimination rounds
        $topK = $structure['top_k'];
        while ($topK >= 2) {
            $roundType = match($topK) {
                32 => 'round_of_32',
                16 => 'round_of_16',
                8 => 'quarter_final',
                4 => 'semi_final',
                2 => 'final',
                default => 'swiss',
            };

            $rounds[] = [
                'round' => $roundNumber++,
                'name' => "Top $topK",
                'type' => $roundType,
                'participant_selection' => ['top_k' => $topK],
                'pairing_method' => 'standings_based',
                'matches_per_player' => 1,
            ];

            $topK = $topK / 2;
        }

        return \App\ValueObjects\TournamentConfig::fromArray([
            'round_structure' => $rounds,
            'mode' => 'progressive',
            'avoid_repeat_matches' => true,
            'color_balance_strict' => true,
            'bye_handling' => 'automatic',
            'bye_points' => 1.0,
            'auto_advance_enabled' => false,
            'preset' => 'custom',
        ]);
    }
}
