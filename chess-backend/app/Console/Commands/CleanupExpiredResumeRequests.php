<?php

namespace App\Console\Commands;

use App\Models\Game;
use App\Models\Invitation;
use App\Events\ResumeRequestExpired;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanupExpiredResumeRequests extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'resume:cleanup-expired';

    /**
     * The console command description.
     */
    protected $description = 'Clean up expired resume requests and broadcast expiration events';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Starting cleanup of expired resume requests...');

        $cleanedCount = 0;

        try {
            // Find all games with expired resume requests
            $expiredGames = Game::where('status', 'paused')
                ->where('resume_status', 'pending')
                ->where('resume_request_expires_at', '<', now())
                ->get();

            foreach ($expiredGames as $game) {
                $requesterId = $game->resume_requested_by;
                $responderId = ($game->white_player_id === $requesterId)
                    ? $game->black_player_id
                    : $game->white_player_id;

                // Update the invitation record to expired
                Invitation::where('type', 'resume_request')
                    ->where('game_id', $game->id)
                    ->where('inviter_id', $requesterId)
                    ->where('status', 'pending')
                    ->update([
                        'status' => 'expired',
                        'responded_by' => null, // System cleanup
                        'responded_at' => now()
                    ]);

                // Clear resume request fields
                $game->update([
                    'resume_status' => 'expired',
                    'resume_requested_by' => null,
                    'resume_requested_at' => null,
                    'resume_request_expires_at' => null
                ]);

                // Broadcast expiration event to both players
                Log::info('🧹 Broadcasting ResumeRequestExpired event from cleanup', [
                    'game_id' => $game->id,
                    'requester_id' => $requesterId,
                    'responder_id' => $responderId,
                    'channels' => [
                        'App.Models.User.' . $requesterId,
                        'App.Models.User.' . $responderId
                    ],
                    'event' => 'resume.request.expired'
                ]);

                broadcast(new ResumeRequestExpired($game, $requesterId, $responderId));

                $this->line("Cleaned up expired resume request for game {$game->id}");
                $cleanedCount++;
            }

            $this->info("Cleanup completed. {$cleanedCount} expired resume requests processed.");

        } catch (\Exception $e) {
            $this->error("Error during cleanup: {$e->getMessage()}");
            Log::error('Resume request cleanup failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return 1;
        }

        return 0;
    }
}