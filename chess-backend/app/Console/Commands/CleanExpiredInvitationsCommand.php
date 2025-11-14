<?php

namespace App\Console\Commands;

use App\Models\Invitation;
use App\Models\ChampionshipMatch;
use App\Enums\ChampionshipMatchStatus;
use App\Services\ChampionshipMatchInvitationService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class CleanExpiredInvitationsCommand extends Command
{
    /**
     * The name and signature of the console command.
     */
    protected $signature = 'invitations:clean-expired
                            {--force : Force cleanup without confirmation}
                            {--dry-run : Show what would be cleaned without actually cleaning}
                            {--championship= : Clean invitations for specific championship}';

    /**
     * The console command description.
     */
    protected $description = 'Clean up expired championship match invitations and update match status';

    /**
     * Execute the console command.
     */
    public function handle(ChampionshipMatchInvitationService $invitationService): int
    {
        $this->info('🧹 Starting expired invitation cleanup...');

        $force = $this->option('force');
        $dryRun = $this->option('dry-run');
        $specificChampionship = $this->option('championship');

        if ($dryRun) {
            $this->warn('🔍 DRY RUN MODE - No invitations will actually be cleaned');
        }

        try {
            // Find expired championship match invitations
            $query = Invitation::where('type', 'championship_match')
                ->where('status', 'pending')
                ->where('expires_at', '<', now());

            if ($specificChampionship) {
                $query->whereHas('championshipMatch', function ($q) use ($specificChampionship) {
                    $q->where('championship_id', $specificChampionship);
                });
            }

            $expiredInvitations = $query->with('championshipMatch.championship')->get();

            if ($expiredInvitations->isEmpty()) {
                $this->info('✅ No expired invitations found');
                return Command::SUCCESS;
            }

            $this->info("📊 Found {$expiredInvitations->count()} expired invitations");

            if (!$force && !$dryRun) {
                if (!$this->confirm('Continue with cleanup?')) {
                    $this->info('❌ Cleanup cancelled');
                    return Command::SUCCESS;
                }
            }

            $cleanedCount = 0;
            $errorCount = 0;

            foreach ($expiredInvitations as $invitation) {
                $this->line("\n📨 Processing invitation {$invitation->id}");

                if ($invitation->championshipMatch) {
                    $match = $invitation->championshipMatch;
                    $this->line("  🏆 Championship: {$match->championship->name}");
                    $this->line("  🎯 Match ID: {$match->id} (Round {$match->round_number})");
                }

                if ($dryRun) {
                    $this->info("  🔍 Would mark as expired");
                    $cleanedCount++;
                    continue;
                }

                try {
                    // Use the service to handle expiration with event broadcasting
                    $timeoutMinutes = $invitation->championshipMatch?->championship?->getInvitationTimeoutMinutes() ?? 60;

                    // Update invitation status
                    $invitation->update([
                        'status' => 'expired',
                        'responded_at' => now(),
                        'metadata' => array_merge($invitation->metadata ?? [], [
                            'auto_expired_at' => now()->toISOString(),
                            'timeout_minutes' => $timeoutMinutes,
                        ]),
                    ]);

                    // Update match status back to pending
                    if ($invitation->championshipMatch) {
                        $invitation->championshipMatch->update([
                            'status' => ChampionshipMatchStatus::PENDING,
                        ]);

                        // Broadcast expiration event
                        broadcast(new \App\Events\ChampionshipMatchInvitationExpired(
                            $invitation->championshipMatch,
                            $timeoutMinutes
                        ));
                    }

                    Log::info('Expired championship match invitation', [
                        'invitation_id' => $invitation->id,
                        'championship_match_id' => $invitation->championship_match_id,
                        'expired_at' => now()->toDateTimeString(),
                        'timeout_minutes' => $timeoutMinutes,
                    ]);

                    $this->info("  ✅ Marked as expired");
                    $cleanedCount++;

                } catch (\Exception $e) {
                    $this->error("  ❌ Failed to expire invitation: {$e->getMessage()}");
                    Log::error('Failed to expire championship match invitation', [
                        'invitation_id' => $invitation->id,
                        'error' => $e->getMessage(),
                    ]);
                    $errorCount++;
                }
            }

            $this->newLine();
            $this->info("📊 Cleanup Summary:");
            $this->line("  Cleaned: {$cleanedCount}");
            $this->line("  Errors: {$errorCount}");

            if ($dryRun) {
                $this->warn("🔍 DRY RUN COMPLETE - No actual changes made");
            } else {
                Log::info('Expired invitation cleanup completed', [
                    'cleaned_count' => $cleanedCount,
                    'error_count' => $errorCount,
                    'total_processed' => $expiredInvitations->count(),
                ]);
            }

            return Command::SUCCESS;

        } catch (\Exception $e) {
            $this->error("❌ Critical error during invitation cleanup: {$e->getMessage()}");
            Log::error('CleanExpiredInvitationsCommand failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return Command::FAILURE;
        }
    }
}