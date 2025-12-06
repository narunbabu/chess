<?php

/**
 * Quick Database Restore
 *
 * Usage: php quick_restore.php [backup_file.sqlite]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class QuickRestore
{
    private string $backupFile;
    private string $databasePath;

    public function __construct(array $args)
    {
        if (count($args) < 2) {
            echo "❌ Please specify backup file to restore\n";
            echo "Usage: php quick_restore.php [backup_file.sqlite]\n";
            exit(1);
        }

        $this->backupFile = $args[1];
        $this->databasePath = config('database.connections.sqlite.database');
    }

    public function execute(): void
    {
        try {
            echo "🔄 Starting Quick Database Restore\n";
            echo str_repeat("=", 50) . "\n";

            // Check if backup file exists
            if (!file_exists($this->backupFile)) {
                throw new Exception("Backup file not found: {$this->backupFile}");
            }

            echo "📁 Restoring from: " . basename($this->backupFile) . "\n";

            // Copy backup file to database location
            if (!copy($this->backupFile, $this->databasePath)) {
                throw new Exception("Failed to restore database file");
            }

            echo "✅ Database restored successfully!\n";
            echo "📁 Database location: " . $this->databasePath . "\n";

            // Show basic verification
            $this->quickVerify();

        } catch (Exception $e) {
            echo "\n❌ Restore failed: " . $e->getMessage() . "\n";
            exit(1);
        }
    }

    private function quickVerify(): void
    {
        echo "\n🔍 Quick verification:\n";

        try {
            $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
            echo "📊 Total tables: " . count($tables) . "\n";

            // Show counts for key tables
            $keyTables = ['users', 'championships', 'migrations'];
            foreach ($keyTables as $table) {
                if (Schema::hasTable($table)) {
                    $count = DB::table($table)->count();
                    echo "📋 {$table}: {$count} records\n";
                } else {
                    echo "📋 {$table}: Table not found\n";
                }
            }

        } catch (Exception $e) {
            echo "⚠️  Could not verify database: " . $e->getMessage() . "\n";
        }
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $restore = new QuickRestore($argv);
        $restore->execute();

        echo "\n🎯 Quick restore completed!\n";

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}