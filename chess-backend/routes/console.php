<?php

use Illuminate\Foundation\Console\ClosureCommand;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    /** @var ClosureCommand $this */
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Schedule active games heartbeat every 2 seconds for clock synchronization
// This ensures all players see accurate timer updates even during connection issues
Schedule::command('games:heartbeat')
    ->everyTwoSeconds()
    ->withoutOverlapping()
    ->runInBackground();
