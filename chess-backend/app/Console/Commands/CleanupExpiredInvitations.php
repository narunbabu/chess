<?php

namespace App\Console\Commands;

use App\Models\Invitation;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanupExpiredInvitations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invitations:cleanup-expired';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up expired invitations and update their status';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting cleanup of expired invitations...');

        try {
            // Find expired invitations
            $expiredInvitations = Invitation::where('status', 'pending')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<', now())
                ->get();

            $count = $expiredInvitations->count();

            if ($count === 0) {
                $this->info('No expired invitations found.');
                return 0;
            }

            $this->info("Found {$count} expired invitations to clean up.");

            // Update expired invitations
            $updatedCount = Invitation::where('status', 'pending')
                ->whereNotNull('expires_at')
                ->where('expires_at', '<', now())
                ->update([
                    'status' => 'expired',
                    'updated_at' => now()
                ]);

            Log::info('Expired invitations cleanup completed', [
                'total_expired' => $count,
                'updated_count' => $updatedCount
            ]);

            $this->info("Successfully marked {$updatedCount} invitations as expired.");

            // Optional: Delete old expired invitations (older than 7 days)
            $deletedCount = Invitation::where('status', 'expired')
                ->where('updated_at', '<', now()->subDays(7))
                ->delete();

            if ($deletedCount > 0) {
                $this->info("Deleted {$deletedCount} old expired invitations (older than 7 days).");
                Log::info('Old expired invitations deleted', [
                    'deleted_count' => $deletedCount
                ]);
            }

            return 0;

        } catch (\Exception $e) {
            $this->error('Error during expired invitations cleanup: ' . $e->getMessage());
            Log::error('Failed to cleanup expired invitations', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }
    }
}