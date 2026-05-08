<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Model;

/**
 * @deprecated The cumulative-tier commission model has been retired in favor
 * of time-decaying per-user rates (see ReferralService::SUBSCRIPTION_RATE_BY_YEAR).
 * The underlying ambassador_tiers table was dropped in migration
 * 2026_05_04_120000_drop_ambassador_tiers_table.php. This shim exists only
 * so legacy callers (admin dashboards we haven't yet pruned) keep compiling
 * and return safe empty values instead of querying a non-existent table.
 *
 * Do not introduce new callers. Delete this file once the admin tier UI is
 * fully ripped out.
 */
class AmbassadorTier extends Model
{
    public static function getTierForCount(int $paidReferrals): ?self
    {
        return null;
    }

    public static function getNextTier(int $paidReferrals): ?self
    {
        return null;
    }

    public static function allOrdered(): Collection
    {
        return new Collection();
    }
}
