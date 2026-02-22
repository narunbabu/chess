<?php

namespace App\Console\Commands;

use App\Enums\PaymentStatus;
use App\Models\ChampionshipParticipant;
use Illuminate\Console\Command;

/**
 * C3 Fix: Clean up orphaned pending championship registrations.
 *
 * When a user initiates payment but never completes it (browser closed,
 * network error, abandoned checkout), the participant row stays in 'pending'
 * state indefinitely, inflating the capacity count and blocking the slot.
 *
 * This command marks stale pending rows as failed so that:
 *  - The slot is freed for other registrants
 *  - The user can retry registration if they return later
 */
class CleanupPendingRegistrations extends Command
{
    protected $signature = 'championships:cleanup-pending
                            {--minutes=30 : Age threshold in minutes for stale pending records}
                            {--dry-run : Show what would be cleaned without making changes}';

    protected $description = 'Mark stale pending championship registrations as failed';

    public function handle(): int
    {
        $minutes = (int) $this->option('minutes');
        $dryRun  = (bool) $this->option('dry-run');
        $cutoff  = now()->subMinutes($minutes);

        $stale = ChampionshipParticipant::pending()
            ->where('created_at', '<', $cutoff)
            ->with(['championship:id,title', 'user:id,name'])
            ->get();

        if ($stale->isEmpty()) {
            $this->info('No stale pending registrations found.');
            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Found %d stale pending registration(s) older than %d minutes.',
            $stale->count(),
            $minutes
        ));

        if ($dryRun) {
            $this->table(
                ['ID', 'Championship', 'User', 'Created At'],
                $stale->map(fn ($p) => [
                    $p->id,
                    $p->championship?->title ?? "#{$p->championship_id}",
                    $p->user?->name ?? "#{$p->user_id}",
                    $p->created_at->toDateTimeString(),
                ])
            );
            $this->warn('Dry run — no changes made.');
            return self::SUCCESS;
        }

        $cleaned = 0;
        $errors  = 0;

        foreach ($stale as $participant) {
            try {
                $participant->markAsFailed();
                $cleaned++;

                $this->line(sprintf(
                    '  Marked #%d as failed (championship: %s, user: %s, age: %s)',
                    $participant->id,
                    $participant->championship?->title ?? "#{$participant->championship_id}",
                    $participant->user?->name ?? "#{$participant->user_id}",
                    $participant->created_at->diffForHumans()
                ));
            } catch (\Exception $e) {
                $errors++;
                $this->warn(sprintf(
                    '  Failed to mark #%d: %s',
                    $participant->id,
                    $e->getMessage()
                ));
            }
        }

        $this->info("Cleaned up {$cleaned} stale pending registration(s).");

        if ($errors > 0) {
            $this->warn("{$errors} record(s) could not be transitioned.");
        }

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }
}
