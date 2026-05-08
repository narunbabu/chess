<?php

namespace App\Console\Commands;

use App\Models\DailyChallenge;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * Generates upcoming daily challenge tracks from the seeded puzzle pool.
 *
 * Usage:
 *   php artisan daily-challenge:generate
 *   php artisan daily-challenge:generate --days=7
 *   php artisan daily-challenge:generate --dry-run
 */
class GenerateDailyChallenge extends Command
{
    protected $signature = 'daily-challenge:generate
                            {--days=1 : Number of days ahead to generate}
                            {--dry-run : Preview without creating}';

    protected $description = 'Generate upcoming daily challenge tracks from the puzzle pool';

    public function handle(): int
    {
        $days = (int) $this->option('days');
        $dryRun = $this->option('dry-run');

        $this->info("Generating daily challenge tracks for the next {$days} day(s)...");

        if ($dryRun) {
            $this->warn('DRY RUN - no changes will be made');
        }

        $created = 0;
        $skipped = 0;

        for ($i = 1; $i <= $days; $i++) {
            $date = Carbon::today()->addDays($i)->toDateString();

            foreach (DailyChallenge::tracks() as $track) {
                if (DailyChallenge::where('date', $date)->where('track_slug', $track['slug'])->exists()) {
                    $this->line("  {$date} {$track['slug']}: already exists - skipped");
                    $skipped++;
                    continue;
                }

                $source = $this->findSourceChallenge($track);

                if (!$source || !$source->challenge_data) {
                    $this->error("  {$date} {$track['slug']}: no puzzle data available - skipped");
                    continue;
                }

                $title = $source->challenge_data['title'] ?? 'Untitled';
                $tier = $track['skill_tier'];
                $type = $track['challenge_type'];

                if ($dryRun) {
                    $this->line("  {$date} {$track['slug']}: would create [{$tier}/{$type}] \"{$title}\" ({$track['xp_reward']} XP)");
                    $created++;
                    continue;
                }

                DailyChallenge::create([
                    'date' => $date,
                    'track_slug' => $track['slug'],
                    'required_tier' => $track['required_tier'],
                    'challenge_type' => $type,
                    'skill_tier' => $tier,
                    'skill_band' => DailyChallenge::resolveSkillBandForTrack($track, null, $tier),
                    'track_label' => $track['label'],
                    'challenge_data' => $source->challenge_data,
                    'xp_reward' => $track['xp_reward'],
                ]);

                $this->line("  {$date} {$track['slug']}: created [{$tier}/{$type}] \"{$title}\" ({$track['xp_reward']} XP)");
                $created++;
            }
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

    private function findSourceChallenge(array $track): ?DailyChallenge
    {
        $recentlyUsedIds = DailyChallenge::where('date', '>=', Carbon::today()->subDays(30)->toDateString())
            ->where('track_slug', $track['slug'])
            ->pluck('id')
            ->toArray();

        $source = DailyChallenge::where('skill_tier', $track['skill_tier'])
            ->where('challenge_type', $track['challenge_type'])
            ->whereNotIn('id', $recentlyUsedIds)
            ->inRandomOrder()
            ->first();

        if ($source) {
            return $source;
        }

        $source = DailyChallenge::where('skill_tier', $track['skill_tier'])
            ->whereNotIn('id', $recentlyUsedIds)
            ->inRandomOrder()
            ->first();

        return $source ?: DailyChallenge::inRandomOrder()->first();
    }
}
