<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Gate for adult-only, money-handling features (e.g. the Ambassador
 * program). Must run after auth:sanctum — callers are assumed to already
 * be authenticated, so $request->user() is not null here.
 *
 * Fails CLOSED on unknown age: a user with no birthday on file is treated
 * the same as a known minor, because this guards a financial feature
 * (bank/UPI payout collection) on a platform marketed to ages 5-18.
 */
class EnsureAdult
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if ($user->is_minor || $user->needs_birthday) {
            return response()->json([
                'error' => 'adult_only',
                'message' => 'The Ambassador program is only available to adults (18+).',
            ], 403);
        }

        return $next($request);
    }
}
