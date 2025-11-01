<?php

/**
 * Fix Avatar URLs - Update existing /api/avatars/ URLs to /storage/avatars/
 *
 * This script updates all user avatar URLs from the Laravel route format
 * to the direct storage symlink format for better performance.
 *
 * Usage: php fix_avatar_urls.php
 */

require __DIR__.'/vendor/autoload.php';

$app = require_once __DIR__.'/bootstrap/app.php';
$app->make('Illuminate\Contracts\Console\Kernel')->bootstrap();

use App\Models\User;

echo "=== Avatar URL Fix Script ===\n\n";

// Find all users with avatar URLs
$users = User::whereNotNull('avatar_url')
    ->where('avatar_url', '!=', '')
    ->get();

echo "Found " . $users->count() . " users with avatar URLs\n\n";

$updated = 0;
$skipped = 0;

foreach ($users as $user) {
    echo "User ID: {$user->id}, Name: {$user->name}\n";
    echo "  Current URL: {$user->avatar_url}\n";

    // Skip if URL is external (Google, Facebook, etc.)
    if (str_contains($user->avatar_url, 'googleusercontent.com') ||
        str_contains($user->avatar_url, 'facebook.com') ||
        str_contains($user->avatar_url, 'http://') ||
        str_contains($user->avatar_url, 'https://')) {

        // Check if it's our domain
        if (!str_contains($user->avatar_url, config('app.url'))) {
            echo "  → Skipped (external URL)\n\n";
            $skipped++;
            continue;
        }
    }

    // Update /api/avatars/ to /storage/avatars/
    if (str_contains($user->avatar_url, '/api/avatars/')) {
        $newUrl = str_replace('/api/avatars/', '/storage/avatars/', $user->avatar_url);
        $user->avatar_url = $newUrl;
        $user->save();

        echo "  → Updated to: {$newUrl}\n\n";
        $updated++;
    } else if (str_contains($user->avatar_url, '/storage/avatars/')) {
        echo "  → Already correct format\n\n";
        $skipped++;
    } else {
        echo "  → Unknown format, skipped\n\n";
        $skipped++;
    }
}

echo "=== Summary ===\n";
echo "Total users: " . $users->count() . "\n";
echo "Updated: $updated\n";
echo "Skipped: $skipped\n";
echo "\nDone!\n";
