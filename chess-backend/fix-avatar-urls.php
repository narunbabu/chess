#!/usr/bin/env php
<?php

/**
 * Quick script to fix avatar URLs to use proper format
 *
 * Usage: php fix-avatar-urls.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;

echo "Fixing avatar URLs...\n";

// Get all users with avatar URLs
$users = DB::table('users')->whereNotNull('avatar_url')->get();
$updated = 0;

foreach ($users as $user) {
    $oldUrl = $user->avatar_url;
    $newUrl = null;

    // Case 1: Full URL with /storage/avatars/
    if (str_contains($oldUrl, '/storage/avatars/')) {
        $filename = basename($oldUrl);
        $newUrl = url('/api/avatars/' . $filename);
    }
    // Case 2: Relative path like "avatars/filename.jpg"
    elseif (preg_match('#^avatars/(.+)$#', $oldUrl, $matches)) {
        $filename = $matches[1];
        $newUrl = url('/api/avatars/' . $filename);
    }
    // Case 3: Already has /api/avatars/ - no change needed
    elseif (str_contains($oldUrl, '/api/avatars/')) {
        echo "User {$user->id} already has correct URL format\n";
        continue;
    }
    // Case 4: External URL (Google, etc.) - no change needed
    elseif (preg_match('#^https?://#', $oldUrl)) {
        echo "User {$user->id} has external URL, skipping\n";
        continue;
    }

    if ($newUrl && $newUrl !== $oldUrl) {
        DB::table('users')
            ->where('id', $user->id)
            ->update(['avatar_url' => $newUrl]);

        echo "User {$user->id}: {$oldUrl} → {$newUrl}\n";
        $updated++;
    }
}

echo "\nUpdated $updated user(s) avatar URLs.\n";
echo "Done!\n";
