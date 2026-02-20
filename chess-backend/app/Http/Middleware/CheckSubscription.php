<?php

namespace App\Http\Middleware;

use App\Enums\SubscriptionTier;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscription
{
    /**
     * Verify that the authenticated user has at least one of the required
     * subscription tiers (or a higher tier).
     *
     * Usage examples:
     *   Route::middleware('subscription:silver')       // silver or gold
     *   Route::middleware('subscription:gold')         // gold only
     *   Route::middleware('subscription:silver,gold')  // silver or gold (explicit)
     *
     * Tier hierarchy (lowest → highest): free < silver < gold
     *
     * @param  string  ...$tiers  Minimum allowed subscription tiers
     */
    public function handle(Request $request, Closure $next, string ...$tiers): Response
    {
        if (!$request->user()) {
            return response()->json([
                'error'   => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource',
            ], 401);
        }

        $user = $request->user();

        // Check if a paid subscription has expired (3-day grace period applied in hasActiveSubscription)
        if ($user->subscription_tier !== 'free' && !$user->hasActiveSubscription()) {
            return response()->json([
                'error'          => 'Subscription expired',
                'message'        => 'Your subscription has expired. Please renew to access this feature.',
                'required_tiers' => $tiers,
            ], 403);
        }

        // Resolve the user's tier level
        $userTierEnum = SubscriptionTier::tryFrom($user->subscription_tier ?? 'free')
            ?? SubscriptionTier::FREE;

        // Find the minimum level required across all listed tiers
        $requiredLevel = PHP_INT_MAX;
        foreach ($tiers as $tierName) {
            $tierEnum = SubscriptionTier::tryFrom(strtolower($tierName));
            if ($tierEnum !== null) {
                $requiredLevel = min($requiredLevel, $tierEnum->level());
            }
        }

        // Allow if user's level meets or exceeds the minimum required level
        if ($userTierEnum->level() >= $requiredLevel) {
            return $next($request);
        }

        return response()->json([
            'error'          => 'Subscription required',
            'message'        => 'This feature requires a higher subscription tier',
            'required_tiers' => $tiers,
            'current_tier'   => $user->subscription_tier ?? 'free',
        ], 403);
    }
}
