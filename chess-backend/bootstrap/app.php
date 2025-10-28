<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Console\Scheduling\Schedule;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withSchedule(function (Schedule $schedule) {
        // Monitor game inactivity every minute
        $schedule->command('games:monitor-inactivity')
            ->everyMinute()
            ->withoutOverlapping()
            ->runInBackground();
    })
    ->withMiddleware(function (Middleware $middleware) {
        // CORS is handled by \Fruitcake\Cors\HandleCors in Kernel.php (global middleware)
        // using the configuration in config/cors.php
    })
    ->withExceptions(function (Exceptions $exceptions) {
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
