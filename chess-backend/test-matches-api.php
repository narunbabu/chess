<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\ChampionshipMatch;

echo "🔍 Testing Championship Matches API Query\n";
echo str_repeat("=", 50) . "\n";

// This mimics the exact query in the ChampionshipController@matches method
try {
    $query = ChampionshipMatch::where('championship_id', 14)
        ->with([
            'player1:id,name,email,avatar_url,rating,last_activity_at',
            'player2:id,name,email,avatar_url,rating,last_activity_at',
            'white_player:id,name,email,avatar_url,rating,last_activity_at',
            'black_player:id,name,email,avatar_url,rating,last_activity_at',
            'winner:id,name,email,avatar_url',
            'game:id,status_id,end_reason_id,result,pgn,paused_at',
        ]);

    // Order by round number and scheduled time
    $matches = $query->orderBy('round_number')
        ->orderBy('scheduled_at')
        ->get();

    echo "✅ Query executed successfully\n";
    echo "📊 Found {$matches->count()} matches\n";

    if ($matches->count() > 0) {
        echo "\n📋 Match Results:\n";
        foreach ($matches as $index => $match) {
            $whiteName = $match->white_player ? $match->white_player->name : 'Unknown';
            $blackName = $match->black_player ? $match->black_player->name : 'Unknown';
            $status = $match->status ?? 'Unknown';

            echo sprintf(
                "   %d. Round %d: %s vs %s (Status: %s)\n",
                $index + 1,
                $match->round_number,
                $whiteName,
                $blackName,
                $status
            );
        }
    }

    // Convert to JSON to test serialization
    echo "\n🔄 Testing JSON serialization...\n";
    $jsonData = $matches->toArray();
    echo "✅ JSON conversion successful\n";
    echo "📊 JSON has " . count($jsonData) . " matches\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "📍 Stack trace:\n" . $e->getTraceAsString() . "\n";
}

echo "\n✅ Test completed\n";