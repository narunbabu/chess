<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

echo "=== Testing Redis and Heartbeat System ===\n\n";

// Test Redis availability
$redisService = app(\App\Services\RedisStatusService::class);
$isAvailable = $redisService->isAvailable();
echo "1. Redis Available: " . ($isAvailable ? "YES" : "NO") . "\n";

if ($isAvailable) {
    // Test marking a user online
    echo "\n2. Testing markOnline for user ID 1...\n";
    $redisService->markOnline(1);

    // Check if user is online
    echo "3. Checking if user 1 is online...\n";
    $isOnline = $redisService->isOnline(1);
    echo "   Result: " . ($isOnline ? "ONLINE" : "OFFLINE") . "\n";

    // Batch check
    echo "\n4. Batch checking users [1, 2, 3, 4]...\n";
    $statuses = $redisService->batchCheck([1, 2, 3, 4]);
    print_r($statuses);

    // Get stats
    echo "\n5. Redis Stats:\n";
    print_r($redisService->getStats());
} else {
    echo "\n❌ Redis not available - heartbeat system won't work!\n";
}

echo "\n=== Test Complete ===\n";
