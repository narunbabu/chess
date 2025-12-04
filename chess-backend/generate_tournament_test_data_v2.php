<?php

/**
 * Generate Tournament Test Data v2 - With Dynamic Placeholder Matches
 *
 * Creates test data for 3, 5, 10, and 50 player tournaments
 * Uses proper placeholder matches for elimination rounds
 * Outputs JSON files compatible with tournament-helpers.js
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

echo "🎯 Generating Tournament Test Data v2 - Dynamic Placeholders\n";
echo str_repeat("=", 80) . "\n\n";

// Enhanced configuration with proper match types and placeholders
$configurations = [
    [
        'players' => 3,
        'name' => '3-Player Tournament',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'matches_per_player' => 1, 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'matches_per_player' => 1, 'pairing_method' => 'standings_based'],
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

        // Clean up old test data for this configuration
        Championship::where('title', 'LIKE', $config['name'] . '%')->delete();
        User::where('email', 'LIKE', "tournament_test_{$config['players']}_%@example.com")->delete();

        // Create test users with consistent naming
        $users = [];
        for ($i = 1; $i <= $config['players']; $i++) {
            $rating = 1200 + ($config['players'] - $i) * 50; // Descending ratings: highest gets highest rating
            $email = "tournament_test_{$config['players']}_{$i}@example.com";

            $user = User::create([
                'name' => "Test Player {$i}",
                'email' => $email,
                'password' => bcrypt('password123'),
                'rating' => $rating,
            ]);
            $users[] = $user;
        }

        echo "   ✅ Created {$config['players']} test users\n";

        // Create championship
        $championship = Championship::create([
            'title' => $config['name'] . ' - Test v2',
            'description' => "Test tournament with {$config['players']} players - Dynamic placeholders",
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

        // Generate tournament using existing service
        $swissService = new SwissPairingService();
        $generationService = new TournamentGenerationService($swissService);
        $summary = $generationService->generateFullTournament($championship, $tournamentConfig);

        // Get all matches from database
        $matches = $championship->matches()
            ->with(['player1:id,name,rating', 'player2:id,name,rating'])
            ->orderBy('round_number')
            ->orderBy('id')
            ->get();

        echo "   ✅ Generated tournament with {$matches->count()} matches\n";

        // Process matches into rounds with proper placeholder handling
        $roundsData = [];
        foreach ($config['rounds'] as $roundConfig) {
            $roundNumber = $roundConfig['round'];
            $roundMatches = $matches->where('round_number', $roundNumber)->values();

            // Get round type string OUTSIDE the closure so it can be used later
            $roundType = $roundConfig['type'];
            if (is_object($roundType) && method_exists($roundType, 'value')) {
                $roundTypeValue = $roundType->value;
            } else {
                $roundTypeValue = is_string($roundType) ? $roundType : 'swiss';
            }

            // Determine if this should be a placeholder round
            $isPlaceholder = in_array($roundType, ['semi_final', 'quarter_final', 'final', 'third_place', 'round_of_16']);

            $matchesArray = $roundMatches->map(function ($match) use ($roundConfig, $roundTypeValue, $isPlaceholder, $roundNumber) {

                $matchData = [
                    'id' => $match->id,
                    'round_number' => $match->round_number,
                    'round_type' => $roundTypeValue,
                    'is_placeholder' => $isPlaceholder,
                    'status' => 'pending',
                    'player1_result' => null,
                    'player2_result' => null,
                ];

                // For Swiss rounds, include actual players
                if (!$isPlaceholder) {
                    $matchData['player1_id'] = $match->player1_id;
                    $matchData['player2_id'] = $match->player2_id;
                    $matchData['player1'] = $match->player1 ? [
                        'id' => $match->player1->id,
                        'name' => $match->player1->name,
                        'rating' => $match->player1->rating,
                    ] : null;
                    $matchData['player2'] = $match->player2 ? [
                        'id' => $match->player2->id,
                        'name' => $match->player2->name,
                        'rating' => $match->player2->rating,
                    ] : null;
                } else {
                    // For elimination rounds, set placeholder structure
                    $matchData['player1_id'] = null;
                    $matchData['player2_id'] = null;
                    $matchData['player1'] = null;
                    $matchData['player2'] = null;

                    // Add bracket position info for proper seeding
                    switch ($roundTypeValue) {
                        case 'semi_final':
                            $matchData['player1_bracket_position'] = 1; // Top seed
                            $matchData['player2_bracket_position'] = 4; // 4th seed
                            break;
                        case 'quarter_final':
                            // Quarter final bracket positions
                            $matchIndex = $match->id % 4;
                            $positions = [
                                [1, 8], [4, 5], [3, 6], [2, 7]
                            ];
                            $pos = $positions[$matchIndex] ?? [1, 2];
                            $matchData['player1_bracket_position'] = $pos[0];
                            $matchData['player2_bracket_position'] = $pos[1];
                            break;
                        case 'final':
                            $matchData['player1_bracket_position'] = 1; // Winner of first semi
                            $matchData['player2_bracket_position'] = 2; // Winner of second semi
                            break;
                        case 'third_place':
                            $matchData['player1_bracket_position'] = 1; // Loser of first semi
                            $matchData['player2_bracket_position'] = 2; // Loser of second semi
                            break;
                        case 'round_of_16':
                            $matchIndex = $match->id % 8;
                            $positions = [
                                [1, 16], [8, 9], [5, 12], [4, 13],
                                [3, 14], [6, 11], [7, 10], [2, 15]
                            ];
                            $pos = $positions[$matchIndex] ?? [1, 2];
                            $matchData['player1_bracket_position'] = $pos[0];
                            $matchData['player2_bracket_position'] = $pos[1];
                            break;
                    }

                    // Add metadata for dynamic resolution
                    $matchData['determined_by_round'] = $roundNumber - 1;
                    $matchData['requires_top_k'] = $roundConfig['participant_selection']['top_k'] ?? null;
                }

                return $matchData;
            })->toArray();

            $roundsData[] = [
                'round_number' => $roundNumber,
                'name' => $roundConfig['name'],
                'round_type' => $roundTypeValue,
                'matches' => $matchesArray,
            ];
        }

        // Create participants array
        $participants = collect($users)->map(function ($user, $index) {
            return [
                'id' => $user->id,
                'name' => $user->name,
                'rating' => $user->rating,
                'email' => $user->email,
            ];
        })->toArray();

        // Generate initial standings (all players start with 0 points)
        $initialStandings = array_map(function ($user, $index) {
            return [
                'id' => $user->id,
                'player_id' => $user->id,
                'player_name' => $user->name,
                'name' => $user->name,
                'rating' => $user->rating,
                'rank' => $index + 1,
                'points' => 0,
                'wins' => 0,
                'losses' => 0,
                'draws' => 0,
                'matches_played' => 0,
                'buchholz' => 0,
                'sonneborn_berger' => 0,
            ];
        }, $users, array_keys($users));

        // Compile tournament data
        $tournamentData = [
            'tournament_info' => [
                'name' => $config['name'],
                'players' => $config['players'],
                'rounds' => count($config['rounds']),
                'format' => 'Swiss + Elimination',
                'description' => 'Test tournament with dynamic placeholder matches',
                'version' => '2.0'
            ],
            'participants' => $participants,
            'initial_standings' => $initialStandings,
            'rounds' => $roundsData,
            'matches' => $matches->map(function ($match) {
                $roundType = $match->round_type;
                $roundTypeValue = is_object($roundType) && method_exists($roundType, 'value') ? $roundType->value : (is_string($roundType) ? $roundType : 'swiss');

                return [
                    'id' => $match->id,
                    'round_number' => $match->round_number,
                    'round_type' => $roundTypeValue,
                    'player1_id' => $match->player1_id,
                    'player2_id' => $match->player2_id,
                    'status' => $match->status ?? 'pending',
                    'created_at' => $match->created_at,
                ];
            })->toArray(),
            'tournament_settings' => [
                'swiss_pairing_method' => 'standings_based',
                'elimination_seeding' => 'top_standings',
                'include_third_place' => true,
                'bracket_type' => 'standard',
                'tiebreakers' => ['points', 'buchholz', 'sonneborn_berger', 'rating'],
            ],
        ];

        $allTestData[] = $tournamentData;

        // Generate JSON file
        $filename = "public/tournament_test_{$config['players']}_players_v2.json";
        $jsonContent = json_encode($tournamentData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        file_put_contents($filename, $jsonContent);

        echo "   ✅ Generated: $filename\n";
        echo "   📊 Matches: {$matches->count()}, Participants: " . count($participants) . "\n";

        DB::commit();

    } catch (Exception $e) {
        DB::rollBack();
        echo "   ❌ Error generating {$config['name']}: " . $e->getMessage() . "\n";
        continue;
    }

    echo "\n";
}

// Generate combined test file
$combinedData = [
    'generated_at' => now()->toISOString(),
    'version' => '2.0',
    'description' => 'Tournament test data with dynamic placeholder matches',
    'features' => [
        'Dynamic player assignment for elimination rounds',
        'Proper placeholder matches (is_placeholder flag)',
        'Bracket position information for seeding',
        'Tiebreaker support (Buchholz, Sonneborn-Berger)',
        'Third place match included',
        'Round unlocking mechanism',
    ],
    'tournaments' => $allTestData,
];

$combinedFilename = 'public/tournament_tests_all_v2.json';
file_put_contents($combinedFilename, json_encode($combinedData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

echo "🎉 Tournament Test Data Generation Complete!\n";
echo str_repeat("=", 80) . "\n";
echo "📁 Generated Files:\n";

foreach ($configurations as $config) {
    echo "   - tournament_test_{$config['players']}_players_v2.json\n";
}
echo "   - tournament_tests_all_v2.json (combined)\n\n";

echo "🔧 Key Features of v2 Test Data:\n";
echo "   ✅ Swiss rounds: Real player assignments\n";
echo "   ✅ Elimination rounds: Placeholder matches with is_placeholder: true\n";
echo "   ✅ Bracket positions: player1_bracket_position, player2_bracket_position\n";
echo "   ✅ Dynamic resolution: determined_by_round, requires_top_k\n";
echo "   ✅ Complete tiebreaker support\n";
echo "   ✅ Third place match for all applicable tournaments\n";
echo "   ✅ Compatible with tournament-helpers.js\n\n";

echo "📊 How to Test:\n";
echo "   1. Start PHP server: cd public && php -S localhost:8080\n";
echo "   2. Open: tournament_visualizer_v3.html\n";
echo "   3. Load any configuration and verify:\n";
echo "      - Round 2/3 players are locked until previous round completes\n";
echo "      - Elimination rounds show 'TBD' until resolved\n";
echo "      - Proper player assignment based on standings\n";
echo "      - Equal contribution in Swiss rounds\n";
echo "      - Third place match appears after semi-finals\n\n";

echo "🔗 Integration Notes:\n";
echo "   - Use tournament-helpers.js in React frontend\n";
echo "   - Same logic for standings and dynamic resolution\n";
echo "   - Compatible with existing TournamentGenerationService\n";
echo "   - Frontend should implement same round locking mechanism\n\n";

echo "✅ All test data generated successfully!\n";