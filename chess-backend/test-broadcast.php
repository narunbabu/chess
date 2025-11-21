<?php

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

// Test broadcasting configuration
echo "=== Broadcasting Configuration Test ===\n\n";

echo "1. Broadcast Driver: " . config('broadcasting.default') . "\n";
echo "2. Reverb Config:\n";
echo "   - App ID: " . config('broadcasting.connections.reverb.app_id') . "\n";
echo "   - App Key: " . config('broadcasting.connections.reverb.key') . "\n";
echo "   - Host: " . config('broadcasting.connections.reverb.options.host') . "\n";
echo "   - Port: " . config('broadcasting.connections.reverb.options.port') . "\n";
echo "   - Scheme: " . config('broadcasting.connections.reverb.options.scheme') . "\n\n";

// Check if Reverb server is accessible
echo "3. Testing Reverb Connection:\n";
$reverbHost = config('broadcasting.connections.reverb.options.host');
$reverbPort = config('broadcasting.connections.reverb.options.port');
$reverbScheme = config('broadcasting.connections.reverb.options.scheme');

$url = "{$reverbScheme}://{$reverbHost}:{$reverbPort}";

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_TIMEOUT, 5);
curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$error = curl_error($ch);
curl_close($ch);

if ($httpCode === 200) {
    echo "   ✅ Reverb server is RUNNING at {$url}\n";
    echo "   Response: " . substr($response, 0, 100) . "...\n";
} else {
    echo "   ❌ Reverb server is NOT accessible at {$url}\n";
    echo "   HTTP Code: {$httpCode}\n";
    if ($error) {
        echo "   Error: {$error}\n";
    }
    echo "\n   🚨 START REVERB SERVER:\n";
    echo "   php artisan reverb:start\n";
}

echo "\n4. Testing Event Broadcast:\n";

try {
    // Create a test event
    $testData = [
        'type' => 'test',
        'message' => 'Testing WebSocket broadcast',
        'timestamp' => now()->toISOString(),
    ];

    // Test broadcasting to user channel
    $userId = 1;
    $channelName = "App.Models.User.{$userId}";

    echo "   Broadcasting test event to channel: {$channelName}\n";

    // Use Laravel's broadcast helper
    broadcast(new class($testData) implements \Illuminate\Contracts\Broadcasting\ShouldBroadcast {
        use \Illuminate\Broadcasting\InteractsWithSockets;

        public $data;

        public function __construct($data) {
            $this->data = $data;
        }

        public function broadcastOn(): array {
            return [new \Illuminate\Broadcasting\PrivateChannel('App.Models.User.1')];
        }

        public function broadcastWith(): array {
            return $this->data;
        }

        public function broadcastAs(): string {
            return 'test.event';
        }
    });

    echo "   ✅ Event broadcast successfully queued\n";
    echo "   Check frontend console for: .test.event\n";

} catch (Exception $e) {
    echo "   ❌ Broadcast failed: " . $e->getMessage() . "\n";
}

echo "\n=== Test Complete ===\n";
