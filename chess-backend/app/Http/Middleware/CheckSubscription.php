<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckSubscription
{
    /**
     * Handle an incoming request.
     *
     * Usage: Route::middleware('subscription:premium,pro')
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$tiers  Allowed subscription tiers
     */
    public function handle(Request $request, Closure $next, string ...$tiers): Response
    {
        if (!$request->user()) {
            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource',
            ], 401);
        }

        $user = $request->user();

        // Check if user's subscription has expired
        if ($user->subscription_tier !== 'free' && !$user->hasActiveSubscription()) {
            return response()->json([
                'error' => 'Subscription expired',
                'message' => 'Your subscription has expired. Please renew to access this feature.',
                'required_tiers' => $tiers,
            ], 403);
        }

        // Check if user's tier is in the allowed list
        $userTier = $user->subscription_tier ?? 'free';
        if (!in_array($userTier, $tiers)) {
            return response()->json([
                'error' => 'Subscription required',
                'message' => 'This feature requires a higher subscription tier',
                'required_tiers' => $tiers,
                'current_tier' => $userTier,
            ], 403);
        }

        return $next($request);
    }
}
