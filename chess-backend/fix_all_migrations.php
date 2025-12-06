<?php

/**
 * Fix All Migration Issues Script
 *
 * This script fixes all migration conflicts by adding missing migration records
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

echo "🔧 Fixing All Migration Issues\n";
echo "===============================\n\n";

try {
    // Get all existing tables in the database
    $existingTables = DB::select('SHOW TABLES');
    $key = array_keys((array)$existingTables[0])[0];
    $tables = array_map(fn($table) => $table->$key, $existingTables);

    // Get migrations that have been run
    $ranMigrations = DB::table('migrations')->pluck('migration')->toArray();

    // Get all migration files
    $migrationFiles = glob(__DIR__ . '/database/migrations/*.php');
    $allMigrations = [];

    foreach ($migrationFiles as $file) {
        $migrationName = basename($file, '.php');
        $allMigrations[] = $migrationName;
    }

    echo "📊 Current Status:\n";
    echo "- Total migration files: " . count($allMigrations) . "\n";
    echo "- Migrations recorded: " . count($ranMigrations) . "\n";
    echo "- Tables in database: " . count($tables) . "\n\n";

    // Common table to migration mappings (based on your Laravel project structure)
    $tableToMigrationMap = [
        'users' => '0001_01_01_000000_create_users_table',
        'cache' => '0001_01_01_000001_create_cache_table',
        'jobs' => '0001_01_01_000002_create_jobs_table',
        'failed_jobs' => '0001_01_01_000003_create_failed_jobs_table',
        'personal_access_tokens' => '2025_03_15_180745_create_personal_access_tokens_table',
        'games' => '2025_09_27_124000_create_games_table',
        'invitations' => '2025_09_27_124100_create_invitations_table',
        'user_presence' => '2025_09_27_124200_create_user_presence_table',
        'game_moves' => '2025_09_27_124310_create_game_moves_table',
        'game_histories' => '2025_09_27_125000_create_game_histories_table',
        'game_connections' => '2025_09_27_192657_create_game_connections_table',
        'ratings_history' => '2025_10_24_000000_create_ratings_history_table',
        'user_friends' => '2025_10_24_000000_create_user_friends_table',
        'shared_results' => '2025_11_11_065657_create_shared_results_table',
        'championships' => '2025_11_12_100000_create_championships_table',
        'championship_participants' => '2025_11_12_100001_create_championship_participants_table',
        'championship_matches' => '2025_11_12_100002_create_championship_matches_table',
        'championship_standings' => '2025_11_12_100003_create_championship_standings_table',
        'roles' => '2025_11_12_110000_create_roles_table',
        'permissions' => '2025_11_12_110001_create_permissions_table',
        'role_permissions' => '2025_11_12_110002_create_role_permissions_table',
        'user_roles' => '2025_11_12_110003_create_user_roles_table',
        'organizations' => '2025_11_12_110004_create_organizations_table',
        'championship_match_schedules' => '2025_11_14_190001_create_championship_match_schedules_table',
        'tutorial_modules' => '2025_11_19_100000_create_tutorial_modules_table',
        'tutorial_lessons' => '2025_11_19_100001_create_tutorial_lessons_table',
        'user_tutorial_progress' => '2025_11_19_100002_create_user_tutorial_progress_table',
        'user_skill_assessments' => '2025_11_19_100003_create_user_skill_assessments_table',
        'user_stage_progress' => '2025_11_19_100003_create_user_stage_progress_table',
        'championship_game_resume_requests' => '2025_11_21_050309_create_championship_game_resume_requests_table',
    ];

    // Disable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS = 0');
    echo "✅ Foreign key checks disabled\n\n";

    $addedCount = 0;

    // Check for tables that exist but don't have migration records
    echo "🔍 Checking for missing migration records...\n";
    foreach ($tableToMigrationMap as $table => $migrationName) {
        if (in_array($table, $tables) && !in_array($migrationName, $ranMigrations)) {
            echo "📝 Adding migration record for table '{$table}': {$migrationName}\n";

            try {
                DB::table('migrations')->insert([
                    'migration' => $migrationName,
                    'batch' => DB::table('migrations')->max('batch') + 1
                ]);
                $addedCount++;
                echo "✅ Added migration record\n";
            } catch (Exception $e) {
                echo "⚠️  Failed to add: " . $e->getMessage() . "\n";
            }
        }
    }

    // Also check if any migration files match pattern for existing tables
    echo "\n🔍 Checking for other missing migration records...\n";
    foreach ($allMigrations as $migration) {
        if (!in_array($migration, $ranMigrations)) {
            // Extract table name from migration (pattern: create_..._table)
            if (preg_match('/create_(\w+)_table/', $migration, $matches)) {
                $tableName = $matches[1];

                // Convert table name to actual table name (pluralize, handle special cases)
                $possibleTableNames = [
                    $tableName,
                    str_replace('_', '', $tableName),
                    strtolower($tableName),
                    str_replace('_achievement', 'achievements', $tableName),
                    str_replace('_challenge', 'challenges', $tableName),
                    str_replace('_completion', 'completions', $tableName),
                    str_replace('_practice', 'practice', $tableName),
                ];

                foreach ($possibleTableNames as $possibleTable) {
                    if (in_array($possibleTable, $tables)) {
                        echo "📝 Adding migration record: {$migration}\n";
                        DB::table('migrations')->insert([
                            'migration' => $migration,
                            'batch' => DB::table('migrations')->max('batch') + 1
                        ]);
                        $addedCount++;
                        echo "✅ Added migration record for table '{$possibleTable}'\n";
                        break;
                    }
                }
            }
        }
    }

    // Re-enable foreign key checks
    DB::statement('SET FOREIGN_KEY_CHECKS = 1');
    echo "\n✅ Foreign key checks re-enabled\n";

    echo "\n📊 Summary:\n";
    echo "- Migration records added: {$addedCount}\n";

    // Show current migration status
    echo "\n📋 Running migration status check...\n";
    $pendingMigrations = array_diff($allMigrations, DB::table('migrations')->pluck('migration')->toArray());

    if (!empty($pendingMigrations)) {
        echo "\n🔄 Pending migrations (" . count($pendingMigrations) . "):\n";
        foreach ($pendingMigrations as $migration) {
            echo "  - {$migration}\n";
        }
    } else {
        echo "\n✅ All migrations are up to date!\n";
    }

    echo "\n🎯 Next steps:\n";
    echo "1. Run: php artisan migrate --force\n";
    echo "2. If still failing: php artisan migrate:fresh --force (⚠️  deletes all data)\n";

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";

    // Re-enable foreign key checks on error
    try {
        DB::statement('SET FOREIGN_KEY_CHECKS = 1');
    } catch (Exception $e2) {
        // Ignore
    }
}