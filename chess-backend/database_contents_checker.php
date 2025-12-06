<?php

/**
 * Database Contents Checker
 *
 * Lists the number of records in each table.
 * Can be used before and after backup operations to verify data transfer.
 *
 * Usage: php database_contents_checker.php [--before|--after]
 */

require_once __DIR__ . '/vendor/autoload.php';

$app = require_once __DIR__ . '/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

class DatabaseContentsChecker
{
    private string $mode;
    private ?string $backupFile;

    public function __construct(array $args = [])
    {
        $this->mode = 'current';
        $this->backupFile = null;

        // Check for mode flags
        if (in_array('--before', $args)) {
            $this->mode = 'before';
        } elseif (in_array('--after', $args)) {
            $this->mode = 'after';
        }

        // For 'after' mode, find the latest backup file
        if ($this->mode === 'after') {
            $this->findLatestBackup();
        }
    }

    /**
     * Execute contents check
     */
    public function execute(): void
    {
        try {
            $title = match($this->mode) {
                'before' => '📋 Database Contents - Before Backup',
                'after' => '📊 Database Contents - After Restore',
                default => '📊 Current Database Contents'
            };

            require_once __DIR__ . '/timestamp_helper.php';
        echo "\n" . str_repeat("=", 80) . "\n";
        echo "    {$title}\n";
        echo str_repeat("=", 80) . "\n";
        echo "Generated at: " . LocalTimestamp::displayDateTime() . " (" . LocalTimestamp::getTimezone() . ")\n\n";

            $this->displayTableContents();

            echo str_repeat("=", 80) . "\n";

            if ($this->mode === 'before') {
                echo "\n💡 Next steps:\n";
                echo "1. Run: php database_backup.php\n";
                echo "2. Run: php database_contents_checker.php --after\n";
                echo "3. Compare the reports to verify data backup\n";
            }

        } catch (Exception $e) {
            echo "\n❌ Error checking database contents: " . $e->getMessage() . "\n";
            exit(1);
        }
    }

    /**
     * Display contents of all tables
     */
    private function displayTableContents(): void
    {
        if ($this->mode === 'after' && $this->backupFile) {
            echo "📁 Comparing with backup: " . basename($this->backupFile) . "\n\n";
            $this->compareWithBackup();
        } else {
            $this->showCurrentContents();
        }
    }

    /**
     * Show current database contents
     */
    private function showCurrentContents(): void
    {
        $tables = $this->getAllTables();
        $totalRecords = 0;
        $tablesWithData = 0;

        echo sprintf("%-40s %10s %15s\n", "Table Name", "Records", "Status");
        echo str_repeat("-", 80) . "\n";

        foreach ($tables as $tableName) {
            $count = DB::table($tableName)->count();
            $totalRecords += $count;

            if ($count > 0) {
                $tablesWithData++;
            }

            $status = $this->getTableStatus($count);
            echo sprintf("%-40s %10s %15s\n", $tableName, number_format($count), $status);
        }

        echo str_repeat("-", 80) . "\n";
        echo sprintf("%-40s %10s\n", "Total Tables:", count($tables));
        echo sprintf("%-40s %10s\n", "Tables with Data:", $tablesWithData);
        echo sprintf("%-40s %10s\n", "Total Records:", number_format($totalRecords));
    }

    /**
     * Compare current database with backup
     */
    private function compareWithBackup(): void
    {
        if (!file_exists($this->backupFile)) {
            echo "⚠️  Backup file not found: " . basename($this->backupFile) . "\n";
            echo "Showing current database contents only:\n\n";
            $this->showCurrentContents();
            return;
        }

        try {
            // Connect to backup database
            $backupDb = new PDO("sqlite:{$this->backupFile}");

            // Get all current tables
            $currentTables = $this->getAllTables();
            $backupTables = $this->getBackupTables($backupDb);
            $allTables = array_unique(array_merge($currentTables, $backupTables));
            sort($allTables);

            echo sprintf("%-40s %12s %12s %12s %15s\n",
                "Table Name", "Current", "Backup", "Difference", "Status");
            echo str_repeat("-", 100) . "\n";

            $totalCurrent = 0;
            $totalBackup = 0;
            $totalDiff = 0;
            $mismatchedTables = 0;

            foreach ($allTables as $tableName) {
                $currentCount = in_array($tableName, $currentTables) ? DB::table($tableName)->count() : 0;
                $backupCount = $this->getBackupTableCount($backupDb, $tableName);

                $difference = $currentCount - $backupCount;
                $status = $this->getComparisonStatus($currentCount, $backupCount);

                $totalCurrent += $currentCount;
                $totalBackup += $backupCount;
                $totalDiff += abs($difference);

                if ($difference !== 0) {
                    $mismatchedTables++;
                }

                $displayCurrent = $currentCount > 0 ? number_format($currentCount) : "0";
                $displayBackup = $backupCount > 0 ? number_format($backupCount) : "0";
                $displayDiff = $difference !== 0 ?
                    ($difference > 0 ? "+{$difference}" : "{$difference}") : "0";

                echo sprintf("%-40s %12s %12s %12s %15s\n",
                    $tableName, $displayCurrent, $displayBackup, $displayDiff, $status);
            }

            echo str_repeat("-", 100) . "\n";
            echo sprintf("%-40s %12s %12s %12s\n",
                "TOTALS:",
                number_format($totalCurrent),
                number_format($totalBackup),
                $totalDiff > 0 ? "{$totalDiff}" : "0");

            echo "\n📈 Summary:\n";
            echo "- Total tables checked: " . count($allTables) . "\n";
            echo "- Tables with matching data: " . (count($allTables) - $mismatchedTables) . "\n";
            echo "- Tables with data differences: {$mismatchedTables}\n";
            echo "- Total record differences: {$totalDiff}\n";

            if ($totalDiff === 0) {
                echo "\n✅ Perfect data match! All records successfully transferred.\n";
            } else {
                echo "\n⚠️  Data differences detected. Review the tables marked as \"DIFFERENT\".\n";
            }

        } catch (Exception $e) {
            echo "❌ Error comparing with backup: " . $e->getMessage() . "\n";
            echo "\nShowing current database contents only:\n\n";
            $this->showCurrentContents();
        }
    }

    /**
     * Get all tables from current database
     */
    private function getAllTables(): array
    {
        $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
        return array_map(fn($table) => $table->name, $tables);
    }

    /**
     * Get all tables from backup database
     */
    private function getBackupTables(PDO $backupDb): array
    {
        $tables = $backupDb->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")->fetchAll(PDO::FETCH_COLUMN);
        return $tables ?: [];
    }

    /**
     * Get record count for backup table
     */
    private function getBackupTableCount(PDO $backupDb, string $tableName): int
    {
        try {
            $stmt = $backupDb->query("SELECT COUNT(*) FROM {$tableName}");
            return $stmt ? $stmt->fetchColumn() : 0;
        } catch (Exception $e) {
            return 0;
        }
    }

    /**
     * Get status for current table
     */
    private function getTableStatus(int $count): string
    {
        if ($count === 0) {
            return "🔹 EMPTY";
        } elseif ($count < 10) {
            return "🔸 LOW";
        } elseif ($count < 100) {
            return "🔶 MEDIUM";
        } elseif ($count < 1000) {
            return "🔷 HIGH";
        } else {
            return "🔺 VERY HIGH";
        }
    }

    /**
     * Get comparison status
     */
    private function getComparisonStatus(int $current, int $backup): string
    {
        if ($current === $backup) {
            if ($current === 0) {
                return "✅ BOTH EMPTY";
            } else {
                return "✅ MATCH";
            }
        } elseif ($backup === 0) {
            return "🆕 NEW";
        } elseif ($current === 0) {
            return "❌ MISSING";
        } elseif ($current > $backup) {
            return "📈 MORE";
        } else {
            return "📉 LESS";
        }
    }

    /**
     * Get the current mode
     */
    public function getMode(): string
    {
        return $this->mode;
    }

    /**
     * Find the latest backup file
     */
    private function findLatestBackup(): void
    {
        $backupDir = __DIR__ . '/database/backups';

        if (!is_dir($backupDir)) {
            return;
        }

        $files = glob($backupDir . '/chess_web_backup_*.sqlite');

        if ($files) {
            usort($files, function($a, $b) {
                return filemtime($b) - filemtime($a);
            });

            $this->backupFile = $files[0];
        }
    }
}

// Command line interface
if (php_sapi_name() === 'cli') {
    try {
        $checker = new DatabaseContentsChecker($argv);
        $checker->execute();

        echo "\n🎯 Database contents check completed!\n";

        if ($checker->getMode() === 'current') {
            echo "\n📚 Usage examples:\n";
            echo "1. php database_contents_checker.php --before    (Before backup)\n";
            echo "2. php database_contents_checker.php --after     (After restore)\n";
        }

    } catch (Exception $e) {
        echo "❌ Fatal error: " . $e->getMessage() . "\n";
        exit(1);
    }
} else {
    echo "This script must be run from the command line.\n";
    exit(1);
}