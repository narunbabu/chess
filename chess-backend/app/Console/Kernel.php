<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // Run log rotation daily at midnight
        $schedule->command('logs:rotate')
                 ->daily()
                 ->at('00:00')
                 ->description('Rotate, compress, and cleanup Laravel log files');

        // Optional: Run log rotation every 6 hours for high-traffic sites
        // $schedule->command('logs:rotate')->everySixHours();

        // Clean up expired invitations every hour
        $schedule->command('invitations:cleanup-expired')
                 ->hourly()
                 ->description('Clean up expired invitations and update their status');
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}