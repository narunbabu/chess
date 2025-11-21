<?php

require __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "🧹 Clearing pending and expired resume requests...\n\n";

// Get all pending requests (including expired ones)
$allPendingRequests = \App\Models\ChampionshipGameResumeRequest::where('status', 'pending')->get();

echo "Found {$allPendingRequests->count()} total pending requests:\n\n";

// Separate active vs expired
$activeRequests = $allPendingRequests->filter(function($req) {
    return $req->expires_at > now();
});

$expiredRequests = $allPendingRequests->filter(function($req) {
    return $req->expires_at <= now();
});

echo "📊 Breakdown:\n";
echo "  - Active (not expired): {$activeRequests->count()}\n";
echo "  - Expired: {$expiredRequests->count()}\n\n";

if ($activeRequests->count() > 0) {
    echo "⏰ Active Requests:\n";
    foreach ($activeRequests as $request) {
        echo "  - Request #{$request->id}: Match {$request->championship_match_id}, ";
        echo "from User {$request->requester_id} to User {$request->recipient_id}, ";
        echo "expires " . $request->expires_at->diffForHumans() . "\n";
    }
    echo "\n";
}

if ($expiredRequests->count() > 0) {
    echo "🕐 Expired Requests:\n";
    foreach ($expiredRequests as $request) {
        echo "  - Request #{$request->id}: Match {$request->championship_match_id}, ";
        echo "from User {$request->requester_id} to User {$request->recipient_id}, ";
        echo "expired " . $request->expires_at->diffForHumans() . "\n";
    }
    echo "\n";
}

// Ask for confirmation to delete all
if ($allPendingRequests->count() > 0) {
    echo "❓ Do you want to delete ALL pending requests? (y/n): ";
    $handle = fopen("php://stdin", "r");
    $line = trim(fgets($handle));
    fclose($handle);

    if ($line === 'y' || $line === 'Y') {
        $deleted = \App\Models\ChampionshipGameResumeRequest::where('status', 'pending')->delete();
        echo "\n✅ Deleted {$deleted} pending requests\n";
    } else {
        echo "\n❌ Cancelled. No requests deleted.\n";
    }
} else {
    echo "✅ No pending requests to clear\n";
}

echo "\nDone!\n";
