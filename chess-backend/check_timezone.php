<?php

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🕐 Timezone Information\n";
echo str_repeat("=", 40) . "\n";

echo "PHP default timezone: " . date_default_timezone_get() . "\n";
echo "Current UTC time: " . gmdate('Y-m-d H:i:s') . "\n";
echo "Current local time: " . date('Y-m-d H:i:s') . "\n";
echo "Laravel timezone: " . config('app.timezone') . "\n";

// Show timestamp formats
echo "\n📅 Timestamp Formats:\n";
echo "UTC format: " . gmdate('Y_m_d_His') . "\n";
echo "Local format: " . date('Y_m_d_His') . "\n";

// Calculate difference
$localTime = time();
$utcTime = strtotime(gmdate('Y-m-d H:i:s'));
$difference = $localTime - $utcTime;
echo "Time difference: " . ($difference / 3600) . " hours\n";