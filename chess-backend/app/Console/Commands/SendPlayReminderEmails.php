<?php

namespace App\Console\Commands;

use App\Mail\PlayReminderMail;
use App\Models\User;
use App\Services\EmailPreferenceService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Mail;

class SendPlayReminderEmails extends Command
{
    protected $signature = 'emails:send-play-reminders
                            {--dry-run : Show who would receive emails without sending}
                            {--inactive-days=7 : Minimum days since last activity}
                            {--limit=500 : Maximum number of emails to send}';

    protected $description = 'Send re-engagement emails to inactive users';

    public function handle(EmailPreferenceService $prefService): int
    {
        $dryRun = $this->option('dry-run');
        $inactiveDays = (int) $this->option('inactive-days');
        $limit = (int) $this->option('limit');

        $this->info("SendPlayReminderEmails: inactive-days={$inactiveDays}, limit={$limit}" . ($dryRun ? ' [DRY RUN]' : ''));

        $cutoff = now()->subDays($inactiveDays);
        $throttle = now()->subDays(3);

        $users = User::query()
            ->whereNotNull('email')
            ->where('email_notifications_enabled', true)
            ->whereNull('email_unsubscribed_at')
            ->where(function ($q) use ($cutoff) {
                $q->where('last_activity_at', '<', $cutoff)
                  ->orWhere('last_login_at', '<', $cutoff);
            })
            ->where(function ($q) use ($throttle) {
                $q->whereNull('last_email_sent_at')
                  ->orWhere('last_email_sent_at', '<', $throttle);
            })
            ->limit($limit)
            ->get();

        $sent = 0;
        $skipped = 0;

        foreach ($users as $user) {
            if (!$prefService->wantsEmailType($user, 'play_reminder')) {
                $skipped++;
                continue;
            }

            if ($dryRun) {
                $this->line("  [DRY RUN] Would send to {$user->email} (ID: {$user->id})");
                $sent++;
                continue;
            }

            Mail::to($user->email)->queue(new PlayReminderMail($user));
            $prefService->recordEmailSent($user);
            $sent++;
        }

        $this->info("Done. Sent: {$sent}, Skipped: {$skipped}, Total eligible: {$users->count()}");

        return self::SUCCESS;
    }
}
