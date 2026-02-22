<?php

namespace App\Console\Commands;

use App\Models\Invitation;
use App\Models\Game;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanupStaleInvitations extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'invitations:cleanup';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Clean up stale invitations from finished games and old records';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('🧹 Starting invitation cleanup...');

        // Clean up invitations linked to finished games
        $finishedGameInvitations = Invitation::whereHas('game', function ($query) {
            $query->whereHas('statusRelation', function ($q) {
                $q->whereIn('code', ['finished', 'aborted', 'completed']);
            });
        });

        $finishedCount = $finishedGameInvitations->count();
        $finishedGameInvitations->delete();

        $this->info("📊 Deleted {$finishedCount} invitations from finished games");

        // Clean up very old accepted invitations (older than 30 days)
        $oldAcceptedInvitations = Invitation::where('status', 'accepted')
            ->where('updated_at', '<', now()->subDays(30));

        $oldCount = $oldAcceptedInvitations->count();
        $oldAcceptedInvitations->delete();

        $this->info("📊 Deleted {$oldCount} old accepted invitations (30+ days)");

        // Clean up expired pending invitations
        $expiredInvitations = Invitation::where('status', 'pending')
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', now());

        $expiredCount = $expiredInvitations->count();
        $expiredInvitations->delete();

        $this->info("📊 Deleted {$expiredCount} expired pending invitations");

        // Clear resume info from finished games
        $gamesWithResumeInfo = Game::whereHas('statusRelation', function ($q) {
                $q->whereIn('code', ['finished', 'aborted', 'completed']);
            })->where(function ($query) {
                $query->whereNotNull('resume_requested_by')
                      ->orWhereNotNull('resume_requested_at');
            });

        $gamesWithResumeCount = $gamesWithResumeInfo->count();
        $gamesWithResumeInfo->update([
            'resume_requested_by' => null,
            'resume_requested_at' => null,
            'resume_request_expires_at' => null
        ]);

        $this->info("📊 Cleared resume info from {$gamesWithResumeCount} finished games");

        $totalDeleted = $finishedCount + $oldCount + $expiredCount;
        $this->info("✅ Cleanup complete! Total invitations deleted: {$totalDeleted}");

        Log::info('🧹 Invitation cleanup completed', [
            'finished_game_invitations' => $finishedCount,
            'old_accepted_invitations' => $oldCount,
            'expired_invitations' => $expiredCount,
            'total_deleted' => $totalDeleted,
            'games_with_resume_cleared' => $gamesWithResumeCount
        ]);

        return 0;
    }
}