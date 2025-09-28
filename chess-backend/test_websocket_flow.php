<?php

// Test script to test the complete OAuth flow URLs
require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== OAUTH FLOW TEST ===\n\n";

// Test 1: What URL will we use for Google redirect?
echo "1. REDIRECT URL GENERATION:\n";
$redirectUrl = config('services.google.redirect');
echo "   Configured redirect URI: " . $redirectUrl . "\n";

// Test 2: What URL will Google use to call us back?
echo "\n2. CALLBACK URL ANALYSIS:\n";
$appUrl = config('app.url');
$expectedCallback = rtrim($appUrl, '/') . '/auth/google/callback';
echo "   App URL: " . $appUrl . "\n";
echo "   Expected callback: " . $expectedCallback . "\n";
echo "   Match with configured: " . ($expectedCallback === $redirectUrl ? 'YES' : 'NO') . "\n";

// Test 3: Test the actual Socialite configuration
echo "\n3. SOCIALITE CONFIGURATION:\n";
try {
    // This will show us what Socialite will actually use
    $driver = Laravel\Socialite\Facades\Socialite::driver('google');

    // Get the redirect URL that Socialite will generate
    $config = config('services.google');
    echo "   Client ID: " . $config['client_id'] . "\n";
    echo "   Client Secret: " . (isset($config['client_secret']) && $config['client_secret'] ? '[SET]' : '[NOT SET]') . "\n";
    echo "   Redirect: " . $config['redirect'] . "\n";

} catch (Exception $e) {
    echo "   ERROR: " . $e->getMessage() . "\n";
}

// Test 4: Generate the actual OAuth URL that will be sent to Google
echo "\n4. GOOGLE OAUTH URL GENERATION:\n";
try {
    $googleUrl = Laravel\Socialite\Facades\Socialite::driver('google')->redirect()->getTargetUrl();
    echo "   Full Google OAuth URL: " . $googleUrl . "\n";

    // Parse the URL to see the redirect_uri parameter
    $parsedUrl = parse_url($googleUrl);
    parse_str($parsedUrl['query'], $queryParams);
    echo "   Redirect URI sent to Google: " . ($queryParams['redirect_uri'] ?? 'NOT FOUND') . "\n";

} catch (Exception $e) {
    echo "   ERROR: " . $e->getMessage() . "\n";
}

echo "\n=== INSTRUCTIONS ===\n";
echo "1. Run this script: php test_websocket_flow.php\n";
echo "2. Copy the 'Redirect URI sent to Google' value\n";
echo "3. Add that EXACT value to Google Console\n";
echo "4. Test OAuth login\n";
echo "5. Check Laravel logs for detailed callback information\n\n";

echo "Log file locations:\n";
echo "- storage/logs/laravel.log\n";
echo "- or use: tail -f storage/logs/laravel.log\n\n";

echo "Current timestamp: " . date('Y-m-d H:i:s') . "\n";