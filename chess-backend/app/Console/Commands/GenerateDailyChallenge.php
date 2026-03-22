<?php

namespace App\Console\Commands;

use App\Models\DailyChallenge;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Generates tomorrow's daily challenge from the pool of seeded puzzles.
 *
 * If tomorrow's challenge already exists, does nothing.
 * Picks a puzzle that hasn't been used in the last 30 days, cycling through tiers.
 *
 * Usage:
 *   php artisan daily-challenge:generate           # Generate tomorrow's
 *   php artisan daily-challenge:generate --days=7  # Generate next 7 days
 *   php artisan daily-challenge:generate --dry-run  # Preview without creating
 */
class GenerateDailyChallenge extends Command
{
    protected $signature = 'daily-challenge:generate
                            {--days=1 : Number of days ahead to generate}
                            {--dry-run : Preview without creating}';

    protected $description = 'Generate upcoming daily challenges from the puzzle pool';

    // Cycle through tiers: beginner → intermediate → advanced → repeat
    private const TIER_CYCLE = ['beginner', 'intermediate', 'advanced'];

    // Cycle through types
    private const TYPE_CYCLE = ['tactic', 'endgame', 'puzzle', 'opening'];

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = $this->option('dry-run');

        $this->info("Generating daily challenges for the next {$days} day(s)...");

        if ($dryRun) {
            $this->warn('DRY RUN — no changes will be made');
        }

        $created = 0;
        $skipped = 0;

        for ($i = 1; $i <= $days; $i++) {
            $date = Carbon::today()->addDays($i)->toDateString();

            // Skip if already exists
            if (DailyChallenge::where('date', $date)->exists()) {
                $this->line("  {$date}: already exists — skipped");
                $skipped++;
                continue;
            }

            // Determine tier and type based on date offset (cycles evenly)
            $dayOffset = Carbon::today()->diffInDays(Carbon::parse($date));
            $tier = self::TIER_CYCLE[$dayOffset % count(self::TIER_CYCLE)];
            $type = self::TYPE_CYCLE[$dayOffset % count(self::TYPE_CYCLE)];

            // Find a puzzle not used in the last 30 days
            $recentlyUsedIds = DailyChallenge::where('date', '>=', Carbon::today()->subDays(30)->toDateString())
                ->pluck('id')
                ->toArray();

            // Pick a random puzzle matching the tier, excluding recently used
            $source = DailyChallenge::where('skill_tier', $tier)
                ->whereNotIn('id', $recentlyUsedIds)
                ->inRandomOrder()
                ->first();

            // Fallback: any puzzle from this tier
            if (!$source) {
                $source = DailyChallenge::where('skill_tier', $tier)
                    ->inRandomOrder()
                    ->first();
            }

            // Fallback: any puzzle at all
            if (!$source) {
                $source = DailyChallenge::inRandomOrder()->first();
            }

            if (!$source || !$source->challenge_data) {
                $this->error("  {$date}: no puzzle data available — skipped");
                continue;
            }

            $xp = match ($tier) {
                'beginner' => 15,
                'intermediate' => 25,
                'advanced' => 40,
                default => 25,
            };

            if ($dryRun) {
                $title = $source->challenge_data['title'] ?? 'Untitled';
                $this->line("  {$date}: would create [{$tier}/{$type}] \"{$title}\" ({$xp} XP)");
            } else {
                DailyChallenge::create([
                    'date' => $date,
                    'challenge_type' => $type,
                    'skill_tier' => $tier,
                    'challenge_data' => $source->challenge_data,
                    'xp_reward' => $xp,
                ]);
                $title = $source->challenge_data['title'] ?? 'Untitled';
                $this->line("  {$date}: created [{$tier}/{$type}] \"{$title}\" ({$xp} XP)");
            }

            $created++;
        }

        $this->info("Done: {$created} created, {$skipped} skipped.");

        Log::info('Daily challenge generation completed', [
            'days' => $days,
            'created' => $created,
            'skipped' => $skipped,
            'dry_run' => $dryRun,
        ]);

        return Command::SUCCESS;
    }
}
