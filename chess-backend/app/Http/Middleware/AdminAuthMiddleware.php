<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminAuthMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Allow access in local development and testing
        if (in_array(config('app.env'), ['local', 'testing'])) {
            return $next($request);
        }

        // Check for admin token in various places
        $token = $request->header('X-Admin-Token')
                 ?? $request->query('token')
                 ?? $request->input('token')
                 ?? $request->bearerToken();

        $adminToken = config('app.admin_token');

        // Validate token
        if (empty($adminToken) || $token !== $adminToken) {
            // Log unauthorized attempt
            \Log::warning('Unauthorized admin access attempt', [
                'ip' => $request->ip(),
                'url' => $request->fullUrl(),
                'user_agent' => $request->userAgent(),
            ]);

            // Return 403 for API requests
            if ($request->expectsJson()) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'Admin access required'
                ], 403);
            }

            // Return HTML for browser requests
            abort(403, 'Forbidden - Admin access required');
        }

        return $next($request);
    }
}