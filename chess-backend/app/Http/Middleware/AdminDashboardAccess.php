<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AdminDashboardAccess
{
    /**
     * Handle an incoming request.
     *
     * Allow access only if the authenticated user has the platform_admin role
     * or their email is ab@ameyem.com.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource',
            ], 401);
        }

        if ($user->email === 'ab@ameyem.com'
            || $user->hasRole('platform_admin')
            || $user->hasRole('organization_admin')
        ) {
            return $next($request);
        }

        return response()->json([
            'error' => 'Forbidden',
            'message' => 'You do not have permission to access the admin dashboard',
        ], 403);
    }
}
