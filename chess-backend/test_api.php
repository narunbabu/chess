<?php

require __DIR__ . '/vendor/autoload.php';

use Illuminate\Http\Request;
use App\Http\Controllers\TournamentVisualizerController;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Create a mock request
$request = new Request();
$request->merge([
    'player_count' => 10,
    'title' => 'Test Tournament API'
]);

// Create controller with dependencies
$tournamentGenerator = $app->make(\App\Services\TournamentGenerationService::class);
$standingsCalculator = $app->make(\App\Services\StandingsCalculatorService::class);
$placeholderService = $app->make(\App\Services\PlaceholderMatchAssignmentService::class);

$controller = new TournamentVisualizerController($tournamentGenerator, $standingsCalculator, $placeholderService);
$result = $controller->createTournament($request);

echo "🏆 TOURNAMENT STRUCTURE TEST\n";
echo "============================\n\n";

echo "\n";

$data = $result->getData();
echo "DEBUG: Response structure:\n";
echo json_encode($data, JSON_PRETTY_PRINT) . "\n\n";

$rounds = $data->rounds ?? [];

if (empty($rounds) && isset($data->data)) {
    $rounds = $data->data->rounds ?? [];
}

echo "DEBUG: Rounds count: " . count($rounds) . "\n";

foreach ($rounds as $round) {
    echo "=== {$round->name} === ({$round->round_type})\n";

    foreach ($round->matches as $match) {
        if (property_exists($match, 'player1') && $match->player1 && property_exists($match, 'player2') && $match->player2) {
            echo sprintf(
                "  %s (%d) vs %s (%d)\n",
                $match->player1->name,
                $match->player1->rating,
                $match->player2->name,
                $match->player2->rating
            );
        } else {
            echo "  TBD vs TBD (placeholder - will be assigned after previous round completion)\n";
        }
    }
    echo "\n";
}

echo "✅ API Test completed\n";