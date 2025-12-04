<?php

require __DIR__ . '/vendor/autoload.php';

use App\Services\TournamentStructureCalculator;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "\n========================================\n";
echo "Tournament Structure Calculator Output\n";
echo "========================================\n";

foreach ([3, 5, 10, 50] as $playerCount) {
    echo "\n\n{$playerCount} Players:\n";
    echo "-------------------\n";
    $structure = TournamentStructureCalculator::calculateStructure($playerCount);

    echo "Swiss Rounds: {$structure['swiss_rounds']}\n";
    echo "Top K: {$structure['top_k']}\n";
    echo "Elimination Rounds: {$structure['elimination_rounds']}\n";
    echo "Total Rounds: {$structure['total_rounds']}\n";
    echo "Structure Name: {$structure['structure_name']}\n";
}

echo "\n";
