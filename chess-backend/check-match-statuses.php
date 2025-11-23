<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChampionshipMatch;

echo "🔍 Checking Match Statuses for Championship 14\n";
echo str_repeat("=", 50) . "\n";

$matches = ChampionshipMatch::where('championship_id', 14)
    ->orderBy('round_number')
    ->orderBy('id')
    ->get();

echo "Total matches: " . $matches->count() . "\n\n";

$roundStatuses = [];

foreach ($matches as $match) {
    echo "Match ID: {$match->id}\n";
    echo "  - Round: {$match->round_number}\n";
    echo "  - Status: '{$match->status}'\n";
    echo "  - Result Type: " . ($match->result_type ?? 'NULL') . "\n";
    echo "  - White Player ID: {$match->white_player_id}\n";
    echo "  - Black Player ID: {$match->black_player_id}\n";
    echo "  - Winner ID: " . ($match->winner_id ?? 'NULL') . "\n";

    if (!isset($roundStatuses[$match->round_number])) {
        $roundStatuses[$match->round_number] = [
            'total' => 0,
            'completed' => 0,
            'pending' => 0,
            'other' => []
        ];
    }

    $roundStatuses[$match->round_number]['total']++;

    if ($match->status === 'completed') {
        $roundStatuses[$match->round_number]['completed']++;
    } elseif ($match->status === 'pending') {
        $roundStatuses[$match->round_number]['pending']++;
    } else {
        $roundStatuses[$match->round_number]['other'][] = $match->status;
    }

    echo "\n";
}

echo "📊 Round Summary:\n";
foreach ($roundStatuses as $round => $status) {
    echo "Round {$round}:\n";
    echo "  - Total: {$status['total']}\n";
    echo "  - Completed: {$status['completed']}\n";
    echo "  - Pending: {$status['pending']}\n";
    if (!empty($status['other'])) {
        echo "  - Other statuses: " . implode(', ', array_unique($status['other'])) . "\n";
    }

    $isComplete = $status['completed'] === $status['total'];
    echo "  - Complete: " . ($isComplete ? "YES ✅" : "NO ❌") . "\n\n";
}

echo "✅ Analysis complete\n";