<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckRole
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$roles
     */
    public function handle(Request $request, Closure $next, string ...$roles): Response
    {
        if (!$request->user()) {
            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource',
            ], 401);
        }

        // Check if user has any of the specified roles
        if (!$request->user()->hasAnyRole($roles)) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have the required role to access this resource',
                'required_roles' => $roles,
            ], 403);
        }

        return $next($request);
    }
}
