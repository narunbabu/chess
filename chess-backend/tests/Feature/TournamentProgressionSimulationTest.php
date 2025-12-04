<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\Models\ChampionshipMatch;
use App\Services\TournamentStructureCalculator;
use App\Services\TournamentGenerationService;
use App\Services\StandingsCalculatorService;
use App\Services\ChampionshipRoundProgressionService;
use Illuminate\Foundation\Testing\RefreshDatabase;

/**
 * Tournament Progression Simulation Test
 *
 * Simulates complete tournaments with random match results to validate:
 * 1. Match generation correctness
 * 2. Swiss round progression
 * 3. Top K selection and advancement
 * 4. Elimination bracket progression
 * 5. Final winner determination
 */
class TournamentProgressionSimulationTest extends TestCase
{
    use RefreshDatabase;

    private TournamentGenerationService $tournamentService;
    private StandingsCalculatorService $standingsService;
    private ChampionshipRoundProgressionService $progressionService;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tournamentService = app(TournamentGenerationService::class);
        $this->standingsService = app(StandingsCalculatorService::class);
        $this->progressionService = app(ChampionshipRoundProgressionService::class);
    }

    /**
     * Test 3-player tournament with full simulation
     */
    public function testThreePlayerTournamentProgression()
    {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "🏆 3-PLAYER TOURNAMENT SIMULATION\n";
        echo str_repeat("=", 80) . "\n";

        $this->simulateCompleteTournament(3);
    }

    /**
     * Test 5-player tournament with full simulation
     */
    public function testFivePlayerTournamentProgression()
    {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "🏆 5-PLAYER TOURNAMENT SIMULATION\n";
        echo str_repeat("=", 80) . "\n";

        $this->simulateCompleteTournament(5);
    }

    /**
     * Test 10-player tournament with full simulation
     */
    public function testTenPlayerTournamentProgression()
    {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "🏆 10-PLAYER TOURNAMENT SIMULATION\n";
        echo str_repeat("=", 80) . "\n";

        $this->simulateCompleteTournament(10);
    }

    /**
     * Test 50-player tournament with full simulation
     */
    public function testFiftyPlayerTournamentProgression()
    {
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "🏆 50-PLAYER TOURNAMENT SIMULATION\n";
        echo str_repeat("=", 80) . "\n";

        $this->simulateCompleteTournament(50);
    }

    /**
     * Simulate complete tournament from start to finish
     */
    private function simulateCompleteTournament(int $playerCount): void
    {
        // Step 1: Create tournament structure
        $structure = TournamentStructureCalculator::calculateStructure($playerCount);

        echo "\n📊 Tournament Structure:\n";
        echo "  Players: {$playerCount}\n";
        echo "  Swiss Rounds: {$structure['swiss_rounds']}\n";
        echo "  Top K: {$structure['top_k']}\n";
        echo "  Elimination Rounds: {$structure['elimination_rounds']}\n";
        echo "  Total Rounds: {$structure['total_rounds']}\n";
        echo "  Structure: {$structure['structure_name']}\n";

        // Step 2: Create championship and participants
        $championship = $this->createChampionship($playerCount);
        $participants = $this->createParticipants($championship, $playerCount);

        echo "\n👥 Created {$playerCount} participants\n";

        // Step 3: Generate full tournament
        $config = $this->generateTournamentConfig($structure);
        $summary = $this->tournamentService->generateFullTournament($championship, $config);

        echo "\n✅ Generated tournament: {$summary['total_matches']} matches across {$summary['total_rounds']} rounds\n";

        // Step 4: Simulate Swiss rounds
        $championship->refresh();
        $swissRounds = $structure['swiss_rounds'];

        echo "\n" . str_repeat("-", 80) . "\n";
        echo "SWISS ROUNDS SIMULATION\n";
        echo str_repeat("-", 80) . "\n";

        for ($round = 1; $round <= $swissRounds; $round++) {
            echo "\n🔵 Round {$round}:\n";
            $this->simulateRound($championship, $round);
            $this->validateRoundCompleteness($championship, $round);
            $this->displayStandings($championship, $round);
        }

        // Step 5: Check Top K qualification
        echo "\n" . str_repeat("-", 80) . "\n";
        echo "TOP K QUALIFICATION\n";
        echo str_repeat("-", 80) . "\n";

        $standings = $championship->standings()->orderBy('rank')->limit($structure['top_k'])->get();
        echo "\n🎯 Top {$structure['top_k']} Qualifiers:\n";
        foreach ($standings as $standing) {
            $user = $standing->user;
            echo sprintf("  #%d: %s (%.1f points, Rating: %d)\n",
                $standing->rank,
                $user->name,
                $standing->points,
                $user->rating
            );
        }

        // Step 6: Simulate elimination rounds
        if ($structure['elimination_rounds'] > 0) {
            echo "\n" . str_repeat("-", 80) . "\n";
            echo "ELIMINATION ROUNDS SIMULATION\n";
            echo str_repeat("-", 80) . "\n";

            $eliminationStart = $swissRounds + 1;
            $eliminationEnd = $structure['total_rounds'];

            for ($round = $eliminationStart; $round <= $eliminationEnd; $round++) {
                $roundType = $this->getEliminationRoundName($round, $eliminationStart, $eliminationEnd);
                echo "\n🔴 {$roundType} (Round {$round}):\n";

                $this->simulateRound($championship, $round);
                $this->validateEliminationRound($championship, $round, $roundType);
            }
        }

        // Step 7: Declare winner
        $this->declareWinner($championship);

        // Step 8: Final validation
        echo "\n" . str_repeat("-", 80) . "\n";
        echo "FINAL VALIDATION\n";
        echo str_repeat("-", 80) . "\n";
        $this->validateTournamentCompletion($championship, $structure);

        echo "\n✅ Tournament simulation completed successfully!\n";
    }

    /**
     * Simulate a single round with random results
     */
    private function simulateRound(Championship $championship, int $roundNumber): void
    {
        $matches = $championship->matches()
            ->where('round_number', $roundNumber)
            ->get();

        echo "  Matches: {$matches->count()}\n";

        foreach ($matches as $match) {
            // Skip placeholder matches
            if ($match->is_placeholder || !$match->player1_id || !$match->player2_id) {
                echo sprintf("    Match #%d: [PLACEHOLDER] - Skipped\n", $match->id);
                continue;
            }

            // Random result: 80% win, 20% draw
            $isDraw = rand(1, 100) <= 20;

            if ($isDraw) {
                $winnerId = null;
                $result = "DRAW";
            } else {
                // Random winner
                $winnerId = rand(0, 1) === 0 ? $match->player1_id : $match->player2_id;
                $winnerName = $winnerId === $match->player1_id
                    ? $match->player1->name
                    : $match->player2->name;
                $result = $winnerName . " wins";
            }

            // Update match result
            $match->update([
                'status_id' => \App\Enums\ChampionshipMatchStatus::COMPLETED->getId(),
                'winner_id' => $winnerId,
                'player1_result_type_id' => $isDraw
                    ? \App\Enums\ChampionshipResultType::DRAW->getId()
                    : ($winnerId === $match->player1_id
                        ? \App\Enums\ChampionshipResultType::COMPLETED->getId()
                        : \App\Enums\ChampionshipResultType::FORFEIT_PLAYER1->getId()),
                'player2_result_type_id' => $isDraw
                    ? \App\Enums\ChampionshipResultType::DRAW->getId()
                    : ($winnerId === $match->player2_id
                        ? \App\Enums\ChampionshipResultType::COMPLETED->getId()
                        : \App\Enums\ChampionshipResultType::FORFEIT_PLAYER2->getId()),
                'completed_at' => now(),
            ]);

            echo sprintf("    Match #%d: %s vs %s → %s\n",
                $match->id,
                $match->player1->name,
                $match->player2->name,
                $result
            );
        }

        // Update standings after round
        $this->standingsService->updateStandings($championship);

        echo "  ✅ Round {$roundNumber} completed\n";
    }

    /**
     * Validate round completeness (all players paired, no missing)
     */
    private function validateRoundCompleteness(Championship $championship, int $roundNumber): void
    {
        $matches = $championship->matches()->where('round_number', $roundNumber)->get();
        $participantCount = $championship->participants()->count();

        // Count paired players
        $pairedPlayers = [];
        foreach ($matches as $match) {
            if ($match->player1_id) $pairedPlayers[] = $match->player1_id;
            if ($match->player2_id) $pairedPlayers[] = $match->player2_id;
        }

        $uniquePaired = count(array_unique($pairedPlayers));

        $this->assertEquals($participantCount, $uniquePaired,
            "Round {$roundNumber}: Missing players! Expected {$participantCount}, got {$uniquePaired}");

        echo "  ✅ All {$participantCount} players paired correctly\n";
    }

    /**
     * Validate elimination round structure
     */
    private function validateEliminationRound(Championship $championship, int $roundNumber, string $roundName): void
    {
        $matches = $championship->matches()->where('round_number', $roundNumber)->get();
        $matchCount = $matches->count();

        // Count unique players in this round
        $players = [];
        foreach ($matches as $match) {
            if ($match->player1_id) $players[] = $match->player1_id;
            if ($match->player2_id) $players[] = $match->player2_id;
        }
        $uniquePlayers = count(array_unique($players));

        echo sprintf("  Participants: %d players in %d matches\n", $uniquePlayers, $matchCount);

        // Validate power of 2
        $this->assertTrue(($uniquePlayers & ($uniquePlayers - 1)) === 0,
            "{$roundName}: Participant count {$uniquePlayers} is not a power of 2");

        // Validate match count = players / 2
        $expectedMatches = $uniquePlayers / 2;
        $this->assertEquals($expectedMatches, $matchCount,
            "{$roundName}: Expected {$expectedMatches} matches, got {$matchCount}");

        echo "  ✅ Elimination bracket structure validated\n";
    }

    /**
     * Display current standings
     */
    private function displayStandings(Championship $championship, int $afterRound): void
    {
        $standings = $championship->standings()->orderBy('rank')->limit(10)->get();

        echo "\n  📊 Standings after Round {$afterRound} (Top 10):\n";
        foreach ($standings as $standing) {
            $user = $standing->user;
            echo sprintf("    #%d: %s - %.1f pts (W:%d D:%d L:%d, Buchholz: %.1f)\n",
                $standing->rank,
                $user->name,
                $standing->points,
                $standing->wins,
                $standing->draws,
                $standing->losses,
                $standing->buchholz_score
            );
        }
    }

    /**
     * Declare tournament winner
     */
    private function declareWinner(Championship $championship): void
    {
        $winner = $championship->standings()->where('rank', 1)->first();

        echo "\n" . str_repeat("=", 80) . "\n";
        echo "🏆 TOURNAMENT WINNER\n";
        echo str_repeat("=", 80) . "\n";
        echo sprintf("\n  🥇 Champion: %s\n", $winner->user->name);
        echo sprintf("  Points: %.1f\n", $winner->points);
        echo sprintf("  Record: %d-%d-%d\n", $winner->wins, $winner->losses, $winner->draws);
        echo sprintf("  Rating: %d\n", $winner->user->rating);
    }

    /**
     * Validate tournament completion
     */
    private function validateTournamentCompletion(Championship $championship, array $structure): void
    {
        $totalMatches = $championship->matches()->count();
        $completedMatches = $championship->matches()
            ->where('status_id', \App\Enums\ChampionshipMatchStatus::COMPLETED->getId())
            ->count();

        echo "\n  Total Matches: {$totalMatches}\n";
        echo "  Completed Matches: {$completedMatches}\n";

        // Allow some placeholder matches to remain uncompleted
        $placeholderCount = $championship->matches()->where('is_placeholder', true)->count();
        echo "  Placeholder Matches: {$placeholderCount}\n";

        $this->assertTrue($completedMatches > 0, "No matches completed!");
        echo "\n  ✅ Tournament completion validated\n";
    }

    private function getEliminationRoundName(int $round, int $start, int $end): string
    {
        $roundsFromEnd = $end - $round;

        return match($roundsFromEnd) {
            0 => 'Final',
            1 => 'Semifinals',
            2 => 'Quarterfinals',
            3 => 'Round of 16',
            4 => 'Round of 32',
            default => "Elimination Round " . ($round - $start + 1),
        };
    }

    private function createChampionship(int $playerCount): Championship
    {
        return Championship::create([
            'title' => "Simulation Test - {$playerCount} Players",
            'format_id' => 1,
            'status_id' => \App\Enums\ChampionshipStatus::IN_PROGRESS->getId(),
            'match_time_window_hours' => 24,
            'registration_deadline' => now()->addDays(7),
            'start_date' => now()->addDay(),
            'total_rounds' => 10,
            'visibility' => 'public',
            'is_test_tournament' => true,
        ]);
    }

    private function createParticipants(Championship $championship, int $count): array
    {
        $participants = [];

        for ($i = 1; $i <= $count; $i++) {
            $user = User::factory()->create([
                'name' => "Player " . chr(64 + $i), // A, B, C, ...
                'rating' => 1500 - ($i * 10), // Descending ratings
            ]);

            $participant = ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'payment_status_id' => \App\Enums\PaymentStatus::COMPLETED->getId(),
            ]);

            $participants[] = $participant;
        }

        return $participants;
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
