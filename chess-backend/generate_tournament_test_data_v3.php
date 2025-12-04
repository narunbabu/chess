<?php

/**
 * Generate Tournament Test Data v3 - With Backend Fix Support
 *
 * Creates test data for 3, 5, 10, and 50 player tournaments
 * Uses proper placeholder matches with determined_by_round for backend fix
 * Outputs JSON files compatible with fixed PlaceholderMatchAssignmentService
 *
 * IMPROVEMENTS IN V3:
 * - Adds 'determined_by_round' metadata for elimination rounds
 * - Proper round type detection for backend service
 * - Fair Buchholz tiebreaker data
 * - Compatible with PlaceholderMatchAssignmentService fix
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

echo "🎯 Generating Tournament Test Data v3 - Backend Fix Compatible\n";
echo str_repeat("=", 80) . "\n\n";

// Configuration with proper determined_by_round metadata
$configurations = [
    [
        'players' => 3,
        'name' => '3-Player Tournament v3',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 1],
        ],
    ],
    [
        'players' => 5,
        'name' => '5-Player Tournament v3',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 1],
            ['round' => 3, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 2],
        ],
    ],
    [
        'players' => 10,
        'name' => '10-Player Tournament v3',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'pairing_method' => 'standings_based', 'determined_by' => 2],
            ['round' => 4, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 3],
            ['round' => 5, 'name' => 'Third Place', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 4],
            ['round' => 6, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 4],
        ],
    ],
    [
        'players' => 50,
        'name' => '50-Player Tournament v3',
        'rounds' => [
            ['round' => 1, 'name' => 'Round 1', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'random_seeded'],
            ['round' => 2, 'name' => 'Round 2', 'type' => 'swiss', 'participant_selection' => 'all', 'pairing_method' => 'standings_based'],
            ['round' => 3, 'name' => 'Round of 16', 'type' => 'round_of_16', 'participant_selection' => ['top_k' => 16], 'pairing_method' => 'standings_based', 'determined_by' => 2],
            ['round' => 4, 'name' => 'Quarter Final', 'type' => 'quarter_final', 'participant_selection' => ['top_k' => 8], 'pairing_method' => 'standings_based', 'determined_by' => 3],
            ['round' => 5, 'name' => 'Semi Final', 'type' => 'semi_final', 'participant_selection' => ['top_k' => 4], 'pairing_method' => 'standings_based', 'determined_by' => 4],
            ['round' => 6, 'name' => 'Third Place', 'type' => 'third_place', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 5],
            ['round' => 7, 'name' => 'Final', 'type' => 'final', 'participant_selection' => ['top_k' => 2], 'pairing_method' => 'standings_based', 'determined_by' => 5],
        ],
    ],
];

$allTestData = [];

foreach ($configurations as $config) {
    echo "🔄 Generating: {$config['name']} ({$config['players']} players)\n";

    DB::beginTransaction();
    try {
        // Create test championship
        $championship = Championship::create([
            'title' => $config['name'],
            'description' => 'Test tournament with dynamic placeholder matches - version 3',
            'format_id' => 1, // Swiss + Elimination format
            'status_id' => \App\Enums\ChampionshipStatus::REGISTRATION_OPEN->getId(),
            'start_date' => now()->addDays(7),
            'registration_deadline' => now()->addDays(5),
            'entry_fee' => 0,
            'max_participants' => $config['players'],
            'total_rounds' => count($config['rounds']),
            'swiss_rounds' => 1,
            'top_qualifiers' => 4,
            'created_by' => 1,
        ]);

        // Create test users and participants
        $baseUserId = 200 + ($config['players'] * 10); // Unique IDs per config
        $participants = [];

        for ($i = 1; $i <= $config['players']; $i++) {
            $userId = $baseUserId + $i;

            // Create user if doesn't exist
            $user = User::firstOrCreate(
                ['id' => $userId],
                [
                    'name' => "Player " . chr(64 + $i), // Player A, B, C, etc.
                    'email' => "tournament_test_{$config['players']}_v3_{$i}@example.com",
                    'password' => bcrypt('password'),
                    'rating' => 1500 - ($i - 1) * 50, // Descending ratings
                ]
            );

            // Create participant
            $participant = ChampionshipParticipant::create([
                'championship_id' => $championship->id,
                'user_id' => $user->id,
                'payment_status_id' => \App\Enums\PaymentStatus::COMPLETED->getId(),
                'registration_date' => now(),
            ]);

            $participants[] = $participant;
        }

        // Generate tournament structure
        $tournamentConfig = TournamentConfig::fromArray([
            'round_structure' => $config['rounds'],
        ]);
        $generator = app(TournamentGenerationService::class);
        $generator->generateFullTournament($championship, $tournamentConfig);

        // Reload championship with all relationships
        $championship = Championship::with([
            'participants.user',
            'matches.player1',
            'matches.player2',
            'standings'
        ])->find($championship->id);

        // Export to JSON format
        $testData = exportChampionshipData($championship, $config);
        $allTestData[$config['players']] = $testData;

        // Save individual file
        $filename = "public/tournament_test_{$config['players']}_players_v4.json";
        file_put_contents(
            __DIR__ . '/' . $filename,
            json_encode($testData, JSON_PRETTY_PRINT)
        );

        echo "✅ Generated: {$filename}\n";
        echo "   - Participants: {$championship->participants->count()}\n";
        echo "   - Matches: {$championship->matches->count()}\n";
        echo "   - Rounds: " . count($config['rounds']) . "\n\n";

        DB::rollBack(); // Don't save to database, just generate JSON
    } catch (\Exception $e) {
        DB::rollBack();
        echo "❌ Error generating {$config['name']}: {$e->getMessage()}\n\n";
    }
}

// Save combined file
$combinedFilename = "public/tournament_tests_all_v3.json";
file_put_contents(
    __DIR__ . '/' . $combinedFilename,
    json_encode($allTestData, JSON_PRETTY_PRINT)
);

echo str_repeat("=", 80) . "\n";
echo "✅ All test files generated successfully!\n";
echo "📁 Files saved in: chess-backend/public/\n";
echo "📋 Combined file: {$combinedFilename}\n\n";

/**
 * Export championship data to JSON format
 */
function exportChampionshipData($championship, $config)
{
    // Build participants array
    $participants = $championship->participants->map(function ($participant) {
        return [
            'id' => $participant->user_id,
            'name' => $participant->user->name,
            'rating' => $participant->user->rating,
            'email' => $participant->user->email,
        ];
    })->toArray();

    // Build initial standings
    $standings = $championship->standings->map(function ($standing) use ($championship) {
        $user = $championship->participants->firstWhere('user_id', $standing->user_id)?->user;
        return [
            'id' => $standing->id,
            'player_id' => $standing->user_id,
            'player_name' => $user->name ?? 'Unknown',
            'name' => $user->name ?? 'Unknown',
            'rating' => $user->rating ?? 0,
            'rank' => $standing->rank ?? 0,
            'points' => $standing->points,
            'wins' => $standing->wins,
            'losses' => $standing->losses,
            'draws' => $standing->draws,
            'matches_played' => $standing->matches_played,
            'buchholz' => $standing->buchholz_score ?? 0,
            'sonneborn_berger' => $standing->sonneborn_berger ?? 0,
        ];
    })->toArray();

    // Build rounds array with matches
    $roundsGrouped = $championship->matches->groupBy('round_number');
    $rounds = [];

    foreach ($config['rounds'] as $roundConfig) {
        $roundNumber = $roundConfig['round'];
        $matches = $roundsGrouped->get($roundNumber, collect());

        $roundMatches = $matches->map(function ($match) use ($roundConfig) {
            $isPlaceholder = $match->isPlaceholder();

            $matchData = [
                'id' => $match->id,
                'round_number' => $match->round_number,
                'round_type' => $roundConfig['type'],
                'is_placeholder' => $isPlaceholder,
                'status' => 'pending',
                'player1_result' => null,
                'player2_result' => null,
            ];

            if ($isPlaceholder) {
                // Placeholder match with metadata
                $positions = $match->placeholder_positions ?? [];
                $matchData['player1_id'] = null;
                $matchData['player2_id'] = null;
                $matchData['player1'] = null;
                $matchData['player2'] = null;
                $matchData['player1_bracket_position'] = extractBracketPosition($positions['player1'] ?? null);
                $matchData['player2_bracket_position'] = extractBracketPosition($positions['player2'] ?? null);

                // 🎯 CRITICAL: Add determined_by_round for backend fix
                if (isset($roundConfig['determined_by'])) {
                    $matchData['determined_by_round'] = $roundConfig['determined_by'];
                }

                // Add requires_top_k if from top_k selection
                if (isset($roundConfig['participant_selection']['top_k'])) {
                    $matchData['requires_top_k'] = $roundConfig['participant_selection']['top_k'];
                }
            } else {
                // Regular match with assigned players
                $matchData['player1_id'] = $match->player1_id;
                $matchData['player2_id'] = $match->player2_id;
                $matchData['player1'] = [
                    'id' => $match->player1->id,
                    'name' => $match->player1->name,
                    'rating' => $match->player1->rating,
                ];
                $matchData['player2'] = [
                    'id' => $match->player2->id,
                    'name' => $match->player2->name,
                    'rating' => $match->player2->rating,
                ];
            }

            return $matchData;
        })->toArray();

        $rounds[] = [
            'round_number' => $roundNumber,
            'name' => $roundConfig['name'],
            'round_type' => $roundConfig['type'],
            'matches' => $roundMatches,
        ];
    }

    // Build matches array (flat list)
    $matchesList = $championship->matches->map(function ($match) {
        return [
            'id' => $match->id,
            'round_number' => $match->round_number,
            'round_type' => $match->getRoundTypeEnum()->value,
            'player1_id' => $match->player1_id,
            'player2_id' => $match->player2_id,
            'status' => 'pending',
            'created_at' => $match->created_at->toISOString(),
        ];
    })->toArray();

    return [
        'tournament_info' => [
            'name' => $championship->name,
            'players' => $championship->participants->count(),
            'rounds' => count($config['rounds']),
            'format' => $championship->format,
            'description' => $championship->description,
            'version' => '3.0',
        ],
        'participants' => $participants,
        'initial_standings' => $standings,
        'rounds' => $rounds,
        'matches' => $matchesList,
        'tournament_settings' => [
            'swiss_pairing_method' => 'standings_based',
            'elimination_seeding' => 'top_standings',
            'include_third_place' => true,
            'bracket_type' => 'standard',
            'tiebreakers' => ['points', 'buchholz', 'sonneborn_berger', 'rating'],
        ],
    ];
}

/**
 * Extract bracket position from placeholder position string
 */
function extractBracketPosition($positionString)
{
    if (!$positionString) {
        return null;
    }

    // Extract number from 'rank_1' => 1
    if (preg_match('/rank_(\d+)/', $positionString, $matches)) {
        return (int)$matches[1];
    }

    return null;
}

echo "🎉 Done!\n";
