<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\DB;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        Log::info('=== APPLICATION STARTUP ===');
        Log::info('Environment: ' . app()->environment());
        Log::info('Debug mode: ' . (config('app.debug') ? 'ON' : 'OFF'));
        Log::info('Database connection: ' . config('database.default'));

        try {
            // Test database connection
            DB::connection()->getPdo();
            Log::info('Database connection: SUCCESS');
        } catch (\Exception $e) {
            Log::error('Database connection: FAILED - ' . $e->getMessage());
        }

        Log::info('=== APPLICATION READY ===');
    }
}
