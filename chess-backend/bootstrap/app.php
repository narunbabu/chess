<?php

use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // Add CORS middleware for API routes
        $middleware->api(prepend: [
            \App\Http\Middleware\AddCorsHeader::class,
        ]);
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
