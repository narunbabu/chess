<?php
require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "=== Testing Invitation #4 Response ===\n\n";

// Simulate the invitation response
try {
    $invitation = \App\Models\Invitation::find(4);

    if (!$invitation) {
        echo "❌ Invitation #4 not found\n";
        exit(1);
    }

    echo "Invitation Details:\n";
    echo "  Type: {$invitation->type}\n";
    echo "  Inviter ID: {$invitation->inviter_id}\n";
    echo "  Invited ID: {$invitation->invited_id}\n";
    echo "  Status: {$invitation->status}\n";
    echo "  Championship Match ID: " . ($invitation->championship_match_id ?? 'NULL') . "\n\n";

    // Check if users exist
    $inviter = \App\Models\User::find($invitation->inviter_id);
    $invited = \App\Models\User::find($invitation->invited_id);

    if (!$inviter) {
        echo "❌ Inviter user not found (ID: {$invitation->inviter_id})\n";
    } else {
        echo "✅ Inviter user exists: {$inviter->name}\n";
    }

    if (!$invited) {
        echo "❌ Invited user not found (ID: {$invitation->invited_id})\n";
    } else {
        echo "✅ Invited user exists: {$invited->name}\n";
    }

    echo "\n";

    // Check game creation logic
    echo "Testing game creation logic...\n";

    // Simulate accept action
    $desired_color = null; // default
    $inviterWants = $invitation->inviter_preferred_color;
    $desired = $desired_color ?? ($inviterWants === 'white' ? 'black' : 'white');

    $acceptorId = $invitation->invited_id; // Simulate invited user accepting
    $inviterId = $invitation->inviter_id;

    if ($desired === 'white') {
        $whiteId = $acceptorId;
        $blackId = $inviterId;
    } else {
        $whiteId = $inviterId;
        $blackId = $acceptorId;
    }

    echo "  Acceptor ID: $acceptorId\n";
    echo "  Inviter wants: $inviterWants\n";
    echo "  Desired color: $desired\n";
    echo "  White player ID: $whiteId\n";
    echo "  Black player ID: $blackId\n\n";

    // Try to create a test game (won't commit)
    DB::beginTransaction();
    try {
        $game = \App\Models\Game::create([
            'white_player_id' => $whiteId,
            'black_player_id' => $blackId,
            'status' => 'waiting',
            'result' => 'ongoing',
        ]);

        echo "✅ Game creation would succeed:\n";
        echo "  Game ID: {$game->id}\n";
        echo "  White Player: $whiteId\n";
        echo "  Black Player: $blackId\n";

        DB::rollBack();
        echo "\n(Transaction rolled back - test only)\n";
    } catch (\Exception $e) {
        DB::rollBack();
        echo "❌ Game creation failed:\n";
        echo "  Error: " . $e->getMessage() . "\n";
        echo "  File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    }

} catch (\Exception $e) {
    echo "❌ Test failed with error:\n";
    echo "  Error: " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    echo "  Stack trace:\n";
    echo $e->getTraceAsString() . "\n";
}
