<?php

namespace App\Console\Commands;

use App\Mail\WeeklyDigestMail;
use App\Models\User;
use App\Services\EmailPreferenceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class SendWeeklyDigest extends Command
{
    protected $signature = 'emails:send-weekly-digest
                            {--dry-run : Show who would receive emails without sending}
                            {--limit=1000 : Maximum number of emails to send}';

    protected $description = 'Send weekly stats digest to active players';

    public function handle(EmailPreferenceService $prefService): int
    {
        $dryRun = $this->option('dry-run');
        $limit = (int) $this->option('limit');
        $weekAgo = now()->subDays(7);

        $this->info("SendWeeklyDigest: limit={$limit}" . ($dryRun ? ' [DRY RUN]' : ''));

        // Find users who played at least 1 game in the past 7 days
        $userIds = DB::table('games')
            ->where('created_at', '>=', $weekAgo)
            ->where(function ($q) {
                $q->whereNotNull('white_player_id')
                  ->orWhereNotNull('black_player_id');
            })
            ->selectRaw('DISTINCT CASE WHEN white_player_id IS NOT NULL THEN white_player_id END as uid')
            ->unionAll(
                DB::table('games')
                    ->where('created_at', '>=', $weekAgo)
                    ->whereNotNull('black_player_id')
                    ->selectRaw('DISTINCT black_player_id as uid')
            )
            ->pluck('uid')
            ->filter()
            ->unique()
            ->values();

        $users = User::query()
            ->whereIn('id', $userIds)
            ->whereNotNull('email')
            ->where('email_notifications_enabled', true)
            ->whereNull('email_unsubscribed_at')
            ->limit($limit)
            ->get();

        $sent = 0;
        $skipped = 0;

        foreach ($users as $user) {
            if (!$prefService->wantsEmailType($user, 'weekly_digest')) {
                $skipped++;
                continue;
            }

            $stats = $this->aggregateStats($user, $weekAgo);

            if ($stats['games_played'] === 0) {
                $skipped++;
                continue;
            }

            if ($dryRun) {
                $this->line("  [DRY RUN] Would send to {$user->email} (ID: {$user->id}) — {$stats['games_played']} games, {$stats['wins']}W/{$stats['losses']}L, rating {$stats['rating_change']}");
                $sent++;
                continue;
            }

            Mail::to($user->email)->queue(new WeeklyDigestMail($user, $stats));
            $prefService->recordEmailSent($user);
            $sent++;
        }

        $this->info("Done. Sent: {$sent}, Skipped: {$skipped}, Total eligible: {$users->count()}");

        return self::SUCCESS;
    }

    private function aggregateStats(User $user, $since): array
    {
        // status_id=3 means 'finished'
        $gamesAsWhite = DB::table('games')
            ->where('white_player_id', $user->id)
            ->where('created_at', '>=', $since)
            ->where('status_id', 3)
            ->get();

        $gamesAsBlack = DB::table('games')
            ->where('black_player_id', $user->id)
            ->where('created_at', '>=', $since)
            ->where('status_id', 3)
            ->get();

        $wins = 0;
        $losses = 0;
        $draws = 0;

        foreach ($gamesAsWhite as $game) {
            if ($game->result === '1-0') {
                $wins++;
            } elseif ($game->result === '0-1') {
                $losses++;
            } elseif ($game->result === '1/2-1/2') {
                $draws++;
            }
        }

        foreach ($gamesAsBlack as $game) {
            if ($game->result === '0-1') {
                $wins++;
            } elseif ($game->result === '1-0') {
                $losses++;
            } elseif ($game->result === '1/2-1/2') {
                $draws++;
            }
        }

        $gamesPlayed = $gamesAsWhite->count() + $gamesAsBlack->count();

        // Approximate rating change (simplified estimate without a rating_history table)
        $ratingChange = $wins * 15 - $losses * 15;

        $bestPerformance = null;
        if ($wins > 0) {
            $winRatio = round(($wins / max($gamesPlayed, 1)) * 100);
            $bestPerformance = "{$winRatio}% win rate across {$gamesPlayed} games";
        }

        return [
            'games_played' => $gamesPlayed,
            'wins' => $wins,
            'losses' => $losses,
            'draws' => $draws,
            'rating_change' => $ratingChange,
            'best_performance' => $bestPerformance,
        ];
    }
}
