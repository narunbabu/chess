<?php

require_once __DIR__ . '/vendor/autoload.php';

// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\User;
use App\Models\ChampionshipMatch;

echo "🔍 Verifying Championship 5 Still Works\n";
echo str_repeat("=", 50) . "\n";

// Get user for testing
$user = User::first();
if (!$user) {
    echo "❌ No users found\n";
    exit;
}

echo "✅ Testing with user: {$user->name} (ID: {$user->id})\n\n";

// Test the my-matches query for championship 5
$matches = ChampionshipMatch::where('championship_id', 5)
    ->where(function ($query) use ($user) {
        $query->where('player1_id', $user->id)
            ->orWhere('player2_id', $user->id)
            ->orWhere('white_player_id', $user->id)
            ->orWhere('black_player_id', $user->id);
    })
    ->get();

echo "📊 Championship 5: Found {$matches->count()} matches\n";

if ($matches->count() > 0) {
    echo "✅ Championship 5 my-matches still works!\n";
} else {
    echo "❌ Championship 5 my-matches is broken now!\n";
}

echo "\n✅ Verification complete\n";