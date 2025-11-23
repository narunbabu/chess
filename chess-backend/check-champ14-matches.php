<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChampionshipMatch;

echo "🔍 Checking Championship 14 Matches Structure\n";
echo str_repeat("=", 50) . "\n";

$matches = ChampionshipMatch::where('championship_id', 14)->get();

echo "Total matches: " . $matches->count() . "\n\n";

foreach ($matches as $match) {
    echo "Match ID: {$match->id}\n";
    echo "  - Round: " . ($match->round_number ?? 'NULL') . "\n";
    echo "  - Status: " . ($match->status ?? 'NULL') . "\n";
    echo "  - White Player ID: " . ($match->white_player_id ?? 'NULL') . "\n";
    echo "  - Black Player ID: " . ($match->black_player_id ?? 'NULL') . "\n";
    echo "  - Player1 ID: " . ($match->player1_id ?? 'NULL') . "\n";
    echo "  - Player2 ID: " . ($match->player2_id ?? 'NULL') . "\n";
    echo "  - Winner ID: " . ($match->winner_id ?? 'NULL') . "\n";
    echo "  - Result Type: " . ($match->result_type ?? 'NULL') . "\n";
    echo "\n";
}

echo "✅ Check complete\n";