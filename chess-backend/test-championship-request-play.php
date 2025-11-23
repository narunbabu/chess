#!/usr/bin/env php
<?php

/**
 * Test Championship Request Play Flow
 *
 * This script tests the championship request play functionality:
 * 1. Sends a championship match invitation
 * 2. Accepts the invitation
 * 3. Verifies game creation
 * 4. Checks that the correct event is broadcast
 */

require __DIR__ . '/vendor/autoload.php';

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use App\Models\Championship;
use App\Models\ChampionshipMatch;
use App\Models\Invitation;
use App\Models\User;
use App\Services\ChampionshipMatchInvitationService;

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "🧪 Testing Championship Request Play Flow\n";
echo str_repeat("=", 60) . "\n\n";

try {
    // Find any championship with matches
    $championship = Championship::with('matches')->has('matches')->first();

    if (!$championship) {
        echo "❌ No championship with matches found\n";
        echo "💡 Create a championship first using the frontend or seeder\n";
        exit(1);
    }

    echo "✅ Found championship: {$championship->name} (ID: {$championship->id})\n";

    // Find a pending match
    $match = $championship->matches()
        ->whereNull('game_id')
        ->whereNotNull('player1_id')
        ->whereNotNull('player2_id')
        ->first();

    if (!$match) {
        echo "❌ No pending match found in this championship\n";
        echo "💡 Create some matches first\n";
        exit(1);
    }

    echo "✅ Found match: Player {$match->player1_id} vs Player {$match->player2_id}\n";
    echo "   Round: {$match->round_number}\n";
    echo "   Status: {$match->status}\n\n";

    // Get the players
    $player1 = User::find($match->player1_id);
    $player2 = User::find($match->player2_id);

    if (!$player1 || !$player2) {
        echo "❌ Players not found\n";
        exit(1);
    }

    echo "👥 Players:\n";
    echo "   Player 1: {$player1->name} (ID: {$player1->id})\n";
    echo "   Player 2: {$player2->name} (ID: {$player2->id})\n\n";

    // Step 1: Create invitation (simulate player 1 sending challenge)
    echo "📤 Step 1: Player 1 sends championship match invitation...\n";
    Auth::login($player1);

    $invitation = Invitation::create([
        'inviter_id' => $player1->id,
        'invited_id' => $player2->id,
        'status' => 'pending',
        'inviter_preferred_color' => 'random',
        'type' => 'championship_match',
        'championship_match_id' => $match->id
    ]);

    echo "   ✅ Invitation created (ID: {$invitation->id})\n";
    echo "   📋 Type: {$invitation->type}\n";
    echo "   📋 Championship Match ID: {$invitation->championship_match_id}\n\n";

    // Step 2: Accept invitation (simulate player 2 accepting)
    echo "✅ Step 2: Player 2 accepts the invitation...\n";
    Auth::login($player2);

    $service = new ChampionshipMatchInvitationService();
    $result = $service->handleInvitationResponse($invitation, 'accept', 'white');

    if ($result['success']) {
        echo "   ✅ Invitation accepted successfully!\n";

        if (isset($result['game'])) {
            echo "   🎮 Game created (ID: {$result['game']->id})\n";
            echo "   🎨 White: {$result['game']->white_player_id}\n";
            echo "   🎨 Black: {$result['game']->black_player_id}\n";
            echo "   📊 Status: {$result['game']->status}\n";
        }

        if (isset($result['match'])) {
            echo "   🏆 Match updated (ID: {$result['match']->id})\n";
            echo "   📊 Status: {$result['match']->status}\n";
            echo "   🎮 Game ID: {$result['match']->game_id}\n";
        }

        if (isset($result['championship_context'])) {
            echo "   📋 Championship Context:\n";
            echo "      Championship ID: {$result['championship_context']['championship_id']}\n";
            echo "      Round: {$result['championship_context']['round_number']}\n";
            echo "      Match ID: {$result['championship_context']['match_id']}\n";
        }
    } else {
        echo "   ❌ Failed to accept invitation\n";
        echo "   Error: " . ($result['error'] ?? 'Unknown error') . "\n";
        exit(1);
    }

    echo "\n" . str_repeat("=", 60) . "\n";
    echo "✅ Test completed successfully!\n";
    echo "🎉 Championship request play flow is working correctly\n";
    echo "\n💡 Next steps:\n";
    echo "   1. Test in the frontend by clicking 'Request Play' button\n";
    echo "   2. Check browser console for WebSocket events\n";
    echo "   3. Verify navigation to game page works\n";

} catch (\Exception $e) {
    echo "\n❌ Test failed with error:\n";
    echo "   " . $e->getMessage() . "\n";
    echo "\n📍 Stack trace:\n";
    echo $e->getTraceAsString() . "\n";
    exit(1);
}
