<?php

// Test script to debug OAuth configuration
require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

// Bootstrap Laravel
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "=== OAUTH CONFIGURATION DEBUG ===\n\n";

echo "Environment Variables:\n";
echo "GOOGLE_CLIENT_ID: " . env('GOOGLE_CLIENT_ID') . "\n";
echo "GOOGLE_CLIENT_SECRET: " . (env('GOOGLE_CLIENT_SECRET') ? '[SET]' : '[NOT SET]') . "\n";
echo "GOOGLE_REDIRECT_URL: " . env('GOOGLE_REDIRECT_URL') . "\n";
echo "APP_URL: " . env('APP_URL') . "\n";
echo "FRONTEND_URL: " . env('FRONTEND_URL') . "\n\n";

echo "Laravel Config Values:\n";
echo "services.google.client_id: " . config('services.google.client_id') . "\n";
echo "services.google.client_secret: " . (config('services.google.client_secret') ? '[SET]' : '[NOT SET]') . "\n";
echo "services.google.redirect: " . config('services.google.redirect') . "\n";
echo "app.url: " . config('app.url') . "\n";
echo "app.frontend_url: " . config('app.frontend_url') . "\n\n";

echo "Generated URLs:\n";
$baseUrl = rtrim(config('app.url'), '/');
$callbackPath = '/auth/google/callback';
$fullCallbackUrl = $baseUrl . $callbackPath;
echo "Full callback URL (constructed): " . $fullCallbackUrl . "\n";
echo "Configured redirect URI: " . config('services.google.redirect') . "\n";
echo "URLs match: " . ($fullCallbackUrl === config('services.google.redirect') ? 'YES' : 'NO') . "\n\n";

echo "Route URLs:\n";
try {
    $callbackUrl = url('/auth/google/callback');
    echo "Callback URL (via url helper): " . $callbackUrl . "\n";
} catch (Exception $e) {
    echo "Callback URL: [ERROR - " . $e->getMessage() . "]\n";
}

echo "\n=== WHAT TO CHECK IN GOOGLE CONSOLE ===\n";
echo "1. Go to: https://console.cloud.google.com/apis/credentials\n";
echo "2. Find your OAuth 2.0 Client ID\n";
echo "3. In 'Authorized redirect URIs', make sure you have EXACTLY:\n";
echo "   " . config('services.google.redirect') . "\n";
echo "4. Save changes if needed\n";
echo "5. Try OAuth login again\n\n";

echo "Current timestamp: " . date('Y-m-d H:i:s') . "\n";