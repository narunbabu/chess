<?php

/**
 * Generate Tournament Test Data for Multiple Configurations
 *
 * Creates test data for 3, 5, 10, and 50 player tournaments
 * Outputs JSON files that can be visualized in the HTML test interface
 */

require __DIR__ . '/vendor/autoload.php';

use App\Models\Championship;
use App\Models\User;
use App\Models\ChampionshipParticipant;
use App\ValueObjects\TournamentConfig;
use App\Services\TournamentGenerationService;
use App\Services\SwissPairingService;
use Illuminate\Support\Facades\DB;

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🎯 Generating Tournament Test Data\n";
echo str_repeat("=", 80) . "\n\n";

// Configuration for different player counts
$configurations = [
    [
        'players' => 3,
        'name' => '3-Player Tournament',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
        ],
    ],
    [
        'players' => 5,
        'name' => '5-Player Tournament',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 4, 'name' => 'Third Place Match', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 5, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
        ],
    ],
    [
        'players' => 10,
        'name' => '10-Player Tournament',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 4, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 5, 'name' => 'Third Place Match', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 6, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
        ],
    ],
    [
        'players' => 50,
        'name' => '50-Player Tournament',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Round 3', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 4, 'name' => 'Round of 16', 'type' => 'round_of_16', 'participant_selection' => ['top_k' => 16], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 5, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 6, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 7, 'name' => 'Third Place Match', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
            ['round' => 8, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
        ],
    ],
];

$allTestData = [];

foreach ($configurations as $config) {
    echo "🔄 Generating: {$config['name']} ({$config['players']} players)\n";

    try {
        DB::beginTransaction();

        // Create or reuse test users
        $users = [];
        for ($i = 1; $i <= $config['players']; $i++) {
            $rating = 1200 + ($config['players'] - $i) * 50; // Descending ratings
            $email = "tournament_test_player{$i}@example.com";

            // Check if user exists, if not create
            $user = User::where('email', $email)->first();
            if (!$user) {
                $user = User::create([
                    'name' => "Test Player {$i}",
                    'email' => $email,
                    'password' => bcrypt('password123'),
                    'rating' => $rating,
                ]);
            } else {
                // Update rating for consistency
                $user->rating = $rating;
                $user->save();
            }
            $users[] = $user;
        }

        echo "   ✅ Prepared {$config['players']} test users\n";

        // Create championship
        $championship = Championship::create([
            'title' => $config['name'] . ' - Test',
            'description' => "Test tournament with {$config['players']} players",
            'max_participants' => $config['players'],
            'start_date' => now()->addDays(1),
            'registration_deadline' => now()->addHours(12),
            'match_time_window_hours' => 48,
            'created_by' => $users[0]->id,
            'total_rounds' => count($config['rounds']),
            'format_id' => 1, // Swiss + Elimination
        ]);

        // Add participants
        foreach ($users as $user) {
            ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
            ]);
        }

        // Create tournament config
        $tournamentConfig = TournamentConfig::fromArray([
            'round_structure' => $config['rounds'],
        ]);

        // Generate tournament
        $swissService = new SwissPairingService();
        $generationService = new TournamentGenerationService($swissService);
        $summary = $generationService->generateFullTournament($championship, $tournamentConfig);

        // Collect match data
        $matches = $championship->matches()
            ->with(['player1:id,name,rating', 'player2:id,name,rating'])
            ->orderBy('round_number')
            ->orderBy('id')
            ->get();

        $roundsData = [];
        foreach ($config['rounds'] as $roundConfig) {
            $roundNumber = $roundConfig['round'];
            $roundMatches = $matches->where('round_number', $roundNumber)->values();

            $matchesArray = $roundMatches->map(function ($match) {
                $roundType = $match->round_type;
                if (is_object($roundType) && method_exists($roundType, 'value')) {
                    $roundTypeValue = $roundType->value;
                } else {
                    $roundTypeValue = is_string($roundType) ? $roundType : 'swiss';
                }

                return [
                    'id' => $match->id,
                    'round_number' => $match->round_number,
                    'player1' => $match->player1 ? [
                        'id' => $match->player1->id,
                        'name' => $match->player1->name,
                        'rating' => $match->player1->rating,
                    ] : null,
                    'player2' => $match->player2 ? [
                        'id' => $match->player2->id,
                        'name' => $match->player2->name,
                        'rating' => $match->player2->rating,
                    ] : null,
                    'winner_id' => null, // To be set in UI
                    'round_type' => $roundTypeValue,
                ];
            })->toArray();

            $roundsData[] = [
                'round_number' => $roundNumber,
                'name' => $roundConfig['name'],
                'type' => $roundConfig['type'],
                'matches' => $matchesArray,
            ];
        }

        // Generate initial standings (all players start with 0 points)
        $initialStandings = array_map(function ($user, $index) {
            return [
                'rank' => $index + 1,
                'player_id' => $user->id,
                'player_name' => $user->name,
                'rating' => $user->rating,
                'points' => 0,
                'wins' => 0,
                'losses' => 0,
                'draws' => 0,
                'matches_played' => 0,
            ];
        }, $users, array_keys($users));

        $testData = [
            'config_name' => $config['name'],
            'player_count' => $config['players'],
            'championship_id' => $championship->id,
            'participants' => array_map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'rating' => $user->rating,
                ];
            }, $users),
            'rounds' => $roundsData,
            'summary' => $summary,
            'initial_standings' => $initialStandings,
        ];

        $allTestData[] = $testData;

        // Save individual JSON file
        $filename = "tournament_test_{$config['players']}_players.json";
        file_put_contents(
            __DIR__ . "/public/" . $filename,
            json_encode($testData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        echo "   ✅ Generated {$summary['total_matches']} matches across {$summary['total_rounds']} rounds\n";
        echo "   💾 Saved: public/{$filename}\n\n";

        DB::rollBack();

    } catch (\Exception $e) {
        DB::rollBack();
        echo "   ❌ Error: {$e->getMessage()}\n\n";
        continue;
    }
}

// Save combined JSON file
file_put_contents(
    __DIR__ . "/public/tournament_tests_all.json",
    json_encode($allTestData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
);

echo "✅ All test data generated successfully!\n";
echo "📁 Files saved in public/ directory:\n";
echo "   - tournament_test_3_players.json\n";
echo "   - tournament_test_5_players.json\n";
echo "   - tournament_test_10_players.json\n";
echo "   - tournament_test_50_players.json\n";
echo "   - tournament_tests_all.json (combined)\n";
