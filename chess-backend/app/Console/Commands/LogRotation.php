<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Carbon\Carbon;

class LogRotation extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'logs:rotate
                            {--force : Force rotation even if today\'s log is empty}
                            {--compress=7 : Number of days to keep uncompressed logs}
                            {--cleanup=30 : Number of days to keep all logs}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Rotate, compress, and cleanup Laravel log files';

    /**
     * The log directory path
     */
    protected string $logPath;

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->logPath = storage_path('logs');
        $compressDays = $this->option('compress');
        $cleanupDays = $this->option('cleanup');
        $force = $this->option('force');

        $this->info('🔄 Starting log rotation...');
        $this->line("Log directory: {$this->logPath}");
        $this->line("Keep uncompressed logs for: {$compressDays} days");
        $this->line("Remove all logs after: {$cleanupDays} days");

        // Step 1: Rotate today's log if it exists and has content
        if ($this->shouldRotateToday($force)) {
            $this->rotateTodayLog();
        } else {
            $this->info('ℹ️  Today\'s log is empty or already rotated');
        }

        // Step 2: Compress old logs (older than compressDays)
        $this->compressOldLogs($compressDays);

        // Step 3: Cleanup very old logs (older than cleanupDays)
        $this->cleanupOldLogs($cleanupDays);

        // Step 4: Show summary
        $this->showSummary();

        $this->info('✅ Log rotation completed successfully!');
        return 0;
    }

    /**
     * Check if we should rotate today's log
     */
    protected function shouldRotateToday(bool $force): bool
    {
        $todayLog = $this->logPath . '/laravel.log';

        if (!file_exists($todayLog)) {
            return false;
        }

        if ($force) {
            return true;
        }

        // Check if log has content
        return filesize($todayLog) > 0;
    }

    /**
     * Rotate today's log to timestamped file
     */
    protected function rotateTodayLog(): void
    {
        $todayLog = $this->logPath . '/laravel.log';
        $rotatedLog = $this->logPath . '/laravel-' . date('Y-m-d') . '.log';

        if (file_exists($todayLog) && filesize($todayLog) > 0) {
            // Rename today's log
            if (rename($todayLog, $rotatedLog)) {
                $this->info("📝 Rotated: laravel.log → laravel-" . date('Y-m-d') . ".log");

                // Create new empty log file with proper permissions
                file_put_contents($todayLog, '');
                chmod($todayLog, 0644);
            } else {
                $this->error('❌ Failed to rotate today\'s log');
            }
        }
    }

    /**
     * Compress log files older than specified days
     */
    protected function compressOldLogs(int $compressDays): void
    {
        $files = glob($this->logPath . '/laravel-*.log');
        $compressedCount = 0;
        $totalSizeSaved = 0;

        foreach ($files as $file) {
            // Extract date from filename
            if (preg_match('/laravel-(\d{4}-\d{2}-\d{2})\.log$/', $file, $matches)) {
                $fileDate = Carbon::parse($matches[1]);
                $daysOld = $fileDate->diffInDays(now());

                if ($daysOld >= $compressDays) {
                    $originalSize = filesize($file);
                    $compressedFile = $file . '.gz';

                    if (!file_exists($compressedFile)) {
                        // Compress the file
                        $compressed = $this->gzipFile($file);

                        if ($compressed) {
                            $compressedSize = filesize($compressedFile);
                            $sizeSaved = $originalSize - $compressedSize;
                            $totalSizeSaved += $sizeSaved;
                            $compressedCount++;

                            $this->line("   🗜️  Compressed: " . basename($file) .
                                      " (" . $this->formatBytes($originalSize) . " → " .
                                      $this->formatBytes($compressedSize) . ")");

                            // Remove original file after successful compression
                            unlink($file);
                        } else {
                            $this->error("   ❌ Failed to compress: " . basename($file));
                        }
                    }
                }
            }
        }

        if ($compressedCount > 0) {
            $this->info("📦 Compressed {$compressedCount} files, saved {$this->formatBytes($totalSizeSaved)}");
        } else {
            $this->info('📦 No files needed compression');
        }
    }

    /**
     * Remove log files older than specified days
     */
    protected function cleanupOldLogs(int $cleanupDays): void
    {
        $files = array_merge(
            glob($this->logPath . '/laravel-*.log'),
            glob($this->logPath . '/laravel-*.log.gz')
        );

        $deletedCount = 0;
        $totalSizeFreed = 0;

        foreach ($files as $file) {
            // Extract date from filename
            if (preg_match('/laravel-(\d{4}-\d{2}-\d{2})(\.log(\.gz)?)$/', $file, $matches)) {
                $fileDate = Carbon::parse($matches[1]);
                $daysOld = $fileDate->diffInDays(now());

                if ($daysOld > $cleanupDays) {
                    $sizeFreed = filesize($file);
                    $totalSizeFreed += $sizeFreed;

                    if (unlink($file)) {
                        $deletedCount++;
                        $this->line("   🗑️  Deleted: " . basename($file) . " (freed {$this->formatBytes($sizeFreed)})");
                    } else {
                        $this->error("   ❌ Failed to delete: " . basename($file));
                    }
                }
            }
        }

        if ($deletedCount > 0) {
            $this->info("🗑️  Deleted {$deletedCount} old files, freed {$this->formatBytes($totalSizeFreed)}");
        } else {
            $this->info('🗑️  No files needed cleanup');
        }
    }

    /**
     * Compress a file using gzip
     */
    protected function gzipFile(string $source): string|false
    {
        $dest = $source . '.gz';

        // Open source file for reading
        $src = fopen($source, 'rb');
        if (!$src) {
            return false;
        }

        // Open destination file for writing with compression
        $dst = gzopen($dest, 'wb9');
        if (!$dst) {
            fclose($src);
            return false;
        }

        // Copy and compress
        while (!feof($src)) {
            gzwrite($dst, fread($src, 1024 * 512)); // 512KB chunks
        }

        fclose($src);
        gzclose($dst);

        return $dest;
    }

    /**
     * Show log directory summary
     */
    protected function showSummary(): void
    {
        $this->newLine();
        $this->info('📊 Log Directory Summary:');

        $currentLog = $this->logPath . '/laravel.log';
        if (file_exists($currentLog)) {
            $this->line("   Current log: " . $this->formatBytes(filesize($currentLog)));
        }

        $rotatedLogs = glob($this->logPath . '/laravel-*.log');
        $compressedLogs = glob($this->logPath . '/laravel-*.log.gz');

        $rotatedSize = array_sum(array_map('filesize', $rotatedLogs));
        $compressedSize = array_sum(array_map('filesize', $compressedLogs));

        $this->line("   Rotated logs: " . count($rotatedLogs) . " files ({$this->formatBytes($rotatedSize)})");
        $this->line("   Compressed logs: " . count($compressedLogs) . " files ({$this->formatBytes($compressedSize)})");
        $this->line("   Total size: " . $this->formatBytes($rotatedSize + $compressedSize));
    }

    /**
     * Format bytes to human readable format
     */
    protected function formatBytes(int $bytes): string
    {
        $units = ['B', 'KB', 'MB', 'GB'];
        $bytes = max($bytes, 0);
        $pow = floor(($bytes ? log($bytes) : 0) / log(1024));
        $pow = min($pow, count($units) - 1);

        $bytes /= pow(1024, $pow);

        return round($bytes, 1) . ' ' . $units[$pow];
    }
}