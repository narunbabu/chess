<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     * @param  string  ...$permissions
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (!$request->user()) {
            return response()->json([
                'error' => 'Unauthenticated',
                'message' => 'You must be logged in to access this resource',
            ], 401);
        }

        // Check if user has any of the specified permissions
        if (!$request->user()->hasAnyPermission($permissions)) {
            return response()->json([
                'error' => 'Forbidden',
                'message' => 'You do not have the required permission to access this resource',
                'required_permissions' => $permissions,
            ], 403);
        }

        return $next($request);
    }
}
