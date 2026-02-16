<?php

namespace App\Console\Commands;

use App\Services\SubscriptionService;
use Illuminate\Console\Command;

class SyncSubscriptionStatus extends Command
{
    protected $signature = 'subscriptions:sync-status';
    protected $description = 'Expire stale subscriptions and downgrade users to free tier';

    public function handle(SubscriptionService $subscriptionService): int
    {
        $this->info('Syncing subscription statuses...');

        $expiredCount = $subscriptionService->expireStaleSubscriptions();

        $this->info("Expired {$expiredCount} subscription(s).");

        return self::SUCCESS;
    }
}
