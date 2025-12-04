<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';

$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;

$champ = Championship::find(21);

if ($champ) {
    echo "Tournament ID: " . $champ->id . "\n";
    echo "Name: " . $champ->name . "\n";
    echo "Format: " . $champ->format . "\n";
    echo "Tournament Config:\n";
    echo json_encode($champ->tournament_config, JSON_PRETTY_PRINT) . "\n\n";

    echo "Matches:\n";
    $matches = $champ->matches()->orderBy('round_number')->get();
    foreach ($matches as $match) {
        $status = is_string($match->status) ? $match->status : $match->status->value;
        $roundType = is_string($match->round_type) ? $match->round_type : $match->round_type->value;
        echo "Round {$match->round_number}: P{$match->player1_id} vs P{$match->player2_id} (Status: {$status}, Type: {$roundType})\n";
    }
} else {
    echo "Tournament 17 not found!\n";
}