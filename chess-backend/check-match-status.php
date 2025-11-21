<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

if ($argc < 2) {
    echo "Usage: php check-match-status.php <match_id>\n";
    echo "Example: php check-match-status.php 3\n";
    exit(1);
}

$matchId = $argv[1];

echo "🔍 Checking Championship Match #{$matchId}...\n\n";

$match = \App\Models\ChampionshipMatch::find($matchId);

if (!$match) {
    echo "❌ Match not found!\n";
    exit(1);
}

echo "📋 Match Details:\n";
echo "  ID: {$match->id}\n";
echo "  Championship: {$match->championship_id}\n";
echo "  Round: {$match->round_number}\n";
echo "  Status: {$match->status}\n";
echo "  Game ID: " . ($match->game_id ?? 'NULL') . "\n";
echo "  Result: " . ($match->result ?? 'NULL') . "\n";
echo "  Result Type: " . ($match->result_type ?? 'NULL') . "\n";
echo "\n";

echo "👥 Players:\n";
echo "  White (Player 1): User #{$match->white_player_id} - {$match->whitePlayer->name}\n";
echo "  Black (Player 2): User #{$match->black_player_id} - {$match->blackPlayer->name}\n";
echo "\n";

if ($match->game_id) {
    $game = \App\Models\Game::find($match->game_id);
    if ($game) {
        echo "🎮 Game Details:\n";
        echo "  ID: {$game->id}\n";
        echo "  Status: {$game->status}\n";
        echo "  Result: " . ($game->result ?? 'NULL') . "\n";
        echo "  Current Turn: {$game->current_turn}\n";
        echo "  Move Count: " . ($game->move_count ?? 0) . "\n";
        echo "  Paused At: " . ($game->paused_at ?? 'NULL') . "\n";
        echo "  Completed At: " . ($game->completed_at ?? 'NULL') . "\n";
        echo "\n";
    } else {
        echo "⚠️ Game #{$match->game_id} not found in database!\n\n";
    }
}

echo "📝 Resume Requests for this Match:\n";
$requests = \App\Models\ChampionshipGameResumeRequest::where('championship_match_id', $matchId)
    ->orderBy('created_at', 'desc')
    ->get();

if ($requests->count() > 0) {
    foreach ($requests as $req) {
        $statusIcon = $req->status === 'pending' ? '⏳' : ($req->status === 'accepted' ? '✅' : '❌');
        $expiredLabel = $req->expires_at <= now() ? ' (EXPIRED)' : '';

        echo "  {$statusIcon} Request #{$req->id}: {$req->status}{$expiredLabel}\n";
        echo "      From: User #{$req->requester_id}\n";
        echo "      To: User #{$req->recipient_id}\n";
        echo "      Game: #{$req->game_id}\n";
        echo "      Created: {$req->created_at->format('Y-m-d H:i:s')} ({$req->created_at->diffForHumans()})\n";
        echo "      Expires: {$req->expires_at->format('Y-m-d H:i:s')} ({$req->expires_at->diffForHumans()})\n";
        echo "\n";
    }
} else {
    echo "  ✅ No resume requests found\n\n";
}

echo "🤔 Analysis:\n";

// Check if Play Now button should show
$canShowPlayNow = $match->status === 'pending' &&
                  $match->game_id !== null &&
                  !($match->game && $match->game->paused_at);

echo "  Can show 'Play Now' button? " . ($canShowPlayNow ? '✅ YES' : '❌ NO') . "\n";

if (!$canShowPlayNow) {
    echo "  Reasons:\n";
    if ($match->status !== 'pending') {
        echo "    - Match status is '{$match->status}' (needs to be 'pending')\n";
    }
    if ($match->game_id === null) {
        echo "    - No game_id (game hasn't been created yet)\n";
    }
    if ($match->game && $match->game->paused_at) {
        echo "    - Game is paused (should use 'Resume Game' button instead)\n";
    }
}

// Check for pending requests
$pendingRequest = \App\Models\ChampionshipGameResumeRequest::where('championship_match_id', $matchId)
    ->where('status', 'pending')
    ->where('expires_at', '>', now())
    ->first();

if ($pendingRequest) {
    echo "  ⚠️ There's an active pending request (ID #{$pendingRequest->id})\n";
    echo "     This will prevent new requests from being created\n";
} else {
    echo "  ✅ No active pending requests\n";
}

echo "\n";

echo "💡 Recommendations:\n";

if ($match->status === 'completed') {
    echo "  - Match is completed. Cannot send resume requests.\n";
    echo "  - Players can use 'Review Game' button to view the completed game.\n";
} elseif (!$match->game_id) {
    echo "  - No game created yet. Use 'Request Play' button instead.\n";
} elseif ($match->game && $match->game->status === 'completed') {
    echo "  - Game is completed. Match status should be updated to 'completed'.\n";
    echo "  - Run: UPDATE championship_matches SET status='completed' WHERE id={$match->id};\n";
} elseif ($pendingRequest) {
    echo "  - Clear the pending request to allow new requests:\n";
    echo "    php clear-pending-requests.php\n";
} else {
    echo "  - Everything looks good! 'Play Now' button should work.\n";
}

echo "\nDone!\n";
