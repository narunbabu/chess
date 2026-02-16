<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Support\Facades\RateLimiter;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
        then: function () {
            // Rate limiters for mobile API
            RateLimiter::for('mobile-api', function (Illuminate\Http\Request $request) {
                return $request->user()
                    ? Limit::perMinute(120)->by($request->user()->id)
                    : Limit::perMinute(30)->by($request->ip());
            });

            RateLimiter::for('mobile-auth', function (Illuminate\Http\Request $request) {
                return Limit::perMinute(10)->by($request->ip());
            });

            // API v1 routes for mobile apps (Android/iOS)
            Illuminate\Support\Facades\Route::middleware(['api', 'throttle:mobile-api'])
                ->prefix('api/v1')
                ->group(base_path('routes/api_v1.php'));
        },
    )
    ->withSchedule(function (Schedule $schedule) {
        // Monitor game inactivity every minute
        $schedule->command('games:monitor-inactivity')
            ->everyMinute()
            ->withoutOverlapping()
            ->runInBackground();

        // Auto-start tournaments every 5 minutes
        $schedule->command('tournaments:auto-start')
            ->everyFiveMinutes()
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Automatically start tournaments when registration deadline passes');

        // Auto-generate next rounds every 5 minutes
        $schedule->command('tournaments:auto-generate-rounds')
            ->everyFiveMinutes()
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Automatically generate next rounds when current round completes');

        // Clean expired invitations every 10 minutes
        $schedule->command('invitations:clean-expired')
            ->everyTenMinutes()
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Clean up expired championship match invitations');

        // Check expired matches every 15 minutes
        $schedule->job(new \App\Jobs\CheckExpiredMatchesJob)
            ->everyFifteenMinutes()
            ->withoutOverlapping()
            ->description('Check and expire inactive matches');

        // Send match reminders every hour
        $schedule->job(new \App\Jobs\SendMatchReminderJob)
            ->hourly()
            ->withoutOverlapping()
            ->description('Send reminders for upcoming matches');

        // Send play reminder emails daily at 10:00 UTC
        $schedule->command('emails:send-play-reminders --limit=500')
            ->dailyAt('10:00')
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Send re-engagement emails to inactive users');

        // Send weekly digest emails on Monday at 08:00 UTC
        $schedule->command('emails:send-weekly-digest --limit=1000')
            ->weeklyOn(1, '08:00')
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Send weekly stats digest to active players');

        // Expire stale subscriptions daily at 02:00 UTC
        $schedule->command('subscriptions:sync-status')
            ->dailyAt('02:00')
            ->withoutOverlapping()
            ->runInBackground()
            ->description('Expire stale subscriptions and downgrade to free');
    })
    ->withMiddleware(function (Middleware $middleware) {
        // CORS is handled by \Fruitcake\Cors\HandleCors in Kernel.php (global middleware)
        // using the configuration in config/cors.php

        // Track user activity for online/offline status detection
        $middleware->append(\App\Http\Middleware\TrackUserActivity::class);

        // Register custom authorization middleware
        $middleware->alias([
            'role' => \App\Http\Middleware\CheckRole::class,
            'permission' => \App\Http\Middleware\CheckPermission::class,
            'admin.auth' => \App\Http\Middleware\AdminAuthMiddleware::class,
            'subscription' => \App\Http\Middleware\CheckSubscription::class,
        ]);

        // Exclude broadcasting/auth from CSRF verification for WebSocket authentication
        $middleware->validateCsrfTokens(except: [
            'broadcasting/auth',
        ]);

        // API middleware is configured correctly in Kernel.php
        // Just ensure our custom CSRF middleware is excluded

        // Configure authentication to NOT redirect for API routes
        // This prevents the "Route [login] not defined" error
        $middleware->redirectGuestsTo(function ($request) {
            // For API routes, return null to trigger JSON response instead of redirect
            // This works together with the AuthenticationException handler below
            return null;
        });
    })
    ->withExceptions(function (Exceptions $exceptions) {
        // Handle authentication exceptions for API routes
        $exceptions->render(function (\Illuminate\Auth\AuthenticationException $e, Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => 'Unauthenticated',
                    'message' => 'Authentication required to access this resource'
                ], 401);
            }
        });

        // Handle authorization exceptions for API routes
        $exceptions->render(function (\Illuminate\Auth\Access\AuthorizationException $e, Illuminate\Http\Request $request) {
            if ($request->is('api/*')) {
                return response()->json([
                    'error' => 'Forbidden',
                    'message' => 'You do not have permission to perform this action'
                ], 403);
            }
        });

        $exceptions->render(function (Throwable $e, Illuminate\Http\Request $request) {
            \Illuminate\Support\Facades\Log::error('=== GLOBAL EXCEPTION HANDLER ===');
            \Illuminate\Support\Facades\Log::error('Exception: ' . $e->getMessage());
            \Illuminate\Support\Facades\Log::error('File: ' . $e->getFile() . ' Line: ' . $e->getLine());
            \Illuminate\Support\Facades\Log::error('Stack trace: ' . $e->getTraceAsString());
            \Illuminate\Support\Facades\Log::error('Request URL: ' . $request->fullUrl());
            \Illuminate\Support\Facades\Log::error('Request Method: ' . $request->method());
            \Illuminate\Support\Facades\Log::error('Request Headers: ', $request->headers->all());

            return response()->json([
                'error' => 'Server error',
                'message' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ], 500);
        });
    })->create();
