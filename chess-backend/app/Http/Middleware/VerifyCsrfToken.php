<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\VerifyCsrfToken as Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class VerifyCsrfToken extends Middleware
{
    /**
     * The URIs that should be excluded from CSRF verification.
     *
     * @var array<int, string>
     */
    protected $except = [
        '*', // Exclude ALL routes from CSRF for debugging
    ];

    /**
     * Handle an incoming request.
     */
    public function handle($request, \Closure $next)
    {
        // Debug logging
        Log::info('CSRF Middleware: Processing request', [
            'url' => $request->fullUrl(),
            'method' => $request->method(),
            'except_all' => in_array('*', $this->except),
        ]);

        // Since we're excluding everything, skip CSRF check entirely
        if (in_array('*', $this->except)) {
            Log::info('CSRF Middleware: Skipping CSRF check for all routes');
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}