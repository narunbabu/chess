<?php

namespace App\Console\Commands;

use App\Enums\PaymentStatus;
use App\Models\ChampionshipParticipant;
use App\Models\PaymentStatus as PaymentStatusModel;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Diagnostic command for detecting and fixing registration_status ↔ payment_status
 * inconsistencies in the championship_participants table.
 *
 * Common inconsistency patterns:
 *  - Free entries with payment_status=completed but registration_status='payment_pending'
 *  - Cancelled participants whose active_unique_key was not nullified
 *  - registration_status not matching the PAYMENT_TO_REGISTRATION_STATUS mapping
 */
class DiagnoseRegistrationStatus extends Command
{
    protected $signature = 'championships:diagnose-status
                            {--fix : Auto-fix detected inconsistencies}
                            {--dry-run : Show what would be fixed without making changes}';

    protected $description = 'Detect and optionally fix registration_status ↔ payment_status inconsistencies';

    public function handle(): int
    {
        $fix    = (bool) $this->option('fix');
        $dryRun = (bool) $this->option('dry-run');

        if ($fix && $dryRun) {
            $this->error('Cannot use --fix and --dry-run together.');
            return self::FAILURE;
        }

        $this->info('Scanning championship_participants for status inconsistencies...');
        $this->newLine();

        $issues = collect();

        // ── Check 1: registration_status vs payment_status mismatch ──────────
        $this->checkStatusMismatch($issues);

        // ── Check 2: active_unique_key out of sync ───────────────────────────
        $this->checkActiveKeySync($issues);

        // ── Check 3: orphaned pending records (no Razorpay order) ────────────
        $this->checkOrphanedPending($issues);

        // ── Report ───────────────────────────────────────────────────────────
        if ($issues->isEmpty()) {
            $this->info('No inconsistencies found. All records are in sync.');
            return self::SUCCESS;
        }

        $this->warn("Found {$issues->count()} inconsistency(ies):");
        $this->newLine();

        $this->table(
            ['ID', 'Champ', 'User', 'Type', 'Current', 'Expected', 'Created'],
            $issues->map(fn ($i) => [
                $i['id'],
                $i['championship_id'],
                $i['user_id'],
                $i['type'],
                $i['current'],
                $i['expected'],
                $i['created_at'],
            ])
        );

        if (!$fix) {
            $this->newLine();
            $this->info('Run with --fix to auto-repair these inconsistencies.');
            return self::FAILURE;
        }

        // ── Apply fixes ──────────────────────────────────────────────────────
        $this->newLine();
        $this->info('Applying fixes...');

        $fixed  = 0;
        $errors = 0;

        foreach ($issues as $issue) {
            try {
                $this->applyFix($issue);
                $fixed++;
                $this->line("  Fixed #{$issue['id']}: {$issue['type']}");
            } catch (\Exception $e) {
                $errors++;
                $this->warn("  Failed #{$issue['id']}: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("Fixed {$fixed} record(s).");

        if ($errors > 0) {
            $this->warn("{$errors} record(s) could not be fixed.");
        }

        return $errors > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * Check 1: registration_status doesn't match the expected value
     * derived from payment_status via PAYMENT_TO_REGISTRATION_STATUS mapping.
     *
     * Excludes 'cancelled' — that's a lifecycle event outside the payment state machine.
     */
    private function checkStatusMismatch(\Illuminate\Support\Collection $issues): void
    {
        $mapping = ChampionshipParticipant::PAYMENT_TO_REGISTRATION_STATUS;

        $participants = ChampionshipParticipant::with(['paymentStatusRelation', 'championship:id,title', 'user:id,name'])
            ->where('registration_status', '!=', 'cancelled')
            ->get();

        foreach ($participants as $p) {
            $paymentCode = $p->payment_status;
            $expected    = $mapping[$paymentCode] ?? null;

            if ($expected && $p->registration_status !== $expected) {
                $issues->push([
                    'id'              => $p->id,
                    'championship_id' => $p->championship_id,
                    'user_id'         => $p->user_id,
                    'type'            => 'status_mismatch',
                    'current'         => "reg={$p->registration_status}, pay={$paymentCode}",
                    'expected'        => "reg={$expected}",
                    'created_at'      => $p->created_at?->toDateTimeString() ?? '-',
                    'fix_to'          => $expected,
                ]);
            }
        }
    }

    /**
     * Check 2: active_unique_key not in sync with registration_status.
     * Active rows should have active_unique_key = user_id.
     * Cancelled/refunded rows should have active_unique_key = NULL.
     */
    private function checkActiveKeySync(\Illuminate\Support\Collection $issues): void
    {
        $inactive = ['cancelled', 'refunded'];

        // Active rows with NULL key
        $missingKey = ChampionshipParticipant::whereNotIn('registration_status', $inactive)
            ->whereNull('active_unique_key')
            ->with(['championship:id,title', 'user:id,name'])
            ->get();

        foreach ($missingKey as $p) {
            $issues->push([
                'id'              => $p->id,
                'championship_id' => $p->championship_id,
                'user_id'         => $p->user_id,
                'type'            => 'active_key_null',
                'current'         => "key=NULL, reg={$p->registration_status}",
                'expected'        => "key={$p->user_id}",
                'created_at'      => $p->created_at?->toDateTimeString() ?? '-',
                'fix_to'          => $p->user_id,
            ]);
        }

        // Inactive rows with non-NULL key
        $staleKey = ChampionshipParticipant::whereIn('registration_status', $inactive)
            ->whereNotNull('active_unique_key')
            ->with(['championship:id,title', 'user:id,name'])
            ->get();

        foreach ($staleKey as $p) {
            $issues->push([
                'id'              => $p->id,
                'championship_id' => $p->championship_id,
                'user_id'         => $p->user_id,
                'type'            => 'active_key_stale',
                'current'         => "key={$p->active_unique_key}, reg={$p->registration_status}",
                'expected'        => 'key=NULL',
                'created_at'      => $p->created_at?->toDateTimeString() ?? '-',
                'fix_to'          => null,
            ]);
        }
    }

    /**
     * Check 3: pending participants with no Razorpay order ID that are older
     * than 1 hour — likely orphaned from a failed initiatePayment flow.
     */
    private function checkOrphanedPending(\Illuminate\Support\Collection $issues): void
    {
        $orphaned = ChampionshipParticipant::pending()
            ->whereNull('razorpay_order_id')
            ->where('created_at', '<', now()->subHour())
            ->with(['championship:id,title', 'user:id,name'])
            ->get();

        foreach ($orphaned as $p) {
            // Skip free entries (amount_paid = 0 and completed) — they don't need an order
            if ($p->isPaid()) {
                continue;
            }

            $issues->push([
                'id'              => $p->id,
                'championship_id' => $p->championship_id,
                'user_id'         => $p->user_id,
                'type'            => 'orphaned_pending',
                'current'         => "pending, no order_id, age={$p->created_at->diffForHumans()}",
                'expected'        => 'failed (no payment initiated)',
                'created_at'      => $p->created_at?->toDateTimeString() ?? '-',
                'fix_to'          => 'failed',
            ]);
        }
    }

    /**
     * Apply a single fix based on issue type.
     */
    private function applyFix(array $issue): void
    {
        $participant = ChampionshipParticipant::findOrFail($issue['id']);

        DB::transaction(function () use ($participant, $issue) {
            $fresh = ChampionshipParticipant::lockForUpdate()->findOrFail($participant->id);

            switch ($issue['type']) {
                case 'status_mismatch':
                    $fresh->update(['registration_status' => $issue['fix_to']]);
                    break;

                case 'active_key_null':
                    $fresh->update(['active_unique_key' => $issue['fix_to']]);
                    break;

                case 'active_key_stale':
                    $fresh->update(['active_unique_key' => null]);
                    break;

                case 'orphaned_pending':
                    $fresh->markAsFailed();
                    break;
            }
        });
    }
}
