<?php
// Quick debug script to show exact OAuth URL
require_once 'vendor/autoload.php';

// Load environment variables
$dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
$dotenv->load();

$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

echo "<h2>OAuth Debug Information</h2>";
echo "<strong>Current Configuration:</strong><br>";
echo "Google Client ID: " . config('services.google.client_id') . "<br>";
echo "Google Redirect URL: " . config('services.google.redirect') . "<br>";
echo "Frontend URL: " . config('app.frontend_url') . "<br><br>";

echo "<strong>Environment Variables:</strong><br>";
echo "GOOGLE_CLIENT_ID: " . env('GOOGLE_CLIENT_ID') . "<br>";
echo "GOOGLE_REDIRECT_URL: " . env('GOOGLE_REDIRECT_URL') . "<br>";
echo "FRONTEND_URL: " . env('FRONTEND_URL') . "<br><br>";

// Test Socialite URL generation
try {
    $googleUrl = Laravel\Socialite\Facades\Socialite::driver('google')->redirect()->getTargetUrl();
    echo "<strong>Generated Google OAuth URL:</strong><br>";
    echo "<a href='$googleUrl' target='_blank'>$googleUrl</a><br><br>";

    // Parse the URL to show components
    $parsed = parse_url($googleUrl);
    parse_str($parsed['query'], $params);

    echo "<strong>OAuth Parameters:</strong><br>";
    echo "redirect_uri: " . urldecode($params['redirect_uri']) . "<br>";
    echo "client_id: " . $params['client_id'] . "<br>";
    echo "response_type: " . $params['response_type'] . "<br>";
    echo "scope: " . urldecode($params['scope']) . "<br>";

} catch (Exception $e) {
    echo "<strong>Error generating OAuth URL:</strong><br>";
    echo $e->getMessage();
}
?>

<style>
body { font-family: Arial, sans-serif; padding: 20px; }
strong { color: #d63384; }
</style>