<?php

/**
 * Test script to verify database contents checker works with MySQL
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

echo "🔍 Testing database connection and table detection...\n\n";

// Get database connection info
$connection = DB::connection();
$driver = $connection->getDriverName();
$database = $connection->getDatabaseName();

echo "Database Driver: {$driver}\n";
echo "Database Name: {$database}\n\n";

try {
    if ($driver === 'mysql') {
        // Test MySQL table listing
        $tables = DB::select("SHOW TABLES");
        echo "✅ MySQL connection detected!\n";
        echo "Tables found: " . count($tables) . "\n\n";

        if (!empty($tables)) {
            $key = array_keys((array)$tables[0])[0];
            echo "Table names:\n";
            foreach ($tables as $table) {
                echo "  - " . $table->$key . "\n";
            }
        }
    } else {
        echo "❌ Not using MySQL. Driver: {$driver}\n";
    }

    echo "\n✅ Database connection test successful!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
}