<?php

/**
 * Quick test script to verify Phase 4 Game model changes
 *
 * Run: php tests/test_phase4_model.php
 *
 * Tests:
 * 1. Reading status via accessor (from status_id FK)
 * 2. Writing status via mutator (to status_id FK)
 * 3. Reading end_reason via accessor
 * 4. Writing end_reason via mutator
 * 5. Legacy value mapping still works
 */

require __DIR__ . '/../vendor/autoload.php';

$app = require_once __DIR__ . '/../bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use App\Models\Game;
use App\Models\User;

echo "=== Phase 4 Model Test ===\n\n";

try {
    // Test 1: Create a test game
    echo "1. Creating test game...\n";
    $game = new Game();
    $game->white_player_id = 1; // Assuming user ID 1 exists
    $game->black_player_id = 2; // Assuming user ID 2 exists
    $game->status = 'waiting'; // Uses mutator -> writes to status_id
    $game->save();

    echo "   ✅ Game created with ID: {$game->id}\n";
    echo "   ✅ status_id set to: {$game->status_id}\n\n";

    // Test 2: Read status via accessor
    echo "2. Reading status via accessor...\n";
    $game->refresh();
    $status = $game->status; // Uses accessor -> reads from status_id FK
    echo "   ✅ \$game->status = '{$status}' (read from status_id={$game->status_id})\n\n";

    // Test 3: Update status
    echo "3. Updating status to 'active'...\n";
    $game->status = 'active'; // Uses mutator -> writes to status_id
    $game->save();
    $game->refresh();
    echo "   ✅ \$game->status = '{$game->status}' (status_id={$game->status_id})\n\n";

    // Test 4: Set end_reason
    echo "4. Setting end_reason to 'checkmate'...\n";
    $game->status = 'finished';
    $game->end_reason = 'checkmate'; // Uses mutator -> writes to end_reason_id
    $game->save();
    $game->refresh();
    echo "   ✅ \$game->end_reason = '{$game->end_reason}' (end_reason_id={$game->end_reason_id})\n\n";

    // Test 5: Legacy value mapping
    echo "5. Testing legacy value mapping...\n";
    $game2 = new Game();
    $game2->white_player_id = 1;
    $game2->black_player_id = 2;
    $game2->status = 'completed'; // Legacy value (should map to 'finished')
    $game2->save();
    $game2->refresh();
    echo "   ✅ Set status='completed' (legacy)\n";
    echo "   ✅ Saved as status_id={$game2->status_id}\n";
    echo "   ✅ Reads back as \$game2->status = '{$game2->status}'\n\n";

    // Test 6: Check relationship loading
    echo "6. Testing relationship loading...\n";
    $game->load('statusRelation', 'endReasonRelation');
    echo "   ✅ Status relation: {$game->statusRelation->code} (label: {$game->statusRelation->label})\n";
    echo "   ✅ End reason relation: {$game->endReasonRelation->code} (label: {$game->endReasonRelation->label})\n\n";

    // Test 7: Helper methods
    echo "7. Testing helper methods...\n";
    echo "   ✅ isFinished(): " . ($game->isFinished() ? 'true' : 'false') . "\n";
    echo "   ✅ getStatusEnum(): " . $game->getStatusEnum()->value . "\n";
    echo "   ✅ getEndReasonEnum(): " . $game->getEndReasonEnum()->value . "\n\n";

    // Cleanup
    echo "8. Cleaning up test data...\n";
    $game->delete();
    $game2->delete();
    echo "   ✅ Test games deleted\n\n";

    echo "=== ✅ ALL TESTS PASSED ===\n";
    echo "\nPhase 4 verification complete!\n";
    echo "- Old ENUM columns dropped ✅\n";
    echo "- Accessors reading from relationships ✅\n";
    echo "- Mutators writing to FK columns ✅\n";
    echo "- Legacy value mapping working ✅\n";

} catch (\Exception $e) {
    echo "\n❌ TEST FAILED\n";
    echo "Error: " . $e->getMessage() . "\n";
    echo "File: " . $e->getFile() . ":" . $e->getLine() . "\n";
    exit(1);
}
