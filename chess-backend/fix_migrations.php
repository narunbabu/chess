<?php

/**
 * Fix Migration Issues Script
 *
 * This script helps resolve migration conflicts and foreign key issues
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "🔧 Fixing Migration Issues\n";
echo "================================\n\n";

try {
    // Step 1: Check which migrations are problematic
    echo "📋 Step 1: Checking migration status...\n";

    // Get migrations that have been run
    $ranMigrations = DB::table('migrations')->pluck('migration')->toArray();
    echo "Migrations already run: " . count($ranMigrations) . "\n";

    // Check if user_stage_progress table exists
    $userStageProgressExists = Schema::hasTable('user_stage_progress');
    echo "user_stage_progress table exists: " . ($userStageProgressExists ? 'YES' : 'NO') . "\n";

    // Step 2: Handle foreign key constraints
    echo "\n🔗 Step 2: Handling foreign key constraints...\n";

    if ($userStageProgressExists) {
        // Disable foreign key checks temporarily
        DB::statement('SET FOREIGN_KEY_CHECKS = 0');
        echo "✅ Foreign key checks disabled\n";

        try {
            // Check for the specific migration
            $migrationName = '2025_11_19_100003_create_user_stage_progress_table';

            if (!in_array($migrationName, $ranMigrations)) {
                echo "📝 Adding missing migration record: {$migrationName}\n";
                DB::table('migrations')->insert([
                    'migration' => $migrationName,
                    'batch' => DB::table('migrations')->max('batch') + 1
                ]);
                echo "✅ Migration record added\n";
            } else {
                echo "ℹ️  Migration {$migrationName} already recorded\n";
            }

        } catch (Exception $e) {
            echo "⚠️  Warning: " . $e->getMessage() . "\n";
        }

        // Re-enable foreign key checks
        DB::statement('SET FOREIGN_KEY_CHECKS = 1');
        echo "✅ Foreign key checks re-enabled\n";
    }

    // Step 3: Show next steps
    echo "\n📋 Step 3: Suggested next steps:\n";
    echo "1. Run: php artisan migrate:status (to check status)\n";
    echo "2. Run: php artisan migrate --force (to continue migrations)\n";
    echo "3. If still failing: php artisan migrate:fresh --force (⚠️  deletes all data)\n";

    echo "\n✅ Migration fix process completed!\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    echo "\n💡 Alternative solution:\n";
    echo "1. Manually drop the problematic tables:\n";
    echo "   - mysql -u chess_user -p chess_production\n";
    echo "   - DROP TABLE IF EXISTS user_stage_progress;\n";
    echo "   - DROP TABLE IF EXISTS tutorial_lessons;\n";
    echo "   - exit\n";
    echo "2. Then run: php artisan migrate --force\n";
}