<?php
require_once __DIR__ . '/vendor/autoload.php';
// Bootstrap Laravel
$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\User;

echo "=== Testing Schedule and Play Request Endpoints ===\n\n";

// Get Championship 15
$championship = Championship::find(15);
if (!$championship) {
    echo "❌ Championship 15 not found\n";
    exit(1);
}

echo "✅ Championship: " . $championship->title . "\n";

// Get matches
$matches = ChampionshipMatch::where('championship_id', 15)->get();
echo "📊 Total matches: " . $matches->count() . "\n\n";

if ($matches->count() === 0) {
    echo "❌ No matches found for Championship 15\n";
    exit(1);
}

// Show first few matches
foreach ($matches->take(3) as $index => $match) {
    echo "Match " . ($index + 1) . ":\n";
    echo "  ID: " . $match->id . "\n";
    echo "  Round: " . $match->round_number . "\n";
    echo "  Status: " . $match->status . "\n";
    echo "  White: " . ($match->white_player_id ?? 'null') . "\n";
    echo "  Black: " . ($match->black_player_id ?? 'null') . "\n";
    echo "  Game ID: " . ($match->game_id ?? 'null') . "\n";
    echo "  Deadline: " . ($match->deadline ?? 'null') . "\n";
    echo "  Created: " . $match->created_at . "\n\n";
}

// Check users
$users = User::whereIn('id', [$matches[0]->white_player_id, $matches[0]->black_player_id])->get();
echo "👥 Users in first match:\n";
foreach ($users as $user) {
    echo "  User ID: " . $user->id . ", Name: " . $user->name . ", Email: " . $user->email . "\n";
}

echo "\n=== API Endpoints to Test ===\n";
echo "Schedule Propose: POST /api/championships/15/matches/{match_id}/schedule/propose\n";
echo "Challenge: POST /api/championships/15/matches/{match_id}/challenge\n";
echo "Notify Start: POST /api/championships/15/matches/{match_id}/notify-start\n";
echo "Resume Accept: POST /api/championships/15/matches/{match_id}/resume-request/accept\n";
echo "Resume Decline: POST /api/championships/15/matches/{match_id}/resume-request/decline\n";

echo "\n=== Ready for Testing ===\n";